// Pure orchestration: a single attempt and one independent durable inspection; never an automatic retry.
import { verifyPreviewLedger } from "./preview-migration-source";
export type PreviewState = { target: string; empty: boolean; ledger: { hash: string; created_at: string }[]; catalog: string };
export async function initializePreview(io: {
    inspect(): Promise<PreviewState>; apply(before: PreviewState): Promise<string>;
}, approval: { execute: boolean; target: string; source: string }, expectedSource: string) {
    if (!approval.execute || approval.source !== expectedSource) throw new Error("Preview initialization refused.");
    const before = await io.inspect();
    if (before.target !== approval.target || !before.empty || before.ledger.length) throw new Error("Preview target is not a verified empty application schema.");
    let verifiedCatalog: string | undefined;
    try {
        verifiedCatalog = await io.apply(before);
    } catch {
        // Inspect even if rollback/commit acknowledgement was uncertain. No replay, DROP or restore.
        await io.inspect();
        throw new Error("Preview initialization unconfirmed; review durable state before any further attempt.");
    }
    const after = await io.inspect();
    verifyPreviewLedger(after.ledger);
    if (after.target !== before.target || after.catalog !== verifiedCatalog || after.ledger.length !== 15)
        throw new Error("Preview durable result does not match the verified migration result.");
    return "initialized-confirmed";
}
