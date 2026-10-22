/* eslint-disable @typescript-eslint/no-require-imports */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const cache = path.resolve(__dirname, '../node_modules/.cache/thesishs-mailpit');
const executable = path.join(cache, 'v1.31.6/mailpit.exe');

function startLocalMailpit(database = path.join(cache, 'inbox.sqlite')) {
    if (process.platform !== 'win32' || !fs.existsSync(executable)) throw Error('Workspace Mailpit v1.31.6 is not installed. See the local verification setup.');
    const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith('MP_')));
    // Explicit loopback binds and no relay/forward/webhook configuration or inherited MP_* settings.
    return spawn(executable, ['--smtp', '127.0.0.1:1025', '--listen', '127.0.0.1:8025',
        '--allowed-hosts', '127.0.0.1,localhost', '--database', database, '--disable-version-check',
        '--smtp-disable-rdns', '--block-remote-css-and-fonts', '--quiet',
        '--smtp-allowed-recipients', '@[a-zA-Z0-9.-]+\\.invalid$',
        '--smtp-relay-all=false', '--smtp-relay-config=', '--smtp-relay-matching=', '--smtp-forward-config=', '--webhook-url='],
    { windowsHide: true, env: environment, stdio: ['ignore', 'pipe', 'pipe'] });
}

if (require.main === module) {
    const child = startLocalMailpit();
    child.once('spawn', () => console.log('Local Mailpit: SMTP 127.0.0.1:1025; inbox http://127.0.0.1:8025; synthetic recipients only.'));
    child.once('error', () => { console.error('Local Mailpit could not start.'); process.exitCode = 1; });
    // Quiet output is deliberately not forwarded; messages can contain temporary credentials.
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { child.kill(); });
    child.once('exit', code => {
        if (code) console.error('Local Mailpit stopped. Check that loopback ports 1025 and 8025 are available.');
        process.exitCode = code || 0;
    });
}
module.exports = { startLocalMailpit, cache, executable };
