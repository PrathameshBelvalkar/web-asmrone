import type { Cheerio, CheerioAPI } from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
import type { JavKind, JavRef } from '../../../models/jav.js';
import { JAVDATABASE_SITE } from '../constants.js';

/** Collapses runs of whitespace and trims. */
export const clean = (text: string | undefined | null): string =>
  (text ?? '').replace(/\s+/g, ' ').trim();

/**
 * An image address as https, or null. Covers of uncensored movies are on each studio's own host
 * (`en.caribbeancom.com`, …), so any https host is accepted; the proxy still serves only the
 * addresses the service hands out.
 */
export function httpsUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim(), JAVDATABASE_SITE);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/** The path segments of a link on the site, or null for any other link. */
function siteSegments(href: string | undefined): string[] | null {
  if (!href) return null;
  try {
    const url = new URL(href, JAVDATABASE_SITE);
    return url.origin === JAVDATABASE_SITE ? url.pathname.split('/').filter(Boolean) : null;
  } catch {
    return null;
  }
}

/** `/movies/savr-1268/` → `{ kind: 'censored', slug: 'savr-1268' }`; null for list pages and other links. */
export function movieLinkOf(href: string | undefined): { kind: JavKind; slug: string } | null {
  const parts = siteSegments(href);
  if (parts === null || parts.length !== 2 || parts[1] === 'page') return null;
  const [section, slug] = parts as [string, string];
  if (section === 'movies') return { kind: 'censored', slug };
  if (section === 'uncensored') return { kind: 'uncensored', slug };
  return null;
}

/** `/idols/aoi-aosaka/` → `aoi-aosaka`; null for the idol list and other links. */
export function idolSlugOf(href: string | undefined): string | null {
  const parts = siteSegments(href);
  if (parts === null || parts.length !== 2 || parts[0] !== 'idols' || parts[1] === 'page')
    return null;
  return parts[1] ?? null;
}

/** `/genres/creampie/` with section `genres` → `creampie`. Any section when `section` is null. */
export function refSlugOf(href: string | undefined, section: string | null): string | null {
  const parts = siteSegments(href);
  if (parts === null || parts.length !== 2) return null;
  if (section !== null && parts[0] !== section) return null;
  return parts[1] ?? null;
}

/** The named links in `scope` (at its top level or inside it) that point to `/{section}/{slug}/`. */
export function refsIn($: CheerioAPI, scope: Cheerio<AnyNode>, section: string | null): JavRef[] {
  const refs: JavRef[] = [];
  const seen = new Set<string>();
  scope
    .filter('a[href]')
    .add(scope.find('a[href]'))
    .each((_, a) => {
      const slug = refSlugOf($(a).attr('href'), section);
      if (slug === null || seen.has(slug)) return;
      seen.add(slug);
      refs.push({ slug, name: clean($(a).text()) || slug });
    });
  return refs;
}

/** The first `YYYY-MM-DD` in a text, or null. */
export function dateIn(text: string): string | null {
  return /\b(\d{4}-\d{2}-\d{2})\b/.exec(text)?.[1] ?? null;
}

/** The first whole number in a text, or null. */
export function numberIn(text: string): number | null {
  const match = /\d+/.exec(text);
  return match ? Number(match[0]) : null;
}

/** The page's main column. The sidebar and footer never hold catalogue cards. */
export function mainOf($: CheerioAPI): Cheerio<AnyNode> {
  const main = $('main').first();
  return main.length > 0 ? main : $.root();
}

/** The highest page number in the page's pagination links (`/page/N/`, `?paged=N`, `?ipage=N`), or null. */
export function lastPageOf($: CheerioAPI): number | null {
  let last: number | null = null;
  $('.pagination a[href]').each((_, element) => {
    const href = $(element).attr('href') ?? '';
    const match = /\/page\/(\d+)\/|[?&](?:paged|ipage|_paged)=(\d+)/.exec(href);
    if (!match) return;
    const n = Number(match[1] ?? match[2]);
    if (last === null || n > last) last = n;
  });
  return last;
}

/** True when the page links to a page after `page`. */
export function hasNextPage($: CheerioAPI, page: number): boolean {
  const last = lastPageOf($);
  return last !== null && last > page;
}

/**
 * The `<b>Label:</b> value` pairs inside `scope`, keyed by the label without its colon. The value
 * is either the rest of the `<b>`'s paragraph (movie pages), the next table cell (uncensored movie
 * pages), or the text up to the next label or line break (idol profiles).
 */
export function labelledValues(
  $: CheerioAPI,
  scope: Cheerio<AnyNode>,
): Map<string, Cheerio<AnyNode>> {
  const values = new Map<string, Cheerio<AnyNode>>();
  scope.find('b').each((_, b) => {
    const label = clean($(b).text()).replace(/:$/, '').trim();
    if (label.length === 0 || values.has(label)) return;
    const parent = $(b).parent();
    if (parent.is('td')) {
      values.set(label, parent.next('td'));
      return;
    }
    const nodes: AnyNode[] = [];
    for (let node = b.nextSibling; node !== null; node = node.nextSibling) {
      if (
        isElement(node) &&
        (node.tagName === 'b' || node.tagName === 'br' || node.tagName === 'p')
      )
        break;
      nodes.push(node);
    }
    values.set(label, $(nodes));
  });
  return values;
}

const isElement = (node: AnyNode): node is Element => 'tagName' in node;

/** The value of a label as text, with the `-` separators and `?` (unknown) removed; null when empty. */
export function labelText(values: Map<string, Cheerio<AnyNode>>, label: string): string | null {
  const value = values.get(label);
  if (value === undefined) return null;
  const text = clean(value.text()).replace(/^[-\s]+|[-\s]+$/g, '');
  return text.length === 0 || text === '?' ? null : text;
}

/** The text of each link in a label's value. */
export function labelLinks(
  $: CheerioAPI,
  values: Map<string, Cheerio<AnyNode>>,
  label: string,
): string[] {
  const value = values.get(label);
  if (value === undefined) return [];
  const links = value.filter('a').add(value.find('a'));
  return links
    .map((_, a) => clean($(a).text()))
    .get()
    .filter((t) => t.length > 0);
}
