/* eslint-disable @typescript-eslint/no-require-imports */
// Only exact run-owned synthetic PostgreSQL fixtures. Storage signer is a test double;
// no Supabase objects, credentials, migrations, real accounts or governance events.
const assert = require('node:assert/strict');
const Module = require('node:module');
require('dotenv/config');
const target = new URL(process.env.DATABASE_URL);
assert.equal(target.hostname, 'localhost'); assert.equal(target.port, '5432'); assert.equal(target.pathname, '/thesishs_ai');
let session, rejectObject = false, signed = 0;
const original = Module._load;
Module._load = function(id, ...args) {
    if (id === 'server-only') return {};
    if (id === '@/lib/auth/session') return { getSession: async () => session };
    if (id === 'next/cache') return { revalidatePath() {} };
    if (id === 'next/navigation') return { redirect: path => { throw Error('REDIRECT ' + path); } };
    if (id === '@/lib/services/storage.service') return { createResearchDocumentSignedUrl: async (path, ttl) => { signed++; assert.ok(path.endsWith('/synthetic.pdf')); assert.equal(ttl, 300); if (rejectObject) throw Error('Synthetic absent object'); return 'synthetic-only'; } };
    return original.call(this, id, ...args);
};
const { db } = require('../lib/db.ts');
const { sql } = require('drizzle-orm');
const groups = require('../lib/services/research-group.services.ts');
const actions = require('../lib/actions/research-group.action.ts');
const repoActions = require('../lib/actions/repository.action.ts');
const { updateResearchGroupStatusForAdmin } = require('../lib/repositories/research-group.repository.ts');
const { getRepositoryManagementData } = require('../lib/services/repository.service.ts');
const { publishResearch } = require('../lib/services/repository-publication.service.ts');
const marker = 'PHASE977C_SECURITY_' + Date.now();
const ids = [], groupIds = [], papers = [];
const row = async query => (await db.execute(query))[0];
const list = values => values.length ? sql.join(values.map(value => sql`${value}`), sql`, `) : sql`NULL`;
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const form = (key, id, published) => { const data = new FormData(); data.set(key, String(id)); if (published !== undefined) data.set('publish', String(published)); return data; };
const initial = { success: false, message: '' };
async function snapshot() { return JSON.stringify(await db.execute(sql`SELECT id,status,updated_at FROM research_groups WHERE id IN (${list(groupIds)}) ORDER BY id`)); }
async function waitBlocked(applicationName) {
    for (let i = 0; i < 100; i++) {
        if (Number((await row(sql`SELECT count(*) n FROM pg_stat_activity WHERE application_name=${applicationName} AND wait_event_type='Lock'`)).n)) return;
        await wait(20);
    }
    assert.fail('Expected transaction to wait for a row lock');
}
async function main() {
    assert.equal((await row(sql`SELECT current_database() name`)).name, 'thesishs_ai');
    const actors = [];
    for (const [role, active] of [[1, true], [1, false], [2, true], [3, true], [4, true]]) {
        const actor = await row(sql`INSERT INTO users(first_name,last_name,email,password,role_id,is_active) VALUES ('Synthetic',${marker},${marker + ids.length + '@example.invalid'},'!unusable',${role},${active}) RETURNING id,role_id`);
        ids.push(actor.id); actors.push(actor);
    }
    const [admin, inactive, adviser, student, panel] = actors;
    for (const suffix of ['Alpha', 'Beta']) {
        const group = await row(sql`INSERT INTO research_groups(group_name,strand,section,school_year,adviser_id,created_at) VALUES (${marker + suffix},'TEST','TEST','2026-2027',${adviser.id},'2026-01-01') RETURNING id`);
        groupIds.push(group.id);
    }
    const groupId = groupIds[0]; session = { userId: admin.id, roleId: 1 };
    const result = await groups.getResearchGroups(); assert.equal(result.success, true);
    assert.deepEqual(result.data.filter(g => groupIds.includes(g.id)).map(g => g.id), [...groupIds].reverse(), 'stable newest/id ordering');
    for (const actor of [inactive, adviser, student, panel, { id: 2147483647 }, null]) {
        session = actor ? { userId: actor.id, roleId: 1 } : null;
        const before = await snapshot(); assert.equal((await groups.getResearchGroups()).success, false);
        for (const fn of [groups.changeResearchGroupStatus, actions.changeResearchGroupStatusAction]) assert.equal((await fn(groupId, 'archived')).success, false);
        assert.equal(await snapshot(), before);
    }
    session = { userId: admin.id, roleId: 1 };
    for (const status of ['archived', 'active']) {
        assert.equal((await actions.changeResearchGroupStatusAction(groupId, status)).success, true);
        assert.equal((await row(sql`SELECT status FROM research_groups WHERE id=${groupId}`)).status, status);
    }
    assert.equal((await actions.changeResearchGroupStatusAction(groupId, 'active')).success, true, 'legacy repeated target status remains permitted');
    assert.equal((await updateResearchGroupStatusForAdmin(inactive.id, groupId, 'archived')).kind, 'denied');
    assert.equal((await updateResearchGroupStatusForAdmin(adviser.id, groupId, 'archived')).kind, 'denied');
    assert.equal(Number((await row(sql`SELECT count(*) n FROM notifications WHERE user_id=${adviser.id}`)).n), 3);
    assert.equal(Number((await row(sql`SELECT count(*) n FROM activity_logs WHERE user_id=${admin.id}`)).n), 3);
    // A committed revocation wins while the mutation is waiting for the actor lock.
    for (const change of [sql`is_active=false`, sql`role_id=2`]) {
        const ready = deferred(), release = deferred();
        const revoker = db.transaction(async tx => { await tx.execute(sql`UPDATE users SET ${change} WHERE id=${admin.id}`); ready.resolve(); await release.promise; });
        await ready.promise;
        let done = false; const mutation = actions.changeResearchGroupStatusAction(groupId, 'archived').then(value => { done = true; return value; });
        try { await wait(100); assert.equal(done, false); } finally { release.resolve(); }
        await revoker; assert.equal((await mutation).kind, 'denied');
        assert.equal((await row(sql`SELECT status FROM research_groups WHERE id=${groupId}`)).status, 'active');
        await db.execute(sql`UPDATE users SET is_active=true,role_id=1 WHERE id=${admin.id}`);
    }
    // Conversely, a mutation holding the actor lock completes before later revocation.
    const ready = deferred(), release = deferred();
    const holder = db.transaction(async tx => { await tx.execute(sql`SELECT id FROM research_groups WHERE id=${groupId} FOR UPDATE`); ready.resolve(); await release.promise; });
    await ready.promise;
    const name = marker + '_lock';
    const mutation = db.transaction(async tx => { await tx.execute(sql`SELECT set_config('application_name',${name},true)`);
        // Route only this operation's actual repository transaction through the held transaction.
        const transaction = db.transaction;
        try { db.transaction = fn => fn(tx); return await updateResearchGroupStatusForAdmin(admin.id, groupId, 'archived'); }
        finally { db.transaction = transaction; }
    });
    await waitBlocked(name);
    let revoked = false;
    const revocation = db.execute(sql`UPDATE users SET is_active=false WHERE id=${admin.id}`).then(() => { revoked = true; });
    try { await wait(100); assert.equal(revoked, false); } finally { release.resolve(); }
    await holder; assert.equal((await mutation).kind, 'updated'); await revocation;
    await db.execute(sql`UPDATE users SET is_active=true WHERE id=${admin.id}`);
    console.log('PASS real PostgreSQL group service/action denials and unchanged denied-write snapshots, Archive/Reactivate, notifications/activity, deterministic ordering, actor-lock recheck and both revocation ordering cases.');
    // Actual repository SQL/services/actions, exact synthetic signer, no storage operations.
    for (const status of ['Approved', 'Draft']) {
        const paper = await row(sql`INSERT INTO research_papers(group_id,title,abstract,status) VALUES (${groupId},${marker + status},'Synthetic',${status}) RETURNING id`); papers.push(paper.id);
        await db.execute(sql`INSERT INTO submissions(paper_id,submitted_by,version,file_url,status) VALUES (${paper.id},${student.id},'v1',${'research/' + paper.id + '/v1/synthetic.pdf'},'Approved')`);
    }
    const paperId = papers[0];
    const candidate = await getRepositoryManagementData(admin.id); assert.ok(candidate.eligiblePapers.some(p => p.paperId === paperId)); assert.ok(!candidate.eligiblePapers.some(p => p.paperId === papers[1]));
    const beforeSigning = signed;
    for (const actor of [inactive, adviser, student, panel, { id: 2147483647 }]) {
        session = { userId: actor.id, roleId: 1 };
        assert.equal((await repoActions.publishRepositoryPaperAction(initial, form('paperId', paperId))).success, false);
    }
    assert.equal(signed, beforeSigning);
    session = null; await assert.rejects(repoActions.publishRepositoryPaperAction(initial, form('paperId', paperId)), /REDIRECT/);
    session = { userId: admin.id, roleId: 1 };
    assert.equal((await publishResearch(papers[1], admin.id)).success, false);
    await db.execute(sql`UPDATE submissions SET status='Submitted' WHERE paper_id=${paperId}`); assert.equal((await publishResearch(paperId, admin.id)).success, false);
    await db.execute(sql`UPDATE submissions SET status='Approved',file_url='wrong.pdf' WHERE paper_id=${paperId}`); assert.equal((await publishResearch(paperId, admin.id)).success, false);
    await db.execute(sql`UPDATE submissions SET file_url=${'research/' + paperId + '/v1/synthetic.pdf'} WHERE paper_id=${paperId}`);
    rejectObject = true; assert.equal((await publishResearch(paperId, admin.id)).success, false); rejectObject = false;
    const concurrent = await Promise.all([publishResearch(paperId, admin.id), publishResearch(paperId, admin.id)]); assert.equal(concurrent.filter(r => r.success).length, 1);
    const repository = await row(sql`SELECT id,published_at FROM repositories WHERE paper_id=${paperId}`);
    assert.equal(Number((await row(sql`SELECT count(*) n FROM repositories WHERE paper_id=${paperId}`)).n), 1);
    assert.equal((await repoActions.updateRepositoryPublicationAction(initial, form('repositoryId', repository.id, false))).success, true);
    const hidden = await getRepositoryManagementData(admin.id); assert.ok(!hidden.eligiblePapers.some(p => p.paperId === paperId)); assert.equal(hidden.repositoryEntries.find(p => p.paperId === paperId).isPublished, false);
    for (const actor of [inactive, adviser, student, panel, { id: 2147483647 }]) {
        session = { userId: actor.id, roleId: 1 }; assert.equal((await repoActions.updateRepositoryPublicationAction(initial, form('repositoryId', repository.id, true))).success, false);
    }
    session = { userId: admin.id, roleId: 1 }; assert.equal((await repoActions.updateRepositoryPublicationAction(initial, form('repositoryId', repository.id, true))).success, true);
    assert.equal((await row(sql`SELECT is_published FROM repositories WHERE id=${repository.id}`)).is_published, true);
    assert.equal(Number((await row(sql`SELECT count(*) n FROM submissions WHERE paper_id IN (${list(papers)})`)).n), 2);
    console.log('PASS actual PostgreSQL repository authorization/eligibility, approved submission/path and signer-failure boundary, concurrent duplicate prevention, Hidden stays out of candidates, Unpublish/Republish, preserved submission records. Object checks simulated with exact synthetic signer; zero outbound/storage calls.');
}
main().catch(error => { console.error(error.name, error.message?.replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted]')); process.exitCode = 1; }).finally(async () => {
    // Exact ownership recovered from marker, even if an insert response was lost.
    const ownedUsers = (await db.execute(sql`SELECT id FROM users WHERE last_name=${marker}`)).map(r => r.id);
    const ownedGroups = (await db.execute(sql`SELECT id FROM research_groups WHERE group_name LIKE ${marker + '%'} AND adviser_id IN (${list(ownedUsers)})`)).map(r => r.id);
    const ownedPapers = (await db.execute(sql`SELECT id FROM research_papers WHERE group_id IN (${list(ownedGroups)})`)).map(r => r.id);
    assert.ok(ownedUsers.length <= 5 && ownedGroups.length <= 2 && ownedPapers.length <= 2);
    await db.execute(sql`DELETE FROM repositories WHERE paper_id IN (${list(ownedPapers)})`);
    await db.execute(sql`DELETE FROM submissions WHERE paper_id IN (${list(ownedPapers)})`);
    await db.execute(sql`DELETE FROM research_papers WHERE id IN (${list(ownedPapers)})`);
    await db.execute(sql`DELETE FROM research_groups WHERE id IN (${list(ownedGroups)})`);
    await db.execute(sql`DELETE FROM notifications WHERE user_id IN (${list(ownedUsers)})`);
    await db.execute(sql`DELETE FROM activity_logs WHERE user_id IN (${list(ownedUsers)})`);
    await db.execute(sql`DELETE FROM users WHERE id IN (${list(ownedUsers)}) AND last_name=${marker}`);
    for (const query of [sql`SELECT count(*) n FROM users WHERE last_name=${marker}`, sql`SELECT count(*) n FROM research_groups WHERE id IN (${list(ownedGroups)})`, sql`SELECT count(*) n FROM research_papers WHERE id IN (${list(ownedPapers)})`, sql`SELECT count(*) n FROM submissions WHERE paper_id IN (${list(ownedPapers)})`, sql`SELECT count(*) n FROM repositories WHERE paper_id IN (${list(ownedPapers)})`, sql`SELECT count(*) n FROM notifications WHERE user_id IN (${list(ownedUsers)})`, sql`SELECT count(*) n FROM activity_logs WHERE user_id IN (${list(ownedUsers)})`]) assert.equal(Number((await row(query)).n), 0);
    console.log('PASS independent cleanup: zero run-owned users/groups/papers/submissions/repositories/notifications/activity. No storage objects created; sequences may advance.');
    process.exit(process.exitCode || 0);
});
