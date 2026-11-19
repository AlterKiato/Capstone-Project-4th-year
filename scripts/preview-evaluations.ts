// Helpers for the established Preview operator. Importing never reads credentials or connects.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import type postgres from "postgres";
import { privateFile } from "./upload-acceptance-safety";
import { coEvaluationMigrationSource, emailOtpMigrationSource, verifyEvaluationLedger } from "./preview-migration-source";
import type { PreviewState } from "./preview-initialization";

export const EVALUATION_TABLES = ["evaluation_templates", "evaluation_template_criteria", "submission_evaluation_assignments", "submission_evaluations", "submission_evaluation_items"];
export const EVALUATION_SEQUENCES = ["evaluation_templates_id_seq", "submission_evaluation_assignments_id_seq", "submission_evaluations_id_seq"];
export const IMMUTABLE_TABLES = ["submission_evaluation_assignments", "submission_evaluations", "submission_evaluation_items"];
const runtime = "thesishs_preview_runtime";
const refuse = () => new Error("Preview evaluation prerequisites not verified.");
const digest = (value: Buffer) => createHash("sha256").update(value).digest("hex");

export function isEvaluationAddedColumn(table: string, column: string) {
    return table === "co_adviser_review_assignments" && ["evaluation_assignment_id", "evaluation"].includes(column);
}
export function isEvaluationAddedConstraint(table: string, name: string) {
    return table === "co_adviser_review_assignments" && ["co_recommendation_exact_evaluation_fk", "co_recommendation_evaluation_check"].includes(name);
}

/** SELECT-only contract for the function/triggers not represented in Drizzle snapshots. */
export async function verifyEvaluationRoutines(sql: postgres.Sql) {
    const functions = await sql`select p.oid::text as oid,p.proname,p.prokind::text,p.pronargs,p.prorettype='trigger'::regtype as trigger_return,
        p.proretset,p.prosecdef,p.proleakproof,p.proisstrict,p.provolatile::text,p.proparallel::text,p.proconfig,p.prosrc,
        l.lanname,p.proowner=(select oid from pg_roles where rolname=current_user) as owned
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
        where n.nspname='public' and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e') order by p.proname`;
    assert.equal(functions.length, 1);
    const f = functions[0];
    const statement = coEvaluationMigrationSource().migrations[22].sql.find(s => s.includes("CREATE FUNCTION public.prevent_submission_evaluation_mutation()"));
    assert.ok(statement);
    const body = statement.split("$$")[1].replaceAll("\r\n", "\n");
    assert.deepEqual({ ...f, oid: undefined, prosrc: undefined }, {
        oid: undefined, proname: "prevent_submission_evaluation_mutation", prokind: "f", pronargs: 0, trigger_return: true,
        proretset: false, prosecdef: false, proleakproof: false, proisstrict: false, provolatile: "v", proparallel: "u",
        proconfig: ["search_path=pg_catalog"], prosrc: undefined, lanname: "plpgsql", owned: true,
    });
    assert.equal(String(f.prosrc).replaceAll("\r\n", "\n"), body);
    const triggers = await sql`select c.relname,g.tgname,g.tgfoid::text as function_oid,g.tgtype,g.tgenabled::text,
        g.tgnargs,g.tgattr::text,g.tgqual is null as no_when,encode(g.tgargs,'hex') as args,
        g.tgconstraint=0 as no_constraint,g.tgdeferrable,g.tginitdeferred,g.tgoldtable,g.tgnewtable
        from pg_trigger g join pg_class c on c.oid=g.tgrelid join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and not g.tgisinternal order by c.relname,g.tgname`;
    const expected = IMMUTABLE_TABLES.flatMap(table => [
        { table, name: `${table}_immutable`, type: 27 }, { table, name: `${table}_no_truncate`, type: 34 },
    ]).sort((a, b) => a.table.localeCompare(b.table) || a.name.localeCompare(b.name));
    assert.equal(triggers.length, expected.length);
    for (let i = 0; i < triggers.length; i++) {
        assert.deepEqual({ ...triggers[i] }, { relname: expected[i].table, tgname: expected[i].name, function_oid: f.oid,
            tgtype: expected[i].type, tgenabled: "O", tgnargs: 0, tgattr: "", no_when: true, args: "", no_constraint: true,
            tgdeferrable: false, tginitdeferred: false, tgoldtable: null, tgnewtable: null });
    }
}

export const EVALUATION_RIGHTS: Record<string, string[]> = {
    evaluation_templates: ["SELECT", "INSERT", "UPDATE"], evaluation_template_criteria: ["SELECT", "INSERT", "DELETE"],
    submission_evaluation_assignments: ["SELECT", "INSERT"], submission_evaluations: ["SELECT", "INSERT"], submission_evaluation_items: ["SELECT", "INSERT"],
};
export async function verifyEvaluationRuntime(sql: postgres.Sql, installed: boolean) {
    if (!installed) return;
    for (const table of EVALUATION_TABLES) {
        const name = `public.${table}`;
        for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER", "MAINTAIN"]) {
            const [r] = await sql`select has_table_privilege(${runtime},${name},${privilege}) as allowed,
                has_table_privilege(${runtime},${name},${`${privilege} WITH GRANT OPTION`}) as grantable`;
            if (r.allowed !== EVALUATION_RIGHTS[table].includes(privilege) || r.grantable !== false) throw refuse();
        }
        const [columns] = await sql`select exists(select 1 from pg_attribute a where a.attrelid=${name}::regclass and a.attnum>0 and not a.attisdropped
            and (has_column_privilege(${runtime},a.attrelid,a.attnum,'REFERENCES') or has_column_privilege(${runtime},a.attrelid,a.attnum,'SELECT WITH GRANT OPTION')
                or has_column_privilege(${runtime},a.attrelid,a.attnum,'INSERT WITH GRANT OPTION') or has_column_privilege(${runtime},a.attrelid,a.attnum,'UPDATE WITH GRANT OPTION')
                or (${table !== "evaluation_templates"} and has_column_privilege(${runtime},a.attrelid,a.attnum,'UPDATE')))) as extra`;
        if (columns.extra !== false) throw refuse();
    }
    for (const sequence of EVALUATION_SEQUENCES) for (const privilege of ["USAGE", "SELECT", "UPDATE"]) {
        const [r] = await sql`select has_sequence_privilege(${runtime},${`public.${sequence}`},${privilege}) as allowed,
            has_sequence_privilege(${runtime},${`public.${sequence}`},${`${privilege} WITH GRANT OPTION`}) as grantable`;
        if (r.allowed !== (privilege === "USAGE") || r.grantable !== false) throw refuse();
    }
    for (const role of ["anon", "authenticated"]) {
        for (const table of EVALUATION_TABLES) {
            const [r] = await sql`select has_table_privilege(${role},${`public.${table}`},'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') or
                has_any_column_privilege(${role},${`public.${table}`},'SELECT,INSERT,UPDATE,REFERENCES') as exposed`;
            if (r.exposed !== false) throw refuse();
        }
        for (const sequence of EVALUATION_SEQUENCES) {
            const [r] = await sql`select has_sequence_privilege(${role},${`public.${sequence}`},'USAGE,SELECT,UPDATE') as exposed`;
            if (r.exposed !== false) throw refuse();
        }
    }
    const [exposure] = await sql`select exists(select 1 from pg_class c cross join lateral aclexplode(coalesce(c.relacl,
        acldefault(case when c.relkind='S' then 's'::"char" else 'r'::"char" end,c.relowner))) a
        where c.relnamespace='public'::regnamespace and c.relname=any(${[...EVALUATION_TABLES, ...EVALUATION_SEQUENCES]}::text[]) and a.grantee=0)
        or exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid cross join lateral aclexplode(a.attacl) x
            where c.relnamespace='public'::regnamespace and c.relname=any(${EVALUATION_TABLES}::text[]) and x.grantee=0)
        or exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
            where p.oid='public.prevent_submission_evaluation_mutation()'::regprocedure and a.grantee<>p.proowner) as exposed`;
    if (exposure.exposed !== false) throw refuse();
}

export async function grantEvaluationRuntime(sql: postgres.Sql) {
    const rows = await sql`select id,hash,created_at::text as created_at from drizzle.__drizzle_migrations order by created_at,id`;
    verifyEvaluationLedger(rows.map(r => ({ id: r.id, hash: r.hash, created_at: r.created_at })), 24);
    await sql`grant select,insert,update on table public.evaluation_templates to thesishs_preview_runtime`;
    await sql`grant select,insert,delete on table public.evaluation_template_criteria to thesishs_preview_runtime`;
    await sql`grant select,insert on table public.submission_evaluation_assignments,public.submission_evaluations,public.submission_evaluation_items to thesishs_preview_runtime`;
    await sql`grant usage on sequence public.evaluation_templates_id_seq,public.submission_evaluation_assignments_id_seq,public.submission_evaluations_id_seq to thesishs_preview_runtime`;
    // Trigger creation is owner-only. Runtime trigger firing needs no function EXECUTE grant.
    await sql`revoke all on function public.prevent_submission_evaluation_mutation() from public`;
    await verifyEvaluationRuntime(sql, true);
}

export function verifyEvaluationBackup(record: unknown, archive: Buffer, before: PreviewState, now = Date.now()) {
    const r = record as Record<string, unknown>;
    verifyEvaluationLedger(before.ledger, 21);
    const tables = Object.values(emailOtpMigrationSource().snapshot.tables).map((t: unknown) => (t as { name: string }).name).sort();
    const when = typeof r?.verifiedAt === "string" ? Date.parse(r.verifiedAt) : NaN;
    if (!r || r.version !== 1 || r.scope !== "preview-evaluation-0021-0023-backup" || r.projectRef !== "cbkplqkkjuoglpimwmib" ||
        r.database !== "postgres" || r.databaseOid !== "5" || r.cluster !== "7678069749886157684" ||
        r.source !== coEvaluationMigrationSource().hash || r.target !== before.target || r.catalog !== before.catalog ||
        !before.preservedData || r.preservedData !== before.preservedData || r.archiveSha256 !== digest(archive) || archive.length <= 1024 ||
        archive.subarray(0, 5).toString("ascii") !== "PGDMP" || r.inventoryVerified !== true || r.fullArchiveDecoded !== true ||
        r.privateStorageVerified !== true || r.ledgerIncluded !== true || r.sequencesIncluded !== true || r.privilegesRecorded !== true ||
        !Array.isArray(r.tables) || JSON.stringify([...r.tables].sort()) !== JSON.stringify(tables) ||
        !Number.isFinite(when) || when > now || now - when > 900000) throw refuse();
    return { sha256: digest(archive) };
}
export function readEvaluationBackup(evidencePath: string, confirmedHash: string, before: PreviewState) {
    try {
        assert.match(confirmedHash, /^[a-f0-9]{64}$/);
        const file = privateFile(evidencePath);
        if (statSync(file).size > 65536) throw refuse();
        const r = JSON.parse(readFileSync(file, "utf8"));
        const archive = privateFile(r.archivePath);
        if (statSync(archive).size > 64 * 1024 * 1024) throw refuse();
        const result = verifyEvaluationBackup(r, readFileSync(archive), before);
        if (result.sha256 !== confirmedHash) throw refuse();
        return result;
    } catch { throw refuse(); }
}

export async function upgradePreviewEvaluations(io: { inspect(): Promise<PreviewState>; apply(before: PreviewState): Promise<string> },
    approval: { execute: boolean; target: string; source: string }) {
    if (!approval.execute || approval.source !== coEvaluationMigrationSource().hash) throw refuse();
    const before = await io.inspect();
    verifyEvaluationLedger(before.ledger, 21);
    if (before.empty || !before.preservedData || before.target !== approval.target) throw refuse();
    let catalog: string;
    try { catalog = await io.apply(before); }
    catch { try { await io.inspect(); } catch { /* One durable read only; never replay. */ } throw new Error("Evaluation execution unconfirmed; inspect durable state before any further operation."); }
    const after = await io.inspect();
    verifyEvaluationLedger(after.ledger, 24);
    if (after.target !== before.target || after.catalog !== catalog || after.preservedData !== before.preservedData) throw refuse();
    return "upgraded-evaluation-0021-0023-confirmed";
}
