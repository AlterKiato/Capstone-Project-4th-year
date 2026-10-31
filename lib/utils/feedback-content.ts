import { z } from "zod";

// Explicit reserved namespace: legacy Markdown/HTML-looking comments remain literal text.
export const FEEDBACK_PREFIX = "\u001eTHESISHS_FEEDBACK:1\n";
const namespace = "\u001eTHESISHS_FEEDBACK:";
export const FEEDBACK_MAX_TEXT = 5000;
export const FEEDBACK_MAX_ENCODED = 524288;
const runSchema = z.strictObject({ text: z.string().max(FEEDBACK_MAX_ENCODED), bold: z.boolean().optional(), italic: z.boolean().optional(), underline: z.boolean().optional() });
const runsSchema = z.array(runSchema).max(FEEDBACK_MAX_TEXT);
const documentSchema = z.strictObject({ version: z.literal(1), blocks: z.array(z.discriminatedUnion("type", [
    z.strictObject({ type: z.literal("paragraph"), content: runsSchema }),
    z.strictObject({ type: z.enum(["bulletList", "numberList"]), items: z.array(runsSchema).min(1).max(256) }),
])).max(256) });
export type FeedbackRun = z.infer<typeof runSchema>;
export type FeedbackDocument = z.infer<typeof documentSchema>;
export function feedbackDocumentText(document: FeedbackDocument): string {
    return document.blocks.map(block => block.type === "paragraph" ? block.content.map(run => run.text).join("") :
        block.items.map(item => item.map(run => run.text).join("")).join("\n")).join("\n");
}

export function decodeFeedback(value: string): FeedbackDocument | null {
    if (!value.startsWith(namespace)) return { version: 1, blocks: value.split(/\r?\n/).map(text => ({ type: "paragraph", content: [{ text }] })) };
    if (!value.startsWith(FEEDBACK_PREFIX) || value.length > FEEDBACK_MAX_ENCODED) return null;
    try {
        const result = documentSchema.safeParse(JSON.parse(value.slice(FEEDBACK_PREFIX.length)));
        if (!result.success) return null;
        const doc = result.data;
        const runs = doc.blocks.flatMap(block => block.type === "paragraph" ? block.content : block.items.flat());
        if (runs.length > 10000) return null;
        return doc;
    } catch { return null; }
}

export function feedbackPlainText(value: string): string {
    if (!value.startsWith(namespace)) return value;
    const doc = decodeFeedback(value);
    return doc ? feedbackDocumentText(doc) : "Feedback formatting is unavailable.";
}

export function encodeFeedback(doc: FeedbackDocument): string {
    const plain = feedbackDocumentText(doc);
    if (doc.blocks.every(block => block.type === "paragraph" && block.content.every(run => !run.bold && !run.italic && !run.underline)) && !plain.startsWith(namespace)) return plain;
    return FEEDBACK_PREFIX + JSON.stringify(doc);
}

/** Shared browser/action/service rules. UTF-16 .length and trim match the existing Zod contract. */
export function validateFeedback(value: string): string | null {
    if (value.length > FEEDBACK_MAX_ENCODED) return "Feedback formatting is too large.";
    const doc = value.startsWith(namespace) ? decodeFeedback(value) : null;
    if (value.startsWith(namespace) && !doc) return "Feedback formatting is invalid or unsupported.";
    const text = (doc ? feedbackDocumentText(doc) : value).trim();
    if (!text) return "Feedback comments are required.";
    if (text.length > FEEDBACK_MAX_TEXT) return "Feedback comments must not exceed 5000 characters.";
    return null;
}

export const feedbackCommentsSchema = z.string().superRefine((value, context) => {
    const message = validateFeedback(value);
    if (message) context.addIssue({ code: "custom", message });
}).transform(value => {
    if (value.startsWith(namespace)) return FEEDBACK_PREFIX + JSON.stringify(decodeFeedback(value));
    const text = value.trim();
    // Trimming legacy input must never turn literal content into an unvalidated envelope.
    return text.startsWith(namespace) ? FEEDBACK_PREFIX + JSON.stringify({ version: 1, blocks: [{ type: "paragraph", content: [{ text }] }] }) : text;
});
