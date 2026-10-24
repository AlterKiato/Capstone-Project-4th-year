// Pure orchestration: a single attempt and one independent durable inspection; never an automatic retry.
import { verifyPreviewLedger } from "./preview-migration-source";
import { PreviewSchemaAssertion } from "./preview-schema";
export type PreviewState = { target: string; empty: boolean; ledger: { hash: string; created_at: string }[]; catalog: string };

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
    if (!approval.execute || approval.source !== expectedSource) throw new Error("Preview initialization refused.");
    const before = await io.inspect();
    if (before.target !== approval.target || !before.empty || before.ledger.length) throw new Error("Preview target is not a verified empty application schema.");
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
    if (after.target !== before.target || after.catalog !== verifiedCatalog || after.ledger.length !== 15)
        throw new Error("Preview durable result does not match the verified migration result.");
    return "initialized-confirmed";
}
