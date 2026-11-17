import { describe, expect, it } from 'vitest';
import {
  episodeVideoOf,
  postSitemapsOf,
  postSlugsOf,
} from '../../src/extension/hentaibros/parsers.js';
import { matchPost, streamPost } from '../../src/services/hanime/stream-match.js';

const item = (src: string) =>
  JSON.stringify({ sources: [{ src, type: 'video/mp4' }], id: '3239' }).replace(/"/g, '&quot;');
const page = (src: string, h1 = 'Can Can Bunny episode 2') =>
  `<html><body><h1 class="entry-title">${h1}</h1>
   <video src="https://z6v2p9a8.bkcdn.net/library/994432/ad.mp4"></video>
   <div class="video-player"><div class="responsive-player"><div id="wpfp_3233" data-item="${item(src)}"></div></div></div>
   </body></html>`;

describe('hentaibros parsers', () => {
  it('lists the post sitemaps and their slugs', () => {
    const index = `<sitemapindex>
      <sitemap><loc>https://hentaibros.net/post-sitemap.xml</loc></sitemap>
      <sitemap><loc>https://hentaibros.net/post-sitemap2.xml</loc></sitemap>
      <sitemap><loc>https://hentaibros.net/page-sitemap.xml</loc></sitemap>
      <sitemap><loc>https://evil.example/post-sitemap3.xml</loc></sitemap></sitemapindex>`;
    expect(postSitemapsOf(index)).toEqual([
      'https://hentaibros.net/post-sitemap.xml',
      'https://hentaibros.net/post-sitemap2.xml',
    ]);
    const posts = `<urlset>
      <url><loc>https://hentaibros.net/</loc></url>
      <url><loc>https://hentaibros.net/can-can-bunny-episode-2/</loc></url>
      <url><loc>https://hentaibros.net/d-spray-episode-1/</loc></url></urlset>`;
    expect(postSlugsOf(posts)).toEqual(['can-can-bunny-episode-2', 'd-spray-episode-1']);
  });

  it('reads the player’s video, not the ads, and escapes spaces', () => {
    expect(
      episodeVideoOf(page('https://cdn.vintageporno.stream/Can%20Can%20Bunny%2002%20Sub.mp4')),
    ).toEqual({
      title: 'Can Can Bunny episode 2',
      file: 'https://cdn.vintageporno.stream/Can%20Can%20Bunny%2002%20Sub.mp4',
    });
    expect(episodeVideoOf(page('https://povblowjob.net/1Ldk 08 Sub.mp4'))?.file).toBe(
      'https://povblowjob.net/1Ldk%2008%20Sub.mp4',
    );
  });

  it('takes only an https video address', () => {
    expect(episodeVideoOf(page('http://cdn.example/a.mp4'))).toBeNull();
    expect(episodeVideoOf(page('https://cdn.example/a.html'))).toBeNull();
    expect(episodeVideoOf('<h1>No player</h1>')).toBeNull();
  });
});

describe('matching a title to its hentaibros page', () => {
  const posts = [
    'boku-ni-sexfriend-ga-dekita-riyuu-episode-3',
    'boku-ni-sexfriend-ga-dekita-riyuu-episode-2',
    'shinsei-kourin-dacryon-runa-episode-1',
    'kanpeki-ojou-sama-no-watakushi-ga-dogeza-de-mazo-ochi-suru-choro-in-na-wakenai-desu-wa-episode-4',
    'samurai-hormone-the-animation-episode-1',
    'blackmail-ii-episode-1',
    'm-okui-last-order-episode-1',
  ].map(streamPost);
  const title = (slug: string, name: string, altTitles: string[] = []) => ({
    slug,
    name,
    altTitles,
  });

  it('matches other spellings, added subtitles and “the animation”, by episode', () => {
    expect(
      matchPost(
        title('boku-ni-sefure-ga-dekita-riyuu-3', 'Boku ni Sefure ga Dekita Riyuu 3'),
        posts,
      )?.slug,
    ).toBe('boku-ni-sexfriend-ga-dekita-riyuu-episode-3');
    expect(
      matchPost(title('shinsei-kourin-dacryon-luna-1', 'Shinsei Kourin Dacryon Luna 1'), posts)
        ?.slug,
    ).toBe('shinsei-kourin-dacryon-runa-episode-1');
    expect(
      matchPost(
        title('kanpeki-ojou-sama-no-watakushi-4', 'Kanpeki Ojou-sama no Watakushi 4'),
        posts,
      )?.slug,
    ).toBe(
      'kanpeki-ojou-sama-no-watakushi-ga-dogeza-de-mazo-ochi-suru-choro-in-na-wakenai-desu-wa-episode-4',
    );
    expect(matchPost(title('samurai-hormone-1', 'Samurai Hormone 1'), posts)?.slug).toBe(
      'samurai-hormone-the-animation-episode-1',
    );
    // No number counts as episode 1.
    expect(matchPost(title('m-ogui-last-order', 'M Ogui: Last Order'), posts)?.slug).toBe(
      'm-okui-last-order-episode-1',
    );
  });

  it('never matches another episode or an unrelated title', () => {
    expect(
      matchPost(
        title('boku-ni-sefure-ga-dekita-riyuu-4', 'Boku ni Sefure ga Dekita Riyuu 4'),
        posts,
      ),
    ).toBeNull();
    expect(
      matchPost(
        title('romance-wa-tsurugi-no-kagayaki-1', 'Romance wa Tsurugi no Kagayaki 1'),
        posts,
      ),
    ).toBeNull();
  });
});
