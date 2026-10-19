/* eslint-disable @typescript-eslint/no-require-imports */
const { fork, execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');

function within(operation, ms, label) {
    let timer;
    return Promise.race([Promise.resolve().then(operation), new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(label + ' timed out')), ms);
    })]).finally(() => clearTimeout(timer));
}

function processTable() {
    if (process.platform !== 'win32') throw new Error('Windows ownership inspection required');
    const script = 'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CommandLine,@{Name="Born";Expression={$_.CreationDate.ToUniversalTime().ToString("o")}} | ConvertTo-Json -Compress';
    return JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', windowsHide: true, timeout: 6000 }));
}

function tree(table, root) {
    const ids = new Set([root]);
    let previous;
    do { previous = ids.size; for (const p of table) if (ids.has(p.ParentProcessId)) ids.add(p.ProcessId); } while (previous !== ids.size);
    return table.filter(p => ids.has(p.ProcessId));
}

// Only a captured descendant with the same PID AND creation time may be forced.
function forceCaptured(captured, inspect = processTable, terminate = pid => {
    execFileSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'pipe', timeout: 3000 });
}) {
    for (const saved of captured) {
        const current = inspect().find(p => p.ProcessId === saved.ProcessId && p.Born === saved.Born);
        if (current && current.ProcessId !== process.pid) terminate(current.ProcessId);
    }
}

async function stopServer(record, deps = {}) {
    const inspect = deps.inspect || processTable;
    const force = deps.force || (captured => forceCaptured(captured));
    const bounded = deps.within || within;
    const current = inspect();
    const root = current.find(p => p.ProcessId === record.root?.ProcessId && p.Born === record.root.Born);
    const captured = root ? tree(current, root.ProcessId) : record.captured;
    record.captured = captured;
    let forced = false;
    if (record.child.exitCode === null && record.child.signalCode === null) {
        if (record.child.connected) record.child.send({ type: 'phase96-shutdown', nonce: record.nonce }, () => {});
        try { await bounded(() => record.exited, 5000, 'Owned server graceful exit'); }
        catch { forced = true; force(captured); await bounded(() => record.exited, 3000, 'Owned server forced exit'); }
    }
    const remaining = inspect().filter(p => captured.some(s => s.ProcessId === p.ProcessId && s.Born === p.Born));
    if (remaining.length) { forced = true; force(remaining); }
    if (inspect().some(p => captured.some(s => s.ProcessId === p.ProcessId && s.Born === p.Born))) throw new Error('Owned server descendant remains');
    if (record.child.connected) record.child.disconnect();
    console.log('OWNED SERVER EXIT pid=' + record.child.pid + '; forced=' + forced + '; descendants checked');
}

async function runBrowserAcceptance(main, { client, label, timeoutMs, deps = {} }) {
    const controller = new AbortController();
    const browsers = [], browserServers = [], servers = [];
    const report = deps.report || ((prefix, error) => console.error(prefix + ': ' + String(error?.stack || error).replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]')));
    const timers = deps.timers || { setTimeout, clearTimeout };
    let deadlineTimer, failed = false;
    const api = {
        signal: controller.signal,
        async startServer(port) {
            controller.signal.throwIfAborted();
            const nonce = randomUUID();
            const child = (deps.fork || fork)(require.resolve('./phase96-server.cjs'), [String(port), nonce], { execArgv: [], windowsHide: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'], env: { ...process.env, NEXT_MANUAL_SIG_HANDLE: '' } });
            const record = { child, nonce, root: null, captured: [], exited: new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal }))) };
            servers.push(record);
            child.once('error', error => { record.error = error; });
            const table = (deps.inspect || processTable)();
            record.root = table.find(p => p.ProcessId === child.pid && p.ParentProcessId === process.pid && p.CommandLine?.includes(nonce));
            record.captured = record.root ? tree(table, child.pid) : [];
            if (!record.root) throw new Error('Spawned server identity could not be verified');
            const origin = 'http://127.0.0.1:' + port;
            for (let attempt = 0; attempt < 60; attempt++) {
                controller.signal.throwIfAborted();
                if (record.error) throw record.error;
                if (child.exitCode !== null) throw new Error('Owned server exited before Ready');
                try { if ((await (deps.fetch || fetch)(origin + '/login', { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(1500)]) })).ok) return child; } catch { controller.signal.throwIfAborted(); }
                await new Promise(resolve => setTimeout(resolve, 250));
            }
            throw new Error('Owned server did not become ready');
        },
        async launchBrowser(chromium) {
            controller.signal.throwIfAborted();
            const server = await chromium.launchServer({ timeout: 15000 });
            browserServers.push(server);
            console.log('OWNED BROWSER START pid=' + (server.process?.()?.pid ?? 'synthetic'));
            if (controller.signal.aborted) { await server.kill(); controller.signal.throwIfAborted(); }
            const browser = await chromium.connect(server.wsEndpoint(), { timeout: 15000 });
            browsers.push(browser);
            if (controller.signal.aborted) { await browser.close(); await server.kill(); controller.signal.throwIfAborted(); }
            return browser;
        },
    };
    const deadline = new Promise((_, reject) => {
        deadlineTimer = timers.setTimeout(() => {
            const error = new Error(label + ' exceeded ' + timeoutMs + 'ms workload deadline');
            controller.abort(error); reject(error);
        }, timeoutMs);
    });
    try { await Promise.race([main(api), deadline]); }
    catch (error) { failed = true; process.exitCode = 1; report('FAIL ' + label, error); }
    finally {
        timers.clearTimeout(deadlineTimer); controller.abort();
        const watchdog = timers.setTimeout(async () => {
            report('FAIL cleanup watchdog', new Error('Owned cleanup did not finish'));
            for (const server of browserServers) { try { await within(() => server.kill(), 2000, 'Browser force'); } catch {} }
            for (const record of servers) { try { forceCaptured(record.captured || []); } catch { /* Reported by watchdog. */ } }
            (deps.exit || process.exit)(1);
        }, 40000);
        const cleanup = async (name, operation, ms = 6500) => {
            try { await within(operation, ms, name); }
            catch (error) { process.exitCode = 1; report(failed ? 'ADDITIONAL ' + name : 'FAIL ' + name, error); failed = true; }
        };
        for (const browser of browsers) await cleanup('browser close', () => browser.close());
        for (const server of browserServers) await cleanup('browser process close', async () => {
            try { await within(() => server.close(), 4000, 'Browser graceful close'); }
            catch { console.log('OWNED BROWSER FORCE'); await within(() => server.kill(), 2000, 'Owned browser kill'); }
            console.log('OWNED BROWSER CLOSED pid=' + (server.process?.()?.pid ?? 'synthetic'));
        });
        if (client) await cleanup('database close', () => client.end({ timeout: 5 }));
        for (const record of servers) await cleanup('owned server close', () => (deps.stopServer || stopServer)(record), 15000);
        watchdog.unref();
        console.log('LIFECYCLE ' + label + ': cleanup attempted; owned server PIDs=' + servers.map(s => s.child.pid).join(',') + '; status=' + (failed ? 'FAIL' : 'PASS'));
    }
}

module.exports = { runBrowserAcceptance, within, tree, forceCaptured, stopServer };
