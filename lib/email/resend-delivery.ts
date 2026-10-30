import "server-only";
import { z } from "zod";
import { verificationEmailSchema, verificationTokenSchema } from "@/lib/validations/email-verification";
import type { VerificationDelivery } from "./verification-delivery";

const ENDPOINT = "https://api.resend.com/emails";
const TIMEOUT_MS = 5000;
const MAX_RESPONSE_BYTES = 4096;
const configurationSchema = z.strictObject({
    apiKey: z.string().max(512).regex(/^re_[A-Za-z0-9_-]+$/),
    senderEmail: verificationEmailSchema,
    verificationOrigin: z.string().min(1).max(2048),
});
export type ResendVerificationConfiguration = z.infer<typeof configurationSchema>;
export type ResendVerificationResult =
    | { status: "accepted" }
    | { status: "failed"; reason: "configuration" | "input" | "provider-rejected" }
    | { status: "uncertain"; reason: "timeout" | "network" | "provider" | "response" };
type FailureReason = Exclude<ResendVerificationResult, { status: "accepted" }>["reason"] | "disabled";
type Schedule = (milliseconds: number, callback: () => void) => () => void;
const scheduleTimer: Schedule = (milliseconds, callback) => {
    const timer = setTimeout(callback, milliseconds);
    return () => clearTimeout(timer);
};

export class ResendVerificationDeliveryError extends Error {
    constructor(readonly outcome: "disabled" | "failed" | "uncertain", readonly reason: FailureReason) {
        super("Email verification delivery is unavailable.");
        this.name = "ResendVerificationDeliveryError";
    }
}

function verificationPage(origin: string): URL | null {
    try {
        const parsed = new URL(origin);
        if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port ||
            parsed.pathname !== "/" || parsed.search || parsed.hash ||
            (origin !== parsed.origin && origin !== `${parsed.origin}/`)) return null;
        return new URL("/verify-email", parsed.origin);
    } catch { return null; }
}

async function readAcceptance(response: Response, signal: AbortSignal): Promise<boolean> {
    if (!response.body) return false;
    const reader = response.body.getReader();
    const cancel = () => { void reader.cancel().catch(() => {}); };
    signal.addEventListener("abort", cancel, { once: true });
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
        while (!signal.aborted) {
            const item = await reader.read();
            if (item.done) {
                const body: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
                return z.object({ id: z.uuid() }).safeParse(body).success;
            }
            bytes += item.value.byteLength;
            if (bytes > MAX_RESPONSE_BYTES) return false;
            chunks.push(item.value);
        }
        return false;
    } finally {
        signal.removeEventListener("abort", cancel);
        cancel();
        reader.releaseLock();
    }
}

/** Internal transport primitive, not activation. No ambient fetch, environment loading or retries. */
export function createResendVerificationTransport(transport: typeof fetch, schedule: Schedule = scheduleTimer) {
    return async (configuration: unknown, email: unknown, token: unknown): Promise<ResendVerificationResult> => {
        const config = configurationSchema.safeParse(configuration);
        if (!config.success || typeof transport !== "function") return { status: "failed", reason: "configuration" };
        const link = verificationPage(config.data.verificationOrigin);
        if (!link) return { status: "failed", reason: "configuration" };
        const recipient = verificationEmailSchema.safeParse(email);
        const verificationToken = verificationTokenSchema.safeParse(token);
        if (!recipient.success || !verificationToken.success) return { status: "failed", reason: "input" };
        link.hash = new URLSearchParams({ token: verificationToken.data }).toString();
        const controller = new AbortController();
        let cancelTimer = () => {};
        let response: Response | undefined;
        let timedOut = false;
        try {
            const deadline = new Promise<ResendVerificationResult>(resolve => {
                cancelTimer = schedule(TIMEOUT_MS, () => {
                    timedOut = true;
                    resolve({ status: "uncertain", reason: "timeout" });
                    controller.abort();
                });
            });
            const attempt = async (): Promise<ResendVerificationResult> => {
                try {
                    if (controller.signal.aborted) return { status: "uncertain", reason: "timeout" };
                    response = await transport(ENDPOINT, {
                        method: "POST", redirect: "error", cache: "no-store", credentials: "omit",
                        signal: controller.signal,
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.data.apiKey}` },
                        body: JSON.stringify({
                            from: `ThesiSHS AI <${config.data.senderEmail}>`, to: [recipient.data],
                            subject: "Verify your ThesiSHS AI email",
                            text: `Confirm your email by opening this link and explicitly submitting the confirmation. The link expires in 60 minutes.\n${link.href}`,
                        }),
                    });
                    if (response.redirected || (response.url && response.url !== ENDPOINT)) return { status: "uncertain", reason: "response" };
                    if (response.status >= 400 && response.status < 500 && response.status !== 408)
                        return { status: "failed", reason: "provider-rejected" };
                    if (response.status !== 200) return { status: "uncertain", reason: "provider" };
                    if (response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
                        return { status: "uncertain", reason: "response" };
                    try {
                        return await readAcceptance(response, controller.signal)
                            ? { status: "accepted" } : { status: "uncertain", reason: "response" };
                    } catch { return { status: "uncertain", reason: timedOut ? "timeout" : "response" }; }
                } catch { return { status: "uncertain", reason: timedOut ? "timeout" : "network" }; }
            };
            return await Promise.race([attempt(), deadline]);
        } catch { return { status: "failed", reason: "configuration" }; }
        finally {
            cancelTimer();
            controller.abort();
            if (response?.body && !response.body.locked) void response.body.cancel().catch(() => {});
        }
    };
}

/** Hard-disabled in every environment. Future environment-scoped activation needs separate approval/code. */
export function createResendVerificationDelivery(
    configuration: ResendVerificationConfiguration,
    transport: typeof fetch,
): VerificationDelivery {
    const send = createResendVerificationTransport(transport);
    function assertAvailable(): void {
        throw new ResendVerificationDeliveryError("disabled", "disabled");
    }
    return {
        assertAvailable,
        async sendVerificationLink(email, token) {
            assertAvailable();
            const result = await send(configuration, email, token);
            if (result.status !== "accepted") throw new ResendVerificationDeliveryError(result.status, result.reason);
        },
    };
}
