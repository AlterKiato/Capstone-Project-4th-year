/* eslint-disable @typescript-eslint/no-require-imports */
// Owned development server; shutdown only via the parent's unguessable IPC nonce.
const [port, nonce] = process.argv.slice(2);
if (!/^\d+$/.test(port) || !nonce || !process.send) throw Error('Owned server arguments required');
process.on('message', message => {
    if (message?.type !== 'phase96-shutdown' || message.nonce !== nonce) return;
    if (process.listenerCount('SIGTERM')) process.emit('SIGTERM', 'SIGTERM'); else process.exit(1);
});
process.argv = [process.execPath, require.resolve('next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', port];
require('next/dist/bin/next');
