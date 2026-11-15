"use server";
import { getDeveloperEvaluationAvailability, runDeveloperEvaluation } from "@/lib/services/developer-ai-evaluation.service";

export async function getDeveloperEvaluationAvailabilityAction(input: unknown) { return getDeveloperEvaluationAvailability(input); }
export async function runDeveloperEvaluationAction(input: unknown) { return runDeveloperEvaluation(input); }
