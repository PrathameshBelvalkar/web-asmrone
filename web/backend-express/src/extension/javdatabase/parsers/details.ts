import { load, type Cheerio, type CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';
import type {
  JavGenreGroup,
  JavIdol,
  JavKind,
  JavMovie,
  JavRef,
  JavSample,
} from '../../../models/jav.js';
import { idolCardsIn, movieCardsIn } from './cards.js';
import {
  clean,
  dateIn,
  hasNextPage,
  httpsUrl,
  labelLinks,
  labelText,
  labelledValues,
  lastPageOf,
  mainOf,
  numberIn,
  refsIn,
} from './common.js';

/** The block of cards that follows the `h4` whose text contains `title`, or an empty selection. */
function sectionAfter($: CheerioAPI, scope: Cheerio<AnyNode>, title: string): Cheerio<AnyNode> {
  const heading = scope
    .find('h4')
    .filter((_, h) => clean($(h).text()).includes(title))
    .first();
  if (heading.length === 0) return $([]);
  const row = heading.nextAll('.row').first();
  return row.length > 0 ? row : heading.parent();
}

/** A movie page (`/movies/{slug}/` or `/uncensored/{slug}/`). */
export function parseMoviePage(html: string, kind: JavKind, slug: string): JavMovie {
  const $ = load(html);
  const main = mainOf($);
  const info = labelledValues($, main);
  const refs = (label: string, section: string | null): JavRef[] => {
    const value = info.get(label);
    return value === undefined ? [] : refsIn($, value, section);
  };
  const ref = (label: string, section: string | null): JavRef | null =>
    refs(label, section)[0] ?? null;
  const h1 = clean($('h1').first().text());
  const dvdId = labelText(info, 'DVD ID');
  const titleFromH1 =
    dvdId !== null && h1.startsWith(`${dvdId} - `) ? h1.slice(dvdId.length + 3) : h1;
  const castSection = sectionAfter($, main, 'Actress/Idols');
  const cast = idolCardsIn($, castSection);
  const coverFull =
    httpsUrl($('#poster-container img').first().attr('src')) ??
    httpsUrl($('video[poster]').first().attr('poster'));
  const samples: JavSample[] = [];
  main.find('.image-gallery-section a[data-image-src]').each((_, a) => {
    const full = httpsUrl($(a).attr('data-image-src'));
    const thumb = httpsUrl($(a).find('img').first().attr('src')) ?? full;
    if (full !== null && thumb !== null) samples.push({ thumb, full });
  });
  const runtime = labelText(info, 'Runtime');
  return {
    slug,
    kind,
    dvdId,
    title: labelText(info, 'Title') ?? (titleFromH1 || slug),
    releaseDate: dateIn(labelText(info, 'Release Date') ?? ''),
    upcoming: false,
    cover: httpsUrl(main.find('img[src*="/covers/thumb/"]').first().attr('src')) ?? coverFull,
    studio: ref('Studio', 'studios'),
    contentId: labelText(info, 'Content ID'),
    coverFull,
    runtimeMin: runtime === null ? null : numberIn(runtime),
    series: ref('JAV Series', null) ?? ref('Series', null),
    director: ref('Director', 'directors'),
    genres: refs('Genre(s)', 'genres'),
    // Cards with photos when the page has them; otherwise the names in the info block.
    idols:
      cast.length > 0
        ? cast
        : refs('Idol(s)/Actress(es)', 'idols').map((r) => ({
            slug: r.slug,
            name: r.name,
            photo: null,
            age: null,
          })),
    samples,
    // Censored pages hide the player behind a Trailer button; uncensored pages show it in place.
    trailer: httpsUrl(main.find('video#jav-player source[src]').first().attr('src')),
    similar: movieCardsIn($, sectionAfter($, main, 'Similar')),
  };
}

/** An idol page (`/idols/{slug}/?ipage=N`). */
export function parseIdolPage(html: string, slug: string, page: number): JavIdol {
  const $ = load(html);
  const main = mainOf($);
  const h1 = main.find('h1.idol-name').first();
  const profile = labelledValues($, h1.parent());
  const counts = clean(main.find('h4').text());
  const photoFull = httpsUrl(main.find('img[src*="/idolimages/full/"]').first().attr('src'));
  const height = labelText(profile, 'Height');
  const debutAge = labelText(profile, 'Debut Age');
  const age = labelText(profile, 'Age');
  const bio = clean(main.find('#Biography').first().next('div').text());
  const relatedSection = sectionAfter($, main, 'Related Idols');
  // The idol's movies are every movie card on the page; Related Idols holds only idol cards.
  return {
    slug,
    name: clean(h1.text()).replace(/\s+-\s+JAV Profile$/i, '') || slug,
    photo: photoFull === null ? null : photoFull.replace('/idolimages/full/', '/idolimages/thumb/'),
    age: age === null ? null : numberIn(age),
    photoFull,
    nameJapanese: labelText(profile, 'JP'),
    altNames: (labelText(profile, 'Alt') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
    dob: labelText(profile, 'DOB'),
    debut: labelText(profile, 'Debut'),
    debutAge: debutAge === null ? null : numberIn(debutAge),
    birthplace: labelText(profile, 'Birthplace'),
    sign: labelText(profile, 'Sign'),
    blood: labelText(profile, 'Blood'),
    measurements: labelText(profile, 'Measurements'),
    cup: labelText(profile, 'Cup'),
    heightCm: height === null ? null : numberIn(height),
    shoeSize: labelText(profile, 'Shoe Size'),
    hairLength: labelLinks($, profile, 'Hair Length(s)'),
    hairColor: labelLinks($, profile, 'Hair Color(s)'),
    tags: labelLinks($, profile, 'Tags').filter((t) => !/^suggest/i.test(t)),
    bio: bio.length > 0 ? bio : null,
    censoredCount: numberIn(/Censored JAV Movies \((\d+)\)/.exec(counts)?.[1] ?? ''),
    uncensoredCount: numberIn(/Uncensored JAV Movies \((\d+)\)/.exec(counts)?.[1] ?? ''),
    movies: {
      items: movieCardsIn($, main),
      page,
      lastPage: lastPageOf($),
      hasMore: hasNextPage($, page),
    },
    related: idolCardsIn($, relatedSection).filter((idol) => idol.slug !== slug),
  };
}

/** The genres page: one group per heading, each with its genre links. */
export function parseGenresPage(html: string): JavGenreGroup[] {
  const $ = load(html);
  const groups: JavGenreGroup[] = [];
  mainOf($)
    .find('h2.wp-block-heading')
    .each((_, h2) => {
      const genres = refsIn($, $(h2).nextUntil('h2'), 'genres');
      if (genres.length > 0) groups.push({ name: clean($(h2).text()), genres });
    });
  return groups;
}
