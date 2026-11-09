// Adviser review requests 1800 seconds. This request-start threshold includes latency;
// it is not provider expiry metadata and does not revoke an issued capability.
export const ADVISER_REVIEW_PDF_RENEWAL_SECONDS = 1680;
export const PDF_ACCESS_WINDOW_MS = ADVISER_REVIEW_PDF_RENEWAL_SECONDS * 1000;
export const CO_ADVISER_PDF_WINDOW_MS = 240_000;
export type PdfAccessState = {
    submissionId: number;
    phase: "idle" | "requesting" | "available" | "expired" | "unavailable";
    url: string | null;
    deadline: number | null;
};

export class SubmissionPdfAccess {
    private state: PdfAccessState;
    private listeners = new Set<() => void>();
    private generation = 0;
    private active = true;
    private timer: ReturnType<typeof setTimeout> | undefined;

    constructor(private submissionId: number, private sign: (id: number) => Promise<string | null>,
        private now: () => number = () => Date.now(),
        // Native browser timers require the global receiver, not this controller.
        private schedule: (callback: () => void, delay: number) => ReturnType<typeof setTimeout> = (callback, delay) => globalThis.setTimeout(callback, delay),
        private cancel: (timer: ReturnType<typeof setTimeout>) => void = timer => globalThis.clearTimeout(timer),
        private windowMs = PDF_ACCESS_WINDOW_MS) {
        this.state = { submissionId, phase: "idle", url: null, deadline: null };
    }

    snapshot = () => this.state;
    subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
    activate = () => { this.active = true; };
    private update(phase: PdfAccessState["phase"], url: string | null = null, deadline: number | null = null) {
        this.state = { submissionId: this.submissionId, phase, url, deadline };
        this.listeners.forEach(listener => listener());
    }
    private clearTimer() {
        const timer = this.timer;
        this.timer = undefined;
        // Generation/active guards also make a callback harmless if cancellation fails.
        if (timer !== undefined) { try { this.cancel(timer); } catch { /* Cleanup must still finish. */ } }
    }
    reassess = () => {
        if (this.active && this.state.deadline !== null && this.now() >= this.state.deadline) {
            this.generation++;
            this.clearTimer();
            this.update("expired");
        }
    };
    validUrl = () => { this.reassess(); return this.active && this.state.phase === "available" ? this.state.url : null; };

    async request() {
        if (!this.active || this.state.phase === "requesting") return null;
        const generation = ++this.generation;
        try {
            const deadline = this.now() + this.windowMs;
            this.clearTimer();
            this.update("requesting", null, deadline);
            this.timer = this.schedule(() => {
                if (this.active && generation === this.generation) this.reassess();
            }, Math.max(0, deadline - this.now()));
            const url = await this.sign(this.submissionId);
            if (!this.active || generation !== this.generation) return null;
            if (this.now() >= deadline) { this.clearTimer(); this.update("expired"); return null; }
            if (!url) { this.clearTimer(); this.update("unavailable"); return null; }
            this.update("available", url, deadline);
            // The pending-request timer already covers this same request-start deadline.
            return url;
        } catch {
            if (this.active && generation === this.generation) { this.clearTimer(); this.update("unavailable"); }
            return null;
        }
    }

    dispose = () => {
        this.active = false;
        this.generation++;
        this.clearTimer();
        this.update("idle");
    };
}
