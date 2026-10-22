// Pure server/operator configuration validation. Runtime access is guarded by lib/db.ts's server-only boundary.
import { z } from "zod";
import type { Options } from "postgres";

const endpointSchema = z.strictObject({
    host: z.string().min(1).max(253), port: z.number().int().min(1).max(65535),
    database: z.string().min(1).max(128), user: z.string().min(1).max(128),
});
const targetSchema = z.strictObject({
    identity: z.string().min(1).max(128), runtime: endpointSchema, operator: endpointSchema,
});
const targetsSchema = z.strictObject({
    development: targetSchema.optional(), preview: targetSchema.optional(), production: targetSchema.optional(),
});
export type DatabaseEnvironment = "development" | "preview" | "production";
export type DatabasePurpose = "runtime" | "operator";
type Environment = Record<string, string | undefined>;
const unavailable = () => new Error("Database configuration is missing or not approved for this environment.");
const localHost = (host: string) => host === "localhost" || host.endsWith(".localhost") ||
    /^127\./.test(host) || ["[::1]", "::1"].includes(host) || /^\[::ffff:7f[0-9a-f]{2}:/.test(host);
const sameDatabase = (a: z.infer<typeof endpointSchema>, b: z.infer<typeof endpointSchema>) =>
    a.host.toLowerCase() === b.host.toLowerCase() && a.port === b.port && a.database === b.database;

export function databaseConfiguration(env: Environment, purpose: DatabasePurpose = "runtime") {
    try {
        const hosted = env.NODE_ENV === "production" || ["preview", "production"].includes(env.VERCEL_ENV ?? "");
        if (env.VERCEL_ENV && !["development", "preview", "production"].includes(env.VERCEL_ENV)) throw unavailable();
        if (hosted && env.NODE_ENV !== "production") throw unavailable();
        if (!hosted && purpose === "runtime" && !["development", "test"].includes(env.NODE_ENV ?? "")) throw unavailable();
        const stage = env.THESISHS_DATABASE_ENV ?? (hosted || purpose === "operator" ? "" : "development");
        if (!["development", "preview", "production"].includes(stage) || hosted && stage === "development") throw unavailable();
        if (env.VERCEL_ENV && env.VERCEL_ENV !== stage) throw unavailable();
        if (!hosted && purpose === "runtime" && stage !== "development") throw unavailable();
        const environment = stage as DatabaseEnvironment;
        const raw = purpose === "operator" ? env.THESISHS_DATABASE_ADMIN_URL : env.DATABASE_URL;
        if (!raw || raw.length > 8192 || raw.trim() !== raw) throw unavailable();
        const url = new URL(raw);
        if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.username || !url.password || url.hash) throw unavailable();
        const endpoint = endpointSchema.parse({ host: url.hostname.toLowerCase(), port: Number(url.port || 5432),
            database: decodeURIComponent(url.pathname.slice(1)), user: decodeURIComponent(url.username) });
        if (endpoint.host.includes(",")) throw unavailable(); // No implicit multi-host routing.
        const query = [...url.searchParams];
        if (query.length > 1 || query.some(([name, value]) => name !== "sslmode" ||
            !["require", "verify-full", ...(environment === "development" ? ["disable"] : [])].includes(value))) throw unavailable();
        let mode = env.THESISHS_DATABASE_CONNECTION_MODE;
        if (environment !== "development" && !["direct", "session"].includes(mode ?? "")) throw unavailable();
        if (mode && !["direct", "session"].includes(mode)) throw unavailable();
        mode ??= "direct";
        const rawTargets = env.THESISHS_DATABASE_TARGETS_JSON;
        if (rawTargets && rawTargets.length > 8192) throw unavailable();
        const targets = targetsSchema.parse(rawTargets ? JSON.parse(rawTargets) : {});
        if (environment !== "development") {
            if (purpose === "runtime" && env.THESISHS_DATABASE_ADMIN_URL) throw unavailable();
            if (localHost(endpoint.host) || !targets.production || !targets.preview || !targets.development) throw unavailable();
            const profiles = [targets.development, targets.preview, targets.production];
            for (let i = 0; i < profiles.length; i++) for (let j = i + 1; j < profiles.length; j++) {
                if (profiles[i].identity === profiles[j].identity ||
                    [profiles[i].runtime, profiles[i].operator].some(a => [profiles[j].runtime, profiles[j].operator].some(b => sameDatabase(a, b))))
                    throw unavailable();
            }
            for (const target of [targets.production, targets.preview]) {
                if (target.runtime.user === target.operator.user || localHost(target.runtime.host) || localHost(target.operator.host)) throw unavailable();
            }
        }
        const target = targets[environment];
        if (environment !== "development" || purpose === "operator" || target) {
            if (!target || JSON.stringify(endpoint) !== JSON.stringify(target[purpose])) throw unavailable();
        }
        const tls = environment !== "development" || ["require", "verify-full"].includes(url.searchParams.get("sslmode") ?? "");
        const options: Options<Record<string, never>> = {
            max: purpose === "operator" ? 1 : environment === "development" ? 10 : 2,
            connect_timeout: 5, idle_timeout: 20, max_lifetime: 300,
            ssl: tls ? { rejectUnauthorized: true } : false,
            prepare: true, debug: false,
        };
        return { url: raw, options, environment, endpoint, identity: target?.identity ?? null, mode };
    } catch { throw unavailable(); } // Never propagate a URL/parser/Zod error containing sensitive input.
}
