/* eslint-disable @typescript-eslint/no-require-imports */
// node --import tsx tests/phase6-discovery.acceptance.cjs
// Read-only checks using the existing designated local acceptance dataset.
// No fixtures, publication changes, download counters, or storage writes.
const assert = require('node:assert/strict');
const Module = require('node:module');
require('dotenv/config');
const target = new URL(process.env.DATABASE_URL);
assert.equal(target.hostname, 'localhost');
assert.equal(target.pathname, '/thesishs_ai');
const originalLoad = Module._load;
Module._load = function (id, ...args) {
    return id === 'server-only' ? {} : originalLoad.call(this, id, ...args);
};
const { db } = require('../lib/db.ts');
const { sql, eq, and } = require('drizzle-orm');
const { users } = require('../db/schema/index.ts');
const { parseRepositorySearchParams } = require('../lib/validations/repository.ts');
const { getPublishedResearch, getPublishedResearchDetails, createPublishedResearchDocumentUrl } = require('../lib/services/repository.service.ts');
const criteria = values => parseRepositorySearchParams(values);
const marker = 'PHASE6_ACCEPTANCE_20260929';

async function main() {
    const expected = await db.execute(sql`
        SELECT p.id, p.title, p.abstract, p.keywords, p.category,
               r.is_published = true AND p.status = 'Approved'
               AND EXISTS (SELECT 1 FROM submissions s WHERE s.paper_id = p.id AND s.status = 'Approved') AS eligible
        FROM research_papers p
        INNER JOIN research_groups g ON g.id = p.group_id
        LEFT JOIN repositories r ON r.paper_id = p.id
    `);
    const paper = expected.find(p => p.title.includes(marker) && p.eligible);
    assert.ok(paper, 'Existing synthetic discovery dataset required');
    // One isolated match in each supported search field; no combination matrix.
    for (const field of ['title', 'abstract', 'keywords']) {
        const search = paper[field];
        assert.ok(search && search.length <= 200);
        const result = await getPublishedResearch(criteria({ search }));
        assert.ok(result.items.some(p => p.paperId === paper.id), field + ' match');
        assert.ok(result.items.every(p => p[field]?.toLowerCase().includes(search.toLowerCase())));
    }
    console.log('PASS title/abstract/keywords search returns expected published paper');
    const filtered = await getPublishedResearch(criteria({ search: marker, category: paper.category }));
    const expectedCategory = expected.filter(p => p.eligible && p.title.includes(marker) && p.category === paper.category);
    assert.equal(filtered.total, expectedCategory.length);
    assert.deepEqual(filtered.items.map(p => p.paperId).sort(), expectedCategory.map(p => p.id).sort());
    console.log('PASS category filter');

    const eligibleIds = expected.filter(p => p.eligible).map(p => p.id);
    const first = await getPublishedResearch(criteria({}));
    assert.equal(first.total, eligibleIds.length);
    const found = [...first.items];
    if (first.total > 10) {
        assert.equal(first.items.length, 10);
        for (let page = 2; page <= first.pageCount; page++) {
            const next = await getPublishedResearch(criteria({ page: String(page) }));
            assert.equal(next.items.length, Math.min(10, first.total - (page - 1) * 10));
            found.push(...next.items);
        }
        console.log('PASS 10-per-page pagination, final page and no duplicate/missing results');
    } else console.log('SKIP pagination: dataset has no second page');
    assert.deepEqual(found.map(p => p.paperId).sort(), eligibleIds.sort());
    assert.ok(expected.some(p => !p.eligible), 'Ineligible records required for exclusion check');
    const excluded = expected.find(p => !p.eligible);
    assert.equal((await getPublishedResearch(criteria({ search: excluded.title }))).total, 0);
    console.log('PASS unpublished/ineligible research excluded');

    // Historical discovery fixtures have placeholder paths. Reuse a real published PDF.
    const pdfPaper = expected.find(p => p.eligible && !p.title.includes(marker));
    assert.ok(pdfPaper, 'Published paper with existing private PDF required');
    const detail = await getPublishedResearchDetails(pdfPaper.id);
    assert.equal(detail.title, pdfPaper.title);
    for (const roleId of [3, 2]) {
        const [actor] = await db.select({ id: users.id }).from(users)
            .where(and(eq(users.roleId, roleId), eq(users.isActive, true))).limit(1);
        assert.ok(actor, 'Active local Student/Adviser required');
        const result = await createPublishedResearchDocumentUrl(pdfPaper.id, 'view', actor.id);
        assert.equal(result.success, true);
        const response = await fetch(result.url);
        assert.equal(response.status, 200);
        assert.match(response.headers.get('content-type'), /^application\/pdf/);
        const bytes = Buffer.from(await response.arrayBuffer());
        assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
    }
    console.log('PASS repository detail and actual private PDF retrieval for Student and Adviser');
}
main().then(() => process.exit(0)).catch(error => {
    console.error('FAIL lean discovery acceptance: ' + error.name);
    console.error(error.stack.split('\n').filter(line => line.trim().startsWith('at ')).join('\n'));
    process.exit(1);
});
