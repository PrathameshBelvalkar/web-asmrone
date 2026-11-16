import { Link } from 'react-router-dom';
import type { JavNewsItem } from '../../api/types';
import { formatDate, newsRoute } from '../../lib/jav';
import { JavImage } from './JavImage';

/** A news post: its picture, categories, title, date and summary. */
export function NewsCard({ item }: { item: JavNewsItem }) {
  return (
    <Link
      to={newsRoute(item.path)}
      className="group grid gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3 transition-colors hover:border-white/15 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[minmax(0,15rem)_1fr] sm:p-4"
    >
      <JavImage src={item.image} className="aspect-[450/236] w-full rounded-xl" />
      <div className="min-w-0 py-1">
        {item.categories.length > 0 && (
          <p className="mb-2 flex flex-wrap gap-1.5">
            {item.categories.map((c) => (
              <span key={c.slug} className="rounded-md bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                {c.name}
              </span>
            ))}
          </p>
        )}
        <h2 className="text-balance text-lg font-semibold leading-snug">{item.title}</h2>
        <p className="mt-1 text-xs text-muted-foreground tnum">{formatDate(item.date)}</p>
        {item.summary && <p className="mt-2 line-clamp-3 text-sm text-foreground/75">{item.summary}</p>}
      </div>
    </Link>
  );
}
