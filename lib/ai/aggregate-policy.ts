import "server-only";
import {
    adminAggregateSchema, adviserAggregateSchema, minimizedAIDtoSchema,
    type MinimizedAIDto, type AdviserAggregate,
} from "@/lib/validations/ai-foundation";

function band(value: number) {
    if (value < 5) return undefined;
    if (value < 10) return "5-9" as const;
    if (value < 20) return "10-19" as const;
    if (value < 50) return "20-49" as const;
    if (value < 100) return "50-99" as const;
    if (value < 200) return "100-199" as const;
    if (value < 500) return "200-499" as const;
    if (value < 1000) return "500-999" as const;
    return "1000+" as const;
}
function nonempty(dto: MinimizedAIDto): MinimizedAIDto | null {
    return Object.keys(dto.metrics).length ? minimizedAIDtoSchema.parse(dto) : null;
}
export function minimizeAdminAggregate(input: unknown): MinimizedAIDto | null {
    const data = adminAggregateSchema.parse(input);
    if (data.totalPublishedPapers > data.approvedPapers || data.approvedPapers > data.totalResearchPapers)
        throw new Error("Invalid aggregate");
    const metrics: Extract<MinimizedAIDto, { feature: "admin" }>["metrics"] = {};
    for (const key of ["totalUsers", "totalGroups", "totalResearchPapers"] as const) {
        const value = band(data[key]);
        if (value) metrics[key] = value;
    }
    const published = band(data.totalPublishedPapers);
    if (published && data.approvedPapers - data.totalPublishedPapers >= 5 &&
        data.totalResearchPapers - data.totalPublishedPapers >= 5) metrics.totalPublishedPapers = published;
    return nonempty({ version: 1, feature: "admin", topicId: "admin-overview-v1", metrics });
}

type Cohort = AdviserAggregate["total"];
function enough(data: Cohort) { return data.versions >= 5 && data.contributors >= 5 && data.papers >= 5; }
export function minimizeAdviserAggregate(input: unknown): MinimizedAIDto | null {
    const data = adviserAggregateSchema.parse(input);
    for (const cohort of Object.values(data)) {
        if (cohort.contributors > cohort.versions || cohort.papers > cohort.versions ||
            cohort.versions > data.total.versions || cohort.contributors > data.total.contributors ||
            cohort.papers > data.total.papers) throw new Error("Invalid aggregate");
    }
    if (data.submitted.versions + data.notSubmitted.versions !== data.total.versions ||
        data.review.versions + data.notReview.versions !== data.total.versions ||
        data.submitted.versions + data.review.versions + data.neither.versions !== data.total.versions)
        throw new Error("Invalid aggregate");
    if (!enough(data.total)) return null;
    const metrics: Extract<MinimizedAIDto, { feature: "adviser" }>["metrics"] = {
        recordedSubmissionVersions: band(data.total.versions),
    };
    let submitted = enough(data.submitted) && enough(data.notSubmitted);
    let review = enough(data.review) && enough(data.notReview);
    if (submitted && review && !enough(data.neither)) { submitted = false; review = false; }
    if (submitted) metrics.recordedSubmittedVersions = band(data.submitted.versions);
    if (review) metrics.recordedUnderReviewVersions = band(data.review.versions);
    return nonempty({ version: 1, feature: "adviser", topicId: "adviser-workflow-overview-v1", metrics });
}
