/* eslint-disable @typescript-eslint/no-require-imports */
// IPC is needed because Windows ChildProcess.kill('SIGTERM') is not graceful.
const [port, nonce] = process.argv.slice(2);
if (!/^\d+$/.test(port) || !nonce || !process.send) throw new Error('Owned server arguments required');
process.on('message', message => {
    if (message?.type !== 'phase96-shutdown' || message.nonce !== nonce) return;
    if (process.listenerCount('SIGTERM')) process.emit('SIGTERM', 'SIGTERM');
    else process.exit(1); // Still booting; no ready application server exists.
});
const cli = require.resolve('next/dist/bin/next');
process.argv = [process.execPath, cli, 'start', '--hostname', '127.0.0.1', '--port', port];
require(cli);
