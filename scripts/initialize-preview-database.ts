// Explicit privileged Preview initialization or bounded upgrade. Importing never connects or writes.
import { createHash } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { PgDialect } from "drizzle-orm/pg-core";
import { databaseConfiguration } from "@/lib/db/config";
import { verifyDatabaseIdentity, type IdentitySql, type DatabaseConfiguration } from "@/lib/db/identity";
import { previewMigrationSource, workspaceMigrationSource, supervisionMigrationSource, verifyPreviewLedger, verifyWorkspaceLedger, verifySupervisionLedger, recognizeWorkspaceLedger, recognizeSupervisionLedger, progressMigrationSource, verifyProgressLedger, recognizeProgressLedger } from "./preview-migration-source";
import { verifyPreviewSchema, verifyPreviewCatalog } from "./preview-schema";
import { initializePreview, upgradePreview0015, upgradePreview0016, upgradePreview0017, verifyAccountRecoveryEvidence, previewFailure, type PreviewState } from "./preview-initialization";
import { SUPERVISION_TABLES, SUPERVISION_SEQUENCE, readSupervisionBackup, grantSupervisionRuntime, verifySupervisionRuntime, verifySupervisionCatalogShape } from "./preview-supervision";
import { verifyProgressRuntime } from "./preview-progress";

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const refused = () => new Error("Preview initialization prerequisites not satisfied.");

export function verifyPreviewUpgradeTarget(config: DatabaseConfiguration) {
    const pin = config.observed;
    if (config.environment !== "preview" || config.purpose !== "operator" || config.endpoint.database !== "postgres" ||
        pin?.provider !== "supabase" || pin.projectRef !== "cbkplqkkjuoglpimwmib" || pin.databaseOid !== "5" ||
        pin.cluster !== "7678069749886157684" || pin.runtimeRole !== "thesishs_preview_runtime" ||
        pin.operatorRole !== "thesishs_preview_operator") throw refused();
}

export async function applyPreviewMigrations(tx: postgres.TransactionSql, options: postgres.Sql["options"], workspace: boolean | "0017" | "0018" = false) {
    if (![false, true, "0017", "0018"].includes(workspace)) throw refused();
    const supervision = workspace === "0017";
    const progress = workspace === "0018";
    const source = progress ? progressMigrationSource() : supervision ? supervisionMigrationSource() : workspace ? workspaceMigrationSource() : previewMigrationSource();
    if (workspace) {
        const ledger = await tx`select id,hash,created_at::text as created_at from drizzle.__drizzle_migrations order by created_at,id`;
        const rows = ledger.map(r => ({ id: r.id, hash: r.hash, created_at: r.created_at }));
        if (progress) verifyProgressLedger(rows, 18);
        else if (supervision) verifySupervisionLedger(rows, 17);
        else verifyWorkspaceLedger(rows, 16);
    }
    // Preserve the supported ORM migrator; its inner transaction becomes a postgres-js savepoint.
    // Real transaction clients omit options. Borrow only parser/serializer metadata, never root SQL methods.
    const nested = new Proxy(tx, { get(target, key) {
        if (key === "options") return options;
        return key === "begin" ? target.savepoint.bind(target) : Reflect.get(target, key);
    } });
    // Same installed ORM dialect migrator/session as postgres-js/migrator, but pass
    // the exact reviewed legacy prefix instead of rereading the now-expanded folder.
    // Legacy modes stop at 0015; the separate upgrade modes submit only 0016 or only 0017.
    const database = drizzle(nested as unknown as postgres.Sql);
    // Installed dialect declarations use a schema-less session default. Preserve the
    // same actual postgres-js session; only adapt that generic type at this boundary.
    const session = database._.session as unknown as Parameters<PgDialect["migrate"]>[1];
    await new PgDialect().migrate(progress ? source.migrations.slice(18) : supervision ? source.migrations.slice(17) : workspace ? source.migrations.slice(16) : source.migrations, session, { migrationsFolder: "db/migrations" });
}

const workspaceTables = new Set(["group_tasks", "task_notes"]);
const workspaceSequences = new Set(["group_tasks_id_seq", "task_notes_id_seq"]);

function snapshotRelations(snapshot: ReturnType<typeof previewMigrationSource>["snapshot"]) {
    return Object.values(snapshot.tables).flatMap(value => {
        const table = value as { name: string; columns: Record<string, { name: string; type: string; primaryKey: boolean }>;
            indexes: Record<string, unknown>; uniqueConstraints: Record<string, unknown>; compositePrimaryKeys: Record<string, unknown> };
        return [`${table.name}:r`, ...Object.values(table.columns).filter(c => c.type === "serial").map(c => `${table.name}_${c.name}_seq:S`),
            ...[...Object.keys(table.indexes), ...Object.keys(table.uniqueConstraints), ...Object.keys(table.compositePrimaryKeys),
                ...(Object.values(table.columns).some(c => c.primaryKey) ? [`${table.name}_pkey`] : [])].map(name => `${name.slice(0, 63)}:i`)];
    }).sort();
}

// Effective privilege checks use the pinned role; TEMPORARY through PUBLIC is an approved Preview exception.
export async function verifyWorkspaceRuntime(sql: postgres.Sql, workspace: boolean) {
    const role = "thesishs_preview_runtime";
    const [boundary] = await sql`select has_database_privilege(${role},current_database(),'CREATE') as database_create,
        has_schema_privilege(${role},'public','USAGE') as schema_usage,
        exists(select 1 from pg_namespace n where n.nspname in ('public','drizzle') and
            (has_schema_privilege(${role},n.oid,'CREATE') or n.nspowner=(select oid from pg_roles where rolname=${role}))) as schema_ddl,
        exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','drizzle')
            and c.relowner=(select oid from pg_roles where rolname=${role})) as owns_objects,
        exists(select 1 from pg_database where datname=current_database() and datdba=(select oid from pg_roles where rolname=${role})) as owns_database,
        exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p')
            and has_table_privilege(${role},c.oid,'TRUNCATE')) as truncate`;
    if (!boundary?.schema_usage || boundary.database_create || boundary.schema_ddl || boundary.owns_objects || boundary.owns_database || boundary.truncate) throw refused();
    for (const table of ["users", "research_groups", "group_members", "research_papers"]) {
        const [access] = await sql`select has_table_privilege(${role},${`public.${table}`},'SELECT') as readable,
            has_any_column_privilege(${role},${`public.${table}`},'UPDATE') as lockable`;
        if (!access?.readable || !access.lockable) throw refused();
    }
    if (!workspace) return;
    for (const table of workspaceTables) {
        for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER", "MAINTAIN"]) {
            const [access] = await sql`select has_table_privilege(${role},${`public.${table}`},${privilege}) as allowed,
                has_table_privilege(${role},${`public.${table}`},${`${privilege} WITH GRANT OPTION`}) as grantable`;
            const expected = ["SELECT", "INSERT", "UPDATE"].includes(privilege) || table === "group_tasks" && privilege === "DELETE";
            if (access?.allowed !== expected || access.grantable !== false) throw refused();
        }
        // Check column-level REFERENCES and grant options as well as table-level privileges.
        const [extra] = await sql`select exists(select 1 from pg_attribute a where a.attrelid=${`public.${table}`}::regclass and a.attnum>0 and not a.attisdropped
            and (has_column_privilege(${role},a.attrelid,a.attnum,'REFERENCES') or has_column_privilege(${role},a.attrelid,a.attnum,'UPDATE WITH GRANT OPTION')
                or has_column_privilege(${role},a.attrelid,a.attnum,'INSERT WITH GRANT OPTION') or has_column_privilege(${role},a.attrelid,a.attnum,'SELECT WITH GRANT OPTION'))) as widened`;
        if (extra?.widened !== false) throw refused();
    }
    for (const sequence of workspaceSequences) for (const privilege of ["USAGE", "SELECT", "UPDATE"]) {
        const [access] = await sql`select has_sequence_privilege(${role},${`public.${sequence}`},${privilege}) as allowed,
            has_sequence_privilege(${role},${`public.${sequence}`},${`${privilege} WITH GRANT OPTION`}) as grantable`;
        if (access?.allowed !== (privilege === "USAGE") || access.grantable !== false) throw refused();
    }
}

// Called only inside the guarded migration transaction, after exact ledger/catalog verification.
export async function grantWorkspaceRuntime(tx: postgres.TransactionSql) {
    const ledger = await tx`select id,hash,created_at::text as created_at from drizzle.__drizzle_migrations order by created_at,id`;
    verifyWorkspaceLedger(ledger.map(r => ({ id: r.id, hash: r.hash, created_at: r.created_at })), 17);
    await tx`grant select,insert,update,delete on table public.group_tasks to thesishs_preview_runtime`;
    await tx`grant select,insert,update on table public.task_notes to thesishs_preview_runtime`;
    await tx`grant usage on sequence public.group_tasks_id_seq,public.task_notes_id_seq to thesishs_preview_runtime`;
    await verifyWorkspaceRuntime(tx as unknown as postgres.Sql, true);
}

export async function inspectPreviewState(sql: postgres.Sql, config: DatabaseConfiguration, upgrade: boolean | "0016" | "0017" | "0018" = false): Promise<PreviewState> {
    const workspace = upgrade === "0016";
    const supervision = upgrade === "0017";
    const progress = upgrade === "0018";
    const bounded = workspace || supervision || progress;
    const newTables = progress ? new Set(["research_milestones"]) : supervision ? SUPERVISION_TABLES : workspaceTables;
    const newSequences = progress ? new Set(["research_milestones_id_seq"]) : supervision ? new Set([SUPERVISION_SEQUENCE]) : workspaceSequences;
    if (upgrade) verifyPreviewUpgradeTarget(config);
    const identity = await verifyDatabaseIdentity(sql as unknown as IdentitySql, config);
    const target = digest({ environment: config.environment, approved: config.identity, identity });
    const [permissions] = await sql`select has_schema_privilege(current_user,'public','CREATE') as create_public,
        has_database_privilege(current_user,current_database(),'TEMP') as temporary,
        (has_database_privilege(current_user,current_database(),'CREATE') or
            case when to_regnamespace('drizzle') is null then false else has_schema_privilege(current_user,'drizzle','CREATE') end) as create_ledger`;
    if (!permissions.create_public || !permissions.create_ledger || !supervision && !progress && !permissions.temporary) throw refused();
    const relations = await sql`select c.relname,c.relkind,c.relowner::text,c.relacl::text from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and not exists(select 1 from pg_depend d where d.classid='pg_class'::regclass and d.objid=c.oid and d.deptype='e') order by c.relname`;
    const routines = await sql`select p.oid::regprocedure::text as name from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e') order by name`;
    const types = await sql`select t.typname from pg_type t join pg_namespace n on n.oid=t.typnamespace
        where n.nspname='public' and t.typtype in ('d','e','r','m') and not exists(select 1 from pg_depend d where d.classid='pg_type'::regclass and d.objid=t.oid and d.deptype='e') order by t.typname`;
    const [existing] = await sql`select to_regclass('drizzle.__drizzle_migrations') is not null as ledger`;
    const ledger = existing.ledger ? await sql`select id,hash,created_at::text as created_at from drizzle.__drizzle_migrations order by created_at,id` : [];
    if (bounded) {
        const rows = ledger.map(r => ({ id: r.id, hash: r.hash, created_at: r.created_at }));
        const { entries } = progress ? recognizeProgressLedger(rows) : supervision ? recognizeSupervisionLedger(rows) : recognizeWorkspaceLedger(rows);
        const snapshot = entries === 19 ? progressMigrationSource().snapshot : entries === 18 ? supervisionMigrationSource().snapshot : entries === 17 ? workspaceMigrationSource().snapshot : previewMigrationSource().snapshot;
        const expected = snapshotRelations(snapshot);
        if (JSON.stringify(relations.map(r => `${r.relname}:${r.relkind}`).sort()) !== JSON.stringify(expected)) throw refused();
        await verifyWorkspaceRuntime(sql, entries >= 17);
        if (supervision || progress) await verifySupervisionRuntime(sql, entries >= 18);
        if (progress) await verifyProgressRuntime(sql, entries === 19);
        if (progress) await verifyPreviewCatalog(sql, entries === 19 ? "progress-installed" : "supervision-installed");
        if (supervision) await verifyPreviewCatalog(sql, entries === 18 ? "supervision-installed" : "supervision-baseline");
    } else if (upgrade || ledger.length) {
        verifyPreviewLedger(ledger.map(r => ({ id: r.id, hash: r.hash, created_at: r.created_at })), upgrade && ledger.length === 15 ? 15 : 16);
    }
    if (upgrade === true && relations.some(r => r.relname === "push_subscriptions") !== (ledger.length === 16)) throw refused();
    const columns = await sql`select table_name,column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' order by table_name,ordinal_position`;
    const constraints = await sql`select c.relname,k.conname,k.contype,k.convalidated,to_jsonb(k)->>'conenforced' as enforced,pg_get_constraintdef(k.oid) as definition
        from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' order by c.relname,k.conname`;
    const indexes = await sql`select tablename,indexname,indexdef from pg_indexes where schemaname='public' order by tablename,indexname`;
    if (progress) verifySupervisionCatalogShape(ledger.length === 19 ? progressMigrationSource().snapshot : supervisionMigrationSource().snapshot, columns, constraints);
    if (supervision) verifySupervisionCatalogShape(ledger.length === 18 ? supervisionMigrationSource().snapshot : workspaceMigrationSource().snapshot, columns, constraints);
    const sequenceDefinitions = await sql`select sequencename,start_value,min_value,max_value,increment_by,cycle,cache_size from pg_sequences where schemaname='public' order by sequencename`;
    const sequences: Record<string, unknown> = {};
    for (const definition of sequenceDefinitions) {
        if (!/^[a-z_][a-z0-9_]*$/.test(definition.sequencename)) throw refused();
        const [value] = await sql`select last_value::text as value,is_called from ${sql(`public.${definition.sequencename}`)}`;
        sequences[definition.sequencename] = { definition, value };
    }
    const counts: Record<string, number> = {};
    const fingerprints: Record<string, string> = {};
    for (const table of relations.filter(r => ["r", "p"].includes(r.relkind))) {
        if (!/^[a-z_][a-z0-9_]*$/.test(table.relname)) throw refused();
        const [row] = await sql`select count(*)::int as count from ${sql(`public.${table.relname}`)}`;
        counts[table.relname] = row.count;
        if (upgrade && (bounded ? !newTables.has(table.relname) : table.relname !== "push_subscriptions")) {
            // Database-side row fingerprints include password hashes/status and all existing relationships.
            // Only the final digest remains in memory; no private row contents are returned or logged.
            const [fingerprint] = await sql`select encode(sha256(convert_to(coalesce(string_agg(h,'' order by h),''),'UTF8')),'hex') as hash
                from (select encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') as h from ${sql(`public.${table.relname}`)} as t) as fingerprints`;
            fingerprints[table.relname] = fingerprint.hash;
        }
    }
    // Include all old records (including Web Push), old definitions/ACLs and old sequence values.
    // New sequences are separately validated by verifyPreviewSchema; do not compare them to a nonexistent baseline.
    const baselineRelations = bounded ? new Set(snapshotRelations(progress ? supervisionMigrationSource().snapshot : supervision ? workspaceMigrationSource().snapshot : previewMigrationSource().snapshot)) : undefined;
    const oldRelations = bounded ? relations.filter(r => baselineRelations!.has(`${r.relname}:${r.relkind}`)) : [];
    const oldRows = (rows: Record<string, unknown>[], key: string) => rows.filter(r => !newTables.has(String(r[key])));
    // 0018's sole old-table addition is this composite UNIQUE and its backing index.
    // Canonical schema verification checks both; exclude only these planned additions
    // from the preservation fingerprint, retaining every old column/constraint/ACL.
    const preservedData = bounded ? digest({ fingerprints, sequences: Object.fromEntries(Object.entries(sequences).filter(([n]) => !newSequences.has(n))),
        relations: oldRelations, routines, types, columns: oldRows(columns, "table_name"), constraints: oldRows(constraints, "relname").filter(r => !progress || r.conname !== "submissions_id_paper_unique"), indexes: oldRows(indexes, "tablename").filter(r => !progress || r.indexname !== "submissions_id_paper_unique") }) :
        upgrade ? digest({ fingerprints, sequences }) : undefined;
    return { target, ledger: ledger.map(r => ({ hash: r.hash, created_at: r.created_at })),
        empty: !existing.ledger && !relations.length && !routines.length && !types.length,
        preservedData, catalog: digest({ relations, routines, types, columns, constraints, indexes, sequences, ledger, counts, preservedData }) };
}

export type PreviewInitializerDiagnostic = {
    stage: string; exitStatus: number; executionBegan: boolean; commitConfirmed: boolean;
    durableInspectionRequired: boolean; error?: ReturnType<typeof previewFailure>;
};

export async function main(args = process.argv.slice(2)): Promise<PreviewInitializerDiagnostic> {
    let client: postgres.Sql | undefined;
    let failureStage: string | undefined;
    const diagnostic: PreviewInitializerDiagnostic = { stage: "arguments", exitStatus: 0,
        executionBegan: false, commitConfirmed: false, durableInspectionRequired: false };
    try {
        const mode = args.shift();
        const supervision = mode === "--inspect-upgrade-0017" || mode === "--upgrade-0017";
        const workspace = mode === "--inspect-upgrade-0016" || mode === "--upgrade-0016";
        const upgrade = supervision || workspace || mode === "--inspect-upgrade-0015" || mode === "--upgrade-0015";
        const inspectionMode = supervision ? "0017" as const : workspace ? "0016" as const : upgrade;
        const inspectOnly = mode === "--inspect" || mode === "--inspect-upgrade-0015" || mode === "--inspect-upgrade-0016" || mode === "--inspect-upgrade-0017";
        if (!["--inspect", "--execute", "--inspect-upgrade-0015", "--upgrade-0015", "--inspect-upgrade-0016", "--upgrade-0016", "--inspect-upgrade-0017", "--upgrade-0017"].includes(mode ?? "") || args.length % 2) throw refused();
        const options = new Map<string, string>();
        for (let i = 0; i < args.length; i += 2) {
            if (!["--confirm-target", "--confirm-source", "--confirm-data-api-disabled", ...(upgrade ? ["--confirm-recovery-verified"] : []),
                ...(workspace ? ["--accept-preview-no-backup-risk"] : []),
                ...(supervision ? ["--backup-evidence", "--confirm-backup"] : []),
                ...(upgrade && !workspace && !supervision ? ["--recovery-mode", "--recovery-evidence", "--confirm-account-recovery-verified", "--confirm-replaceable-data"] : [])].includes(args[i]) || options.has(args[i]) || !args[i + 1]) throw refused();
            options.set(args[i], args[i + 1]);
        }
        const accountRecovery = options.get("--recovery-mode") === "synthetic-accounts";
        if (inspectOnly ? options.size !== 0 : options.size !== (supervision ? 6 : upgrade ? accountRecovery ? 7 : 4 : 3)) throw refused();
        if (supervision && !inspectOnly && (!options.has("--backup-evidence") || !/^[a-f0-9]{64}$/.test(options.get("--confirm-backup") ?? "") ||
            options.get("--confirm-recovery-verified") !== "yes" || options.get("--confirm-data-api-disabled") !== "yes")) throw refused();
        const noBackup = options.has("--accept-preview-no-backup-risk");
        if (noBackup && (!workspace || options.get("--accept-preview-no-backup-risk") !== "yes" || options.has("--confirm-recovery-verified"))) throw refused();
        let recovery: ReturnType<typeof verifyAccountRecoveryEvidence> | undefined;
        if (accountRecovery) {
            if (!upgrade || options.has("--confirm-recovery-verified") || options.get("--confirm-account-recovery-verified") !== "yes" ||
                options.get("--confirm-replaceable-data") !== "yes") throw refused();
            recovery = verifyAccountRecoveryEvidence(options.get("--recovery-evidence") ?? "");
        } else if ([...options.keys()].some(key => ["--recovery-mode", "--recovery-evidence",
            "--confirm-account-recovery-verified", "--confirm-replaceable-data"].includes(key))) throw refused();
        if (!inspectOnly && (!process.stdin.isTTY || !process.stdout.isTTY)) throw refused();
        // Load only after explicit valid arguments; no implicit runtime credential fallback.
        diagnostic.stage = "configuration and migration source";
        (await import("dotenv")).config({ quiet: true });
        const config = databaseConfiguration(process.env, "operator"), source = supervision ? supervisionMigrationSource() : workspace ? workspaceMigrationSource() : previewMigrationSource();
        if (config.environment !== "preview" || config.purpose !== "operator") throw refused();
        if (upgrade) verifyPreviewUpgradeTarget(config);
        client = postgres(config.url, { ...config.options, max: 1, onnotice: () => {},
            connection: { statement_timeout: 10000, lock_timeout: 3000, idle_in_transaction_session_timeout: 30000,
                ...(inspectOnly ? { default_transaction_read_only: true } : {}) } });
        const sql = client;
        const inspect = () => {
            diagnostic.stage = diagnostic.executionBegan ? "durable-state inspection" : "preflight inspection";
            return sql.begin("isolation level repeatable read read only", async tx => {
                await tx`set local statement_timeout='10s'`;
                if (supervision) await tx`set local search_path=pg_catalog,public`;
                return inspectPreviewState(tx as unknown as postgres.Sql, config, inspectionMode);
            });
        };
        if (inspectOnly) {
            const state = await inspect();
            console.log(JSON.stringify({ target: state.target, emptyApplicationSchema: state.empty, ledgerEntries: state.ledger.length, source: source.hash,
                ...(workspace || supervision ? { catalog: state.catalog, canonicalSchemaVerified: supervision, runtimeTemporaryException: true } : {}),
                ...(supervision ? { verificationMethod: "catalog-only", preservedData: state.preservedData, state: state.ledger.length === 18 ? "already-applied" : "pending-0017" } : {}) }));
            return diagnostic;
        }
        if (options.get("--confirm-data-api-disabled") !== "yes") throw refused();
        // Explicit owner attestation; this command cannot independently prove private recovery evidence.
        if (upgrade && !accountRecovery && !noBackup && options.get("--confirm-recovery-verified") !== "yes") throw refused();
        if (noBackup) console.log(JSON.stringify({ environment: "preview", verifiedBackup: false, ownerAcceptedNoBackupRisk: true }));
        if (recovery) console.log(JSON.stringify({ recovery }));
        const change = supervision ? upgradePreview0017 : workspace ? upgradePreview0016 : upgrade ? upgradePreview0015 : initializePreview;
        const outcome = await change({ inspect, apply: async before => {
            if (supervision) {
                diagnostic.stage = "private backup verification";
                try { readSupervisionBackup(options.get("--backup-evidence")!, options.get("--confirm-backup")!, before); }
                catch (error) { failureStage = diagnostic.stage; throw error; }
            }
            diagnostic.executionBegan = true;
            diagnostic.stage = "transaction start";
            try {
                return await sql.begin(async tx => {
                    diagnostic.stage = "transaction guards";
                    await tx`set local lock_timeout='3s'`; await tx`set local statement_timeout='10s'`;
                    // Unqualified committed CREATE TABLE statements must create in public, never pg_catalog.
                    // PostgreSQL still searches pg_catalog implicitly first for names when it is omitted here.
                    await tx`set local search_path=public`;
                    await tx`select pg_advisory_xact_lock(1296388937,15)`;
                    if (upgrade) await tx`lock table drizzle.__drizzle_migrations in share row exclusive mode`;
                    if (workspace || supervision) {
                        // Exclude application writers while comparing existing rows and sequence values.
                        for (const value of Object.values((supervision ? workspaceMigrationSource() : previewMigrationSource()).snapshot.tables)) {
                            const table = value as { name: string };
                            await tx`lock table ${tx(`public.${table.name}`)} in share mode`;
                        }
                    }
                    const current = await inspectPreviewState(tx as unknown as postgres.Sql, config, inspectionMode);
                    if (supervision) verifySupervisionLedger(current.ledger, 17);
                    else if (workspace) verifyWorkspaceLedger(current.ledger, 16);
                    else if (upgrade) verifyPreviewLedger(current.ledger, 15);
                    if ((!upgrade && !current.empty) || current.target !== before.target || current.catalog !== before.catalog) throw refused();
                    if (workspace || supervision) {
                        diagnostic.stage = "baseline schema verification";
                        if (!supervision) await verifyPreviewSchema(tx as unknown as postgres.Sql, "workspace-baseline");
                    }
                    diagnostic.stage = "migration application";
                    await applyPreviewMigrations(tx, sql.options, supervision ? "0017" : workspace);
                    diagnostic.stage = "schema verification";
                    if (supervision) await verifyPreviewCatalog(tx as unknown as postgres.Sql, "upgrade-0017");
                    else await verifyPreviewSchema(tx as unknown as postgres.Sql, workspace ? "upgrade-0016" : upgrade ? "upgrade-0015" : "initialize");
                    if (supervision) {
                        diagnostic.stage = "supervision runtime grants";
                        await grantSupervisionRuntime(tx as unknown as postgres.Sql);
                    }
                    if (workspace) {
                        diagnostic.stage = "workspace runtime grants";
                        await grantWorkspaceRuntime(tx);
                    }
                    diagnostic.stage = "precommit verification";
                    const verified = await inspectPreviewState(tx as unknown as postgres.Sql, config, inspectionMode);
                    if (verified.ledger.length !== (supervision ? 18 : workspace ? 17 : 16) || upgrade && verified.preservedData !== before.preservedData) throw refused();
                    diagnostic.stage = "transaction commit";
                    return verified.catalog;
                });
            } catch (error) { failureStage = diagnostic.stage; throw error; }
        } }, { execute: true, target: options.get("--confirm-target") ?? "", source: options.get("--confirm-source") ?? "" }, source.hash);
        diagnostic.commitConfirmed = true; // Includes the unchanged independent durable catalog/ledger comparison.
        console.log(`Preview database: ${outcome}. Roles/accounts were not initialized. No automatic retry.`);
    } catch (error) {
        diagnostic.stage = failureStage ?? diagnostic.stage;
        diagnostic.exitStatus = 1;
        diagnostic.error = previewFailure(error);
        diagnostic.durableInspectionRequired = diagnostic.executionBegan && !diagnostic.commitConfirmed;
        console.error("Preview initialization not confirmed. Inspect target identity, permissions, source and durable state before further action. No automatic retry; private inputs suppressed.");
        console.error(JSON.stringify(diagnostic));
        process.exitCode = 1;
    } finally {
        try { await client?.end({ timeout: 2 }); } catch (error) {
            if (!diagnostic.exitStatus) {
                diagnostic.stage = "connection close"; diagnostic.error = previewFailure(error);
                diagnostic.exitStatus = 1;
                diagnostic.durableInspectionRequired = diagnostic.executionBegan && !diagnostic.commitConfirmed;
                console.error(JSON.stringify(diagnostic));
            }
            process.exitCode = 1;
        }
        if (!diagnostic.exitStatus) diagnostic.stage = "complete";
    }
    return diagnostic;
}
if (process.argv[1]?.replaceAll("\\", "/").endsWith("/initialize-preview-database.ts")) void main();
