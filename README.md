<h1 align="center">
@typemail/starttls
</h1>

<p align="center">
<img alt="workflow" src="https://img.shields.io/github/workflow/status/typemail/starttls/Tests">
<a href="https://npmjs.com/package/@typemail/starttls">
<img alt="npm" src="https://img.shields.io/npm/v/@typemail/starttls">
<img alt="npm" src="https://img.shields.io/npm/dw/@typemail/starttls">
<img alt="NPM" src="https://img.shields.io/npm/l/@typemail/starttls">
</a>
</p>

@typemail/starttls is a very simple library designed for upgrading a net.Socket from cleartext to TLS.

The main usecase for this is the implementation of STARTTLS in various protocols, including SMTP, IMAP, POP3, XMPP, NNTP, IRC, and FTP.

## Example

```ts
import { createServer, connect } from 'net';
import { SecureContextOptions, createSecureContext } from 'tls';
import { readFileSync } from 'fs';
import { upgradeSocket } from '@typemail/starttls';

// Load certificates for your server connections.
const secureContext = createSecureContext({
  key: readFileSync('./__tests__/cert/server.key'),
  cert: readFileSync('./__tests__/cert/server.cert'),
});

const server = createServer(socket => {
  // Let's simulate a negotiation, where the server begins it and the client *has* to accept.
  socket.write('STARTTLS', 'ascii', async () => {
    socket = await upgradeSocket(socket, {
      secureContext,
    });

    // The socket is now guaranteed to be secure.
    // To verify, use isUpgraded() from @typemail/starttls.
    // In case of any issues, the Promise will reject.

    // Write SECURE to close the socket.
    socket.write('SECURE');
  });
});

server.listen(2222, '127.0.0.1');

// Client part begins here:
let client = connect({
  host: '127.0.0.1',
  port: 2222,
});

client.on('data', async data => {
  const string = data.toString();
  if (string === 'STARTTLS') {
    client = await upgradeSocket(client, {
      rejectUnauthorized: false,
    });

    // The socket is now guaranteed to be secure.
    // In case of any issues, the Promise will reject.
  } else if (string === 'SECURE') {
    // We're in a secure socket.
    // To verify, use isUpgraded() from @typemail/starttls.
    client.destroy();
  }
});
```

## API

```ts
/**
 * Upgrades a regular socket to a TLSSocket.
 * @returns Upgraded socket.
 */
function upgradeSocket(
  socket: Socket,
  options?: TLSSocketOptions
): Promise<TLSSocket>;

/**
 * Determine whether the socket provided is secure or not.
 */
function isUpgraded(socket: Socket): boolean;
```
