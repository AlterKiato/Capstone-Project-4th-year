// Explicit operator CLI. No default execution, runtime credentials fallback, backup creation or restore execution.
import "dotenv/config";
import postgres from "postgres";
import { readFileSync, writeFileSync } from "node:fs";
import { databaseConfiguration } from "@/lib/db/config";
import { requirePrivateTerminal } from "./database-operator";
import { MIGRATION_HASH, CLUSTER, DATABASE_OID, migrationSource, inspectState, validateIdentity, validateState,
    unchanged, privateFile, bytesDigest, refuse, migrate0014 } from "./upload-acceptance-safety";
import type { State, Recovery, OperatorSql } from "./upload-acceptance-safety";

async function main() {
    try {
        const args = process.argv.slice(2), mode = args.shift();
        if (!["--inspect", "--execute", "--verify-recovery"].includes(mode ?? "") || args.length % 2) throw refuse();
        const options = new Map<string, string>();
        const allowed = ["--expected-cluster", "--expected-oid", "--confirm-target", "--backup-file", "--confirm-backup", "--recovery-evidence", "--restore-database", "--restore-oid"];
        for (let i = 0; i < args.length; i += 2) {
            if (!allowed.includes(args[i]) || options.has(args[i]) || !args[i + 1]) throw refuse();
            options.set(args[i], args[i + 1]);
        }
        const cluster = options.get("--expected-cluster") ?? "", oid = options.get("--expected-oid") ?? "";
        if (cluster !== CLUSTER || oid !== DATABASE_OID) throw refuse();
        if (mode !== "--inspect") requirePrivateTerminal();
        migrationSource();
        const configuration = databaseConfiguration(process.env, "operator");
        const runtime = new URL(process.env.DATABASE_URL ?? "");
        if (configuration.environment !== "development" || !["localhost", "127.0.0.1", "[::1]"].includes(configuration.endpoint.host) ||
            configuration.endpoint.database !== "thesishs_ai" || configuration.endpoint.port !== 5432 ||
            decodeURIComponent(runtime.username) === configuration.endpoint.user) throw refuse();
        let closeFailed = false;
        const withClient = async <T>(run: (client: postgres.Sql) => Promise<T>, url = configuration.url): Promise<T> => {
            if (closeFailed) throw refuse();
            const client = postgres(url, { ...configuration.options, onnotice: () => {} });
            try { return await run(client); }
            finally {
                try { await client.end({ timeout: 2 }); }
                catch { closeFailed = true; throw refuse(); }
            }
        };
        const read = (restored?: { database: string; oid: string }, url = configuration.url) => withClient(client => client.begin("isolation level repeatable read read only", async tx => {
            await tx`set local statement_timeout = '10s'`; return inspectState(tx as unknown as OperatorSql, restored);
        }), url);
        const before = await read(); validateIdentity(before.identity, { cluster, oid });
        validateState(before, before.ledger.length === 15);
        if (mode === "--inspect") {
            if (options.size !== 2) throw refuse();
            console.log(JSON.stringify({ mode: "read-only", target: before.target, applied: before.ledger.length === 15,
                records: before.records, schema: before.oldSchema, sequences: before.sequences, migrationHash: MIGRATION_HASH })); return;
        }
        if (options.get("--confirm-target") !== before.target || before.ledger.length !== 14 && mode === "--verify-recovery") throw refuse();
        const backup = readFileSync(privateFile(options.get("--backup-file") ?? ""));
        const backupHash = bytesDigest(backup);
        if (backup.subarray(0, 5).toString() !== "PGDMP" || options.get("--confirm-backup") !== backupHash) throw refuse();
        const evidencePath = options.get("--recovery-evidence") ?? "";
        if (mode === "--verify-recovery") {
            if (options.size !== 8) throw refuse();
            // Create this private placeholder (0600 / protected Windows ACL) manually before verification.
            const output = privateFile(evidencePath);
            if (readFileSync(output).length !== 0) throw refuse();
            const restoredName = options.get("--restore-database") ?? "", restoredOid = options.get("--restore-oid") ?? "";
            const restoreUrl = new URL(process.env.THESISHS_UPLOAD_RESTORE_URL ?? "");
            if (!/^thesishs_upload_restore_[a-f0-9]{32}$/.test(restoredName) || !/^\d+$/.test(restoredOid) || restoredOid === oid ||
                restoreUrl.hostname !== configuration.endpoint.host || Number(restoreUrl.port || 5432) !== 5432 ||
                decodeURIComponent(restoreUrl.pathname.slice(1)) !== restoredName || decodeURIComponent(restoreUrl.username) !== configuration.endpoint.user ||
                !["postgres:", "postgresql:"].includes(restoreUrl.protocol) || !restoreUrl.password || restoreUrl.search || restoreUrl.hash) throw refuse();
            const restored = await read({ database: restoredName, oid: restoredOid }, restoreUrl.toString()); validateState(restored, false);
            if (restored.identity.cluster !== cluster || restored.identity.oid !== restoredOid || restored.identity.database !== restoredName ||
                restored.identity.port !== 5432 || !["::1/128", "127.0.0.1/32", "::1", "127.0.0.1"].includes(restored.identity.address) ||
                before.records !== restored.records || before.sequences !== restored.sequences) throw refuse();
            const current = await read(); unchanged(before, current); validateState(current, false);
            const evidence: Recovery = { kind: "upload-0014-recovery", target: before.target, records: before.records,
                sequences: before.sequences, schema: before.oldSchema, backupHash, restoredDatabase: restoredName, restoredOid, verifiedAt: new Date().toISOString() };
            writeFileSync(output, JSON.stringify(evidence), { mode: 0o600 });
            console.log("Recovery read-back matched the original; private evidence recorded. No backup or restore was executed."); return;
        }
        if (options.size !== 6) throw refuse();
        const evidence = JSON.parse(readFileSync(privateFile(evidencePath), "utf8")) as Recovery;
        const outcome = await migrate0014({ inspect: () => read(), apply: expected => withClient(client =>
            client.begin(async tx => {
                await tx`set local lock_timeout = '3s'`; await tx`set local statement_timeout = '10s'`;
                await tx`select pg_advisory_xact_lock(1296388937,14)`;
                await tx`lock table drizzle.__drizzle_migrations in exclusive mode`;
                const { source, oldTables } = migrationSource();
                // Quiet-window enforcement: preserve every pre-existing row/sequence during the migration.
                for (const table of oldTables) await tx`lock table ${tx(`public.${table}`)} in share mode`;
                const current = await inspectState(tx as unknown as OperatorSql);
                validateIdentity(current.identity, { cluster, oid }); validateState(current, false); unchanged(expected, current);
                for (const statement of source[14].sql) if (statement.trim()) await tx.unsafe(statement);
                await tx`insert into drizzle.__drizzle_migrations(hash,created_at) values(${MIGRATION_HASH},${String(source[14].folderMillis)})`;
                const verified: State = await inspectState(tx as unknown as OperatorSql); validateState(verified, true, true); unchanged(expected, verified);
            })) }, { execute: true, confirmTarget: before.target, cluster, oid, backupHash }, evidence);
        console.log(`Migration 0014: ${outcome}. No automatic retry.`);
        if (outcome === "not-applied-review-before-retry") process.exitCode = 1;
    } catch {
        // Never print SDK/driver/parser errors, input values, archive contents or credentials.
        console.error("Migration/recovery not confirmed. Inspect identity, source, private backup evidence and durable ledger before any retry.");
        process.exitCode = 1;
    }
}
void main();
