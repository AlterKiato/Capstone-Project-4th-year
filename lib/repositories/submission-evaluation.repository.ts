import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { activityLogs, submissions, researchPapers, researchGroups, evaluationTemplates, evaluationTemplateCriteria,
    submissionEvaluationAssignments as assignments, submissionEvaluations, submissionEvaluationItems } from "@/db/schema";
import { currentMainAdviserPredicate, lockCurrentMainAdviser } from "./research-supervision.repository";
import { SUBMISSION_LOCK_NAMESPACE } from "@/lib/constants/submission-lock";
import { assessEvaluation, evaluationSnapshotSchema, type EvaluationAssignment } from "@/lib/submission-evaluation";
import type { assignmentRequestSchema } from "@/lib/submission-evaluation";
import type { z } from "zod";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function readLockedEvaluationAssignment(tx: Tx, submissionId: number) {
    const [row] = await tx.select().from(assignments).where(eq(assignments.submissionId, submissionId))
        .orderBy(desc(assignments.revision)).limit(1);
    return { row, assignment: { revision: row?.revision ?? 0,
        snapshot: row?.snapshot ? evaluationSnapshotSchema.parse(row.snapshot) : null } satisfies EvaluationAssignment };
}

/** Caller holds paper advisory -> Main account/singleton -> exact submission UPDATE locks. */
export async function prepareOfficialEvaluation(tx: Tx, submissionId: number, input: unknown) {
    const { row, assignment } = await readLockedEvaluationAssignment(tx, submissionId);
    // Legacy callers may omit evaluation only when this submission has never had an assignment.
    const result = assessEvaluation(assignment, input ?? { assignmentRevision: 0, assessments: [] });
    if (!row || !assignment.snapshot) return null;
    const [existing] = await tx.select({ id: submissionEvaluations.id }).from(submissionEvaluations)
        .where(eq(submissionEvaluations.assignmentId, row.id)).limit(1);
    if (existing) throw new Error("This evaluation has already been finalized.");
    return { assignmentId: row.id, ...result };
}

export async function insertOfficialEvaluation(tx: Tx, feedbackId: number, prepared: Awaited<ReturnType<typeof prepareOfficialEvaluation>>) {
    if (!prepared) return;
    const [saved] = await tx.insert(submissionEvaluations).values({ assignmentId: prepared.assignmentId, feedbackId,
        earned: prepared.earned, possible: prepared.possible }).returning({ id: submissionEvaluations.id });
    if (!saved) throw new Error("Evaluation write unconfirmed.");
    await tx.insert(submissionEvaluationItems).values(prepared.items.map(item => ({ ...item, evaluationId: saved.id })));
}

/** Fresh scope resolution followed by the established review lock order, including reads. */
export async function withMainEvaluation<T>(actorId: number, submissionId: number, work: (tx: Tx) => Promise<T>) {
    const [scope] = await db.select({ paperId: submissions.paperId }).from(submissions)
        .innerJoin(researchPapers, eq(researchPapers.id, submissions.paperId))
        .innerJoin(researchGroups, eq(researchGroups.id, researchPapers.groupId))
        .where(and(eq(submissions.id, submissionId), currentMainAdviserPredicate(actorId))).limit(1);
    if (!scope) return null;
    return db.transaction(async tx => {
        await tx.execute(sql`set local lock_timeout = '3s'`);
        await tx.execute(sql`set local statement_timeout = '5s'`);
        await tx.execute(sql`select pg_advisory_xact_lock(${SUBMISSION_LOCK_NAMESPACE}, ${scope.paperId})`);
        if (!await lockCurrentMainAdviser(tx, actorId)) return null;
        const [current] = await tx.select({ paperId: submissions.paperId, status: submissions.status }).from(submissions)
            .where(eq(submissions.id, submissionId)).for("update");
        if (!current || current.paperId !== scope.paperId || current.status !== "Under Review") return null;
        return work(tx);
    });
}

export async function changeEvaluationAssignment(actorId: number, request: z.infer<typeof assignmentRequestSchema>) {
    return withMainEvaluation(actorId, request.submissionId, async tx => {
        const current = await readLockedEvaluationAssignment(tx, request.submissionId);
        if (current.assignment.revision !== request.expectedRevision) throw new Error("Assignment changed. Reload before replacing it.");
        let snapshot: EvaluationAssignment["snapshot"] = null;
        if (request.template) {
            const [template] = await tx.select().from(evaluationTemplates).where(and(eq(evaluationTemplates.id, request.template.id),
                eq(evaluationTemplates.ownerId, actorId))).for("update");
            if (!template || template.archivedAt || template.revision !== request.template.revision) throw new Error("Template unavailable or changed. Choose an active owned template again.");
            const criteria = await tx.select().from(evaluationTemplateCriteria).where(eq(evaluationTemplateCriteria.templateId, template.id)).orderBy(asc(evaluationTemplateCriteria.position));
            snapshot = evaluationSnapshotSchema.parse({ name: template.name, scale: template.scale,
                sourceTemplateId: template.id, sourceRevision: template.revision, sourceOwnerId: actorId,
                criteria: criteria.map(({ key, position, name, description, allowsNa }) => ({ key, position, name, description, allowsNa })) });
        } else if (!current.assignment.snapshot) throw new Error("No template is currently assigned.");
        const revision = current.assignment.revision + 1;
        await tx.insert(assignments).values({ submissionId: request.submissionId, revision, assignedBy: actorId, snapshot });
        await tx.insert(activityLogs).values({ userId: actorId, action: snapshot ? "Evaluation Template Assigned" : "Evaluation Template Cleared",
            description: `Submission ${request.submissionId}; assignment revision ${revision}.` });
        return { revision, snapshot } satisfies EvaluationAssignment;
    });
}
