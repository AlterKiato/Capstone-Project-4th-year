"use server";

import { getGuideAnswer } from "@/lib/services/chatbot-guide.service";

// The service validates direct POST inputs and verifies the active database role.
export async function getGuideAnswerAction(input: unknown) {
    return getGuideAnswer(input);
}
