/* eslint-disable @typescript-eslint/no-require-imports */
// Real Drizzle SQL generation and decoding against a transactional driver double, not live PostgreSQL locks.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { drizzle } = require('drizzle-orm/pg-proxy');
const schema = require('../db/schema/index.ts');
const { createSubmissionUploadRepository } = require('../lib/repositories/submission-upload.repository.ts');
test('repository SQL locks current scope, uses server clocks/encoded timestamps, and persists submission plus intent together', async () => {
    const queries = [], events = [], id = randomUUID(), key = randomUUID(), now = new Date();
    const row = [id, 11, 10, key, `staging/submissions/${id}/upload.pdf`, 'synthetic.pdf', 20, null,
        now.toISOString(), new Date(now.getTime() + 900000).toISOString(), null, 'pending', null, null, null];
    const db = drizzle(async (query, params) => {
        queries.push({ query, params });
        if (query.includes('clock_timestamp()')) return { rows: [{ now: now.toISOString() }] };
        if (query.startsWith('select')) {
            if (query.includes('from "users"')) return { rows: [[3, true]] };
            if (query.includes('from "research_groups"')) return { rows: [[1, 'active', 22]] };
            if (query.includes('from "group_members"')) return { rows: [[30]] };
            if (query.includes('from "submissions"')) return { rows: [] };
            if (query.includes('from "research_papers"')) return { rows: query.includes('for share') ? [[10, 1, 'Synthetic']] : [[1]] };
            if (query.includes('from "submission_upload_intents"')) return { rows: [row] };
        }
        if (query.startsWith('update "submission_upload_intents"')) return { rows: [row] };
        if (query.startsWith('insert into "submissions"')) return { rows: [[1, 10, 11, 'v1', `research/10/v1/${id}-synthetic.pdf`, null, 'Submitted', now.toISOString()]] };
        return { rows: [] };
    }, { schema });
    db.transaction = async work => { events.push('begin'); const result = await work(db); events.push('commit'); return result; };
    const repository = createSubmissionUploadRepository(db);
    await repository.locked(11, 10, async tx => {
        assert.deepEqual(tx.context.account, { roleId: 3, isActive: true }); assert.equal(tx.context.member, true);
        assert.equal((await tx.now()).getTime(), now.getTime());
        const intent = await tx.intent(id); assert.equal(intent.studentId, 11); assert.equal(intent.paperId, 10);
        await tx.recent(); await tx.patch(id, { capabilityExpiresAt: new Date(now.getTime() + 7200000) });
        await tx.submit({ ...intent, finalPath: `research/10/v1/${id}-synthetic.pdf` }, 'v1');
        await tx.patch(id, { state: 'completed', submissionId: 1 });
    });
    assert.deepEqual(events, ['begin', 'commit']);
    assert.match(queries[0].query, /lock_timeout = '3s'/); assert.match(queries[1].query, /statement_timeout = '5s'/);
    assert.match(queries[2].query, /pg_advisory_xact_lock\(\$1, \$2\)/); assert.deepEqual(queries[2].params, [1296388936, 10]);
    const submissionLock = queries.findIndex(q => q.query.includes('from "submissions"') && q.query.includes('for share'));
    const paperLock = queries.findIndex(q => q.query.includes('from "research_papers"') && q.query.includes('for share'));
    assert.ok(submissionLock < paperLock);
    const owned = queries.find(q => q.query.includes('from "submission_upload_intents"') && q.query.includes('for update'));
    assert.match(owned.query, /"student_id" = \$/); assert.match(owned.query, /"paper_id" = \$/); assert.ok(owned.params.includes(11));
    const timestamp = queries.find(q => q.query.startsWith('update') && q.query.includes('"capability_expires_at" ='));
    assert.equal(typeof timestamp.params[0], 'string'); assert.equal(timestamp.params[0], new Date(now.getTime() + 7200000).toISOString());
    assert.ok(!queries.some(q => q.params.some(value => value instanceof Date)), 'Date values must use column encoders');
    assert.ok(queries.some(q => q.query.startsWith('insert into "submissions"')));
    assert.ok(queries.some(q => q.query.startsWith('update') && q.params.includes('completed')));
});
