/* eslint-disable @typescript-eslint/no-require-imports */
// Existing marked synthetic records only. No fixture writes, metric routes or cleanup.
const assert = require('node:assert/strict');
const Module = require('node:module');
require('dotenv/config');
const target = new URL(process.env.DATABASE_URL);
assert.ok(target.hostname === 'localhost' && target.port === '5432' && target.pathname === '/thesishs_ai');
const original = Module._load;
Module._load = function(id, ...args) { return id === 'server-only' ? {} : original.call(this, id, ...args); };
const { db } = require('../lib/db.ts');
const { sql } = require('drizzle-orm');
const { createSubmissionDocumentUrl } = require('../lib/services/submission-document.service.ts');
const { getGroqAvailability, getLocalGroqPilotAvailability } = require('../lib/ai/groq-provider.ts');

async function snapshot() {
    const result = [];
    for (const name of ['users', 'research_groups', 'group_members', 'research_papers', 'submissions', 'feedbacks', 'repositories', 'notifications', 'activity_logs']) {
        // Table names are fixed source constants, never external input.
        result.push(await db.execute(sql.raw(`SELECT count(*) AS count, md5(coalesce(string_agg(row_to_json(t)::text, '' ORDER BY id), '')) AS fingerprint FROM ${name} t`)));
    }
    return result;
}
async function main() {
    const before = await snapshot();
    const actors = await db.execute(sql`SELECT id, role_id, is_active FROM users
        WHERE email ILIKE '%test%' OR email ILIKE '%phase%' ORDER BY id`);
    const records = await db.execute(sql`SELECT s.id, s.submitted_by, p.group_id, g.adviser_id, s.status
        FROM submissions s JOIN research_papers p ON p.id=s.paper_id JOIN research_groups g ON g.id=p.group_id
        WHERE p.title LIKE 'SPRINT%' OR p.title LIKE 'PHASE%' ORDER BY s.id`);
    const memberships = await db.execute(sql`SELECT group_id, user_id FROM group_members`);
    let studentDenial = false, adviserDenial = false, inactiveDenial = false;
    for (const record of records) {
        if (!studentDenial) {
            const student = actors.find(a => a.role_id === 3 && a.is_active && !memberships.some(m => m.group_id === record.group_id && m.user_id === a.id));
            if (student) { assert.equal(await createSubmissionDocumentUrl(record.id, student.id), null); studentDenial = true; }
        }
        if (!adviserDenial) {
            const adviser = actors.find(a => a.role_id === 2 && a.is_active && a.id !== record.adviser_id);
            if (adviser) { assert.equal(await createSubmissionDocumentUrl(record.id, adviser.id), null); adviserDenial = true; }
        }
        if (!inactiveDenial) {
            const inactive = actors.find(a => !a.is_active);
            if (inactive) { assert.equal(await createSubmissionDocumentUrl(record.id, inactive.id), null); inactiveDenial = true; }
        }
        if (studentDenial && adviserDenial && inactiveDenial) break;
    }
    assert.ok(studentDenial && adviserDenial, 'Existing foreign synthetic actors required');
    console.log('PASS: actual database-backed foreign Student/Adviser private-document denial; inactive restriction: '+(inactiveDenial?'PASS':'NOT TESTED (no existing inactive synthetic fixture)'));
    const { getPublishedResearch } = require('../lib/services/repository.service.ts');
    const { parseRepositorySearchParams } = require('../lib/validations/repository.ts');
    const criteria = values => parseRepositorySearchParams(values);
    const [expected] = await db.execute(sql`SELECT count(*)::int AS total FROM research_papers p JOIN repositories r ON r.paper_id=p.id
        WHERE r.is_published=true AND p.status='Approved' AND EXISTS(SELECT 1 FROM submissions s WHERE s.paper_id=p.id AND s.status='Approved')`);
    const first = await getPublishedResearch(criteria({}));
    assert.equal(first.total, expected.total);
    assert.equal(first.items.length, Math.min(10, expected.total));
    if (first.pageCount > 1) {
        const next = await getPublishedResearch(criteria({ page: '2' }));
        assert.ok(next.items.every(item => !first.items.some(previous => previous.paperId === item.paperId)));
    }
    const fixture = first.items.find(item => item.title.startsWith('PHASE6_ACCEPTANCE_'));
    assert.ok(fixture, 'Existing marked discovery fixture');
    for (const field of ['title', 'abstract', 'keywords']) {
        const match = await getPublishedResearch(criteria({ search: fixture[field] }));
        assert.ok(match.items.some(item => item.paperId === fixture.paperId));
    }
    assert.ok((await getPublishedResearch(criteria({ search: fixture.title, category: fixture.category }))).items.some(item => item.paperId === fixture.paperId));
    assert.equal((await getPublishedResearch(criteria({ search: 'PHASE96_UNMATCHED_SYNTHETIC' }))).total, 0);
    console.log('PASS: current SQL-backed repository eligibility, ten-per-page/pagination, title/abstract/keywords search, category filter and empty result. No view/download metrics changed.');
    const localOnly = process.argv.includes('--local-only');
    const source = !localOnly && process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL) : null;
    if (!localOnly && source?.hostname === 'cbkplqkkjuoglpimwmib.supabase.co') {
        const { createClient } = require('@supabase/supabase-js');
        const storage = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
        const bucket = await storage.storage.getBucket('research-submissions');
        if (bucket.error) console.log('NOT TESTED: live PDF retrieval (storage metadata unavailable).');
        else {
            assert.equal(bucket.data.public, false, 'Existing research bucket must remain private');
            const record = [...records].reverse().find(r => r.status === 'Approved' && actors.some(a => a.id === r.adviser_id && a.role_id === 2 && a.is_active));
            if (!record) console.log('NOT TESTED: live PDF retrieval (no marked owned synthetic fixture).');
            else {
                const signed = await createSubmissionDocumentUrl(record.id, record.adviser_id);
                if (!signed) console.log('NOT TESTED: live PDF retrieval (marked fixture document unavailable).');
                else {
                    const response = await fetch(signed, { signal: AbortSignal.timeout(15000) });
                    assert.equal(response.status, 200, 'Synthetic private PDF response');
                    assert.match(response.headers.get('content-type'), /application\/pdf/);
                    const bytes = Buffer.from(await response.arrayBuffer());
                    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
                    console.log('PASS: one actual marked synthetic private PDF retrieval through unchanged Adviser signer. No URL, path or content logged/persisted; expiry not retested.');
                }
            }
        }
    } else console.log('NOT TESTED: bucket metadata/private PDF retrieval (' + (localOnly ? 'explicit --local-only; storage isolation and synthetic object ownership not certified' : 'storage target differs from historical development target') + ').');
    assert.deepEqual(getGroqAvailability(), { enabled: false, available: false });
    assert.deepEqual(getLocalGroqPilotAvailability(), { enabled: false });
    assert.deepEqual(await snapshot(), before, 'All nine workflow/account/publication/notification/activity tables unchanged');
    console.log('PASS: database row counts/fingerprints unchanged, including repository counters; Groq gates hard-disabled. Storage isolation not certified; no mutations attempted.');
}
main().catch(() => { console.error('FAIL: focused read-only acceptance; inspect locally without disclosing private values.'); process.exitCode = 1; })
    .finally(async () => { await db.$client.end({ timeout: 5 }); });
