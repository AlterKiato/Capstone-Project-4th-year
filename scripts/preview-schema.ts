import assert from "node:assert/strict";
import type postgres from "postgres";
import { previewMigrationSource, workspaceMigrationSource, supervisionMigrationSource } from "./preview-migration-source";
import { catalogCheck, catalogDefault, catalogIndex } from "./preview-catalog-contract";
const pgName = (name: string) => name.slice(0, 63);

export class PreviewSchemaAssertion extends Error {
    constructor(readonly schemaObject: string, readonly schemaAssertion: string, cause: unknown) {
        super("Preview schema assertion failed.", { cause });
    }
}

export function verifyPreviewColumnNames(table: string, actual: string[], expected: string[]) {
    let check = "column-count";
    try {
        assert.equal(actual.length, expected.length);
        check = "column-names";
        assert.deepEqual([...actual].sort(), [...expected].sort());
    } catch (error) {
        throw new PreviewSchemaAssertion(`public.${table}`, check, error);
    }
}

// Legacy/local verifier: PostgreSQL canonicalizes trusted SQL in temporary tables.
export type PreviewSchemaMode = "initialize" | "upgrade-0015" | "workspace-baseline" | "upgrade-0016" | "supervision-baseline" | "upgrade-0017" | "supervision-installed";
export async function verifyPreviewSchema(client: postgres.Sql, mode: PreviewSchemaMode = "initialize") {
    if (!["initialize", "upgrade-0015", "workspace-baseline", "upgrade-0016", "supervision-baseline", "upgrade-0017"].includes(mode)) throw new Error("Preview schema mode refused.");
    return verifySchema(client, mode);
}

// Hosted 0017 path. The caller verifies authenticated target/ledger/privileges first and supplies
// a bounded READ ONLY transaction for inspection. All SQL emitted here is SELECT, including on failure.
export async function verifyPreviewCatalog(client: postgres.Sql, mode: "supervision-baseline" | "supervision-installed" | "upgrade-0017") {
    if (!["supervision-baseline", "supervision-installed", "upgrade-0017"].includes(mode)) throw new Error("Preview catalog mode refused.");
    await verifyLedgerCatalog(client);
    return verifySchema(client, mode, undefined, true);
}

async function verifyLedgerCatalog(client: postgres.Sql) {
    try {
        const objects = await client`select c.relname,c.relkind::text,c.relowner=(select oid from pg_roles where rolname=current_user) as owned,
            c.relrowsecurity,c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
            where n.nspname='drizzle' order by c.relname`;
        assert.deepEqual(objects.map(o => `${o.relname}:${o.relkind}`), ['__drizzle_migrations:r', '__drizzle_migrations_id_seq:S', '__drizzle_migrations_pkey:i']);
        assert.ok(objects.every(o => o.owned && !o.relrowsecurity && !o.relforcerowsecurity));
        const columns = await client`select a.attname as name,format_type(a.atttypid,a.atttypmod) as type,a.attnotnull as not_null,
            pg_get_expr(d.adbin,d.adrelid) as default_value,a.attidentity,a.attgenerated
            from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
            where a.attrelid='drizzle.__drizzle_migrations'::regclass and a.attnum>0 and not a.attisdropped order by a.attnum`;
        assert.deepEqual(columns.map(c => ({ ...c })), [
            { name: 'id', type: 'integer', not_null: true, default_value: "nextval('drizzle.__drizzle_migrations_id_seq'::regclass)", attidentity: '', attgenerated: '' },
            { name: 'hash', type: 'text', not_null: true, default_value: null, attidentity: '', attgenerated: '' },
            { name: 'created_at', type: 'bigint', not_null: false, default_value: null, attidentity: '', attgenerated: '' },
        ]);
        const constraints = await client`select conname,contype::text,pg_get_constraintdef(oid) as definition,convalidated,condeferrable,condeferred
            from pg_constraint where conrelid='drizzle.__drizzle_migrations'::regclass and contype<>'n' order by conname`;
        assert.deepEqual(constraints.map(c => ({ ...c })), [{ conname: '__drizzle_migrations_pkey', contype: 'p', definition: 'PRIMARY KEY (id)', convalidated: true, condeferrable: false, condeferred: false }]);
        const [sequence] = await client`select pg_get_serial_sequence('drizzle.__drizzle_migrations','id') as sequence`;
        assert.equal(sequence.sequence, 'drizzle.__drizzle_migrations_id_seq');
        const sequences = await client`select sequencename,start_value::text,min_value::text,max_value::text,increment_by::text,cycle,cache_size::text
            from pg_sequences where schemaname='drizzle' order by sequencename`;
        assert.deepEqual(sequences.map(s => ({ ...s })), [{ sequencename: '__drizzle_migrations_id_seq', start_value: '1', min_value: '1', max_value: '2147483647', increment_by: '1', cycle: false, cache_size: '1' }]);
        const indexes = await client`select pg_get_indexdef(i.indexrelid) as definition,i.indisvalid,i.indisready,i.indislive,i.indimmediate
            from pg_index i where i.indrelid='drizzle.__drizzle_migrations'::regclass`;
        assert.deepEqual(indexes.map(i => ({ ...i })), [{ definition: 'CREATE UNIQUE INDEX __drizzle_migrations_pkey ON drizzle.__drizzle_migrations USING btree (id)', indisvalid: true, indisready: true, indislive: true, indimmediate: true }]);
        const [extras] = await client`select
            exists(select 1 from pg_trigger where tgrelid='drizzle.__drizzle_migrations'::regclass and not tgisinternal) as triggers,
            exists(select 1 from pg_rewrite where ev_class='drizzle.__drizzle_migrations'::regclass and rulename<>'_RETURN') as rules`;
        assert.deepEqual({ ...extras }, { triggers: false, rules: false });
    } catch (error) {
        if (error instanceof assert.AssertionError) throw new PreviewSchemaAssertion('drizzle.__drizzle_migrations', 'ledger-catalog', error);
        throw error;
    }
}

// Explicit local-only entry point; hosted modes/ownership contracts above remain unchanged.
export async function verifyLocalWorkspaceSchema(client: postgres.Sql, entries: 15 | 16 | 17) {
    if (![15, 16, 17].includes(entries)) throw new Error("Local schema version refused.");
    return verifySchema(client, entries === 17 ? "upgrade-0016" : "workspace-baseline", entries);
}

async function verifySchema(client: postgres.Sql, mode: PreviewSchemaMode, localEntries?: 15 | 16 | 17, catalogOnly = false) {
    let schemaObject = "public", schemaAssertion = "table-set";
    try {
        const snapshot = mode === "upgrade-0017" || mode === "supervision-installed" ? supervisionMigrationSource().snapshot :
            mode === "upgrade-0016" || mode === "supervision-baseline" ? workspaceMigrationSource().snapshot : previewMigrationSource().snapshot;
        // 0015 only added push_subscriptions: derive the preceding catalog from pinned source.
        if (localEntries === 15) delete snapshot.tables["public.push_subscriptions"];
        const tables = await client`select tablename from pg_tables where schemaname='public' and not exists(select 1 from pg_depend d where d.classid='pg_class'::regclass and d.objid=(quote_ident(schemaname)||'.'||quote_ident(tablename))::regclass and d.deptype='e') order by tablename`;
        assert.deepEqual(tables.map(row => row.tablename), Object.values(snapshot.tables).map((t: unknown) => (t as { name: string }).name).sort());
        let constraintCount = 0, indexCount = 0;
        const expectedObjects: { name: string; kind: string }[] = [];
        for (const table of Object.values(snapshot.tables) as { name: string; columns: Record<string, { name: string; type: string; notNull: boolean; primaryKey: boolean }>;
            foreignKeys: Record<string, { name: string; tableTo: string; columnsFrom: string[]; columnsTo: string[]; onDelete: string; onUpdate: string }>;
            uniqueConstraints: Record<string, { name: string; columns: string[] }>; checkConstraints: Record<string, { name: string; value: string }>;
            compositePrimaryKeys: Record<string, { name: string; columns: string[] }>;
            indexes: Record<string, { name: string; isUnique: boolean; method: string; columns: { expression: string; isExpression: boolean; asc: boolean; nulls: string }[]; where?: string }> }[]) {
            schemaObject = `public.${table.name}`; schemaAssertion = "table-security";
            expectedObjects.push({ name: table.name, kind: 'r' });
            const [security] = await client`select relrowsecurity,relforcerowsecurity from pg_class where oid=${`public.${table.name}`}::regclass`;
            assert.equal(security.relrowsecurity, (table as { isRLSEnabled?: boolean }).isRLSEnabled ?? false);
            assert.equal(security.relforcerowsecurity, false);
            const columns = await client`select a.attname as name,format_type(a.atttypid,a.atttypmod) as type,a.attnotnull as not_null,(a.attcollation=(select typcollation from pg_type where oid=a.atttypid)) as default_collation,
                pg_get_expr(d.adbin,d.adrelid) as default_value,a.attidentity,a.attgenerated from pg_attribute a join pg_class c on c.oid=a.attrelid
                join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
                where n.nspname='public' and c.relname=${table.name} and a.attnum>0 and not a.attisdropped order by a.attnum`;
            verifyPreviewColumnNames(table.name, columns.map(c => c.name), Object.values(table.columns).map(c => c.name));
            schemaAssertion = "column-properties";
            for (const expected of Object.values(table.columns)) {
                const actual = columns.find(c => c.name === expected.name); assert.ok(actual);
                assert.equal(actual.not_null, expected.notNull); assert.equal(actual.default_collation, true);
                if (catalogOnly) { assert.equal(actual.attidentity, ''); assert.equal(actual.attgenerated, ''); }
                const type = expected.type === "serial" ? "integer" : expected.type.replace(/^varchar/, "character varying")
                    .replace(/^timestamp with time zone/, "timestamp with time zone").replace(/^timestamp$/, "timestamp without time zone");
                assert.equal(actual.type, type, `${table.name}.${expected.name} type`);
                if (expected.type === "serial") {
                    const [serial] = await client`select pg_get_serial_sequence(${`public.${table.name}`},${expected.name}) as sequence`;
                    assert.equal(serial.sequence, `public.${table.name}_${expected.name}_seq`);
                    assert.equal(actual.default_value, `nextval('${table.name}_${expected.name}_seq'::regclass)`);
                }
            }
            schemaAssertion = "constraint-contract";
            const constraints = await client`select k.conname as name,k.contype as type,pg_get_constraintdef(k.oid) as definition,
                f.relname as target,(select nspname from pg_namespace where oid=f.relnamespace) as target_schema,k.confdeltype,k.confupdtype,k.confmatchtype,k.convalidated,k.condeferrable,k.condeferred,coalesce((to_jsonb(k)->>'conenforced')::boolean,true) as enforced,
                array(select a.attname from unnest(k.conkey) with ordinality x(num,ord) join pg_attribute a on a.attrelid=k.conrelid and a.attnum=x.num order by x.ord) as columns,
                array(select a.attname from unnest(k.confkey) with ordinality x(num,ord) join pg_attribute a on a.attrelid=k.confrelid and a.attnum=x.num order by x.ord) as referenced
                from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace
                left join pg_class f on f.oid=k.confrelid where n.nspname='public' and c.relname=${table.name}`;
            const wantedNames = [...Object.keys(table.foreignKeys), ...Object.keys(table.uniqueConstraints), ...Object.keys(table.checkConstraints),
                ...Object.keys(table.compositePrimaryKeys), ...(Object.values(table.columns).some(c => c.primaryKey) ? [`${table.name}_pkey`] : [])].map(pgName);
            const actualNames = constraints.filter(c => c.type !== 'n').map(c => c.name).sort();
            assert.deepEqual(actualNames, wantedNames.sort());
            assert.ok(constraints.every(c => c.convalidated && c.enforced && !c.condeferrable && !c.condeferred));
            constraintCount += wantedNames.length;
            const action: Record<string, string> = { "no action": "a", restrict: "r", cascade: "c", "set null": "n", "set default": "d" };
            for (const fk of Object.values(table.foreignKeys)) {
                const c = constraints.find(c => c.name === pgName(fk.name))!; assert.equal(c.type, 'f'); assert.equal(c.target, fk.tableTo); assert.equal(c.target_schema, 'public'); assert.equal(c.confmatchtype, 's');
                assert.deepEqual(c.columns, fk.columnsFrom); assert.deepEqual(c.referenced, fk.columnsTo);
                assert.equal(c.confdeltype, action[fk.onDelete]); assert.equal(c.confupdtype, action[fk.onUpdate]);
            }
            for (const item of Object.values(table.uniqueConstraints)) assert.deepEqual(constraints.find(c => c.name === pgName(item.name))!.columns, item.columns);
            for (const item of Object.values(table.compositePrimaryKeys)) {
                const actual = constraints.find(c => c.name === pgName(item.name))!;
                assert.equal(actual.type, 'p'); assert.deepEqual(actual.columns, item.columns);
            }
            for (const item of Object.values(table.uniqueConstraints)) assert.equal(constraints.find(c => c.name === pgName(item.name))!.type, 'u');
            const primaryColumns = Object.values(table.columns).filter(c => c.primaryKey).map(c => c.name);
            if (primaryColumns.length) assert.deepEqual(constraints.find(c => c.type === 'p')!.columns, primaryColumns);
            // Ask PostgreSQL itself to canonicalize source check/index expressions using an empty temporary copy.
            // Only trusted repository snapshot SQL is executed, in temporary objects on the guarded target.
            schemaAssertion = "column-defaults";
            if (!catalogOnly) await client`create temporary table phase102b_check (like ${client(`public.${table.name}`)})`;
            for (const expected of Object.values(table.columns)) {
                if (expected.type === 'serial') continue;
                const actual = columns.find(c => c.name === expected.name)!;
                if (catalogOnly) { assert.equal(actual.default_value, catalogDefault(expected)); continue; }
                if ('default' in expected) {
                    await client.unsafe(`alter table pg_temp.phase102b_check alter column "${expected.name}" set default ${String(expected.default)}`);
                    const [canonical] = await client`select pg_get_expr(d.adbin,d.adrelid) as value from pg_attrdef d join pg_attribute a on a.attrelid=d.adrelid and a.attnum=d.adnum where d.adrelid='pg_temp.phase102b_check'::regclass and a.attname=${expected.name}`;
                    assert.equal(actual.default_value, canonical.value);
                } else assert.equal(actual.default_value, null);
            }
            schemaAssertion = "check-expressions";
            for (const item of Object.values(table.checkConstraints)) {
                if (catalogOnly) { assert.equal(constraints.find(c => c.name === pgName(item.name))!.definition, catalogCheck(item.name)); continue; }
                const expression = item.value.replaceAll(`"${table.name}".`, '');
                await client.unsafe(`alter table pg_temp.phase102b_check add constraint phase102b_expected check (${expression})`);
                const [canonical] = await client`select pg_get_constraintdef(oid) as definition from pg_constraint where conrelid='pg_temp.phase102b_check'::regclass and conname='phase102b_expected'`;
                assert.equal(constraints.find(c => c.name === pgName(item.name))!.definition, canonical.definition);
                await client`alter table pg_temp.phase102b_check drop constraint phase102b_expected`;
            }
            schemaAssertion = "index-contract";
            const indexes = await client`select indexname,indexdef from pg_indexes where schemaname='public' and tablename=${table.name}`;
            const expectedIndexes = [...Object.keys(table.indexes).map(pgName), ...constraints.filter(c => ['p', 'u'].includes(c.type)).map(c => c.name)];
            assert.deepEqual(indexes.map(i => i.indexname).sort(), expectedIndexes.sort()); indexCount += indexes.length;
            expectedObjects.push(...indexes.map(i => ({ name: String(i.indexname), kind: 'i' })));
            assert.ok(indexes.every(i => !i.indexdef.includes('NULLS NOT DISTINCT')));
            if (catalogOnly) {
                // Include constraint-backed indexes: no changed keys, opclasses, INCLUDE, predicate,
                // storage options or invalid/unready index can hide behind a correct constraint name.
                const health = await client`select i.indisvalid,i.indisready,i.indislive,i.indimmediate from pg_index i
                    where i.indrelid=${`public.${table.name}`}::regclass`;
                assert.equal(health.length, indexes.length);
                assert.ok(health.every(i => i.indisvalid && i.indisready && i.indislive && i.indimmediate));
                for (const c of constraints.filter(c => ['p', 'u'].includes(c.type))) {
                    const expected = `CREATE UNIQUE INDEX ${c.name} ON public.${table.name} USING btree (${c.columns.join(', ')})`;
                    assert.equal(indexes.find(i => i.indexname === c.name)!.indexdef, expected);
                }
            }
            for (const item of Object.values(table.indexes)) {
                if (catalogOnly) { assert.equal(indexes.find(i => i.indexname === pgName(item.name))!.indexdef, catalogIndex(table.name, item)); continue; }
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
            if (!catalogOnly) await client`drop table pg_temp.phase102b_check`;
            // Fresh initialization remains empty-only. A populated upgrade must leave the new table empty;
            // the caller separately compares fingerprints of every existing row and sequence before/after.
            if (mode === "initialize" || mode === "upgrade-0015" && table.name === "push_subscriptions" ||
                mode === "upgrade-0016" && ["group_tasks", "task_notes"].includes(table.name) ||
                mode === "upgrade-0017" && table.name === "co_adviser_review_assignments") {
                schemaAssertion = "empty-table";
                const [empty] = await client`select count(*)::int as count from ${client(`public.${table.name}`)}`; assert.equal(empty.count, 0);
            }
        }
        if (mode === "upgrade-0017") {
            schemaObject = "public.main_adviser_designation"; schemaAssertion = "unconfigured-singleton";
            const rows = await client`select id,main_adviser_id,revision,updated_by from public.main_adviser_designation`;
            assert.equal(rows.length, 1);
            assert.deepEqual({ ...rows[0] }, { id: 1, main_adviser_id: null, revision: 0, updated_by: null });
        }
        schemaObject = "public"; schemaAssertion = "sequence-set";
        const serials = Object.values(snapshot.tables as Record<string, { name: string; columns: Record<string, { name: string; type: string }> }>).flatMap(t => Object.values(t.columns).filter(c => c.type === "serial").map(c => `${t.name}_${c.name}_seq`)).sort();
        const sequences = await client`select sequencename,start_value,min_value,max_value,increment_by,cycle,cache_size from pg_sequences where schemaname='public' order by sequencename`;
        assert.deepEqual(sequences.map(s => s.sequencename), serials);
        expectedObjects.push(...serials.map(name => ({ name, kind: 'S' })));
        const actualObjects = await client`select c.relname as name,c.relkind::text as kind,c.relowner=(select oid from pg_roles where rolname=current_user) as owned,pg_get_userbyid(c.relowner) as owner
            from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
            and not exists(select 1 from pg_depend d where d.classid='pg_class'::regclass and d.objid=c.oid and d.deptype='e') order by c.relname`;
        schemaAssertion = "ownership";
        if (localEntries) {
            const intent = snapshot.tables["public.submission_upload_intents"];
            const operatorObjects = new Set([intent.name, `${intent.name}_pkey`,
                ...Object.keys(intent.indexes), ...Object.keys(intent.uniqueConstraints)].map(pgName));
            assert.ok(actualObjects.every(o => o.owner === (operatorObjects.has(String(o.name)) ? "thesishs_local_operator" : "postgres")));
        } else assert.ok(actualObjects.every(o => o.owned));
        schemaAssertion = "object-set";
        assert.deepEqual(actualObjects.map(o => `${o.name}:${o.kind}`).sort(), expectedObjects.map(o => `${o.name}:${o.kind}`).sort());
        schemaAssertion = "unexpected-objects";
        const [unexpected] = await client`select
            exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
                and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')) as routines,
            exists(select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype in ('d','e','r','m')
                and not exists(select 1 from pg_depend d where d.classid='pg_type'::regclass and d.objid=t.oid and d.deptype='e')) as types`;
        assert.equal(unexpected.routines, false); assert.equal(unexpected.types, false);
        for (const s of sequences) {
            schemaObject = `public.${s.sequencename}`; schemaAssertion = "sequence-properties";
            assert.equal(String(s.start_value), '1'); assert.equal(String(s.min_value), '1'); assert.equal(String(s.max_value), '2147483647');
            assert.equal(String(s.increment_by), '1'); assert.equal(String(s.cache_size), '1'); assert.equal(s.cycle, false);
            if (mode === "initialize" || mode === "upgrade-0016" && ["group_tasks_id_seq", "task_notes_id_seq"].includes(s.sequencename) ||
                mode === "upgrade-0017" && s.sequencename === "co_adviser_review_assignments_id_seq") {
                const [v] = await client`select last_value::text as value,is_called from ${client(`public.${s.sequencename}`)}`;
                assert.equal(v.value, '1'); assert.equal(v.is_called, false);
            }
        }
        schemaObject = "public"; schemaAssertion = "unexpected-triggers";
        const [extras] = await client`select exists(select 1 from pg_trigger g join pg_class c on c.oid=g.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not g.tgisinternal) as triggers`;
        assert.equal(extras.triggers, false);
        if (catalogOnly) {
            schemaAssertion = "expression-bindings-and-rules";
            // Deparsed text alone cannot authenticate function/operator/type bindings. Reject custom
            // dependencies on schema expressions, and rewrite rules that could intercept application DML.
            const [bindings] = await client`select exists(select 1 from pg_depend d
                left join pg_proc p on d.refclassid='pg_proc'::regclass and p.oid=d.refobjid
                left join pg_operator o on d.refclassid='pg_operator'::regclass and o.oid=d.refobjid
                left join pg_type t on d.refclassid='pg_type'::regclass and t.oid=d.refobjid
                where ((d.classid='pg_constraint'::regclass and d.objid in (select oid from pg_constraint where connamespace='public'::regnamespace))
                    or (d.classid='pg_attrdef'::regclass and d.objid in (select a.oid from pg_attrdef a join pg_class c on c.oid=a.adrelid where c.relnamespace='public'::regnamespace))
                    or (d.classid='pg_class'::regclass and d.objid in (select oid from pg_class where relnamespace='public'::regnamespace and relkind='i')))
                and coalesce(p.pronamespace,o.oprnamespace,t.typnamespace) <> 'pg_catalog'::regnamespace) as custom_bindings,
                exists(select 1 from pg_rewrite r join pg_class c on c.oid=r.ev_class where c.relnamespace='public'::regnamespace and r.rulename<>'_RETURN') as rules`;
            assert.deepEqual({ ...bindings }, { custom_bindings: false, rules: false });
        }
        return { tables: tables.length, constraints: constraintCount, indexes: indexCount };
    } catch (error) {
        if (error instanceof assert.AssertionError) throw new PreviewSchemaAssertion(schemaObject, schemaAssertion, error);
        throw error;
    }
}
