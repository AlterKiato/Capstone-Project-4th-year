import { decodeFeedback, encodeFeedback, validateFeedback } from "./feedback-content";
import type { RecommendationImport } from "@/types/co-adviser";

/** Recommendations remain literal text; only the existing official draft is decoded. */
export function appendRecommendation(value: string, source: RecommendationImport): { success: true; value: string } | { success: false; message: string } {
    const document = decodeFeedback(value);
    if (!document) return { success: false, message: "The existing draft formatting is unavailable. Your draft has not changed." };
    const next = encodeFeedback({ version: 1, blocks: [...document.blocks,
        { type: "paragraph", content: [] },
        { type: "paragraph", content: [{ text: `— Co-Adviser recommendation: ${source.author} —` }] },
        ...source.text.split(/\r?\n/).map(text => ({ type: "paragraph" as const, content: [{ text }] })),
    ] });
    const invalid = validateFeedback(next);
    return invalid ? { success: false, message: `${invalid} Your draft has not changed. Add a shorter excerpt manually.` } : { success: true, value: next };
}
