import { z } from "zod";

export const adminAIRequestSchema = z.strictObject({ reportId: z.literal("admin-overview-v1") });
export const adviserTopicIds = [
    "adviser-workflow-overview-v1", "adviser-start-review-v1",
    "adviser-record-decision-v1", "adviser-revision-history-v1",
] as const;
export const adviserAIRequestSchema = z.strictObject({ topicId: z.enum(adviserTopicIds) });
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const adminAggregateSchema = z.strictObject({
    totalUsers: count, totalGroups: count, totalResearchPapers: count,
    totalPublishedPapers: count, approvedPapers: count,
});
const cohort = z.strictObject({ versions: count, contributors: count, papers: count });
export const adviserAggregateSchema = z.strictObject({
    total: cohort, submitted: cohort, review: cohort,
    notSubmitted: cohort, notReview: cohort, neither: cohort,
});
export const bandSchema = z.enum(["5-9", "10-19", "20-49", "50-99", "100-199", "200-499", "500-999", "1000+"]);
export const minimizedAIDtoSchema = z.discriminatedUnion("feature", [
    z.strictObject({
        version: z.literal(1), feature: z.literal("admin"), topicId: z.literal("admin-overview-v1"),
        metrics: z.strictObject({
            totalUsers: bandSchema.optional(), totalGroups: bandSchema.optional(),
            totalResearchPapers: bandSchema.optional(), totalPublishedPapers: bandSchema.optional(),
        }),
    }),
    z.strictObject({
        version: z.literal(1), feature: z.literal("adviser"), topicId: z.literal("adviser-workflow-overview-v1"),
        metrics: z.strictObject({
            recordedSubmissionVersions: bandSchema.optional(),
            recordedSubmittedVersions: bandSchema.optional(), recordedUnderReviewVersions: bandSchema.optional(),
        }),
    }),
]);
export type AdminAggregate = z.infer<typeof adminAggregateSchema>;
export type AdviserAggregate = z.infer<typeof adviserAggregateSchema>;
export type MinimizedAIDto = z.infer<typeof minimizedAIDtoSchema>;
export type AdviserAITopic = (typeof adviserTopicIds)[number];
