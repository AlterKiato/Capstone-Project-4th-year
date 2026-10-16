/* eslint-disable @typescript-eslint/no-require-imports */
// Production routes + uniquely owned local synthetic SQL fixtures. Group transitions
// and Unpublish only; publication signing is covered by isolated service/UI tests.
const assert = require('node:assert/strict');
const Module = require('node:module');
const { spawn } = require('node:child_process');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
require('dotenv/config');
const target = new URL(process.env.DATABASE_URL);
assert.equal(target.hostname, 'localhost'); assert.equal(target.port, '5432'); assert.equal(target.pathname, '/thesishs_ai');
const load = Module._load;
Module._load = function(id, ...args) { return id === 'server-only' ? {} : load.call(this, id, ...args); };
const { db } = require('../lib/db.ts');
const { sql } = require('drizzle-orm');
const { createToken } = require('../lib/auth/jwt.ts');
const { getRepositoryManagementData } = require('../lib/services/repository.service.ts');
const { chromium } = require('@playwright/test');
const expect = require('@playwright/test').expect.configure({ timeout: 15000 });
const origin = 'http://127.0.0.1:3045', marker = 'PHASE977C_BROWSER_' + Date.now();
const ids = [], groupIds = [], paperIds = [], contexts = [], errors = [], external = [];
let server, browser;
const row = async query => (await db.execute(query))[0];
const list = values => values.length ? sql.join(values.map(v => sql`${v}`), sql`, `) : sql`NULL`;
async function pageFor(actor, role = actor?.role_id) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } }); contexts.push(context);
    await context.route('**/*', route => { if (new URL(route.request().url()).origin !== origin) { external.push('external request'); return route.abort(); } return route.continue(); });
    if (actor) await context.addCookies([{ name: 'thesishs_session', value: await createToken({ userId: actor.id, roleId: role, email: 'synthetic@example.invalid' }), url: origin, httpOnly: true, sameSite: 'Lax' }]);
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', response => { if (response.url().startsWith(origin) && response.status() >= 500) errors.push('HTTP 5xx'); }); return page;
}
async function contrast(page) {
    const failures = await page.locator('main').evaluate(root => {
        const lum = color => { const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(x => { x /= 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }); return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722; };
        return [...root.querySelectorAll('h1,h2,h3,p,button,label,input,select,span,strong,time,dt,dd')].flatMap(el => {
            if (!el.getClientRects().length || !el.textContent.trim() || el.disabled || el.closest('fieldset:disabled')) return [];
            const style = getComputedStyle(el); let parent = el, bg = style.backgroundColor;
            while (bg === 'rgba(0, 0, 0, 0)' && parent.parentElement) { parent = parent.parentElement; bg = getComputedStyle(parent).backgroundColor; }
            const [high, low] = [lum(style.color), lum(bg)].sort((a, b) => b - a);
            const required = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700) ? 3 : 4.5;
            return (high + .05) / (low + .05) < required ? [el.textContent.slice(0, 65)] : [];
        });
    }); assert.deepEqual(failures, []);
}
async function layout(page) {
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'document overflow');
    assert.ok(await page.locator('main section > ul > li').evaluateAll(rows => rows.every(el => el.scrollWidth <= el.clientWidth + 1)), 'row overflow'); await contrast(page);
    assert.ok(await page.locator('main button, main input, main select').evaluateAll(controls => controls.filter(el => el.getClientRects().length).every(el => el.getBoundingClientRect().height >= 44)), '44px management controls');
}
async function focusLoop(page, modal) {
    const close = modal.getByRole('button', { name: /^Close / }), cancel = modal.getByRole('button', { name: 'Cancel', exact: true });
    await expect(close).toBeFocused(); await cancel.focus(); await page.keyboard.press('Tab'); await expect(close).toBeFocused();
    await page.keyboard.press('Shift+Tab'); await expect(cancel).toBeFocused();
    assert.ok(await page.evaluate(() => document.activeElement.matches(':focus-visible') && parseFloat(getComputedStyle(document.activeElement).outlineWidth) >= 3));
    assert.ok(await modal.evaluate(el => el.scrollWidth <= el.clientWidth + 1 && el.clientHeight <= innerHeight));
    await contrast(page);
}
async function main() {
    assert.equal((await row(sql`SELECT current_database() name`)).name, 'thesishs_ai');
    const actors = [];
    for (const [role, active] of [[1, true], [2, true], [3, true], [4, true], [1, false]]) {
        const actor = await row(sql`INSERT INTO users(first_name,last_name,email,password,role_id,is_active) VALUES ('Synthetic',${marker},${marker + ids.length + '@example.invalid'},'!unusable',${role},${active}) RETURNING id,role_id`); ids.push(actor.id); actors.push(actor);
    }
    const [admin, adviser, student, panel, inactive] = actors;
    for (const [suffix, status] of [['Alpha ' + 'LongGroup'.repeat(5), 'active'], ['Beta', 'archived']]) {
        const group = await row(sql`INSERT INTO research_groups(group_name,strand,section,school_year,adviser_id,status) VALUES (${marker + suffix},'SYNTHETIC STEM','One','2026-2027',${adviser.id},${status}) RETURNING id,group_name`); groupIds.push(group.id);
    }
    const groupName = (await row(sql`SELECT group_name FROM research_groups WHERE id=${groupIds[0]}`)).group_name;
    const titles = [];
    for (const state of ['Ready', 'Published', 'Hidden']) {
        const title = marker + ' ' + state + ' ' + 'LongResearchTitle'.repeat(8); titles.push(title);
        const paper = await row(sql`INSERT INTO research_papers(group_id,title,abstract,status) VALUES (${groupIds[0]},${title},'Synthetic UI fixture','Approved') RETURNING id`); paperIds.push(paper.id);
        await db.execute(sql`INSERT INTO submissions(paper_id,submitted_by,version,status,file_url) VALUES (${paper.id},${student.id},'v1','Approved',${'research/' + paper.id + '/v1/synthetic.pdf'})`);
        if (state !== 'Ready') await db.execute(sql`INSERT INTO repositories(paper_id,is_published,published_at) VALUES (${paper.id},${state === 'Published'},${state === 'Published' ? new Date().toISOString() : null})`);
    }
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3045'], { windowsHide: true, stdio: 'ignore' });
    let ready = false; for (let i = 0; i < 120; i++) { if (server.exitCode !== null) throw Error('Temporary production server exited before startup'); try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* startup */ } await new Promise(r => setTimeout(r, 250)); }
    assert.ok(ready); browser = await chromium.launch(); const page = await pageFor(admin);
    const paths = ['/dashboard/admin/groups', '/dashboard/admin/repository'];
    for (const path of paths) {
        await page.goto(origin + path); await expect(page.locator('.dashboard-welcome')).not.toBeVisible();
        const metrics = page.locator('dl > div > dd');
        if (path.endsWith('groups')) {
            const counts = await row(sql`SELECT count(*) total,count(*) FILTER(WHERE status='active') active,count(*) FILTER(WHERE status='archived') archived FROM research_groups`);
            assert.deepEqual(await metrics.allTextContents(), [counts.total, counts.active, counts.archived].map(String));
            const search = page.getByLabel('Search groups', { exact: true }), filter = page.getByLabel('Group status', { exact: true });
            await search.fill(marker.toLowerCase()); await expect(page.locator('section > ul > li')).toHaveCount(2); await filter.selectOption('active'); await expect(page.locator('section > ul > li')).toHaveCount(1);
            await expect(page.getByText('Adviser ID: ' + adviser.id, { exact: true })).toBeVisible();
            await search.fill('  synthetic    stem  '); await expect(page.locator('section > ul > li')).toHaveCount(1); await search.fill('  oNe  '); await expect(page.locator('section > ul > li')).toHaveCount(1);
            await search.fill('definitely-unmatched-' + marker); await expect(page.getByText(/^No groups match/)).toBeVisible(); await page.getByRole('button', { name: 'Clear filters', exact: true }).click(); await search.fill(marker.toLowerCase());
        } else {
            const data = await getRepositoryManagementData(admin.id), published = data.repositoryEntries.filter(e => e.isPublished).length;
            assert.deepEqual(await metrics.allTextContents(), [data.eligiblePapers.length, published, data.repositoryEntries.length - published].map(String));
            await expect(page.getByRole('heading', { name: titles[0], exact: true })).toBeVisible(); await expect(page.getByRole('heading', { name: titles[2], exact: true })).toHaveCount(0);
        }
        for (const width of [1280, 360]) for (const theme of ['Light', 'Dark']) {
            await page.setViewportSize({ width, height: width === 360 ? 560 : 900 });
            await page.getByRole('button', { name: 'Change theme', exact: true }).click(); await page.getByRole('menuitemradio', { name: theme, exact: true }).click();
            await layout(page); await page.screenshot({ path: join(tmpdir(), `phase977c-${path.endsWith('groups') ? 'groups' : 'ready'}-${width}-${theme}.png`), fullPage: true });
            if (path.endsWith('groups')) {
                const trigger = page.getByRole('button', { name: 'Archive ' + groupName, exact: true }); await trigger.click(); const modal = page.getByRole('dialog'); await focusLoop(page, modal);
                await page.screenshot({ path: join(tmpdir(), `phase977c-group-confirm-${width}-${theme}.png`) }); await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
            } else {
                const publish = page.getByRole('button', { name: 'Publish ' + titles[0], exact: true }); await publish.click(); let modal = page.getByRole('dialog'); await focusLoop(page, modal); await page.screenshot({ path: join(tmpdir(), `phase977c-publish-confirm-${width}-${theme}.png`) }); await modal.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(publish).toBeFocused();
                const entries = page.getByRole('button', { name: 'Repository Entries', exact: true }); await entries.focus(); await page.keyboard.press('Enter'); await expect(entries).toHaveAttribute('aria-pressed', 'true');
                await page.getByLabel('Repository visibility').selectOption('hidden'); await expect(page.getByRole('heading', { name: titles[2], exact: true })).toBeVisible(); await expect(page.getByRole('heading', { name: titles[1], exact: true })).toHaveCount(0); await layout(page);
                await page.screenshot({ path: join(tmpdir(), `phase977c-entries-${width}-${theme}.png`), fullPage: true });
                const republish = page.getByRole('button', { name: 'Republish ' + titles[2], exact: true }); await republish.click(); modal = page.getByRole('dialog'); await focusLoop(page, modal); await page.keyboard.press('Escape'); await expect(republish).toBeFocused();
                await page.getByLabel('Repository visibility').selectOption('published'); const unpublish = page.getByRole('button', { name: 'Unpublish ' + titles[1], exact: true }); await unpublish.click(); await focusLoop(page, modal); await page.keyboard.press('Escape'); await expect(unpublish).toBeFocused();
                await page.getByLabel('Repository visibility').selectOption(''); await expect(page.getByRole('heading', { name: titles[1], exact: true })).toBeVisible(); await expect(page.getByRole('heading', { name: titles[2], exact: true })).toBeVisible();
                await page.getByRole('button', { name: 'Ready to Publish', exact: true }).click();
            }
            await page.getByRole('button', { name: 'Notifications', exact: true }).click(); await page.keyboard.press('Escape');
            if (width === 360) { const menu = page.getByRole('button', { name: 'Open navigation menu', exact: true }); await menu.click(); await page.keyboard.press('Escape'); await expect(menu).toBeFocused(); }
            else { await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click(); await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click(); }
        }
    }
    // Actual group mutation, pending lock, authoritative filtered refresh and retained search.
    await page.setViewportSize({ width: 1280, height: 900 }); await page.goto(origin + paths[0]); await page.getByLabel('Search groups', { exact: true }).fill(marker); await page.getByLabel('Group status', { exact: true }).selectOption('active');
    let requests = 0;
    await page.route('**/dashboard/admin/groups', async route => { if (route.request().method() === 'POST') { requests++; await new Promise(r => setTimeout(r, 650)); } await route.continue(); });
    await page.getByRole('button', { name: 'Archive ' + groupName, exact: true }).click(); let modal = page.getByRole('dialog'); await modal.getByRole('button', { name: 'Confirm archive', exact: true }).click();
    await expect(modal.getByRole('button', { name: 'Saving…', exact: true })).toBeDisabled(); await page.keyboard.press('Escape'); await page.mouse.click(1, 1); await expect(modal).toBeVisible();
    await modal.locator('form').evaluate(form => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    await expect(modal).not.toBeVisible(); await expect(page.getByText(/^No groups match/)).toBeVisible(); assert.equal(requests, 1); await expect(page.getByLabel('Search groups', { exact: true })).toHaveValue(marker);
    assert.equal((await row(sql`SELECT status FROM research_groups WHERE id=${groupIds[0]}`)).status, 'archived'); await page.unroute('**/dashboard/admin/groups');
    await page.getByLabel('Group status', { exact: true }).selectOption('archived'); await page.getByRole('button', { name: 'Reactivate ' + groupName, exact: true }).click(); await modal.getByRole('button', { name: 'Confirm reactivate', exact: true }).click(); await expect(modal).not.toBeVisible();
    await expect(page.locator('section > ul > li')).toHaveCount(1); assert.equal((await row(sql`SELECT status FROM research_groups WHERE id=${groupIds[0]}`)).status, 'active');
    // Unpublish a run-owned fixture without storage access; Hidden remains reachable.
    await page.goto(origin + paths[1]); await page.getByRole('button', { name: 'Repository Entries', exact: true }).click(); await page.getByLabel('Repository visibility').selectOption('published');
    await page.getByRole('button', { name: 'Unpublish ' + titles[1], exact: true }).click(); modal = page.getByRole('dialog'); await modal.getByRole('button', { name: 'Confirm unpublish', exact: true }).click(); await expect(modal).not.toBeVisible(); await expect(page.getByLabel('Repository visibility')).toHaveValue('published'); await expect(page.getByRole('heading', { name: titles[1], exact: true })).toHaveCount(0);
    await page.getByLabel('Repository visibility').selectOption('hidden'); await expect(page.getByRole('button', { name: 'Republish ' + titles[1], exact: true })).toBeVisible(); await page.getByRole('button', { name: 'Ready to Publish', exact: true }).click(); await expect(page.getByRole('heading', { name: titles[1], exact: true })).toHaveCount(0);
    for (const actor of [adviser, student, panel]) { const other = await pageFor(actor); for (const path of paths) { await other.goto(origin + path); await expect(other).toHaveURL(origin + '/dashboard' + ({ 2: '/adviser', 3: '/student', 4: '' }[actor.role_id])); } }
    for (const actor of [inactive, adviser, { id: 2147483647, role_id: 1 }]) {
        const denied = await pageFor(actor, 1); for (const path of paths) { await denied.goto(origin + path); await expect(denied.getByRole('heading', { name: 'Workspace unavailable', exact: true })).toBeVisible(); await expect(denied.locator('main p[role="alert"]')).toContainText('account access could not be verified'); await expect(denied.locator('dl')).toHaveCount(0); }
    }
    const anonymous = await pageFor(null); for (const path of paths) { await anonymous.goto(origin + path); await expect(anonymous).toHaveURL(origin + '/login'); }
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    console.log('PASS production Chromium: SQL-derived metrics, ID projection/search/combined filters, two-view candidate/entry partition, all visibility filters, all named confirmations, real Archive/Reactivate and Unpublish with authoritative refresh/state preservation; pending Escape/backdrop/duplicate protection; role/stale/inactive/missing/anonymous route denial. 360/1280 Light/Dark, long names/titles, AA computed contrast, 44px controls, short-screen dialog overflow/focus loop/restoration, selected-view semantics, sidebar/bell. Zero runtime errors/external requests.');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
    for (const context of contexts) await context.close(); await browser?.close(); server?.kill();
    const owned = (await db.execute(sql`SELECT id FROM users WHERE last_name=${marker}`)).map(r => r.id);
    const groups = (await db.execute(sql`SELECT id FROM research_groups WHERE adviser_id IN (${list(owned)}) AND group_name LIKE ${marker + '%'}`)).map(r => r.id);
    const papers = (await db.execute(sql`SELECT id FROM research_papers WHERE group_id IN (${list(groups)})`)).map(r => r.id);
    assert.ok(owned.length <= 5 && groups.length <= 2 && papers.length <= 3);
    await db.execute(sql`DELETE FROM repositories WHERE paper_id IN (${list(papers)})`); await db.execute(sql`DELETE FROM submissions WHERE paper_id IN (${list(papers)})`); await db.execute(sql`DELETE FROM research_papers WHERE id IN (${list(papers)})`); await db.execute(sql`DELETE FROM research_groups WHERE id IN (${list(groups)})`);
    await db.execute(sql`DELETE FROM notifications WHERE user_id IN (${list(owned)})`); await db.execute(sql`DELETE FROM activity_logs WHERE user_id IN (${list(owned)})`); await db.execute(sql`DELETE FROM users WHERE id IN (${list(owned)}) AND last_name=${marker}`);
    for (const query of [sql`SELECT count(*) n FROM users WHERE last_name=${marker}`, sql`SELECT count(*) n FROM research_groups WHERE id IN (${list(groups)})`, sql`SELECT count(*) n FROM research_papers WHERE id IN (${list(papers)})`, sql`SELECT count(*) n FROM submissions WHERE paper_id IN (${list(papers)})`, sql`SELECT count(*) n FROM repositories WHERE paper_id IN (${list(papers)})`, sql`SELECT count(*) n FROM notifications WHERE user_id IN (${list(owned)})`, sql`SELECT count(*) n FROM activity_logs WHERE user_id IN (${list(owned)})`]) assert.equal(Number((await row(query)).n), 0);
    console.log('PASS independent fixture cleanup: zero run-owned users/groups/papers/submissions/repositories/notifications/activity; no storage or unrelated records touched.'); process.exit(process.exitCode || 0);
});
