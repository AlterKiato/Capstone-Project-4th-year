import "server-only";
import { getCurrentAccount } from "@/lib/auth/current-account";
import { db } from "@/lib/db";
import { createResearchProgressRepository } from "@/lib/repositories/research-progress.repository";
import { progressMutationSchema, progressPaperSchema } from "@/lib/validations/research-progress";
import { manilaToday, type ResearchProgress } from "@/lib/research-progress";
import { SUBMISSION_STATUS } from "@/lib/constants/submission-status";

type Result<T = never> = { success: boolean; message: string; data?: T };
const denied = { success: false, message: "Research progress is unavailable for this account or paper." };

export function createResearchProgressService(repository: ReturnType<typeof createResearchProgressRepository>, account = getCurrentAccount) {
    return {
        async read(input: unknown): Promise<Result<ResearchProgress>> {
            try {
                const actor = await account(), parsed = progressPaperSchema.safeParse(input);
                if (!actor || !parsed.success) return denied;
                return await repository.withPaper(actor.userId, actor.roleId, parsed.data.paperId, async scope => {
                    const rows = await scope.list();
                    return { success: true, message: "Research progress loaded.", data: { canManage: scope.canManage, today: manilaToday(), submissions: rows.submissions,
                        milestones: rows.milestones.map(row => ({ id: row.id, paperId: row.paperId, title: row.title, dueDate: row.dueDate, revision: row.revision,
                            submissionId: row.submissionId, verifiedBy: row.verifiedBy, verifiedAt: row.verifiedAt?.toISOString() ?? null,
                            evidence: rows.submissions.find(evidence => evidence.id === row.submissionId) ?? null })) } };
                }) ?? denied;
            } catch { return { success: false, message: "Research progress could not be loaded. Reload to try again." }; }
        },
        async mutate(input: unknown): Promise<Result> {
            try {
                const actor = await account(), parsed = progressMutationSchema.safeParse(input);
                if (!actor) return denied;
                if (!parsed.success) return { success: false, message: "Check the milestone title, deadline and selected version." };
                const data = parsed.data;
                return await repository.withPaper(actor.userId, actor.roleId, data.paperId, async scope => {
                    if (data.operation === "link" ? scope.canManage : !scope.canManage) return denied;
                    if (data.operation === "create") {
                        const row = await scope.create(data.title, data.dueDate);
                        await scope.log("Research Milestone Created", row);
                    } else {
                        const row = await scope.milestone(data.milestoneId);
                        if (!row) return denied;
                        if (row.revision !== data.expectedRevision) return { success: false, message: "This milestone changed. Reload progress before trying again." };
                        let patch;
                        if (data.operation === "edit") {
                            if (row.title === data.title && row.dueDate === data.dueDate) return { success: true, message: "Milestone is unchanged." };
                            patch = { title: data.title, dueDate: data.dueDate, verifiedBy: null, verifiedAt: null };
                        } else if (data.operation === "link") {
                            if (!await scope.evidence(data.submissionId)) return denied;
                            if (row.submissionId === data.submissionId) return { success: true, message: "This version is already linked." };
                            patch = { submissionId: data.submissionId, verifiedBy: null, verifiedAt: null };
                        } else {
                            const evidence = row.submissionId === null ? null : await scope.evidence(row.submissionId);
                            if (evidence?.status !== SUBMISSION_STATUS.APPROVED) return { success: false, message: "Link an Approved submission before verifying completion." };
                            if (row.verifiedAt) return { success: true, message: "This milestone is already completed." };
                            patch = { verifiedBy: actor.userId, verifiedAt: new Date() };
                        }
                        const saved = await scope.patch(row, patch);
                        await scope.log(`Research Milestone ${data.operation === "edit" ? "Edited" : data.operation === "link" ? "Evidence Linked" : "Verified"}`, saved, row);
                    }
                    return { success: true, message: "Research progress saved." };
                }) ?? denied;
            } catch { return { success: false, message: "The change could not be confirmed. Reload progress and check it before retrying." }; }
        },
    };
}

const service = createResearchProgressService(createResearchProgressRepository(db));
export const readResearchProgress = service.read;
export const mutateResearchProgress = service.mutate;
