/* eslint-disable @typescript-eslint/no-require-imports */
// Explicit E1D validation on a NEW owned cluster. Never reads .env or existing connection settings.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { execFileSync } = require('node:child_process'), { randomUUID, randomBytes } = require('node:crypto');
const postgres = require('postgres');
const root = path.resolve('test-results/e1d'), bin = 'C:/Program Files/PostgreSQL/18/bin';
const args = process.argv.slice(2);
assert.equal(args[0], '--execute', 'Explicit execution required');
const phase = args[1], manifestPath = path.join(root, 'current-run.json');
const binary = (name, parameters) => execFileSync(path.join(bin, name + '.exe'), parameters, { windowsHide: true, encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] });
function owned(state) {
    assert.match(state.run, /^[a-f0-9]{32}$/);
    assert.equal(state.directory, path.join(root, state.run, 'pgdata'));
    assert.ok(path.resolve(state.directory).startsWith(root + path.sep));
    assert.equal(state.port, 55452); assert.equal(state.operator, 'e1d_operator'); assert.match(state.database, /^e1d_[a-f0-9]{32}$/);
    assert.equal(fs.readFileSync(path.join(root, state.run, 'owner'), 'utf8'), state.run);
    assert.equal(state.database, 'e1d_' + state.run);
    for (const folder of [root,path.join(root,state.run)]) assert.equal(fs.lstatSync(folder).isSymbolicLink(), false);
    assert.equal(fs.realpathSync(path.join(root,state.run)),path.join(fs.realpathSync(root),state.run));
}
const save = state => fs.writeFileSync(manifestPath, JSON.stringify(state), { mode: 0o600 });
function read() { const state = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); owned(state); return state; }
function connect(state, database = state.database, runtime = false) {
    return postgres({ host: '127.0.0.1', port: state.port, database, username: runtime ? 'e1d_runtime' : state.operator,
        password: runtime ? state.runtimePassword : state.operatorPassword, ssl: false, max: 4, connect_timeout: 5, idle_timeout: 5,
        onnotice: () => {}, connection: { application_name: 'e1d_disposable', statement_timeout: 10000, lock_timeout: 4000 } });
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
    console.log('PASS safety: newly initialized task-owned PostgreSQL 18 cluster on 127.0.0.1:55452; control-file and SQL identity match. No existing database used.');
}
async function setup() {
    if (fs.existsSync(manifestPath)) assert.equal(JSON.parse(fs.readFileSync(manifestPath)).cleaned, true, 'Prior owned validation must be cleaned first');
    await freePort(55452); await freePort(3062);
    const run = randomUUID().replaceAll('-', ''), home = path.join(root, run);
    fs.mkdirSync(home, { recursive: true }); fs.writeFileSync(path.join(home, 'owner'), run, { flag: 'wx' });
    const state = { run, directory: path.join(home, 'pgdata'), port: 55452, operator: 'e1d_operator', database: 'e1d_' + run,
        operatorPassword: randomBytes(24).toString('hex'), runtimePassword: randomBytes(24).toString('hex'), jwt: randomBytes(48).toString('hex'), loginPassword: randomBytes(20).toString('hex'), checks: [] };
    save(state);
    const passwordFile = path.join(home, 'init-password'); fs.writeFileSync(passwordFile, state.operatorPassword, { mode: 0o600, flag: 'wx' });
    try {
        assert.equal(fs.existsSync(state.directory), false);
        binary('initdb', ['-D', state.directory, '--username=' + state.operator, '--auth-host=scram-sha-256', '--auth-local=trust', '--encoding=UTF8', '--locale=C', '--pwfile=' + passwordFile]);
        state.cluster = binary('pg_controldata', [state.directory]).match(/Database system identifier:\s*(\d+)/)?.[1]; assert.ok(state.cluster); save(state);
        try { binary('pg_ctl', ['-D', state.directory, '-l', path.join(home, 'postgres.log'), '-o', '-h 127.0.0.1 -p 55452 -c max_connections=20 -c shared_buffers=32MB', '-w', 'start']); }
        catch (error) { if (error.code !== 'ETIMEDOUT') throw error; } // Read-only identity checks decide whether the owned server actually started.
        await completeSetup(state);
    } finally { fs.unlinkSync(passwordFile); }
}
async function cleanup() {
    const state = read();
    assert.equal(state.nextPid, undefined, 'Owned browser server must finish first');
    await freePort(3062);
    if (!state.cleaned && (state.started || fs.existsSync(path.join(state.directory, 'postmaster.pid')))) {
        const admin = connect(state, 'postgres');
        try { await verify(admin, state, 'postgres');
            const [database] = await admin`select oid::text as oid,pg_get_userbyid(datdba) as owner from pg_database where datname=${state.database}`;
            if (database) {
                assert.equal(database.oid,state.databaseOid);assert.equal(database.owner,state.operator);
                await admin`drop database ${admin(state.database)}`;
            }
            // A prior cleanup may have dropped this exact DB before Windows denied pg_ctl's stop signal.
            assert.equal((await admin`select 1 from pg_database where datname=${state.database}`).length,0);
            state.databaseDropped=true;save(state);
        } finally { await admin.end(); }
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
            fs.unlinkSync(modules); // Unlink the verified junction itself; never traverse its dependency target.
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

async function main(){if(phase==='setup')await setup();else if(phase==='resume-setup'){const s=read();assert.ok(s.cluster);assert.equal(s.started,undefined);await completeSetup(s);}else if(phase==='database')await require('./e1d-postgres.cjs').run({state:read(),root,save,verify,connect});else if(phase==='cleanup')await cleanup();else throw Error('Unknown phase');}
main().catch(e=>{console.error('E1D '+phase+' failed: '+String(e.message||e));process.exitCode=1});
