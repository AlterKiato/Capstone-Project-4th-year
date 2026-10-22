// Operator-only, database-read-only reporting. Destructive execution is intentionally unavailable until provider acceptance.
import "dotenv/config";
import postgres from "postgres";
import { databaseConfiguration } from "@/lib/db/config";
import { inspectOperatorTarget } from "./database-operator";
import { uploadIdSchema } from "@/lib/uploads/contract";
import { planUploadCleanup } from "@/lib/uploads/cleanup-plan";
import type { UploadIntent } from "@/lib/uploads/contract";

async function main() {
    let client: postgres.Sql | undefined;
    try {
        const args = process.argv.slice(2);
        const inspect = args.length === 1 && args[0] === "--inspect";
        const dryRun = !args.length || args.length === 1 && args[0] === "--dry-run";
        const cursor = args.length === 2 && args[0] === "--after" ? uploadIdSchema.parse(args[1]) : undefined;
        if (!inspect && !dryRun && !cursor) throw new Error("Only dry-run inspection is supported.");
        const configuration = databaseConfiguration(process.env, "operator");
        client = postgres(configuration.url, { ...configuration.options, onnotice: () => {} });
        const target = await inspectOperatorTarget(client, configuration);
        if (inspect) { console.log(`Read-only target fingerprint: ${target.fingerprint}`); return; }
        const report = await client.begin("read only", async tx => {
            await tx`set local statement_timeout = '5s'`;
            const [clock] = await tx`select clock_timestamp() as now`;
            const rows = await tx`select i.*, exists(select 1 from submissions s where s.file_url=i.final_path or s.id=i.submission_id) as referenced
                from submission_upload_intents i where greatest(i.expires_at,coalesce(i.capability_expires_at,i.expires_at))
                <= clock_timestamp()-interval '10 minutes'
                and (${cursor ?? null}::uuid is null or (i.expires_at,i.id) > (select expires_at,id from submission_upload_intents where id=${cursor ?? null}::uuid))
                order by i.expires_at,i.id limit 26`;
            let staging = 0, final = 0, protectedFinal = 0;
            for (const row of rows.slice(0, 25)) {
                const intent = { id: row.id, paperId: row.paper_id, studentId: row.student_id, stagingPath: row.staging_path,
                    fileName: row.file_name, finalPath: row.final_path, submissionId: row.submission_id, state: row.state,
                    expiresAt: new Date(row.expires_at), capabilityExpiresAt: row.capability_expires_at ? new Date(row.capability_expires_at) : null } as UploadIntent;
                const plan = planUploadCleanup(intent, new Date(clock.now), row.referenced);
                staging += Number(plan.staging); final += Number(plan.final); protectedFinal += Number(plan.protected);
            }
            return { mode: "dry-run", inspected: Math.min(rows.length, 25), stagingCandidates: staging,
                unreferencedFinalCandidates: final, protectedFinal, nextCursor: rows.length > 25 ? rows[24].id : null,
                destructiveExecution: "deferred pending Phase 10.2C.3 provider verification; tombstones retained" };
        });
        console.log(JSON.stringify(report));
    } catch {
        console.error("Upload cleanup inspection unavailable. Only approved operator configuration and read-only dry-run arguments are supported; no cleanup mutations were performed.");
        process.exitCode = 1;
    } finally { try { await client?.end({ timeout: 5 }); } catch { process.exitCode = 1; } }
}
void main();
