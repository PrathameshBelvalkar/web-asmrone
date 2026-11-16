import { Link } from 'react-router-dom';
import type { JavNewsItem } from '../../api/types';
import { formatDate, newsRoute } from '../../lib/jav';
import { JavImage } from './JavImage';

/**
 * How a post is drawn: `feature` is the large lead story, `tile` a card with the picture on top,
 * and `row` a full-width line with the picture on the left.
 */
export type NewsCardVariant = 'feature' | 'tile' | 'row';

const FRAME =
  'group flex h-full min-w-0 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] transition-colors hover:border-white/15 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** A news post: its picture, categories, title, date and summary. */
export function NewsCard({ item, variant = 'row' }: { item: JavNewsItem; variant?: NewsCardVariant }) {
  if (variant === 'feature') {
    return (
      <Link to={newsRoute(item.path)} className={`${FRAME} flex-col bg-black/60`}>
        {/* The picture takes whatever height the two rows beside it leave. */}
        <JavImage
          src={item.image}
          loading="eager"
          className="aspect-[450/236] w-full lg:aspect-auto lg:min-h-0 lg:flex-1"
          imgClassName="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div className="p-5 sm:p-7">
          <Categories item={item} />
          <h2 className="text-balance text-2xl font-semibold leading-tight sm:text-3xl">{item.title}</h2>
          <p className="mt-2 text-xs text-muted-foreground tnum">{formatDate(item.date)}</p>
          {item.summary && <p className="mt-3 line-clamp-3 max-w-2xl text-sm text-foreground/80">{item.summary}</p>}
        </div>
      </Link>
    );
  }

  if (variant === 'tile') {
    return (
      <Link to={newsRoute(item.path)} className={`${FRAME} flex-col`}>
        <JavImage
          src={item.image}
          className="aspect-[450/236] w-full shrink-0"
          imgClassName="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div className="flex min-w-0 flex-1 flex-col p-4">
          <Categories item={item} />
          <h2 className="line-clamp-3 text-balance text-base font-semibold leading-snug">{item.title}</h2>
          {item.summary && <p className="mt-2 line-clamp-2 text-sm text-foreground/70">{item.summary}</p>}
          <p className="mt-auto pt-3 text-xs text-muted-foreground tnum">{formatDate(item.date)}</p>
        </div>
      </Link>
    );
  }

  return (
    <Link to={newsRoute(item.path)} className={`${FRAME} flex-col gap-4 p-3 sm:flex-row sm:p-4`}>
      <JavImage src={item.image} className="aspect-[450/236] w-full shrink-0 rounded-xl sm:w-60" />
      <div className="min-w-0 py-1">
        <Categories item={item} />
        <h2 className="text-balance text-lg font-semibold leading-snug">{item.title}</h2>
        <p className="mt-1 text-xs text-muted-foreground tnum">{formatDate(item.date)}</p>
        {item.summary && <p className="mt-2 line-clamp-3 text-sm text-foreground/75">{item.summary}</p>}
      </div>
    </Link>
  );
}

function Categories({ item }: { item: JavNewsItem }) {
  if (item.categories.length === 0) return null;
  return (
    <p className="mb-2 flex flex-wrap gap-1.5">
      {item.categories.map((c) => (
        <span key={c.slug} className="rounded-md bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
          {c.name}
        </span>
      ))}
    </p>
  );
}
