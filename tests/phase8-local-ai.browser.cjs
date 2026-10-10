/* eslint-disable @typescript-eslint/no-require-imports */
// node --import tsx tests/phase8-local-ai.browser.cjs
// Existing synthetic development users/JWT; isolated mock presentation only, no DB writes/activation.
const assert = require('node:assert/strict');
const Module = require('node:module');
const { spawn } = require('node:child_process');
require('dotenv/config');
const database = new URL(process.env.DATABASE_URL);
assert.equal(database.hostname, 'localhost');
assert.equal(database.pathname, '/thesishs_ai');
const originalLoad = Module._load;
Module._load = function(id, ...args) { return id === 'server-only' ? {} : originalLoad.call(this, id, ...args); };
const { db } = require('../lib/db.ts');
const { sql } = require('drizzle-orm');
const { createToken } = require('../lib/auth/jwt.ts');
const { chromium, expect } = require('@playwright/test');
const { createMockGroqAdapter } = require('./helpers/phase8-mock-groq.ts');
const { adminFixture, versionFixture, aggregateFixture } = require('./helpers/phase8-synthetic-fixtures.ts');
const { minimizeAdminAggregate, minimizeAdviserAggregate } = require('../lib/ai/aggregate-policy.ts');
const origin = 'http://127.0.0.1:3018';
let browser;
let server;
async function main() {
    const accounts = await db.execute(sql`SELECT id, role_id, email FROM users WHERE is_active = true
        AND (email ILIKE '%test%' OR email ILIKE '%phase%') ORDER BY id`);
    const actors = [1, 2, 3, 4].map(role => accounts.find(row => row.role_id === role));
    assert.ok(actors.every(Boolean), 'Existing active synthetic local accounts for all roles required');
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3018'],
        { windowsHide: true, stdio: 'ignore' });
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
        if (server.exitCode !== null) throw new Error('Temporary server exited');
        try { const response = await fetch(origin + '/login'); if (response.ok) { ready = true; break; } } catch { /* starting */ }
        await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.ok(ready, 'Temporary production server ready');
    browser = await chromium.launch();
    const errors = [];
    const external = [];
    async function signedPage(actor, claimedRole = actor?.role_id) {
        const context = await browser.newContext();
        await context.route('**/*', route => {
            if (new URL(route.request().url()).origin !== origin) { external.push('unexpected external request'); return route.abort(); }
            return route.continue();
        });
        if (actor) {
            const token = await createToken({ userId: actor.id, roleId: claimedRole, email: actor.email });
            await context.addCookies([{ name: 'thesishs_session', value: token, url: origin, httpOnly: true, sameSite: 'Lax' }]);
        }
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.name));
        page.on('console', message => { if (message.type() === 'error') errors.push('console error'); });
        page.on('response', response => { if (response.status() >= 500) errors.push('HTTP 5xx'); });
        return page;
    }
    const questions = [
        'Where do I manage users?',
        'How do I start a submission review?',
        'How do revisions and version history work?',
    ];
    const expected = ['User Management', 'Under Review', 'Revision Required'];
    for (let index = 0; index < 3; index++) {
        const page = await signedPage(actors[index]);
        await page.goto(origin + '/dashboard');
        await page.getByRole('link', { name: 'System Guide', exact: true }).click();
        await expect(page).toHaveURL(origin + '/dashboard/guide');
        await expect(page.getByRole('heading', { name: 'ThesiSHS AI System Guide', exact: true })).toBeVisible();
        assert.equal(await page.locator('input, textarea').count(), 0);
        for (const other of questions.filter(question => question !== questions[index])) {
            await expect(page.getByRole('button', { name: other, exact: true })).toHaveCount(0);
        }
        await page.getByRole('button', { name: questions[index], exact: true }).click();
        await expect(page.locator('#guide-answer').locator('..')).toContainText(expected[index]);
        await expect(page.getByRole('status')).toContainText('AI explanations are disabled');
        const response = page.locator('#guide-answer').locator('..');
        assert.ok((await response.getByRole('link').getAttribute('href')).startsWith('/dashboard/'));
        await page.getByRole('button', { name: 'What can this guide help with?', exact: true }).click();
        await expect(response).toContainText('cannot grade research');
        await page.getByRole('link', { name: 'Back to Dashboard', exact: true }).click();
        await expect(page).toHaveURL(origin + '/dashboard');
        if (index < 2) {
            await page.goto(origin + (index === 0 ? '/dashboard/admin/reports' : '/dashboard/adviser/submissions'));
            const panel = page.getByRole('region', { name: index === 0 ? 'Admin report assistance' : 'Adviser workflow assistance' });
            await expect(panel).toContainText('AI interpretation is disabled');
            assert.equal(await panel.locator('input:not([type=checkbox]), textarea').count(), 0);
            await panel.getByRole('button', { name: index === 0 ? 'Explain report metrics' : 'Explain submission workflow counts', exact: true }).click();
            await expect(panel.getByRole('status')).toContainText('AI interpretation is disabled');
            if (index === 1) {
                await panel.getByRole('button', { name: 'How do I record my decision?', exact: true }).click();
                await expect(panel.getByRole('status')).toContainText('cannot generate official feedback');
            }
            // Mock ONLY the already-authorized static result in this browser context.
            // No provider implementation, eligibility certification or real aggregate enters the mock.
            const rows=[...versionFixture(101),...versionFixture(202,8,7,6)];
            const dto=index===0?minimizeAdminAggregate(adminFixture):minimizeAdviserAggregate(aggregateFixture(rows,101));
            let calls=0;
            const adapter=createMockGroqAdapter(async envelope=>{
                calls++; assert.deepEqual(envelope.payload,dto);
                assert.ok(!/owner|contributor|paperId|userId|email|title|feedback/.test(JSON.stringify(envelope.payload)));
                return {status:200,body:JSON.stringify({version:1,overview:index===0?'Synthetic report bands only; no trends or academic decisions.':'Synthetic owned submission-version bands only; no grading or official feedback.',
                    explanations:Object.entries(dto.metrics).map(([metricId,value])=>({metricId,text:`${metricId}: ${value}.`}))})};
            });
            const simulated=await adapter(dto); assert.equal(simulated.mode,'mock');
            let mockResult={success:true,mode:'static',message:'MOCK DEMONSTRATION ONLY: deterministic synthetic output; Groq remains disabled.',
                guidance:[simulated.output.overview,...simulated.output.explanations.map(item=>item.text)].join(' ')};
            let dispatch,finish;
            const reached=new Promise(resolve=>{dispatch=resolve;});
            const resume=new Promise(resolve=>{finish=resolve;});
            const handler=async route=>{
                if(route.request().method()!=='POST'||!route.request().headers()['next-action'])return route.continue();
                const response=await route.fetch(),body=await response.text();
                const pattern=/\{"success":true,"mode":"static","message":"(?:\\.|[^"\\])*","guidance":"(?:\\.|[^"\\])*"\}/g;
                assert.equal((body.match(pattern)||[]).length,1,'Only a valid authorized static result may be substituted');
                dispatch(); await resume;
                return route.fulfill({response,body:body.replace(pattern,()=>JSON.stringify(mockResult))});
            };
            await page.route(origin+'/**',handler);
            await panel.getByRole('button',{name:index===0?'Explain report metrics':'Explain submission workflow counts',exact:true}).click();
            await Promise.race([reached,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Mock presentation response missing')),15000))]);
            await expect(panel.getByRole('status')).toHaveAttribute('aria-busy','true');
            await expect(panel.getByRole('status')).toContainText('Loading static guidance');
            finish();
            await expect(panel.getByRole('status')).toContainText('MOCK DEMONSTRATION ONLY');
            await expect(panel.getByRole('status')).toContainText('10-19');
            await expect(panel.getByRole('status')).toHaveAttribute('aria-busy','false');
            assert.equal(calls,1);
            const failed=await createMockGroqAdapter(async()=>({status:503,body:''}))(dto);
            assert.equal(failed.mode,'static');
            mockResult={success:false,mode:'unavailable',message:'MOCK FAILURE ONLY: '+failed.message};
            await panel.getByRole('button',{name:index===0?'Explain report metrics':'Explain submission workflow counts',exact:true}).click();
            await expect(panel.getByRole('status')).toContainText('MOCK FAILURE ONLY');
            await expect(panel.getByRole('status')).toContainText('Use verified static guidance');
            await page.unroute(origin+'/**',handler);
            // Unavailable provider and suppressed small cohorts must leave ordinary static UI intact.
            if(index===1) {
                assert.equal(minimizeAdviserAggregate(aggregateFixture(versionFixture(101,1,1,2),101)),null);
                const complement=minimizeAdviserAggregate(aggregateFixture(versionFixture(101,5,5,4),101));
                assert.equal(complement.metrics.recordedSubmittedVersions,undefined);
                assert.equal(complement.metrics.recordedUnderReviewVersions,undefined);
            }
            await panel.getByRole('button',{name:index===0?'Explain report metrics':'Explain submission workflow counts',exact:true}).click();
            await expect(panel.getByRole('status')).toContainText('AI interpretation is disabled');
            if(index===1)await expect(panel.getByRole('status')).toContainText('Small cohorts receive static guidance only');
        }
    }
    const panel = await signedPage(actors[3]);
    await panel.goto(origin + '/dashboard');
    await expect(panel.getByRole('link', { name: 'System Guide', exact: true })).toHaveCount(0);
    await panel.goto(origin + '/dashboard/guide');
    await expect(panel).toHaveURL(origin + '/dashboard');
    const anonymous = await signedPage(null);
    await anonymous.goto(origin + '/dashboard/guide'); await expect(anonymous).toHaveURL(origin + '/login');
    const stale = await signedPage(actors[2], 1);
    await stale.goto(origin + '/dashboard/guide');
    await expect(stale.getByRole('status')).toContainText('System guidance is unavailable');
    await expect(stale.getByRole('button', { name: questions[0], exact: true })).toHaveCount(0);
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    console.log('PASS Chromium: Student canonical navigation; Admin/Adviser labeled deterministic synthetic mock output/loading and actual disabled fallback; owned fixtures, k=5/complement suppression; Panel/anonymous/stale role denied; no external/console/page/5xx errors. Mock presentation uses browser interception only, not operational Groq.');
}
async function cleanup() { await browser?.close(); server?.kill(); }
main().then(async () => { await cleanup(); process.exit(0); }).catch(async error => {
    console.error('FAIL guide browser acceptance: ' + error.name);
    console.error(error.stack.split('\n').filter(line => line.trim().startsWith('at ')).join('\n'));
    await cleanup(); process.exit(1);
});
