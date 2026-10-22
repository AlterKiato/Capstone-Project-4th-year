import "server-only";
import { isIP } from "node:net";

/** Only opt in after verifying direct Vercel ingress; generic forwarding headers are ignored. */
export function trustedAuthSource(requestHeaders: Pick<Headers, "get">): string | null {
    if (process.env.VERCEL !== "1" || process.env.THESISHS_AUTH_SOURCE_MODE !== "vercel-direct") return null;
    const value = requestHeaders.get("x-vercel-forwarded-for");
    if (!value || value.length > 64 || value.trim() !== value) return null;
    if (isIP(value) === 4) return value;
    if (isIP(value) !== 6) return null;
    try { return new URL(`http://[${value}]`).hostname; } catch { return null; }
}
