/* eslint-disable @typescript-eslint/no-require-imports */
// Actual client components in Chromium with explicit in-memory action responses.
// Covers unavailable/error/uncertain states without disturbing real records or governance.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { build } = require('esbuild'); // Existing transitive dependency of tsx.
const { chromium, expect } = require('@playwright/test');
const mocks = `
const s=window.__state={users:[],calls:[],result:{success:false,message:'Synthetic authorization denied.'},eligibility:{available:true,canDecide:true,decision:'Pending Verification',revoked:false,revision:8},delay:0};
const wait=()=>new Promise(r=>setTimeout(r,s.delay));
export async function createManagedAccountAction(input){s.calls.push({kind:'create',roleId:input.roleId});await wait();return s.result;}
export async function changeUserRoleAction(id,role){s.calls.push({kind:'role',id,role});await wait();return s.result;}
export async function changeUserStatusAction(id,active){s.calls.push({kind:'status',id,active});await wait();return s.result;}
export async function getEligibilityUIAction(input){s.calls.push({kind:'read',...input});await wait();return {...s.eligibility};}
export async function recordAIEligibilityAction(input){s.calls.push({kind:'eligibility',...input});await wait();if(s.result.success){s.eligibility.decision=input.decision;s.eligibility.revoked=input.revoke;s.eligibility.revision++;}return s.result;}
export async function getConsentUIAction(){return {available:false,eligible:false};}
export async function recordAIConsentAction(){throw Error('Not in scope');}
`;
async function main() {
    const bundle = await build({ write: false, outfile: 'ui.js', bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
        stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `import React from 'react';import{createRoot}from'react-dom/client';import Users from './components/dashboard/admin-users';const root=createRoot(document.getElementById('root'));window.renderUsers=users=>root.render(<main className="dashboard-page"><Users key={Date.now()} users={users} actorId={1}/></main>);window.renderUsers([]);` },
        plugins: [{ name: 'synthetic-actions', setup(b) {
            b.onResolve({ filter: /^@\/lib\/actions\// }, () => ({ path: 'actions', namespace: 'mock' }));
            b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'navigation', namespace: 'mock' }));
            b.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: args.path === 'actions' ? mocks : 'export function useRouter(){return {refresh(){window.__refreshes=(window.__refreshes||0)+1;}}}', loader: 'js' }));
        } }],
    });
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 360, height: 560 } }), errors = [], external = [];
        page.on('pageerror', error => errors.push(error.message)); await page.route('**/*', route => { external.push('request'); return route.abort(); });
        await page.setContent('<html data-theme="light"><body><div id="root"></div></body></html>');
        await page.addStyleTag({ content: fs.readFileSync('app/globals.css', 'utf8') + '\n' + bundle.outputFiles.find(file => file.path.endsWith('.css')).text });
        await page.addScriptTag({ content: bundle.outputFiles.find(file => file.path.endsWith('.js')).text });
        await expect(page.getByText('No registered users.', { exact: true })).toBeVisible();
        const user = { id: 2, firstName: 'Synthetic', lastName: 'Target', email: 'synthetic@example.invalid', roleId: 2, isActive: true, createdAt: '2026-01-01T00:00:00Z' };
        await page.evaluate(user => window.renderUsers([user]), user);
        await page.getByRole('button', { name: 'New Account', exact: true }).click();
        let modal = page.getByRole('dialog', { name: 'Create Account', exact: true });
        for (const [label, value] of [['First name', 'Synthetic'], ['Last name', 'Target'], ['Email', 'synthetic@example.invalid'], ['Password', 'test-password'], ['Confirm password', 'test-password']]) await modal.getByLabel(label, { exact: true }).fill(value);
        await modal.getByRole('button', { name: 'Create account', exact: true }).click(); await expect(modal.getByRole('status')).toContainText('Synthetic authorization denied.');
        await expect(page.getByRole('dialog')).toHaveCount(1); assert.equal(await page.evaluate(() => window.__refreshes || 0), 0);
        await page.evaluate(() => { window.__state.result = { success: false, uncertain: true, message: 'Refresh and verify the directory before retrying.' }; });
        await modal.getByRole('button', { name: 'Create account', exact: true }).click(); await expect(modal.getByRole('button', { name: 'Create account', exact: true })).toBeDisabled();
        await expect(modal.getByRole('alert')).toContainText('Submission is paused');
        page.once('dialog', prompt => prompt.accept()); await page.keyboard.press('Escape');
        await page.locator('#manage-user-2').click(); modal = page.getByRole('dialog', { name: 'Manage Account', exact: true });
        await modal.getByRole('button', { name: 'Deactivate', exact: true }).click(); await modal.getByRole('button', { name: 'Confirm status change', exact: true }).click();
        await expect(modal.getByRole('alert')).toContainText('Further changes are paused'); await expect(modal.getByRole('button', { name: 'Confirm status change', exact: true })).toBeDisabled();
        assert.equal(await page.evaluate(() => window.__state.calls.filter(call => call.kind === 'status').length), 1);
        await modal.getByRole('button', { name: 'Refresh directory', exact: true }).click(); assert.equal(await page.evaluate(() => window.__refreshes), 1);
        await page.locator('#manage-user-2').click(); await modal.getByRole('button', { name: 'AI eligibility', exact: true }).click();
        modal = page.getByRole('dialog', { name: 'Institutional AI eligibility', exact: true });
        await expect(modal.getByRole('button', { name: 'Record eligibility', exact: true })).toBeDisabled(); await expect(modal.getByRole('checkbox')).not.toBeChecked();
        await modal.getByLabel('Eligibility decision', { exact: true }).selectOption('Eligible'); await modal.getByRole('checkbox').check();
        await expect(modal.getByRole('button', { name: 'Record eligibility', exact: true })).toBeEnabled();
        await modal.getByLabel('Eligibility decision', { exact: true }).selectOption('Not Eligible'); await expect(modal.getByRole('checkbox')).not.toBeChecked();
        await modal.getByLabel('Eligibility decision', { exact: true }).selectOption('Eligible'); await modal.getByRole('checkbox').check();
        await page.evaluate(() => { window.__state.result = { success: true, message: 'Synthetic decision recorded.' }; window.__state.delay = 500; });
        await modal.getByRole('button', { name: 'Record eligibility', exact: true }).click(); await page.keyboard.press('Escape'); await expect(modal).toBeVisible();
        await expect(modal.getByText('Current status:', { exact: false })).toContainText('Eligible'); await expect(modal.getByRole('checkbox')).not.toBeChecked();
        const decision = await page.evaluate(() => window.__state.calls.find(call => call.kind === 'eligibility'));
        assert.deepEqual(decision, { kind: 'eligibility', userId: 2, decision: 'Eligible', revoke: false, confirmation: true, expectedRevision: 8 });
        await modal.getByRole('checkbox').check(); await modal.getByRole('button', { name: 'Revoke eligibility', exact: true }).click();
        await expect(modal.getByText(/Existing consent will be invalidated/)).toBeVisible(); await modal.getByRole('button', { name: 'Cancel revocation', exact: true }).click();
        await modal.getByRole('button', { name: 'Revoke eligibility', exact: true }).click(); await modal.getByRole('button', { name: 'Confirm revocation', exact: true }).click();
        await expect(modal.getByText('Current status:', { exact: false })).toContainText('Not Eligible (revoked)');
        const revoked = await page.evaluate(() => window.__state.calls.filter(call => call.kind === 'eligibility').at(-1)); assert.equal(revoked.expectedRevision, 9); assert.equal(revoked.revoke, true);
        await page.keyboard.press('Escape');
        await page.evaluate(() => { window.__state.eligibility.available = false; window.__state.eligibility.canDecide = false; window.__state.delay = 0; });
        await page.locator('#manage-user-2').click(); await page.getByRole('dialog').getByRole('button', { name: 'AI eligibility', exact: true }).click();
        await expect(modal.getByText('Eligibility is unavailable. Account access is unaffected.', { exact: true })).toBeVisible(); await expect(modal.getByRole('checkbox')).toBeDisabled(); await expect(modal.getByLabel('Eligibility decision', { exact: true })).toBeDisabled();
        assert.deepEqual(errors, []); assert.deepEqual(external, []);
        console.log('PASS synthetic-only Chromium: empty directory, denied creation/no false refresh, uncertain create/status retry lock, refresh control, one modal, verifier checkbox reset/pending Escape, exact eligibility identity/revisions, explicit revocation, unavailable controls. Actual components, in-memory actions; no institutional approval, database or provider calls.');
    } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
