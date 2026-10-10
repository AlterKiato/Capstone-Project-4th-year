/* eslint-disable @typescript-eslint/no-require-imports */
// node --conditions=react-server --import tsx scripts/groq-synthetic-pilot.cjs admin-overview-v1
// No secrets, identities, models, URLs or payloads accepted as arguments; no dotenv import.
async function main() {
    const args = process.argv.slice(2);
    if (args.length !== 1 || !['admin-overview-v1','adviser-workflow-overview-v1'].includes(args[0])) {
        console.log('Static fallback: invalid fixed pilot topic.'); return;
    }
    if (!process.execArgv.includes('--conditions=react-server')) {
        console.log('Static fallback: server-only Node conditions required.'); return;
    }
    // Next bundles this marker without installing a bare server-only package.
    // Resolve that same react-server marker only inside this native CLI process.
    const Module = require('node:module');
    const resolve = Module._resolveFilename;
    const marker = require.resolve('next/dist/compiled/server-only/empty.js');
    Module._resolveFilename = function(id,...args) { return id === 'server-only' ? marker : resolve.call(this,id,...args); };
    try {
    const { getLocalGroqPilotAvailability } = require('../lib/ai/groq-provider.ts');
    if (!getLocalGroqPilotAvailability().enabled) {
        console.log('Static fallback: local Groq pilot is disabled.'); return;
    }
    if (process.env.NODE_ENV !== 'development') {
        console.log('Static fallback: development-only pilot.'); return;
    }
    const target = new URL(process.env.DATABASE_URL || '');
    if (!['postgres:','postgresql:'].includes(target.protocol) || target.hostname !== 'localhost' ||
        (target.port || '5432') !== '5432' || target.pathname !== '/thesishs_ai') {
        console.log('Static fallback: local development database required.'); return;
    }
    const { runSyntheticGroqPilot } = require('../lib/services/groq-synthetic-pilot.service.ts');
    try {
        const result = await runSyntheticGroqPilot({topicId:args[0]});
        // Never dump configuration/entitlement/provider content to logs.
        console.log(result.mode === 'generated' ? 'Synthetic interpretation validated; supervised review required.' : 'Static fallback: pilot unavailable.');
    } finally { await require('../lib/db.ts').db.$client.end({timeout:5}); }
    } finally { Module._resolveFilename = resolve; }
}
main().catch(() => { console.log('Static fallback: pilot unavailable.'); process.exitCode=1; });
