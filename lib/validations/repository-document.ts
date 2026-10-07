import { z } from "zod";
import { submissionDocumentIdSchema } from "@/lib/validations/submission-document";

export const repositoryDocumentRequestSchema = z.object({
    paperId: submissionDocumentIdSchema,
    mode: z.enum(["view", "download"]),
}).strict();

export type RepositoryDocumentMode = z.infer<typeof repositoryDocumentRequestSchema>["mode"];
