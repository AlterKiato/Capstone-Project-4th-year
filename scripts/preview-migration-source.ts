import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readMigrationFiles } from "drizzle-orm/migrator";

// Keep the exact reviewed 0000-0015 identity for legacy initialization/recovery.
// The workspace source is separately pinned; source readiness never implies database application.
export const PREVIEW_SOURCE_DIGEST = "37824a5d2df42e54df9e50ee115c6eb7d6c42a94864c99aedfb1d63b4dbf51e0";
export const WORKSPACE_SOURCE_DIGEST = "66ae30ee48e5aef8497b11015acbeb81fc339f9799eea6fe619361319385ffbc";

function reviewedSources() {
    const migrations = readMigrationFiles({ migrationsFolder: "db/migrations" });
    const baselineSnapshot = readFileSync("db/migrations/meta/0015_snapshot.json");
    const workspaceSnapshot = readFileSync("db/migrations/meta/0016_snapshot.json");
    const journalBytes = readFileSync("db/migrations/meta/_journal.json");
    const journal = JSON.parse(journalBytes.toString("utf8"));
    // This serialization exactly reproduces the pre-0016 journal bytes, verified before
    // generation. It is used only in memory; historical metadata is never rewritten.
    const baselineJournal = Buffer.from(JSON.stringify({ ...journal, entries: journal.entries.slice(0, 16) }, null, 2));
    const sourceHash = (count: number, snapshot: Buffer, bytes: Buffer) => createHash("sha256")
        .update(JSON.stringify(migrations.slice(0, count).map(m => ({ hash: m.hash, when: m.folderMillis }))))
        .update(snapshot).update(bytes).digest("hex");
    if (migrations.length !== 17 || journal.entries.length !== 17 || sourceHash(16, baselineSnapshot, baselineJournal) !== PREVIEW_SOURCE_DIGEST ||
        sourceHash(17, workspaceSnapshot, journalBytes) !== WORKSPACE_SOURCE_DIGEST)
        throw new Error("Reviewed Preview migration source mismatch.");
    return {
        baseline: { migrations: migrations.slice(0, 16), snapshot: JSON.parse(baselineSnapshot.toString("utf8")), hash: PREVIEW_SOURCE_DIGEST },
        workspace: { migrations, snapshot: JSON.parse(workspaceSnapshot.toString("utf8")), hash: WORKSPACE_SOURCE_DIGEST },
    };
}

/** Legacy 0015 operations stay bounded to exactly 16 migrations, even with 0016 on disk. */
export function previewMigrationSource() { return reviewedSources().baseline; }
/** Current generated source: 17 migrations through 0016, not a target-readiness assertion. */
export function workspaceMigrationSource() { return reviewedSources().workspace; }

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

function verifyLedger(ledger: Ledger, migrations: ReturnType<typeof readMigrationFiles>, entries: number) {
    if (ledger.length !== entries || ledger.some((r, i) => r.hash !== migrations[i].hash || r.created_at !== String(migrations[i].folderMillis)))
        throw new Error("Preview migration ledger mismatch.");
    // SERIAL values can skip after rollback. Migration identity/order comes from the pinned journal,
    // hash and timestamp pairs above; generated IDs must be valid and ordered, never consecutive.
    if (ledger.some(r => r.id !== undefined) && ledger.some((r, i) => !Number.isSafeInteger(r.id) || r.id! <= 0 ||
        i > 0 && r.id! <= ledger[i - 1].id!)) throw new Error("Preview migration ledger ID ordering mismatch.");
}
