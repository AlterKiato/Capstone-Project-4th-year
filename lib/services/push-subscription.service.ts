import "server-only";
import { getSession } from "@/lib/auth/session";
import { resolveCurrentAccount } from "@/lib/auth/account-principal";
import { checkPushIngress, checkPushAccount } from "./auth-rate-limit.service";
import { db } from "@/lib/db";
import { createPushSubscriptionRepository } from "@/lib/repositories/push-subscription.repository";
import { createPushSubscriptionService, type PushOperation } from "@/lib/push/subscription";
import { pushConfiguration } from "@/lib/push/config";

const limitOperation = (operation: PushOperation) => operation === "GET" ? "pushStatus" as const : "pushMutation" as const;
export const managePushSubscription = createPushSubscriptionService({
    session: getSession,
    account: async claims => (await resolveCurrentAccount(claims)).status,
    ingress: async (operation, headers) => (await checkPushIngress(limitOperation(operation), headers)).status,
    accountLimit: async (operation, userId) => (await checkPushAccount(limitOperation(operation), userId)).status,
    configuration: pushConfiguration,
    repository: createPushSubscriptionRepository(db),
});
