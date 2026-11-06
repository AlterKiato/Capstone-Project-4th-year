/* eslint-disable @typescript-eslint/no-require-imports */
// Real services/auth guards and Drizzle SQL; synthetic session, account and SQL transport only.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const Module = require('node:module');
const { drizzle } = require('drizzle-orm/pg-proxy');
let claims, account, accountReads = 0, failAccount = false, repository, verification;
const original = Module._load;
const mocks = {
    'server-only': {}, '@/lib/db': { db: {} },
    '@/lib/auth/session': { getSession: async () => claims },
    'next/navigation': { redirect: path => { throw Error('REDIRECT ' + path); } },
    '@/lib/repositories/user.repository': { findUserById: async id => {
        accountReads++; if (failAccount) throw Error('PRIVATE_DB_ERROR'); return account?.id === id ? account : undefined;
    } },
    '@/lib/repositories/student-workspace.repository': { studentWorkspaceRepository: new Proxy({}, {
        get: (_target, key) => (...args) => repository[key](...args),
    }) },
    '@/lib/services/email-verification-status.service': { getCurrentStudentVerificationStatus: () => verification() },
    'next/link': () => null,
    '@/components/dashboard/dashboard-header': () => null,
    '@/components/dashboard/group-members': () => null,
    '@/components/dashboard/student-ui.module.css': {},
    '@/components/feedback-content': () => null,
};
Module._load = function(id, ...args) { return Object.hasOwn(mocks, id) ? mocks[id] : original.call(this, id, ...args); };
const { createStudentWorkspaceRepository } = require('../lib/repositories/student-workspace.repository.ts');
const { getStudentWorkspace } = require('../lib/services/student-workspace.service.ts');
const { getDashboardAccount } = require('../lib/services/dashboard-account.service.ts');
const { requireRole } = require('../lib/auth/authorization.ts');
const { default: StudentPage } = require('../app/dashboard/student/page.tsx');
const at = '2026-11-06 00:00:00';
function actor(roleId = 3) {
    claims = { userId: 7, roleId, email: 'old@example.invalid', exp: 2000000000 };
    account = { id: 7, roleId, isActive: true, email: 'current@example.invalid' };
    accountReads = 0; failAccount = false;
}
function fixture({ memberCount = 3, projectCount = 2, versions = 3, empty = false } = {}) {
    actor();
    const queries = [];
    const members = Array.from({ length: memberCount }, (_, index) => [index + 1, 50, 'Member', String(index)]);
    const projects = Array.from({ length: projectCount }, (_, index) => [101 + index, 50, 'Research ' + index, 'Abstract', null, null, 'Draft', at, at]).reverse();
    const history = projects.flatMap(project => Array.from({ length: versions }, (_, index) => [project[0] * 100 + index, project[0], index % 2 ? 8 : 7,
        'v' + (index + 1), index % 2 ? 'Revision Required' : 'Approved', null, at])).sort((a, b) => b[0] - a[0]);
    const feedback = history.map(row => [row[0], row[0] + 10000, 'Feedback', 'Approved', at]);
    const faults = { table: null, removed: new Set(), noFeedback: new Set(), noMembership: false };
    const database = drizzle(async (query, params) => {
        queries.push({ query, params });
        assert.match(query, /^select /, 'No database mutations');
        assert.match(query, /"group_members"\."user_id" = \$/);
        assert.match(query, /"research_groups"\."status" = \$/);
        assert.equal(params.at(-2), 7); assert.equal(params.at(-1), 'active');
        assert.doesNotMatch(query.split(' from ')[0], /password|file_url|teacher_id|email|profile_image/);
        const groups = !empty && !faults.noMembership ? [50] : [];
        const ids = params.slice(0, -2);
        const source = query.split(' where ')[0];
        let table, rows;
        if (query.includes('left join "feedbacks"')) {
            table = 'feedback'; assert.match(query, /"submissions"\."submitted_by" = \$/);
            assert.equal(ids.at(-1), 7);
            rows = groups.length ? feedback.filter(row => ids.slice(0, -1).includes(row[0]) && !faults.removed.has(row[0]) && history.find(h => h[0] === row[0])[2] === 7)
                .map(row => faults.noFeedback.has(row[0]) ? [row[0], null, null, null, null] : row) : [];
        } else if (source.includes(' from "submissions"')) {
            table = 'submissions'; assert.match(query, /order by "submissions"\."submitted_at" desc, "submissions"\."id" desc/);
            rows = groups.length ? history.filter(row => ids.includes(row[1])) : [];
        } else if (source.includes(' from "research_papers"')) {
            table = 'projects'; assert.match(query, /order by "research_papers"\."created_at" desc, "research_papers"\."id" desc/);
            rows = projects.filter(row => groups.includes(row[1]) && ids.includes(row[1]));
        } else if (source.includes(' from "group_members"')) {
            table = 'members'; rows = members.filter(row => groups.includes(row[1]) && ids.includes(row[1]));
        } else {
            table = 'groups'; rows = groups.map(id => [id, 'Synthetic Group', 'STEM', 'A', '2026']);
        }
        if (faults.table === table) throw Error('PRIVATE_DB_ERROR');
        return { rows };
    });
    repository = createStudentWorkspaceRepository(database);
    return { queries, projects, history, faults, repo: repository };
}

test('one fresh account lookup retains current email, expiry and all supported roles', async () => {
    for (const role of [1, 2, 3, 4]) {
        actor(role);
        assert.deepEqual(await getDashboardAccount(), { id: 7, roleId: role, email: account.email, expiresAt: claims.exp * 1000 });
        assert.equal(accountReads, 1);
        account.email = 'changed@example.invalid';
        assert.equal((await getDashboardAccount()).email, account.email);
        assert.equal(accountReads, 2, 'A separate uncached invocation rechecks current authority');
        account.isActive = false;
        await assert.rejects(getDashboardAccount, /REDIRECT \/login/);
    }
});
test('anonymous, missing/inactive/stale-role accounts and infrastructure failure fail closed', async () => {
    for (const mutate of [() => { claims = null; }, () => { account = null; }, () => { account.isActive = false; },
        () => { account.roleId = 2; }, () => { failAccount = true; }, () => { claims.userId = -1; }]) {
        const f = fixture(); mutate(); await assert.rejects(getStudentWorkspace, /REDIRECT \/login/); assert.equal(f.queries.length, 0);
    }
    for (const role of [1, 2, 4]) { fixture(); actor(role); await assert.rejects(getStudentWorkspace, /REDIRECT \/dashboard/); }
    actor(3); await assert.rejects(() => requireRole([1]), /REDIRECT \/dashboard/);
});
test('five scoped SQL reads preserve members, all projects/versions, own feedback and DTO boundaries', async () => {
    const f = fixture();
    const result = await getStudentWorkspace();
    assert.equal(f.queries.length, 5);
    assert.equal(accountReads, 2, 'Existing service role check remains fresh alongside dashboard account resolution');
    assert.equal(result.email, 'current@example.invalid');
    assert.equal(result.groups[0].members.length, 3);
    assert.deepEqual(result.projects.map(p => p.id), f.projects.map(p => p[0]));
    assert.deepEqual(result.submissions.map(s => s.id), f.history.map(s => s[0]));
    for (const submission of result.submissions) {
        const own = f.history.find(row => row[0] === submission.id)[2] === 7;
        assert.equal(submission.feedbackRestricted, !own);
        assert.equal(submission.feedbackUnavailable, false);
        assert.equal(submission.feedback.length, own ? 1 : 0);
        assert.deepEqual(Object.keys(submission).sort(), ['feedback', 'feedbackRestricted', 'feedbackUnavailable', 'id', 'paperId', 'remarks', 'status', 'submittedAt', 'version']);
    }
    assert.doesNotMatch(JSON.stringify(result), /submittedBy|teacherId|fileUrl|password|PRIVATE_/);
    console.log('SQL transport counts: 3 members / 2 projects / 6 versions / 4 own submissions = 5 workspace reads + 2 auth reads.');
});
test('larger workspaces retain five SQL reads, empty and no-project cases skip unnecessary reads', async () => {
    const large = fixture({ memberCount: 12, projectCount: 8, versions: 12 });
    const result = await getStudentWorkspace();
    assert.equal(large.queries.length, 5); assert.equal(result.submissions.length, 96); assert.equal(result.groups[0].members.length, 12);
    const blank = fixture({ empty: true });
    assert.deepEqual(await getStudentWorkspace(), { email: account.email, groups: [], projects: [], submissions: [] });
    assert.equal(blank.queries.length, 1);
    const noProjects = fixture({ projectCount: 0 }); await getStudentWorkspace(); assert.equal(noProjects.queries.length, 3);
    console.log('SQL transport counts: 12 members / 8 projects / 96 versions = 5; no groups = 1; group without projects = 3.');
});
test('batch SQL scopes reject foreign IDs, foreign feedback and membership loss', async () => {
    const f = fixture();
    assert.deepEqual(await f.repo.members(7, [90]), []);
    assert.deepEqual(await f.repo.projects(7, [90]), []);
    assert.deepEqual(await f.repo.submissions(7, [900]), []);
    const foreignSubmitter = f.history.find(row => row[2] === 8)[0];
    assert.deepEqual(await f.repo.feedback(7, [foreignSubmitter, 999999]), []);
    f.faults.noMembership = true;
    assert.deepEqual(await f.repo.submissions(7, f.projects.map(row => row[0])), []);
    assert.deepEqual(await f.repo.feedback(7, f.history.map(row => row[0])), []);
});
test('no feedback is distinct from unavailable feedback; query failures do not masquerade as empty data', async () => {
    let f = fixture(), own = f.history.find(row => row[2] === 7)[0];
    f.faults.noFeedback.add(own);
    let result = await getStudentWorkspace();
    assert.equal(result.submissions.find(s => s.id === own).feedbackUnavailable, false);
    assert.deepEqual(result.submissions.find(s => s.id === own).feedback, []);
    f.faults.removed.add(own);
    result = await getStudentWorkspace(); assert.equal(result.submissions.find(s => s.id === own).feedbackUnavailable, true);
    for (const table of ['groups', 'members', 'projects', 'submissions', 'feedback']) {
        f = fixture(); f.faults.table = table;
        await assert.rejects(getStudentWorkspace, error => error.cause?.message === 'PRIVATE_DB_ERROR');
    }
});
test('member retrieval cannot hold up the independent project/history branch', async () => {
    const f = fixture(); let release, projectStarted;
    const waiting = new Promise(resolve => { release = resolve; });
    const projects = new Promise(resolve => { projectStarted = resolve; });
    repository = { ...f.repo, members: async (...args) => { await waiting; return f.repo.members(...args); },
        projects: (...args) => { projectStarted(); return f.repo.projects(...args); } };
    const loading = getStudentWorkspace();
    await projects; release(); await loading;
});
test('Student page starts optional verification before workspace completion and preserves messages', async () => {
    const f = fixture(); let release, started = false;
    const waiting = new Promise(resolve => { release = resolve; });
    repository = { ...f.repo, groups: async (...args) => { await waiting; return f.repo.groups(...args); } };
    verification = async () => { started = true; return { verified: false }; };
    const loading = StudentPage();
    assert.equal(started, true); release();
    assert.match(JSON.stringify(await loading), /Email verification is optional/);
    verification = async () => null;
    assert.match(JSON.stringify(await StudentPage()), /temporarily unavailable/);
    verification = async () => ({ verified: true });
    assert.doesNotMatch(JSON.stringify(await StudentPage()), /Email verification is optional|temporarily unavailable/);
    claims = null; await assert.rejects(StudentPage, /REDIRECT \/login/);
});
