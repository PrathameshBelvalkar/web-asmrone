/**
 * Live checks against asmr.one and Google translate. They need network access and are skipped
 * unless LIVE=1 (npm run test:live). They read only public endpoints and never log in.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeTestApp, type TestApp } from '../helpers/app.js';

const live = process.env.LIVE === '1';

describe.skipIf(!live)('live asmr.one flows (LIVE=1)', () => {
  let t: TestApp;
  let album: Record<string, unknown>;

  beforeAll(async () => {
    // Real extension, real dispatchers: no injected dependencies.
    t = await makeTestApp();
  }, 60_000);

  afterAll(async () => {
    await t.cleanup();
  });

  it('opens the home feed and pages it', async () => {
    const home = await request(t.app).get('/api/home').expect(200);
    expect(home.body.pagedId).toEqual(expect.any(String));
    const page = await request(t.app).get(`/api/pages/${home.body.pagedId as string}`).expect(200);
    const all = (page.body.items as Record<string, unknown>[]).find((i) => i.kind === 'items' && i.id === 'all') as
      | { items: Record<string, unknown>[] }
      | undefined;
    expect(all?.items.length).toBeGreaterThan(0);
    album = all!.items[0]!;
  }, 60_000);

  it('loads an album, its feed and its tracks', async () => {
    const loaded = await request(t.app).post('/api/album/load').send({ item: album }).expect(200);
    expect(loaded.body.mediaItemType).toMatch(/Album$/);
    const feed = await request(t.app).post('/api/album/feed').send({ item: album }).expect(200);
    expect(feed.body.pagedId).toEqual(expect.any(String));
    await request(t.app).post('/api/album/tracks').send({ item: album }).expect(200);
  }, 60_000);

  it('serves a stream through the proxy with a Range request', async () => {
    const tracks = await request(t.app).post('/api/album/tracks').send({ item: album }).expect(200);
    const page = await request(t.app).get(`/api/pages/${tracks.body.pagedId as string}`).expect(200);
    const track = (page.body.items as Record<string, unknown>[])[0];
    if (!track) return; // some works have no audio
    const media = await request(t.app).post('/api/track/media').send({ item: track }).expect(200);
    const url = (media.body.sources as { request: { url: string } }[])[0]!.request.url;
    await request(t.app).get('/api/proxy').query({ url }).set('Range', 'bytes=0-1023').expect(206);
  }, 90_000);

  it('quick search returns suggestions', async () => {
    const res = await request(t.app).get('/api/quicksearch').query({ q: 'ASMR' }).expect(200);
    expect((res.body as unknown[]).length).toBeGreaterThan(0);
  }, 60_000);
});
