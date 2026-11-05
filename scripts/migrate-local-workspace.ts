// Owner-approved C2.2A local administrator exception. No import-time connection/write.
import assert from "node:assert/strict";
import { lookup } from "node:dns/promises";
import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { PgDialect } from "drizzle-orm/pg-core";
import { databaseConfiguration } from "../lib/db/config";
import { previewMigrationSource, workspaceMigrationSource, verifyPreviewLedger, verifyWorkspaceLedger } from "./preview-migration-source";
import { verifyLocalWorkspaceSchema } from "./preview-schema";
import { privateFile } from "./upload-acceptance-safety";
import { previewFailure } from "./preview-initialization";

const digest = (x: unknown) => createHash("sha256").update(JSON.stringify(x)).digest("hex");
export function verifyLocalIdentity(row: Record<string, unknown>) {
    assert.equal(row.database, "thesishs_ai"); assert.equal(row.oid, "16387");
    assert.equal(row.cluster, "7652422818440234372"); assert.equal(row.port, 5432);
    assert.ok(["127.0.0.1", "::1"].includes(String(row.address)));
    assert.equal(row.username, "postgres"); assert.equal(row.login, "postgres");
    assert.equal(row.owner, "postgres"); assert.equal(row.superuser, true);
}
export function verifyLocalLedger(ledger: { id: number; hash: string; created_at: string }[], entries: 15 | 16 | 17) {
    if (entries === 15) verifyPreviewLedger(ledger, 15);
    else verifyWorkspaceLedger(ledger, entries);
}
export async function inspectLocalWorkspace(sql: postgres.Sql, entries: 15 | 16 | 17) {
    const source = workspaceMigrationSource();
    const [identity] = await sql`select current_database() as database,current_user as username,session_user as login,
        host(inet_server_addr()) as address,inet_server_port() as port,
        (select oid::text from pg_database where datname=current_database()) as oid,
        (select system_identifier::text from pg_control_system()) as cluster,
        (select pg_get_userbyid(datdba) from pg_database where datname=current_database()) as owner,
        (select rolsuper from pg_roles where rolname=current_user) as superuser`;
    verifyLocalIdentity(identity);
    const ledger = Array.from(await sql<{ id: number; hash: string; created_at: string }[]>`select id,hash,created_at::text from drizzle.__drizzle_migrations order by created_at,id`);
    verifyLocalLedger(ledger, entries);
    const tables = Object.values((entries === 17 ? source.snapshot : previewMigrationSource().snapshot).tables)
        .map(t => (t as { name: string }).name).filter(n => entries !== 15 || n !== "push_subscriptions").sort();
    const actual = await sql`select tablename from pg_tables where schemaname='public' order by tablename`;
    assert.deepEqual(actual.map(r => r.tablename), tables);
    const rows: Record<string, { count: number; hash: string }> = {};
    for (const table of tables) {
        assert.match(table, /^[a-z_][a-z0-9_]*$/);
        // Only aggregate digests leave PostgreSQL; no account/research records are logged.
        const [row] = await sql`select count(*)::int as count,md5(coalesce(string_agg(h,'' order by h),'')) as hash
            from (select md5(row_to_json(t)::text) as h from ${sql(`public.${table}`)} t) q`;
        rows[table] = { count: row.count, hash: row.hash };
    }
    const columns = await sql`select c.relname,a.attname,a.attnum,format_type(a.atttypid,a.atttypmod) as type,a.attnotnull,a.attidentity,a.attgenerated,
        pg_get_expr(d.adbin,d.adrelid) as default_value,a.attcollation::text from pg_attribute a join pg_class c on c.oid=a.attrelid
        join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
        where n.nspname='public' and a.attnum>0 and not a.attisdropped and c.relkind in ('r','p') order by c.relname,a.attnum`;
    const constraints = await sql`select c.relname,k.conname,k.contype,k.convalidated,k.conenforced,pg_get_constraintdef(k.oid) as definition
        from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' order by c.relname,k.conname`;
    const indexes = await sql`select tablename,indexname,indexdef from pg_indexes where schemaname='public' order by tablename,indexname`;
    const sequences: Record<string, unknown> = {};
    for (const seq of await sql`select sequencename,start_value,min_value,max_value,increment_by,cycle,cache_size from pg_sequences where schemaname='public' order by sequencename`) {
        assert.match(String(seq.sequencename), /^[a-z_][a-z0-9_]*$/);
        const [value] = await sql`select last_value::text,is_called from ${sql(`public.${seq.sequencename}`)}`;
        sequences[String(seq.sequencename)] = { definition: seq, value };
    }
    const catalog = Object.fromEntries(tables.map(name => [name, digest({
        columns: columns.filter(r => r.relname === name), constraints: constraints.filter(r => r.relname === name),
        indexes: indexes.filter(r => r.tablename === name),
    })]));
    return { identity, ledger, rows, sequences, catalog, target: digest(identity), source: source.hash };
}
type State = Awaited<ReturnType<typeof inspectLocalWorkspace>>;
export function verifyLocalBackup(evidence: { sha256: string; inventoryVerified: boolean; fullArchiveDecoded: boolean; before: State }, hash: string, before: State) {
    assert.equal(evidence.sha256, hash); assert.equal(evidence.inventoryVerified, true); assert.equal(evidence.fullArchiveDecoded, true);
    assert.deepEqual(evidence.before.ledger, before.ledger);
    verifyLocalPreservation(evidence.before, before);
}
export function verifyLocalPreservation(before: State, after: State) {
    assert.equal(before.target, after.target); assert.equal(before.source, after.source);
    for (const name of Object.keys(before.rows)) {
        assert.deepEqual(after.rows[name], before.rows[name]); assert.equal(after.catalog[name], before.catalog[name]);
    }
    for (const name of Object.keys(before.sequences)) assert.deepEqual(after.sequences[name], before.sequences[name]);
}
export function localPendingSource(entries: 15 | 16) {
    assert.ok(entries === 15 || entries === 16);
    const source = workspaceMigrationSource();
    assert.equal(source.migrations[16].hash, "5723a915ab263564713874da26365b58e45d3001b491dec26bcff0170da5fb63");
    return source.migrations.slice(0, entries + 1);
}
export async function applyLocalStep(tx: postgres.TransactionSql, options: postgres.Sql["options"], entries: 15 | 16) {
    const migrations = localPendingSource(entries);
    // Same installed dialect/session/savepoint technique as the existing guarded Preview migrator.
    const nested = new Proxy(tx, { get(target, key) {
        if (key === "options") return options;
        return key === "begin" ? target.savepoint.bind(target) : Reflect.get(target, key);
    } });
    const database = drizzle(nested as unknown as postgres.Sql);
    const session = database._.session as unknown as Parameters<PgDialect["migrate"]>[1];
    await new PgDialect().migrate(migrations, session, { migrationsFolder: "db/migrations" });
}

export async function runLocalWorkspace(args: string[]) {
    let client: postgres.Sql | undefined, executionBegan = false, completedEntries = 15;
    try {
        const inspect = args.length === 1 && args[0] === "--inspect";
        const allowed = ["--backup-file", "--confirm-backup", "--confirm-target", "--confirm-source"];
        const values = new Map<string, string>();
        if (!inspect) {
            assert.equal(args[0], "--execute"); assert.equal(args.length, 9);
            for (let i = 1; i < args.length; i += 2) { assert.ok(allowed.includes(args[i])); assert.ok(!values.has(args[i])); values.set(args[i], args[i + 1]); }
            assert.equal(values.size, 4);
        }
        const env = { ...(await import("dotenv")).parse(readFileSync(".env")), ...process.env, NODE_ENV: "test" };
        const config = databaseConfiguration(env);
        assert.equal(config.environment, "development"); assert.equal(config.endpoint.database, "thesishs_ai");
        assert.equal(config.endpoint.user, "postgres"); assert.equal(config.endpoint.port, 5432);
        assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(config.endpoint.host));
        const addresses = await lookup(config.endpoint.host.replace(/^\[|\]$/g, ""), { all: true });
        assert.ok(addresses.length && addresses.every(a => a.address === "::1" || /^127\./.test(a.address)));
        client = postgres(config.url, { ...config.options, max: 1, connect_timeout: 3, onnotice: () => {},
            connection: { application_name: "thesishs_c22a_local", statement_timeout: 10000, lock_timeout: 3000, idle_in_transaction_session_timeout: 30000, ...(inspect ? { default_transaction_read_only: true } : {}) } });
        const sql = client;
        const read = (entries: 15 | 16 | 17) => sql.begin("isolation level repeatable read read only", tx => inspectLocalWorkspace(tx as unknown as postgres.Sql, entries));
        const before = await read(15);
        if (inspect) { console.log(JSON.stringify({ status: "inspected", identity: before.identity, entries: 15, target: before.target, source: before.source, counts: Object.fromEntries(Object.entries(before.rows).map(([n, r]) => [n, r.count])) })); return; }
        assert.equal(values.get("--confirm-target"), before.target); assert.equal(values.get("--confirm-source"), before.source);
        const archive = readFileSync(privateFile(values.get("--backup-file")!));
        assert.equal(archive.subarray(0, 5).toString(), "PGDMP"); assert.ok(archive.length > 5);
        const archiveHash = createHash("sha256").update(archive).digest("hex");
        assert.equal(archiveHash, values.get("--confirm-backup"));
        const evidencePath = privateFile(join(dirname(values.get("--backup-file")!), "evidence.json"));
        assert.ok(Date.now() - statSync(evidencePath).mtimeMs >= 0 && Date.now() - statSync(evidencePath).mtimeMs < 24 * 60 * 60 * 1000);
        verifyLocalBackup(JSON.parse(readFileSync(evidencePath, "utf8")), archiveHash, before);
        // One session advisory lock spans both commits; application writers are excluded by table locks.
        await sql`select pg_advisory_lock(1296388937,16)`;
        try {
            for (const entries of [15, 16] as const) {
                const expected = await read(entries);
                verifyLocalPreservation(before, expected);
                await sql.begin(async tx => {
                    await tx`set local search_path=public`;
                    await tx`lock table drizzle.__drizzle_migrations in exclusive mode`;
                    for (const table of Object.keys(expected.rows)) await tx`lock table ${tx(`public.${table}`)} in share mode`;
                    const current = await inspectLocalWorkspace(tx as unknown as postgres.Sql, entries);
                    verifyLocalPreservation(expected, current);
                    await verifyLocalWorkspaceSchema(tx as unknown as postgres.Sql, entries);
                    executionBegan = true;
                    await applyLocalStep(tx, sql.options, entries);
                    const next = (entries + 1) as 16 | 17;
                    await verifyLocalWorkspaceSchema(tx as unknown as postgres.Sql, next);
                    const after = await inspectLocalWorkspace(tx as unknown as postgres.Sql, next);
                    verifyLocalPreservation(current, after);
                });
                completedEntries = entries + 1;
                const durable = await read(completedEntries as 16 | 17);
                verifyLocalPreservation(expected, durable);
                console.log(JSON.stringify({ migration: entries === 15 ? "0015" : "0016", status: "applied-verified", entries: completedEntries, existingRecordsAndSequencesPreserved: true }));
            }
        } finally { await sql`select pg_advisory_unlock(1296388937,16)`; }
        console.log(JSON.stringify({ status: "PASS", entries: 17, target: before.target, source: workspaceMigrationSource().hash }));
    } catch (error) {
        let durableEntries: number | null = null;
        if (client && executionBegan) {
            try {
                await client.begin("read only", async tx => {
                    const ledger = await tx`select id,hash,created_at::text from drizzle.__drizzle_migrations order by created_at,id`;
                    assert.ok([15, 16, 17].includes(ledger.length));
                    await inspectLocalWorkspace(tx as unknown as postgres.Sql, ledger.length as 15 | 16 | 17);
                    durableEntries = ledger.length;
                });
            } catch { /* Uncertain state stays explicit; never retry an application. */ }
        }
        console.error(JSON.stringify({ status: executionBegan ? "FAIL" : "BLOCKED", completedEntries, durableEntries, executionBegan, ...previewFailure(error), automaticRetry: false }));
        process.exitCode = 1;
    } finally { await client?.end({ timeout: 2 }); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void runLocalWorkspace(process.argv.slice(2));
