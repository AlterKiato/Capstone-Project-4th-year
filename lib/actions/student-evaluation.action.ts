"use server";
import { getStudentEvaluation } from "@/lib/services/student-evaluation.service";

export async function getStudentEvaluationAction(input: unknown) {
    return getStudentEvaluation(input);
}
