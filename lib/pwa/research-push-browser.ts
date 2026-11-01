import { z } from "zod";
import type { PushClientEnvironment } from "./research-push-client";

const enrollment = z.strictObject({ generation: z.uuid(), enabled: z.boolean(), endpointFingerprint: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
    authorizedUntil: z.iso.datetime().nullable(), vapidKeyId: z.string().max(64).nullable() });
const mutation = z.strictObject({ ok: z.literal(true), enrollment });
const status = z.strictObject({ ok: z.literal(true), available: z.boolean(), publicKey: z.string().max(87).nullable(), keyId: z.string().max(64).nullable(), enrollment: enrollment.nullable() });
const registrations = new WeakMap<ServiceWorkerContainer, Promise<ServiceWorkerRegistration>>();

export function applicationServerKey(value: string): Uint8Array<ArrayBuffer> {
    if (!/^[A-Za-z0-9_-]{87}$/.test(value)) throw new Error("Unavailable");
    const bytes = Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/") + "="), c => c.charCodeAt(0));
    if (bytes.length !== 65 || bytes[0] !== 4) throw new Error("Unavailable");
    return bytes;
}
function owned(registration: ServiceWorkerRegistration) {
    const worker = registration.active ?? registration.waiting ?? registration.installing;
    return registration.scope === `${window.location.origin}/` && worker?.scriptURL === `${window.location.origin}/sw.js`;
}
async function getRegistration(create: boolean) {
    const container = navigator.serviceWorker;
    const existing = await container.getRegistration("/");
    if (existing && !owned(existing)) throw new Error("Unavailable");
    if (!create) return existing ?? null;
    let promise = registrations.get(container);
    if (!promise) {
        promise = container.register("/sw.js", { scope: "/", updateViaCache: "none" }).then(registration => {
            if (!owned(registration)) throw new Error("Unavailable");
            if (registration.active) return registration;
            return new Promise<ServiceWorkerRegistration>((resolve, reject) => {
                const worker = registration.installing ?? registration.waiting;
                const finish = () => {
                    if (worker?.state !== "activated" && worker?.state !== "redundant") return;
                    window.clearTimeout(timer); worker.removeEventListener("statechange", finish);
                    if (worker.state === "activated") resolve(registration); else reject(new Error("Unavailable"));
                };
                const timer = window.setTimeout(() => { worker?.removeEventListener("statechange", finish); reject(new Error("Unavailable")); }, 5000);
                worker?.addEventListener("statechange", finish); finish();
            });
        }).catch(error => { registrations.delete(container); throw error; });
        registrations.set(container, promise);
    }
    return promise;
}

export function browserPushEnvironment(userId: number): PushClientEnvironment {
    return {
        supported: () => window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window &&
            !!window.crypto?.subtle && typeof window.crypto.randomUUID === "function",
        permission: () => typeof Notification === "undefined" ? "denied" : Notification.permission,
        registration: getRegistration,
        fingerprint: async subscription => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(subscription.endpoint)))]
            .map(value => value.toString(16).padStart(2, "0")).join(""),
        sameKey: (subscription, key) => {
            const current = subscription.options.applicationServerKey;
            const expected = applicationServerKey(key);
            return !!current && current.byteLength === expected.length && new Uint8Array(current).every((byte, index) => byte === expected[index]);
        },
        subscribe: (registration, key) => registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(key) }),
        async api(method, body, signal) {
            const controller = new AbortController();
            const abort = () => controller.abort();
            signal.addEventListener("abort", abort, { once: true });
            const timer = window.setTimeout(abort, 3000);
            try {
                if (signal.aborted) throw new Error("Unavailable");
                const response = await fetch("/api/push/subscription", { method, credentials: "same-origin", cache: "no-store", redirect: "error", signal: controller.signal,
                    headers: { "Content-Type": "application/json", "X-ThesiSHS-Push-Account": String(userId) },
                    ...(method === "GET" ? {} : { body: JSON.stringify(body) }) });
                if (!response.ok) throw Object.assign(new Error("Unavailable"), { status: response.status });
                const json: unknown = await response.json();
                return method === "GET" ? status.parse(json) : mutation.parse(json);
            } finally { window.clearTimeout(timer); signal.removeEventListener("abort", abort); }
        },
        uuid: () => crypto.randomUUID(), now: () => Date.now(),
        schedule: (callback, delay) => globalThis.setTimeout(() => callback(), delay), cancel: timer => globalThis.clearTimeout(timer),
    };
}
