/* eslint-disable @typescript-eslint/no-require-imports */
// Explicit E1B validation on a NEW owned cluster. Never reads .env or existing connection settings.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { execFileSync } = require('node:child_process'), { randomUUID, randomBytes } = require('node:crypto');
const postgres = require('postgres'), { drizzle } = require('drizzle-orm/postgres-js'), { migrate } = require('drizzle-orm/postgres-js/migrator');
const root = path.resolve('test-results/e1b-v1'), bin = 'C:/Program Files/PostgreSQL/18/bin';
const args = process.argv.slice(2);
assert.equal(args[0], '--execute', 'Explicit execution required');
const phase = args[1], manifestPath = path.join(root, 'current-run.json');
const binary = (name, parameters) => execFileSync(path.join(bin, name + '.exe'), parameters, { windowsHide: true, encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] });
function owned(state) {
    assert.match(state.run, /^[a-f0-9]{32}$/);
    assert.equal(state.directory, path.join(root, state.run, 'pgdata'));
    assert.ok(path.resolve(state.directory).startsWith(root + path.sep));
    assert.equal(state.port, 55447); assert.equal(state.operator, 'e1bv1_operator'); assert.match(state.database, /^e1bv1_[a-f0-9]{32}$/);
    assert.equal(fs.readFileSync(path.join(root, state.run, 'owner'), 'utf8'), state.run);
}
const save = state => fs.writeFileSync(manifestPath, JSON.stringify(state), { mode: 0o600 });
function read() { const state = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); owned(state); return state; }
function connect(state, database = state.database, runtime = false) {
    return postgres({ host: '127.0.0.1', port: state.port, database, username: runtime ? 'e1bv1_runtime' : state.operator,
        password: runtime ? state.runtimePassword : state.operatorPassword, ssl: false, max: 4, connect_timeout: 5, idle_timeout: 5,
        onnotice: () => {}, connection: { application_name: 'e1b_v1_disposable', statement_timeout: 10000, lock_timeout: 4000 } });
}
async function verify(sql, state, database) {
    owned(state);
    const control = binary('pg_controldata', [state.directory]).match(/Database system identifier:\s*(\d+)/)?.[1];
    assert.equal(control, state.cluster);
    const [row] = await sql`select current_database() as database,current_user as actor,host(inet_server_addr()) as address,
        inet_server_port() as port,current_setting('data_directory') as directory,current_setting('listen_addresses') as listen,
        (select system_identifier::text from pg_control_system()) as cluster,(select oid::text from pg_database where datname=current_database()) as oid`;
    assert.equal(row.database, database); assert.equal(row.actor, state.operator); assert.equal(row.address, '127.0.0.1');
    assert.equal(row.port, state.port); assert.equal(row.listen, '127.0.0.1'); assert.equal(path.resolve(row.directory), path.resolve(state.directory)); assert.equal(row.cluster, control);
    if (state.databaseOid && database === state.database) assert.equal(row.oid, state.databaseOid);
    return row;
}
async function freePort(port) {
    const net = require('node:net'); await new Promise((resolve, reject) => { const server = net.createServer(); server.once('error', reject); server.listen(port, '127.0.0.1', () => server.close(resolve)); });
}
async function completeSetup(state) {
    const admin = connect(state, 'postgres');
    try {
        await verify(admin, state, 'postgres');
        state.started = true; save(state);
        assert.equal((await admin`select 1 from pg_database where datname=${state.database}`).length, 0, 'Disposable database must not already exist');
        await admin`create database ${admin(state.database)} template template0`;
    } finally { await admin.end(); }
    const sql = connect(state);
    try { const identity = await verify(sql, state, state.database); state.databaseOid = identity.oid; } finally { await sql.end(); }
    state.checks.push('independent new-cluster/control-file/data-directory/loopback/database-OID identity'); save(state);
    console.log('PASS safety: newly initialized task-owned PostgreSQL 18 cluster on 127.0.0.1:55447; control-file and SQL identity match. No existing database used.');
}
async function setup() {
    if (fs.existsSync(manifestPath)) assert.equal(JSON.parse(fs.readFileSync(manifestPath)).cleaned, true, 'Prior owned validation must be cleaned first');
    await freePort(55447); await freePort(3057);
    const run = randomUUID().replaceAll('-', ''), home = path.join(root, run);
    fs.mkdirSync(home, { recursive: true }); fs.writeFileSync(path.join(home, 'owner'), run, { flag: 'wx' });
    const state = { run, directory: path.join(home, 'pgdata'), port: 55447, operator: 'e1bv1_operator', database: 'e1bv1_' + run,
        operatorPassword: randomBytes(24).toString('hex'), runtimePassword: randomBytes(24).toString('hex'), jwt: randomBytes(48).toString('hex'), loginPassword: randomBytes(20).toString('hex'), checks: [] };
    save(state);
    const passwordFile = path.join(home, 'init-password'); fs.writeFileSync(passwordFile, state.operatorPassword, { mode: 0o600, flag: 'wx' });
    try {
        assert.equal(fs.existsSync(state.directory), false);
        binary('initdb', ['-D', state.directory, '--username=' + state.operator, '--auth-host=scram-sha-256', '--auth-local=trust', '--encoding=UTF8', '--locale=C', '--pwfile=' + passwordFile]);
        state.cluster = binary('pg_controldata', [state.directory]).match(/Database system identifier:\s*(\d+)/)?.[1]; assert.ok(state.cluster); save(state);
        try { binary('pg_ctl', ['-D', state.directory, '-l', path.join(home, 'postgres.log'), '-o', '-h 127.0.0.1 -p 55447 -c max_connections=20 -c shared_buffers=32MB', '-w', 'start']); }
        catch (error) { if (error.code !== 'ETIMEDOUT') throw error; } // Read-only identity checks decide whether the owned server actually started.
        await completeSetup(state);
    } finally { fs.unlinkSync(passwordFile); }
}
async function database() {
    const state = read(), sql = connect(state); let runtime;
    try {
        await verify(sql, state, state.database);
        if (phase === 'database') {
        assert.equal((await sql`select tablename from pg_tables where schemaname='public'`).length, 0, 'Must start from empty disposable schema');
        const source = require('../scripts/preview-migration-source.ts'), before = source.emailOtpMigrationSource(), full = source.evaluationTemplateMigrationSource();
        const folder = path.join(root, state.run, 'prefix'); fs.mkdirSync(path.join(folder, 'meta'), { recursive: true });
        const journal = JSON.parse(fs.readFileSync('db/migrations/meta/_journal.json', 'utf8')); journal.entries = journal.entries.slice(0, 21);
        fs.writeFileSync(path.join(folder, 'meta/_journal.json'), JSON.stringify(journal));
        for (const entry of journal.entries) fs.copyFileSync('db/migrations/' + entry.tag + '.sql', path.join(folder, entry.tag + '.sql'));
        await migrate(drizzle(sql), { migrationsFolder: folder });
        source.verifyEmailOtpLedger(await sql`select id,hash,created_at::text as created_at from drizzle.__drizzle_migrations order by created_at,id`, 21);
        const oldTables = Object.values(before.snapshot.tables).map(row => row.name);
        const structures = () => sql`select c.relname as table_name,a.attname as column_name,format_type(a.atttypid,a.atttypmod) as type,a.attnotnull as required,
            pg_get_expr(d.adbin,d.adrelid) as default_value from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid
            left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum where n.nspname='public' and c.relname=any(${oldTables}::text[]) and a.attnum>0 and not a.attisdropped order by c.relname,a.attnum`;
        const constraints = () => sql`select c.relname as table_name,p.conname,pg_get_constraintdef(p.oid) as definition from pg_constraint p join pg_class c on c.oid=p.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any(${oldTables}::text[]) order by c.relname,p.conname`;
        const original = { columns: await structures(), constraints: await constraints() };
        await verify(sql, state, state.database);
        await migrate(drizzle(sql), { migrationsFolder: 'db/migrations' }); // Only pending 0021, once.
        const ledger = await sql`select id,hash,created_at::text as created_at from drizzle.__drizzle_migrations order by created_at,id`;
        assert.equal(ledger.length, 22); assert.deepEqual(ledger.map(row => row.hash), full.migrations.map(row => row.hash));
        assert.equal(ledger.filter(row => row.hash === full.migrations[21].hash).length, 1);
        assert.deepEqual(await structures(), original.columns); assert.deepEqual(await constraints(), original.constraints);
        const installed = await sql`select c.relname,p.contype,pg_get_constraintdef(p.oid) as definition from pg_constraint p join pg_class c on c.oid=p.conrelid where c.relname in ('evaluation_templates','evaluation_template_criteria')`;
        for (const [kind, count] of [['p', 2], ['u', 1], ['f', 2], ['c', 6]]) assert.equal(installed.filter(row => row.contype === kind).length, count);
        assert.equal((await sql`select indexname from pg_indexes where schemaname='public' and tablename in ('evaluation_templates','evaluation_template_criteria')`).length, 4);
        const reconnect = connect(state); try { await verify(reconnect, state, state.database); assert.equal((await reconnect`select * from drizzle.__drizzle_migrations`).length, 22); } finally { await reconnect.end(); }
        state.checks.push('0021 applied once after exact 21-entry baseline; 22-entry durable ledger; keys/checks/indexes; existing columns/constraints preserved'); save(state);
        console.log('PASS migration: 0021 applied once on the empty owned database; durable ledger/catalog and historical structures verified.');
        }
        const Module = require('node:module'), originalLoad = Module._load;
        const schema = require('../db/schema/index.ts');
        if (phase === 'database') {
        const passwordHash = await require('bcrypt').hash(state.loginPassword, 12);
        await sql`insert into role(id,name) values(1,'Admin'),(2,'Adviser'),(3,'Student'),(4,'Panel')`;
        for (const [id, role] of [[1, 2], [2, 2], [3, 1], [4, 3], [5, 4]]) await sql`insert into users(id,first_name,last_name,email,password,role_id,is_active) values(${id},'Disposable',${'E1B '+id},${'e1bv1-'+id+'@example.invalid'},${passwordHash},${role},true)`;
        await sql`update main_adviser_designation set main_adviser_id=1,updated_by=3,revision=1 where id=1`;
        await sql.unsafe(`create role e1bv1_runtime login nosuperuser nocreatedb nocreaterole noreplication nobypassrls password '${state.runtimePassword}'`);
        await sql`revoke create on schema public from public`;
        await sql`grant connect on database ${sql(state.database)} to e1bv1_runtime`;
        await sql`grant usage on schema public to e1bv1_runtime`;
        await sql`grant select on all tables in schema public to e1bv1_runtime`;
        await sql`grant update(updated_at) on users to e1bv1_runtime`;
        await sql`grant update(revision) on main_adviser_designation to e1bv1_runtime`;
        await sql`grant insert,update on evaluation_templates to e1bv1_runtime`;
        await sql`grant insert,delete on evaluation_template_criteria to e1bv1_runtime`;
        await sql`grant insert on activity_logs to e1bv1_runtime`;
        await sql`grant usage on sequence evaluation_templates_id_seq,activity_logs_id_seq to e1bv1_runtime`;
        } else {
            assert.ok(state.checks.some(check => check.startsWith('0021 applied once')));
            assert.equal((await sql`select * from drizzle.__drizzle_migrations`).length, 22);
            assert.equal((await sql`select id from users where email like 'e1bv1-%@example.invalid'`).length, 5);
        }
        runtime = connect(state, state.database, true); const db = drizzle(runtime, { schema });
        assert.equal((await runtime`select current_user as actor`)[0].actor, 'e1bv1_runtime');
        let actor = { userId: 1, roleId: 2 };
        Module._load = function(id, ...rest) {
            if (id === 'server-only' || id === 'dotenv/config') return {};
            if (id === '@/lib/db') return { db };
            if (id === '@/lib/auth/main-adviser') return { getCurrentMainAdviser: async () => actor };
            if (id === 'next/cache') return { revalidatePath() {} };
            assert.ok(!/^(dotenv|@supabase\/supabase-js)$/.test(id), 'External adapter forbidden');
            return originalLoad.call(this, id, ...rest);
        };
        try {
            const { createEvaluationTemplateRepository } = require('../lib/repositories/evaluation-template.repository.ts');
            const { createEvaluationTemplateService } = require('../lib/services/evaluation-template.service.ts');
            const actions = require('../lib/actions/evaluation-template.action.ts');
            const repo = createEvaluationTemplateRepository(db), service = createEvaluationTemplateService(repo, async () => actor);
            const draft = size => ({ name: 'Disposable template '+size, scale: { version: 1, levels: Array.from({ length: size }, (_, i) => ({ points: i+1, label: 'Rating '+(i+1), description: '' })) }, criteria: ['Method','Evidence'].map((name, position) => ({ key: randomUUID(), position, name, description: 'Disposable only', allowsNa: false })) });
            let row, copy;
            if (phase === 'database') {
            const created = [];
            for (const size of [3, 4, 5]) { const result = await actions.mutateEvaluationTemplateAction({ operation: 'create', draft: draft(size) }); assert.equal(result.success, true, 'Create '+size+'-level template: '+result.message); created.push(result.data); }
            row = created[0]; assert.equal((await service.read({ templateId: row.id })).data.scale.levels.length, 3);
            const reordered = { ...draft(5), name: 'Renamed template', criteria: [...row.criteria].reverse().map((item, position) => ({ ...item, position, allowsNa: true })) };
            row = (await service.mutate({ operation: 'update', templateId: row.id, expectedRevision: row.revision, draft: reordered })).data;
            assert.ok(row); assert.equal(row.criteria[0].name, 'Evidence'); assert.equal(row.criteria[0].allowsNa, true); assert.equal(row.scale.levels.length, 5);
            copy = (await service.mutate({ operation: 'duplicate', templateId: row.id, expectedRevision: row.revision })).data;
            assert.ok(copy); assert.notEqual(copy.id, row.id); assert.notEqual(copy.criteria[0].key, row.criteria[0].key);
            assert.equal((await sql`select owner_id from evaluation_templates where id=${copy.id}`)[0].owner_id, 1);
            await service.mutate({ operation: 'update', templateId: copy.id, expectedRevision: copy.revision, draft: { ...draft(3), name: 'Changed copy' } });
            assert.equal((await service.read({ templateId: row.id })).data.name, 'Renamed template');
            } else {
                const rows = await service.list({ includeArchived: true }); assert.equal(rows.data.length, 4);
                row = rows.data.find(item => item.name === 'Renamed template'); copy = rows.data.find(item => item.name === 'Changed copy');
                assert.ok(row); assert.ok(copy); assert.equal(row.scale.levels.length, 5); assert.equal(row.criteria[0].name, 'Evidence');
            }
            const invalid = draft(4); invalid.scale.levels[1].points = 4;
            assert.equal((await service.mutate({ operation: 'update', templateId: row.id, expectedRevision: row.revision, draft: invalid })).kind, 'validation');
            await assert.rejects(runtime`update evaluation_templates set scale=${JSON.stringify(invalid.scale)}::jsonb where id=${row.id}`, error => error.code === '23514');
            assert.equal((await service.read({ templateId: row.id })).data.revision, row.revision);
            const concurrentDraft = { name: row.name, scale: row.scale, criteria: row.criteria };
            const concurrent = await Promise.all(['Concurrent A','Concurrent B'].map(name => service.mutate({ operation: 'update', templateId: row.id, expectedRevision: row.revision, draft: { ...concurrentDraft, name } })));
            assert.equal(concurrent.filter(result => result.success).length, 1); assert.equal(concurrent.filter(result => result.kind === 'stale').length, 1);
            row = (await service.read({ templateId: row.id })).data;
            const prior = structuredClone(row), auditCount = Number((await sql`select count(*) as count from activity_logs`)[0].count);
            await sql`alter table evaluation_template_criteria add constraint e1bv1_injected_failure check (name <> 'E1B_V1_ROLLBACK')`;
            const fail = draft(3); fail.criteria[1].name = 'E1B_V1_ROLLBACK';
            assert.equal((await service.mutate({ operation: 'update', templateId: row.id, expectedRevision: row.revision, draft: fail })).success, false);
            assert.deepEqual((await service.read({ templateId: row.id })).data, prior); assert.equal(Number((await sql`select count(*) as count from activity_logs`)[0].count), auditCount);
            await sql`alter table evaluation_template_criteria drop constraint e1bv1_injected_failure`;
            assert.equal((await service.mutate({ operation: 'archive', templateId: row.id, expectedRevision: row.revision })).success, true);
            assert.ok(!(await service.list({})).data.some(item => item.id === row.id));
            for (const operation of ['update','duplicate']) assert.equal((await service.mutate({ operation, templateId: row.id, expectedRevision: row.revision+1, ...(operation === 'update' ? { draft: draft(4) } : {}) })).success, false);
            await assert.rejects(runtime`delete from evaluation_templates where id=${copy.id}`, error => error.code === '42501');
            state.checks.push('runtime create/read/edit/order/N/A, 3/4/5 scales, invalid scale CHECK, independent duplicate, archive, stale concurrency, atomic rollback and header DELETE denial');
            for (const [userId, roleId] of [[2,2],[3,1],[4,3],[5,4]]) {
                actor = { userId, roleId }; assert.equal((await actions.mutateEvaluationTemplateAction({ operation: 'create', draft: draft(4) })).success, false);
                assert.equal((await actions.readEvaluationTemplateAction({ templateId: copy.id })).success, false);
            }
            await sql`update main_adviser_designation set main_adviser_id=2,revision=revision+1 where id=1`;
            actor = { userId: 1, roleId: 2 }; assert.equal((await service.mutate({ operation: 'create', draft: draft(4) })).success, false);
            actor = { userId: 2, roleId: 2 }; assert.equal((await service.list({})).data.length, 0);
            for (const operation of ['read','duplicate','update','archive']) {
                const result = operation === 'read' ? await service.read({ templateId: copy.id }) : await service.mutate({ operation, templateId: copy.id, expectedRevision: 1, ...(operation === 'update' ? { draft: draft(4) } : {}) });
                assert.equal(result.success, false);
            }
            await sql`update main_adviser_designation set main_adviser_id=1,revision=revision+1 where id=1`;
            actor = { userId: 1, roleId: 2 }; await sql`update users set is_active=false where id=1`;
            assert.equal((await service.mutate({ operation: 'create', draft: draft(4) })).success, false); await sql`update users set is_active=true where id=1`;
            state.checks.push('service/action and real transaction role, inactive/former Main, successor-private ownership denial; no sharing');
            state.databasePass = true; save(state); console.log('PASS real persistence, constrained runtime privileges, authorization, concurrency and rollback.');
        } finally { Module._load = originalLoad; }
    } finally { await runtime?.end(); await sql.end(); }
}
async function cleanup() {
    const state = read();
    assert.equal(state.nextPid, undefined, 'Owned browser server must finish first');
    await freePort(3057);
    if (!state.cleaned && (state.started || fs.existsSync(path.join(state.directory, 'postmaster.pid')))) {
        const admin = connect(state, 'postgres');
        try { await verify(admin, state, 'postgres'); await admin`drop database if exists ${admin(state.database)}`; } finally { await admin.end(); }
        binary('pg_ctl', ['-D', state.directory, '-w', '-m', 'fast', 'stop']);
    }
    await freePort(state.port);
    owned(state);
    if (fs.existsSync(state.directory)) { assert.equal(fs.lstatSync(state.directory).isSymbolicLink(), false); fs.rmSync(state.directory, { recursive: true }); }
    const home = path.join(root, state.run), app = path.join(home, 'application'), modules = path.join(app, 'node_modules');
    if (fs.existsSync(app)) {
        assert.equal(fs.lstatSync(app).isSymbolicLink(), false);
        if (fs.existsSync(modules)) {
            assert.equal(fs.lstatSync(modules).isSymbolicLink(), true);
            assert.equal(fs.realpathSync(modules), fs.realpathSync('node_modules'));
            fs.rmSync(modules, { recursive: true }); // Remove the junction itself, never its target.
        }
        fs.rmSync(app, { recursive: true });
    }
    const prefix = path.join(home, 'prefix');
    if (fs.existsSync(prefix)) { assert.equal(fs.lstatSync(prefix).isSymbolicLink(), false); fs.rmSync(prefix, { recursive: true }); }
    for (const name of ['font-fallback.cjs','network-guard.cjs']) if (fs.existsSync(path.join(home, name))) fs.unlinkSync(path.join(home, name));
    for (const key of ['operatorPassword','runtimePassword','jwt','loginPassword']) delete state[key];
    state.cleaned = true; state.started = false; save(state);
    console.log('PASS cleanup: owned database/cluster, application copy and dependency junction removed; ports free; secrets erased from run manifest.');
}
async function main() {
    if (phase === 'setup') await setup();
    else if (phase === 'resume-setup') { const state = read(); assert.ok(state.cluster); assert.equal(state.started, undefined); await completeSetup(state); }
    else if (phase === 'database' || phase === 'resume-persistence') await database();
    else if (phase === 'browser') { const state = read(); assert.equal(state.databasePass, true); const sql = connect(state); try { await verify(sql, state, state.database); } finally { await sql.end(); } await require('./e1b-v1-authenticated.browser.cjs').run({ state, root, save, verify, connect }); }
    else if (phase === 'cleanup') await cleanup();
    else throw Error('Unknown validation phase');
}
main().catch(error => { console.error('E1B-V1 phase '+phase+' failed: '+String(error.message || error)); process.exitCode = 1; });
