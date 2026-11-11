// Explicit owner-operated 0019 entry point. Never invoked by install/build/start.
import postgres from "postgres";
import { databaseConfiguration } from "@/lib/db/config";
import { inspectPreviewState, verifyPreviewUpgradeTarget, applyPreviewMigrations } from "./initialize-preview-database";
import { revisionMigrationSource, progressMigrationSource, verifyRevisionLedger } from "./preview-migration-source";
import { verifyPreviewCatalog } from "./preview-schema";
import { grantRevisionRuntime, upgradePreview0019 } from "./preview-revisions";
import { previewFailure } from "./preview-initialization";

export async function main(args = process.argv.slice(2)) {
    let client: postgres.Sql | undefined;
    let executionBegan = false;
    let stage = "arguments";
    try {
        const [mode, ...pairs] = args;
        if (!["--inspect", "--execute"].includes(mode) || pairs.length % 2) throw Error("Arguments refused.");
        const options = new Map<string, string>();
        for (let i = 0; i < pairs.length; i += 2) {
            if (!["--confirm-target", "--confirm-source", "--confirm-data-api-disabled"].includes(pairs[i]) || options.has(pairs[i]) || !pairs[i + 1]) throw Error("Arguments refused.");
            options.set(pairs[i], pairs[i + 1]);
        }
        if (mode === "--inspect" ? options.size !== 0 : options.size !== 3 || options.get("--confirm-data-api-disabled") !== "yes" || !process.stdin.isTTY || !process.stdout.isTTY) throw Error("Approval refused.");
        const source = revisionMigrationSource();
        if (mode === "--execute" && options.get("--confirm-source") !== source.hash) throw Error("Source refused.");
        stage = "configuration";
        (await import("dotenv")).config({ quiet: true });
        const config = databaseConfiguration(process.env, "operator");
        verifyPreviewUpgradeTarget(config);
        client = postgres(config.url, { ...config.options, max: 1, onnotice: () => {}, connection: {
            statement_timeout: 10000, lock_timeout: 3000, idle_in_transaction_session_timeout: 30000,
            ...(mode === "--inspect" ? { default_transaction_read_only: true } : {}),
        } });
        const sql = client;
        const inspect = () => sql.begin("isolation level repeatable read read only", async tx => {
            await tx`set local search_path=pg_catalog,public`;
            return inspectPreviewState(tx as unknown as postgres.Sql, config, "0019");
        });
        stage = "preflight";
        if (mode === "--inspect") {
            const state = await inspect();
            console.log(JSON.stringify({ target: state.target, source: source.hash, ledgerEntries: state.ledger.length,
                catalog: state.catalog, preservedData: state.preservedData, state: state.ledger.length === 20 ? "already-applied" : "pending-0019" }));
            return;
        }
        const outcome = await upgradePreview0019({ inspect, apply: async before => {
            executionBegan = true; stage = "migration transaction";
            return sql.begin(async tx => {
                await tx`set local search_path=public`;
                await tx`select pg_advisory_xact_lock(1296388937,15)`;
                await tx`lock table drizzle.__drizzle_migrations in share row exclusive mode`;
                for (const value of Object.values(progressMigrationSource().snapshot.tables)) {
                    const table = value as { name: string };
                    await tx`lock table ${tx(`public.${table.name}`)} in share mode`;
                }
                const current = await inspectPreviewState(tx as unknown as postgres.Sql, config, "0019");
                verifyRevisionLedger(current.ledger, 19);
                if (current.target !== before.target || current.catalog !== before.catalog) throw Error("Baseline changed.");
                await applyPreviewMigrations(tx, sql.options, "0019");
                await verifyPreviewCatalog(tx as unknown as postgres.Sql, "upgrade-0019");
                await grantRevisionRuntime(tx as unknown as postgres.Sql);
                const after = await inspectPreviewState(tx as unknown as postgres.Sql, config, "0019");
                verifyRevisionLedger(after.ledger, 20);
                if (after.preservedData !== before.preservedData) throw Error("Preservation mismatch.");
                stage = "commit and durable readback";
                return after.catalog;
            });
        } }, { execute: true, target: options.get("--confirm-target")!, source: options.get("--confirm-source")! }, source.hash);
        console.log(`Preview revisions: ${outcome}. No accounts or submissions changed.`);
    } catch (error) {
        process.exitCode = 1;
        console.error(JSON.stringify({ stage, executionBegan, durableInspectionRequired: executionBegan, error: previewFailure(error) }));
    } finally { await client?.end({ timeout: 2 }); }
}
if (process.argv[1]?.replaceAll("\\", "/").endsWith("/migrate-preview-revisions.ts")) void main();
