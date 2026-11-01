import "server-only";
import { after } from "next/server";
import { pushDeliveryConfiguration } from "./config";
import { createResearchPushScheduler } from "./schedule";

/** Construct at Server Action entry; call only from its confirmed commit callback. */
export function requestResearchPush() {
    return createResearchPushScheduler({ after, enabled: () => !!pushDeliveryConfiguration(),
        deliver: async (target, budget) => {
            budget.check();
            const { deliverResearchPush } = await import("@/lib/services/research-push.service");
            budget.check();
            return deliverResearchPush(target, budget);
        },
        log: outcome => console.info("research_push", { outcome }),
    });
}
