import request from 'supertest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeTestApp, type TestApp } from '../helpers/app.js';

const INDEX = '<!doctype html><html><body><div id="root">echo-ui</div></body></html>';
const ASSET = 'console.log("bundle")';
const SECRET = 'SECRET-OUTSIDE-DIST';

let root: string;
let dist: string;
let built: TestApp;
let unbuilt: TestApp;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'echo-web-ui-'));
  dist = join(root, 'dist');
  await mkdir(join(dist, 'assets'), { recursive: true });
  await writeFile(join(dist, 'index.html'), INDEX);
  await writeFile(join(dist, 'assets', 'app-abc123.js'), ASSET);
  await writeFile(join(root, 'secret.txt'), SECRET);
  built = await makeTestApp({ distDir: dist });
  unbuilt = await makeTestApp({ distDir: null });
});

afterAll(async () => {
  await built.cleanup();
  await unbuilt.cleanup();
  await rm(root, { recursive: true, force: true });
});

describe('built UI', () => {
  it('serves index.html at /', async () => {
    const res = await request(built.app).get('/');
    expect(res.status).toBe(200);
    expect(res.type).toBe('text/html');
    expect(res.text).toBe(INDEX);
  });

  it('serves index.html for client-side routes', async () => {
    for (const path of ['/work/123', '/settings', '/feed/abc']) {
      const res = await request(built.app).get(path);
      expect(res.status, path).toBe(200);
      expect(res.text, path).toBe(INDEX);
    }
  });

  it('serves index.html with no-cache so a new build is picked up', async () => {
    const res = await request(built.app).get('/work/1');
    expect(res.headers['cache-control']).toBe('no-cache');
  });

  it('serves hashed assets with a long immutable cache', async () => {
    const res = await request(built.app).get('/assets/app-abc123.js');
    expect(res.status).toBe(200);
    expect(res.text).toBe(ASSET);
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('answers HEAD for the page', async () => {
    const res = await request(built.app).head('/work/1');
    expect(res.status).toBe(200);
  });

  it('does not serve index.html for other methods', async () => {
    const res = await request(built.app).post('/work/1').send({});
    expect(res.status).toBe(404);
    expect(res.text).not.toContain('echo-ui');
  });

  it('does not let a path escape the dist folder', async () => {
    const res = await request(built.app).get('/%2e%2e/secret.txt');
    expect(res.text).not.toContain(SECRET);
  });

  it('keeps unknown /api paths as JSON 404, not index.html', async () => {
    const res = await request(built.app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ type: 'not_found', message: null });
  });

  it('still serves the API alongside the UI', async () => {
    const res = await request(built.app).get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.text).toBe('null');
  });
});

describe('without a build', () => {
  it('returns a plain-text hint at /', async () => {
    const res = await request(unbuilt.app).get('/');
    expect(res.status).toBe(200);
    expect(res.type).toBe('text/plain');
    expect(res.text).toContain('Build the frontend');
  });

  it('does not serve a page for client-side routes', async () => {
    const res = await request(unbuilt.app).get('/work/1');
    expect(res.status).toBe(404);
  });

  it('keeps the API working', async () => {
    const res = await request(unbuilt.app).get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.text).toBe('null');
  });
});
