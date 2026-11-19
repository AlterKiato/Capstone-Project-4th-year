// Explicit operator entry point. Importing never reads credentials, connects, backs up or migrates.
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { isAbsolute } from "node:path";
import { parse } from "dotenv";
import postgres from "postgres";
import { databaseConfiguration } from "@/lib/db/config";
import { privateFile } from "./upload-acceptance-safety";
import { inspectPreviewState, verifyEvaluationTarget, applyPreviewMigrations } from "./initialize-preview-database";
import { coEvaluationMigrationSource, emailOtpMigrationSource, verifyEvaluationLedger } from "./preview-migration-source";
import { EVALUATION_TABLES, EVALUATION_SEQUENCES, grantEvaluationRuntime, readEvaluationBackup, upgradePreviewEvaluations } from "./preview-evaluations";
import { previewFailure } from "./preview-initialization";

export function evaluationArguments(args: string[], interactive: boolean) {
    const [mode, ...pairs] = args;
    if (!["--inspect", "--execute"].includes(mode) || pairs.length % 2) throw Error("Evaluation arguments refused.");
    const options = new Map<string, string>();
    const keys = ["--profile", "--confirm-target", "--confirm-source", "--confirm-data-api-disabled", "--backup-evidence", "--confirm-backup"];
    for (let i = 0; i < pairs.length; i += 2) {
        if (!keys.includes(pairs[i]) || options.has(pairs[i]) || !pairs[i + 1]) throw Error("Evaluation arguments refused.");
        options.set(pairs[i], pairs[i + 1]);
    }
    if (!isAbsolute(options.get("--profile") ?? "")) throw Error("Private profile required.");
    if (mode === "--inspect" ? options.size !== 1 : options.size !== 6 || !interactive ||
        options.get("--confirm-data-api-disabled") !== "yes" || !isAbsolute(options.get("--backup-evidence") ?? "") ||
        !["--confirm-target", "--confirm-source", "--confirm-backup"].every(k => /^[a-f0-9]{64}$/.test(options.get(k) ?? ""))) throw Error("Evaluation approval refused.");
    return { execute: mode === "--execute", options };
}

export async function main(args = process.argv.slice(2)) {
    let writer: postgres.Sql | undefined;
    let executionBegan = false;
    let stage = "arguments";
    try {
        const { execute, options } = evaluationArguments(args, !!process.stdin.isTTY && !!process.stdout.isTTY);
        const source = coEvaluationMigrationSource();
        if (execute && options.get("--confirm-source") !== source.hash) throw Error("Evaluation source refused.");
        stage = "private configuration";
        const profile = privateFile(options.get("--profile")!);
        if (statSync(profile).size > 65536) throw Error("Profile refused.");
        // Parse only the explicitly selected existing private profile, never the application's .env.
        const config = databaseConfiguration({ ...process.env, ...parse(readFileSync(profile)) }, "operator");
        verifyEvaluationTarget(config);
        const connect = (readOnly: boolean) => postgres(config.url, { ...config.options, max: 1, onnotice: () => {}, connection: {
            ...config.options.connection, statement_timeout: 10000, lock_timeout: 3000, idle_in_transaction_session_timeout: 30000,
            ...(readOnly ? { default_transaction_read_only: true } : {}),
        } });
        // Every inspection gets an independent authenticated connection, including durable readback.
        const inspect = async () => {
            const reader = connect(true);
            try {
                return await reader.begin("isolation level repeatable read read only", async tx => {
                    await tx`set local search_path=pg_catalog,public`;
                    const [mode] = await tx`select current_setting('transaction_read_only') as read_only`;
                    assert.equal(mode.read_only, "on");
                    return inspectPreviewState(tx as unknown as postgres.Sql, config, "evaluation");
                });
            } finally { await reader.end({ timeout: 2 }); }
        };
        stage = "read-only preflight";
        if (!execute) {
            const state = await inspect();
            console.log(JSON.stringify({ target: state.target, source: source.hash, ledgerEntries: state.ledger.length,
                catalog: state.catalog, preservedData: state.preservedData, state: state.ledger.length === 24 ? "already-applied" : "pending-0021-0023" }));
            return;
        }
        const result = await upgradePreviewEvaluations({ inspect, apply: async before => {
            stage = "private backup verification";
            readEvaluationBackup(options.get("--backup-evidence")!, options.get("--confirm-backup")!, before);
            writer = connect(false);
            return writer.begin(async tx => {
                // Migration SQL uses unqualified CREATE TABLE; keep its established public DDL target.
                await tx`set local search_path=public`;
                await tx`select pg_advisory_xact_lock(1296388937,15)`;
                await tx`lock table drizzle.__drizzle_migrations in share row exclusive mode`;
                const tables = Object.values(emailOtpMigrationSource().snapshot.tables).map((t: unknown) => (t as { name: string }).name).sort();
                for (const table of tables) await tx`lock table ${tx(`public.${table}`)} in share mode`;
                const current = await inspectPreviewState(tx as unknown as postgres.Sql, config, "evaluation");
                verifyEvaluationLedger(current.ledger, 21);
                if (current.target !== before.target || current.catalog !== before.catalog || current.preservedData !== before.preservedData) throw Error("Evaluation baseline changed.");
                readEvaluationBackup(options.get("--backup-evidence")!, options.get("--confirm-backup")!, current);
                // No mutation has occurred before every source/target/catalog/backup guard passes.
                executionBegan = true; stage = "migration transaction";
                await applyPreviewMigrations(tx, writer!.options, "evaluation");
                await grantEvaluationRuntime(tx as unknown as postgres.Sql);
                for (const table of EVALUATION_TABLES) {
                    const [row] = await tx`select count(*)::int as count from ${tx(`public.${table}`)}`;
                    assert.equal(row.count, 0);
                }
                for (const sequence of EVALUATION_SEQUENCES) {
                    const [row] = await tx`select last_value::text as value,is_called from ${tx(`public.${sequence}`)}`;
                    assert.equal(row.value, "1"); assert.equal(row.is_called, false);
                }
                const [co] = await tx`select exists(select 1 from public.co_adviser_review_assignments where evaluation_assignment_id is not null or evaluation is not null) as changed`;
                assert.equal(co.changed, false);
                const after = await inspectPreviewState(tx as unknown as postgres.Sql, config, "evaluation");
                verifyEvaluationLedger(after.ledger, 24);
                if (after.target !== before.target || after.preservedData !== before.preservedData) throw Error("Evaluation preservation mismatch.");
                stage = "commit and independent durable verification";
                return after.catalog;
            });
        } }, { execute: true, target: options.get("--confirm-target")!, source: options.get("--confirm-source")! });
        console.log(JSON.stringify({ result, executionBegan, independentlyVerified: true }));
    } catch (error) {
        process.exitCode = 1;
        console.error(JSON.stringify({ stage, executionBegan, durableInspectionRequired: executionBegan, error: previewFailure(error) }));
    } finally {
        try { await writer?.end({ timeout: 2 }); }
        catch { process.exitCode = 1; console.error(JSON.stringify({ stage: "connection close", executionBegan, durableInspectionRequired: executionBegan })); }
    }
}
if (process.argv[1]?.replaceAll("\\", "/").endsWith("/migrate-preview-evaluations.ts")) void main();
