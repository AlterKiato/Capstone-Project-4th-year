import "server-only";

type Bucket = { since: number; count: number };
const processState = globalThis as typeof globalThis & { verificationEndpointBuckets?: Map<string, Bucket> };
const buckets = processState.verificationEndpointBuckets ??= new Map<string, Bucket>();
const WINDOW = 60000;

/** No trustworthy peer IP exists in Server Actions. Do not read forwarding headers.
 * Shared source budgets limit all callers, plus a per-account request budget.
 * Process-local only; public production actions stay disabled until distributed controls are reviewed. */
export function allowVerificationEndpoint(operation: "request" | "confirm", accountId?: number, now = Date.now()): boolean {
    for (const [key, value] of buckets) if (now - value.since >= WINDOW) buckets.delete(key);
    const limits: [string, number][] = [["all", 120], [operation, operation === "confirm" ? 30 : 60]];
    if (operation === "request") limits.push([`account:${accountId ?? "anonymous"}`, 10]);
    if (buckets.size >= 512 && limits.some(([key]) => !buckets.has(key))) return false;
    if (limits.some(([key, max]) => (buckets.get(key)?.count ?? 0) >= max)) return false;
    for (const [key] of limits) {
        const value = buckets.get(key) ?? { since: now, count: 0 };
        value.count++; buckets.set(key, value);
    }
    return true;
}
