/* eslint-disable @typescript-eslint/no-require-imports */
// Offline policy/SQL/source checks only. No database, credentials or network adapters.
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { defaultTemplateScale, isTemplateView } = require('../lib/evaluation-templates.ts');
const { templateDraftSchema, templateMutationSchema } = require('../lib/validations/evaluation-template.ts');
function load(file, mocks) {
    const exports = {};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
        { exports, Date, structuredClone, require(id) {
            if (id === 'server-only') return {};
            if (Object.hasOwn(mocks, id)) return mocks[id];
            if (/lib\/db|postgres|dotenv/.test(id)) throw Error('Live adapter forbidden');
            return require(id.startsWith('@/') ? path.resolve(id.slice(2)) : id);
        } });
    return exports;
}
function draft(size = 4) {
    return { name: ' Method review ', scale: size === 4 ? defaultTemplateScale() : { version: 1,
        levels: Array.from({ length: size }, (_, i) => ({ points: i + 1, label: 'Level ' + (i + 1), description: '' })) },
        criteria: ['Method', 'Evidence'].map((name, position) => ({ key: randomUUID(), position, name, description: '', allowsNa: false })) };
}
function fixture() {
    const state = { actor: { userId: 1, roleId: 2 }, main: 1, active: true, rows: [], nextId: 1, logs: [], failLog: false };
    const repo = { async withOwner(actorId, work) {
        if (!state.active || state.actor.roleId !== 2 || state.main !== actorId) return null;
        const before = structuredClone(state);
        try { return await work({
            list: async archived => structuredClone(state.rows.filter(row => row.ownerId === actorId && (archived || !row.archivedAt))).map(row => { delete row.ownerId; return row; }),
            read: async id => { const found = state.rows.find(row => row.id === id && row.ownerId === actorId); if (!found) return undefined; const row = structuredClone(found); delete row.ownerId; return row; },
            create: async data => {
                const row = { ...structuredClone(data), id: state.nextId++, revision: 0, archivedAt: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
                state.rows.push({ ...row, ownerId: actorId }); return row;
            },
            update: async (row, data) => {
                const saved = { ...row, ...(data || { archivedAt: new Date().toISOString() }), revision: row.revision + 1 };
                state.rows = state.rows.map(old => old.id === row.id && old.ownerId === actorId ? { ...saved, ownerId: actorId } : old); return saved;
            },
            log: async (...event) => { if (state.failLog) throw Error('PRIVATE_SQL_ERROR'); state.logs.push(event); },
        }); } catch (error) { Object.assign(state, before); throw error; }
    } };
    const service = load('lib/services/evaluation-template.service.ts', {
        '@/lib/db': { db: {} }, '@/lib/auth/main-adviser': { getCurrentMainAdviser: async () => state.actor },
        '@/lib/repositories/evaluation-template.repository': { createEvaluationTemplateRepository: () => repo },
    }).createEvaluationTemplateService(repo, async () => state.actor);
    return { state, service, create: data => service.mutate({ operation: 'create', draft: data || draft() }) };
}
test('3/4/5-level independent scales normalize strings and keep explicit consecutive points', () => {
    for (const size of [2, 3, 4, 5]) {
        const parsed = templateDraftSchema.parse(draft(size)); assert.equal(parsed.scale.levels.length, size); assert.equal(parsed.name, 'Method review');
        assert.deepEqual(parsed.scale.levels.map(row => row.points), Array.from({ length: size }, (_, i) => i + 1));
    }
    const one = defaultTemplateScale(); one.levels[0].label = 'Changed'; assert.equal(defaultTemplateScale().levels[0].label, 'Unsatisfactory');
});
test('invalid scales, unknown formula/owner fields, malformed order and repeated identifiers fail closed', () => {
    const cases = [];
    for (const points of [0, -1, 1.5, 5, '1']) { const data = draft(); data.scale.levels[0].points = points; cases.push(data); }
    for (const size of [0, 1, 6]) cases.push(draft(size));
    let data = draft(); data.scale.levels.reverse(); cases.push(data);
    data = draft(); data.scale.levels[0].label = ' '; cases.push(data);
    data = draft(); data.scale.formula = 'sum'; cases.push(data);
    data = draft(); data.criteria[1].key = data.criteria[0].key.toUpperCase(); cases.push(data);
    data = draft(); data.criteria[1].position = 0; cases.push(data);
    data = draft(); data.criteria[0].name = ' '; cases.push(data);
    data = draft(); data.criteria = []; cases.push(data);
    data = draft(); data.criteria = Array.from({ length: 31 }, (_, position) => ({ ...data.criteria[0], key: randomUUID(), position })); cases.push(data);
    data = draft(); data.criteria[0].allowsNa = 'true'; cases.push(data);
    for (const value of cases) assert.equal(templateDraftSchema.safeParse(value).success, false);
    assert.equal(templateMutationSchema.safeParse({ operation: 'create', ownerId: 2, draft: draft() }).success, false);
});
test('Main creates and reads own templates; defaults exclude archives; DTO does not expose owner identities', async () => {
    const f = fixture(), created = await f.create(); assert.equal(created.success, true); assert.equal(created.data.name, 'Method review');
    assert.equal((await f.service.read({ templateId: created.data.id })).data.criteria.length, 2);
    const listed = await f.service.list({}); assert.equal(listed.data.length, 1); assert.equal('ownerId' in listed.data[0], false); assert.equal(f.state.logs.length, 1);
});
test('update saves scale, text, N/A and order together; stale revisions do not overwrite', async () => {
    const f = fixture(), row = (await f.create()).data, changed = draft(5);
    changed.criteria = [...row.criteria].reverse().map((item, position) => ({ ...item, position, allowsNa: true }));
    let result = await f.service.mutate({ operation: 'update', templateId: row.id, expectedRevision: 0, draft: changed });
    assert.equal(result.success, true); assert.equal(result.data.scale.levels.length, 5); assert.equal(result.data.criteria[0].key, row.criteria[1].key);
    assert.equal(result.data.criteria[0].allowsNa, true);
    const before = structuredClone(f.state.rows);
    result = await f.service.mutate({ operation: 'update', templateId: row.id, expectedRevision: 0, draft: draft(3) });
    assert.equal(result.kind, 'stale'); assert.deepEqual(f.state.rows, before);
});
test('duplicate is an independent owned copy with fresh criterion keys', async () => {
    const f = fixture(), row = (await f.create()).data;
    const copy = await f.service.mutate({ operation: 'duplicate', templateId: row.id, expectedRevision: row.revision });
    assert.equal(copy.success, true); assert.notEqual(copy.data.id, row.id); assert.notEqual(copy.data.criteria[0].key, row.criteria[0].key);
    assert.deepEqual(copy.data.scale, row.scale);
    const changed = { name: 'Changed copy', scale: defaultTemplateScale(), criteria: copy.data.criteria };
    await f.service.mutate({ operation: 'update', templateId: copy.data.id, expectedRevision: 0, draft: changed });
    assert.equal((await f.service.read({ templateId: row.id })).data.name, 'Method review');
});
test('archive preserves rows, excludes active choices and denies update or duplicate', async () => {
    const f = fixture(), row = (await f.create()).data;
    assert.equal((await f.service.mutate({ operation: 'archive', templateId: row.id, expectedRevision: 0 })).success, true);
    assert.equal((await f.service.list({})).data.length, 0); assert.equal((await f.service.list({ includeArchived: true })).data.length, 1);
    assert.equal((await f.service.read({ templateId: row.id })).data.criteria.length, 2);
    for (const operation of ['update', 'duplicate', 'archive']) assert.equal((await f.service.mutate({ operation, templateId: row.id, expectedRevision: 1,
        ...(operation === 'update' ? { draft: draft() } : {}) })).success, false);
});
test('other roles, inactive/former Main and successor access cannot disclose or change private templates', async () => {
    const f = fixture(), row = (await f.create()).data;
    for (const actor of [null, { userId: 1, roleId: 3 }, { userId: 1, roleId: 1 }, { userId: 1, roleId: 4 }, { userId: 2, roleId: 2 }]) {
        f.state.actor = actor;
        assert.equal((await f.service.read({ templateId: row.id })).success, false); assert.equal((await f.create()).success, false);
    }
    f.state.actor = { userId: 1, roleId: 2 }; f.state.active = false; assert.equal((await f.create()).success, false);
    f.state.active = true; f.state.main = 2; assert.equal((await f.create()).success, false);
    f.state.actor = { userId: 2, roleId: 2 };
    assert.equal((await f.service.list({})).data.length, 0);
    assert.equal((await f.service.read({ templateId: row.id })).success, false);
    assert.equal((await f.service.mutate({ operation: 'duplicate', templateId: row.id, expectedRevision: 0 })).success, false);
});
test('audit failure rolls back create/update and hides infrastructure details', async () => {
    const f = fixture(); f.state.failLog = true;
    const result = await f.create(); assert.equal(result.kind, 'unavailable'); assert.equal(f.state.rows.length, 0); assert.doesNotMatch(result.message, /PRIVATE_SQL/);
    f.state.failLog = false; const row = (await f.create()).data, before = structuredClone(f.state.rows); f.state.failLog = true;
    assert.equal((await f.service.mutate({ operation: 'update', templateId: row.id, expectedRevision: 0, draft: draft(3) })).success, false);
    assert.deepEqual(f.state.rows, before);
});
test('actual repository SQL rechecks designation and scopes header/criteria reads to the owner', async () => {
    const { drizzle } = require('drizzle-orm/pg-proxy'), schema = require('../db/schema/index.ts');
    const guard = load('lib/repositories/research-supervision.repository.ts', { '@/lib/db': { db: {} } });
    const { createEvaluationTemplateRepository } = load('lib/repositories/evaluation-template.repository.ts', { './research-supervision.repository': guard });
    const queries = []; let main = 1;
    const db = drizzle(async (query, params) => {
        queries.push({ query, params });
        const row = query.includes('from "users"') ? { id: 1, role_id: 2, is_active: true }
            : query.includes('from "main_adviser_designation"') ? { main_adviser_id: main } : null;
        if (!row) return { rows: [] };
        const cols = [...query.slice(0, query.indexOf(' from ')).matchAll(/"([a-z_]+)"/g)].map(m => m[1]);
        return { rows: [cols.map(col => row[col] ?? null)] };
    }, { schema }); db.transaction = work => work(db);
    const repo = createEvaluationTemplateRepository(db);
    await repo.withOwner(1, async scope => { await scope.list(false); await scope.read(99); });
    const list = queries.find(q => q.query.includes('from "evaluation_templates"') && q.query.includes('is null'));
    assert.match(list.query, /"owner_id" =/); assert.deepEqual(list.params, [1]);
    const read = queries.find(q => q.query.includes('from "evaluation_templates"') && q.query.includes('for update'));
    assert.deepEqual(read.params, [99, 1]); assert.match(read.query, /"owner_id" =/);
    main = 2; assert.equal(await repo.withOwner(1, async () => assert.fail('former Main accessed data')), null);
});
test('refresh failure preserves acknowledged writes; exact view matching preserves submission routing', async () => {
    const actions = load('lib/actions/evaluation-template.action.ts', { 'next/cache': { revalidatePath() { throw Error('Refresh'); } },
        '@/lib/services/evaluation-template.service': { mutateEvaluationTemplate: async () => ({ success: true, message: 'Saved.', data: { id: 1 } }) } });
    assert.equal((await actions.mutateEvaluationTemplateAction({})).success, true);
    assert.equal(isTemplateView('templates'), true); for (const raw of [undefined, 'all', ['templates'], 'template']) assert.equal(isTemplateView(raw), false);
});
test('actual write SQL saves ordered criteria and scale under one owner/revision transaction, including audit rollback', async () => {
    const { drizzle } = require('drizzle-orm/pg-proxy'), schema = require('../db/schema/index.ts');
    const guard = load('lib/repositories/research-supervision.repository.ts', { '@/lib/db': { db: {} } });
    const { createEvaluationTemplateRepository } = load('lib/repositories/evaluation-template.repository.ts', { './research-supervision.repository': guard });
    const state = { header: null, items: [], queries: [], failAudit: false };
    function project(query, row) {
        const select = query.startsWith('select ') ? query.slice(7, query.indexOf(' from ')) : query.slice(query.indexOf(' returning ') + 11);
        return select.split(', ').map(column => { const names = [...column.matchAll(/"([a-z_]+)"/g)]; return row[names.at(-1)?.[1]] ?? null; });
    }
    const db = drizzle(async (query, params) => {
        state.queries.push({ query, params });
        if (query.includes('from "users"')) return { rows: [project(query, { id: 1, role_id: 2, is_active: true })] };
        if (query.includes('from "main_adviser_designation"')) return { rows: [project(query, { main_adviser_id: 1 })] };
        if (query.startsWith('insert into "evaluation_templates"')) {
            state.header = { id: 7, owner_id: params[0], name: params[1], scale: JSON.parse(params[2]), revision: 0, archived_at: null,
                created_at: '2026-11-18T01:00:00Z', updated_at: '2026-11-18T01:00:00Z' };
            return { rows: [project(query, state.header)] };
        }
        if (query.startsWith('insert into "evaluation_template_criteria"')) {
            for (let index = 0; index < params.length; index += 6) state.items.push({ template_id: params[index], criterion_key: params[index + 1],
                position: params[index + 2], name: params[index + 3], description: params[index + 4], allows_na: params[index + 5] });
        }
        if (query.startsWith('select ') && query.includes('from "evaluation_template_criteria"')) {
            assert.match(query, /"evaluation_templates"\."owner_id" =/); assert.equal(params[0], 1);
            return { rows: state.items.sort((a, b) => a.position - b.position).map(row => project(query, row)) };
        }
        if (query.startsWith('select ') && query.includes('from "evaluation_templates"')) return { rows: state.header ? [project(query, state.header)] : [] };
        if (query.startsWith('update "evaluation_templates"')) {
            assert.match(query, /"owner_id" = .*"revision" = .*"archived_at" is null/);
            assert.deepEqual(params.slice(-3), [7, 1, state.header.revision]);
            state.header = { ...state.header, name: params[0], scale: JSON.parse(params[1]), revision: params[2] };
            return { rows: [project(query, state.header)] };
        }
        if (query.startsWith('delete from "evaluation_template_criteria"')) { assert.deepEqual(params, [7]); state.items = []; }
        if (query.startsWith('insert into "activity_logs"') && state.failAudit) throw Error('Synthetic audit failure');
        return { rows: [] };
    }, { schema });
    db.transaction = async work => { const before = structuredClone({ header: state.header, items: state.items });
        try { return await work(db); } catch (error) { Object.assign(state, before); throw error; } };
    const repo = createEvaluationTemplateRepository(db);
    const original = await repo.withOwner(1, async scope => { const row = await scope.create(templateDraftSchema.parse(draft())); await scope.log('Created', row); return row; });
    assert.equal(original.criteria.length, 2);
    const changed = templateDraftSchema.parse({ ...draft(3), criteria: [...original.criteria].reverse().map((row, position) => ({ ...row, position })) });
    const updated = await repo.withOwner(1, async scope => { const row = await scope.update(await scope.read(7), changed); await scope.log('Updated', row); return row; });
    assert.equal(updated.revision, 1); assert.equal(updated.scale.levels.length, 3); assert.equal(updated.criteria[0].key, original.criteria[1].key);
    const before = structuredClone({ header: state.header, items: state.items }); state.failAudit = true;
    await assert.rejects(repo.withOwner(1, async scope => { const row = await scope.update(await scope.read(7), templateDraftSchema.parse(draft(5))); await scope.log('Updated', row); }));
    assert.deepEqual({ header: state.header, items: state.items }, before);
});
test('0021 is additive and preserves all prior snapshots, table definitions and source digests', () => {
    const source = require('../scripts/preview-migration-source.ts'), before = source.emailOtpMigrationSource(), after = source.evaluationTemplateMigrationSource();
    assert.equal(before.migrations.length, 21); assert.equal(after.migrations.length, 22);
    assert.equal(before.hash, source.EMAIL_OTP_SOURCE_DIGEST); assert.equal(after.hash, source.EVALUATION_TEMPLATE_SOURCE_DIGEST);
    const tables = structuredClone(after.snapshot.tables); delete tables['public.evaluation_templates']; delete tables['public.evaluation_template_criteria'];
    assert.deepEqual(tables, before.snapshot.tables); assert.equal(after.snapshot.prevId, before.snapshot.id);
    const sql = fs.readFileSync('db/migrations/0021_evaluation_templates.sql', 'utf8');
    assert.doesNotMatch(sql, /(?:^|;|\n)\s*(DROP|DELETE|TRUNCATE|UPDATE|INSERT|GRANT)\b/i);
    assert.equal((sql.match(/CREATE TABLE/g) || []).length, 2); assert.doesNotMatch(sql, /submission_evaluation|ALTER TABLE "(?:feedbacks|submissions|revision_items|research_milestones)"/);
    assert.equal(createHash('sha256').update(fs.readFileSync('db/migrations/0021_evaluation_templates.sql')).digest('hex'), after.migrations[21].hash);
});
