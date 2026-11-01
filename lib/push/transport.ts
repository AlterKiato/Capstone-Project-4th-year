import "server-only";
import { lookup } from "node:dns";
import { request } from "node:https";
import type { RequestOptions } from "node:https";
import { BlockList, isIP } from "node:net";
import { generateRequestDetails } from "web-push";
import { safePushEndpoint } from "./contract";
import { pushPayload } from "./delivery";
import type { PushDeliveryConfiguration } from "./config";
import type { DeliverySubscription, PushPayload, PushTransport } from "./delivery";

const blocked4 = new BlockList(), blocked6 = new BlockList(), global6 = new BlockList();
for (const [address, prefix] of [ ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
    ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24],
    ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4] ] as const)
    blocked4.addSubnet(address, prefix, "ipv4");
global6.addSubnet("2000::", 3, "ipv6");
for (const [address, prefix] of [["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20]] as const)
    blocked6.addSubnet(address, prefix, "ipv6");
export function publicPushAddress(address: string): boolean {
    if (address.includes("%")) return false;
    const family = isIP(address);
    return family === 4 ? !blocked4.check(address, "ipv4") : family === 6 && global6.check(address, "ipv6") && !blocked6.check(address, "ipv6");
}
const unavailable = () => new Error("Push transport unavailable.");

/** Library supplies encryption/VAPID only. Its unbounded sendNotification transport is not used. */
export function buildPushRequest(subscription: DeliverySubscription, payload: PushPayload, config: PushDeliveryConfiguration) {
    try {
        const selected = payload && pushPayload(payload.destination);
        if (!safePushEndpoint(subscription.endpoint) || !selected || payload.v !== 1 || Object.keys(payload).length !== 2 ||
            !Object.hasOwn(payload, "v") || !Object.hasOwn(payload, "destination")) throw unavailable();
        const text = JSON.stringify(selected);
        if (Buffer.byteLength(text) > 256) throw unavailable();
        const details = generateRequestDetails({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, text, {
            vapidDetails: { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey },
            TTL: 300, urgency: "normal", contentEncoding: "aes128gcm",
        });
        if (details.endpoint !== subscription.endpoint || details.method !== "POST" || !Buffer.isBuffer(details.body) || details.body.length > 4096 ||
            Buffer.byteLength(JSON.stringify(details.headers)) > 8192) throw unavailable();
        return details;
    } catch { throw unavailable(); }
}

export function createPushTransport(io: { request?: typeof request; lookup?: typeof lookup } = {}): PushTransport {
    const open = io.request ?? request, resolve = io.lookup ?? lookup;
    return async (subscription, payload, config, budget) => {
        budget.check();
        const details = buildPushRequest(subscription, payload, config), url = new URL(subscription.endpoint);
        budget.check();
        return new Promise<number>((accept, reject) => {
            let settled = false;
            let abort = () => {};
            const fail = () => { if (!settled) { settled = true; budget.signal.removeEventListener("abort", abort); reject(unavailable()); } };
            const options: RequestOptions & { autoSelectFamily: false } = {
                method: "POST", headers: details.headers, agent: false, autoSelectFamily: false,
                rejectUnauthorized: true, servername: url.hostname, maxHeaderSize: 8192, signal: budget.signal,
                lookup: (hostname, options, callback) => {
                    if (hostname !== url.hostname || budget.signal.aborted || budget.remaining() <= 0) { callback(unavailable(), "", 4); return; }
                    // Pin a validated address into this connection, retaining the original TLS hostname.
                    // OS getaddrinfo itself is not cancellable; aborted callbacks cannot initiate a connection.
                    resolve(hostname, { all: true, verbatim: true }, (error, addresses) => {
                        if (error || budget.signal.aborted || budget.remaining() <= 0 || !addresses?.length ||
                            addresses.some(item => !publicPushAddress(item.address))) { callback(unavailable(), "", 4); return; }
                        const selected = addresses[0];
                        if (options.all) callback(null, [selected]);
                        else callback(null, selected.address, selected.family);
                    });
                },
            };
            const req = open(url, options, response => {
                const status = response.statusCode ?? 0;
                if (status < 200 || status >= 300 && status < 400) { fail(); response.destroy(); req.destroy(); return; }
                let length = 0;
                response.on("data", (chunk: Buffer) => {
                    length += chunk.length;
                    if (length > 1024) { fail(); response.destroy(); req.destroy(); }
                });
                response.on("error", fail);
                response.on("aborted", fail);
                response.on("end", () => {
                    if (settled) return;
                    if (budget.signal.aborted || budget.remaining() <= 0) { fail(); return; }
                    settled = true; budget.signal.removeEventListener("abort", abort); accept(status);
                });
            });
            req.on("error", fail);
            abort = () => { fail(); req.destroy(); };
            budget.signal.addEventListener("abort", abort, { once: true });
            if (budget.signal.aborted) { abort(); return; }
            req.setTimeout(Math.max(1, Math.min(1200, budget.remaining())), () => { fail(); req.destroy(); });
            // AbortSignal destroys the underlying ClientRequest, including during connection/TLS setup.
            req.end(details.body);
        });
    };
}
