import { load } from 'cheerio';
import { HASMR_SITE } from '../constants.js';
import { slugOf, type NamedLink } from './common.js';

export interface WeightedTag extends NamedLink {
  /** The site's tag-cloud font size: its own popularity weight (the cloud shows no counts). */
  readonly weight: number;
}

/** The tag cloud on `/tags`, heaviest (most used) first. */
export function parseTagCloud(html: string): WeightedTag[] {
  const $ = load(html);
  const byslug = new Map<string, WeightedTag>();
  $('a.tag-cloud-link').each((_, element) => {
    const link = $(element);
    const slug = slugOf(link.attr('href'), HASMR_SITE, 'tag');
    const name = link.text().replace(/\s+/g, ' ').trim();
    if (!slug || !name) return;
    const size = Number(/font-size:\s*([\d.]+)px/.exec(link.attr('style') ?? '')?.[1] ?? 0);
    const known = byslug.get(slug);
    if (!known || known.weight < size) byslug.set(slug, { slug, name, weight: size });
  });
  return [...byslug.values()].sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name));
}

/** The voice-actor list on `/voice-actors`, in the site's order. */
export function parseActorList(html: string): NamedLink[] {
  const $ = load(html);
  const seen = new Set<string>();
  const actors: NamedLink[] = [];
  $('a[href]').each((_, element) => {
    const link = $(element);
    const slug = slugOf(link.attr('href'), HASMR_SITE, 'actor');
    const name = link.text().replace(/\s+/g, ' ').trim();
    if (!slug || !name || name === '?' || seen.has(slug)) return;
    seen.add(slug);
    actors.push({ slug, name });
  });
  return actors;
}
