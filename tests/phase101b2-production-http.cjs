/* eslint-disable @typescript-eslint/no-require-imports */
// Production build, loopback only; no fixtures, mutations or SMTP server required.
const assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');
const { runBrowserAcceptance } = require('./helpers/phase96-lifecycle.cjs');
const origin = 'http://127.0.0.1:3032';
const previous = { enabled: process.env.THESISHS_LOCAL_MAILPIT, origin: process.env.THESISHS_VERIFICATION_ORIGIN };
process.env.THESISHS_LOCAL_MAILPIT = 'enabled'; // Even an enabled flag must not bypass NODE_ENV.
process.env.THESISHS_VERIFICATION_ORIGIN = origin;
let passed = false;
runBrowserAcceptance(async lifecycle => {
    await lifecycle.startServer(3032);
    const browser = await lifecycle.launchBrowser(chromium);
    const context = await browser.newContext(); const page = await context.newPage();
    const response = await page.goto(origin + '/verify-email#token=' + '0'.repeat(64));
    assert.equal(response.headers()['referrer-policy'], 'no-referrer'); assert.match(response.headers()['cache-control'], /no-store/);
    assert.match(response.headers()['x-robots-tag'], /noindex/);
    await expect(page.getByText('Email confirmation is currently unavailable. You can continue using your account.')).toBeVisible();
    const button = page.getByRole('button', { name: 'Confirm my email' }); await expect(button).toBeDisabled();
    await expect(page.locator('input[name="token"]')).toHaveValue('0'.repeat(64));
    // Client-side disabled controls are not authorization; force the real action POST.
    await button.evaluate(element => { element.disabled = false; });
    const pending = page.waitForResponse(value => value.request().method() === 'POST');
    await button.click(); const posted = await pending;
    await expect(page.getByRole('status').filter({ hasText: 'Wait a minute' })).toBeVisible();
    assert.match(posted.headers()['cache-control'], /no-store/);
    assert.equal((await context.cookies()).filter(cookie => cookie.name === 'thesishs_session').length, 0);
    const status = await context.request.get(origin + '/dashboard/student/verify-email', { maxRedirects: 0 });
    assert.ok([303, 307, 308].includes(status.status())); assert.match(status.headers()['location'], /\/login$/);
    assert.match(status.headers()['cache-control'], /no-store/); assert.equal(status.headers()['referrer-policy'], 'no-referrer');
    passed = true;
    console.log('PASS production GET/POST no-store, no-referrer, noindex, anonymous redirect and server-side production refusal despite enabled flag.');
}, { label: 'Phase 10.1B.2 production HTTP', timeoutMs: 90000,
    deps: { report: () => { console.log('FAIL production HTTP check; credential details withheld.'); } },
}).finally(() => {
    for (const [key, value] of Object.entries({ THESISHS_LOCAL_MAILPIT: previous.enabled, THESISHS_VERIFICATION_ORIGIN: previous.origin }))
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
    if (!passed) process.exitCode = 1;
});
