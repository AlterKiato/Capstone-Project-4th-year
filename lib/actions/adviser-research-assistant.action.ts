"use server";
import { analyzeResearchDemo, getResearchDemoAvailability } from "@/lib/services/adviser-research-assistant.service";

export async function getResearchDemoAvailabilityAction(input: unknown) { return getResearchDemoAvailability(input); }
export async function analyzeResearchDemoAction(input: unknown) { return analyzeResearchDemo(input); }
