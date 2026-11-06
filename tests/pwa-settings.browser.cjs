/* eslint-disable @typescript-eslint/no-require-imports */
// Actual installation/push UI, lifecycle client and shared shell in Chromium.
// Platform/native/API doubles only; no Next server, real permission prompts, DB or network.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { build } = require('esbuild');
const { chromium, expect } = require('@playwright/test');
async function main() {
    const bundle = await build({ write: false, outfile: 'pwa-settings.js', bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic',
        define: { 'process.env.NODE_ENV': '"production"' },
        stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
import React,{useEffect,useState}from'react';import{hydrateRoot}from'react-dom/client';import{renderToString}from'react-dom/server';
import Installation from './components/dashboard/app-installation';import Controls,{ResearchPushProvider}from'./components/dashboard/research-push-enrollment';
import Shell from './components/dashboard/dashboard-shell';import{dashboardLinks}from'./lib/constants/dashboard-navigation';
import{logoutWithResearchPushCleanup}from'./lib/pwa/research-push-client';
window.__pwa={roleId:3,mode:'browser',platform:'desktop',page:'dashboard',long:false,scene:0,supported:true,permission:'granted',log:[],routes:[],local:null,row:null};
const expiresAt=Date.now()+3600000;
Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:new EventTarget()});
function App(){const[s,setS]=useState(window.__pwa);useEffect(()=>{window.configurePwa=(patch)=>{Object.assign(window.__pwa,patch);setS({...window.__pwa});};
window.navigatePwa=path=>window.configurePwa({page:path.endsWith('/settings')?'settings':'dashboard'});
window.fixtureLogout=()=>logoutWithResearchPushCleanup(async()=>window.__pwa.log.push('logout'));
window.fixtureReady=true;},[]);
const content=<Shell links={dashboardLinks(s.roleId)}><main className="dashboard-page"><h1>{s.page==='settings'?'Settings':'Synthetic Dashboard'}</h1>
{s.page==='settings'?<><Installation/><Controls/></>:s.long?Array.from({length:70},(_,i)=><p key={i}>Synthetic research paragraph {i}</p>):<p>Research content.</p>}</main></Shell>;
return [2,3].includes(s.roleId)?<ResearchPushProvider key={s.scene} roleId={s.roleId} userId={s.roleId} configured={true} expiresAt={expiresAt}>{content}</ResearchPushProvider>:content;}
const host=document.getElementById('root');host.innerHTML=renderToString(<App/>);hydrateRoot(host,<App/>);` },
        plugins: [{ name: 'pwa-fixture', setup(b) {
            b.onResolve({ filter: /^next\/(navigation|link)$|^@\/lib\/pwa\/(use-display-mode|research-push-browser)$|^@\/components\/auth\/logout-button$/ },
                args => ({ path: args.path, namespace: 'fixture' }));
            b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => {
                let contents;
                if (args.path === 'next/navigation') contents = `const router={push(path){window.__pwa.routes.push(path);}};export const useRouter=()=>router;
export const usePathname=()=>window.__pwa.page==='settings'?'/dashboard/settings':'/dashboard/'+({1:'admin',2:'adviser',3:'student'}[window.__pwa.roleId]||'panel');`;
                else if (args.path === 'next/link') contents = 'export default function Link({onNavigate,children,...props}){return <a {...props} onClick={event=>{event.preventDefault();onNavigate?.();window.navigatePwa(props.href);}}>{children}</a>;}' ;
                else if (args.path.endsWith('logout-button')) contents = 'export default function Logout({className,icon,labelClassName}){return <button aria-label="Logout" className={className} onClick={()=>window.fixtureLogout()}>{icon}<span className={labelClassName}>Logout</span></button>;}' ;
                else if (args.path.endsWith('use-display-mode')) contents = `import{useSyncExternalStore}from'react';const sub=()=>()=>{};
export const useDisplayMode=()=>useSyncExternalStore(sub,()=>window.__pwa.mode,()=>'unknown');export const usePwaPlatform=()=>useSyncExternalStore(sub,()=>window.__pwa.platform,()=>'unknown');`;
                else contents = `export function browserPushEnvironment(userId){const s=()=>window.__pwa;const log=value=>s().log.push(value);
const registration={pushManager:{getSubscription:async()=>s().local}};
return{supported:()=>s().supported,permission:()=>s().permission,registration:async create=>{log('registration:'+create);return registration;},
fingerprint:async()=> 'synthetic-fingerprint',sameKey:()=>true,subscribe:async()=>{log('subscribe');const subscription={endpoint:'https://push.example.invalid/synthetic',expirationTime:null,
toJSON:()=>({keys:{p256dh:'synthetic-key',auth:'synthetic-auth'}}),unsubscribe:async()=>{log('unsubscribe');s().local=null;return true;}};s().local=subscription;return subscription;},
api:async(method,body)=>{log(method);if(method==='POST')s().row={generation:body.registrationId,enabled:true,endpointFingerprint:'synthetic-fingerprint',vapidKeyId:'synthetic-key',authorizedUntil:'2033-05-18T03:33:20.000Z'};
if(method==='DELETE'&&body.generations.includes(s().row?.generation))s().row={...s().row,enabled:false,endpointFingerprint:null};
return method==='GET'?{available:true,publicKey:'synthetic-key',keyId:'synthetic-key',enrollment:s().row}:{ok:true,enrollment:s().row};},
uuid:()=> '00000000-0000-4000-8000-'+String(s().log.length).padStart(12,'0'),now:()=>Date.now(),schedule:(cb,ms)=>setTimeout(cb,ms),cancel:id=>clearTimeout(id)};}`;
                return { loader: 'tsx', resolveDir: process.cwd(), contents };
            });
        } }],
    });
    const browser = await chromium.launch();
    const evidence = fs.mkdtempSync(join(tmpdir(), 'thesishs-pwa-settings-'));
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
        async function contrast() {
            const failures = await page.locator('main').evaluate(root => {
                const luminance = color => {
                    const c = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
                    return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
                };
                return [...root.querySelectorAll('h1,h2,p,summary,button')].flatMap(el => {
                    if (!el.getClientRects().length || el.matches(':disabled')) return [];
                    const style = getComputedStyle(el); let ancestor = el, background = style.backgroundColor;
                    while (background === 'rgba(0, 0, 0, 0)' && ancestor.parentElement) { ancestor = ancestor.parentElement; background = getComputedStyle(ancestor).backgroundColor; }
                    const [high, low] = [luminance(style.color), luminance(background)].sort((a, b) => b - a);
                    const large = parseFloat(style.fontSize) >= 24 || parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700;
                    return (high + .05) / (low + .05) < (large ? 3 : 4.5) ? [el.textContent] : [];
                });
            });
            assert.deepEqual(failures, []);
        }
        async function scene(patch) {
            await page.evaluate(patch => window.configurePwa({ scene: window.__pwa.scene + 1, log: [], routes: [], local: null, row: null,
                permission: 'granted', supported: true, page: 'settings', long: false, ...patch }), patch);
            await expect(page.getByRole('heading', { name: patch.page === 'dashboard' ? 'Synthetic Dashboard' : 'Settings', exact: true })).toBeVisible();
        }
        for (const roleId of [3, 2, 1]) {
            await scene({ roleId, mode: 'browser', platform: 'desktop', page: 'dashboard' });
            await expect(page.getByRole('heading', { name: 'Synthetic Dashboard' })).toBeVisible();
            assert.equal(await page.locator('.installation-help').count(), 0); assert.equal(await page.getByRole('heading', { name: 'Research Notifications' }).count(), 0);
            assert.equal(await page.locator('main').evaluate(el => el.getBoundingClientRect().height < innerHeight / 2), true);
            await page.evaluate(() => window.configurePwa({ long: true }));
            await page.getByText('Synthetic research paragraph 69', { exact: true }).scrollIntoViewIfNeeded();
            await expect(page.getByText('Synthetic research paragraph 69', { exact: true })).toBeVisible();
            assert.equal(await page.locator('main footer,main .installation-help').count(), 0);
        }
        for (const [width, theme] of [[1280, 'light'], [360, 'dark']]) {
            await page.setViewportSize({ width, height: 900 });
            await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
            await scene({ roleId: 3, mode: 'browser', platform: width === 360 ? 'android' : 'desktop' });
            await expect(page.getByRole('heading', { name: 'App Installation' })).toBeVisible();
            await page.locator('summary').focus(); await page.keyboard.press('Enter');
            await expect(page.getByText('Menu names and installation support vary', { exact: false })).toBeVisible();
            await contrast();
            assert.equal(await page.locator('main').evaluate(root => document.documentElement.scrollWidth <= innerWidth &&
                getComputedStyle(root.querySelector('.installation-help')).position === 'static'), true);
            assert.equal(await page.getByRole('button', { name: 'Enable Notifications' }).count(), 0);
            assert.deepEqual(await page.evaluate(() => window.__pwa.log), []);
        }
        await scene({ roleId: 3, mode: 'standalone', platform: 'desktop' });
        await expect(page.getByText('Running in installed app mode.')).toBeVisible();
        assert.equal(await page.locator('details').count(), 0); assert.equal(await page.getByRole('heading', { name: 'Research Notifications' }).count(), 0);
        assert.deepEqual(await page.evaluate(() => window.__pwa.log), []);
        await scene({ roleId: 3, mode: 'standalone', platform: 'android' });
        await expect(page.getByRole('button', { name: 'Enable Notifications', exact: true })).toBeVisible();
        assert.equal(await page.evaluate(() => window.__pwa.log.includes('subscribe')), false, 'No automatic permission/subscription attempt');
        await page.getByRole('button', { name: 'Enable Notifications', exact: true }).click();
        await expect(page.getByText('Notifications are enabled on this device.')).toBeVisible();
        assert.equal(await page.getByRole('heading', { name: 'Research Notifications' }).count(), 1);
        for (const theme of ['light', 'dark']) { await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme); await contrast(); }
        await page.screenshot({ path: join(evidence, 'mobile-dark-settings.png'), fullPage: true });
        const logBefore = await page.evaluate(() => window.__pwa.log.slice());
        await page.evaluate(() => window.configurePwa({ page: 'dashboard' }));
        await expect(page.getByRole('heading', { name: 'Research Notifications' })).toHaveCount(0);
        await page.evaluate(() => window.configurePwa({ page: 'settings' }));
        await expect(page.getByText('Notifications are enabled on this device.')).toBeVisible();
        assert.deepEqual(await page.evaluate(() => window.__pwa.log), logBefore, 'Controls remount does not create a second client or request');
        await page.getByRole('button', { name: 'Disable Notifications', exact: true }).click();
        await expect(page.getByText('Notifications are disabled on this browser.', { exact: false })).toBeVisible();
        await page.getByRole('button', { name: 'Enable Notifications', exact: true }).click();
        await expect(page.getByText('Notifications are enabled on this device.')).toBeVisible();
        await page.evaluate(() => {
            window.configurePwa({ page: 'dashboard' });
            const event = new Event('message'); Object.defineProperties(event, {
                data: { value: { type: 'thesishs-research-push', destination: 'student-notifications' } },
                source: { value: { scriptURL: location.origin + '/sw.js' } },
            }); navigator.serviceWorker.dispatchEvent(event);
        });
        assert.deepEqual(await page.evaluate(() => window.__pwa.routes), ['/dashboard/student/notifications']);
        // Installed mobile navigation now keeps Logout in the shared More Sheet.
        await page.getByRole('button', { name: 'More navigation', exact: true }).click();
        await page.getByRole('dialog', { name: 'Navigation' }).getByRole('button', { name: 'Logout', exact: true }).click();
        await page.waitForFunction(() => window.__pwa.log.at(-1) === 'logout');
        assert.deepEqual((await page.evaluate(() => window.__pwa.log)).slice(-3), ['DELETE', 'unsubscribe', 'logout']);
        for (const [roleId, supported, permission] of [[2, true, 'granted'], [3, false, 'granted'], [3, true, 'denied']]) {
            await scene({ roleId, mode: 'standalone', platform: 'ios', supported, permission });
            await expect(page.getByRole('heading', { name: 'Research Notifications' })).toBeVisible();
            if (!supported) await expect(page.getByText('Research notifications are not supported in this browser.')).toBeVisible();
            else if (permission === 'denied') await expect(page.getByText('Notifications are blocked.', { exact: false })).toBeVisible();
            else await expect(page.getByRole('button', { name: 'Enable Notifications', exact: true })).toBeVisible();
        }
        await scene({ roleId: 1, mode: 'standalone', platform: 'android' });
        await expect(page.getByText('Running in installed app mode.')).toBeVisible();
        assert.equal(await page.getByRole('heading', { name: 'Research Notifications' }).count(), 0);
        assert.deepEqual(await page.evaluate(() => window.__pwa.log), []);
        assert.deepEqual(errors, []); assert.deepEqual(requests, []);
        console.log('PASS dashboard short/long cleanup for three roles; browser/desktop/mobile Settings; Light/Dark 1280/360; keyboard disclosure; mobile Student/Adviser enrollment/disable fallbacks; one persistent owner across navigation; push tap and logout cleanup outside Settings; Admin exclusion; no network or real push.');
        console.log('Visual evidence: ' + evidence);
    } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
