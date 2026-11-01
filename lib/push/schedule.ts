import "server-only";
import { researchPushTarget } from "./delivery";
import type { PushBudget, PushOutcome, ResearchPushTarget } from "./delivery";

// Both research action pages declare 60s. Reserve 5s for pre-action/render/platform overhead.
export const PUSH_REQUEST_CUTOFF_MS = 55000;
export const PUSH_MIN_REMAINING_MS = 4000;
export const PUSH_ATTEMPT_TARGET_MS = 3000;
export function createResearchPushScheduler(deps: {
    after(callback: () => Promise<void>): void;
    enabled(): boolean;
    deliver(target: ResearchPushTarget, budget: PushBudget): Promise<PushOutcome>;
    log(outcome: PushOutcome): void;
    now?: () => number;
}) {
    const now = deps.now ?? (() => performance.now());
    const cutoff = now() + PUSH_REQUEST_CUTOFF_MS;
    let scheduled = false;
    const log = (outcome: PushOutcome) => { try { deps.log(outcome); } catch { /* Observability cannot change academic success. */ } };
    return (target: ResearchPushTarget): void => {
        try {
            if (scheduled) return;
            scheduled = true;
            if (!researchPushTarget(target)) { log("invalid"); return; }
            if (!deps.enabled()) return;
            if (cutoff - now() < PUSH_MIN_REMAINING_MS) { log("budget_skip"); return; }
            // Copy only server-resolved identity/event; no mutable caller data or research contents.
            const captured = { recipientId: target.recipientId, event: target.event };
            deps.after(async () => {
                if (cutoff - now() < PUSH_MIN_REMAINING_MS) { log("budget_skip"); return; }
                const controller = new AbortController(), deadline = now() + PUSH_ATTEMPT_TARGET_MS;
                const timer = setTimeout(() => controller.abort(), PUSH_ATTEMPT_TARGET_MS);
                const budget: PushBudget = { signal: controller.signal, remaining: () => Math.max(0, deadline - now()),
                    check: () => { if (controller.signal.aborted || now() >= deadline) throw new Error("Push deadline exceeded."); } };
                try { log(await deps.deliver(captured, budget)); }
                catch { log(controller.signal.aborted || budget.remaining() <= 0 ? "timeout" : "unavailable"); }
                finally { clearTimeout(timer); controller.abort(); }
            });
        } catch { log("schedule_failed"); }
    };
}
