/* eslint-disable @typescript-eslint/no-require-imports */
// Pure presentation rules only. Existing R1 tests exercise service/repository authorization offline.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { researchProgressSummary, manilaToday } = require('../lib/research-progress.ts');
const { resolveResearchTarget } = require('../lib/student-research-view.ts');

const today = '2026-11-11';
const milestone = (id, dueDate, patch = {}) => ({
    id, paperId: 10, title: `Milestone ${id}`, dueDate, revision: 0,
    submissionId: null, verifiedBy: null, verifiedAt: null, evidence: null, ...patch,
});
const verified = { submissionId: 7, verifiedBy: 2, verifiedAt: '2026-11-01T01:00:00Z' };
const summarize = milestones => researchProgressSummary({ milestones, today });

test('summary counts exact verified evidence, not linkage or Approved evidence awaiting verification', () => {
    const result = summarize([
        milestone(1, '2026-11-01', verified),
        milestone(2, '2026-11-10', { submissionId: 8, evidence: { id: 8, status: 'Approved' } }),
        milestone(3, today, { submissionId: 9, evidence: { id: 9, status: 'Revision Required' } }),
    ]);
    assert.equal(result.completed, 1);
    assert.equal(result.total, 3);
    assert.equal(result.overdue, 1);
    assert.equal(result.next.id, 3);
});

test('upcoming excludes completed/past deadlines, includes today and resolves date ties by ID without changing source order', () => {
    const rows = [milestone(8, '2026-11-12'), milestone(4, today), milestone(2, today),
        milestone(1, '2026-11-10'), milestone(3, today, verified)];
    const before = structuredClone(rows);
    assert.equal(summarize(rows).next.id, 2);
    assert.deepEqual(rows, before);
    assert.equal(summarize([milestone(9, '2026-11-30'), milestone(10, '2026-11-12')]).next.id, 10);
});

test('empty, all verified, only overdue and no verified milestones retain honest distinct states', () => {
    assert.deepEqual(summarize([]), { completed: 0, total: 0, overdue: 0, next: null });
    assert.deepEqual(summarize([milestone(1, today, verified)]), { completed: 1, total: 1, overdue: 0, next: null });
    const overdue = summarize([milestone(1, '2026-11-10')]);
    assert.equal(overdue.completed, 0); assert.equal(overdue.overdue, 1); assert.equal(overdue.next, null);
});

test('deadline status follows the service Manila date across midnight, never the browser timezone', () => {
    const rows = [milestone(1, '2026-11-11')];
    const before = researchProgressSummary({ milestones: rows, today: manilaToday(new Date('2026-11-11T15:59:59Z')) });
    const after = researchProgressSummary({ milestones: rows, today: manilaToday(new Date('2026-11-11T16:00:00Z')) });
    assert.equal(before.overdue, 0); assert.equal(before.next.id, 1);
    assert.equal(after.overdue, 1); assert.equal(after.next, null);
});

test('existing route selection accepts authorized projects only and safely ignores malformed/foreign IDs', () => {
    const workspace = { projects: [{ id: 10 }, { id: 20 }], submissions: [] };
    const select = project => resolveResearchTarget(workspace, { project }).project?.id;
    assert.equal(select('20'), 20);
    for (const raw of ['999', '../20', '20.5', ['20'], '9007199254740992']) assert.equal(select(raw), 10);
    assert.equal(resolveResearchTarget({ projects: [], submissions: [] }, { project: '20' }).project, undefined);
});
