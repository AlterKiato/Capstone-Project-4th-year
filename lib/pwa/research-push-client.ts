import type { Enrollment } from "@/lib/push/contract";

export type PushStatus = { available: boolean; publicKey: string | null; keyId: string | null; enrollment: Enrollment | null };
export type PushView = { phase: "loading" | "unsupported" | "install" | "unavailable" | "denied" | "ready" | "enabled" | "busy" | "error" | "expired";
    message: string; canEnable: boolean; canDisable: boolean };
export type PushClientEnvironment = {
    supported(): boolean;
    permission(): NotificationPermission;
    registration(create: boolean): Promise<ServiceWorkerRegistration | null>;
    fingerprint(subscription: PushSubscription): Promise<string>;
    sameKey(subscription: PushSubscription, key: string): boolean;
    subscribe(registration: ServiceWorkerRegistration, key: string): Promise<PushSubscription>;
    api(method: "GET" | "POST" | "DELETE", body: unknown, signal: AbortSignal): Promise<PushStatus | { enrollment: Enrollment }>;
    uuid(): string;
    now(): number;
    schedule(callback: () => void, delay: number): ReturnType<typeof setTimeout>;
    cancel(timer: ReturnType<typeof setTimeout>): void;
};
const initial: PushView = { phase: "loading", message: "Checking research notification availability.", canEnable: false, canDisable: false };
let activeClient: ResearchPushClient | null = null;

export class ResearchPushClient {
    private view = initial;
    private listeners = new Set<() => void>();
    private epoch = 0;
    private live = false;
    private closing = false;
    private abort = new AbortController();
    private expiryTimer?: ReturnType<typeof setTimeout>;
    private registration: ServiceWorkerRegistration | null = null;
    private local: PushSubscription | null = null;
    private status: PushStatus | null = null;
    private recognized = false;
    private matched = false;
    private createdHere = false;
    private bound: string | null = null;
    private pending: string | null = null;
    constructor(private context: { roleId: number; installed: boolean; configured: boolean; expiresAt: number }, private env: PushClientEnvironment) {}
    snapshot = () => this.view;
    serverSnapshot = () => initial;
    subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
    private show(phase: PushView["phase"], message: string, canEnable = false, canDisable = false) {
        this.view = { phase, message, canEnable, canDisable }; this.listeners.forEach(listener => listener());
    }
    private begin() { this.abort.abort(); this.abort = new AbortController(); return ++this.epoch; }
    private valid(epoch: number) { return this.live && this.epoch === epoch && this.env.now() < this.context.expiresAt; }
    private expire() { this.begin(); this.show("expired", "Sign in again to manage research notifications."); }
    private fail(error: unknown, epoch: number) {
        if (!this.valid(epoch)) return;
        if ((error as { status?: number })?.status === 401) { this.expire(); return; }
        this.show(this.env.permission() === "denied" ? "denied" : "error",
            this.env.permission() === "denied" ? "Notifications are blocked. Change permission in your device settings, then refresh status." :
                "Enrollment could not be confirmed. Refresh status or disable notifications before trying again.", false, !!(this.local || this.bound || this.pending));
    }
    async start() {
        if (this.closing) return;
        this.live = true;
        const epoch = this.begin();
        if (this.expiryTimer) this.env.cancel(this.expiryTimer);
        if (this.context.roleId !== 2 && this.context.roleId !== 3) { this.show("unsupported", "Research notifications are available to Students and Advisers."); return; }
        if (!this.context.installed) { this.show("install", "Open the installed app to manage research notifications."); return; }
        if (!this.env.supported()) { this.show("unsupported", "Research notifications are not supported in this browser."); return; }
        if (!this.valid(epoch)) { this.expire(); return; }
        this.expiryTimer = this.env.schedule(() => this.expire(), this.context.expiresAt - this.env.now());
        this.show("loading", "Checking research notification availability.");
        try {
            this.registration = await this.env.registration(this.context.configured);
            if (!this.valid(epoch)) return;
            this.local = await this.registration?.pushManager.getSubscription() ?? null;
            if (!this.valid(epoch)) return;
            if (!this.context.configured) {
                this.show("unavailable", "Research notifications are not available yet. Existing in-app notifications continue.", false, !!this.local);
                return;
            }
            const result = await this.env.api("GET", undefined, this.abort.signal);
            if (!this.valid(epoch)) return;
            if (!("available" in result)) throw new Error("Unavailable");
            this.status = result;
            this.matched = !!this.local && await this.matches(this.local, result.enrollment);
            if (!this.valid(epoch)) return;
            this.recognized = !!this.local && (this.createdHere || this.matched);
            if (this.matched) this.bound = result.enrollment!.generation;
            this.present();
        } catch (error) { this.fail(error, epoch); }
    }
    private async matches(local: PushSubscription, enrollment: Enrollment | null) {
        return !!enrollment?.enabled && enrollment.endpointFingerprint === await this.env.fingerprint(local);
    }
    private present() {
        const disabled = !!(this.local || this.bound || this.pending);
        if (this.env.permission() === "denied") { this.show("denied", "Notifications are blocked. Change permission in your device settings, then refresh status.", false, disabled); return; }
        if (!this.status?.available || !this.status.publicKey || !this.status.keyId || !this.registration) {
            this.show("unavailable", "Research notifications are not available yet. Existing in-app notifications continue.", false, disabled); return;
        }
        if (this.pending && !this.matched) {
            this.show("error", "Previous enrollment is unconfirmed. Disable Notifications before enabling again.", false, true); return;
        }
        const enrolled = this.env.permission() === "granted" && this.matched && this.local && this.status.enrollment?.enabled &&
            this.status.enrollment.vapidKeyId === this.status.keyId &&
            this.bound === this.status.enrollment.generation && Date.parse(this.status.enrollment.authorizedUntil ?? "") > this.env.now() &&
            this.env.sameKey(this.local, this.status.publicKey);
        this.show(enrolled ? "enabled" : "ready", enrolled ? "Notifications are enabled on this device." :
            this.local && !this.recognized ? "This browser has a previous enrollment. Enable will first clear it; then select Enable again." : "Research notifications are not enabled on this device.", !enrolled, disabled);
    }
    // Called directly by the click handler. subscribe() is invoked before the first await.
    async enable() {
        if (!this.view.canEnable || this.closing || !this.status?.available || !this.status.publicKey || !this.registration) return;
        if (this.env.permission() === "denied") { this.present(); return; }
        const epoch = this.begin();
        if (!this.valid(epoch)) { this.expire(); return; }
        const registration = this.registration, key = this.status.publicKey;
        this.show("busy", "Preparing notification enrollment.");
        try {
            if (this.local && (!this.recognized || !this.env.sameKey(this.local, key))) {
                await this.unsubscribeLocal(this.local, epoch);
                if (!this.valid(epoch)) return;
                this.show("ready", "Previous browser enrollment cleared. Select Enable Notifications again to continue.", true, !!(this.bound || this.pending));
                return;
            }
            this.pending = this.env.uuid();
            const subscriptionPromise = this.local && this.env.permission() === "granted" ? Promise.resolve(this.local) : this.env.subscribe(registration, key);
            const subscription = await subscriptionPromise;
            if (!this.valid(epoch)) return; // Never bind a late native result to a new account.
            this.local = subscription; this.createdHere = true; this.recognized = true;
            const json = subscription.toJSON();
            const result = await this.env.api("POST", { expectedGeneration: this.status.enrollment?.generation ?? null,
                registrationId: this.pending, subscription: { endpoint: subscription.endpoint, expirationTime: subscription.expirationTime,
                    keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth } } }, this.abort.signal);
            if (!this.valid(epoch)) return;
            this.bound = result.enrollment!.generation; this.pending = null;
            this.matched = true;
            this.status = { ...this.status, enrollment: result.enrollment }; this.present();
        } catch (error) { this.fail(error, epoch); }
    }
    private async unsubscribeLocal(local: PushSubscription, epoch: number) {
        const current = await this.registration?.pushManager.getSubscription();
        if (!this.valid(epoch)) return;
        if (current && (current.endpoint !== local.endpoint || current.toJSON().keys?.auth !== local.toJSON().keys?.auth ||
            current.toJSON().keys?.p256dh !== local.toJSON().keys?.p256dh)) throw new Error("Enrollment changed");
        if (current && !await local.unsubscribe()) throw new Error("Unavailable");
        if (!this.valid(epoch)) return;
        this.local = null; this.createdHere = false; this.recognized = false; this.matched = false;
    }
    private async remove(epoch: number) {
        // Only a matching local fingerprint may recover a binding after a reload. Never delete GET's latest row blindly.
        if (!this.bound && !this.pending && this.local) {
            const result = await this.env.api("GET", undefined, this.abort.signal);
            if (!this.valid(epoch)) return;
            if (await this.matches(this.local, result.enrollment)) this.bound = result.enrollment!.generation;
        }
        if (!this.valid(epoch)) return;
        const generations = [...new Set([this.bound, this.pending].filter((value): value is string => !!value))];
        const result = generations.length ? await this.env.api("DELETE", { generations }, this.abort.signal) : null;
        if (!this.valid(epoch)) return;
        if (this.local) await this.unsubscribeLocal(this.local, epoch);
        if (!this.valid(epoch)) return;
        this.bound = null; this.pending = null;
        if (this.status && result) this.status = { ...this.status, enrollment: result.enrollment };
        this.show(this.context.configured ? "ready" : "unavailable", "Notifications are disabled on this browser. Any newer device enrollment is unchanged.",
            !!this.status?.available && !!this.registration);
    }
    async disable() {
        if (!this.view.canDisable || this.closing || this.view.phase === "busy") return;
        const epoch = this.begin(); this.show("busy", "Disabling notification enrollment.");
        try { await this.remove(epoch); } catch (error) { this.fail(error, epoch); }
    }
    async logout() {
        this.closing = true;
        const epoch = this.begin();
        // Abort the actual API request at the bound; native promises cannot be forcibly cancelled.
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            const cleanup = this.remove(epoch).catch(async error => {
                // On infrastructure failure, revoke only the captured local capability when still identifiable.
                if ((error as { status?: number })?.status !== 401 && this.valid(epoch) && this.local && (this.bound || this.pending)) {
                    try { await this.unsubscribeLocal(this.local, epoch); } catch { /* Best effort within the same bound. */ }
                }
            });
            await Promise.race([cleanup, new Promise<void>(resolve => {
                timer = this.env.schedule(() => { this.dispose(); resolve(); }, 1000);
            })]);
        } finally { if (timer) this.env.cancel(timer); this.dispose(); }
    }
    dispose() {
        this.live = false; this.begin();
        if (this.expiryTimer) this.env.cancel(this.expiryTimer);
    }
}

export function ownResearchPushClient(client: ResearchPushClient) {
    if (activeClient && activeClient !== client) activeClient.dispose();
    activeClient = client;
    return () => { client.dispose(); if (activeClient === client) activeClient = null; };
}
export async function prepareResearchPushLogout() { const client = activeClient; activeClient = null; await client?.logout(); }
export async function logoutWithResearchPushCleanup(logout: () => Promise<void>) {
    try { await prepareResearchPushLogout(); } catch { /* Cleanup must never prevent cookie deletion. */ }
    finally { await logout(); }
}
