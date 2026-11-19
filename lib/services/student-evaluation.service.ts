import "server-only";
import { getCurrentAccount } from "@/lib/auth/current-account";
import { ROLE_IDS } from "@/lib/auth/roles";
import { readStudentEvaluation } from "@/lib/repositories/student-evaluation.repository";
import { assessEvaluation, evaluationSnapshotSchema } from "@/lib/submission-evaluation";
import { studentEvaluationRequestSchema, type StudentEvaluationResult } from "@/lib/student-evaluation";

const unavailable = { success: false, message: "Evaluation unavailable. Reload this submission and try again." } as const;

export async function getStudentEvaluation(input: unknown): Promise<StudentEvaluationResult> {
    try {
        const actor = await getCurrentAccount();
        const parsed = studentEvaluationRequestSchema.safeParse(input);
        if (!actor || actor.roleId !== ROLE_IDS.STUDENT || !parsed.success) return unavailable;
        const rows = await readStudentEvaluation(actor.userId, parsed.data);
        const row = rows[0];
        if (!row) return unavailable;
        if (row.evaluationId === null) return { success: true, data: null };
        if (!row.finalizedAt || row.revision === null) return unavailable;
        const snapshot = evaluationSnapshotSchema.parse(row.snapshot);
        const assessment = assessEvaluation({ revision: row.revision, snapshot }, {
            assignmentRevision: row.revision,
            assessments: rows.map(item => ({ criterionKey: item.criterionKey, rating: item.rating,
                na: item.na, reason: item.reason, comment: item.comment })),
        });
        if (assessment.earned !== row.earned || assessment.possible !== row.possible) return unavailable;
        return { success: true, data: {
            id: row.evaluationId, submissionId: row.submissionId, feedbackId: row.feedbackId, version: row.version,
            finalizedAt: row.finalizedAt.toISOString(), templateName: snapshot.name, templateRevision: snapshot.sourceRevision,
            scale: snapshot.scale, earned: assessment.earned, possible: assessment.possible,
            criteria: snapshot.criteria.map((criterion, index) => ({ name: criterion.name, description: criterion.description,
                rating: assessment.items[index].rating, na: assessment.items[index].na,
                reason: assessment.items[index].reason, comment: assessment.items[index].comment })),
        } };
    } catch { return unavailable; }
}
