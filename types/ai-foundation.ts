export interface LocalAIResult {
    success: boolean;
    mode: "static" | "unavailable" | "unsupported";
    message: string;
    guidance?: string;
}
