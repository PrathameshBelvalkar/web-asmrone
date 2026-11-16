import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { javNewsPostOptions } from '../../api/queries';
import type { JavRankedEntry } from '../../api/types';
import { isRefused, Unavailable } from '../../components/jav/grid';
import { JavImage } from '../../components/jav/JavImage';
import { ErrorState } from '../../components/States';
import { Skeleton } from '../../components/ui';
import { useDetailCrumbs } from '../../lib/crumbs';
import { formatDate, idolRoute, JAV_HOME, movieRoute } from '../../lib/jav';

/** A news post: its title and first paragraph, then the weekly ranking as numbered movies or idols. */
export function JavNewsPostPage() {
  const { yyyy = '', mm = '', dd = '', slug = '' } = useParams();
  const path = `${yyyy}/${mm}/${dd}/${slug}`;
  const post = useQuery(javNewsPostOptions(path));
  const p = post.data;
  useDetailCrumbs(p?.title ?? 'News', [JAV_HOME, { label: 'News', to: '/jav' }]);

  if (isRefused(post.error)) return <Unavailable what="This post" />;
  if (post.error) return <ErrorState error={post.error} onRetry={() => void post.refetch()} />;
  if (!p) {
    return (
      <div className="max-w-3xl space-y-4" aria-hidden>
        <Skeleton className="h-10 w-4/5" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <article className="max-w-3xl">
      <header className="mb-8">
        <h1 className="text-balance text-3xl font-semibold tracking-[-0.01em] sm:text-4xl">{p.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground tnum">{formatDate(p.date)}</p>
        {p.intro && <p className="mt-5 text-base leading-relaxed text-foreground/85">{p.intro}</p>}
      </header>

      {p.ranked.length > 0 && (
        <ol className="stagger space-y-3">
          {p.ranked.map((entry, i) => (
            <li key={`${entry.type}:${entry.rank}`} style={{ '--i': i % 24 } as React.CSSProperties}>
              <RankedRow entry={entry} />
            </li>
          ))}
        </ol>
      )}

      <a
        href={p.url}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-10 inline-flex items-center gap-2 text-sm text-primary hover:underline"
      >
        Read on javdatabase.com <ExternalLink size={14} aria-hidden />
      </a>
    </article>
  );
}

function RankedRow({ entry }: { entry: JavRankedEntry }) {
  const row =
    'flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3 transition-colors hover:border-white/15 hover:bg-white/[0.06]';
  const rank = <span className="w-10 shrink-0 text-center text-2xl font-bold text-foreground/60 tnum">{entry.rank}</span>;
  if (entry.type === 'idol') {
    const idol = entry.idol;
    return (
      <Link to={idolRoute(idol.slug)} className={row}>
        {rank}
        <JavImage src={idol.photo} className="size-16 shrink-0 rounded-full" imgClassName="h-full w-full object-cover object-top" />
        <div className="min-w-0">
          <p className="truncate font-semibold">{idol.name}</p>
          {idol.age !== null && <p className="text-sm text-muted-foreground">Age {idol.age}</p>}
        </div>
      </Link>
    );
  }
  const movie = entry.movie;
  return (
    <Link to={movieRoute(movie.kind, movie.slug)} className={row}>
      {rank}
      <JavImage src={movie.cover} className="aspect-[147/200] w-16 shrink-0 rounded-lg" />
      <div className="min-w-0">
        {movie.dvdId && <p className="font-semibold tracking-wide tnum">{movie.dvdId}</p>}
        <p className="line-clamp-2 text-sm text-foreground/75">{movie.title}</p>
        {movie.studio && <p className="mt-0.5 text-xs text-muted-foreground">{movie.studio.name}</p>}
      </div>
    </Link>
  );
}
