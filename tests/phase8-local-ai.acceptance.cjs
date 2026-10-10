/* eslint-disable @typescript-eslint/no-require-imports */
// node --import tsx tests/phase8-local-ai.acceptance.cjs
// Read-only local database acceptance; no fixtures or writes.
const assert = require('node:assert/strict');
const Module = require('node:module');
require('dotenv/config');
const target = new URL(process.env.DATABASE_URL);
assert.equal(target.hostname, 'localhost'); assert.equal(target.pathname, '/thesishs_ai');
const originalLoad = Module._load;
Module._load = function(id, ...args) { return id === 'server-only' ? {} : originalLoad.call(this,id,...args); };
const {db} = require('../lib/db.ts');
const {sql} = require('drizzle-orm');
const { getAdviserAIWorkflowAggregate } = require('../lib/repositories/adviser-submission.repository.ts');
const { getAdminAIOverviewAggregate } = require('../lib/repositories/admin-ai-aggregate.repository.ts');
async function main() {
    const advisers = await db.execute(sql`select id from users where role_id=2 and is_active=true order by id`);
    assert.ok(advisers.length >= 2, 'Two existing local Advisers required for isolation acceptance');
    const predicates = {total:sql`true`,submitted:sql`s.status='Submitted'`,review:sql`s.status='Under Review'`,
        notSubmitted:sql`s.status<>'Submitted'`,notReview:sql`s.status<>'Under Review'`,neither:sql`s.status not in ('Submitted','Under Review')`};
    for (const actor of advisers) {
        const actual = await getAdviserAIWorkflowAggregate(actor.id);
        for (const [key, predicate] of Object.entries(predicates)) {
            const [expected] = await db.execute(sql`select count(*)::int as versions,
                count(distinct s.submitted_by)::int as contributors, count(distinct s.paper_id)::int as papers
                from submissions s join research_papers p on p.id=s.paper_id
                join research_groups g on g.id=p.group_id join users u on u.id=s.submitted_by
                where g.adviser_id=${actor.id} and ${predicate}`);
            assert.deepEqual(actual[key], {...expected});
        }
        for (const item of Object.values(actual)) assert.deepEqual(Object.keys(item).sort(),['contributors','papers','versions']);
    }
    await assert.rejects(getAdviserAIWorkflowAggregate(0));
    const empty = await getAdviserAIWorkflowAggregate(2147483647);
    assert.ok(Object.values(empty).every(item => item.versions===0 && item.contributors===0 && item.papers===0));
    const admin = await getAdminAIOverviewAggregate();
    const [expectedAdmin] = await db.execute(sql`select
        (select count(*)::int from users) as "totalUsers",
        (select count(*)::int from research_groups) as "totalGroups",
        (select count(*)::int from research_papers) as "totalResearchPapers",
        (select count(*)::int from research_papers where status='Approved') as "approvedPapers",
        (select count(distinct p.id)::int from research_papers p join repositories r on r.paper_id=p.id
         join research_groups g on g.id=p.group_id where r.is_published=true and p.status='Approved'
         and exists(select 1 from submissions s where s.paper_id=p.id and s.status='Approved')) as "totalPublishedPapers"`);
    assert.deepEqual(admin, {...expectedAdmin});
    console.log('PASS local read-only SQL: every existing Adviser owner/status/contributor/paper aggregate matches independent queries; empty owner scope; Admin snapshot preserves Phase 7 eligibility; counts-only projections');
}
main().then(()=>process.exit(0)).catch(error=>{console.error('FAIL local AI acceptance: '+error.name); console.error(error.stack.split('\n').filter(line=>line.trim().startsWith('at ')).join('\n'));process.exit(1);});
