/* eslint-disable @typescript-eslint/no-require-imports */
// Offline only. No application imports, clients, network, persistence or credentials.
const { createHash } = require('node:crypto');
const { z } = require('zod');
const { isIP } = require('node:net');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const fail = code => { throw new Error(code); };
const RUN = /^phase96-[a-f0-9]{32}$/;
const HASH = /^[a-f0-9]{64}$/;
const BUCKET = 'research-submissions';
const PREVIEW_RUN = 'phase96-00000000000000000000000000000000';
function normalizeLoopback(value) {
    if (typeof value !== 'string' || value.includes('%')) return null;
    let address = value.replace(/^\[|\]$/g, '');
    if (address.endsWith('/128')) address = address.slice(0, -4);
    else if (address.includes('/')) return null;
    if (address === '127.0.0.1' && !value.includes('/')) return '127.0.0.1';
    if (isIP(address) !== 6) return null;
    const canonical = new URL(`http://[${address}]/`).hostname.slice(1, -1);
    return canonical === '::1' ? '::1' : canonical === '::ffff:7f00:1' ? '127.0.0.1' : null;
}
const loopback = value => value === 'localhost' || normalizeLoopback(value) !== null;

function configuration(env) {
    if ((env.NODE_ENV && !['development', 'test'].includes(env.NODE_ENV)) || env.VERCEL_ENV || env.VERCEL || env.CI) fail('LOCAL_DEVELOPMENT_ONLY');
    if (!env.DATABASE_URL || !env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY?.trim()) fail('MISSING_CONFIGURATION');
    let db, storage;
    try { db = new URL(env.DATABASE_URL); storage = new URL(env.SUPABASE_URL); }
    catch { fail('INVALID_CONFIGURATION'); }
    // Refuse URL options that could redirect the actual client away from this host.
    if (!['postgres:', 'postgresql:'].includes(db.protocol) || !loopback(db.hostname) ||
        db.port !== '5432' || db.pathname !== '/thesishs_ai' || db.search || db.hash ||
        !db.username || !db.password || /prod|production|live/i.test(decodeURIComponent(db.username))) fail('DATABASE_TARGET_REJECTED');
    if (storage.protocol !== 'https:' || !/^[a-z0-9]{20}\.supabase\.co$/.test(storage.hostname) ||
        storage.port || !['', '/'].includes(storage.pathname) || storage.username || storage.password ||
        storage.search || storage.hash || /prod|production|live/i.test(storage.hostname)) fail('STORAGE_TARGET_REJECTED');
    // This is a CONFIGURATION fingerprint, never proof of a connected instance.
    const target = { database: 'thesishs_ai', port: 5432, host: db.hostname,
        projectRef: storage.hostname.split('.')[0], bucket: BUCKET };
    return { ...target, storageEndpoint: storage.origin, fingerprint: sha256(JSON.stringify(target)) };
}

// Historical A.2a offline comparison only; NOT admission. New orchestration uses
// validatePinnedTarget below, which additionally requires roles/privileges/budget.
// Expected identity must come from an independently reviewed private target pin,
// not be copied automatically from current configuration/observations.
function validateRuntimeTarget(config, expected, observed, localMigrations) {
    if (!expected || !observed || !HASH.test(expected.schemaHash) ||
        !/^\d{10,30}$/.test(expected.systemIdentifier) || !Number.isInteger(expected.databaseOid) ||
        expected.databaseOid <= 0 || !HASH.test(expected.fingerprint) ||
        !Array.isArray(localMigrations) || localMigrations.length !== 12 ||
        localMigrations.some(x => !HASH.test(x))) fail('TARGET_IDENTITY_UNVERIFIED');
    if (config.fingerprint !== expected.fingerprint || config.projectRef !== expected.projectRef ||
        config.bucket !== BUCKET || expected.bucket !== BUCKET ||
        observed.database !== 'thesishs_ai' || observed.port !== 5432 ||
        !loopback(observed.serverAddress) || observed.serverAddress === 'localhost' ||
        observed.systemIdentifier !== expected.systemIdentifier || observed.databaseOid !== expected.databaseOid ||
        observed.serverVersion !== 180004 || observed.schemaHash !== expected.schemaHash ||
        JSON.stringify(observed.migrations) !== JSON.stringify(localMigrations) ||
        observed.projectRef !== expected.projectRef || observed.bucket !== BUCKET || observed.bucketPublic !== false)
        fail('RUNTIME_TARGET_MISMATCH');
    // Ordinary available slots AFTER reserved slots, observer and existing clients.
    if (!Number.isInteger(observed.availableConnections) || observed.availableConnections < 10)
        fail('INSUFFICIENT_CONNECTION_HEADROOM');
    return true;
}

function storagePath(paperId, version, runId) {
    if (!Number.isInteger(paperId) || paperId <= 0 || paperId > 2147483647 ||
        !['v1', 'v2'].includes(version) || !RUN.test(runId)) fail('INVALID_OWNED_PATH');
    return `research/${paperId}/${version}/${runId}-${version}.pdf`;
}

// Deterministic one-page PDF with real xref byte offsets and stream length.
// Bytes exist only in memory; the CLI reports size/hash and never saves them.
function pdfBytes(version) {
    if (!['v1', 'v2'].includes(version)) fail('INVALID_PDF_VERSION');
    const text = version === 'v1' ? 'SYNTHETIC TEST ONLY - Draft version 1' : 'SYNTHETIC TEST ONLY - Revised version 2';
    const stream = `BT /F1 16 Tf 48 760 Td (${text}) Tj ET\n`;
    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`,
    ];
    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((body, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${body}\nendobj\n`; });
    const xref = Buffer.byteLength(pdf);
    pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => String(n).padStart(10, '0') + ' 00000 n \n').join('')}`;
    pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(pdf, 'ascii');
}

const SLOTS = {
    admin: ['users', []], adviser: ['users', []], student: ['users', []],
    group: ['research_groups', ['adviser']], membership: ['group_members', ['group', 'student']],
    paper: ['research_papers', ['group']], pdf1: ['pdf', []], pdf2: ['pdf', []],
    submission1: ['submissions', ['paper', 'student', 'object1']],
    submission2: ['submissions', ['paper', 'student', 'object2']],
    object1: ['storage', ['paper', 'pdf1']], object2: ['storage', ['paper', 'pdf2']],
};
const hashSchema = z.string().regex(HASH);
const timestamp = z.iso.datetime();
const resourceSchema = z.strictObject({
    slot: z.enum(Object.keys(SLOTS)), ownerRunId: z.string().regex(RUN),
    kind: z.enum([...new Set(Object.values(SLOTS).map(x => x[0]))]),
    parents: z.array(z.enum(Object.keys(SLOTS))),
    state: z.enum(['planned', 'created', 'verified', 'pending-cleanup', 'retained']),
    id: z.number().int().positive().max(2147483647).optional(),
    path: z.string().max(500).optional(), version: z.enum(['v1', 'v2']).optional(),
    checksum: hashSchema.optional(), creationProof: hashSchema.optional(), verificationProof: hashSchema.optional(),
    createdAt: timestamp.optional(), verifiedAt: timestamp.optional(), cleanupEligible: z.boolean(),
});
const manifestSchema = z.strictObject({
    schemaVersion: z.literal(1), runId: z.string().regex(RUN),
    environmentFingerprint: hashSchema, createdAt: timestamp, updatedAt: timestamp,
    resources: z.array(resourceSchema).length(12),
});

// Shape/consistency validation ONLY, not authorization to resume or delete.
function validateManifest(input, runId, fingerprint) {
    const parsed = manifestSchema.safeParse(input);
    if (!parsed.success) fail('INVALID_PRIVATE_MANIFEST'); // Never echo values or Zod details.
    const m = parsed.data;
    if (runId === PREVIEW_RUN || m.runId !== runId || m.environmentFingerprint !== fingerprint ||
        m.updatedAt < m.createdAt) fail('MANIFEST_OWNERSHIP_MISMATCH');
    const bySlot = new Map(m.resources.map(r => [r.slot, r]));
    if (bySlot.size !== 12) fail('DUPLICATE_MANIFEST_RESOURCE');
    const ids = new Set(), paths = new Set();
    for (const r of m.resources) {
        const [kind, parents] = SLOTS[r.slot];
        if (r.ownerRunId !== runId || r.kind !== kind || JSON.stringify(r.parents) !== JSON.stringify(parents))
            fail('MANIFEST_OWNERSHIP_MISMATCH');
        const version = /1$/.test(r.slot) ? 'v1' : 'v2';
        if (['pdf', 'storage', 'submissions'].includes(kind) ? r.version !== version : r.version !== undefined)
            fail('MANIFEST_VERSION_MISMATCH');
        if (r.state === 'planned') {
            if (r.id || r.path || r.creationProof || r.verificationProof || r.createdAt || r.verifiedAt || r.cleanupEligible)
                fail('PLANNED_RESOURCE_HAS_CREATION_CLAIM');
        } else {
            if (!r.creationProof || !r.createdAt || r.createdAt < m.createdAt || r.createdAt > m.updatedAt ||
                parents.some(p => bySlot.get(p).state === 'planned')) fail('UNPROVEN_RESOURCE');
            if (!['pdf', 'storage'].includes(kind) && !r.id) fail('MISSING_RESOURCE_ID');
            if (r.state !== 'created' && !r.verifiedAt) fail('UNVERIFIED_RESOURCE');
        }
        if (Boolean(r.verifiedAt) !== Boolean(r.verificationProof) ||
            (r.verifiedAt && (r.verifiedAt < r.createdAt || r.verifiedAt > m.updatedAt))) fail('INVALID_VERIFICATION_EVIDENCE');
        if (r.cleanupEligible && (r.state !== 'pending-cleanup' || !r.verifiedAt)) fail('CLEANUP_NOT_ELIGIBLE');
        if (r.id) {
            const key = `${kind}:${r.id}`;
            if (['pdf', 'storage'].includes(kind) || ids.has(key)) fail('DUPLICATE_OR_INVALID_RESOURCE_ID');
            ids.add(key);
        }
        if (['pdf', 'storage', 'submissions'].includes(kind)) {
            if (r.checksum !== sha256(pdfBytes(version))) fail('PDF_CHECKSUM_MISMATCH');
        } else if (r.checksum !== undefined) fail('UNEXPECTED_CHECKSUM');
        if (r.path !== undefined && (kind !== 'storage' || !bySlot.get('paper').id ||
            r.path !== storagePath(bySlot.get('paper').id, version, runId) || paths.has(r.path))) fail('UNOWNED_STORAGE_PATH');
        if (kind === 'storage' && r.state !== 'planned' && !r.path) fail('MISSING_STORAGE_PATH');
        if (r.path) paths.add(r.path);
    }
    return true;
}

function plan(config, migrations) {
    return {
        gate: 'A.2b-I', provisioning: 'disabled in code; later reviewed implementation required',
        implementation: { mockRuntime: 'A.2b-I injected contracts only', targetPin: 'version 2 comparison available',
            nativeServiceBridge: 'unavailable', nativeDPAPI: 'unavailable', liveAdmission: 'not implemented' },
        isolationAssumption: 'Owner declares both configured environments development/test-only with no real student or production data.',
        target: { database: config.database, port: config.port, loopbackConfigured: true,
            storageBucket: config.bucket, configurationFingerprint: config.fingerprint,
            liveIdentity: 'NOT VERIFIED; independent project/instance pin and live guards required at A.2b',
            repositoryMigrationCount: migrations.length, repositoryMigrationFingerprint: sha256(JSON.stringify(migrations)) },
        counts: { admin: 1, adviser: 1, student: 1, activeGroup: 1, membership: 1, draftProject: 1,
            localPDFs: 2, preparationSubmissions: 0, preparationStorageObjects: 0 },
        creationOrder: [
            'Review private target pin and secret mechanism; revalidate runtime identity/schema/migrations/headroom.',
            'Create private ownership journal before writes; generate randomUUID-derived run ID (preview ID is never provisionable).',
            'Explicitly authorized test-only Admin bootstrap: one new users row using hashPassword (bcrypt cost 12), active role 1; no existing-account changes or AI certification.',
            'Owned Admin session -> createManagedAccount (role 2); Student -> registerUser (role 3); use normal validated actions/session boundaries.',
            'Owned Adviser session -> createResearchGroupAction -> createResearchGroup; active group with synthetic strand/section/school year.',
            'Owned Adviser session -> addGroupMemberAction -> mutateAdviserGroupMember; verify owned active group and Student with no other active membership.',
            'Owned Student session -> createStudentResearchAction -> createStudentResearch; nonempty synthetic title/abstract, Draft, zero submissions.',
            'Prepare two private local PDFs; verify checksums. Stop before submission; browser workflow is separately authorized.',
        ],
        identifiers: { previewRunId: PREVIEW_RUN, futureEmails: 'phase96-<random-UUID-hex>-<role>@example.invalid',
            group: 'PHASE96 <runId>', project: 'PHASE96 <runId> synthetic research',
            metadata: { strand: 'SYNTHETIC', section: 'TEST', schoolYear: '2026-2027', abstract: 'Synthetic workflow acceptance only.' } },
        pdfs: ['v1', 'v2'].map(version => ({ version, mime: 'application/pdf', bytes: pdfBytes(version).length,
            sha256: sha256(pdfBytes(version)), pathTemplate: `research/{ownedPaperId}/${version}/{runId}-${version}.pdf` })),
        writes: { thisCommand: 0, futurePreparation: { users: 3, research_groups: 1, group_members: 1, research_papers: 1,
            activity_logs: 1, notifications: 'N = all Admin accounts returned by findUsersByRoleId, including historical accounts',
            localFiles: '2 PDFs + atomic ownership journal updates; credentials only in separately approved secret mechanism',
            storage: 0, submissions: 0 },
            laterWorkflow: 'Not preparation: v1/v2 uploads + submission rows, review/status/feedback/log/notification writes and publication.' },
        ownership: 'Private external per-run journal: IDs, parent relationships, versions, paths, SHA-256, states, timestamps and creation/verification evidence; never passwords. Strict schema rejects extra fields.',
        resumption: 'Acquire per-run exclusive lock; verify journal ACL/integrity and independently pinned target; reread every recorded ID/parent/role/status and object metadata. Resume owned incomplete steps only. Crash after unjournaled commit => stop for investigation, never adopt by name/email or blindly retry.',
        rollback: 'No automatic teardown. DB service calls and filesystem journal are not one transaction. Retain partial owned fixtures on failure, record uncertainty, stop. Future cleanup requires fresh ownership checks and separate authorization.',
        cleanup: 'Explicitly track owned downstream feedback/repository/notifications/logs as well as objects/submissions; resolve restrictive FKs in reverse dependency order, never delete historical/unowned resources. Teardown not implemented.',
        blockers: [
            'Live system identifier/database OID, role seeds, catalog/constraint digest, 12 migration hashes, loopback peer, private bucket/project and >=10 free ordinary connections are not verified offline.',
            'No existing owned Admin credential/bootstrap interface: new test-only bootstrap needs review and authorization; no application authorization bypass implemented.',
            'Group service broadcasts to historical Admins and returns generic uncertain errors after partial success; action hides created group ID. Review side-effect policy and capture exact creation ID/evidence without adopting by title before A.2b.',
            'Journal/CurrentUser protection and creation receipts are mock-tested contracts only. Real ACL/DPAPI, filesystem durability, bounded native clients and service integration remain unavailable; not provision-ready.',
        ],
    };
}

function run(mode = 'inspect', env, migrations) {
    // Must precede configuration access, imports and any future client factory.
    if (mode === 'provision') fail('PROVISIONING_NOT_AUTHORIZED');
    if (!['inspect', 'dry-run'].includes(mode)) fail('UNKNOWN_MODE');
    const config = configuration(env);
    if (!Array.isArray(migrations) || migrations.length !== 12 || migrations.some(x => !HASH.test(x))) fail('MIGRATION_SOURCE_MISMATCH');
    const report = plan(config, migrations);
    return mode === 'dry-run' ? report : { gate: report.gate, provisioning: report.provisioning, implementation: report.implementation, target: report.target,
        configuration: 'supported for offline planning only', actualWrites: 0, blockers: report.blockers };
}

module.exports = { configuration, validateRuntimeTarget, storagePath, pdfBytes, sha256, validateManifest, run, PREVIEW_RUN, SLOTS };

const roleAttributes = z.strictObject({ canLogin: z.literal(true), superuser: z.boolean(), bypassRls: z.boolean(),
    inherit: z.boolean(), createRole: z.boolean(), createDb: z.boolean(), replication: z.boolean() });
const privileges = z.strictObject({ connect: z.literal(true), schemaUsage: z.literal(true), select: z.literal(true),
    insert: z.literal(true), sequenceUsage: z.literal(true), rowLocks: z.literal(true) });
const id = z.number().int().positive().max(2147483647);
const pinSchema = z.strictObject({
    schemaVersion: z.literal(2), database: z.literal('thesishs_ai'), port: z.literal(5432), host: z.string(),
    systemIdentifier: z.string().regex(/^\d{10,30}$/), databaseOid: id, serverVersion: z.literal(180004),
    dbRole: z.string().min(1).max(63), roleAttributes, privileges,
    applicationRoles: z.strictObject({ Admin: z.literal(1), Adviser: z.literal(2), Student: z.literal(3), Panel: z.literal(4) }),
    // Legacy DB label 'User' for ID 3 is permitted ONLY when explicitly pinned.
    roles: z.array(z.strictObject({ id, name: z.string().min(1).max(50) })).length(4),
    migrations: z.array(hashSchema).length(12), schemaHash: hashSchema,
    projectRef: z.string().regex(/^[a-z0-9]{20}$/), storageEndpoint: z.string(),
    bucket: z.literal(BUCKET), bucketPublic: z.literal(false),
    pathConvention: z.literal('research/{paperId}/{version}/{sanitizedFileName}'),
    plannedConnections: z.number().int().min(1).max(10), minimumSpare: z.number().int().min(10).max(97),
});
const observationSchema = z.strictObject({
    database: z.string(), port: z.number().int(), serverAddress: z.string(), systemIdentifier: z.string(),
    databaseOid: id, serverVersion: z.number().int(), dbRole: z.string(), sessionRole: z.string(), roleAttributes, privileges,
    applicationRoles: pinSchema.shape.applicationRoles, roles: pinSchema.shape.roles,
    migrations: z.array(hashSchema), schemaHash: hashSchema,
    projectRef: z.string(), storageEndpoint: z.string(), bucket: z.string(), bucketPublic: z.boolean(),
    maxConnections: z.number().int().positive(), superuserReserved: z.number().int().nonnegative(),
    reserved: z.number().int().nonnegative(), clientBackends: z.number().int().positive(),
    roleLimit: z.number().int().min(-1), roleConnections: z.number().int().positive(),
    databaseLimit: z.number().int().min(-1), databaseConnections: z.number().int().positive(),
});
function canonical(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
    return JSON.stringify(value);
}
function validatePinnedTarget(pinInput, observedInput, effective, localMigrations) {
    const p = pinSchema.safeParse(pinInput), o = observationSchema.safeParse(observedInput);
    if (!p.success || !o.success) fail('TARGET_METADATA_UNAVAILABLE');
    const pin = p.data, observed = o.data;
    if (!loopback(pin.host) || /prod|production|live/i.test(pin.dbRole) ||
        new Set(pin.roles.map(r => r.id)).size !== 4 ||
        pin.roles.some(r => ![1, 2, 3, 4].includes(r.id)) ||
        pin.roles.find(r => r.id === 1)?.name !== 'Admin' || pin.roles.find(r => r.id === 2)?.name !== 'Adviser' ||
        !['User', 'Student'].includes(pin.roles.find(r => r.id === 3)?.name) || pin.roles.find(r => r.id === 4)?.name !== 'Panel')
        fail('INVALID_TARGET_PIN');
    const endpoint = `https://${pin.projectRef}.supabase.co`;
    if (pin.storageEndpoint !== endpoint || effective?.storageEndpoint !== endpoint ||
        effective.projectRef !== pin.projectRef || effective.bucket !== BUCKET ||
        /prod|production|live/i.test(pin.projectRef)) fail('STORAGE_TARGET_REJECTED');
    if (effective.host !== pin.host || effective.database !== pin.database || effective.port !== pin.port ||
        canonical(localMigrations) !== canonical(pin.migrations) || !normalizeLoopback(observed.serverAddress)) fail('RUNTIME_TARGET_MISMATCH');
    for (const field of ['database', 'port', 'systemIdentifier', 'databaseOid', 'serverVersion', 'dbRole', 'roleAttributes',
        'privileges', 'applicationRoles', 'roles', 'migrations', 'schemaHash', 'projectRef', 'storageEndpoint', 'bucket', 'bucketPublic'])
        if (canonical(pin[field]) !== canonical(observed[field])) fail('RUNTIME_TARGET_MISMATCH');
    if (observed.sessionRole !== pin.dbRole || observed.roleConnections > observed.clientBackends ||
        observed.databaseConnections > observed.clientBackends || observed.clientBackends > observed.maxConnections)
        fail('RUNTIME_TARGET_MISMATCH');
    const globalFree = observed.maxConnections - observed.superuserReserved - observed.reserved - observed.clientBackends;
    const roleFree = observed.roleLimit === -1 ? Infinity : observed.roleLimit - observed.roleConnections;
    const dbFree = observed.databaseLimit === -1 ? Infinity : observed.databaseLimit - observed.databaseConnections;
    const spare = Math.min(globalFree, roleFree, dbFree) - pin.plannedConnections;
    if (spare < pin.minimumSpare) fail('INSUFFICIENT_CONNECTION_HEADROOM');
    return { targetDigest: sha256(canonical(pin)), spareConnections: spare };
}
module.exports = { ...module.exports, normalizeLoopback, validatePinnedTarget, canonical, pinSchema };
