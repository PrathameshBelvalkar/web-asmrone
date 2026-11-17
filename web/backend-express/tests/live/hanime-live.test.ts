/**
 * Live check against hanime. It needs network access and is skipped unless LIVE=1
 * (npm run test:live). One catalog download (and the sitemap, once).
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeTestApp, type TestApp } from '../helpers/app.js';

const live = process.env.LIVE === '1';

describe.skipIf(!live)('live hanime catalog (LIVE=1)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await makeTestApp();
  }, 60_000);

  afterAll(async () => {
    await t.cleanup();
  });

  it('downloads the catalog, lists it and opens a title', async () => {
    const status = await request(t.app).post('/api/hanime/sync').expect(200);
    expect(status.body.error).toBeNull();
    expect(status.body.titles).toBeGreaterThan(3000);
    const list = await request(t.app).get('/api/hanime/titles').expect(200);
    const first = list.body.items[0] as { slug: string };
    const title = await request(t.app).get(`/api/hanime/title/${first.slug}`).expect(200);
    expect(title.body.poster).toMatch(/^https:\/\/hanime-cdn\.com\/images\//);
  }, 60_000);
});
