import { Socket } from 'net';
import { TLSSocket, connect, TLSSocketOptions } from 'tls';

/**
 * Upgrades a regular socket to a TLSSocket.
 * @param socket
 * @param options
 * @returns Upgraded socket.
 */
export function upgradeSocket(
  socket: Socket,
  socketOptions?: TLSSocketOptions
): Promise<TLSSocket> {
  const events: any = {};

  // Remove event listeners to ensure the data listener is not called with garbage.
  // Those will be reattached later to the upgraded socket.
  for (const eventName of socket.eventNames()) {
    events[eventName] = [];
    const listeners = socket.listeners(eventName);

    for (const listener of listeners) {
      events[eventName].push(listener);
    }

    socket.removeAllListeners(eventName);
  }

  return new Promise((resolve, reject) => {
    const error = (err: any) => {
      // Reattach event listeners to the original socket.
      for (const eventName of Object.keys(events)) {
        for (const listener of events[eventName]) {
          socket.addListener(eventName, listener);
        }
      }

      reject(err);
    };

    const isServer = !!(socket as any).server;
    const tlsSocket = isServer
      ? new TLSSocket(socket, {
          isServer: true,
          ...socketOptions,
        })
      : connect({
          socket,
          ...socketOptions,
        });

    // If we get an error here or the socket is closed,
    // it's almost definitely due to the upgrade failing.
    tlsSocket.once('error', err => error(err));
    tlsSocket.once('close', () =>
      error(new Error('Socket closed unexpectedly.'))
    );

    tlsSocket.once(isServer ? 'secure' : 'secureConnect', () => {
      // Ensure the socket is secure.
      if (!isUpgraded(tlsSocket)) {
        error(new Error('Unable to upgrade socket.'));
        return;
      }

      // Ensure all the temporary listeners are removed.
      tlsSocket.removeAllListeners('error');
      tlsSocket.removeAllListeners('close');

      // Reattach event listeners to the upgraded socket.
      for (const eventName of Object.keys(events)) {
        for (const listener of events[eventName]) {
          tlsSocket.addListener(eventName, listener);
        }
      }

      resolve(tlsSocket);
    });
  });
}

/**
 * Determine whether the socket provided is secure or not.
 * @param socket
 * @returns
 */
export function isUpgraded(socket: Socket): boolean {
  return socket instanceof TLSSocket && socket.encrypted;
}
