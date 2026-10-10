"use server";

import { getLocalAdminAssistance, getLocalAdviserAssistance } from "@/lib/services/ai-foundation.service";

export async function getLocalAdminAssistanceAction(input: unknown) { return getLocalAdminAssistance(input); }
export async function getLocalAdviserAssistanceAction(input: unknown) { return getLocalAdviserAssistance(input); }
