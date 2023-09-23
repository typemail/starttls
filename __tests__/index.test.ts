import { createServer, Socket, connect } from 'net';
import { TLSSocket, SecureContextOptions } from 'tls';
import { readFileSync } from 'fs';

import { upgradeSocket, isUpgraded } from '../src/index.js';

const options: SecureContextOptions = {
  key: readFileSync('./__tests__/cert/server.key'),
  cert: readFileSync('./__tests__/cert/server.cert'),
};

const runTest = (
  port: number,
  clientFactory: (port: number) => Socket,
  forceError: boolean,
  done: () => void
) => {
  const receivedTest = jest.fn();
  const receivedSecure = jest.fn();

  const server = createServer(socket => {
    expect(isUpgraded(socket)).toBe(false);

    socket.write('TEST', 'ascii', async () => {
      try {
        socket = await upgradeSocket(socket, {
          ...options,
        });
        expect(isUpgraded(socket)).toBe(true);
      } catch (err) {
        if (forceError) {
          expect(err).toBeTruthy();
          expect(isUpgraded(socket)).toBe(false);
          client.destroy();
        } else {
          throw err;
        }
      }

      socket.write('SECURE');
    });
  });

  server.listen(port, '127.0.0.1');

  let client = clientFactory(port);

  expect(isUpgraded(client)).toBe(false);

  client.on('data', async data => {
    const string = data.toString();
    if (string === 'TEST') {
      receivedTest();
      try {
        client = await upgradeSocket(client, {
          rejectUnauthorized: forceError,
        });
        expect(isUpgraded(client)).toBe(true);
      } catch (err) {
        if (forceError) {
          expect(err).toBeTruthy();
          expect(isUpgraded(client)).toBe(false);
          client.destroy();
        } else {
          throw err;
        }
      }
    } else if (string === 'SECURE') {
      receivedSecure();
      client.destroy();
    }
  });

  client.on('close', () => {
    expect(receivedTest).toBeCalledTimes(1);
    expect(receivedSecure).toBeCalledTimes(forceError ? 0 : 1);
    server.close();

    done();
  });
};

describe('upgradeSocket', () => {
  it('upgrades when client is created with connect', done => {
    runTest(
      2222,
      port =>
        connect({
          host: '127.0.0.1',
          port: port,
        }),
      false,
      done
    );
  });

  it('upgrades when client is created with new Socket', done => {
    runTest(
      2223,
      port => {
        const client = new Socket();
        client.connect({
          host: '127.0.0.1',
          port: port,
        });
        return client;
      },
      false,
      done
    );
  });

  it('handles errors properly', done => {
    runTest(
      2222,
      port =>
        connect({
          host: '127.0.0.1',
          port: port,
        }),
      true,
      done
    );
  });
});

describe('isUpgraded', () => {
  it('returns false for a new Socket', () => {
    expect(isUpgraded(new Socket())).toBe(false);
  });

  it('returns true for a new TLSSocket', () => {
    expect(isUpgraded(new TLSSocket(new Socket()))).toBe(true);
  });
});
