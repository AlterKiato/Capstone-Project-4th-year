import "server-only";
import { getActiveAIAccount } from "@/lib/auth/ai-authorization";
import { getCurrentMainAdviser } from "@/lib/auth/main-adviser";
import { getAdminAIOverviewAggregate } from "@/lib/repositories/admin-ai-aggregate.repository";
import { getAdviserAIWorkflowAggregate } from "@/lib/repositories/adviser-submission.repository";
import { minimizeAdminAggregate, minimizeAdviserAggregate } from "@/lib/ai/aggregate-policy";

// Internal local preparation only. No Server Action exports these DTOs to a client/provider.
// Adult approval must precede any future provider-facing use; no registry is approved today.
export async function prepareLocalAdminAggregate() {
    try {
        if (!await getActiveAIAccount(1)) return { success: false } as const;
        const payload = minimizeAdminAggregate(await getAdminAIOverviewAggregate());
        if (!await getActiveAIAccount(1)) return { success: false } as const;
        return { success: true, payload } as const;
    } catch { return { success: false } as const; }
}
export async function prepareLocalAdviserAggregate() {
    try {
        const actor = await getCurrentMainAdviser();
        if (!actor) return { success: false } as const;
        const adviserId = actor.userId;
        const payload = minimizeAdviserAggregate(await getAdviserAIWorkflowAggregate(adviserId));
        if (!await getCurrentMainAdviser(adviserId)) return { success: false } as const;
        return { success: true, payload } as const;
    } catch { return { success: false } as const; }
}
