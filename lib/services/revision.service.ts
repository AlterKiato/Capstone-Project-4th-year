import "server-only";
import { getCurrentAccount } from "@/lib/auth/current-account";
import { db } from "@/lib/db";
import { createRevisionRepository } from "@/lib/repositories/revision.repository";
import { revisionReadSchema, revisionResponseSchema } from "@/lib/validations/revision";
import { ROLE_IDS } from "@/lib/auth/roles";
import type { RevisionChecklist } from "@/lib/revisions";

type Result<T = never> = { success: boolean; message: string; data?: T };
const denied = { success: false, message: "Revisions are unavailable for this account or paper." };
export function createRevisionService(repository: ReturnType<typeof createRevisionRepository>, account = getCurrentAccount) {
    return {
        async read(input: unknown): Promise<Result<RevisionChecklist>> {
            try {
                const actor = await account(), parsed = revisionReadSchema.safeParse(input);
                if (!actor || !parsed.success) return denied;
                return await repository.withPaper(actor.userId, actor.roleId, parsed.data.paperId, async scope => ({
                    success: true, message: "Revisions loaded.", data: await scope.read(parsed.data.submissionId),
                })) ?? denied;
            } catch { return { success: false, message: "Revisions could not be loaded. Reload to try again." }; }
        },
        async respond(input: unknown): Promise<Result<RevisionChecklist>> {
            try {
                const actor = await account(), parsed = revisionResponseSchema.safeParse(input);
                if (!actor || actor.roleId !== ROLE_IDS.STUDENT) return denied;
                if (!parsed.success) return { success: false, message: "Check the response and reload the checklist before retrying." };
                const data = parsed.data;
                return await repository.withPaper(actor.userId, actor.roleId, data.paperId, async scope => {
                    const outcome = await scope.respond(data.itemId, data.expectedRevision, data.actionTaken);
                    return outcome === "saved" ? { success: true, message: "Action Taken saved.", data: await scope.read() } : { success: false,
                        message: outcome === "stale" ? "This response changed. Reload revisions before editing again." : "This revision cycle is read-only. Reload to view its history." };
                }) ?? denied;
            } catch { return { success: false, message: "The save could not be confirmed. Reload revisions and check before retrying." }; }
        },
    };
}
const service = createRevisionService(createRevisionRepository(db));
export const readRevisions = service.read;
export const respondToRevision = service.respond;
