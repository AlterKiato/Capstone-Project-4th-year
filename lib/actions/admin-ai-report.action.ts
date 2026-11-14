"use server";

import { getAdminInterpretation, getAdminInterpretationAvailability } from "@/lib/services/ai-interpretation.service";

// The service derives the active Admin, consent and minimized totals on the server.
export async function getAdminInterpretationAction(input: unknown) { return getAdminInterpretation(input); }
export async function getAdminInterpretationAvailabilityAction() { return getAdminInterpretationAvailability(); }
