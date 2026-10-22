// Phase-specific operator helpers. No runtime database import or automatic connection.
import { createHash } from "node:crypto";
import { readFileSync, realpathSync, lstatSync, existsSync } from "node:fs";
import { dirname, resolve, relative, isAbsolute, parse, sep } from "node:path";
import { execFileSync } from "node:child_process";
import { readMigrationFiles } from "drizzle-orm/migrator";
import type postgres from "postgres";

export const MIGRATION_HASH = "9077be13113496dfa894cfd376f0dd69b613eda6e1460da443990300152f71ab";
export const CLUSTER = "7652422818440234372", DATABASE_OID = "16387";
const PRE_SCHEMA = "97003bb0fa522defc68538ec467d988443cb442e1d5cb7904ceb7a486f0c80aa";
export const refuse = () => new Error("Upload acceptance operation refused; inspect the approved prerequisites privately.");
export const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const bytesDigest = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
export type OperatorSql = postgres.Sql;
export type RecoveryConstraint = { relname: string; conname: string; contype: string; convalidated: boolean; definition: string };

// Exact PG18.4 round-trip forms reviewed with catalog bindings, reparsing and rollback-only behavior tests.
// Never strip SQL, parentheses or casts generally. The original PRE_SCHEMA pin remains unchanged.
const REVIEWED_CHECKS: Record<string, { definition: string; restoredHash: string; catalogHash: string }> = {
    "ai_consent_events.ai_consent_event_check": {
        definition: "CHECK ((((event_kind)::text = ANY ((ARRAY['accepted'::character varying, 'declined'::character varying, 'withdrawn'::character varying])::text[])) AND (((event_kind)::text <> 'accepted'::text) OR (eligibility_event_id IS NOT NULL))))",
        restoredHash: "1212e840ff936f84ef3a21c092cad61b847abc9c53c01bccea7e5a3d0cba1d8d",
        catalogHash: "bebc7e103b08a6ad27a9b2672af5ec777ed6f88a96e14def0651d8780c587dc0",
    },
    "ai_eligibility_events.ai_eligibility_decision_check": {
        definition: "CHECK (((decision)::text = ANY ((ARRAY['Eligible'::character varying, 'Not Eligible'::character varying, 'Pending Verification'::character varying])::text[])))",
        restoredHash: "8e3b345b478b1bd3679206850412a52e83d2d12cc8ae8095246dba974c8e161a",
        catalogHash: "b4a9677e0a4d4e648e2a6e761e946b971ca19355f0904af740b591ada28eedec",
    },
    "ai_eligibility_events.ai_eligibility_event_check": {
        definition: "CHECK (COALESCE(((((event_kind)::text = 'bootstrap'::text) AND ((decision)::text = 'Eligible'::text) AND (decision_role_id = 1) AND (account_updated_at IS NOT NULL) AND (verifier_user_id IS NULL) AND (verifier_authorization_ref IS NULL) AND (length((external_authority_ref)::text) > 0) AND (NOT revoked)) OR (((event_kind)::text = ANY ((ARRAY['certification'::character varying, 'reset'::character varying, 'revocation'::character varying])::text[])) AND (verifier_user_id IS NOT NULL) AND (verifier_user_id <> user_id) AND (length((verifier_authorization_ref)::text) > 0) AND (external_authority_ref IS NULL) AND ((((event_kind)::text = 'certification'::text) AND ((decision)::text = ANY ((ARRAY['Eligible'::character varying, 'Not Eligible'::character varying])::text[])) AND (decision_role_id = ANY (ARRAY[1, 2])) AND (account_updated_at IS NOT NULL) AND (NOT revoked)) OR (((event_kind)::text = 'reset'::text) AND ((decision)::text = 'Pending Verification'::text) AND (NOT revoked)) OR (((event_kind)::text = 'revocation'::text) AND ((decision)::text = 'Not Eligible'::text) AND revoked)))), false))",
        restoredHash: "2dc7053915672565af80bcace4d58510d67b6e52875b6cfe682959e814877ec5",
        catalogHash: "ef8ec68531dd346ff7776240ccb1957449da1ef0ce49455c91b141842e92c4af",
    },
    "email_verification_requests.email_verification_times_check": {
        definition: "CHECK ((((cardinality(request_times) >= 1) AND (cardinality(request_times) <= 5)) AND (array_position(request_times, NULL::timestamp with time zone) IS NULL)))",
        restoredHash: "db22adea1271c388b850a92f443eabe96e0f70b30d4ea441aad6a1ebeebd98e0",
        catalogHash: "bceb36cdeed572d87fd0060dc17bf0f56e80ad68349aff881d113106f52ab692",
    },
};
function reviewedVariant(c: RecoveryConstraint) {
    const rule = REVIEWED_CHECKS[`${c.relname}.${c.conname}`];
    return rule && digest(c.definition) === rule.restoredHash ? rule : undefined;
}
export function reviewedRecoveryConstraint(c: RecoveryConstraint, catalog: unknown): RecoveryConstraint {
    const rule = reviewedVariant(c);
    if (!rule) return c;
    if (c.contype !== "c" || !c.convalidated || digest(catalog) !== rule.catalogHash) throw refuse();
    return { ...c, definition: rule.definition };
}
export function validateMigrationHash(hash: unknown) { if (hash !== MIGRATION_HASH) throw refuse(); }
export function migrationSource() {
    const source = readMigrationFiles({ migrationsFolder: "db/migrations" });
    validateMigrationHash(source[14]?.hash);
    const journal = JSON.parse(readFileSync("db/migrations/meta/_journal.json", "utf8"));
    if (source.length !== 15 || source[14].hash !== MIGRATION_HASH || journal.entries.length !== 15 ||
        journal.entries[14].tag !== "0014_submission_upload_intents" ||
        journal.entries.some((e: { idx: number; when: number }, i: number) => e.idx !== i || i > 0 && e.when <= journal.entries[i - 1].when)) throw refuse();
    const before = JSON.parse(readFileSync("db/migrations/meta/0013_snapshot.json", "utf8"));
    const after = JSON.parse(readFileSync("db/migrations/meta/0014_snapshot.json", "utf8"));
    const intent = after.tables["public.submission_upload_intents"];
    delete after.tables["public.submission_upload_intents"];
    if (!intent || after.prevId !== before.id || digest(after.tables) !== digest(before.tables)) throw refuse();
    return { source, intent, oldTables: Object.values(before.tables).map(t => (t as { name: string }).name).sort() };
}
export type State = {
    identity: { database: string; oid: string; cluster: string; address: string; port: number };
    target: string; ledger: { hash: string; created_at: string }[]; tables: string[];
    oldSchema: string; records: string; sequences: string; newTableValid: boolean; intentCount: number;
};
export function validateIdentity(identity: State["identity"], expected: { cluster: string; oid: string }) {
    if (expected.cluster !== CLUSTER || expected.oid !== DATABASE_OID || identity.cluster !== expected.cluster ||
        identity.oid !== expected.oid || identity.database !== "thesishs_ai" || identity.port !== 5432 ||
        !["::1/128", "127.0.0.1/32", "::1", "127.0.0.1"].includes(identity.address)) throw refuse();
}
export function validateState(state: State, applied: boolean, requireEmpty = false) {
    const { source, oldTables } = migrationSource(), count = applied ? 15 : 14;
    const expectedTables = [...oldTables, ...(applied ? ["submission_upload_intents"] : [])].sort();
    if (state.ledger.length !== count || state.ledger.some((row, i) => row.hash !== source[i].hash || row.created_at !== String(source[i].folderMillis)) ||
        digest(state.tables) !== digest(expectedTables) || state.oldSchema !== PRE_SCHEMA ||
        applied && (!state.newTableValid || requireEmpty && state.intentCount !== 0)) throw refuse();
}
export function unchanged(before: State, after: State) {
    if (before.target !== after.target || before.oldSchema !== after.oldSchema || before.records !== after.records || before.sequences !== after.sequences) throw refuse();
}
export async function inspectState(tx: OperatorSql, restored?: { database: string; oid: string }): Promise<State> {
    const { oldTables, intent } = migrationSource();
    const [identity] = await tx<State["identity"][]>`select current_database() as database,
        (select oid::text from pg_database where datname=current_database()) as oid,
        (select system_identifier::text from pg_control_system()) as cluster,inet_server_addr()::text as address,inet_server_port() as port`;
    if (restored) {
        if (!/^thesishs_upload_restore_[a-f0-9]{32}$/.test(restored.database) || !/^\d+$/.test(restored.oid) || restored.oid === DATABASE_OID ||
            identity.cluster !== CLUSTER || identity.oid !== restored.oid || identity.database !== restored.database || identity.port !== 5432 ||
            !["::1/128", "127.0.0.1/32", "::1", "127.0.0.1"].includes(identity.address)) throw refuse();
    } else validateIdentity(identity, { cluster: CLUSTER, oid: DATABASE_OID });
    const ledger = await tx<State["ledger"]>`select hash,created_at::text as created_at from drizzle.__drizzle_migrations order by created_at,id`;
    const tables = (await tx<{ tablename: string }[]>`select tablename from pg_tables where schemaname='public' order by tablename`).map(t => t.tablename);
    const columns = await tx`select table_name,column_name,data_type,is_nullable,column_default,udt_name,character_maximum_length from information_schema.columns where table_schema='public' order by table_name,ordinal_position`;
    const constraints = await tx<RecoveryConstraint[]>`select c.relname,k.conname,k.contype,k.convalidated,pg_get_constraintdef(k.oid) as definition from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' order by c.relname,k.conname`;
    for (let i = 0; i < constraints.length; i++) {
        const c = constraints[i];
        if (!reviewedVariant(c)) continue;
        const [catalog] = await tx`select c.relname,k.conname,k.contype,k.convalidated,k.conenforced,k.condeferrable,k.condeferred,k.connoinherit,k.conislocal,k.coninhcount,
            array(select jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,'collation',case when a.attcollation=0 then null else a.attcollation::regcollation::text end)
                from unnest(k.conkey) x(num) join pg_attribute a on a.attrelid=k.conrelid and a.attnum=x.num order by a.attname) as referenced_columns,
            array(select jsonb_build_object('class',d.refclassid::regclass::text,'identity',pg_describe_object(d.refclassid,d.refobjid,d.refobjsubid),'kind',d.deptype)
                from pg_depend d where d.classid='pg_constraint'::regclass and d.objid=k.oid
                order by d.refclassid,pg_describe_object(d.refclassid,d.refobjid,d.refobjsubid),d.deptype) as dependencies
            from pg_constraint k join pg_class c on c.oid=k.conrelid
            where k.conrelid=${`public.${c.relname}`}::regclass and k.conname=${c.conname}`;
        constraints[i] = reviewedRecoveryConstraint(c, catalog);
    }
    const indexes = await tx`select tablename,indexname,indexdef from pg_indexes where schemaname='public' order by tablename,indexname`;
    const rows: Record<string, unknown> = {};
    for (const name of oldTables) {
        const [row] = await tx`select count(*)::int as count,md5(coalesce(string_agg(h,'' order by h),'')) as hash from
            (select md5(row_to_json(t)::text) as h from ${tx(`public.${name}`)} t) q`;
        rows[name] = row;
    }
    const [sequenceAccess] = await tx`select not exists(select 1 from pg_sequences where schemaname='public' and not has_sequence_privilege(format('%I.%I',schemaname,sequencename),'SELECT')) as allowed`;
    if (!sequenceAccess.allowed) throw refuse();
    const sequenceDefinitions = await tx`select sequencename,start_value,min_value,max_value,increment_by,cycle,cache_size from pg_sequences where schemaname='public' order by sequencename`;
    const sequences: Record<string, unknown> = {};
    for (const definition of sequenceDefinitions) {
        const [value] = await tx`select last_value::text as last_value,is_called from ${tx(`public.${definition.sequencename}`)}`;
        sequences[definition.sequencename] = { definition, value };
    }
    const newConstraints = constraints.filter(c => c.relname === "submission_upload_intents" && c.contype !== "n");
    const newIndexes = indexes.filter(c => c.tablename === "submission_upload_intents");
    const expectedConstraints = ["submission_upload_intents_pkey", ...Object.keys(intent.foreignKeys), ...Object.keys(intent.uniqueConstraints), ...Object.keys(intent.checkConstraints)].map(n => n.slice(0, 63)).sort();
    let newTableValid = false, intentCount = -1;
    if (tables.includes("submission_upload_intents")) {
        const attrs = await tx`select attname,format_type(atttypid,atttypmod) as type,attnotnull from pg_attribute where attrelid='public.submission_upload_intents'::regclass and attnum>0 and not attisdropped order by attnum`;
        const expectedColumns = Object.values(intent.columns) as { name: string; type: string; notNull: boolean }[];
        const fk = await tx`select k.conname,c.relname as target,k.confdeltype,k.confupdtype,
            array(select a.attname::text from unnest(k.conkey) with ordinality x(num,ord) join pg_attribute a on a.attrelid=k.conrelid and a.attnum=x.num order by x.ord) as columns,
            array(select a.attname::text from unnest(k.confkey) with ordinality x(num,ord) join pg_attribute a on a.attrelid=k.confrelid and a.attnum=x.num order by x.ord) as referenced
            from pg_constraint k join pg_class c on c.oid=k.confrelid where k.conrelid='public.submission_upload_intents'::regclass and k.contype='f'`;
        const keys = await tx`select k.conname,array(select a.attname::text from unnest(k.conkey) with ordinality x(num,ord) join pg_attribute a on a.attrelid=k.conrelid and a.attnum=x.num order by x.ord) as columns
            from pg_constraint k where k.conrelid='public.submission_upload_intents'::regclass and k.contype in ('p','u')`;
        const expectedKeys = [{ name: "submission_upload_intents_pkey", columns: ["id"] }, ...Object.values(intent.uniqueConstraints) as { name: string; columns: string[] }[]];
        newTableValid = attrs.length === expectedColumns.length && expectedColumns.every((col, i) => attrs[i].attname === col.name && attrs[i].type === col.type.replace(/^varchar/, "character varying") && attrs[i].attnotnull === col.notNull) &&
            digest(newConstraints.map(c => c.conname).sort()) === digest(expectedConstraints) && newConstraints.every(c => c.convalidated) &&
            fk.length === 3 && Object.values(intent.foreignKeys).every(raw => {
                const expected = raw as { name: string; tableTo: string; columnsFrom: string[]; columnsTo: string[] };
                const actual = fk.find(k => k.conname === expected.name.slice(0, 63));
                return actual?.target === expected.tableTo && actual.confdeltype === "r" && actual.confupdtype === "a" && digest(actual.columns) === digest(expected.columnsFrom) && digest(actual.referenced) === digest(expected.columnsTo);
            }) && keys.length === 5 && expectedKeys.every(k => keys.some(actual => actual.conname === k.name.slice(0, 63) && digest(actual.columns) === digest(k.columns))) &&
            newIndexes.length === 7 && [["upload_intent_student_created_idx", "(student_id, created_at)"], ["upload_intent_expiry_id_idx", "(expires_at, id)"]]
                .every(([name, columns]) => newIndexes.some(i => i.indexname === name && i.indexdef.endsWith(`USING btree ${columns}`)));
        const [row] = await tx`select count(*)::int as count from submission_upload_intents`; intentCount = row.count;
    }
    return { identity, target: digest(identity), ledger, tables,
        oldSchema: digest({ columns: columns.filter(c => oldTables.includes(c.table_name)), constraints: constraints.filter(c => oldTables.includes(c.relname)), indexes: indexes.filter(c => oldTables.includes(c.tablename)) }),
        records: digest(rows), sequences: digest(sequences), newTableValid, intentCount };
}

// Backup/evidence/credentials must be outside every Git checkout and in a private directory.
export function privateFile(path: string, workspace = process.cwd()) {
    const file = realpathSync(path), root = realpathSync(workspace), rel = relative(root, file);
    if (!isAbsolute(path) || !(rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) || lstatSync(path).isSymbolicLink() || !lstatSync(file).isFile()) throw refuse();
    for (let parent = dirname(file); ; parent = dirname(parent)) {
        if (existsSync(resolve(parent, ".git"))) throw refuse();
        if (parent === parse(parent).root) break;
    }
    for (const item of [dirname(file), file]) {
        if (process.platform === "win32") {
            execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
                "$ErrorActionPreference='Stop'; $a=Get-Acl -LiteralPath $env:THESISHS_PRIVATE_FILE_CHECK; $s=@([System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value,'S-1-5-18','S-1-5-32-544'); if($a.Access.Count -eq 0 -or $s -notcontains $a.GetOwner([System.Security.Principal.SecurityIdentifier]).Value){exit 1}; if(@($a.Access | Where-Object { $_.AccessControlType -eq 'Allow' -and $s -notcontains $_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value }).Count -gt 0){exit 1}"],
            { env: { ...process.env, THESISHS_PRIVATE_FILE_CHECK: item }, stdio: "ignore", timeout: 10000 });
        } else if ((lstatSync(item).mode & 0o077) !== 0 || lstatSync(item).uid !== process.getuid?.()) throw refuse();
    }
    return file;
}
export type Recovery = { kind: "upload-0014-recovery"; target: string; records: string; sequences: string; schema: string;
    backupHash: string; restoredDatabase: string; restoredOid: string; verifiedAt: string };
export function validateRecovery(evidence: Recovery | undefined, backupHash: string, state: State, now = Date.now()) {
    if (!evidence || evidence.kind !== "upload-0014-recovery" || evidence.backupHash !== backupHash || !/^[a-f0-9]{64}$/.test(backupHash) ||
        evidence.target !== state.target || evidence.records !== state.records || evidence.sequences !== state.sequences || evidence.schema !== state.oldSchema ||
        !/^thesishs_upload_restore_[a-f0-9]{32}$/.test(evidence.restoredDatabase) || !/^\d+$/.test(evidence.restoredOid) || evidence.restoredOid === DATABASE_OID ||
        !Number.isFinite(Date.parse(evidence.verifiedAt)) || Date.parse(evidence.verifiedAt) > now || now - Date.parse(evidence.verifiedAt) > 86400000) throw refuse();
}
export function browserTarget(base: string, confirmed: string) {
    const url = new URL(base);
    if (url.origin !== confirmed || url.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
        !url.port || url.pathname !== "/" || url.search || url.hash || url.username || url.password) throw refuse();
    return url.origin;
}

export type MigrationApproval = { execute: boolean; confirmTarget: string; cluster: string; oid: string; backupHash: string };
export async function migrate0014(io: {
    inspect(): Promise<State>; apply(before: State): Promise<void>;
}, approval: MigrationApproval, recovery: Recovery | undefined) {
    migrationSource();
    if (!approval.execute) throw refuse();
    const before = await io.inspect();
    validateIdentity(before.identity, approval);
    if (approval.confirmTarget !== before.target) throw refuse();
    if (before.ledger.length === 15) { validateState(before, true); return "already-applied"; }
    validateState(before, false); validateRecovery(recovery, approval.backupHash, before);
    try {
        await io.apply(before);
        const after = await io.inspect(); validateState(after, true, true); unchanged(before, after);
        return "applied-confirmed";
    } catch {
        // One fresh read only. Never automatically retry a mutation or roll back a committed table.
        const durable = await io.inspect(); unchanged(before, durable);
        if (durable.ledger.length === 15) { validateState(durable, true, true); return "applied-reconciled"; }
        validateState(durable, false); return "not-applied-review-before-retry";
    }
}
