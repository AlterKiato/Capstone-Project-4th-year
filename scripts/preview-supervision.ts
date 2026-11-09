// Helpers for the existing Preview runner only. No connection or execution entry point.
import type postgres from "postgres";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { privateFile } from "./upload-acceptance-safety";
import { supervisionMigrationSource, verifySupervisionLedger, workspaceMigrationSource } from "./preview-migration-source";
import type { PreviewState } from "./preview-initialization";

const refuse = () => new Error("Preview supervision prerequisites not verified.");
const runtime = "thesishs_preview_runtime";
export const SUPERVISION_TABLES = new Set(["main_adviser_designation", "co_adviser_review_assignments"]);
export const SUPERVISION_SEQUENCE = "co_adviser_review_assignments_id_seq";

/** Read-only shape gate; exact expressions/defaults are canonicalized in the guarded write transaction. */
export function verifySupervisionCatalogShape(snapshot: ReturnType<typeof supervisionMigrationSource>["snapshot"],
    columns: Record<string, unknown>[], constraints: Record<string, unknown>[]) {
    for (const table of Object.values(snapshot.tables) as { name: string; columns: Record<string, { name: string; primaryKey: boolean }>;
        foreignKeys: Record<string, unknown>; uniqueConstraints: Record<string, unknown>; checkConstraints: Record<string, unknown>; compositePrimaryKeys: Record<string, unknown> }[]) {
        const names = columns.filter(c => c.table_name === table.name).map(c => c.column_name).sort();
        if (JSON.stringify(names) !== JSON.stringify(Object.keys(table.columns).sort())) throw refuse();
        const wanted = [...Object.keys(table.foreignKeys), ...Object.keys(table.uniqueConstraints), ...Object.keys(table.checkConstraints),
            ...Object.keys(table.compositePrimaryKeys), ...(Object.values(table.columns).some(c => c.primaryKey) ? [`${table.name}_pkey`] : [])]
            .map(n => n.slice(0, 63)).sort();
        const rows = constraints.filter(c => c.relname === table.name && c.contype !== "n");
        if (JSON.stringify(rows.map(c => c.conname).sort()) !== JSON.stringify(wanted) ||
            rows.some(c => c.convalidated !== true || c.enforced === "false")) throw refuse();
    }
}

/** The archive inventory/decoding and private-storage claims are explicit operator attestations. */
export function verifySupervisionBackup(record: unknown, archive: Buffer, before: PreviewState, now = Date.now()) {
    const r = record as Record<string, unknown>;
    const tables = Object.values(workspaceMigrationSource().snapshot.tables).map((t: unknown) => (t as { name: string }).name).sort();
    const when = typeof r?.verifiedAt === "string" ? Date.parse(r.verifiedAt) : NaN;
    const sha256 = createHash("sha256").update(archive).digest("hex");
    verifySupervisionLedger(before.ledger, 17);
    if (!r || r.version !== 1 || r.scope !== "preview-0017-backup" || r.projectRef !== "cbkplqkkjuoglpimwmib" ||
        r.database !== "postgres" || r.databaseOid !== "5" || r.cluster !== "7678069749886157684" ||
        r.source !== supervisionMigrationSource().hash || r.target !== before.target || r.catalog !== before.catalog ||
        !before.preservedData || r.preservedData !== before.preservedData ||
        r.archiveSha256 !== sha256 || archive.length <= 5 || archive.subarray(0, 5).toString("ascii") !== "PGDMP" ||
        r.inventoryVerified !== true || r.fullArchiveDecoded !== true || r.privateStorageVerified !== true ||
        r.ledgerIncluded !== true || r.sequencesIncluded !== true || r.privilegesRecorded !== true ||
        !Array.isArray(r.tables) || JSON.stringify([...r.tables].sort()) !== JSON.stringify(tables) ||
        !Number.isFinite(when) || when > now || now - when > 86400000) throw refuse();
    return { sha256 };
}

export function readSupervisionBackup(evidencePath: string, confirmedHash: string, before: PreviewState) {
    try {
        if (!/^[a-f0-9]{64}$/.test(confirmedHash)) throw refuse();
        const path = privateFile(evidencePath);
        if (statSync(path).size > 65536) throw refuse();
        const record = JSON.parse(readFileSync(path, "utf8"));
        const archivePath = privateFile(record.archivePath);
        if (statSync(archivePath).size > 64 * 1024 * 1024) throw refuse();
        const result = verifySupervisionBackup(record, readFileSync(archivePath), before);
        if (result.sha256 !== confirmedHash) throw refuse();
        return result;
    } catch { throw refuse(); } // Never propagate private filenames, archive bytes or parser errors.
}

/** Existing grants are checked, never widened to compensate for an incompatible baseline. */
export async function verifySupervisionRuntime(sql: postgres.Sql, installed: boolean) {
    for (const [table, privileges] of [
        ["submissions", ["SELECT", "UPDATE"]], ["research_papers", ["SELECT", "UPDATE"]],
        ["feedbacks", ["SELECT", "INSERT"]], ["activity_logs", ["INSERT"]], ["notifications", ["INSERT"]],
    ] as const) for (const privilege of privileges) {
        const [access] = await sql`select has_table_privilege(${runtime},${`public.${table}`},${privilege}) as required`;
        if (access?.required !== true) throw refuse();
    }
    for (const sequence of ["feedbacks_id_seq", "activity_logs_id_seq", "notifications_id_seq"]) {
        const [access] = await sql`select has_sequence_privilege(${runtime},${`public.${sequence}`},'USAGE') as required`;
        if (access?.required !== true) throw refuse();
    }
    if (!installed) return;
    for (const table of SUPERVISION_TABLES) {
        const name = `public.${table}`;
        for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER", "MAINTAIN"]) {
            const expected = ["SELECT", "UPDATE"].includes(privilege) || table === "co_adviser_review_assignments" && privilege === "INSERT";
            const [access] = await sql`select has_table_privilege(${runtime},${name},${privilege}) as allowed,
                has_table_privilege(${runtime},${name},${`${privilege} WITH GRANT OPTION`}) as grantable`;
            if (access?.allowed !== expected || access.grantable !== false) throw refuse();
        }
        const [extra] = await sql`select exists(select 1 from pg_attribute a where a.attrelid=${name}::regclass and a.attnum>0 and not a.attisdropped
            and (has_column_privilege(${runtime},a.attrelid,a.attnum,'REFERENCES') or
                has_column_privilege(${runtime},a.attrelid,a.attnum,'SELECT WITH GRANT OPTION') or
                has_column_privilege(${runtime},a.attrelid,a.attnum,'INSERT WITH GRANT OPTION') or
                has_column_privilege(${runtime},a.attrelid,a.attnum,'UPDATE WITH GRANT OPTION') or
                (${table === "main_adviser_designation"} and has_column_privilege(${runtime},a.attrelid,a.attnum,'INSERT')))) as widened`;
        if (extra?.widened !== false) throw refuse();
        const [exposure] = await sql`select exists(select 1 from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
            where c.oid=${name}::regclass and a.grantee=0) or exists(select 1 from pg_attribute c cross join lateral aclexplode(c.attacl) a
            where c.attrelid=${name}::regclass and a.grantee=0) as public_access`;
        if (exposure?.public_access !== false) throw refuse();
        for (const role of ["anon", "authenticated"]) {
            const [exposure] = await sql`select has_table_privilege(${role},${name},'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or
                has_any_column_privilege(${role},${name},'SELECT,INSERT,UPDATE,REFERENCES') as exposed`;
            if (exposure?.exposed !== false) throw refuse();
        }
    }
    for (const privilege of ["USAGE", "SELECT", "UPDATE"]) {
        const [access] = await sql`select has_sequence_privilege(${runtime},${`public.${SUPERVISION_SEQUENCE}`},${privilege}) as allowed,
            has_sequence_privilege(${runtime},${`public.${SUPERVISION_SEQUENCE}`},${`${privilege} WITH GRANT OPTION`}) as grantable`;
        if (access?.allowed !== (privilege === "USAGE") || access.grantable !== false) throw refuse();
    }
    const [publicSequence] = await sql`select exists(select 1 from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('s',c.relowner))) a
        where c.oid=${`public.${SUPERVISION_SEQUENCE}`}::regclass and a.grantee=0) as public_access`;
    if (publicSequence?.public_access !== false) throw refuse();
    for (const role of ["anon", "authenticated"]) {
        const [access] = await sql`select has_sequence_privilege(${role},${`public.${SUPERVISION_SEQUENCE}`},'USAGE,SELECT,UPDATE') as exposed`;
        if (access?.exposed !== false) throw refuse();
    }
}

export async function grantSupervisionRuntime(sql: postgres.Sql) {
    const ledger = await sql`select id,hash,created_at::text as created_at from drizzle.__drizzle_migrations order by created_at,id`;
    verifySupervisionLedger(ledger.map(r => ({ id: r.id, hash: r.hash, created_at: r.created_at })), 18);
    await sql`grant select,update on table public.main_adviser_designation to thesishs_preview_runtime`;
    await sql`grant select,insert,update on table public.co_adviser_review_assignments to thesishs_preview_runtime`;
    await sql`grant usage on sequence public.co_adviser_review_assignments_id_seq to thesishs_preview_runtime`;
    await verifySupervisionRuntime(sql, true);
}
