/* eslint-disable @typescript-eslint/no-require-imports */
// Mock-facing interfaces ONLY. No fs, process, DPAPI or native adapter defaults.
const { createHmac, timingSafeEqual } = require('node:crypto');
const path = require('node:path').win32;
const { z } = require('zod');
const { canonical, PREVIEW_RUN, pdfBytes, sha256 } = require('./fixture-core.cjs');
const deny = code => { throw new Error(code); };
const runSchema = z.string().regex(/^phase96-[a-f0-9]{32}$/).refine(x => x !== PREVIEW_RUN);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const step = z.string().regex(/^(credentials|admin|adviser|student|group|activity|membership|paper|pdf1|pdf2|notification-[1-9]\d*)$/);
const ids = z.partialRecord(z.enum(['adminId', 'adviserId', 'studentId', 'groupId', 'paperId']), z.number().int().positive().max(2147483647));
const resource = z.strictObject({ kind: z.enum(['protected_state', 'users', 'research_groups', 'group_members', 'research_papers', 'activity_logs', 'notifications', 'pdf']),
    id: z.number().int().positive().max(2147483647).optional(), parents: ids,
    version: z.enum(['v1', 'v2']).optional(), checksum: hash.optional(), bytes: z.number().int().positive().max(16384).optional() });
const recordSchema = z.strictObject({ seq: z.number().int().positive(), runId: runSchema, targetDigest: hash,
    step, attemptId: z.string().regex(/^phase96-[a-f0-9]{32}:[a-z0-9-]+:1$/), payloadDigest: hash, parents: ids,
    state: z.enum(['planned', 'started', 'returned', 'verified', 'failed', 'uncertain']),
    resources: z.array(resource).max(4), candidateResources: z.array(resource).max(1).optional(), evidence: hash.optional(),
    error: z.enum(['PREWRITE_REJECTED', 'OPERATION_UNCERTAIN', 'COMMIT_UNCERTAIN', 'VERIFICATION_FAILED', 'SECONDARY_FAILED']).optional(),
    at: z.iso.datetime() });
const envelopeSchema = z.strictObject({ record: recordSchema, previousMac: hash, mac: hash });
const transitions = { planned: ['started'], started: ['returned', 'failed', 'uncertain'], returned: ['verified', 'uncertain'] };
const zero = '0'.repeat(64);

function createJournal({ io, key, runId, targetDigest, clock, mode = 'new' }) {
    if (io?.kind !== 'phase96-memory' || !Buffer.isBuffer(key) || key.length !== 32 || !runSchema.safeParse(runId).success ||
        !hash.safeParse(targetDigest).success || !['new', 'inspect-resume'].includes(mode) || typeof clock !== 'function') deny('PRIVATE_ADAPTER_UNAVAILABLE');
    const lock = io.acquireExclusive(`${targetDigest}/${runId}`);
    let entries = [], previousMac = zero, poisoned = false, closed = false;
    const states = new Map(), owned = new Map();
    const macFor = (record, prev) => createHmac('sha256', key).update(canonical({ record, previousMac: prev })).digest('hex');
    function accept(record) {
        if (record.runId !== runId || record.targetDigest !== targetDigest || record.seq !== entries.length + 1 ||
            record.attemptId !== `${runId}:${record.step}:1`) deny('JOURNAL_OWNERSHIP_MISMATCH');
        const prior = states.get(record.step);
        const contract = {
            credentials: ['protected_state', []],
            admin: ['users', []], adviser: ['users', ['adminId']], student: ['users', []],
            group: ['research_groups', ['adviserId']], activity: ['activity_logs', ['adviserId', 'groupId']],
            membership: ['group_members', ['groupId', 'studentId']], paper: ['research_papers', ['groupId']],
            pdf1: ['pdf', []], pdf2: ['pdf', []],
        }[record.step] || ['notifications', ['adminId', 'adviserId', 'groupId']];
        if (canonical(Object.keys(record.parents).sort()) !== canonical([...contract[1]].sort())) deny('JOURNAL_OWNERSHIP_MISMATCH');
        for (const [field, slot] of [['adminId', 'admin'], ['adviserId', 'adviser'], ['studentId', 'student'], ['groupId', 'group']]) {
            if (record.parents[field] !== undefined && !(field === 'adminId' && record.step.startsWith('notification-'))) {
                const parent = states.get(slot);
                if (parent?.state !== 'verified' || parent.resources[0]?.id !== record.parents[field]) deny('UNVERIFIED_PARENT');
            }
        }
        if (record.step.startsWith('notification-') && record.step !== `notification-${record.parents.adminId}`) deny('JOURNAL_OWNERSHIP_MISMATCH');
        if ((!prior && record.state !== 'planned') || (prior && !transitions[prior.state]?.includes(record.state))) deny('INVALID_JOURNAL_TRANSITION');
        if (prior && (prior.payloadDigest !== record.payloadDigest || canonical(prior.parents) !== canonical(record.parents) ||
            Date.parse(record.at) < Date.parse(prior.at))) deny('JOURNAL_OWNERSHIP_MISMATCH');
        if (['planned', 'started', 'failed'].includes(record.state) && record.resources.length) deny('FALSE_CREATION_CLAIM');
        if (record.state === 'returned' && record.resources.length !== 1) deny('MISSING_CREATION_RECEIPT');
        if (record.state === 'verified' && (!record.evidence || canonical(record.resources) !== canonical(prior.resources))) deny('UNVERIFIED_RECEIPT');
        if (record.candidateResources && (record.state !== 'uncertain' || prior?.state !== 'started' || record.step !== 'admin' ||
            record.candidateResources.some(r => r.kind !== 'users' || !r.id || canonical(r.parents) !== '{}'))) deny('INVALID_COMMIT_CANDIDATE');
        const newIdentities = [];
        for (const r of record.resources) {
            if (r.kind !== contract[0]) deny('INVALID_RESOURCE_RECEIPT');
            if (r.kind === 'pdf' ? r.id !== undefined || !r.version || !r.checksum || !r.bytes : r.kind === 'protected_state'
                ? r.id !== undefined || r.version !== undefined || !r.checksum || !r.bytes : !r.id || r.version || r.checksum || r.bytes)
                deny('INVALID_RESOURCE_RECEIPT');
            if (canonical(r.parents) !== canonical(record.parents)) deny('JOURNAL_OWNERSHIP_MISMATCH');
            if (r.kind === 'pdf') {
                const version = record.step === 'pdf1' ? 'v1' : 'v2', bytes = pdfBytes(version);
                if (r.version !== version || r.checksum !== sha256(bytes) || r.bytes !== bytes.length) deny('INVALID_PDF_RECEIPT');
            }
            const identity = r.kind + ':' + (r.id ?? record.step);
            if (owned.has(identity) && owned.get(identity) !== record.step) deny('DUPLICATE_RESOURCE_RECEIPT');
            newIdentities.push(identity);
        }
        newIdentities.forEach(identity => owned.set(identity, record.step));
        states.set(record.step, record); entries.push(record);
    }
    try {
        const contents = io.readJournal(), cursor = io.readProtectedCursor();
        if (contents && !contents.endsWith('\n')) deny('TRUNCATED_JOURNAL');
        for (const line of contents ? contents.slice(0, -1).split('\n') : []) {
            let parsed; try { parsed = envelopeSchema.parse(JSON.parse(line)); } catch { deny('CORRUPT_JOURNAL'); }
            const expected = macFor(parsed.record, previousMac);
            if (parsed.previousMac !== previousMac || !timingSafeEqual(Buffer.from(parsed.mac, 'hex'), Buffer.from(expected, 'hex'))) deny('JOURNAL_AUTHENTICATION_FAILED');
            accept(parsed.record); previousMac = parsed.mac;
        }
        if (cursor.seq !== entries.length || cursor.mac !== previousMac) deny('JOURNAL_CURSOR_MISMATCH');
        if (mode === 'new' && entries.length) deny('PRIOR_RUN_EXISTS');
    } catch (error) { io.releaseExclusive(lock); throw error; }
    return {
        binding: Object.freeze({ runId, targetDigest, mode, keyDigest: sha256(key) }),
        append(input) {
            if (poisoned || closed || mode !== 'new') deny('JOURNAL_NOT_WRITABLE');
            if (['seq', 'runId', 'targetDigest', 'at'].some(field => Object.hasOwn(input, field))) deny('INVALID_JOURNAL_RECORD');
            const parsed = recordSchema.safeParse({ ...input, seq: entries.length + 1, runId, targetDigest, at: clock() });
            if (!parsed.success) deny('INVALID_JOURNAL_RECORD');
            const record = parsed.data, mac = macFor(record, previousMac);
            // Validate in memory first. A flush/cursor failure poisons this instance;
            // there is no claim of atomicity across the journal and protected cursor.
            accept(record);
            try {
                const flushed = io.appendAndFlush(canonical({ record, previousMac, mac }) + '\n');
                if (flushed && typeof flushed.then === 'function') deny('ASYNC_IO_UNSUPPORTED');
                const sealed = io.sealCursor({ seq: entries.length, mac });
                if (sealed && typeof sealed.then === 'function') deny('ASYNC_IO_UNSUPPORTED');
                previousMac = mac;
            } catch { poisoned = true; deny('JOURNAL_FLUSH_UNCERTAIN'); }
            return record;
        },
        snapshot: () => structuredClone(entries),
        resumeStatus() {
            return { readOnly: true, requiresIndependentVerification: true,
                uncertain: entries.some(r => ['started', 'returned', 'uncertain'].includes(states.get(r.step)?.state)),
                steps: [...states.values()].map(r => ({ step: r.step, state: r.state, resources: structuredClone(r.resources),
                    candidateResources: structuredClone(r.candidateResources || []) })) };
        },
        close() { if (!closed) { closed = true; io.releaseExclusive(lock); } },
    };
}

function privateDirectory({ localAppData, workspace, targetDigest, runId, sid, security }) {
    if (!runSchema.safeParse(runId).success || !hash.safeParse(targetDigest).success || !/^S-1-5-21-\d+-\d+-\d+-\d+$/.test(sid)) deny('INVALID_PRIVATE_LOCATION');
    if (!/^[a-z]:\\/i.test(localAppData) || !/^[a-z]:\\/i.test(workspace)) deny('INVALID_PRIVATE_LOCATION');
    const root = path.resolve(localAppData, 'ThesiSHS-Acceptance', 'phase96', targetDigest, runId);
    const repo = path.resolve(workspace).toLowerCase(), lower = root.toLowerCase();
    if (lower === repo || lower.startsWith(repo + '\\') || security?.ownerSid !== sid || security.inherited !== false ||
        security.reparse !== false || !Array.isArray(security.ancestors) || !security.ancestors.length ||
        security.ancestors.some(a => a.reparse !== false) || !Array.isArray(security.grants) ||
        !security.grants.includes(sid) || security.grants.some(s => ![sid, 'S-1-5-18'].includes(s))) deny('INSECURE_PRIVATE_LOCATION');
    return root;
}
const credentialsSchema = z.strictObject({ runId: runSchema, targetDigest: hash,
    journalKey: z.string().regex(/^[a-f0-9]{64}$/),
    accounts: z.strictObject(Object.fromEntries(['admin', 'adviser', 'student'].map(role => [role,
        z.strictObject({ email: z.email(), password: z.string().min(32).max(64) })]))) });

function createProtectedState({ io, protector, location }) {
    if (io?.kind !== 'phase96-memory' || protector?.kind !== 'phase96-memory' || protector.scope !== 'CurrentUser') deny('NATIVE_PROTECTION_UNAVAILABLE');
    const directory = privateDirectory(location);
    return {
        kind: 'phase96-memory',
        async save(input) {
            const parsed = credentialsSchema.safeParse(input);
            if (!parsed.success || input.runId !== location.runId || input.targetDigest !== location.targetDigest) deny('INVALID_PROTECTED_STATE');
            const plaintext = Buffer.from(canonical(parsed.data));
            try {
                const ciphertext = await protector.protect(plaintext);
                if (!Buffer.isBuffer(ciphertext) || [input.journalKey, ...Object.values(input.accounts).map(a => a.password)]
                    .some(secret => ciphertext.includes(Buffer.from(secret)))) deny('PROTECTION_FAILED');
                await io.createProtectedExclusive(directory, ciphertext);
                return { kind: 'protected_state', parents: {}, checksum: sha256(ciphertext), bytes: ciphertext.length };
            } catch { deny('PROTECTION_FAILED'); } finally { plaintext.fill(0); }
        },
        async load() {
            let plaintext;
            try {
                plaintext = await protector.unprotect(await io.readProtected(directory));
                const parsed = credentialsSchema.safeParse(JSON.parse(plaintext.toString('utf8')));
                if (!parsed.success || parsed.data.runId !== location.runId || parsed.data.targetDigest !== location.targetDigest) deny('INVALID_PROTECTED_STATE');
                return parsed.data;
            } catch { deny('PROTECTED_STATE_UNAVAILABLE'); } finally { plaintext?.fill(0); }
        },
    };
}
function nativeProtection() { deny('NATIVE_PROTECTION_UNAVAILABLE'); }
if (require.main === module) { process.stderr.write('PRIVATE_STATE_NOT_EXECUTABLE\n'); process.exitCode = 1; }
module.exports = { createJournal, privateDirectory, createProtectedState, nativeProtection };
