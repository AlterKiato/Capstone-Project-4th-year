// Import-safe 0020 policy: existing records/ACLs are preserved; no automatic grants.
import type postgres from "postgres";
import type { PreviewState } from "./preview-initialization";
import { verifyEmailOtpLedger } from "./preview-migration-source";

export function isOtpAddedColumn(table: string, column: string) {
    return table === "users" && column === "email_verification_required" || table === "email_verification_requests" && column === "failed_attempts";
}
export function isOtpAddedConstraint(table: string, name: string) {
    return table === "email_verification_requests" && ["email_verification_attempts_check", "email_verification_requests_failed_attempts_not_null"].includes(name) ||
        table === "users" && name === "users_email_verification_required_not_null";
}
export async function verifyEmailOtpRuntime(sql: postgres.Sql, installed: boolean) {
    const required: [string, string, string][] = [
        ["users", "email_verified_at", "SELECT"], ["users", "email_verified_at", "UPDATE"],
        ["email_verification_requests", "token_digest", "SELECT"], ["email_verification_requests", "token_digest", "INSERT"],
        ["email_verification_requests", "token_digest", "UPDATE"],
        ...(installed ? [["users", "email_verification_required", "SELECT"], ["users", "email_verification_required", "INSERT"],
            ["email_verification_requests", "failed_attempts", "SELECT"], ["email_verification_requests", "failed_attempts", "INSERT"],
            ["email_verification_requests", "failed_attempts", "UPDATE"]] as [string, string, string][] : []),
    ];
    for (const [table, column, privilege] of required) {
        const [access] = await sql`select has_column_privilege('thesishs_preview_runtime',${`public.${table}`},${column},${privilege}) as allowed`;
        if (!access?.allowed) throw new Error("Email OTP runtime permissions require separate review.");
    }
}
export async function upgradePreview0020(io: { inspect(): Promise<PreviewState>; apply(before: PreviewState): Promise<string> },
    approval: { execute: boolean; target: string; source: string }, expectedSource: string) {
    if (!approval.execute || approval.source !== expectedSource) throw new Error("Email OTP approval refused.");
    const before = await io.inspect();
    verifyEmailOtpLedger(before.ledger, 20);
    if (before.empty || !before.preservedData || before.target !== approval.target) throw new Error("Email OTP baseline refused.");
    let catalog: string;
    try { catalog = await io.apply(before); }
    catch { try { await io.inspect(); } catch { /* Durable inspection only; never retry a write. */ } throw new Error("Email OTP execution unconfirmed. Inspect durable state before retrying."); }
    const after = await io.inspect();
    verifyEmailOtpLedger(after.ledger, 21);
    if (after.target !== before.target || after.catalog !== catalog || after.preservedData !== before.preservedData)
        throw new Error("Email OTP preservation could not be confirmed.");
    return "upgraded-0020-confirmed";
}
