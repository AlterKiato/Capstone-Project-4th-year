import "server-only";
import { reservePilotAttempt, releasePilotAttempt } from "@/lib/repositories/ai-pilot-quota.repository";
import { pilotWindowSchema, type PilotWindow } from "@/lib/validations/ai-pilot";
export const AI_PILOT_LIMITS = Object.freeze({ perUserPerUTCDay: 3, globalPerUTCDay: 10, cooldownMs: 120000, concurrency: 1 });
// Internal service supplies the independently authorized account, never client identity/counters.
// Missing migration, lock contention or DB errors deny permission; no memory fallback.
export async function reserveAIPilotAttempt(accountId: number, window?: PilotWindow): Promise<(() => Promise<void>) | null> {
    if (!Number.isSafeInteger(accountId) || accountId <= 0) return null;
    if (window !== undefined && !pilotWindowSchema.safeParse(window).success) return null;
    try {
        const id = await reservePilotAttempt(accountId, window);
        if (!id) return null;
        return async () => {
            try { await releasePilotAttempt(id); }
            catch { /* Leave the global slot blocked; recover only after confirming the worker stopped. */ }
        };
    } catch { return null; }
}
