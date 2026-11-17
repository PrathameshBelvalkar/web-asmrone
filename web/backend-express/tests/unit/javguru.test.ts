import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MockAgent } from 'undici';
import { describe, expect, it } from 'vitest';
import { JavguruClient } from '../../src/extension/javguru/javguru.client.js';
import { unpack } from '../../src/extension/javguru/packer.js';
import { embedLinks, postFor, serverButtons } from '../../src/extension/javguru/parsers.js';
import { fileIdOf, gatewayValue } from '../../src/extension/javguru/token.js';
import { HttpError } from '../../src/models/errors.js';
import { ProxyService } from '../../src/services/proxy.service.js';
import { IssuedUrls } from '../../src/stores/issued-urls.js';

const fixture = (name: string) =>
  readFileSync(join(__dirname, '..', 'fixtures', 'javguru', name), 'utf8');
const SITE = 'https://jav.guru';
const POST =
  'https://jav.guru/1077157/dldss-575-my-salary-went-up-again-this-year-ignoring-my-husband-happily-talking-about-it-im-being-creampied-by-his-boss-sumi-naho/';
const TOKEN = '77c617665796d6c6370347a6';

describe('jav.guru tokens', () => {
  it('reads the embed file id from a STREAM SB token', () => {
    expect(gatewayValue(TOKEN)).toBe('6a7430736c6d697566716c77');
    expect(fileIdOf(TOKEN)).toBe('jt0slmiufqlw');
  });

  it('refuses tokens that are not a reversed hex file id', () => {
    expect(fileIdOf('xyz')).toBeNull();
    expect(fileIdOf('abc')).toBeNull();
    // Hex of "a/b" reversed: not a file id.
    expect(fileIdOf(gatewayValue(Buffer.from('a/b/c/d/e').toString('hex')))).toBeNull();
  });
});

describe('jav.guru parsers', () => {
  it('finds the post whose title starts with the DVD ID', () => {
    const json: unknown = JSON.parse(fixture('rest-search-dldss-575.json'));
    expect(postFor(json, 'dldss-575')).toEqual({
      url: POST,
      title: expect.stringMatching(/^\[DLDSS-575\] My salary went up again this year.” Ignoring/),
    });
    expect(postFor(json, 'DLDSS-57')).toBeNull();
    expect(postFor({ not: 'a list' }, 'DLDSS-575')).toBeNull();
  });

  it('skips posts that link off the site', () => {
    const json = [{ link: 'https://evil.example/1/x/', title: { rendered: '[ABC-123] x' } }];
    expect(postFor(json, 'ABC-123')).toBeNull();
  });

  it('reads the stream buttons and their gateway addresses', () => {
    const buttons = serverButtons(fixture('post-dldss-575.html'));
    expect(buttons.map((b) => b.label)).toEqual([
      'STREAM SB',
      'STREAM VO',
      'STREAM VI',
      'STREAM DD',
      'STREAM JK',
    ]);
    const sb = buttons[0];
    expect(sb?.gateway.pathname).toBe('/searcho/');
    expect(sb?.gateway.searchParams.get('xd')).toBe(TOKEN);
  });

  it('unpacks the embed player and lists its master playlists, hls4 first', () => {
    const html = fixture('embed-jt0slmiufqlw.html');
    expect(unpack(html)).toContain('jwplayer("vplayer").setup');
    const links = embedLinks(html, 'https://javclan.com/e/jt0slmiufqlw');
    expect(links?.masters).toHaveLength(3);
    expect(links?.masters[0]).toMatch(
      /^https:\/\/javclan\.com\/stream\/[\w-]+\/\w+\/\d+\/76402817\/master\.m3u8$/,
    );
    expect(links?.masters[1]).toMatch(/\/hls2\/.*jt0slmiufqlw_,l,n,h,\.urlset\/master\.m3u8\?t=/);
    expect(links?.masters[2]).toMatch(/\/hls3\/.*master\.txt$/);
  });

  it('finds no player in the page the host sends without a Referer', () => {
    const shell = '<html><head><title></title></head><body><div id="vplayer"></div></body></html>';
    expect(embedLinks(shell, 'https://javclan.com/e/jt0slmiufqlw')).toBeNull();
  });

  it('undoes packer escapes and words past base 36', () => {
    const packed =
      "eval(function(p,a,c,k,e,d){return p}('0 1=\\'2\\';Z(1)',62,62,'var|x|it\\'s|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||alert'.split('|'),0,{}))";
    expect(unpack(packed)).toBe("var x='it's';alert(x)");
  });
});

describe('jav.guru client', () => {
  const instant = () => {
    let t = 0;
    const waits: number[] = [];
    return {
      now: () => t,
      sleep: (ms: number) => {
        waits.push(ms);
        t += ms;
        return Promise.resolve();
      },
      waits,
    };
  };

  it('searches through the REST API and spaces requests to the site', async () => {
    const agent = new MockAgent();
    agent.disableNetConnect();
    const site = agent.get(SITE);
    site
      .intercept({
        path: (p) => p.startsWith('/wp-json/wp/v2/posts?') && p.includes('search=DLDSS-575'),
        method: 'GET',
      })
      .reply(200, fixture('rest-search-dldss-575.json'))
      .times(2);
    const clock = instant();
    const client = new JavguruClient(agent, { siteGapMs: 2_000, embedGapMs: 1_000, ...clock });
    await client.search('DLDSS-575');
    await client.search('DLDSS-575');
    expect(clock.waits).toEqual([2_000]);
  });

  it('pauses every request after a 429 or a challenge, and never retries', async () => {
    const agent = new MockAgent();
    agent.disableNetConnect();
    agent
      .get(SITE)
      .intercept({ path: (p) => p.startsWith('/wp-json/'), method: 'GET' })
      .reply(429, 'Too many', { headers: { 'cf-mitigated': 'challenge' } });
    const client = new JavguruClient(agent, { siteGapMs: 0, embedGapMs: 0, ...instant() });
    await expect(client.search('X-1')).rejects.toMatchObject({ status: 503 });
    // Paused: no second request is made (the interceptor was used once).
    await expect(client.post(POST)).rejects.toMatchObject({ status: 503 });
  });

  it('does not count the background challenge script on a normal page as a block', async () => {
    const agent = new MockAgent();
    agent.disableNetConnect();
    const page = `${fixture('post-dldss-575.html')}<script src="/cdn-cgi/challenge-platform/scripts/jsd/main.js"></script>`;
    agent
      .get(SITE)
      .intercept({ path: new URL(POST).pathname, method: 'GET' })
      .reply(200, page);
    const client = new JavguruClient(agent, { siteGapMs: 0, embedGapMs: 0, ...instant() });
    expect(await client.post(POST)).toContain('STREAM SB');
  });

  it('reads only posts on the site', async () => {
    const client = new JavguruClient(new MockAgent(), { siteGapMs: 0, embedGapMs: 0 });
    await expect(client.post('https://jav.guru/wp-admin/')).rejects.toBeInstanceOf(HttpError);
    await expect(client.post('https://evil.example/1/x/')).rejects.toBeInstanceOf(HttpError);
  });

  it('reads the gateway redirect without following it, and accepts only embed addresses', async () => {
    const agent = new MockAgent();
    agent.disableNetConnect();
    const site = agent.get(SITE);
    site
      .intercept({ path: '/searcho/?xr=6a7430736c6d697566716c77', method: 'GET' })
      .reply(302, '', { headers: { location: 'https://newhost.example/e/jt0slmiufqlw' } });
    site
      .intercept({ path: '/searcho/?xr=6a7430736c6d697566716c78', method: 'GET' })
      .reply(302, '', { headers: { location: 'https://ads.example/landing' } });
    const client = new JavguruClient(agent, { siteGapMs: 0, embedGapMs: 0, ...instant() });
    expect((await client.gateway('6a7430736c6d697566716c77'))?.href).toBe(
      'https://newhost.example/e/jt0slmiufqlw',
    );
    expect(await client.gateway('6a7430736c6d697566716c78')).toBeNull();
  });

  it('asks for the embed with the site as Referer', async () => {
    const agent = new MockAgent();
    agent.disableNetConnect();
    agent
      .get('https://javclan.com')
      .intercept({
        path: '/e/jt0slmiufqlw',
        method: 'GET',
        headers: { referer: 'https://jav.guru/', 'user-agent': 'EchoASMR/1.0' },
      })
      .reply(200, fixture('embed-jt0slmiufqlw.html'));
    const client = new JavguruClient(agent, { siteGapMs: 0, embedGapMs: 0, ...instant() });
    const page = await client.embed(new URL('https://javclan.com/e/jt0slmiufqlw'));
    expect(page.status).toBe(200);
    await expect(client.embed(new URL('https://javclan.com/stream/x'))).rejects.toBeInstanceOf(
      HttpError,
    );
  });
});

describe('proxy playlists with direct segments', () => {
  const master = 'https://host.example/stream/a/master.m3u8';
  const masterText = '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\nindex-f1.m3u8\n';
  const variantText =
    '#EXTM3U\n#EXTINF:10,\nhttps://cdn.example/seg-1.image?sig=1\n#EXTINF:10,\nseg-2.ts\n';

  it('proxies child playlists and leaves segments as direct addresses', () => {
    const issued = new IssuedUrls(100);
    const proxy = new ProxyService(issued, new MockAgent());
    issued.add(master, {}, { directSegments: true });

    const rewritten = proxy.rewritePlaylist(master, masterText);
    const child = 'https://host.example/stream/a/index-f1.m3u8';
    expect(rewritten).toContain(`/api/proxy?url=${encodeURIComponent(child)}`);
    expect(issued.directSegments(child)).toBe(true);

    const variant = proxy.rewritePlaylist(child, variantText);
    expect(variant).toContain('\nhttps://cdn.example/seg-1.image?sig=1\n');
    expect(variant).toContain('\nhttps://host.example/stream/a/seg-2.ts\n');
    expect(issued.has('https://cdn.example/seg-1.image?sig=1')).toBe(false);
  });

  it('still proxies every segment of an ordinary playlist', () => {
    const issued = new IssuedUrls(100);
    const proxy = new ProxyService(issued, new MockAgent());
    issued.add(master);
    const child = 'https://host.example/stream/a/index-f1.m3u8';
    proxy.rewritePlaylist(master, masterText);
    const variant = proxy.rewritePlaylist(child, variantText);
    expect(variant).toContain(
      `/api/proxy?url=${encodeURIComponent('https://cdn.example/seg-1.image?sig=1')}`,
    );
    expect(issued.has('https://cdn.example/seg-1.image?sig=1')).toBe(true);
  });
});
