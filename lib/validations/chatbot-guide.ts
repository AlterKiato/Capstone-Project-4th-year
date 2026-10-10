import { z } from "zod";
import { GUIDE_TOPIC_IDS } from "@/lib/constants/chatbot-guide";

// Direct action requests accept only an exact predefined topic ID.
export const guideRequestSchema = z.strictObject({
    topicId: z.enum(GUIDE_TOPIC_IDS),
});
