/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { workspaceTaskCounts, researchTabFromHash, helpPopoverPosition } = require('../lib/student-experience-view.ts');
const { workspaceHref } = require('../lib/workspace/workspace-view.ts');

test('workspace summary follows the existing three statuses, including empty data without academic completion claims', () => {
    assert.deepEqual(workspaceTaskCounts([]), { 'To Do': 0, 'In Progress': 0, Done: 0 });
    assert.deepEqual(workspaceTaskCounts([{ status: 'Done' }, { status: 'To Do' }, { status: 'In Progress' }, { status: 'To Do' }]), { 'To Do': 2, 'In Progress': 1, Done: 1 });
    assert.equal(workspaceHref(20, 'tasks'), '/dashboard/student/workspace?project=20&tab=tasks');
});

test('existing progress/revision anchors select their panels; feedback/unknown hashes keep History', () => {
    assert.equal(researchTabFromHash('#research-progress'), 'progress');
    assert.equal(researchTabFromHash('#revision-checklist'), 'revisions');
    for (const value of ['', '#feedback-10', '#unknown']) assert.equal(researchTabFromHash(value), 'history');
});

test('Help prefers above/right alignment, moves below near the top, and clamps at viewport edges', () => {
    const viewport = { left: 0, top: 0, width: 800, height: 600 }, size = { width: 200, height: 100 };
    assert.deepEqual(helpPopoverPosition({ top: 300, bottom: 344, right: 600 }, size, viewport), { left: 400, top: 192 });
    assert.deepEqual(helpPopoverPosition({ top: 5, bottom: 49, right: 70 }, size, viewport), { left: 12, top: 57 });
    const point = helpPopoverPosition({ top: 595, bottom: 639, right: 840 }, size, viewport);
    assert.equal(point.left, 588); assert.ok(point.top + size.height <= 588);
});

test('Help accounts for a shifted visual viewport during scroll/zoom', () => {
    const point = helpPopoverPosition({ top: 180, bottom: 224, right: 120 }, { width: 200, height: 100 }, { left: 50, top: 100, width: 360, height: 400 });
    assert.equal(point.left, 62); assert.equal(point.top, 232);
});
