// Explicit helpers only: importing this file never connects, provisions, authenticates or deletes.
import bcrypt from "bcrypt";
import { digest, inspectState, validateIdentity, validateState, refuse, CLUSTER, DATABASE_OID } from "./upload-acceptance-safety";
import type { OperatorSql } from "./upload-acceptance-safety";

const tags = ["student-a", "student-b", "student-c", "adviser", "admin"] as const;
export type FixtureTag = typeof tags[number];
export type FixtureManifest = { run: string; target: string; users: Record<FixtureTag, number>; groups: number[]; papers: number[] };
type Approval = { execute: boolean; operation: "create" | "remove-pristine"; confirmRun: string; confirmTarget: string };
export function fixturePlan(run: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(run)) throw refuse();
    const marker = `UPLOAD_${run}`;
    return { run, marker, accounts: tags.map((tag, index) => ({ tag, email: `upload-${run}-${tag}@example.invalid`, role: index < 3 ? 3 : index === 3 ? 2 : 1 })),
        groupNames: [`${marker}_a`, `${marker}_b`], titles: [`${marker}_paper_a`, `${marker}_paper_b`, `${marker}_paper_c`] };
}
export function validateManifest(manifest: FixtureManifest) {
    fixturePlan(manifest.run);
    const ids = [...Object.values(manifest.users), ...manifest.groups, ...manifest.papers];
    if (!/^[a-f0-9]{64}$/.test(manifest.target) || digest(Object.keys(manifest.users).sort()) !== digest([...tags].sort()) ||
        manifest.groups.length !== 2 || manifest.papers.length !== 3 || ids.some(n => !Number.isSafeInteger(n) || n <= 0) ||
        new Set(Object.values(manifest.users)).size !== 5 || new Set(manifest.groups).size !== 2 || new Set(manifest.papers).size !== 3) throw refuse();
}
function approved(approval: Approval, run: string, operation: Approval["operation"], target: string) {
    fixturePlan(run);
    if (!approval.execute || approval.operation !== operation || approval.confirmRun !== run || approval.confirmTarget !== target) throw refuse();
}
async function scope(tx: OperatorSql, target: string) {
    const state = await inspectState(tx); validateIdentity(state.identity, { cluster: CLUSTER, oid: DATABASE_OID }); validateState(state, true);
    if (state.target !== target) throw refuse();
}
async function transaction<T>(client: OperatorSql, run: string, operation: (tx: OperatorSql) => Promise<T>) {
    return client.begin(async raw => {
        const tx = raw as unknown as OperatorSql;
        await tx`set local lock_timeout = '3s'`; await tx`set local statement_timeout = '5s'`;
        await tx`select pg_advisory_xact_lock(1296388938,hashtext(${run}))`;
        return operation(tx);
    }) as Promise<T>;
}
export async function createUploadFixtures(client: OperatorSql, run: string, target: string,
    credentials: Record<FixtureTag, string>, approval: Approval): Promise<FixtureManifest> {
    try {
        approved(approval, run, "create", target);
        const plan = fixturePlan(run);
        if (tags.some(tag => typeof credentials[tag] !== "string" || credentials[tag].length < 16 || Buffer.byteLength(credentials[tag], "utf8") > 72)) throw refuse();
        // Generate hashes before acquiring database locks. Never return or log passwords/hashes.
        const hashes = Object.fromEntries(await Promise.all(tags.map(async tag => [tag, await bcrypt.hash(credentials[tag], 12)])));
        return await transaction(client, run, async tx => {
            await scope(tx, target);
            const roles = await tx`select id,name from role order by id`;
            for (const [id, name] of [[1, "Admin"], [2, "Adviser"], [3, "Student"], [4, "Panel"]])
                if (!roles.some(row => row.id === id && row.name === name)) throw refuse();
            const users = {} as Record<FixtureTag, number>;
            for (const account of plan.accounts) {
                const rows = await tx`select id,first_name,last_name,role_id,is_active,password from users where lower(email)=lower(${account.email}) for update`;
                if (rows.length > 1) throw refuse();
                if (rows.length) {
                    const row = rows[0];
                    if (row.first_name !== plan.marker || row.last_name !== account.tag || row.role_id !== account.role || !row.is_active || !await bcrypt.compare(credentials[account.tag], row.password)) throw refuse();
                    users[account.tag] = row.id;
                } else {
                    const [row] = await tx`insert into users(first_name,last_name,email,password,role_id,is_active)
                        values(${plan.marker},${account.tag},${account.email},${hashes[account.tag]},${account.role},true) returning id`;
                    users[account.tag] = row.id;
                }
            }
            const groups: number[] = [], papers: number[] = [];
            for (const name of plan.groupNames) {
                const rows = await tx`select * from research_groups where group_name=${name} for update`;
                if (rows.length > 1 || rows.some(row => row.adviser_id !== users.adviser || row.status !== "active" || row.strand !== "TEST" || row.section !== "C3B" || row.school_year !== "TEST")) throw refuse();
                if (rows.length) groups.push(rows[0].id);
                else { const [row] = await tx`insert into research_groups(group_name,strand,section,school_year,adviser_id) values(${name},'TEST','C3B','TEST',${users.adviser}) returning id`; groups.push(row.id); }
            }
            for (const [index, tag] of (["student-a", "student-b", "student-c"] as const).entries()) {
                const group = groups[index === 2 ? 1 : 0];
                const members = await tx`select group_id from group_members where user_id=${users[tag]} for update`;
                if (members.length > 1 || members.some(m => m.group_id !== group)) throw refuse();
                if (!members.length) await tx`insert into group_members(group_id,user_id) values(${group},${users[tag]})`;
            }
            for (const [index, title] of plan.titles.entries()) {
                const group = groups[index === 2 ? 1 : 0];
                const rows = await tx`select id,group_id,status,abstract from research_papers where title=${title} for update`;
                if (rows.length > 1 || rows.some(row => row.group_id !== group || row.status !== "Draft" || row.abstract !== plan.marker)) throw refuse();
                if (rows.length) papers.push(rows[0].id);
                else { const [row] = await tx`insert into research_papers(group_id,title,abstract) values(${group},${title},${plan.marker}) returning id`; papers.push(row.id); }
            }
            return { run, target, users, groups, papers };
        });
    } catch { throw refuse(); }
}

// Deliberately refuses research-bearing runs. Live-upload fixtures/tombstones remain until separately reviewed Storage-aware cleanup.
export async function removePristineUploadFixtures(client: OperatorSql, manifest: FixtureManifest, approval: Approval) {
    try {
        validateManifest(manifest); approved(approval, manifest.run, "remove-pristine", manifest.target);
        const plan = fixturePlan(manifest.run), ids = Object.values(manifest.users);
        return await transaction(client, manifest.run, async tx => {
            await scope(tx, manifest.target);
            // Lock the owned parents first; FKs then prevent concurrent new references while checking/deleting.
            const users = await tx`select id,email,first_name,last_name,role_id from users where id in ${tx(ids)} for update`;
            const groups = await tx`select id,group_name,adviser_id from research_groups where id in ${tx(manifest.groups)} for update`;
            const papers = await tx`select id,title,group_id,abstract,status from research_papers where group_id in ${tx(manifest.groups)} or id in ${tx(manifest.papers)} for update`;
            if (!users.length && !groups.length && !papers.length) return "already-removed";
            if (users.length !== 5 || groups.length !== 2 || papers.length !== 3 ||
                plan.accounts.some(a => !users.some(u => u.id === manifest.users[a.tag] && u.email === a.email && u.first_name === plan.marker && u.last_name === a.tag && u.role_id === a.role)) ||
                plan.groupNames.some((name, i) => !groups.some(g => g.id === manifest.groups[i] && g.group_name === name && g.adviser_id === manifest.users.adviser)) ||
                plan.titles.some((title, i) => !papers.some(p => p.id === manifest.papers[i] && p.title === title && p.group_id === manifest.groups[i === 2 ? 1 : 0] && p.abstract === plan.marker && p.status === "Draft"))) throw refuse();
            const memberships = await tx`select user_id,group_id from group_members where user_id in ${tx(ids)} or group_id in ${tx(manifest.groups)} for update`;
            const expected = ["student-a", "student-b", "student-c"].map((tag, i) => ({ user_id: manifest.users[tag as FixtureTag], group_id: manifest.groups[i === 2 ? 1 : 0] }));
            if (memberships.length !== 3 || expected.some(e => !memberships.some(m => m.user_id === e.user_id && m.group_id === e.group_id))) throw refuse();
            const [references] = await tx`select exists(select 1 from submission_upload_intents where student_id in ${tx(ids)} or paper_id in ${tx(manifest.papers)}) or
                exists(select 1 from submissions where submitted_by in ${tx(ids)} or paper_id in ${tx(manifest.papers)}) or
                exists(select 1 from notifications where user_id in ${tx(ids)}) or exists(select 1 from activity_logs where user_id in ${tx(ids)}) as present`;
            if (references.present) throw refuse();
            await tx`delete from group_members where user_id in ${tx(ids)} and group_id in ${tx(manifest.groups)}`;
            await tx`delete from research_papers where id in ${tx(manifest.papers)} and group_id in ${tx(manifest.groups)}`;
            await tx`delete from research_groups where id in ${tx(manifest.groups)} and adviser_id=${manifest.users.adviser}`;
            await tx`delete from users where id in ${tx(ids)} and first_name=${plan.marker}`;
            return "removed-pristine";
        });
    } catch { throw refuse(); }
}
