/* eslint-disable @typescript-eslint/no-require-imports */
// One bounded synthetic UI check. Actual React forms/CSS; no Next server, DB, SMTP or external requests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { build } = require('esbuild');
const { chromium, expect } = require('@playwright/test');

async function main() {
    const out = 'test-results/email-otp-20261115';
    fs.mkdirSync(out, { recursive: true });
    const bundle = await build({ write: false, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic',
        define: { 'process.env.NODE_ENV': '"production"' }, stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
import React from 'react';import {createRoot} from 'react-dom/client';
import Form from './components/auth/verification-confirmation-form';
window.otpModel={confirm:'invalid',delay:0,calls:[]};const root=createRoot(document.getElementById('root'));
window.mountOtp=(resendAt=0)=>root.render(<main className="auth-page"><p className="product-name">ThesiSHS AI</p><h1>Verify your email</h1><p>Enter the six-digit code. Codes expire after five minutes.</p><Form key={resendAt} enabled={true} resendAt={resendAt}/><p className="auth-switch"><a href="/login">Continue to password login</a></p></main>);
window.mountOtp(Date.now()+1500);
` }, plugins: [{ name: 'offline-otp-actions', setup(b) {
            b.onResolve({ filter: /^@\/lib\/actions\/email-verification.action$/ }, () => ({ path: 'actions', namespace: 'offline' }));
            b.onLoad({ filter: /.*/, namespace: 'offline' }, () => ({ contents: `
export async function confirmVerificationAction(previous,form){window.otpModel.calls.push(['confirm',form.get('code')]);await new Promise(r=>setTimeout(r,window.otpModel.delay));
return window.otpModel.confirm==='success'?{success:true,message:'Email verified. Continue to login with your password.'}:{success:false,message:window.otpModel.confirm==='expired'?'This code has expired. Request a new code.':'Incorrect code. Enter the newest six-digit code.'};}
export async function requestVerificationAction(){window.otpModel.calls.push(['resend']);return{success:false,message:'Email delivery could not be confirmed. Check your inbox, then request another code after the cooldown.',data:{resendAt:Date.now()+5000}};}
` }));
        } }] });
    const css = '@layer base {' + fs.readFileSync('node_modules/tailwindcss/preflight.css', 'utf8') + '}\n' + fs.readFileSync('app/globals.css', 'utf8').replace(/^@import.*$/m, '');
    const browser = await chromium.launch({ headless: true, timeout: 15000, args: ['--disable-gpu'] });
    const errors = [], requests = [];
    try {
        const page = await browser.newPage({ viewport: { width: 360, height: 850 } });
        page.setDefaultTimeout(7000);
        page.on('pageerror', e => errors.push(e.message));
        page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
        await page.route('**/*', route => route.request().url() === 'http://otp-ui.invalid/'
            ? route.fulfill({ contentType: 'text/html', body: '<html data-theme="light"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>' })
            : (requests.push(route.request().url()), route.abort()));
        await page.goto('http://otp-ui.invalid/');
        await page.addStyleTag({ content: css });
        await page.addScriptTag({ content: bundle.outputFiles[0].text });
        const code = page.getByRole('textbox', { name: 'Six-digit code' });
        const verify = page.getByRole('button', { name: 'Verify email', exact: true });
        const resend = page.getByRole('button', { name: /Resend|Checking resend/ });
        await expect(resend).toBeDisabled();
        await expect(resend).toBeEnabled();
        assert.equal(await code.getAttribute('autocomplete'), 'one-time-code');
        await code.fill('000007'); await code.press('Enter');
        await expect(page.getByText('Incorrect code. Enter the newest six-digit code.', { exact: true })).toBeVisible();
        assert.deepEqual(await page.evaluate(() => window.otpModel.calls[0]), ['confirm', '000007']);
        await resend.click(); await expect(page.getByText(/Email delivery could not be confirmed/)).toBeVisible();
        await expect(resend).toBeDisabled();
        for (const [width, theme] of [[360, 'light'], [1280, 'dark']]) {
            await page.setViewportSize({ width, height: 850 });
            await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            for (const control of [code, verify]) assert.ok((await control.boundingBox()).height >= 44);
            await code.focus();
            assert.equal(await code.evaluate(el => el === document.activeElement), true);
            const contrast = await code.evaluate(el => {
                const rgb = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(x => { x /= 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; });
                const lum = c => { const [r,g,b] = rgb(c); return .2126*r+.7152*g+.0722*b; };
                const style = getComputedStyle(el), a=lum(style.color), b=lum(style.backgroundColor);
                return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
            });
            assert.ok(contrast >= 4.5);
            await page.screenshot({ path: `${out}/otp-${width}-${theme}.png`, fullPage: true });
        }
        await page.evaluate(() => { window.otpModel.confirm='expired'; window.otpModel.delay=500; });
        await code.fill('000007'); await verify.click();
        await expect(page.getByRole('button', { name: 'Verifying...' })).toBeDisabled();
        await expect(page.getByText('This code has expired. Request a new code.', { exact: true })).toBeVisible();
        await page.evaluate(() => { window.otpModel.confirm='success'; window.otpModel.delay=0; });
        await code.fill('000008'); await verify.click();
        await expect(page.getByText('Email verified. Continue to login with your password.', { exact: true })).toBeVisible();
        await expect(resend).toHaveCount(0);
        assert.equal(await page.getByRole('link', { name: 'Continue to password login' }).getAttribute('href'), '/login');
        assert.deepEqual(errors, []); assert.deepEqual(requests, []);
        fs.writeFileSync(`${out}/ui-result.json`, JSON.stringify({ pass: true, widths: [360,1280], themes: ['light','dark'], syntheticActions: true, unexpectedRequests: requests.length, errors: errors.length }, null, 2));
        console.log('PASS: OTP forms, full-code input, keyboard submit, cooldown, delivery recovery, expiry/success, 360px Light/1280px Dark, zero network/browser errors.');
    } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode=1; });
