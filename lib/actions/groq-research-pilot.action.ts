"use server";
import { runGroqResearchPilot } from "@/lib/services/groq-research-pilot.service";

// Separate entry point; the synthetic assistant never falls through to this action.
export async function runGroqResearchPilotAction(input: unknown) { return runGroqResearchPilot(input); }
