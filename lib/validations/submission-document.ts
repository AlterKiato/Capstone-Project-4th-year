import { z } from "zod";

// PostgreSQL IDs are positive signed 32-bit integers; do not coerce client input.
export const submissionDocumentIdSchema = z.number().int().positive().max(2147483647);

// Fixed purposes select server-owned policy; clients cannot supply a TTL.
export const submissionDocumentPurposeSchema = z.enum(["download", "adviser-review"]);
export type SubmissionDocumentPurpose = z.infer<typeof submissionDocumentPurposeSchema>;

export function isSubmissionDocumentPath(path: unknown, paperId: number, version: string): path is string {
    if (typeof path !== "string" || !Number.isSafeInteger(paperId) || paperId <= 0 ||
        typeof version !== "string" || !/^v[1-9]\d*$/.test(version)) return false;
    const prefix = `research/${paperId}/${version}/`;
    return path.startsWith(prefix) && /^[a-zA-Z0-9_-]+\.pdf$/.test(path.slice(prefix.length));
}
