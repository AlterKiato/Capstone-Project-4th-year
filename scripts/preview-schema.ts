import assert from "node:assert/strict";
import type postgres from "postgres";
import { previewMigrationSource } from "./preview-migration-source";
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

// Operator-only catalog verification. PostgreSQL canonicalizes trusted CHECK/default/index SQL in temporary tables.
export async function verifyPreviewSchema(client: postgres.Sql) {
    let schemaObject = "public", schemaAssertion = "table-set";
    try {
        const snapshot = previewMigrationSource().snapshot;
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
                pg_get_expr(d.adbin,d.adrelid) as default_value from pg_attribute a join pg_class c on c.oid=a.attrelid
                join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
                where n.nspname='public' and c.relname=${table.name} and a.attnum>0 and not a.attisdropped order by a.attnum`;
            verifyPreviewColumnNames(table.name, columns.map(c => c.name), Object.values(table.columns).map(c => c.name));
            schemaAssertion = "column-properties";
            for (const expected of Object.values(table.columns)) {
                const actual = columns.find(c => c.name === expected.name); assert.ok(actual);
                assert.equal(actual.not_null, expected.notNull); assert.equal(actual.default_collation, true);
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
            // Only trusted repository snapshot SQL is executed, and only inside this owned replay database.
            schemaAssertion = "column-defaults";
            await client`create temporary table phase102b_check (like ${client(`public.${table.name}`)})`;
            for (const expected of Object.values(table.columns)) {
                if (expected.type === 'serial') continue;
                const actual = columns.find(c => c.name === expected.name)!;
                if ('default' in expected) {
                    await client.unsafe(`alter table pg_temp.phase102b_check alter column "${expected.name}" set default ${String(expected.default)}`);
                    const [canonical] = await client`select pg_get_expr(d.adbin,d.adrelid) as value from pg_attrdef d join pg_attribute a on a.attrelid=d.adrelid and a.attnum=d.adnum where d.adrelid='pg_temp.phase102b_check'::regclass and a.attname=${expected.name}`;
                    assert.equal(actual.default_value, canonical.value);
                } else assert.equal(actual.default_value, null);
            }
            schemaAssertion = "check-expressions";
            for (const item of Object.values(table.checkConstraints)) {
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
            schemaAssertion = "empty-table";
            const [empty] = await client`select count(*)::int as count from ${client(`public.${table.name}`)}`; assert.equal(empty.count, 0);
        }
        schemaObject = "public"; schemaAssertion = "sequence-set";
        const serials = Object.values(snapshot.tables as Record<string, { name: string; columns: Record<string, { name: string; type: string }> }>).flatMap(t => Object.values(t.columns).filter(c => c.type === "serial").map(c => `${t.name}_${c.name}_seq`)).sort();
        const sequences = await client`select sequencename,start_value,min_value,max_value,increment_by,cycle,cache_size from pg_sequences where schemaname='public' order by sequencename`;
        assert.deepEqual(sequences.map(s => s.sequencename), serials);
        expectedObjects.push(...serials.map(name => ({ name, kind: 'S' })));
        const actualObjects = await client`select c.relname as name,c.relkind::text as kind,c.relowner=(select oid from pg_roles where rolname=current_user) as owned
            from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
            and not exists(select 1 from pg_depend d where d.classid='pg_class'::regclass and d.objid=c.oid and d.deptype='e') order by c.relname`;
        schemaAssertion = "ownership";
        assert.ok(actualObjects.every(o => o.owned));
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
            const [v] = await client`select last_value::text as value,is_called from ${client(`public.${s.sequencename}`)}`;
            assert.equal(v.value, '1'); assert.equal(v.is_called, false);
        }
        schemaObject = "public"; schemaAssertion = "unexpected-triggers";
        const [extras] = await client`select exists(select 1 from pg_trigger g join pg_class c on c.oid=g.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not g.tgisinternal) as triggers`;
        assert.equal(extras.triggers, false);
        return { tables: tables.length, constraints: constraintCount, indexes: indexCount };
    } catch (error) {
        if (error instanceof assert.AssertionError) throw new PreviewSchemaAssertion(schemaObject, schemaAssertion, error);
        throw error;
    }
}
