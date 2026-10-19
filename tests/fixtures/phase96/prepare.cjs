/* eslint-disable @typescript-eslint/no-require-imports */
const { run, sha256 } = require('./fixture-core.cjs');

function main(args = process.argv.slice(2)) {
    const mode = args[0] || 'inspect';
    // Reject provisioning before reading .env, migrations, or loading any adapter.
    if (mode === 'provision') throw new Error('PROVISIONING_NOT_AUTHORIZED');
    if (args.length > 1 || !['inspect', 'dry-run'].includes(mode)) throw new Error('UNKNOWN_MODE');
    const fs = require('node:fs');
    const path = require('node:path');
    const root = path.resolve(__dirname, '../../..');
    // Match existing CLI convention: .env plus process environment overrides.
    // Parsing does not mutate process.env or print dotenv diagnostics.
    const envFile = path.join(root, '.env');
    const local = fs.existsSync(envFile) ? require('dotenv').parse(fs.readFileSync(envFile)) : {};
    const env = { ...local, ...process.env };
    const directory = path.join(root, 'db/migrations');
    const journal = JSON.parse(fs.readFileSync(path.join(directory, 'meta/_journal.json'), 'utf8'));
    if (journal.entries.length !== 12 || journal.entries.some((entry, i) =>
        entry.idx !== i || !new RegExp('^' + String(i).padStart(4, '0') + '_[a-z0-9_]+$').test(entry.tag)))
        throw new Error('MIGRATION_SOURCE_MISMATCH');
    const hashes = journal.entries.map(entry => sha256(fs.readFileSync(path.join(directory, entry.tag + '.sql'))));
    return run(mode, env, hashes);
}

if (require.main === module) {
    try { process.stdout.write(JSON.stringify(main(), null, 2) + '\n'); }
    catch (error) {
        // Never serialize arbitrary parser/OS errors, stacks, URLs or input values.
        const code = /^[A-Z][A-Z_]+$/.test(error.message) ? error.message : 'OFFLINE_INSPECTION_FAILED';
        process.stderr.write(code + '\n'); process.exitCode = 1;
    }
}
module.exports = { main };
