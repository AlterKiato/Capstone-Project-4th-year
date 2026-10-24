// Explicit privileged Preview initialization only. Importing never connects or writes; not called by build/startup.
import { createHash } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { databaseConfiguration } from "@/lib/db/config";
import { verifyDatabaseIdentity, type IdentitySql, type DatabaseConfiguration } from "@/lib/db/identity";
import { previewMigrationSource } from "./preview-migration-source";
import { verifyPreviewSchema } from "./preview-schema";
import { initializePreview, previewFailure, type PreviewState } from "./preview-initialization";

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const refused = () => new Error("Preview initialization prerequisites not satisfied.");

export async function applyPreviewMigrations(tx: postgres.TransactionSql, options: postgres.Sql["options"]) {
    // Preserve the supported ORM migrator; its inner transaction becomes a postgres-js savepoint.
    // Real transaction clients omit options. Borrow only parser/serializer metadata, never root SQL methods.
    const nested = new Proxy(tx, { get(target, key) {
        if (key === "options") return options;
        return key === "begin" ? target.savepoint.bind(target) : Reflect.get(target, key);
    } });
    await migrate(drizzle(nested as unknown as postgres.Sql), { migrationsFolder: "db/migrations" });
}

export async function inspectPreviewState(sql: postgres.Sql, config: DatabaseConfiguration): Promise<PreviewState> {
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
    const { migrations } = previewMigrationSource();
    if (ledger.length && (ledger.length !== 15 || ledger.some((r, i) => r.id !== i + 1 || r.hash !== migrations[i].hash || r.created_at !== String(migrations[i].folderMillis)))) throw refused();
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
    for (const table of relations.filter(r => ["r", "p"].includes(r.relkind))) {
        if (!/^[a-z_][a-z0-9_]*$/.test(table.relname)) throw refused();
        const [row] = await sql`select count(*)::int as count from ${sql(`public.${table.relname}`)}`;
        counts[table.relname] = row.count;
    }
    return { target, ledger: ledger.map(r => ({ hash: r.hash, created_at: r.created_at })),
        empty: !existing.ledger && !relations.length && !routines.length && !types.length,
        catalog: digest({ relations, routines, types, columns, constraints, indexes, sequences, ledger, counts }) };
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
        if (mode !== "--inspect" && mode !== "--execute" || args.length % 2) throw refused();
        const options = new Map<string, string>();
        for (let i = 0; i < args.length; i += 2) {
            if (!["--confirm-target", "--confirm-source", "--confirm-data-api-disabled"].includes(args[i]) || options.has(args[i]) || !args[i + 1]) throw refused();
            options.set(args[i], args[i + 1]);
        }
        if (mode === "--inspect" && options.size || mode === "--execute" && options.size !== 3) throw refused();
        if (mode === "--execute" && (!process.stdin.isTTY || !process.stdout.isTTY)) throw refused();
        // Load only after explicit valid arguments; no implicit runtime credential fallback.
        diagnostic.stage = "configuration and migration source";
        (await import("dotenv")).config({ quiet: true });
        const config = databaseConfiguration(process.env, "operator"), source = previewMigrationSource();
        if (config.environment !== "preview" || config.purpose !== "operator") throw refused();
        client = postgres(config.url, { ...config.options, onnotice: () => {} });
        const sql = client;
        const inspect = () => {
            diagnostic.stage = diagnostic.executionBegan ? "durable-state inspection" : "preflight inspection";
            return sql.begin("isolation level repeatable read read only", async tx => {
                await tx`set local statement_timeout='10s'`;
                return inspectPreviewState(tx as unknown as postgres.Sql, config);
            });
        };
        if (mode === "--inspect") {
            const state = await inspect();
            console.log(JSON.stringify({ target: state.target, emptyApplicationSchema: state.empty, ledgerEntries: state.ledger.length, source: source.hash }));
            return diagnostic;
        }
        if (options.get("--confirm-data-api-disabled") !== "yes") throw refused();
        const outcome = await initializePreview({ inspect, apply: async before => {
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
                    const current = await inspectPreviewState(tx as unknown as postgres.Sql, config);
                    if (!current.empty || current.target !== before.target || current.catalog !== before.catalog) throw refused();
                    diagnostic.stage = "migration application";
                    await applyPreviewMigrations(tx, sql.options);
                    diagnostic.stage = "schema verification";
                    await verifyPreviewSchema(tx as unknown as postgres.Sql);
                    diagnostic.stage = "precommit verification";
                    const verified = await inspectPreviewState(tx as unknown as postgres.Sql, config);
                    if (verified.ledger.length !== 15) throw refused();
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
