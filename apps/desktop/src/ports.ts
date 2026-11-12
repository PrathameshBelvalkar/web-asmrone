import { createServer } from 'node:net';

/** The fixed port the UI's localStorage belongs to (origin http://127.0.0.1:<port>). */
export const FIXED_PORTS = Array.from({ length: 10 }, (_, i) => 47610 + i);

/** True when nothing is listening on the port on this machine. */
function isFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => {
      server.close(() => resolve(true));
    });
  });
}

/** Any free port chosen by the system. */
function anyFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

/**
 * The first free port of the fixed range. A fixed port keeps the UI's saved queue and settings
 * (stored per origin) across restarts. Falls back to any free port when all ten are busy.
 */
export async function pickPort(): Promise<number> {
  for (const port of FIXED_PORTS) {
    if (await isFree(port)) return port;
  }
  return anyFreePort();
}
