import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readMigrationFiles } from "drizzle-orm/migrator";

// Exact reviewed 0000-0015 source. P.3C.1 prepares 0015 only; no database application is implied.
export const PREVIEW_SOURCE_DIGEST = "37824a5d2df42e54df9e50ee115c6eb7d6c42a94864c99aedfb1d63b4dbf51e0";
export function previewMigrationSource() {
    const migrations = readMigrationFiles({ migrationsFolder: "db/migrations" });
    const snapshotBytes = readFileSync("db/migrations/meta/0015_snapshot.json");
    const journalBytes = readFileSync("db/migrations/meta/_journal.json");
    const hash = createHash("sha256").update(JSON.stringify(migrations.map(m => ({ hash: m.hash, when: m.folderMillis }))))
        .update(snapshotBytes).update(journalBytes).digest("hex");
    if (migrations.length !== 16 || hash !== PREVIEW_SOURCE_DIGEST) throw new Error("Reviewed Preview migration source mismatch.");
    return { migrations, snapshot: JSON.parse(snapshotBytes.toString("utf8")), hash };
}

export function verifyPreviewLedger(ledger: { id?: number; hash: string; created_at: string }[], entries: 15 | 16 = 16) {
    const { migrations } = previewMigrationSource();
    if (ledger.length !== entries || ledger.some((r, i) => r.hash !== migrations[i].hash || r.created_at !== String(migrations[i].folderMillis)))
        throw new Error("Preview migration ledger mismatch.");
    // SERIAL values can skip after rollback. Migration identity/order comes from the pinned journal,
    // hash and timestamp pairs above; generated IDs must be valid and ordered, never consecutive.
    if (ledger.some(r => r.id !== undefined) && ledger.some((r, i) => !Number.isSafeInteger(r.id) || r.id! <= 0 ||
        i > 0 && r.id! <= ledger[i - 1].id!)) throw new Error("Preview migration ledger ID ordering mismatch.");
}
