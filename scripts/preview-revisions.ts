// Import-safe 0019 policy. No environment reads, connections or execution on import.
import type postgres from "postgres";
import { verifyRevisionLedger } from "./preview-migration-source";
import type { PreviewState } from "./preview-initialization";
export const REVISION_TABLES = ["revision_items", "revision_responses"];
const role = "thesishs_preview_runtime";
const refuse = () => new Error("Preview revision prerequisites not verified.");

export async function verifyRevisionRuntime(sql: postgres.Sql, installed: boolean) {
    if (!installed) return;
    for (const name of REVISION_TABLES) {
        const table = `public.${name}`, sequence = `${table}_id_seq`;
        const expected = name === "revision_items" ? ["SELECT", "INSERT"] : ["SELECT", "INSERT", "UPDATE"];
        for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER", "MAINTAIN"]) {
            const [access] = await sql`select has_table_privilege(${role},${table},${privilege}) as allowed,
                has_table_privilege(${role},${table},${`${privilege} WITH GRANT OPTION`}) as grantable`;
            if (access?.allowed !== expected.includes(privilege) || access.grantable !== false) throw refuse();
        }
        const [columns] = await sql`select exists(select 1 from pg_attribute a where a.attrelid=${table}::regclass and a.attnum>0 and not a.attisdropped
            and (has_column_privilege(${role},a.attrelid,a.attnum,'REFERENCES') or has_column_privilege(${role},a.attrelid,a.attnum,'SELECT WITH GRANT OPTION')
            or has_column_privilege(${role},a.attrelid,a.attnum,'INSERT WITH GRANT OPTION') or has_column_privilege(${role},a.attrelid,a.attnum,'UPDATE WITH GRANT OPTION')
            or (${name}='revision_items' and has_column_privilege(${role},a.attrelid,a.attnum,'UPDATE')))) as widened`;
        if (columns?.widened !== false) throw refuse();
        for (const privilege of ["USAGE", "SELECT", "UPDATE"]) {
            const [access] = await sql`select has_sequence_privilege(${role},${sequence},${privilege}) as allowed,
                has_sequence_privilege(${role},${sequence},${`${privilege} WITH GRANT OPTION`}) as grantable`;
            if (access?.allowed !== (privilege === "USAGE") || access.grantable !== false) throw refuse();
        }
        for (const denied of ["anon", "authenticated"]) {
            const [access] = await sql`select has_table_privilege(${denied},${table},'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or
                has_any_column_privilege(${denied},${table},'SELECT,INSERT,UPDATE,REFERENCES') or has_sequence_privilege(${denied},${sequence},'USAGE,SELECT,UPDATE') as exposed`;
            if (access?.exposed !== false) throw refuse();
        }
        const [publicAccess] = await sql`select exists(select 1 from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault(case when c.relkind='S' then 's'::"char" else 'r'::"char" end,c.relowner))) a
            where c.oid in (${table}::regclass,${sequence}::regclass) and a.grantee=0) or exists(select 1 from pg_attribute c cross join lateral aclexplode(c.attacl) a where c.attrelid=${table}::regclass and a.grantee=0) as exposed`;
        if (publicAccess?.exposed !== false) throw refuse();
    }
}
export async function grantRevisionRuntime(sql: postgres.Sql) {
    const ledger = await sql`select id,hash,created_at::text as created_at from drizzle.__drizzle_migrations order by created_at,id`;
    verifyRevisionLedger(ledger.map(row => ({ id: row.id, hash: row.hash, created_at: row.created_at })), 20);
    await sql`grant select,insert on table public.revision_items to thesishs_preview_runtime`;
    await sql`grant select,insert,update on table public.revision_responses to thesishs_preview_runtime`;
    await sql`grant usage on sequence public.revision_items_id_seq,public.revision_responses_id_seq to thesishs_preview_runtime`;
    await verifyRevisionRuntime(sql, true);
}
export async function upgradePreview0019(io: { inspect(): Promise<PreviewState>; apply(before: PreviewState): Promise<string> },
    approval: { execute: boolean; target: string; source: string }, expectedSource: string) {
    if (!approval.execute || approval.source !== expectedSource) throw refuse();
    const before = await io.inspect();
    verifyRevisionLedger(before.ledger, 19);
    if (before.empty || !before.preservedData || before.target !== approval.target) throw refuse();
    let catalog: string;
    try { catalog = await io.apply(before); }
    catch { try { await io.inspect(); } catch { /* Inspect durable state; never retry writes automatically. */ } throw new Error("Preview revision execution unconfirmed; inspect durable state before retrying."); }
    const after = await io.inspect();
    verifyRevisionLedger(after.ledger, 20);
    if (after.target !== before.target || after.catalog !== catalog || after.preservedData !== before.preservedData) throw refuse();
    return "upgraded-0019-confirmed";
}
