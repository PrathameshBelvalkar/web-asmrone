/**
 * Live checks against javdatabase.com. They need network access and are skipped unless LIVE=1
 * (npm run test:live). Three page requests: the blog, the movie list, and one movie from it.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeTestApp, type TestApp } from '../helpers/app.js';

const live = process.env.LIVE === '1';

describe.skipIf(!live)('live javdatabase.com flows (LIVE=1)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await makeTestApp();
  }, 60_000);

  afterAll(async () => {
    await t.cleanup();
  });

  it('reads the news, lists movies and opens one', async () => {
    const news = await request(t.app).get('/api/jav/news').expect(200);
    expect(news.body.items.length).toBeGreaterThan(0);
    const movies = await request(t.app).get('/api/jav/movies').expect(200);
    expect(movies.body.items.length).toBeGreaterThan(0);
    const first = movies.body.items[0] as { kind: string; slug: string };
    const movie = await request(t.app).get(`/api/jav/movie/${first.kind}/${first.slug}`);
    // A movie may be refused by a content rule; anything else must parse.
    expect([200, 451]).toContain(movie.status);
    if (movie.status === 200) expect(movie.body.genres.length).toBeGreaterThan(0);
  }, 60_000);
});
