import "server-only";
import { validPublicKey, safePushEndpoint } from "./contract";
import type { PushDeliveryConfiguration } from "./config";

export type ResearchPushEvent = "initial-submission" | "revised-submission" | "revision-required" | "approved";
export type ResearchPushTarget = { event: ResearchPushEvent; recipientId: number };
export type PushPayload = { v: 1; destination: "student-notifications" | "adviser-notifications" };
export function pushPayload(destination: unknown): PushPayload | null {
    return destination === "student-notifications" || destination === "adviser-notifications" ? { v: 1, destination } : null;
}
export function researchPushTarget(target: ResearchPushTarget): { roleId: 2 | 3; payload: PushPayload } | null {
    if (!target || !Number.isSafeInteger(target.recipientId) || target.recipientId <= 0 || target.recipientId > 2147483647) return null;
    if (target.event === "initial-submission" || target.event === "revised-submission") return { roleId: 2, payload: pushPayload("adviser-notifications")! };
    if (target.event === "revision-required" || target.event === "approved") return { roleId: 3, payload: pushPayload("student-notifications")! };
    return null;
}
export type PushBudget = { signal: AbortSignal; remaining(): number; check(): void };
export type DeliverySubscription = {
    generation: string; userId: number; roleId: number; endpoint: string; p256dh: string; auth: string;
    vapidKeyId: string; authorizedUntil: Date; browserExpiresAt: Date | null;
};
export type PushDeliveryRepository = {
    find(userId: number, roleId: 2 | 3, keyId: string, budget: PushBudget): Promise<DeliverySubscription | null>;
    disable(captured: DeliverySubscription, budget: PushBudget): Promise<boolean>;
};
export type PushOutcome = "disabled" | "budget_skip" | "invalid" | "no_subscription" | "accepted" |
    "endpoint_disabled" | "replacement_preserved" | "transient" | "configuration_error" | "timeout" | "unavailable" | "schedule_failed";
export type PushTransport = (subscription: DeliverySubscription, payload: PushPayload, config: PushDeliveryConfiguration, budget: PushBudget) => Promise<number>;

export function createResearchPushDelivery(deps: {
    configuration(): PushDeliveryConfiguration | null; repository: PushDeliveryRepository; transport: PushTransport; now?: () => number;
}) {
    return async (target: ResearchPushTarget, budget: PushBudget): Promise<PushOutcome> => {
        try {
            budget.check();
            const config = deps.configuration();
            if (!config) return "disabled";
            const selected = researchPushTarget(target);
            if (!selected) return "invalid";
            const row = await deps.repository.find(target.recipientId, selected.roleId, config.keyId, budget);
            budget.check();
            if (!row) return "no_subscription";
            const now = (deps.now ?? Date.now)();
            if (row.userId !== target.recipientId || row.roleId !== selected.roleId || row.vapidKeyId !== config.keyId ||
                !(row.authorizedUntil.getTime() > now) || row.browserExpiresAt !== null && !(row.browserExpiresAt.getTime() > now)) return "no_subscription";
            if (!safePushEndpoint(row.endpoint) || !validPublicKey(row.p256dh) || !/^[A-Za-z0-9_-]{22}$/.test(row.auth) ||
                Buffer.from(row.auth, "base64url").toString("base64url") !== row.auth) return "invalid";
            const status = await deps.transport(row, selected.payload, config, budget);
            budget.check();
            if (status === 404 || status === 410) return await deps.repository.disable(row, budget) ? "endpoint_disabled" : "replacement_preserved";
            if (status >= 200 && status < 300) return "accepted";
            return status === 400 || status === 401 || status === 403 ? "configuration_error" : "transient";
        } catch { return budget.signal.aborted || budget.remaining() <= 0 ? "timeout" : "unavailable"; }
    };
}
