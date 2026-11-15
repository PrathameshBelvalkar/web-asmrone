import { Link } from 'react-router-dom';
import type { MangaTag, MangaTagKind } from '../../api/types';
import { formatCount, KIND_LABEL, tagRoute } from '../../lib/manga';

const ORDER: MangaTagKind[] = ['parody', 'character', 'tag', 'artist', 'group', 'language', 'category'];

/** A gallery's tags, one row per kind, each chip opening that tag's list. */
export function TagChips({ tags }: { tags: MangaTag[] }) {
  return (
    <dl className="space-y-4">
      {ORDER.map((kind) => {
        const ofKind = tags.filter((t) => t.kind === kind);
        if (ofKind.length === 0) return null;
        return (
          <div key={kind} className="grid gap-2 sm:grid-cols-[7rem_1fr] sm:items-start">
            <dt className="text-sm text-muted-foreground sm:pt-1.5">{ofKind.length > 1 ? KIND_LABEL[kind].many : KIND_LABEL[kind].one}</dt>
            <dd className="flex flex-wrap gap-2">
              {ofKind.map((t) => (
                <Link
                  key={`${t.kind}:${t.slug}`}
                  to={tagRoute(t.kind, t.slug)}
                  className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3.5 text-sm text-foreground/90 transition-colors hover:border-white/25 hover:bg-white/[0.12]"
                >
                  <span className="truncate">{t.name}</span>
                  {t.count !== null && <span className="text-xs text-muted-foreground tnum">{formatCount(t.count)}</span>}
                </Link>
              ))}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
