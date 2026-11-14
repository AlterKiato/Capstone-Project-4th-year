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
        explanations: { metricId: string; text: string }[];
    };
};
