import { UPLOAD_CLEANUP_GRACE_MS, validIntentPaths } from "./contract";
import type { UploadIntent } from "./contract";

/** Dry-run only: no state change or delete is authorized by this planner. */
export function planUploadCleanup(intent: UploadIntent, now: Date, hasCommittedReference: boolean) {
    if (!validIntentPaths(intent)) return { eligible: false, staging: false, final: false, protected: true };
    const deadline = Math.max(intent.expiresAt.getTime(), intent.capabilityExpiresAt?.getTime() ?? 0) + UPLOAD_CLEANUP_GRACE_MS;
    const eligible = Number.isFinite(deadline) && deadline <= now.getTime();
    const protectedFinal = hasCommittedReference || intent.state === "completed" || intent.submissionId !== null;
    return { eligible, staging: eligible, final: eligible && !!intent.finalPath && !protectedFinal, protected: protectedFinal };
}
