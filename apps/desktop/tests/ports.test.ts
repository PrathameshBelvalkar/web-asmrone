import { createServer, type Server } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { pickPort } from '../src/ports';

const held: Server[] = [];

afterEach(async () => {
  await Promise.all(held.splice(0).map((s) => new Promise<void>((resolve) => s.close(() => resolve()))));
});

function hold(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      held.push(server);
      resolve();
    });
  });
}

describe('pickPort', () => {
  it('returns the first fixed port when it is free', async () => {
    expect(await pickPort()).toBe(47610);
  });

  it('returns the next fixed port when the first is taken', async () => {
    await hold(47610);
    expect(await pickPort()).toBe(47611);
  });
});
