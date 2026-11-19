export type TemplateScale = { version: 1; levels: { points: number; label: string; description: string }[] };
export type TemplateCriterion = { key: string; position: number; name: string; description: string; allowsNa: boolean };
export type EvaluationTemplateDraft = { name: string; scale: TemplateScale; criteria: TemplateCriterion[] };
export type EvaluationTemplate = EvaluationTemplateDraft & {
    id: number; revision: number; archivedAt: string | null; createdAt: string; updatedAt: string;
};
export type TemplateResult<T = never> = {
    success: boolean; message: string; data?: T; kind?: "denied" | "validation" | "stale" | "unavailable";
};
export const TEMPLATE_LIMITS = { criteria: 30, name: 200, description: 2000, label: 80, scaleDescription: 300 } as const;
export const TEMPLATE_HREF = "/dashboard/adviser/submissions?view=templates";
export function isTemplateView(view: string | string[] | undefined) { return view === "templates"; }
export function defaultTemplateScale(): TemplateScale {
    return { version: 1, levels: ["Unsatisfactory", "Needs Improvement", "Satisfactory", "Excellent"]
        .map((label, index) => ({ points: index + 1, label, description: "" })) };
}
