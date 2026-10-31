/* eslint-disable @typescript-eslint/no-require-imports */
// Called by the isolated workspace harness; all actions/PDF responses are synthetic.
const assert = require('node:assert/strict');
const { expect } = require('@playwright/test');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

async function noObstruction(page) {
    const collisions = await page.locator('[data-placement]').evaluate(dock => {
        const toast = dock.querySelector('.swipe-toast__card').getBoundingClientRect();
        return [...document.querySelectorAll('main iframe, main [contenteditable], main button, main select, main [aria-labelledby="review-confirmation-heading"]')]
            .filter(node => { const r = node.getBoundingClientRect(); return r.width && r.height && toast.left < r.right && toast.right > r.left && toast.top < r.bottom && toast.bottom > r.top; }).length;
    });
    assert.equal(collisions, 0, 'The toast must leave editor/PDF/review controls unobstructed');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
}

async function desktop(page) {
    const editor = page.getByRole('textbox', { name: 'Feedback Comments', exact: true });
    const toast = page.locator('.swipe-toast');
    const indicator = page.getByText('Unsaved changes', { exact: true });
    const close = page.getByRole('button', { name: 'Dismiss unsaved feedback notification', exact: true });
    async function mounted() {
        await expect.poll(async () => {
            await page.clock.runFor(40);
            return toast.count().then(count => count ? toast.getAttribute('data-mounted') : null);
        }).toBe('true');
    }
    await expect(toast).toHaveCount(0); await expect(indicator).toBeHidden();
    await editor.fill('Synthetic toast draft');
    await mounted(); await expect(toast).toHaveCount(1); await expect(indicator).toBeVisible();
    await expect(editor).toBeFocused();
    await expect(toast).toHaveAttribute('data-mounted', 'true');
    assert.equal(await toast.locator('.swipe-toast__lift').evaluate(node => getComputedStyle(node).transitionDuration.split(',')[0]), '0.35s');
    await noObstruction(page);
    const original = await toast.elementHandle();
    await page.clock.fastForward(6000);
    await editor.press('End'); await editor.pressSequentially(' more');
    assert.equal(await original.evaluate(node => node === document.querySelector('.swipe-toast')), true);
    await page.clock.fastForward(1000);
    await expect(toast).toHaveAttribute('data-phase', 'closing');
    assert.ok(await toast.locator('.swipe-toast__lift').evaluate(node => parseFloat(getComputedStyle(node).transitionDuration) > 0));
    await expect.poll(() => toast.locator('.swipe-toast__lift').evaluate(node => new DOMMatrix(getComputedStyle(node).transform).m42)).toBeGreaterThan(0);
    await page.clock.runFor(650);
    await expect(toast).toHaveCount(0);
    await expect(editor).toHaveText('Synthetic toast draft more'); await expect(editor).toBeFocused();
    await expect(indicator).toBeVisible();
    assert.equal(await page.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; }), true);
    page.once('dialog', dialog => dialog.dismiss());
    await page.getByLabel('Submission version', { exact: true }).selectOption('2');
    await expect(page.getByLabel('Submission version', { exact: true })).toHaveValue('1');
    await editor.fill('Synthetic later keystroke'); await page.clock.runFor(40); await expect(toast).toHaveCount(0);

    async function fresh(text = 'Synthetic separate draft') {
        await editor.fill(''); await expect(indicator).toBeHidden();
        await editor.fill(text); await mounted(); await expect(toast).toHaveCount(1);
    }
    await fresh();
    await close.click(); await page.clock.runFor(700);
    await expect(toast).toHaveCount(0); await expect(indicator).toBeVisible(); await expect(editor).toBeFocused();
    await fresh();
    await close.focus(); await page.clock.fastForward(8000);
    await expect(toast).toHaveAttribute('data-phase', 'open'); await expect(close).toBeFocused();
    await close.press('Escape'); await page.clock.runFor(700);
    await expect(toast).toHaveCount(0); await expect(editor).toBeFocused();

    await fresh('Synthetic swipe draft');
    await toast.scrollIntoViewIfNeeded(); await page.clock.runFor(60);
    const box = await toast.locator('.swipe-toast__card').boundingBox();
    await page.mouse.move(box.x + 40, box.y + 25); await page.mouse.down();
    await page.mouse.move(box.x + 40, box.y + 105, { steps: 5 }); await page.mouse.up();
    await page.clock.runFor(900); await expect(toast).toHaveCount(0);
    await expect(editor).toHaveText('Synthetic swipe draft'); await expect(indicator).toBeVisible();

    await fresh('Synthetic themed draft');
    for (const theme of ['Light', 'Dark', 'System']) {
        if (theme === 'System') await page.emulateMedia({ colorScheme: 'dark' });
        await page.getByRole('button', { name: 'Change theme', exact: true }).click();
        await page.getByRole('menuitemradio', { name: theme, exact: true }).click();
        await page.clock.runFor(60); await noObstruction(page);
        assert.equal(await toast.locator('.swipe-toast__card').evaluate(node => getComputedStyle(node).fontFamily), await editor.evaluate(node => getComputedStyle(node).fontFamily));
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(() => toast.locator('.swipe-toast__card').evaluate(node => getComputedStyle(node).transform)).toBe('none');
    await page.emulateMedia({ forcedColors: 'active' });
    assert.notEqual(await toast.locator('.swipe-toast__card').evaluate(node => getComputedStyle(node).borderTopStyle), 'none');
    await page.emulateMedia({ forcedColors: 'none' });
    for (const width of [740, 390, 1920]) {
        await page.setViewportSize({ width, height: width === 1920 ? 1000 : 844 });
        await editor.scrollIntoViewIfNeeded(); await page.clock.runFor(100); await noObstruction(page);
    }
    await page.screenshot({ path: join(tmpdir(), 'thesishs-p2c4a-toast.png'), fullPage: false });
    await page.getByRole('button', { name: 'Review & Confirm Decision', exact: true }).click();
    await page.clock.runFor(80); await noObstruction(page);
    await page.getByRole('button', { name: 'Back to Edit', exact: true }).click();
    await expect(editor).toHaveText('Synthetic themed draft');
    // Unmount clears the visible toast, pending animations and dirty guards.
    await page.evaluate(() => window.render(2));
    await page.clock.runFor(10_000); await expect(toast).toHaveCount(0);
    await page.evaluate(() => window.render(1));
    await expect(editor).toHaveText(''); await expect(indicator).toBeHidden();
    await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'light' });
    await page.getByRole('button', { name: 'Change theme', exact: true }).click();
    await page.getByRole('menuitemradio', { name: 'System', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__feedbackCalls.length), 0);
    console.log('PASS clean/dirty single toast, 7000ms non-resetting deadline, dismissal/swipe/focus, persistent status, retained draft/guards/Back to Edit, themes/reduced motion/forced colors, safe responsive placement and disposal');
}

async function touch(page, context) {
    const editor = page.getByRole('textbox', { name: 'Feedback Comments', exact: true });
    await editor.fill(''); await editor.fill('Synthetic touch toast');
    const card = page.locator('.swipe-toast__card');
    await expect(card).toBeVisible(); await card.scrollIntoViewIfNeeded();
    await noObstruction(page);
    const box = await card.boundingBox(), client = await context.newCDPSession(page);
    const x = box.x + 35, y = box.y + 25;
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (const dy of [10, 30, 60, 90]) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + dy }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('.swipe-toast')).toHaveCount(0);
    await expect(editor).toHaveText('Synthetic touch toast');
    await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible();
    await client.detach();
}
module.exports = { desktop, touch };
