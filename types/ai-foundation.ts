import type { MinimizedAIDto } from "@/lib/validations/ai-foundation";

type AdminBand = NonNullable<Extract<MinimizedAIDto, { feature: "admin" }>["metrics"]["totalUsers"]>;

export interface LocalAIResult {
    success: boolean;
    mode: "static" | "unavailable" | "unsupported";
    message: string;
    guidance?: string;
}

export type AdminAIResult = LocalAIResult | {
    success: false;
    mode: "denied";
    message: string;
} | {
    success: true;
    mode: "generated";
    message: string;
    output: {
        version: 1;
        overview: string;
        explanations: { metricId: string; band: AdminBand; text: string }[];
    };
};
