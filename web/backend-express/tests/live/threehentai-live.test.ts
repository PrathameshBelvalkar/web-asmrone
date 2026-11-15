/**
 * Live checks against 3hentai.to. They need network access and are skipped unless LIVE=1
 * (npm run test:live). Two page requests: Browse, and one gallery from it.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeTestApp, type TestApp } from '../helpers/app.js';

const live = process.env.LIVE === '1';

describe.skipIf(!live)('live 3hentai.to flows (LIVE=1)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await makeTestApp();
  }, 60_000);

  afterAll(async () => {
    await t.cleanup();
  });

  it('browses and opens a gallery', async () => {
    const browse = await request(t.app).get('/api/manga/browse').expect(200);
    expect(browse.body.items.length).toBeGreaterThan(0);
    const id = browse.body.items[0].id as string;
    const gallery = await request(t.app).get(`/api/manga/gallery/${id}`).expect(200);
    expect(gallery.body.pages.length).toBeGreaterThan(0);
    expect(gallery.body.pages[0].url).toMatch(/^https:\/\/3-hentai\.xyz\//);
  }, 60_000);
});
