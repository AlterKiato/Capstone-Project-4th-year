/* eslint-disable @typescript-eslint/no-require-imports */
// Actual skeletons/shared shell in Chromium; controlled React Suspense fixture only.
// No Next server, HTTP authentication, database, action execution or network access.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { build } = require('esbuild');
const { chromium, expect } = require('@playwright/test');
async function main() {
    const bundle = await build({ write: false, outfile: 'skeleton-fixture.js', bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic',
        define: { 'process.env.NODE_ENV': '"production"' },
        stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
import React,{Suspense,useEffect,useState}from'react';import{hydrateRoot}from'react-dom/client';import{renderToString}from'react-dom/server';
import Skeleton from './components/dashboard/dashboard-skeleton';import StudentLoading from './app/dashboard/student/loading';
import SubmissionsLoading from './app/dashboard/student/submissions/loading';import WorkspaceLoading from './app/dashboard/student/workspace/loading';
import Shell from './components/dashboard/dashboard-shell';import{dashboardLinks}from'./lib/constants/dashboard-navigation';
const paths={student:'/dashboard/student',submissions:'/dashboard/student/submissions',workspace:'/dashboard/student/workspace',adviser:'/dashboard/adviser',groups:'/dashboard/adviser/groups',admin:'/dashboard/admin'};
let resource={pending:false,promise:null,resolve:null};window.__skeletonPath=paths.student;
function Content({view}){if(resource.pending)throw resource.promise;return <main className="dashboard-page"><h1>Synthetic ready content: {view}</h1><p>Component fixture only.</p></main>;}
function App(){const[view,setView]=useState('student');const[version,setVersion]=useState(0);
useEffect(()=>{window.showSkeleton=(next)=>{window.__skeletonPath=paths[next];resource.pending=true;resource.promise=new Promise(resolve=>resource.resolve=resolve);setView(next);setVersion(v=>v+1);};
window.resolveSkeleton=()=>{resource.pending=false;resource.resolve?.();setVersion(v=>v+1);};
window.navigateFixture=path=>{const next=Object.keys(paths).find(key=>paths[key]===path);if(next)window.showSkeleton(next);};window.fixtureReady=true;},[]);
const role=view==='admin'?1:['adviser','groups'].includes(view)?2:3;
const fallback=view==='student'?<StudentLoading/>:view==='submissions'?<SubmissionsLoading/>:view==='workspace'?<WorkspaceLoading/>:<Skeleton page={view}/>;
return <Shell links={dashboardLinks(role)}><Suspense fallback={fallback}><Content key={version} view={view}/></Suspense></Shell>;}
const host=document.getElementById('root');host.innerHTML=renderToString(<App/>);hydrateRoot(host,<App/>);` },
        plugins: [{ name: 'synthetic-navigation', setup(b) {
            b.onResolve({ filter: /^next\/(navigation|link)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
            b.onResolve({ filter: /^@\/components\/auth\/logout-button$/ }, () => ({ path: 'logout', namespace: 'fixture' }));
            b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'tsx', resolveDir: process.cwd(), contents: args.path === 'next/navigation'
                ? 'export function usePathname(){return window.__skeletonPath;}' : args.path === 'next/link'
                    ? 'export default function Link({onNavigate,children,...props}){return <a {...props} onClick={event=>{event.preventDefault();onNavigate?.();window.navigateFixture(props.href);}}>{children}</a>;}'
                    : 'export default function Logout({className,icon,labelClassName}){return <button className={className} onClick={()=>window.fixtureLogout=true}>{icon}<span className={labelClassName}>Log out</span></button>;}' }));
        } }],
    });
    const browser = await chromium.launch();
    const evidence = fs.mkdtempSync(join(tmpdir(), 'thesishs-skeleton-'));
    try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } }), errors = [], requests = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        await page.route('**/*', route => { requests.push(route.request().url()); return route.abort(); });
        await page.setContent('<html data-theme="light"><body><div id="root"></div></body></html>');
        await page.addStyleTag({ content: '@layer base {' + fs.readFileSync('node_modules/tailwindcss/preflight.css', 'utf8') + '}\n' +
            fs.readFileSync('app/globals.css', 'utf8') + '\n' + bundle.outputFiles.find(f => f.path.endsWith('.css')).text });
        await page.addScriptTag({ content: bundle.outputFiles.find(f => f.path.endsWith('.js')).text });
        await page.waitForFunction(() => window.fixtureReady);
        for (const width of [1280, 360]) {
            await page.setViewportSize({ width, height: 900 });
            for (const theme of ['light', 'dark']) {
                await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
                for (const view of ['student', 'submissions', 'workspace', 'adviser', 'groups', 'admin']) {
                    await page.evaluate(view => window.showSkeleton(view), view);
                    const loading = page.locator(`[data-skeleton="${view}"]`);
                    await expect(loading).toBeVisible(); await expect(loading).toHaveAttribute('aria-busy', 'true');
                    assert.equal(await loading.locator('button,input,select,textarea,a,[tabindex]').count(), 0);
                    assert.equal(await loading.getByRole('status').count(), 1);
                    const layout = await loading.evaluate(root => ({
                        fits: document.documentElement.scrollWidth <= innerWidth && root.getBoundingClientRect().right <= innerWidth + 1,
                        neutral: [...root.querySelectorAll('span')].every(el => getComputedStyle(el).animationName === 'none'),
                        fill: getComputedStyle(root.querySelector('span')).backgroundColor,
                    }));
                    assert.equal(layout.fits, true, `${view}/${theme}/${width} overflow`); assert.equal(layout.neutral, true);
                    assert.equal(layout.fill, theme === 'dark' ? 'rgb(54, 74, 98)' : 'rgb(226, 232, 240)');
                    if (width === 1280 && theme === 'light' && view === 'student' || width === 360 && theme === 'dark' && view === 'workspace')
                        await page.screenshot({ path: join(evidence, `${view}-${theme}-${width}.png`), fullPage: true });
                    await page.evaluate(() => window.resolveSkeleton());
                    await expect(loading).toHaveCount(0); await expect(page.getByRole('heading', { name: `Synthetic ready content: ${view}`, exact: true })).toBeVisible();
                }
            }
        }
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.evaluate(() => window.showSkeleton('adviser'));
        await expect(page.locator('[data-skeleton="adviser"]')).toBeVisible();
        await page.evaluate(() => window.__sidebar = document.querySelector('aside'));
        await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
        await page.getByRole('navigation', { name: 'Dashboard pages' }).filter({ visible: true }).getByRole('link', { name: 'Research Groups', exact: true }).focus();
        await page.keyboard.press('Enter');
        await expect(page.locator('[data-skeleton="groups"]')).toBeVisible();
        assert.equal(await page.evaluate(() => document.querySelector('aside') === window.__sidebar), true);
        await expect(page.getByRole('button', { name: 'Expand sidebar', exact: true })).toBeVisible();
        await page.evaluate(() => window.resolveSkeleton());
        await page.setViewportSize({ width: 360, height: 900 });
        await page.getByRole('button', { name: 'Open navigation menu', exact: true }).click();
        await page.getByRole('dialog').getByRole('link', { name: 'Dashboard', exact: true }).click();
        await expect(page.getByRole('dialog')).not.toBeVisible(); await expect(page.locator('[data-skeleton="adviser"]')).toBeVisible();
        await page.evaluate(() => window.resolveSkeleton());
        assert.deepEqual(errors, []); assert.deepEqual(requests, []);
        console.log('PASS six skeletons at 1280/360 in Light/Dark; natural Suspense replacement; SSR hydration; neutral reduced-motion-safe surfaces; no focusable placeholders; persistent sidebar and desktop/mobile navigation. Synthetic component fixture only.');
        console.log('Visual evidence: ' + evidence);
    } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
