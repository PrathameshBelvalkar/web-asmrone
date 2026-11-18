import { Link } from 'react-router-dom';
import { Clapperboard, Play, Trash2, X } from 'lucide-react';
import type { JavKind } from '../../api/types';
import { JavImage } from '../../components/jav/JavImage';
import { Button, EmptyState, PageHeader } from '../../components/ui';
import { useCrumbs } from '../../lib/crumbs';
import { clearHistory, isFinished, removeEntry, useHistory, type WatchEntry } from '../../lib/history';
import { JAV_HOME, movieRoute, timeLeft } from '../../lib/jav';
import { dayLabel } from '../HistoryPage';

const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-x-5 gap-y-9';

/** The movies you've watched in NekoHub: the ones to carry on with first, then the ones you finished. */
export function JavLibraryPage() {
  useCrumbs([JAV_HOME, { label: 'Library' }]);
  const entries = useHistory((s) => s.entries).filter((e): e is WatchEntry => e.kind === 'jav');
  const watching = entries.filter((e) => !isFinished(e));
  const finished = entries.filter(isFinished);

  return (
    <>
      <PageHeader
        title="Library"
        meta={entries.length > 0 && `${entries.length} ${entries.length === 1 ? 'movie' : 'movies'}`}
        actions={
          entries.length > 0 && (
            <Button
              icon={Trash2}
              onClick={() => {
                if (window.confirm('Clear your watch history?')) clearHistory('jav');
              }}
            >
              Clear watch history
            </Button>
          )
        }
      />
      {entries.length === 0 ? (
        <EmptyState
          icon={Clapperboard}
          title="Nothing watched yet"
          action={
            <Link to="/jav/latest" className="inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:brightness-110">
              Browse the latest movies
            </Link>
          }
        >
          Movies you watch show up here, and you can pick them up where you left off.
        </EmptyState>
      ) : (
        <div className="space-y-12">
          {watching.length > 0 && (
            <section aria-labelledby="continue">
              <h2 id="continue" className="mb-5 text-2xl font-semibold">Continue watching</h2>
              <ul className={GRID}>
                {watching.map((e) => (
                  <li key={e.id}><WatchCard entry={e} /></li>
                ))}
              </ul>
            </section>
          )}
          {finished.length > 0 && (
            <section aria-labelledby="watched">
              <h2 id="watched" className="mb-5 text-2xl font-semibold">Watched</h2>
              <ul className={GRID}>
                {finished.map((e) => (
                  <li key={e.id}><WatchCard entry={e} /></li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </>
  );
}

/** A watched movie: the landscape cover with how far you got, opening straight into the player. */
function WatchCard({ entry }: { entry: WatchEntry }) {
  const done = isFinished(entry);
  const pct = entry.duration > 0 ? Math.min(100, (entry.position / entry.duration) * 100) : 0;
  const route = movieRoute(entry.movieKind as JavKind, entry.slug);
  const name = entry.dvdId ?? entry.title;
  return (
    <div className="group relative min-w-0">
      <Link
        to={done ? route : `${route}?play=movie`}
        title={entry.title}
        aria-label={done ? name : `Continue ${name}`}
        className="block rounded-xl focus-visible:outline-none"
      >
        <div className="relative overflow-hidden rounded-xl shadow-lg shadow-black/40 ring-offset-background group-focus-within:ring-2 group-focus-within:ring-ring group-focus-within:ring-offset-2">
          <JavImage src={entry.cover} className="aspect-[800/538] w-full bg-black/30" imgClassName="h-full w-full object-cover" />
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 transition-opacity duration-200 group-hover:opacity-100" aria-hidden />
          {!done && (
            <span
              className="pointer-events-none absolute left-1/2 top-1/2 flex size-12 -translate-x-1/2 -translate-y-1/2 scale-90 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-lg shadow-black/40 transition-[opacity,transform] duration-200 group-hover:scale-100 group-hover:opacity-100"
              aria-hidden
            >
              <Play size={20} fill="currentColor" className="ml-0.5" />
            </span>
          )}
          {pct > 0 && (
            <span className="absolute inset-x-0 bottom-0 z-[1] h-1 bg-white/25" aria-hidden>
              <span className="block h-full bg-primary" style={{ width: `${pct}%` }} />
            </span>
          )}
        </div>
        <p className="mt-3 truncate text-sm font-semibold tracking-wide tnum">{name}</p>
        {entry.dvdId && <p className="mt-0.5 line-clamp-1 text-sm text-foreground/70">{entry.title}</p>}
        <p className="mt-1 text-xs text-muted-foreground tnum">
          {done ? `Watched · ${dayLabel(entry.at)}` : timeLeft(entry.position, entry.duration)}
        </p>
      </Link>
      <button
        type="button"
        onClick={() => removeEntry('jav', entry.id)}
        aria-label={`Remove ${name} from your library`}
        title="Remove from library"
        className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-black/60 text-white/80 opacity-0 backdrop-blur transition-opacity duration-150 hover:text-white focus-visible:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
      >
        <X size={15} aria-hidden />
      </button>
    </div>
  );
}
