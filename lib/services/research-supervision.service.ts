import "server-only";
import { getCurrentAccount } from "@/lib/auth/current-account";
import { ROLE_IDS } from "@/lib/auth/roles";
import { readMainAdviserConfiguration, replaceMainAdviserDesignation } from "@/lib/repositories/research-supervision.repository";
import { designateMainAdviserSchema } from "@/lib/validations/research-supervision";
import type { MainAdviserConfiguration, MainAdviserResult } from "@/types/research-supervision";

const denied = { success: false, kind: "denied", message: "An active Admin account is required to manage the Main Research Adviser." } as const;

export async function getMainAdviserConfiguration(): Promise<{ success: boolean; data?: MainAdviserConfiguration; message: string }> {
    try {
        const actor = await getCurrentAccount();
        if (actor?.roleId !== ROLE_IDS.ADMIN) return denied;
        const data = await readMainAdviserConfiguration(actor.userId);
        return data ? { success: true, data, message: "" } : denied;
    } catch { return { success: false, message: "Main Research Adviser configuration is unavailable. Reload to try again." }; }
}

export async function designateMainAdviser(input: unknown): Promise<MainAdviserResult> {
    let attempted = false;
    try {
        const actor = await getCurrentAccount();
        if (actor?.roleId !== ROLE_IDS.ADMIN) return denied;
        const parsed = designateMainAdviserSchema.safeParse(input);
        if (!parsed.success) return { success: false, kind: "validation", message: "Select an eligible Adviser and confirm the designation." };
        attempted = true;
        const result = await replaceMainAdviserDesignation(actor.userId, parsed.data.mainAdviserId, parsed.data.expectedRevision);
        switch (result.kind) {
            case "denied": return denied;
            case "ineligible": return { success: false, kind: "ineligible", message: "The selected account must be an active Adviser. Refresh the directory." };
            case "stale": return { success: false, kind: "stale", message: "The Main Research Adviser designation changed. Refresh and review the current designation before trying again." };
            case "unchanged": return { success: false, kind: "unchanged", message: "This Adviser is already designated. Refresh to view the current designation." };
            case "updated": return { success: true, kind: "success", message: "Main Research Adviser designation saved." };
        }
    } catch {
        return attempted
            ? { success: false, kind: "uncertain", uncertain: true, message: "The designation could not be confirmed. Refresh and verify the current Main Research Adviser before retrying." }
            : { success: false, kind: "unavailable", message: "Main Research Adviser configuration is unavailable. Reload to try again." };
    }
}
