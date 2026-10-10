import "server-only";
import { z } from "zod";
const configSchema = z.array(z.strictObject({
    userId: z.number().int().positive().max(2147483647),
    authorizationRef: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),
})).max(32).refine(entries => new Set(entries.map(entry => entry.userId)).size === entries.length);

// Operator-controlled, server-only configuration. Missing/malformed config denies all.
// No application API can create designations; never return or log the list.
export function getVerifierAuthorizationRef(userId: number): string | null {
    try {
        const entries = configSchema.parse(JSON.parse(process.env.AI_INSTITUTIONAL_VERIFIERS_JSON ?? "[]"));
        return entries.find(entry => entry.userId === userId)?.authorizationRef ?? null;
    } catch { return null; }
}
