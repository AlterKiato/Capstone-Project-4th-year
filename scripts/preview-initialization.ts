// Pure orchestration: a single attempt and one independent durable inspection; never an automatic retry.
import { verifyPreviewLedger } from "./preview-migration-source";
import { PreviewSchemaAssertion } from "./preview-schema";
import { createHash } from "node:crypto";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, relative, sep } from "node:path";
export type PreviewState = { target: string; empty: boolean; ledger: { hash: string; created_at: string }[]; catalog: string; preservedData?: string };

export const ACCOUNT_RECOVERY_TABLES = ["public.role", "public.users", "public.research_groups", "public.group_members", "public.email_verification_requests"] as const;
export const ACCOUNT_RECOVERY_CHECKS = ["schema", "counts", "identifiers", "passwordHashes", "statuses", "roles", "memberships", "adviserAssignments", "foreignKeys", "sequences"] as const;

// Validates a private operator recovery record and its actual archive, not a new restore attempt.
// Assertions about isolation, encrypted storage and successful checks remain operator attestations.
export function verifyAccountRecoveryEvidence(evidencePath: string) {
    try {
        const root = realpathSync(process.cwd());
        const privateFile = (input: string, limit: number) => {
            if (typeof input !== "string" || !isAbsolute(input)) throw new Error();
            const file = realpathSync(input), rel = relative(root, file);
            if (!isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`)) throw new Error();
            const stat = statSync(file);
            if (!stat.isFile() || stat.size === 0 || stat.size > limit) throw new Error();
            return file;
        };
        const record = JSON.parse(readFileSync(privateFile(evidencePath, 16384), "utf8"));
        const exact = (actual: unknown, expected: readonly string[]) => Array.isArray(actual) &&
            actual.length === expected.length && expected.every(value => actual.filter(item => item === value).length === 1);
        const date = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value)) && Date.parse(value) <= Date.now();
        if (record.version !== 1 || record.scope !== "synthetic-accounts-v1" || record.projectRef !== "cbkplqkkjuoglpimwmib" ||
            record.database !== "postgres" || record.databaseOid !== "5" || record.cluster !== "7678069749886157684" ||
            !exact(record.tables, ACCOUNT_RECOVERY_TABLES) || !exact(record.schemaOnly, ["public.auth_rate_limit_buckets"]) ||
            record.ownerOnlyEncryptedStorage !== true || record.otherDataReplaceable !== true ||
            !date(record.snapshotAt) || !date(record.restoredAt) || Date.parse(record.restoredAt) < Date.parse(record.snapshotAt) ||
            !/^[a-f0-9]{64}$/.test(record.archiveSha256 ?? "") || record.restoredArchiveSha256 !== record.archiveSha256 ||
            !ACCOUNT_RECOVERY_CHECKS.every(check => record.checks?.[check] === true) ||
            !["passed", "not-tested"].includes(record.login)) throw new Error();
        const target = record.restoreTarget;
        if (target?.disposable !== true || typeof target.cluster !== "string" || typeof target.databaseOid !== "string" ||
            !/^[1-9][0-9]*$/.test(target.cluster) || !/^[1-9][0-9]*$/.test(target.databaseOid) ||
            target.cluster === record.cluster && target.databaseOid === record.databaseOid ||
            target.cluster === "7652422818440234372" && target.databaseOid === "16387") throw new Error();
        const archive = readFileSync(privateFile(record.archivePath, 64 * 1024 * 1024));
        if (archive.subarray(0, 5).toString("ascii") !== "PGDMP" ||
            createHash("sha256").update(archive).digest("hex") !== record.archiveSha256) throw new Error();
        return { scope: "synthetic-accounts-only", protectedTables: ACCOUNT_RECOVERY_TABLES,
            otherDataReplaceable: true, fullDatabaseRecovery: false } as const;
    } catch {
        // Never expose private paths, record contents or filesystem/parser errors.
        throw new Error("Private synthetic-account recovery evidence is missing or invalid.");
    }
}

// Never return error messages, SQL, parameters, URLs, stacks or configuration from driver errors.
export function previewFailure(error: unknown): { classification: string; code?: string; schemaObject?: string; schemaAssertion?: string } {
    let classification = "unknown";
    let schema: { schemaObject?: string; schemaAssertion?: string } = {};
    for (let depth = 0; depth < 8 && error && typeof error === "object"; depth++) {
        if (error instanceof PreviewSchemaAssertion)
            schema = { schemaObject: error.schemaObject, schemaAssertion: error.schemaAssertion };
        const item = error as { code?: unknown; name?: unknown; cause?: unknown };
        if (typeof item.code === "string" && /^[0-9A-Z]{5}$/.test(item.code))
            return { classification: "postgresql", code: item.code, ...schema };
        if (item.code === "ERR_ASSERTION") classification = "schema-assertion";
        if (item.name === "TypeError") classification = "type-error";
        error = item.cause;
    }
    return { classification, ...schema };
}
export async function initializePreview(io: {
    inspect(): Promise<PreviewState>; apply(before: PreviewState): Promise<string>;
}, approval: { execute: boolean; target: string; source: string }, expectedSource: string) {
    return changePreview(io, approval, expectedSource, false);
}

// Separate entry point: initialization remains empty-only; this path accepts exactly 0000-0014.
export async function upgradePreview0015(io: {
    inspect(): Promise<PreviewState>; apply(before: PreviewState): Promise<string>;
}, approval: { execute: boolean; target: string; source: string }, expectedSource: string) {
    return changePreview(io, approval, expectedSource, true);
}

async function changePreview(io: {
    inspect(): Promise<PreviewState>; apply(before: PreviewState): Promise<string>;
}, approval: { execute: boolean; target: string; source: string }, expectedSource: string, upgrade: boolean) {
    if (!approval.execute || approval.source !== expectedSource) throw new Error("Preview initialization refused.");
    const before = await io.inspect();
    if (before.target !== approval.target) throw new Error("Preview target confirmation mismatch.");
    if (upgrade) {
        verifyPreviewLedger(before.ledger, 15);
        if (before.empty || !before.preservedData) throw new Error("Preview upgrade requires a populated verified baseline.");
    } else if (!before.empty || before.ledger.length) throw new Error("Preview target is not a verified empty application schema.");
    let verifiedCatalog: string | undefined;
    try {
        verifiedCatalog = await io.apply(before);
    } catch (error) {
        // Inspect even if rollback/commit acknowledgement was uncertain. No replay, DROP or restore.
        try { await io.inspect(); } catch { /* An unavailable inspection never authorizes a retry. */ }
        throw new Error("Preview initialization unconfirmed; review durable state before any further attempt.", { cause: error });
    }
    const after = await io.inspect();
    verifyPreviewLedger(after.ledger);
    if (after.target !== before.target || after.catalog !== verifiedCatalog || after.ledger.length !== 16 ||
        upgrade && after.preservedData !== before.preservedData)
        throw new Error("Preview durable result does not match the verified migration result.");
    return upgrade ? "upgraded-0015-confirmed" : "initialized-confirmed";
}
