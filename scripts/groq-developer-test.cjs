/* eslint-disable @typescript-eslint/no-require-imports */
// Native terminal only. Nothing in app/ imports this script; no listener or dotenv.
const { performance } = require('node:perf_hooks');

function localTerminalAllowed(env, terminal) {
    return env.THESISHS_DEVELOPER_GROQ_TEST === '1' && env.NODE_ENV === 'development' &&
        !['CI', 'VERCEL', 'VERCEL_ENV', 'VERCEL_TARGET_ENV', 'VERCEL_PROJECT_ID', 'VERCEL_DEPLOYMENT_ID',
            'NEXT_RUNTIME', 'SSH_CONNECTION', 'SSH_CLIENT', 'SSH_TTY'].some(name => !!env[name]) &&
        terminal.input === true && terminal.output === true;
}

function loadAdapters() {
    // Reuse the existing synthetic CLI's native server-only marker resolution.
    const Module = require('node:module'), resolve = Module._resolveFilename;
    const marker = require.resolve('next/dist/compiled/server-only/empty.js');
    Module._resolveFilename = function(id, ...args) {
        return id === 'server-only' ? marker : resolve.call(this, id, ...args);
    };
    try {
        return {
            rest: require('../lib/ai/groq-rest.ts'),
            research: require('../lib/ai/groq-research-pilot.ts'),
            fixtures: require('../lib/ai/pilot-fixtures.ts'),
            questions: require('../lib/ai/adviser-research-demo.ts'),
        };
    } finally { Module._resolveFilename = resolve; }
}

// One instance for the entire interactive process. Dependencies are injected for offline tests.
function createSession({ adapters, transport, readKey, allowed, now = () => performance.now() }) {
    let attempts = 0, busy = false, last = -Infinity;
    const status = () => ({ remaining: 2 - attempts, busy,
        waitSeconds: Math.max(0, Math.ceil((120000 - (now() - last)) / 1000)) });
    return { status, async generate(selection) {
        const unavailable = message => ({ mode: 'unavailable', message });
        if (!allowed()) return unavailable('Local developer terminal is not enabled.');
        // Exact selectors only: no arbitrary prompts, payloads, models or fixture overrides.
        if (!['adviser-primary', 'adviser-explain-improvement', 'adviser-verify-next', 'admin'].includes(selection))
            return unavailable('Choose a predefined test only.');
        if (busy || attempts >= 2 || now() - last < 120000)
            return unavailable('Budget, cooldown or concurrency limit reached.');
        const config = adapters.rest.configurationSchema.safeParse({ token: readKey() });
        if (!config.success) return unavailable('Private GROQ_API_KEY is missing or invalid; no attempt made.');
        const input = selection === 'admin' ? adapters.fixtures.getSyntheticPilotPayload('admin-overview-v1') : {
            // Synthetic adapter-contract ID; no submission or account is retrieved.
            submissionId: 1, fixtureId: 'bundled-fictional-v1', task: 'writing',
            questionId: selection.slice('adviser-'.length),
        };
        if (!input) return unavailable('Synthetic fixture unavailable; no attempt made.');
        // Reserve synchronously before awaiting. Failures are never refunded or retried.
        attempts++; busy = true; last = now();
        let dispatched = false;
        const singleDispatch = async (url, init) => {
            if (dispatched || !allowed() || url !== adapters.rest.GROQ_ENDPOINT || init.method !== 'POST')
                throw new Error('Dispatch denied');
            const body = JSON.parse(init.body);
            if (body.model !== adapters.rest.GROQ_MODEL) throw new Error('Model denied');
            dispatched = true;
            return transport(url, init);
        };
        try {
            const result = selection === 'admin'
                ? await adapters.rest.createGroqRESTTransport(singleDispatch)(input, config.data)
                : await adapters.research.createGroqResearchPilotTransport(singleDispatch)(input, config.data);
            // Also protect the terminal against a provider reflecting the private credential.
            if (JSON.stringify(result).includes(config.data.token)) return unavailable('Response withheld by local safety check.');
            return result;
        } catch { return unavailable('Provider or validation failure; no retry.'); }
        finally { busy = false; }
    } };
}

function terminalText(value) {
    // Never interpret model-supplied terminal escape/control sequences.
    return String(value).replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, '');
}
function present(result, write) {
    if (result.mode !== 'generated') {
        write('Unavailable: provider, validation or local preflight did not complete. No generated answer is shown.');
        if (result.mode === 'unavailable' && result.message) write(terminalText(result.message));
        return;
    }
    write('ACTUAL GROQ OUTPUT — SYNTHETIC DATA — HUMAN REVIEW REQUIRED');
    if (result.answer) {
        for (const key of ['observation', 'explanation', 'suggestion', 'limitation'])
            write(`${key}: ${terminalText(result.answer[key])}`);
    } else {
        write(terminalText(result.output.overview));
        for (const item of result.output.explanations)
            write(`${terminalText(item.metricId)} (${terminalText(item.band)}): ${terminalText(item.text)}`);
        write('Canonical bands are application-owned. Withheld metrics cannot be inferred.');
    }
}

async function main() {
    const allowed = () => localTerminalAllowed(process.env, {
        input: process.stdin.isTTY, output: process.stdout.isTTY,
    });
    if (process.argv.length !== 2 || !process.execArgv.includes('--conditions=react-server') || !allowed()) {
        console.log('Denied: explicitly enabled local interactive development terminal required.');
        process.exitCode = 1; return;
    }
    const adapters = loadAdapters();
    // Read only the inherited private credential, never files, records or sessions.
    if (!adapters.rest.configurationSchema.safeParse({ token: process.env.GROQ_API_KEY }).success) {
        console.log('Private GROQ_API_KEY unavailable. No request made.'); process.exitCode = 1; return;
    }
    const session = createSession({ adapters, transport: fetch, readKey: () => process.env.GROQ_API_KEY, allowed });
    const { createInterface } = require('node:readline/promises');
    const rl = createInterface({ input: process.stdin, output: process.stdout, historySize: 0 });
    const write = text => console.log(text);
    write('DEVELOPER TEST — SYNTHETIC DATA');
    write('No dashboard activation. No database access. No transcript files. Restarting resets this two-attempt budget.');
    try {
        while (session.status().remaining > 0) {
            const budget = session.status();
            write(`Remaining: ${budget.remaining}/2; cooldown: ${budget.waitSeconds}s.`);
            const feature = await rl.question('1 Adviser / 2 Admin / 0 Exit: ');
            if (feature === '0') break;
            let selection;
            if (feature === '1') {
                write(adapters.questions.RESEARCH_DEMO_EXCERPT);
                write(`1 ${adapters.questions.RESEARCH_DEMO_QUESTIONS.writing}`);
                write(`2 ${adapters.questions.RESEARCH_DEMO_FOLLOWUPS[0]}`);
                write(`3 ${adapters.questions.RESEARCH_DEMO_FOLLOWUPS[1]}`);
                const question = await rl.question('Choose 1, 2 or 3: ');
                selection = { '1': 'adviser-primary', '2': 'adviser-explain-improvement', '3': 'adviser-verify-next' }[question];
            } else if (feature === '2') {
                selection = 'admin';
                write('Fixed synthetic bands:');
                for (const [metric, band] of Object.entries(adapters.fixtures.getSyntheticPilotPayload('admin-overview-v1').metrics))
                    write(`${metric}: ${band}`);
            }
            if (!selection) { write('Invalid selection; no request.'); continue; }
            if (await rl.question('Type g to Generate one real Groq request, or Enter to cancel: ') !== 'g') continue;
            write('Generating…');
            present(await session.generate(selection), write);
        }
        write(`Stopped. Remaining: ${session.status().remaining}/2. No automatic retries.`);
    } finally { rl.close(); }
}

module.exports = { localTerminalAllowed, loadAdapters, createSession, present, terminalText };
if (require.main === module) main().catch(() => {
    console.log('Developer test stopped safely; no automatic retry.'); process.exitCode = 1;
});
