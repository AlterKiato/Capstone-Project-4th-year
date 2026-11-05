// Explicit privileged Preview initialization or bounded 0015 upgrade. Importing never connects or writes.
import { createHash } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { PgDialect } from "drizzle-orm/pg-core";
import { databaseConfiguration } from "@/lib/db/config";
import { verifyDatabaseIdentity, type IdentitySql, type DatabaseConfiguration } from "@/lib/db/identity";
import { previewMigrationSource, verifyPreviewLedger } from "./preview-migration-source";
import { verifyPreviewSchema } from "./preview-schema";
import { initializePreview, upgradePreview0015, verifyAccountRecoveryEvidence, previewFailure, type PreviewState } from "./preview-initialization";

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const refused = () => new Error("Preview initialization prerequisites not satisfied.");

export function verifyPreviewUpgradeTarget(config: DatabaseConfiguration) {
    const pin = config.observed;
    if (config.environment !== "preview" || config.purpose !== "operator" || config.endpoint.database !== "postgres" ||
        pin?.provider !== "supabase" || pin.projectRef !== "cbkplqkkjuoglpimwmib" || pin.databaseOid !== "5" ||
        pin.cluster !== "7678069749886157684" || pin.runtimeRole !== "thesishs_preview_runtime" ||
        pin.operatorRole !== "thesishs_preview_operator") throw refused();
}

export async function applyPreviewMigrations(tx: postgres.TransactionSql, options: postgres.Sql["options"]) {
    const source = previewMigrationSource();
    // Preserve the supported ORM migrator; its inner transaction becomes a postgres-js savepoint.
    // Real transaction clients omit options. Borrow only parser/serializer metadata, never root SQL methods.
    const nested = new Proxy(tx, { get(target, key) {
        if (key === "options") return options;
        return key === "begin" ? target.savepoint.bind(target) : Reflect.get(target, key);
    } });
    // Same installed ORM dialect migrator/session as postgres-js/migrator, but pass
    // the exact reviewed legacy prefix instead of rereading the now-expanded folder.
    // This existing operator must never apply 0016; its approval/catalog contract is 0015.
    const database = drizzle(nested as unknown as postgres.Sql);
    // Installed dialect declarations use a schema-less session default. Preserve the
    // same actual postgres-js session; only adapt that generic type at this boundary.
    const session = database._.session as unknown as Parameters<PgDialect["migrate"]>[1];
    await new PgDialect().migrate(source.migrations, session, { migrationsFolder: "db/migrations" });
}

export async function inspectPreviewState(sql: postgres.Sql, config: DatabaseConfiguration, upgrade = false): Promise<PreviewState> {
    if (upgrade) verifyPreviewUpgradeTarget(config);
    const identity = await verifyDatabaseIdentity(sql as unknown as IdentitySql, config);
    const target = digest({ environment: config.environment, approved: config.identity, identity });
    const [permissions] = await sql`select has_schema_privilege(current_user,'public','CREATE') as create_public,
        has_database_privilege(current_user,current_database(),'TEMP') as temporary,
        (has_database_privilege(current_user,current_database(),'CREATE') or
            case when to_regnamespace('drizzle') is null then false else has_schema_privilege(current_user,'drizzle','CREATE') end) as create_ledger`;
    if (!permissions.create_public || !permissions.temporary || !permissions.create_ledger) throw refused();
    const relations = await sql`select c.relname,c.relkind,c.relowner::text from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and not exists(select 1 from pg_depend d where d.classid='pg_class'::regclass and d.objid=c.oid and d.deptype='e') order by c.relname`;
    const routines = await sql`select p.oid::regprocedure::text as name from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e') order by name`;
    const types = await sql`select t.typname from pg_type t join pg_namespace n on n.oid=t.typnamespace
        where n.nspname='public' and t.typtype in ('d','e','r','m') and not exists(select 1 from pg_depend d where d.classid='pg_type'::regclass and d.objid=t.oid and d.deptype='e') order by t.typname`;
    const [existing] = await sql`select to_regclass('drizzle.__drizzle_migrations') is not null as ledger`;
    const ledger = existing.ledger ? await sql`select id,hash,created_at::text as created_at from drizzle.__drizzle_migrations order by created_at,id` : [];
    if (upgrade || ledger.length) {
        verifyPreviewLedger(ledger.map(r => ({ id: r.id, hash: r.hash, created_at: r.created_at })), upgrade && ledger.length === 15 ? 15 : 16);
    }
    if (upgrade && relations.some(r => r.relname === "push_subscriptions") !== (ledger.length === 16)) throw refused();
    const columns = await sql`select table_name,column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' order by table_name,ordinal_position`;
    const constraints = await sql`select c.relname,k.conname,k.contype,k.convalidated,to_jsonb(k)->>'conenforced' as enforced,pg_get_constraintdef(k.oid) as definition
        from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' order by c.relname,k.conname`;
    const indexes = await sql`select tablename,indexname,indexdef from pg_indexes where schemaname='public' order by tablename,indexname`;
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
        if (upgrade && table.relname !== "push_subscriptions") {
            // Database-side row fingerprints include password hashes/status and all existing relationships.
            // Only the final digest remains in memory; no private row contents are returned or logged.
            const [fingerprint] = await sql`select encode(sha256(convert_to(coalesce(string_agg(h,'' order by h),''),'UTF8')),'hex') as hash
                from (select encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') as h from ${sql(`public.${table.relname}`)} as t) as fingerprints`;
            fingerprints[table.relname] = fingerprint.hash;
        }
    }
    const preservedData = upgrade ? digest({ fingerprints, sequences }) : undefined;
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
        const upgrade = mode === "--inspect-upgrade-0015" || mode === "--upgrade-0015";
        const inspectOnly = mode === "--inspect" || mode === "--inspect-upgrade-0015";
        if (!["--inspect", "--execute", "--inspect-upgrade-0015", "--upgrade-0015"].includes(mode ?? "") || args.length % 2) throw refused();
        const options = new Map<string, string>();
        for (let i = 0; i < args.length; i += 2) {
            if (!["--confirm-target", "--confirm-source", "--confirm-data-api-disabled", ...(upgrade ? ["--confirm-recovery-verified",
                "--recovery-mode", "--recovery-evidence", "--confirm-account-recovery-verified", "--confirm-replaceable-data"] : [])].includes(args[i]) || options.has(args[i]) || !args[i + 1]) throw refused();
            options.set(args[i], args[i + 1]);
        }
        const accountRecovery = options.get("--recovery-mode") === "synthetic-accounts";
        if (inspectOnly ? options.size !== 0 : options.size !== (upgrade ? accountRecovery ? 7 : 4 : 3)) throw refused();
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
        const config = databaseConfiguration(process.env, "operator"), source = previewMigrationSource();
        if (config.environment !== "preview" || config.purpose !== "operator") throw refused();
        if (upgrade) verifyPreviewUpgradeTarget(config);
        client = postgres(config.url, { ...config.options, onnotice: () => {} });
        const sql = client;
        const inspect = () => {
            diagnostic.stage = diagnostic.executionBegan ? "durable-state inspection" : "preflight inspection";
            return sql.begin("isolation level repeatable read read only", async tx => {
                await tx`set local statement_timeout='10s'`;
                return inspectPreviewState(tx as unknown as postgres.Sql, config, upgrade);
            });
        };
        if (inspectOnly) {
            const state = await inspect();
            console.log(JSON.stringify({ target: state.target, emptyApplicationSchema: state.empty, ledgerEntries: state.ledger.length, source: source.hash }));
            return diagnostic;
        }
        if (options.get("--confirm-data-api-disabled") !== "yes") throw refused();
        // Explicit owner attestation; this command cannot independently prove private recovery evidence.
        if (upgrade && !accountRecovery && options.get("--confirm-recovery-verified") !== "yes") throw refused();
        if (recovery) console.log(JSON.stringify({ recovery }));
        const change = upgrade ? upgradePreview0015 : initializePreview;
        const outcome = await change({ inspect, apply: async before => {
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
                    const current = await inspectPreviewState(tx as unknown as postgres.Sql, config, upgrade);
                    if (upgrade) verifyPreviewLedger(current.ledger, 15);
                    if ((!upgrade && !current.empty) || current.target !== before.target || current.catalog !== before.catalog) throw refused();
                    diagnostic.stage = "migration application";
                    await applyPreviewMigrations(tx, sql.options);
                    diagnostic.stage = "schema verification";
                    await verifyPreviewSchema(tx as unknown as postgres.Sql, upgrade ? "upgrade-0015" : "initialize");
                    diagnostic.stage = "precommit verification";
                    const verified = await inspectPreviewState(tx as unknown as postgres.Sql, config, upgrade);
                    if (verified.ledger.length !== 16 || upgrade && verified.preservedData !== before.preservedData) throw refused();
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
