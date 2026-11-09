import "server-only";
import { getCurrentAccount } from "@/lib/auth/current-account";
import { getCurrentMainAdviser, getMainAdviserNotificationRecipient } from "@/lib/auth/main-adviser";
import { readCoAssignment, readCoAssignments, readMainDelegationPanel, readRecommendationForDraft, withCoRecommendationScope, withMainDelegationScope } from "@/lib/repositories/co-adviser.repository";
import { sendNotification } from "@/lib/services/notification.service";
import { cancelDelegationSchema, delegatedDocumentSchema, delegateReviewSchema, isDelegatedReviewEligible, recommendationSchema, supervisionId } from "@/lib/validations/co-adviser";
import type { CoAssignment, CoWorkspace, DelegationResult, MainDelegationPanel, RecommendationImport } from "@/types/co-adviser";

const denied = { success: false, message: "Current review authority could not be verified. Reload or contact your Admin." } as const;
const changed = { success: false, message: "This assignment or submission changed. Reload the assignments before continuing." } as const;
const unavailable = { success: false, message: "The request could not be confirmed. Reload the assignments to check their state before retrying." } as const;
const name = (row: { firstName: string; lastName: string }) => `${row.firstName} ${row.lastName}`.trim();
async function notify(userId: number | null, title: string, message: string) {
    if (userId === null) return;
    try { await sendNotification(userId, title, message); } catch { /* Committed work is independent of best-effort delivery. */ }
}

export async function getMainDelegationPanel(submissionId: unknown): Promise<DelegationResult<MainDelegationPanel>> {
    const id = supervisionId.safeParse(submissionId), actor = await getCurrentMainAdviser();
    if (!id.success || !actor) return denied;
    try {
        const data = await readMainDelegationPanel(actor.userId, id.data);
        if (!data || !await getCurrentMainAdviser(actor.userId)) return denied;
        return { success: true, message: "Assignments loaded.", data: {
            eligible: isDelegatedReviewEligible(data.submission.status),
            advisers: data.advisers.map(row => ({ id: row.id, name: name(row), email: row.email })),
            assignments: data.assignments.map(row => ({ id: row.id, coAdviserId: row.coAdviserId, name: name(row), state: row.state,
                recommendation: row.state === "completed" ? row.recommendation : null,
                createdAt: row.createdAt.toISOString(), completedAt: row.completedAt?.toISOString() ?? null,
                closedAt: row.closedAt?.toISOString() ?? null, closureReason: row.closureReason })),
        } };
    } catch { return unavailable; }
}

export async function delegateCoAdvisers(input: unknown): Promise<DelegationResult> {
    const parsed = delegateReviewSchema.safeParse(input), actor = await getCurrentMainAdviser();
    if (!parsed.success) return { success: false, message: "Select one to twenty distinct eligible Advisers for this submission version." };
    if (!actor) return denied;
    const { submissionId, coAdviserIds } = parsed.data;
    try {
        const result = await withMainDelegationScope(actor.userId, submissionId, coAdviserIds, async scope => {
            if (!isDelegatedReviewEligible(scope.submission.status)) return changed;
            if (coAdviserIds.some(id => id === actor.userId || !scope.accounts.some(account => account.id === id && account.roleId === 2 && account.isActive)))
                return { success: false, message: "An Adviser is no longer eligible. Reload and select active Advisers other than the current Main." };
            if (scope.assignments.some(row => row.state === "open" && coAdviserIds.includes(row.coAdviserId)))
                return { success: false, message: "An open assignment already exists for a selected Adviser. Reload to review it." };
            for (const id of coAdviserIds) await scope.create(id);
            return { success: true, message: "Co-Adviser review assigned for this version." };
        });
        if (!result) return denied;
        if (result.success) for (const id of coAdviserIds) await notify(id, "Co-Adviser Review Assigned", "A submission version has been delegated to you. Open Research Submissions to review it.");
        return result;
    } catch { return unavailable; }
}

export async function cancelCoAdviserAssignment(input: unknown): Promise<DelegationResult> {
    const parsed = cancelDelegationSchema.safeParse(input), actor = await getCurrentMainAdviser();
    if (!parsed.success) return { success: false, message: "Confirm the assignment cancellation before continuing." };
    if (!actor) return denied;
    try {
        return await withMainDelegationScope(actor.userId, parsed.data.submissionId, [], async scope => {
            const assignment = scope.assignments.find(row => row.id === parsed.data.assignmentId);
            if (!assignment || assignment.state !== "open") return changed;
            await scope.cancel(assignment.id);
            return { success: true, message: "Assignment cancelled. New delegated PDF access is closed." };
        }) ?? denied;
    } catch { return unavailable; }
}

export async function submitCoAdviserRecommendation(input: unknown): Promise<DelegationResult> {
    const parsed = recommendationSchema.safeParse(input), actor = await getCurrentAccount();
    if (!parsed.success) return { success: false, message: "Enter a plain-text recommendation of 1 to 20,000 characters, without control characters." };
    if (!actor || actor.roleId !== 2) return denied;
    try {
        const result = await withCoRecommendationScope(actor.userId, parsed.data.submissionId, parsed.data.assignmentId, async scope => {
            if (!isDelegatedReviewEligible(scope.submission.status) || scope.assignment.state !== "open") return changed;
            await scope.complete(parsed.data.recommendation);
            return { success: true, message: "Private recommendation submitted. This assignment is complete and cannot be edited." };
        });
        if (!result) return denied;
        if (result.success) await notify(await getMainAdviserNotificationRecipient(), "Co-Adviser Recommendation Completed", "A private recommendation is available in the Main Adviser submission review workspace.");
        return result;
    } catch { return unavailable; }
}

export async function getCoAdviserWorkspace(): Promise<DelegationResult<CoWorkspace>> {
    const actor = await getCurrentAccount();
    if (!actor || actor.roleId !== 2 || await getCurrentMainAdviser(actor.userId)) return denied;
    try {
        const rows = await readCoAssignments(actor.userId);
        const current = await getCurrentAccount();
        if (!current || current.userId !== actor.userId || current.roleId !== 2 || await getCurrentMainAdviser(actor.userId)) return denied;
        return { success: true, message: "Assignments loaded.", data: { email: current.email, assignments: rows.map(coAssignment) } };
    } catch { return unavailable; }
}

function coAssignment(row: Awaited<ReturnType<typeof readCoAssignments>>[number]): CoAssignment {
    return { id: row.id, submissionId: row.submissionId, title: row.title, groupId: row.groupId, version: row.version, state: row.state,
        recommendation: row.state === "open" ? null : row.recommendation,
        reviewAvailable: row.state === "open" && isDelegatedReviewEligible(row.submissionStatus),
        createdAt: row.createdAt.toISOString(), completedAt: row.completedAt?.toISOString() ?? null, closedAt: row.closedAt?.toISOString() ?? null };
}

export async function getCoAdviserAssignment(input: unknown): Promise<DelegationResult<{ email: string; assignment: CoAssignment }>> {
    const parsed = delegatedDocumentSchema.safeParse(input), actor = await getCurrentAccount();
    if (!parsed.success || !actor || actor.roleId !== 2 || await getCurrentMainAdviser(actor.userId)) return denied;
    try {
        const row = await readCoAssignment(actor.userId, parsed.data.assignmentId, parsed.data.submissionId);
        const current = await getCurrentAccount();
        if (!row || !current || current.userId !== actor.userId || current.roleId !== 2 || await getCurrentMainAdviser(actor.userId)) return denied;
        return { success: true, message: "Assignment loaded.", data: { email: current.email, assignment: coAssignment(row) } };
    } catch { return unavailable; }
}

export async function getRecommendationForOfficialDraft(input: unknown): Promise<DelegationResult<RecommendationImport>> {
    const parsed = delegatedDocumentSchema.safeParse(input), actor = await getCurrentMainAdviser();
    if (!parsed.success || !actor) return denied;
    try {
        const row = await readRecommendationForDraft(actor.userId, parsed.data.assignmentId, parsed.data.submissionId);
        if (!row?.recommendation || !await getCurrentMainAdviser(actor.userId)) return changed;
        return { success: true, message: "Recommendation ready for your draft.", data: { ...parsed.data, text: row.recommendation, author: name(row) } };
    } catch { return unavailable; }
}
