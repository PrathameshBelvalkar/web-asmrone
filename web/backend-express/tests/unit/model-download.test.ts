import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ModelEntry } from '../../src/config/model-catalog.js';
import {
  ModelDownloadService,
  type DownloadState,
} from '../../src/services/tools/model-download.service.js';
import { tempDir } from '../helpers/tmp.js';

const BYTES = Buffer.from(Array.from({ length: 4000 }, (_, i) => i % 251));
const HALF = 2000;
const sha = (b: Buffer): string => createHash('sha256').update(b).digest('hex');

const MODEL: ModelEntry = {
  id: 'test-model',
  title: 'Test',
  note: '',
  file: 'test-model.bin',
  url: 'https://example.test/model.bin',
  sha256: sha(BYTES),
  size: BYTES.length,
};
const VAD_BYTES = Buffer.from('vad-data');
const VAD: ModelEntry = {
  id: 'vad',
  title: 'VAD',
  note: '',
  file: 'vad.bin',
  url: 'https://example.test/vad.bin',
  sha256: sha(VAD_BYTES),
  size: VAD_BYTES.length,
};

interface Call {
  readonly url: string;
  readonly range: string | undefined;
}

/** A response whose body is `parts` in order, then either ends or fails with `error`. */
function reply(
  status: number,
  parts: Buffer[],
  options: { error?: string; hold?: boolean; signal?: AbortSignal } = {},
): Response {
  // Pull-based with no read-ahead: each part is delivered before the error or end. (An errored
  // stream drops chunks it has queued, which would not model a connection that sent some bytes.)
  const queue = [...parts];
  let stream: ReadableStreamDefaultController<Uint8Array> | undefined;
  // A real fetch body fails when its request is aborted; a held body must do the same.
  options.signal?.addEventListener('abort', () => {
    stream?.error(new DOMException('aborted', 'AbortError'));
  });
  const body = new ReadableStream<Uint8Array>(
    {
      start(controller) {
        stream = controller;
      },
      pull(controller) {
        const next = queue.shift();
        if (next) controller.enqueue(new Uint8Array(next));
        else if (options.error) controller.error(new Error(options.error));
        else if (!options.hold) controller.close();
      },
    },
    { highWaterMark: 0 },
  );
  return new Response(body, { status });
}

let t: { dir: string; cleanup: () => Promise<void> };
let calls: Call[];
let installed: ModelEntry[];
let service: ModelDownloadService | null;
let script: (call: number, init: RequestInit) => Response | Promise<Response>;

function fakeFetch(url: string | URL | Request, init?: RequestInit): Promise<Response> {
  // Like a real fetch: a request whose signal is already aborted never starts.
  if (init?.signal?.aborted) return Promise.reject(new DOMException('aborted', 'AbortError'));
  const href = urlOf(url);
  const call = calls.length;
  calls.push({ url: href, range: new Headers(init?.headers).get('Range') ?? undefined });
  if (href === VAD.url) return Promise.resolve(reply(200, [VAD_BYTES]));
  return Promise.resolve(script(call, init ?? {}));
}

function makeService(
  overrides: {
    freeSpace?: (dir: string) => Promise<number>;
    onInstalled?: (id: string) => Promise<void>;
  } = {},
): ModelDownloadService {
  service = new ModelDownloadService({
    modelsDir: join(t.dir, 'models'),
    fetch: fakeFetch,
    models: [MODEL],
    vad: VAD,
    sleep: () => Promise.resolve(),
    freeSpace: overrides.freeSpace ?? (() => Promise.resolve(10 * 1024 * 1024 * 1024)),
    onInstalled:
      overrides.onInstalled ??
      ((id) => {
        installed.push({ ...MODEL, id });
        return Promise.resolve();
      }),
  });
  return service;
}

async function waitUntil(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('timed out waiting for the download state');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

function urlOf(input: string | URL | Request): string {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.href : input.url;
}

const finished = (s: DownloadState): boolean => s.status === 'idle' || s.status === 'failed';
const modelPath = (): string => join(t.dir, 'models', MODEL.file);
const partPath = (): string => `${modelPath()}.part`;

beforeEach(async () => {
  t = await tempDir();
  calls = [];
  installed = [];
  service = null;
  script = () => reply(200, [BYTES]);
  // The VAD file is already in place, so only the model is fetched.
  await mkdir(join(t.dir, 'models'), { recursive: true });
  await writeFile(join(t.dir, 'models', VAD.file), VAD_BYTES);
});

afterEach(async () => {
  service?.close();
  await t.cleanup();
});

describe('ModelDownloadService', () => {
  it('downloads a model, checks it and reports it installed', async () => {
    const svc = makeService();
    await svc.start(MODEL.id);
    await waitUntil(() => finished(svc.state()));

    expect(svc.state()).toEqual({ status: 'idle' });
    expect(await readFile(modelPath())).toEqual(BYTES);
    expect(installed.map((m) => m.id)).toEqual([MODEL.id]);
    expect(calls.find((c) => c.url === MODEL.url)?.range).toBeUndefined();
  });

  it('resumes a partial file with a Range request when the server answers 206', async () => {
    await writeFile(partPath(), BYTES.subarray(0, HALF));
    script = () => reply(206, [BYTES.subarray(HALF)]);
    const svc = makeService();
    await svc.start(MODEL.id);
    await waitUntil(() => finished(svc.state()));

    expect(calls.find((c) => c.url === MODEL.url)?.range).toBe(`bytes=${HALF}-`);
    expect(await readFile(modelPath())).toEqual(BYTES);
  });

  it('starts again from zero when the server ignores the range (200)', async () => {
    await writeFile(partPath(), BYTES.subarray(0, HALF));
    script = () => reply(200, [BYTES]);
    const svc = makeService();
    await svc.start(MODEL.id);
    await waitUntil(() => finished(svc.state()));

    expect(await readFile(modelPath())).toEqual(BYTES);
  });

  it('deletes the file and fails when the checksum does not match', async () => {
    const wrong = Buffer.from(BYTES);
    wrong[10] = (wrong[10] ?? 0) ^ 0xff;
    script = () => reply(200, [wrong]);
    const svc = makeService();
    await svc.start(MODEL.id);
    await waitUntil(() => finished(svc.state()));

    expect(svc.state()).toEqual({
      status: 'failed',
      modelId: MODEL.id,
      message: 'The download was damaged. Please try again.',
    });
    await expect(stat(partPath())).rejects.toThrow();
    await expect(stat(modelPath())).rejects.toThrow();
    expect(installed).toEqual([]);
  });

  it('cancel keeps the partial file so the next start can resume it', async () => {
    script = (_call, init) =>
      reply(200, [BYTES.subarray(0, HALF)], { hold: true, signal: init.signal ?? undefined });
    const svc = makeService();
    await svc.start(MODEL.id);
    await waitUntil(
      () =>
        svc.state().status === 'downloading' &&
        (svc.state() as { received: number }).received === HALF,
    );

    await svc.cancel();
    expect(svc.state()).toEqual({ status: 'idle' });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect((await stat(partPath())).size).toBe(HALF);
    expect(installed).toEqual([]);
  });

  it('retries after a dropped connection and resumes from the bytes already saved', async () => {
    script = (call) =>
      call === 0
        ? reply(200, [BYTES.subarray(0, HALF)], { error: 'socket hang up' })
        : reply(206, [BYTES.subarray(HALF)]);
    const svc = makeService();
    await svc.start(MODEL.id);
    await waitUntil(() => finished(svc.state()));

    expect(svc.state()).toEqual({ status: 'idle' });
    expect(calls.filter((c) => c.url === MODEL.url).map((c) => c.range)).toEqual([
      undefined,
      `bytes=${HALF}-`,
    ]);
    expect(await readFile(modelPath())).toEqual(BYTES);
  });

  it('refuses to start when there is not enough disk space', async () => {
    const svc = makeService({ freeSpace: () => Promise.resolve(1024) });
    await svc.start(MODEL.id);
    await waitUntil(() => finished(svc.state()));

    const state = svc.state();
    expect(state.status).toBe('failed');
    expect(state).toMatchObject({
      message: expect.stringMatching(/^Not enough free disk space\. Needed: .+\. Free: 1 KB\.$/),
    });
    expect(calls.filter((c) => c.url === MODEL.url)).toEqual([]);
  });

  it('rejects an unknown model and a second download while one is running', async () => {
    script = (_call, init) =>
      reply(200, [BYTES.subarray(0, HALF)], { hold: true, signal: init.signal ?? undefined });
    const svc = makeService();
    await expect(svc.start('nope')).rejects.toMatchObject({ status: 400 });

    await svc.start(MODEL.id);
    await expect(svc.start(MODEL.id)).rejects.toMatchObject({ status: 400 });
    await svc.cancel();
    expect(await stat(modelPath()).catch(() => null)).toBeNull();
  });
});
