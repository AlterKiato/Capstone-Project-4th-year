/* eslint-disable @typescript-eslint/no-require-imports */
// Actual shell, Radix Sheet, preference store, draft boundary and notification/push
// providers. Synthetic Next routing/actions/platform/native environment only.
// No authenticated Next server, database, hosted service or real push operation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { build } = require('esbuild');
const { chromium, expect } = require('@playwright/test');

async function main() {
    const bundle = await build({ write: false, outfile: 'navigation.js', bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic',
        define: { 'process.env.NODE_ENV': '"production"' },
        stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
import React,{useEffect,useState}from'react';import{hydrateRoot}from'react-dom/client';import{renderToString}from'react-dom/server';
import Shell from './components/dashboard/dashboard-shell';import{dashboardLinks}from'./lib/constants/dashboard-navigation';
import SidebarPreferences from './components/dashboard/sidebar-preferences';
import Boundary,{useReviewDraft}from'./app/dashboard/adviser/submissions/ReviewDraftBoundary';
import Notifications,{useNotifications}from'./components/dashboard/notification-provider';
import{ResearchPushProvider}from'./components/dashboard/research-push-enrollment';
window.fixture={role:3,mode:'browser',platform:'desktop',route:'/dashboard/student',mounts:0,unmounts:0,notifications:0,pushClients:0,actions:[],routes:[]};
Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:new EventTarget()});
const expiresAt=Date.now()+3600000;
function Content(){const draft=useReviewDraft(),notifications=useNotifications();
useEffect(()=>{window.fixture.mounts++;return()=>{window.fixture.unmounts++;};},[]);
return <main className="dashboard-page"><h1>Synthetic research workspace</h1><p data-route="">{window.fixture.route}</p>
<label>Selected project<select aria-label="Selected project" defaultValue="one"><option value="one">Project one</option><option value="two">Project two</option></select></label>
<label>Workspace note<input aria-label="Workspace note" defaultValue=""/></label>
<label>Adviser feedback<textarea aria-label="Adviser feedback" defaultValue="" onChange={()=>draft.setDirty(true)}/></label>
<button type="button" onClick={()=>draft.setDirty(false)}>Keep draft for fixture</button>
<button type="button" onClick={()=>notifications.refresh()}>Refresh notifications</button>
<SidebarPreferences/>
{Array.from({length:25},(_,i)=><p key={i}>Synthetic research content {i}</p>)}
<label>Last research field<input aria-label="Last research field"/></label><button type="button">Last research action</button></main>;}
function App(){const[s,setS]=useState({...window.fixture});useEffect(()=>{
window.configureNavigation=patch=>{Object.assign(window.fixture,patch);setS({...window.fixture});};
window.fixtureNavigate=path=>{window.fixture.routes.push(path);history.pushState({},'',path);window.configureNavigation({route:path});};
window.fixtureReady=true;},[]);
return <ResearchPushProvider userId={7} roleId={s.role} configured={false} expiresAt={expiresAt}>
<Notifications historyHref={'/dashboard/'+({1:'admin',2:'adviser',3:'student'}[s.role]||'panel')+'/notifications'}>
<Shell links={dashboardLinks(s.role)}><Boundary><Content/></Boundary></Shell></Notifications></ResearchPushProvider>;}
const host=document.getElementById('root');host.innerHTML=renderToString(<App/>);hydrateRoot(host,<App/>);` },
        plugins: [{ name: 'navigation-fixture', setup(b) {
            b.onResolve({ filter: /^next\/(navigation|link)$|^@\/lib\/pwa\/(use-display-mode|research-push-browser)$|^@\/lib\/actions\/(notification|auth)\.action$/ },
                args => ({ path: args.path, namespace: 'fixture' }));
            b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => {
                let contents;
                if (args.path === 'next/navigation') contents = `const router={push:path=>window.fixtureNavigate(path),refresh:()=>window.fixture.actions.push('refresh')};
export const useRouter=()=>router;export const usePathname=()=>window.fixture.route;`;
                else if (args.path === 'next/link') contents = `export default function Link({onNavigate,children,prefetch,...props}){return <a {...props} onClick={event=>{
if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
event.preventDefault();onNavigate?.();window.fixtureNavigate(props.href);}}>{children}</a>;}`;
                else if (args.path.endsWith('use-display-mode')) contents = `import{useSyncExternalStore}from'react';const sub=()=>()=>{};
export const useDisplayMode=()=>useSyncExternalStore(sub,()=>window.fixture.mode,()=>'unknown');export const usePwaPlatform=()=>useSyncExternalStore(sub,()=>window.fixture.platform,()=>'unknown');`;
                else if (args.path.endsWith('research-push-browser')) contents = `export function browserPushEnvironment(){window.fixture.pushClients++;
return{supported:()=>false,permission:()=>'default',now:()=>Date.now(),cancel:()=>{},schedule:()=>0,
registration:async()=>{throw Error('Unexpected registration');},api:async()=>{throw Error('Unexpected push request');}};}`;
                else if (args.path.endsWith('notification.action')) contents = `export async function getNotificationPreviewAction(){window.fixture.notifications++;return{success:true,data:{unreadCount:0,items:[]}};}
export const markNotificationAsReadAction=async()=>({success:true});export const markAllNotificationsAsReadAction=markNotificationAsReadAction;`;
                else contents = `export async function logoutAction(){window.fixture.actions.push('logout');}`;
                return { loader: 'tsx', resolveDir: process.cwd(), contents };
            });
        } }],
    });
    const css = '@layer base {' + fs.readFileSync('node_modules/tailwindcss/preflight.css', 'utf8') + '}\n' +
        fs.readFileSync('app/globals.css', 'utf8').replace('@import "tailwindcss";', '') + '\n' + bundle.outputFiles.find(f => f.path.endsWith('.css')).text;
    const js = bundle.outputFiles.find(f => f.path.endsWith('.js')).text;
    const html = '<!doctype html><html data-theme="light"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>' + css + '</style></head><body><div id="root"></div><script>' + js + '</script></body></html>';
    const browser = await chromium.launch();
    const evidence = fs.mkdtempSync(join(tmpdir(), 'thesishs-adaptive-navigation-'));
    try {
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
        const page = await context.newPage(), errors = [], requests = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        await page.route('**/*', route => {
            if (route.request().isNavigationRequest() && route.request().url().startsWith('http://navigation.example.invalid/')) return route.fulfill({ contentType: 'text/html', body: html });
            requests.push(route.request().url()); return route.abort();
        });
        await page.goto('http://navigation.example.invalid/dashboard/student');
        await page.waitForFunction(() => window.fixtureReady && window.fixture.mounts === 1 && window.fixture.notifications === 1);
        const shell = page.locator('[data-sidebar-mode]'), sidebar = page.getByRole('complementary', { name: 'Workspace sidebar' });
        const menu = page.getByRole('button', { name: 'Open navigation menu', exact: true });
        const dialog = page.getByRole('dialog', { name: 'Navigation' });
        const close = () => dialog.getByRole('button', { name: 'Close navigation menu', exact: true }).click();
        const configure = patch => page.evaluate(patch => window.configureNavigation(patch), patch);
        const baseline = () => page.evaluate(() => ({ mounts: window.fixture.mounts, unmounts: window.fixture.unmounts,
            notifications: window.fixture.notifications, pushClients: window.fixture.pushClients, routes: window.fixture.routes.length, actions: window.fixture.actions.length }));
        async function noOverflow() { assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); }
        async function geometry() { return page.locator('main').evaluate(el => { const r = el.getBoundingClientRect(); return { x: r.x, width: r.width }; }); }
        async function contrast(root) {
            const failures = await root.evaluate(root => {
                const luminance = color => {
                    const c = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
                    return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
                };
                return [...root.querySelectorAll('a,button,h2,label,select')].flatMap(el => {
                    if (!el.getClientRects().length || el.matches(':disabled')) return [];
                    const style = getComputedStyle(el); let ancestor = el, background = style.backgroundColor;
                    while (background === 'rgba(0, 0, 0, 0)' && ancestor.parentElement) { ancestor = ancestor.parentElement; background = getComputedStyle(ancestor).backgroundColor; }
                    const [high, low] = [luminance(style.color), luminance(background)].sort((a, b) => b - a);
                    const large = parseFloat(style.fontSize) >= 24 || parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700;
                    return (high + .05) / (low + .05) < (large ? 3 : 4.5) ? [el.textContent] : [];
                });
            });
            assert.deepEqual(failures, [], 'Navigation text meets AA contrast');
        }
        async function preserved() {
            await expect(page.getByLabel('Selected project', { exact: true })).toHaveValue('two');
            await expect(page.getByLabel('Workspace note', { exact: true })).toHaveValue('Retained workspace note');
            await expect(page.getByLabel('Adviser feedback', { exact: true })).toHaveValue('Retained feedback');
        }
        async function setDesktopMode(value) {
            await page.getByLabel('Sidebar mode', { exact: true }).selectOption(value);
            await expect(shell).toHaveAttribute('data-sidebar-mode', value);
        }
        await expect(sidebar).toBeVisible(); await expect(shell).toHaveAttribute('data-sidebar-mode', 'expanded');
        assert.equal((await sidebar.boundingBox()).width, 240);
        await page.getByLabel('Selected project', { exact: true }).selectOption('two');
        await page.getByLabel('Workspace note', { exact: true }).fill('Retained workspace note');
        await page.getByLabel('Adviser feedback', { exact: true }).fill('Retained feedback');
        const stateBefore = await baseline();
        await page.screenshot({ path: join(evidence, 'web-expanded.png'), fullPage: false });
        await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
        await expect(shell).toHaveAttribute('data-sidebar-mode', 'compact'); assert.equal((await sidebar.boundingBox()).width, 64);
        const selector = page.getByLabel('Sidebar mode', { exact: true });
        await expect(selector).toHaveValue('compact');
        assert.deepEqual(await selector.locator('option').allTextContents(), ['Expanded', 'Compact']);
        await selector.selectOption('expanded'); await expect(shell).toHaveAttribute('data-sidebar-mode', 'expanded');
        const quickToggle = sidebar.locator('button[aria-controls="desktop-navigation"]');
        assert.equal(await quickToggle.textContent(), '', 'Quick toggle is icon-only');
        await quickToggle.click(); await expect(selector).toHaveValue('compact');
        assert.equal(await quickToggle.evaluate(el => el.getBoundingClientRect().top < 80), true, 'Toggle stays in sidebar header');
        const compactLink = sidebar.getByRole('link', { name: 'My Research & Submissions', exact: true });
        await expect(compactLink).toHaveAttribute('title', 'My Research & Submissions');
        await compactLink.focus(); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
        await expect(compactLink).toBeFocused(); assert.notEqual(await compactLink.evaluate(el => getComputedStyle(el).outlineStyle), 'none');
        await page.setViewportSize({ width: 390, height: 844 }); await expect(sidebar).toBeHidden(); await expect(menu).toBeVisible();
        await expect(selector).toHaveValue('compact');
        await expect(page.getByText('Applies to wide windows (1024px and wider). Narrow windows use the navigation menu.', { exact: true })).toBeVisible();
        assert.equal(await page.getByRole('navigation', { name: 'Primary dashboard pages' }).count(), 0);
        const before = await geometry(); await menu.click(); await expect(dialog).toBeVisible();
        assert.deepEqual(await geometry(), before, 'Opening Sheet does not shift or resize content');
        assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true);
        assert.equal(await page.locator('main').evaluate(el => !!el.closest('[aria-hidden="true"]')), true);
        await page.getByLabel('Workspace note', { exact: true }).evaluate(el => el.focus());
        assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true, 'Background cannot take focus');
        await dialog.getByRole('button', { name: 'Close navigation menu', exact: true }).focus();
        await page.keyboard.press('Shift+Tab'); await expect(dialog.getByRole('button', { name: 'Logout', exact: true })).toBeFocused();
        await page.keyboard.press('Tab'); await expect(dialog.getByRole('button', { name: 'Close navigation menu', exact: true })).toBeFocused();
        await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(menu).toBeFocused();
        await menu.click(); await page.locator('[data-navigation-backdrop]').click({ position: { x: 360, y: 100 } });
        await expect(dialog).toHaveCount(0); await expect(menu).toBeFocused();
        await menu.click(); await close(); await expect(menu).toBeFocused();
        await preserved(); assert.deepEqual(await baseline(), stateBefore);
        await page.setViewportSize({ width: 1280, height: 900 }); await expect(sidebar).toBeVisible();
        assert.equal((await sidebar.boundingBox()).width, 64); await preserved();
        await configure({ mode: 'standalone', platform: 'desktop' }); await expect(shell).toHaveAttribute('data-sidebar-mode', 'compact');
        const desktopBefore = await baseline();
        assert.deepEqual(await selector.locator('option').allTextContents(), ['Expanded', 'Compact', 'Hidden']);
        for (const theme of ['light', 'dark']) {
            await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
            await contrast(sidebar);
            await page.screenshot({ path: join(evidence, 'desktop-' + theme + '.png'), fullPage: false });
            await quickToggle.focus(); await page.keyboard.press('Enter'); await expect(selector).toHaveValue('expanded');
            await page.keyboard.press('Enter'); await expect(selector).toHaveValue('compact');
            assert.notEqual(await quickToggle.evaluate(el => getComputedStyle(el).outlineStyle), 'none');
            await contrast(page.locator('section[aria-labelledby="sidebar-preferences-heading"]'));
            await setDesktopMode('hidden'); await menu.click(); await contrast(dialog);
            await expect(dialog.getByRole('combobox')).toHaveCount(0);
            await page.keyboard.press('Escape'); await expect(menu).toBeFocused(); await setDesktopMode('compact');
        }
        for (const value of ['expanded', 'hidden', 'compact']) { await setDesktopMode(value); await preserved(); }
        assert.deepEqual(await baseline(), desktopBefore, 'Mode changes preserve providers, page instance and calls');
        await setDesktopMode('hidden'); await expect(sidebar).toBeHidden(); await expect(menu).toBeVisible();
        const hiddenGeometry = await geometry(); await menu.click(); assert.deepEqual(await geometry(), hiddenGeometry); await close();
        await page.setViewportSize({ width: 600, height: 900 }); await menu.click(); await page.setViewportSize({ width: 1280, height: 900 });
        await expect(dialog).toHaveCount(0); await expect(shell).toHaveAttribute('data-sidebar-mode', 'hidden');
        await expect(sidebar).toBeHidden();
        await page.reload(); await page.waitForFunction(() => window.fixtureReady);
        await expect(shell).toHaveAttribute('data-sidebar-mode', 'compact');
        await expect(selector).toHaveValue('compact');
        await configure({ mode: 'standalone', platform: 'desktop' }); await expect(shell).toHaveAttribute('data-sidebar-mode', 'hidden');
        await expect(selector).toHaveValue('hidden');
        await menu.click(); await dialog.getByRole('link', { name: 'Settings', exact: true }).click();
        await expect(dialog).toHaveCount(0); await expect(shell).toHaveAttribute('data-sidebar-mode', 'hidden');
        await expect(page.locator('#workspace-content')).toBeFocused();
        console.log('PASS browser/PWA modes, hydration, persistence, resize, keyboard/modal dismissal and state preservation');

        for (const [role, primaryLabels, secondaryLabels] of [
            [3, ['Dashboard', 'My Research & Submissions', 'Group Workspace'], ['Browse Repository', 'System Guide', 'Settings']],
            [2, ['Dashboard', 'Review Submissions', 'Research Groups'], ['Browse Repository', 'System Guide', 'Settings']],
            [1, ['Dashboard', 'Manage Users', 'Manage Groups', 'Repository Management'], ['Reports', 'Browse Repository', 'System Guide', 'Settings']],
        ]) {
            await page.setViewportSize({ width: 360, height: 780 });
            await configure({ role, platform: 'android', mode: 'standalone' });
            const bottom = page.locator('nav[aria-label="Primary dashboard pages"]');
            await expect(bottom).toBeVisible(); await expect(sidebar).toBeHidden(); await expect(menu).toBeVisible();
            await expect(selector).toHaveCount(0);
            assert.equal(await menu.textContent(), '', 'Header menu is icon-only');
            assert.equal(await menu.evaluate(el => getComputedStyle(el).borderTopWidth), '0px');
            const menuSize = await menu.boundingBox(); assert.ok(menuSize.width >= 44 && menuSize.height >= 44);
            await menu.click(); await expect(dialog).toBeVisible(); await page.keyboard.press('Escape'); await expect(menu).toBeFocused();
            assert.deepEqual(await bottom.getByRole('link').evaluateAll(links => links.map(el => el.getAttribute('aria-label'))), primaryLabels);
            for (const link of await bottom.getByRole('link').all()) { await link.click(); await expect(link).toHaveAttribute('aria-current', 'page'); }
            const more = bottom.getByRole('button', { name: 'More navigation', exact: true });
            await more.click(); await expect(dialog).toBeVisible();
            assert.deepEqual(await dialog.getByRole('link').evaluateAll(links => links.map(el => el.textContent)), secondaryLabels);
            assert.equal(await bottom.evaluate(el => !!el.closest('[aria-hidden="true"]')), true);
            assert.equal(await dialog.evaluate(el => Number(getComputedStyle(el).zIndex)) > await bottom.evaluate(el => Number(getComputedStyle(el).zIndex)), true);
            await close(); await expect(more).toBeFocused();
            for (const name of secondaryLabels) {
                await more.click(); await dialog.getByRole('link', { name, exact: true }).click(); await expect(dialog).toHaveCount(0);
                await expect(more).toHaveAttribute('data-active', 'true');
            }
            const targetSizes = await bottom.locator('a,button').evaluateAll(els => els.map(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })));
            assert.ok(targetSizes.every(r => r.width >= 44 && r.height >= 48));
            await noOverflow();
        }
        console.log('PASS Student/Adviser/Admin primary/secondary routes, active states, More layering and touch targets');

        await configure({ role: 2, mode: 'standalone', platform: 'ios' });
        await page.getByLabel('Adviser feedback', { exact: true }).fill('Unsaved Adviser draft');
        const more = page.getByRole('button', { name: 'More navigation', exact: true }); await more.click();
        const guardBefore = await baseline();
        page.once('dialog', prompt => prompt.dismiss()); await dialog.getByRole('link', { name: 'Browse Repository', exact: true }).click();
        await expect(dialog).toBeVisible(); await expect(page.getByLabel('Adviser feedback', { exact: true })).toHaveValue('Unsaved Adviser draft');
        assert.deepEqual(await baseline(), guardBefore);
        page.once('dialog', prompt => prompt.dismiss()); await dialog.getByRole('button', { name: 'Logout', exact: true }).click();
        assert.deepEqual(await baseline(), guardBefore); await expect(dialog).toBeVisible();
        page.once('dialog', prompt => prompt.accept()); await dialog.getByRole('link', { name: 'Browse Repository', exact: true }).click();
        await expect(dialog).toHaveCount(0); await expect(page.locator('#workspace-content')).toBeFocused();
        assert.equal((await baseline()).routes, guardBefore.routes + 1);
        // The provider's allowlisted worker-message bridge still passes through the real draft guard.
        const pushMessage = () => page.evaluate(() => {
            const event = new Event('message'); Object.defineProperties(event, { data: { value: { type: 'thesishs-research-push', destination: 'adviser-notifications' } },
                source: { value: { scriptURL: location.origin + '/sw.js' } } }); navigator.serviceWorker.dispatchEvent(event);
        });
        page.once('dialog', prompt => prompt.dismiss()); const pushBefore = await baseline(); await pushMessage(); assert.deepEqual(await baseline(), pushBefore);
        page.once('dialog', prompt => prompt.accept()); await pushMessage();
        assert.equal((await baseline()).routes, pushBefore.routes + 1);
        await page.getByRole('button', { name: 'Keep draft for fixture', exact: true }).click();
        const providerBefore = await baseline();
        for (let i = 0; i < 3; i++) { await more.click(); await close(); }
        assert.deepEqual(await baseline(), providerBefore);
        console.log('PASS real Adviser draft boundary accepts/cancels portaled links, Logout and push navigation; provider stability');

        for (const [width, theme] of [[360, 'light'], [390, 'dark']]) {
            await page.setViewportSize({ width, height: 780 }); await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
            await page.getByRole('button', { name: 'Last research action', exact: true }).scrollIntoViewIfNeeded();
            const action = await page.getByRole('button', { name: 'Last research action', exact: true }).boundingBox();
            const bar = await page.getByRole('navigation', { name: 'Primary dashboard pages' }).boundingBox();
            assert.ok(action.y + action.height <= bar.y, 'Bottom action clears fixed navigation'); await noOverflow();
            await page.screenshot({ path: join(evidence, 'mobile-' + theme + '.png'), fullPage: false });
            await more.click();
            await contrast(dialog);
            assert.equal(await dialog.evaluate(el => getComputedStyle(el).animationName), 'none');
            await page.screenshot({ path: join(evidence, 'sheet-' + theme + '.png'), fullPage: false });
            await page.keyboard.press('Escape'); await expect(more).toBeFocused();
            await contrast(page.locator('nav[aria-label="Primary dashboard pages"]'));
        }
        await page.setViewportSize({ width: 390, height: 340 });
        await page.getByLabel('Last research field', { exact: true }).focus(); await page.getByLabel('Last research field', { exact: true }).scrollIntoViewIfNeeded();
        const field = await page.getByLabel('Last research field', { exact: true }).boundingBox();
        const bar = await page.getByRole('navigation', { name: 'Primary dashboard pages' }).boundingBox();
        assert.ok(field.y + field.height <= bar.y, 'Short viewport permits focused field to scroll above bottom bar');
        await configure({ role: 4 }); await expect(page.getByRole('navigation', { name: 'Primary dashboard pages' })).toHaveCount(0);
        await expect(menu).toBeVisible(); await menu.click(); assert.deepEqual(await dialog.getByRole('link').evaluateAll(els => els.map(el => el.getAttribute('href'))), ['/dashboard', '/dashboard/repository', '/dashboard/settings']); await close();
        await configure({ role: 3, platform: 'unknown' }); await expect(page.getByRole('navigation', { name: 'Primary dashboard pages' })).toHaveCount(0);
        await configure({ platform: 'android', mode: 'browser' }); await expect(page.getByRole('navigation', { name: 'Primary dashboard pages' })).toHaveCount(0);
        await configure({ mode: 'standalone' }); await more.click(); await dialog.getByRole('button', { name: 'Logout', exact: true }).click();
        await page.waitForFunction(() => window.fixture.actions.includes('logout'));
        assert.deepEqual(await page.evaluate(() => window.fixture.actions), ['logout', 'refresh']);
        // Same-origin second tab exercises real browser storage events.
        const other = await context.newPage();
        await other.route('**/*', route => route.request().isNavigationRequest()
            ? route.fulfill({ contentType: 'text/html', body: html }) : route.abort());
        await other.goto('http://navigation.example.invalid/dashboard/student'); await other.waitForFunction(() => window.fixtureReady);
        await other.setViewportSize({ width: 1280, height: 900 });
        await other.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('[data-sidebar-mode]').dataset.sidebarMode === 'expanded');
        await other.close();
        // Storage refusal must not prevent explicit in-memory selection or hydration.
        await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }));
        await page.reload(); await page.waitForFunction(() => window.fixtureReady);
        await page.setViewportSize({ width: 1280, height: 900 });
        await expect(shell).toHaveAttribute('data-sidebar-mode', 'expanded');
        await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click(); await expect(shell).toHaveAttribute('data-sidebar-mode', 'compact');
        await configure({ mode: 'standalone', platform: 'desktop' }); await setDesktopMode('hidden');
        for (const [role, count] of [[3, 6], [2, 6], [1, 8], [4, 3]]) {
            await page.setViewportSize({ width: 1024, height: 700 });
            await configure({ role, mode: 'standalone', platform: 'desktop' });
            for (const mode of ['expanded', 'compact']) {
                await setDesktopMode(mode); await expect(sidebar).toBeVisible();
                const rail = await sidebar.boundingBox(), main = await geometry();
                assert.equal(rail.x, 12); assert.equal(rail.y, 12);
                assert.equal(rail.width, mode === 'compact' ? 64 : 240);
                assert.ok(main.x >= rail.x + rail.width + 12, 'Content reserves both island gaps');
                await expect(sidebar.getByRole('link')).toHaveCount(count);
                assert.deepEqual(await sidebar.locator('svg').evaluateAll(els => [...new Set(els.map(el => el.getAttribute('width')))]), ['22']);
                const small = await sidebar.locator('a,button').evaluateAll(els => els.filter(el => { const r = el.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).map(el => el.getAttribute('aria-label')));
                assert.deepEqual(small, [], 'Compact targets remain at least 44px');
                await noOverflow();
                if (mode === 'expanded') await page.screenshot({ path: join(evidence, `ui-s11-role${role}-desktop.png`), fullPage: false });
            }
            await setDesktopMode('hidden'); await expect(sidebar).toBeHidden();
            assert.equal(await shell.evaluate(el => getComputedStyle(el).paddingLeft), '0px');
            for (const width of [1023, 360]) {
                await page.setViewportSize({ width, height: 320 });
                await configure({ role, mode: 'standalone', platform: 'android' });
                await menu.click(); await expect(dialog).toBeVisible();
                const bounds = await dialog.boundingBox();
                assert.equal(bounds.x, 12); assert.equal(bounds.y, 12);
                assert.ok(bounds.y + bounds.height <= 308 && bounds.x + bounds.width <= width - 12);
                const logout = dialog.getByRole('button', { name: 'Logout', exact: true });
                const footer = await logout.boundingBox(); assert.ok(footer.y + footer.height <= bounds.y + bounds.height);
                const last = dialog.getByRole('link').last(); await last.scrollIntoViewIfNeeded(); await expect(last).toBeVisible();
                await expect(page.locator('[data-navigation-backdrop]')).toBeVisible();
                await noOverflow();
                if (width === 360) await page.screenshot({ path: join(evidence, `ui-s11-role${role}-short-drawer.png`), fullPage: false });
                await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(menu).toBeFocused();
            }
        }
        console.log('PASS UI-S1.1 all-role island geometry at 1024/1023/360px, compact targets, hidden offset, 22px icons and short drawer scroll/logout/focus');
        // Emulated touch checks the actual Radix touch path, without physical-device claims.
        const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
        const touchPage = await touch.newPage();
        touchPage.on('pageerror', error => errors.push(error.message));
        await touchPage.route('**/*', route => route.request().isNavigationRequest()
            ? route.fulfill({ contentType: 'text/html', body: html }) : route.abort());
        await touchPage.goto('http://navigation.example.invalid/dashboard/student'); await touchPage.waitForFunction(() => window.fixtureReady);
        await touchPage.evaluate(() => window.configureNavigation({ mode: 'standalone', platform: 'android' }));
        await touchPage.getByRole('button', { name: 'More navigation', exact: true }).tap();
        await touchPage.getByRole('dialog').getByRole('button', { name: 'Close navigation menu', exact: true }).tap();
        await expect(touchPage.getByRole('dialog')).toHaveCount(0); await touch.close();
        assert.deepEqual(requests, []); assert.deepEqual(errors, []);
        console.log('PASS Light/Dark AA text contrast, reduced motion, small/short viewports, content clearance, safe fallbacks, Logout bridge, cross-tab/blocked storage and emulated touch');
        console.log('Synthetic Chromium evidence: ' + evidence);
    } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
