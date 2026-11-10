import { MockAgent } from 'undici';
import { afterAll, describe, expect, it } from 'vitest';
import { JasmrClient } from '../../src/extension/jasmr/api/jasmr.client.js';
import { HttpError } from '../../src/models/errors.js';

const agent = new MockAgent();
agent.disableNetConnect();
const site = agent.get('https://japaneseasmr.com');

afterAll(async () => {
  await agent.close();
});

/** A client whose clock and sleep are fake, so the crawl gap can be checked exactly. */
function clientWithClock(crawlDelayMs: number, cacheTtlMs = 60_000) {
  let now = 0;
  const sleeps: number[] = [];
  const client = new JasmrClient(agent, {
    crawlDelayMs,
    cacheTtlMs,
    now: () => now,
    sleep: (ms) => {
      sleeps.push(ms);
      now += ms;
      return Promise.resolve();
    },
  });
  return { client, sleeps, advance: (ms: number) => (now += ms) };
}

describe('japaneseasmr page client', () => {
  it('waits the crawl delay between two page requests', async () => {
    site.intercept({ path: '/', method: 'GET' }).reply(200, '<html>home</html>');
    site.intercept({ path: '/page/2/', method: 'GET' }).reply(200, '<html>page 2</html>');
    const { client, sleeps } = clientWithClock(10_000);
    expect(await client.page('/')).toBe('<html>home</html>');
    expect(await client.page('/page/2/')).toBe('<html>page 2</html>');
    expect(sleeps).toEqual([10_000]);
  });

  it('serves a fresh copy from the cache without a request', async () => {
    site.intercept({ path: '/151994/', method: 'GET' }).reply(200, '<html>work</html>');
    const { client } = clientWithClock(0);
    expect(await client.page('/151994/')).toBe('<html>work</html>');
    // The interceptor above is used once; a second network call would fail the test.
    expect(await client.page('/151994/')).toBe('<html>work</html>');
  });

  it('fetches again after the cache time has passed', async () => {
    site.intercept({ path: '/old/', method: 'GET' }).reply(200, 'first');
    site.intercept({ path: '/old/', method: 'GET' }).reply(200, 'second');
    const { client, advance } = clientWithClock(0, 1_000);
    expect(await client.page('/old/')).toBe('first');
    advance(1_001);
    expect(await client.page('/old/')).toBe('second');
  });

  it('reports a Cloudflare bot check as a clear 503 and never retries around it', async () => {
    site
      .intercept({ path: '/check/', method: 'GET' })
      .reply(403, '<html><title>Just a moment...</title><script src="/cdn-cgi/challenge-platform/h/b/x"></script></html>');
    const { client } = clientWithClock(0);
    const error = await client.page('/check/').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(503);
    expect((error as HttpError).publicMessage).toMatch(/bot check/);
  });

  it('turns other error statuses into upstream errors with the same status', async () => {
    site.intercept({ path: '/broken/', method: 'GET' }).reply(500, 'oops');
    const { client } = clientWithClock(0);
    const error = await client.page('/broken/').catch((e: unknown) => e);
    expect((error as HttpError).status).toBe(500);
    expect((error as HttpError).errorType).toBe('upstream');
  });
});
