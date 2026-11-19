"use server";
import { submissionEvaluation } from "@/lib/services/submission-evaluation.service";
export async function readSubmissionEvaluationAction(input: unknown) { return submissionEvaluation(input); }
export async function changeSubmissionEvaluationAction(input: unknown) { return submissionEvaluation(input, true); }
