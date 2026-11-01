import { createPushHttpHandler } from "@/lib/push/http";
import { pushConfiguration } from "@/lib/push/config";

export const runtime = "nodejs";
// Lazy import keeps configuration/authentication failures inside the safe response boundary.
const handle = createPushHttpHandler(async (operation, input, headers) => {
    const { managePushSubscription } = await import("@/lib/services/push-subscription.service");
    return managePushSubscription(operation, input, headers);
}, pushConfiguration);
export const GET = handle;
export const POST = handle;
export const DELETE = handle;
