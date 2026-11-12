import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startServer, type RunningServer } from '../../src/start.js';
import { tempDir } from '../helpers/tmp.js';

let data: { dir: string; cleanup: () => Promise<void> };
let running: RunningServer | null = null;

beforeEach(async () => {
  data = await tempDir();
});

afterEach(async () => {
  if (running) await running.close().catch(() => undefined);
  running = null;
  await data.cleanup();
});

describe('startServer', () => {
  it('starts on a free port, serves the API, and stops on close()', async () => {
    running = await startServer({ PORT: '0', ECHO_WEB_DATA: data.dir, LOG_LEVEL: 'silent' });
    expect(running.port).toBeGreaterThan(0);
    expect(running.url).toBe(`http://127.0.0.1:${running.port}`);

    const url = `${running.url}/api/settings`;
    const ok = await fetch(url);
    expect(ok.status).toBe(200);

    await running.close();
    running = null;
    await expect(fetch(url)).rejects.toThrow();
  });

  it('rejects when the port is already in use', async () => {
    running = await startServer({ PORT: '0', ECHO_WEB_DATA: data.dir, LOG_LEVEL: 'silent' });
    await expect(
      startServer({ PORT: String(running.port), ECHO_WEB_DATA: data.dir, LOG_LEVEL: 'silent' }),
    ).rejects.toThrow();
  });
});
