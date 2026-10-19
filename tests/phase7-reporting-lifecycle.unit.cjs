/* eslint-disable @typescript-eslint/no-require-imports */
// Executes the actual runner in isolated contexts with synthetic reads/timers.
// No live database, network, child process, or production-module imports.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('./phase7-reporting.acceptance.cjs'), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));
const error = name => Object.assign(new Error(name), { name });

async function scenario({ workloadFailure = false, pendingQuery = false, http = false } = {}) {
    const timers = new Set(), errors = [], exits = [], shutdown = [], requests = [];
    const process = { env: { DATABASE_URL: 'postgres://localhost:5432/thesishs_ai', ...(http ? { PHASE7_BASE_URL: 'http://127.0.0.1:3000' } : {}) }, exit: code => exits.push(code) };
    const fakeModule = { _load: id => { throw new Error('Unexpected module: ' + id); } };
    let finishShutdown, failShutdown, failQuery;
    const db = {
        execute: async query => {
            if (workloadFailure) throw error('SyntheticWorkloadFailure');
            if (pendingQuery) return new Promise((_, reject) => { failQuery = reject; });
            if (query.includes('SELECT id, role_id')) return [1, 2, 3, 4].map(id => ({ id, role_id: id }));
            if (query.includes('AS users')) return [{ users: 4, groups: 1, papers: 1, published: 1 }];
            if (query.includes('GROUP BY role_id')) return [1, 2, 3, 4].map(role_id => ({ role_id, total: 1 }));
            if (query.includes('GROUP BY status')) return [{ status: 'Approved', total: 1 }];
            if (query.includes('FROM activity_logs')) return [];
            throw new Error('Unexpected synthetic query');
        },
        $client: { end: options => {
            shutdown.push(options);
            return new Promise((resolve, reject) => { finishShutdown = resolve; failShutdown = reject; });
        } },
    };
    const isAdmin = async () => (await fakeModule._load('@/lib/auth/session').getSession())?.userId === 1;
    const stats = {
        totalUsers: 4, totalGroups: 1, totalResearchPapers: 1, totalPublishedPapers: 1,
        usersByRole: ['Admin', 'Adviser', 'Student', 'Panel'].map(role => ({ role, count: 1 })),
        papersByStatus: ['Draft', 'In Review', 'Revision Required', 'Approved'].map(status => ({ status, count: status === 'Approved' ? 1 : 0 })),
    };
    const mocks = {
        'node:assert/strict': assert, 'node:module': fakeModule, 'dotenv/config': {}, '../lib/db.ts': { db },
        'drizzle-orm': { sql: strings => strings.join('') },
        '../lib/services/dashboard.service.ts': {
            getAdminDashboardStats: async () => await isAdmin() ? { success: true, data: stats } : { success: false },
            getAdminRecentActivities: async () => await isAdmin() ? { success: true, data: [] } : { success: false },
        },
        '../lib/auth/jwt.ts': { createToken: async () => 'synthetic' },
    };
    vm.runInNewContext(source, {
        require: id => { assert.ok(Object.hasOwn(mocks, id), 'Only synthetic dependencies may load'); return mocks[id]; },
        process, URL, AbortController,
        console: { log() {}, error: text => errors.push(text) },
        setTimeout: (callback, ms) => {
            const timer = { callback, ms, referenced: true, unref() { this.referenced = false; } };
            timers.add(timer); return timer;
        },
        clearTimeout: timer => timers.delete(timer),
        fetch: async (url, options) => {
            assert.equal(url.hostname, '127.0.0.1'); requests.push(options.signal);
            return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true }));
        },
    }, { filename: 'phase7-reporting.acceptance.cjs' });
    await flush();
    return {
        process, errors, exits, shutdown, requests, timers,
        complete: async failure => { if (failure) failShutdown(failure); else finishShutdown(); await flush(); },
        expire: async ms => { const timer = [...timers].find(t => t.ms === ms); assert.ok(timer); timers.delete(timer); timer.callback(); await flush(); },
        rejectPendingQuery: () => failQuery(error('SyntheticConnectionDestroyed')),
    };
}

async function main() {
    const success = await scenario();
    assert.equal(success.shutdown.length, 1); assert.equal(success.shutdown[0].timeout, 5);
    assert.equal([...success.timers][0].referenced, true, 'Cleanup must be awaited even without other handles');
    await success.complete();
    assert.equal(success.process.exitCode, undefined); assert.deepEqual(success.exits, []);
    assert.ok([...success.timers].every(timer => !timer.referenced), 'Completed runner must not retain a referenced timer');
    assert.deepEqual(success.errors, []);

    const bothFail = await scenario({ workloadFailure: true });
    await bothFail.complete(error('SyntheticCleanupFailure'));
    assert.equal(bothFail.process.exitCode, 1); assert.equal(bothFail.shutdown.length, 1);
    assert.equal(bothFail.errors[0], 'FAIL Phase 7 acceptance: SyntheticWorkloadFailure');
    assert.ok(bothFail.errors.includes('ADDITIONAL Phase 7 cleanup failure: SyntheticCleanupFailure'));
    assert.deepEqual(bothFail.exits, []);

    const cleanupOnly = await scenario();
    await cleanupOnly.complete(error('SyntheticCleanupFailure'));
    assert.equal(cleanupOnly.process.exitCode, 1);
    assert.equal(cleanupOnly.errors[0], 'FAIL Phase 7 cleanup: SyntheticCleanupFailure');

    const timeout = await scenario({ pendingQuery: true });
    assert.equal(timeout.shutdown.length, 0);
    await timeout.expire(30_000);
    assert.equal(timeout.process.exitCode, 1); assert.equal(timeout.shutdown.length, 1);
    assert.equal(timeout.errors[0], 'FAIL Phase 7 acceptance: ReportingAcceptanceTimeout');
    timeout.rejectPendingQuery(); await timeout.complete();
    assert.deepEqual(timeout.exits, []);
    assert.ok(timeout.errors.every(line => !line.includes('SyntheticConnectionDestroyed')), 'Shutdown rejection must not replace timeout');

    const http = await scenario({ http: true });
    assert.equal(http.requests.length, 1);
    await http.expire(30_000);
    assert.equal(http.requests[0].aborted, true); assert.equal(http.shutdown.length, 1);
    assert.equal(http.errors[0], 'FAIL Phase 7 acceptance: ReportingAcceptanceTimeout');
    await http.complete();

    const stalledCleanup = await scenario({ workloadFailure: true });
    await stalledCleanup.expire(6_000);
    assert.deepEqual(stalledCleanup.exits, [1]);
    assert.equal(stalledCleanup.errors[0], 'FAIL Phase 7 acceptance: SyntheticWorkloadFailure');

    await success.expire(6_000);
    assert.deepEqual(success.exits, [1], 'An unexpectedly retained handle remains bounded after shutdown');
    console.log('PASS actual runner: all synthetic reporting assertions, awaited shutdown, original/secondary errors, query and HTTP deadlines, cleared workload timer, unreferenced exit watchdog and emergency termination. No DB/network.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
