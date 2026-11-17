/**
 * Finding a Hanime title's episode page on hentaibros.net (docs/HANIME.md section 12.3). The two
 * sites spell titles differently (`boku-ni-sefure-ga-dekita-riyuu-3` and
 * `boku-ni-sexfriend-ga-dekita-riyuu-episode-3`), so names are compared as sets of words, and the
 * episode number must be the same. Tuned on the whole catalog on 2026-11-17: at 0.6, 2,322 of 3,462
 * titles find a page, and every match checked between 0.6 and 0.75 was right; below 0.6 they weren't.
 */

/** The least similarity accepted. */
export const MATCH_THRESHOLD = 0.6;
/** One name containing the other whole (an added or dropped subtitle) counts this much. */
const CONTAINED = 0.85;
/** Words that say nothing about which title it is. */
const NOISE = new Set([
  'the',
  'animation',
  'motion',
  'anime',
  'ova',
  'episode',
  'ep',
  'season',
  'no',
  'a',
  'of',
  'to',
  'wa',
  'ga',
  'wo',
  'ni',
  'de',
  'and',
]);

export interface StreamPost {
  readonly slug: string;
  readonly words: ReadonlySet<string>;
  /** The words run together, for the containment check. */
  readonly joined: string;
  /** The `-episode-N` number; null for a post without one (a one-off). */
  readonly episode: number | null;
}

export interface MatchableTitle {
  readonly slug: string;
  readonly name: string;
  readonly altTitles: readonly string[];
}

const words = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w !== '');

/** `Name 3`, `Name ep 3`, `Name episode 3` → the name and 3. */
function splitEpisode(s: string): { base: string; episode: number | null } {
  const text = words(s).join(' ');
  const match = /^(.*?)(?:\s+(?:ep|episode))?\s+(\d{1,3})$/.exec(text);
  return match
    ? { base: match[1] as string, episode: Number(match[2]) }
    : { base: text, episode: null };
}

/** A post slug, ready to compare: `can-can-bunny-episode-2` → {can, bunny}, 2. */
export function streamPost(slug: string): StreamPost {
  const match = /^(.+?)-episode-(\d+)(?:-\d+)?$/.exec(slug);
  const base = match ? (match[1] as string) : slug;
  const w = words(base).filter((x) => !NOISE.has(x));
  return { slug, words: new Set(w), joined: w.join(''), episode: match ? Number(match[2]) : null };
}

/**
 * The post that best matches the title, or null when none reaches MATCH_THRESHOLD. The title's
 * episode comes from its slug or name; a title or post without a number counts as episode 1.
 */
export function matchPost(title: MatchableTitle, posts: readonly StreamPost[]): StreamPost | null {
  const own = [title.slug.replace(/-/g, ' '), title.name];
  const episodes = own.map((s) => splitEpisode(s).episode).filter((e): e is number => e !== null);
  const episode = episodes.length > 0 ? Math.min(...episodes) : 1;
  const bases = [...own, ...title.altTitles]
    .map((s) => splitEpisode(s).base)
    .filter((b) => /[a-z]/.test(b))
    .map((b) => words(b).filter((x) => !NOISE.has(x)))
    .filter((w) => w.length > 0)
    .map((w) => ({ words: new Set(w), joined: w.join('') }));

  let best: StreamPost | null = null;
  let bestScore = 0;
  for (const post of posts) {
    if ((post.episode ?? 1) !== episode) continue;
    for (const base of bases) {
      let shared = 0;
      for (const w of base.words) if (post.words.has(w)) shared += 1;
      const union = base.words.size + post.words.size - shared;
      let score = union === 0 ? 0 : shared / union;
      if (
        base.joined.length >= 6 &&
        post.joined.length >= 6 &&
        (post.joined.includes(base.joined) || base.joined.includes(post.joined))
      ) {
        score = Math.max(score, CONTAINED);
      }
      if (score > bestScore) {
        bestScore = score;
        best = post;
      }
    }
  }
  return bestScore >= MATCH_THRESHOLD ? best : null;
}
