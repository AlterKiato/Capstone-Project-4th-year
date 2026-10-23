import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readMigrationFiles } from "drizzle-orm/migrator";

// Exact committed 0000-0014 SQL/hash/timestamp order, snapshot and journal at Phase 10.2C closure.
export const PREVIEW_SOURCE_DIGEST = "f917e170f56d4623e085b8d3b70e8ba0758bb21c1994506dba51c6813954e031";
export function previewMigrationSource() {
    const migrations = readMigrationFiles({ migrationsFolder: "db/migrations" });
    const snapshotBytes = readFileSync("db/migrations/meta/0014_snapshot.json");
    const journalBytes = readFileSync("db/migrations/meta/_journal.json");
    const hash = createHash("sha256").update(JSON.stringify(migrations.map(m => ({ hash: m.hash, when: m.folderMillis }))))
        .update(snapshotBytes).update(journalBytes).digest("hex");
    if (migrations.length !== 15 || hash !== PREVIEW_SOURCE_DIGEST) throw new Error("Committed Preview migration source mismatch.");
    return { migrations, snapshot: JSON.parse(snapshotBytes.toString("utf8")), hash };
}

export function verifyPreviewLedger(ledger: { hash: string; created_at: string }[]) {
    const { migrations } = previewMigrationSource();
    if (ledger.length !== 15 || ledger.some((r, i) => r.hash !== migrations[i].hash || r.created_at !== String(migrations[i].folderMillis)))
        throw new Error("Preview migration ledger mismatch.");
}
