import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readMigrationFiles } from "drizzle-orm/migrator";

// Keep the exact reviewed 0000-0015 identity for legacy initialization/recovery.
// The workspace source is separately pinned; source readiness never implies database application.
export const PREVIEW_SOURCE_DIGEST = "37824a5d2df42e54df9e50ee115c6eb7d6c42a94864c99aedfb1d63b4dbf51e0";
export const WORKSPACE_SOURCE_DIGEST = "66ae30ee48e5aef8497b11015acbeb81fc339f9799eea6fe619361319385ffbc";
export const SUPERVISION_SOURCE_DIGEST = "2e914ebc46baa807051618a2dc6542ec3f859b166bf4a759fca6f7a56a35ef40";

export const PROGRESS_SOURCE_DIGEST = "9cc94f061162696564eada77af9f67f1887f57b21c3df26ec595b60eafd07001";
export const REVISION_SOURCE_DIGEST = "cb722c3a6e278f30255ae2ba6eed528cf47da9cb73692d24eec287a459480a0c";

function reviewedSources() {
    const migrations = readMigrationFiles({ migrationsFolder: "db/migrations" });
    const baselineSnapshot = readFileSync("db/migrations/meta/0015_snapshot.json");
    const workspaceSnapshot = readFileSync("db/migrations/meta/0016_snapshot.json");
    const progressSnapshot = readFileSync("db/migrations/meta/0018_snapshot.json");
    const revisionSnapshot = readFileSync("db/migrations/meta/0019_snapshot.json");
    const supervisionSnapshot = readFileSync("db/migrations/meta/0017_snapshot.json");
    const journalBytes = readFileSync("db/migrations/meta/_journal.json");
    const journal = JSON.parse(journalBytes.toString("utf8"));
    // This serialization exactly reproduces the pre-0016 journal bytes, verified before
    // generation. It is used only in memory; historical metadata is never rewritten.
    const baselineJournal = Buffer.from(JSON.stringify({ ...journal, entries: journal.entries.slice(0, 16) }, null, 2));
    const workspaceJournal = Buffer.from(JSON.stringify({ ...journal, entries: journal.entries.slice(0, 17) }, null, 2));
    const supervisionJournal = Buffer.from(JSON.stringify({ ...journal, entries: journal.entries.slice(0, 18) }, null, 2));
    const progressJournal = Buffer.from(JSON.stringify({ ...journal, entries: journal.entries.slice(0, 19) }, null, 2));
    const sourceHash = (count: number, snapshot: Buffer, bytes: Buffer) => createHash("sha256")
        .update(JSON.stringify(migrations.slice(0, count).map(m => ({ hash: m.hash, when: m.folderMillis }))))
        .update(snapshot).update(bytes).digest("hex");
    if (migrations.length !== 20 || journal.entries.length !== 20 || sourceHash(16, baselineSnapshot, baselineJournal) !== PREVIEW_SOURCE_DIGEST ||
        sourceHash(17, workspaceSnapshot, workspaceJournal) !== WORKSPACE_SOURCE_DIGEST ||
        sourceHash(18, supervisionSnapshot, supervisionJournal) !== SUPERVISION_SOURCE_DIGEST ||
        sourceHash(19, progressSnapshot, progressJournal) !== PROGRESS_SOURCE_DIGEST || sourceHash(20, revisionSnapshot, journalBytes) !== REVISION_SOURCE_DIGEST)
        throw new Error("Reviewed Preview migration source mismatch.");
    return {
        baseline: { migrations: migrations.slice(0, 16), snapshot: JSON.parse(baselineSnapshot.toString("utf8")), hash: PREVIEW_SOURCE_DIGEST },
        workspace: { migrations: migrations.slice(0, 17), snapshot: JSON.parse(workspaceSnapshot.toString("utf8")), hash: WORKSPACE_SOURCE_DIGEST },
        progress: { migrations: migrations.slice(0, 19), snapshot: JSON.parse(progressSnapshot.toString("utf8")), hash: PROGRESS_SOURCE_DIGEST },
        revision: { migrations, snapshot: JSON.parse(revisionSnapshot.toString("utf8")), hash: REVISION_SOURCE_DIGEST },
        supervision: { migrations: migrations.slice(0, 18), snapshot: JSON.parse(supervisionSnapshot.toString("utf8")), hash: SUPERVISION_SOURCE_DIGEST },
    };
}

/** Legacy 0015 operations stay bounded to exactly 16 migrations, even with 0016 on disk. */
export function previewMigrationSource() { return reviewedSources().baseline; }
/** Current generated source: 17 migrations through 0016, not a target-readiness assertion. */
export function workspaceMigrationSource() { return reviewedSources().workspace; }
/** The separate 0017 upgrade consumes only the final entry after exact 0016 validation. */
export function supervisionMigrationSource() { return reviewedSources().supervision; }

type Ledger = { id?: number; hash: string; created_at: string }[];
export function verifyPreviewLedger(ledger: { id?: number; hash: string; created_at: string }[], entries: 15 | 16 = 16) {
    if (entries !== 15 && entries !== 16) throw new Error("Preview migration ledger version refused.");
    const { migrations } = previewMigrationSource();
    verifyLedger(ledger, migrations, entries);
}

export function verifyWorkspaceLedger(ledger: Ledger, entries: 16 | 17 = 17) {
    if (entries !== 16 && entries !== 17) throw new Error("Workspace migration ledger version refused.");
    const { migrations } = workspaceMigrationSource();
    verifyLedger(ledger, migrations, entries);
}

/** Both known states require every hash/timestamp and valid ordered IDs. Neither verifies catalog/grants. */
export function recognizeWorkspaceLedger(ledger: Ledger) {
    if (ledger.length === 16) {
        verifyWorkspaceLedger(ledger, 16);
        return { state: "pre-workspace", entries: 16 } as const;
    }
    verifyWorkspaceLedger(ledger, 17);
    return { state: "workspace-recorded", entries: 17 } as const;
}

export function verifySupervisionLedger(ledger: Ledger, entries: 17 | 18 = 18) {
    if (entries !== 17 && entries !== 18) throw new Error("Supervision migration ledger version refused.");
    verifyLedger(ledger, supervisionMigrationSource().migrations, entries);
}

/** Recognition permits inspection of an installed target; execution still requires exactly 17. */
export function recognizeSupervisionLedger(ledger: Ledger) {
    const entries = ledger.length === 17 ? 17 : 18;
    verifySupervisionLedger(ledger, entries);
    return { state: entries === 17 ? "pre-supervision" : "supervision-recorded", entries } as const;
}

function verifyLedger(ledger: Ledger, migrations: ReturnType<typeof readMigrationFiles>, entries: number) {
    if (ledger.length !== entries || ledger.some((r, i) => r.hash !== migrations[i].hash || r.created_at !== String(migrations[i].folderMillis)))
        throw new Error("Preview migration ledger mismatch.");
    // SERIAL values can skip after rollback. Migration identity/order comes from the pinned journal,
    // hash and timestamp pairs above; generated IDs must be valid and ordered, never consecutive.
    if (ledger.some(r => r.id !== undefined) && ledger.some((r, i) => !Number.isSafeInteger(r.id) || r.id! <= 0 ||
        i > 0 && r.id! <= ledger[i - 1].id!)) throw new Error("Preview migration ledger ID ordering mismatch.");
}

/** 0018 source readiness only; no database access. */
export function progressMigrationSource() { return reviewedSources().progress; }
export function verifyProgressLedger(ledger: Ledger, entries: 18 | 19 = 19) {
    if (entries !== 18 && entries !== 19) throw new Error("Progress migration ledger version refused.");
    verifyLedger(ledger, progressMigrationSource().migrations, entries);
}
export function recognizeProgressLedger(ledger: Ledger) {
    const entries = ledger.length === 18 ? 18 : 19;
    verifyProgressLedger(ledger, entries);
    return { entries } as const;
}

export function revisionMigrationSource() { return reviewedSources().revision; }
export function verifyRevisionLedger(ledger: Ledger, entries: 19 | 20 = 20) {
    if (entries !== 19 && entries !== 20) throw new Error("Revision migration ledger version refused.");
    verifyLedger(ledger, revisionMigrationSource().migrations, entries);
}
export function recognizeRevisionLedger(ledger: Ledger) {
    const entries = ledger.length === 19 ? 19 : 20;
    verifyRevisionLedger(ledger, entries);
    return { entries } as const;
}
