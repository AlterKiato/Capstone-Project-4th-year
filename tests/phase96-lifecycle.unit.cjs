/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { runBrowserAcceptance, within, tree, forceCaptured, stopServer } = require('./helpers/phase96-lifecycle.cjs');

async function scenario({ assertion = false, browserFailure = false, browserProcessFailure = false, clientFailure = false, serverFailure = false, timeout = false } = {}) {
    const calls = [], reports = [], timerRecords = [];
    const previousCode = process.exitCode; process.exitCode = 0;
    let nonce;
    const child = Object.assign(new EventEmitter(), { pid: 123456, exitCode: null, signalCode: null, connected: true });
    const server = { close: async () => { calls.push('browser-process'); if (browserProcessFailure) throw Error('browser process failure'); }, kill: async () => { calls.push('browser-kill'); }, wsEndpoint: () => 'synthetic' };
    const browser = { close: async () => { calls.push('browser'); if (browserFailure) throw Error('browser failure'); } };
    const chromium = { launchServer: async () => server, connect: async () => browser };
    const client = { end: async options => { assert.equal(options.timeout, 5); calls.push('database'); if (clientFailure) throw Error('database failure'); } };
    await runBrowserAcceptance(async api => {
        await api.startServer(3020); await api.launchBrowser(chromium);
        if (assertion) assert.fail('original assertion');
        if (timeout) await new Promise(resolve => api.signal.addEventListener('abort', () => { calls.push('cancelled'); resolve(); }, { once: true }));
    }, { client, label: 'synthetic', timeoutMs: 200, deps: {
        fork: (_file, args) => { nonce = args[1]; return child; },
        inspect: () => [{ ProcessId: child.pid, ParentProcessId: process.pid, Born: 'owned', CommandLine: nonce }],
        fetch: async () => ({ ok: true }),
        stopServer: async record => { assert.equal(record.child, child); calls.push('server'); if (serverFailure) throw Error('server failure'); },
        report: (label, error) => reports.push(label + ': ' + error.message),
        exit: () => assert.fail('Watchdog must not execute in a completed synthetic run'),
        timers: { setTimeout: (callback, ms) => { const timer = setTimeout(callback, timeout && ms === 200 ? 5 : ms); timerRecords.push({ timer, ms }); return timer; }, clearTimeout: timer => { timerRecords.find(record => record.timer === timer).cleared = true; clearTimeout(timer); } },
    } });
    const code = process.exitCode; process.exitCode = previousCode;
    assert.deepEqual(calls.filter(x => x !== 'cancelled' && x !== 'browser-kill'), ['browser', 'browser-process', 'database', 'server']);
    assert.ok(timerRecords.every(({ timer, cleared }) => cleared || !timer.hasRef()), 'Timers must be cleared or unreferenced');
    return { calls, reports, code };
}

async function main() {
    assert.equal((await scenario()).code, 0);
    assert.ok((await scenario({ browserProcessFailure: true })).calls.includes('browser-kill'));
    const failed = await scenario({ assertion: true });
    assert.equal(failed.code, 1); assert.match(failed.reports[0], /original assertion/);
    for (const options of [{ browserFailure: true }, { clientFailure: true }, { serverFailure: true }]) assert.equal((await scenario(options)).code, 1);
    const combined = await scenario({ assertion: true, browserFailure: true, clientFailure: true, serverFailure: true });
    assert.match(combined.reports[0], /original assertion/);
    assert.ok(combined.reports.slice(1).every(message => message.startsWith('ADDITIONAL')));
    const timed = await scenario({ timeout: true });
    assert.equal(timed.code, 1); assert.ok(timed.calls.includes('cancelled')); assert.match(timed.reports[0], /workload deadline/);

    const owned = { ProcessId: 900001, ParentProcessId: process.pid, Born: 'original' };
    const descendant = { ProcessId: 900002, ParentProcessId: owned.ProcessId, Born: 'child' };
    const unrelated = { ProcessId: 13364, ParentProcessId: 4900, Born: 'pre-existing' };
    assert.deepEqual(tree([owned, descendant, unrelated], owned.ProcessId), [owned, descendant]);
    const forced = [];
    forceCaptured([owned, descendant], () => [owned, { ...descendant, Born: 'reused-pid' }, unrelated], pid => forced.push(pid));
    assert.deepEqual(forced, [owned.ProcessId], 'Never terminate a reused PID or the pre-existing server');

    let table = [owned, descendant, unrelated], exit;
    const child = { pid: owned.ProcessId, exitCode: null, signalCode: null, connected: true,
        send: message => assert.equal(message.nonce, 'owned-nonce'), disconnect() { this.connected = false; } };
    const record = { child, root: owned, captured: [owned, descendant], nonce: 'owned-nonce', exited: new Promise(resolve => { exit = resolve; }) };
    await stopServer(record, { inspect: () => table, within: (operation, ms, label) => within(operation, Math.min(ms, 5), label), force: captured => {
        assert.deepEqual(captured, [owned, descendant]); table = [unrelated]; child.exitCode = 1; exit();
    } });
    assert.deepEqual(table, [unrelated]); assert.equal(child.connected, false);
    await assert.rejects(within(() => new Promise(() => {}), 5, 'Synthetic stalled close'), /timed out/);
    console.log('PASS Phase 9.6 lifecycle: success/assertion/combined/cleanup-only failures, independent browser/client/server cleanup, timeout cancellation, timers, stalled owned child, PID reuse and pre-existing server protection. No DB/browser/OS process mutations.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
