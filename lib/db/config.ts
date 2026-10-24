// Pure server/operator configuration validation. Runtime access is guarded by lib/db.ts's server-only boundary.
import { z } from "zod";
import { X509Certificate } from "node:crypto";
import type { Options } from "postgres";

const endpointSchema = z.strictObject({
    host: z.string().min(1).max(253), port: z.number().int().min(1).max(65535),
    database: z.string().min(1).max(128), user: z.string().min(1).max(128),
});
const observedSchema = z.strictObject({
    databaseOid: z.string().regex(/^[1-9][0-9]*$/),
    cluster: z.string().regex(/^[1-9][0-9]*$/).optional(),
    provider: z.enum(["postgres", "supabase"]),
    projectRef: z.string().regex(/^[a-z0-9]{20}$/).optional(),
    runtimeRole: z.string().min(1).max(63), operatorRole: z.string().min(1).max(63),
});
const targetSchema = z.strictObject({
    identity: z.string().min(1).max(128), runtime: endpointSchema, operator: endpointSchema,
    observed: observedSchema.optional(),
});
const reservationSchema = z.strictObject({ identity: z.string().min(1).max(128), reserved: z.literal(true) });
const targetsSchema = z.strictObject({
    development: targetSchema.optional(), preview: targetSchema.optional(), production: z.union([targetSchema, reservationSchema]).optional(),
});
export type DatabaseEnvironment = "development" | "preview" | "production";
export type DatabasePurpose = "runtime" | "operator";
type Environment = Record<string, string | undefined>;
const unavailable = () => new Error("Database configuration is missing or not approved for this environment.");
const localHost = (host: string) => host === "localhost" || host.endsWith(".localhost") ||
    /^127\./.test(host) || ["[::1]", "::1"].includes(host) || /^\[::ffff:7f[0-9a-f]{2}:/.test(host);
const sameDatabase = (a: z.infer<typeof endpointSchema>, b: z.infer<typeof endpointSchema>) =>
    a.host.toLowerCase() === b.host.toLowerCase() && a.port === b.port && a.database === b.database;

function hostedCertificateAuthority(raw: string | undefined) {
    if (!raw || raw.length > 16384) throw unavailable();
    const pem = raw.trim();
    // One explicit public CA certificate, never a key, bundle, path or SSL options object.
    if (!/^-----BEGIN CERTIFICATE-----\r?\n(?:[A-Za-z0-9+/=]+\r?\n)+-----END CERTIFICATE-----$/.test(pem)) throw unavailable();
    const certificate = new X509Certificate(pem);
    const from = Date.parse(certificate.validFrom), until = Date.parse(certificate.validTo), now = Date.now();
    if (!certificate.ca || !Number.isFinite(from) || !Number.isFinite(until) || now < from || now >= until) throw unavailable();
    return certificate.toString();
}

function verifyProfile(target: z.infer<typeof targetSchema>, stage: string) {
    const pin = target.observed;
    if (!pin || pin.runtimeRole === pin.operatorRole || pin.provider === "postgres" && (!pin.cluster || pin.projectRef) ||
        pin.provider === "supabase" && !pin.projectRef) throw unavailable();
    for (const purpose of ["runtime", "operator"] as const) {
        const ep = target[purpose], role = pin[purpose === "runtime" ? "runtimeRole" : "operatorRole"];
        if (stage !== "development" && localHost(ep.host)) throw unavailable();
        if (pin.provider === "supabase") {
            const direct = ep.host === `db.${pin.projectRef}.supabase.co`;
            const session = /^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(ep.host);
            if (ep.port !== 5432 || !direct && !session || ep.user !== (direct ? role : `${role}.${pin.projectRef}`)) throw unavailable();
        } else if (ep.user !== role || /\.supabase\.(co|com)$/.test(ep.host)) throw unavailable();
    }
    if (target.runtime.database !== target.operator.database) throw unavailable();
}

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
            const profiles = [targets.development, targets.preview,
                ...("reserved" in targets.production ? [] : [targets.production])];
            for (const [stage, profile] of Object.entries(targets)) {
                if ("reserved" in profile) {
                    if (stage !== "production" || environment !== "preview") throw unavailable();
                } else verifyProfile(profile, stage);
            }
            for (let i = 0; i < profiles.length; i++) for (let j = i + 1; j < profiles.length; j++) {
                const a = profiles[i], b = profiles[j], pa = a.observed!, pb = b.observed!;
                const samePhysical = pa.databaseOid === pb.databaseOid && pa.cluster && pa.cluster === pb.cluster ||
                    pa.provider === "supabase" && pb.provider === "supabase" && pa.projectRef === pb.projectRef;
                const sameAddress = [a.runtime, a.operator].some(x => [b.runtime, b.operator].some(y => sameDatabase(x, y)));
                // A shared pooler address is not a database identity; its verified project route is.
                const separateRoutes = pa.provider === "supabase" && pb.provider === "supabase" && pa.projectRef !== pb.projectRef;
                if (a.identity === b.identity || samePhysical || sameAddress && !separateRoutes)
                    throw unavailable();
            }
            if (targets.production.identity === targets.preview.identity || targets.production.identity === targets.development.identity) throw unavailable();
        }
        const target = targets[environment];
        if (target && "reserved" in target) throw unavailable();
        if (environment !== "development" || purpose === "operator" || target) {
            if (!target || JSON.stringify(endpoint) !== JSON.stringify(target[purpose])) throw unavailable();
        }
        if (environment !== "development" && target?.observed?.provider === "supabase" &&
            mode !== (endpoint.host.endsWith(".pooler.supabase.com") ? "session" : "direct")) throw unavailable();
        if (environment !== "development" && env.NODE_TLS_REJECT_UNAUTHORIZED === "0") throw unavailable();
        const ca = environment !== "development" ? hostedCertificateAuthority(env.THESISHS_DATABASE_CA_PEM) : undefined;
        const tls = environment !== "development" || ["require", "verify-full"].includes(url.searchParams.get("sslmode") ?? "");
        const options: Options<Record<string, never>> = {
            max: purpose === "operator" ? 1 : environment === "development" ? 10 : 2,
            connect_timeout: 5, idle_timeout: 20, max_lifetime: 300,
            // Postgres.js supplies the endpoint servername; retain Node's default hostname verifier.
            ssl: tls ? { rejectUnauthorized: true, ...(ca ? { ca } : {}) } : false,
            prepare: true, debug: false,
            ...(environment !== "development" ? { connection: { search_path: "pg_catalog,public" } } : {}),
        };
        return { url: raw, options, environment, endpoint, identity: target?.identity ?? null, mode,
            observed: target?.observed, purpose };
    } catch { throw unavailable(); } // Never propagate a URL/parser/Zod error containing sensitive input.
}
