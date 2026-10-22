// The only writable target is a newly created, run-owned database. Existing data is read/fingerprinted only.
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import * as schema from "@/db/schema";
import { databaseConfiguration } from "@/lib/db/config";
import { initializeRoles, insertInitialAdmin } from "@/lib/repositories/database-initialization.repository";
import { bootstrapInitialAdmin } from "@/lib/services/database-initialization.service";
import { comparePassword } from "@/lib/auth/hash";
import { inspectOperatorTarget } from "@/scripts/database-operator";

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
// PostgreSQL truncates SQL identifiers to 63 bytes; repository identifiers are ASCII.
const pgName = (name: string) => name.slice(0, 63);
const loopback = (address: string) => address === "::1" || address === "127.0.0.1";
async function fingerprint(client: postgres.Sql) {
    return client.begin("read only", async tx => {
        const tables = await tx`select tablename from pg_tables where schemaname='public' order by tablename`;
        const rows: Record<string, string> = {};
        for (const { tablename } of tables) {
            const [row] = await tx`select md5(coalesce(string_agg(h,'' order by h),'')) as hash from
                (select md5(row_to_json(t)::text) as h from ${tx(`public.${tablename}`)} t) hashes`;
            rows[tablename] = row.hash;
        }
        const structure = await tx`select c.relname,pg_get_constraintdef(k.oid) as definition,k.conname,k.contype
            from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace
            where n.nspname='public' order by c.relname,k.conname`;
        const columns = await tx`select table_name,column_name,data_type,is_nullable,column_default,udt_name,character_maximum_length
            from information_schema.columns where table_schema='public' order by table_name,ordinal_position`;
        const indexes = await tx`select tablename,indexname,indexdef from pg_indexes where schemaname='public' order by tablename,indexname`;
        const sequences = await tx`select sequencename,last_value from pg_sequences where schemaname='public' order by sequencename`;
        const ledger = await tx`select * from drizzle.__drizzle_migrations order by id`;
        return digest({ rows, structure, columns, indexes, sequences, ledger });
    });
}

async function verifySchema(client: postgres.Sql) {
    const snapshot = JSON.parse(readFileSync("db/migrations/meta/0013_snapshot.json", "utf8"));
    const tables = await client`select tablename from pg_tables where schemaname='public' order by tablename`;
    assert.deepEqual(tables.map(row => row.tablename), Object.values(snapshot.tables).map((t: unknown) => (t as { name: string }).name).sort());
    let constraintCount = 0, indexCount = 0;
    for (const table of Object.values(snapshot.tables) as { name: string; columns: Record<string, { name: string; type: string; notNull: boolean; primaryKey: boolean }>;
        foreignKeys: Record<string, { name: string; tableTo: string; columnsFrom: string[]; columnsTo: string[]; onDelete: string; onUpdate: string }>;
        uniqueConstraints: Record<string, { name: string; columns: string[] }>; checkConstraints: Record<string, { name: string; value: string }>;
        compositePrimaryKeys: Record<string, { name: string; columns: string[] }>;
        indexes: Record<string, { name: string; isUnique: boolean; method: string; columns: { expression: string; isExpression: boolean; asc: boolean; nulls: string }[]; where?: string }> }[]) {
        const columns = await client`select a.attname as name,format_type(a.atttypid,a.atttypmod) as type,a.attnotnull as not_null,
            pg_get_expr(d.adbin,d.adrelid) as default_value from pg_attribute a join pg_class c on c.oid=a.attrelid
            join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
            where n.nspname='public' and c.relname=${table.name} and a.attnum>0 and not a.attisdropped order by a.attnum`;
        assert.equal(columns.length, Object.keys(table.columns).length);
        for (const expected of Object.values(table.columns)) {
            const actual = columns.find(c => c.name === expected.name); assert.ok(actual);
            assert.equal(actual.not_null, expected.notNull);
            const type = expected.type === "serial" ? "integer" : expected.type.replace(/^varchar/, "character varying")
                .replace(/^timestamp with time zone/, "timestamp with time zone").replace(/^timestamp$/, "timestamp without time zone");
            assert.equal(actual.type, type, `${table.name}.${expected.name} type`);
            if (expected.type === "serial") assert.match(actual.default_value, /^nextval\(/);
        }
        const constraints = await client`select k.conname as name,k.contype as type,pg_get_constraintdef(k.oid) as definition,
            f.relname as target,k.confdeltype,k.confupdtype,
            array(select a.attname from unnest(k.conkey) with ordinality x(num,ord) join pg_attribute a on a.attrelid=k.conrelid and a.attnum=x.num order by x.ord) as columns,
            array(select a.attname from unnest(k.confkey) with ordinality x(num,ord) join pg_attribute a on a.attrelid=k.confrelid and a.attnum=x.num order by x.ord) as referenced
            from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace
            left join pg_class f on f.oid=k.confrelid where n.nspname='public' and c.relname=${table.name}`;
        const wantedNames = [...Object.keys(table.foreignKeys), ...Object.keys(table.uniqueConstraints), ...Object.keys(table.checkConstraints),
            ...Object.keys(table.compositePrimaryKeys), ...(Object.values(table.columns).some(c => c.primaryKey) ? [`${table.name}_pkey`] : [])].map(pgName);
        const actualNames = constraints.filter(c => c.type !== 'n').map(c => c.name).sort();
        assert.deepEqual(actualNames, wantedNames.sort());
        constraintCount += wantedNames.length;
        const action: Record<string, string> = { "no action": "a", restrict: "r", cascade: "c", "set null": "n", "set default": "d" };
        for (const fk of Object.values(table.foreignKeys)) {
            const c = constraints.find(c => c.name === pgName(fk.name))!; assert.equal(c.type, 'f'); assert.equal(c.target, fk.tableTo);
            assert.deepEqual(c.columns, fk.columnsFrom); assert.deepEqual(c.referenced, fk.columnsTo);
            assert.equal(c.confdeltype, action[fk.onDelete]); assert.equal(c.confupdtype, action[fk.onUpdate]);
        }
        for (const item of Object.values(table.uniqueConstraints)) assert.deepEqual(constraints.find(c => c.name === pgName(item.name))!.columns, item.columns);
        for (const item of Object.values(table.compositePrimaryKeys)) assert.deepEqual(constraints.find(c => c.name === pgName(item.name))!.columns, item.columns);
        const primaryColumns = Object.values(table.columns).filter(c => c.primaryKey).map(c => c.name);
        if (primaryColumns.length) assert.deepEqual(constraints.find(c => c.type === 'p')!.columns, primaryColumns);
        // Ask PostgreSQL itself to canonicalize source check/index expressions using an empty temporary copy.
        // Only trusted repository snapshot SQL is executed, and only inside this owned replay database.
        await client`create temporary table phase102b_check (like ${client(`public.${table.name}`)})`;
        for (const item of Object.values(table.checkConstraints)) {
            const expression = item.value.replaceAll(`"${table.name}".`, '');
            await client.unsafe(`alter table pg_temp.phase102b_check add constraint phase102b_expected check (${expression})`);
            const [canonical] = await client`select pg_get_constraintdef(oid) as definition from pg_constraint where conrelid='pg_temp.phase102b_check'::regclass and conname='phase102b_expected'`;
            assert.equal(constraints.find(c => c.name === pgName(item.name))!.definition, canonical.definition);
            await client`alter table pg_temp.phase102b_check drop constraint phase102b_expected`;
        }
        const indexes = await client`select indexname,indexdef from pg_indexes where schemaname='public' and tablename=${table.name}`;
        const expectedIndexes = [...Object.keys(table.indexes).map(pgName), ...constraints.filter(c => ['p', 'u'].includes(c.type)).map(c => c.name)];
        assert.deepEqual(indexes.map(i => i.indexname).sort(), expectedIndexes.sort()); indexCount += indexes.length;
        for (const item of Object.values(table.indexes)) {
            assert.match(item.method, /^[a-z]+$/);
            const indexColumns = item.columns.map(c => `${c.isExpression ? c.expression : `"${c.expression.replaceAll('"', '""')}"`} ${c.asc ? 'asc' : 'desc'} nulls ${c.nulls}`).join(',');
            const predicate = item.where?.replaceAll(`"${table.name}".`, '');
            await client.unsafe(`create ${item.isUnique ? 'unique ' : ''}index phase102b_expected on pg_temp.phase102b_check using ${item.method} (${indexColumns})${predicate ? ` where ${predicate}` : ''}`);
            const [expected] = await client`select pg_get_indexdef('pg_temp.phase102b_expected'::regclass) as definition`;
            // The method, keys, order, null placement, uniqueness and predicate must match; only the names differ.
            const tail = (definition: string) => definition.slice(definition.indexOf(' USING '));
            const actual = indexes.find(i => i.indexname === pgName(item.name))!;
            assert.equal(actual.indexdef.includes('UNIQUE'), item.isUnique); assert.equal(tail(actual.indexdef), tail(expected.definition));
            await client`drop index pg_temp.phase102b_expected`;
        }
        await client`drop table pg_temp.phase102b_check`;
        const [empty] = await client`select count(*)::int as count from ${client(`public.${table.name}`)}`; assert.equal(empty.count, 0);
    }
    console.log(`PASS schema: ${tables.length} empty tables, ${constraintCount} application constraints, ${indexCount} indexes; columns and FK targets/actions match snapshot.`);
}

async function main() {
    const args = process.argv.slice(2);
    assert.equal(args.length, 4, "Explicit expected cluster and existing database OID are required.");
    assert.equal(args[0], "--expected-cluster"); assert.match(args[1], /^\d+$/);
    assert.equal(args[2], "--expected-database-oid"); assert.match(args[3], /^\d+$/);
    const configuration = databaseConfiguration({ ...process.env, NODE_ENV: "test", VERCEL_ENV: undefined,
        THESISHS_DATABASE_ENV: "development", THESISHS_DATABASE_TARGETS_JSON: undefined });
    assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(configuration.endpoint.host));
    const options = { ...configuration.options, max: 1, onnotice: () => {} };
    const original = postgres(configuration.url, options);
    const maintenanceUrl = new URL(configuration.url); maintenanceUrl.pathname = "/postgres";
    const maintenance = postgres(maintenanceUrl.toString(), options);
    let replay: postgres.Sql | undefined, replay2: postgres.Sql | undefined, ownedOid: string | undefined;
    let before: string | undefined, created = false, cleaned = false;
    const run = randomUUID().replaceAll("-", ""), name = `thesishs_replay_${run}`, marker = `phase102b:${run}`;
    assert.match(name, /^thesishs_replay_[a-f0-9]{32}$/);
    try {
        const [identity] = await original`select current_database() as database,host(inet_server_addr()) as address,
            inet_server_port() as port,(select oid::text from pg_database where datname=current_database()) as oid,
            (select system_identifier::text from pg_control_system()) as cluster`;
        assert.equal(identity.database, configuration.endpoint.database); assert.ok(loopback(identity.address)); assert.equal(identity.port, configuration.endpoint.port);
        assert.equal(identity.oid, args[3]); assert.equal(identity.cluster, args[1]);
        const [admin] = await maintenance`select current_database() as database,host(inet_server_addr()) as address,
            (select system_identifier::text from pg_control_system()) as cluster,
            (select rolcreatedb or rolsuper from pg_roles where rolname=current_user) as can_create`;
        assert.equal(admin.database, "postgres"); assert.equal(admin.cluster, args[1]); assert.ok(loopback(admin.address)); assert.equal(admin.can_create, true);
        before = await fingerprint(original);
        await maintenance.unsafe(`create database "${name}" template template0`); created = true;
        const [owned] = await maintenance`select oid::text as oid from pg_database where datname=${name}`; ownedOid = owned.oid;
        await maintenance.unsafe(`comment on database "${name}" is '${marker}'`);
        await maintenance.unsafe(`revoke connect on database "${name}" from public`);
        const replayUrl = new URL(configuration.url); replayUrl.pathname = `/${name}`;
        replay = postgres(replayUrl.toString(), options); replay2 = postgres(replayUrl.toString(), options);
        const [target] = await replay`select current_database() as database,(select oid::text from pg_database where datname=current_database()) as oid,
            (select system_identifier::text from pg_control_system()) as cluster`;
        assert.equal(target.database, name); assert.equal(target.oid, ownedOid); assert.notEqual(target.oid, identity.oid); assert.equal(target.cluster, args[1]);
        const objects = await replay`select c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname not in ('pg_catalog','information_schema') and n.nspname not like 'pg_toast%'`;
        assert.equal(objects.length, 0);
        const db = drizzle(replay, { schema }), db2 = drizzle(replay2, { schema });
        await migrate(db, { migrationsFolder: "db/migrations" });
        const source = readMigrationFiles({ migrationsFolder: "db/migrations" });
        const ledger = await replay`select hash,created_at::text as created_at from drizzle.__drizzle_migrations order by created_at,id`;
        assert.equal(source.length, 14); assert.equal(ledger.length, 14);
        assert.deepEqual(ledger.map(r => [r.hash, r.created_at]), source.map(r => [r.hash, String(r.folderMillis)]));
        console.log("PASS fresh empty owned database; migrations 0000–0013 replayed with Drizzle; all 14 ledger hashes/timestamps match.");
        await verifySchema(replay);
        const pin = { identity: marker, runtime: { ...configuration.endpoint, database: name }, operator: { ...configuration.endpoint, database: name } };
        const operatorConfiguration = databaseConfiguration({ NODE_ENV: 'test', THESISHS_DATABASE_ENV: 'development',
            THESISHS_DATABASE_ADMIN_URL: replayUrl.toString(), THESISHS_DATABASE_TARGETS_JSON: JSON.stringify({ development: pin }) }, 'operator');
        const inspection = await inspectOperatorTarget(replay, operatorConfiguration); assert.match(inspection.fingerprint, /^[a-f0-9]{64}$/);
        assert.equal(inspection.migrations, 14);
        const input = { firstName: "Synthetic", lastName: "Admin", email: " REPLAY-ADMIN@EXAMPLE.INVALID ",
            password: randomUUID(), confirmPassword: "" }; input.confirmPassword = input.password;
        assert.equal((await bootstrapInitialAdmin(db, input)).success, false); // No roles yet.
        assert.deepEqual(await initializeRoles(db), { inserted: 4 });
        const roleBefore = await replay`select * from role order by id`;
        assert.deepEqual(roleBefore.map(r => [r.id, r.name]), [[1, 'Admin'], [2, 'Adviser'], [3, 'Student'], [4, 'Panel']]);
        assert.deepEqual(await initializeRoles(db), { inserted: 0 }); assert.equal(digest(await replay`select * from role order by id`), digest(roleBefore));
        await Promise.all([initializeRoles(db), initializeRoles(db2)]);
        const [next] = await replay`insert into role(name) values ('Replay extra') returning id`; assert.equal(next.id, 5);
        await replay`alter sequence public.role_id_seq restart with 50`;
        await initializeRoles(db); const [advanced] = await replay`insert into role(name) values ('Replay advanced') returning id`; assert.equal(advanced.id, 50);
        await replay`delete from role where id=4`; assert.deepEqual(await initializeRoles(db), { inserted: 1 });
        for (const kind of ['id', 'name']) {
            if (kind === 'id') await replay`update role set name='User' where id=3`;
            else { await replay`delete from role where id=3`; await replay`insert into role(id,name) values(30,'Student')`; }
            const stateHash: string = digest(await replay`select * from role order by id`);
            await assert.rejects(initializeRoles(db)); assert.equal(digest(await replay`select * from role order by id`), stateHash);
            if (kind === 'id') await replay`update role set name='Student' where id=3`;
            else { await replay`delete from role where id=30`; await replay`insert into role(id,name) values(3,'Student')`; }
        }
        console.log("PASS real roles: deterministic IDs, compatible partial insert, idempotence, two connections, both conflict directions, sequence repair and no rewind.");
        for (const change of [{ email: "invalid" }, { password: "short", confirmPassword: "short" },
            { password: "é".repeat(37), confirmPassword: "é".repeat(37) }, { confirmPassword: "mismatch" }])
            assert.equal((await bootstrapInitialAdmin(db, { ...input, ...change })).success, false);
        await replay`insert into users(first_name,last_name,email,password,role_id) values('Synthetic','Student','REPLAY-ADMIN@example.invalid','not-a-login-hash',3)`;
        assert.equal((await bootstrapInitialAdmin(db, input)).success, false); // Case-insensitive collision.
        await replay`delete from users`;
        const outcomes = await Promise.all([bootstrapInitialAdmin(db, input), bootstrapInitialAdmin(db2, input)]);
        assert.equal(outcomes.filter(r => r.success).length, 1);
        const accounts = await replay`select * from users`; assert.equal(accounts.length, 1);
        assert.equal(accounts[0].role_id, 1); assert.equal(accounts[0].is_active, true); assert.equal(accounts[0].email, 'replay-admin@example.invalid');
        assert.equal(accounts[0].email_verified_at, null); assert.match(accounts[0].password, /^\$2[ab]\$12\$/);
        assert.equal(await comparePassword(input.password, accounts[0].password), true); assert.notEqual(accounts[0].password, input.password);
        assert.equal(JSON.stringify(accounts).includes(input.password), false);
        await replay`update users set is_active=false`;
        assert.equal((await bootstrapInitialAdmin(db, { ...input, email: 'other@example.invalid' })).success, false);
        await assert.rejects(insertInitialAdmin(db, { firstName: 'Synthetic', lastName: 'Admin', email: 'other@example.invalid', passwordHash: 'plaintext' }));
        assert.equal((await replay`select count(*)::int as count from users`)[0].count, 1);
        console.log("PASS real bootstrap: prerequisite roles, invalid inputs/72-byte limit, duplicate email, concurrent single winner, bcrypt12, active Admin, no plaintext and inactive-Admin refusal.");
    } finally {
        await replay?.end({ timeout: 5 }); await replay2?.end({ timeout: 5 });
        try {
            if (created && ownedOid) {
                const [owned] = await maintenance`select d.oid::text as oid,d.datname,shobj_description(d.oid,'pg_database') as marker,
                    pg_get_userbyid(d.datdba)=current_user as owned,(select system_identifier::text from pg_control_system()) as cluster,
                    (select count(*)::int from pg_stat_activity where datid=d.oid) as sessions from pg_database d where datname=${name}`;
                assert.ok(owned); assert.equal(owned.oid, ownedOid); assert.equal(owned.marker, marker); assert.equal(owned.owned, true);
                assert.equal(owned.cluster, args[1]); assert.equal(owned.sessions, 0);
                await maintenance.unsafe(`drop database "${name}"`); // No FORCE; no other sessions are terminated.
                assert.equal((await maintenance`select oid from pg_database where datname=${name}`).length, 0); cleaned = true;
            }
            if (before) {
                const independent = postgres(configuration.url, options);
                try { assert.equal(await fingerprint(independent), before); }
                finally { await independent.end({ timeout: 5 }); }
                console.log("PASS independent preservation: all pre-existing rows, columns, constraints, indexes, sequences and ledger unchanged.");
            }
            if (created) { assert.equal(cleaned, true); console.log("PASS owned replay database removed; no existing database mutated."); }
        } finally { await original.end({ timeout: 5 }); await maintenance.end({ timeout: 5 }); }
    }
}

void main().catch((error: unknown) => {
    const location = error instanceof Error ? error.stack?.match(/phase102b-database\.acceptance\.ts:\d+:\d+/)?.[0] : undefined;
    console.error(`FAIL replay acceptance${location ? ` at ${location}` : ''}. No database error details are logged. An owned replay database may need identity-verified cleanup if cleanup did not report PASS.`);
    process.exitCode = 1;
});
