import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen, Headphones, History, Trash2, X } from 'lucide-react';
import { Cover } from '../components/Cover';
import { MangaImage } from '../components/manga/MangaImage';
import { Segmented } from '../components/manga/Segmented';
import { Button, EmptyState, PageHeader } from '../components/ui';
import { useCrumbs } from '../lib/crumbs';
import { clearHistory, removeEntry, useHistory, type HistoryEntry, type ListenEntry, type ReadEntry } from '../lib/history';
import { galleryRoute, readerRoute } from '../lib/manga';

type Tab = 'asmr' | 'manga';
const TABS: { value: Tab; label: string }[] = [
  { value: 'asmr', label: 'ASMR' },
  { value: 'manga', label: 'Manga' },
];

/** "Today", "Yesterday", or the date, for the group headings. */
export function dayLabel(at: number, now = Date.now()): string {
  const day = (t: number) => {
    const d = new Date(t);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const diff = Math.round((day(now) - day(at)) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  const d = new Date(at);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString(undefined, { weekday: diff < 7 ? 'long' : undefined, day: 'numeric', month: 'long', year: sameYear ? undefined : 'numeric' });
}

const timeOf = (at: number) => new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/** Entries grouped by day, newest first. */
function byDay<T extends HistoryEntry>(entries: T[]): { label: string; items: T[] }[] {
  const groups: { label: string; items: T[] }[] = [];
  for (const e of entries) {
    const label = dayLabel(e.at);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(e);
    else groups.push({ label, items: [e] });
  }
  return groups;
}

/** What you listened to and read, newest first, with a tab for each. */
export function HistoryPage() {
  useCrumbs([{ label: 'Home', to: '/' }, { label: 'History' }]);
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'manga' ? 'manga' : 'asmr';
  const entries = useHistory((s) => s.entries);
  const shown = entries.filter((e) => e.kind === tab);

  return (
    <>
      <PageHeader
        title="History"
        actions={
          shown.length > 0 && (
            <Button
              icon={Trash2}
              onClick={() => {
                if (window.confirm(`Clear your ${tab === 'asmr' ? 'listening' : 'reading'} history?`)) clearHistory(tab);
              }}
            >
              Clear {tab === 'asmr' ? 'listening' : 'reading'} history
            </Button>
          )
        }
      />
      <div className="mb-6">
        <Segmented label="History type" value={tab} options={TABS} onChange={(t) => setParams(t === 'asmr' ? {} : { tab: t }, { replace: true })} />
      </div>

      {shown.length === 0 ? (
        tab === 'asmr' ? (
          <EmptyState icon={Headphones} title="Nothing listened to yet">
            Works you play show up here, newest first.
          </EmptyState>
        ) : (
          <EmptyState icon={BookOpen} title="Nothing read yet">
            Galleries you open in the reader show up here, with the page you stopped on.
          </EmptyState>
        )
      ) : (
        <div className="space-y-8">
          {byDay(shown).map((group) => (
            <section key={group.label} aria-label={group.label}>
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">{group.label}</h2>
              <ul className="space-y-1">
                {group.items.map((e) => (
                  <li key={`${e.kind}:${e.id}`}>{e.kind === 'asmr' ? <ListenRow entry={e} /> : e.kind === 'manga' ? <ReadRow entry={e} /> : null}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

const ROW = 'group relative flex items-center gap-3 rounded-xl px-2 py-2 transition-colors duration-150 hover:bg-white/[0.05]';

function RemoveButton({ entry }: { entry: HistoryEntry }) {
  return (
    <button
      type="button"
      onClick={() => removeEntry(entry.kind, entry.id)}
      aria-label={`Remove ${entry.title} from history`}
      title="Remove from history"
      className="relative z-[1] flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-[opacity,background-color] duration-150 hover:bg-white/10 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
    >
      <X size={16} aria-hidden />
    </button>
  );
}

function ListenRow({ entry }: { entry: ListenEntry }) {
  return (
    <div className={ROW}>
      <Link to={`/work/${encodeURIComponent(entry.id)}`} className="absolute inset-0 rounded-xl" aria-label={entry.title} />
      <Cover holder={entry.cover} className="size-14 shrink-0 shadow-md shadow-black/30" rounded="rounded-lg" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{entry.title}</p>
        <p className="truncate text-xs text-muted-foreground">{entry.artists}</p>
        {entry.trackTitle && entry.trackTitle !== entry.title && (
          <p className="truncate text-xs text-muted-foreground/80">
            <History size={11} className="mr-1 inline align-[-1px]" aria-hidden />
            {entry.trackTitle}
          </p>
        )}
      </div>
      <span className="shrink-0 text-xs tnum text-muted-foreground">{timeOf(entry.at)}</span>
      <RemoveButton entry={entry} />
    </div>
  );
}

function ReadRow({ entry }: { entry: ReadEntry }) {
  const finished = entry.pages > 0 && entry.page >= entry.pages;
  const progress = entry.pages > 0 ? Math.min(100, (entry.page / entry.pages) * 100) : 0;
  return (
    <div className={ROW}>
      <Link to={galleryRoute(entry.id)} className="absolute inset-0 rounded-xl" aria-label={entry.title} />
      <MangaImage
        src={entry.cover}
        fallbacks={entry.coverFallbacks}
        className="aspect-[3/4] w-12 shrink-0 overflow-hidden rounded-md bg-muted shadow-md shadow-black/30"
        imgClassName="h-full w-full object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium">{entry.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground tnum">
          {finished ? 'Finished' : entry.pages ? `Page ${entry.page} of ${entry.pages}` : `Page ${entry.page}`}
        </p>
        {entry.pages > 0 && (
          <div className="mt-1.5 h-1 w-full max-w-48 overflow-hidden rounded-full bg-white/10" aria-hidden>
            <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
      <span className="shrink-0 text-xs tnum text-muted-foreground max-sm:hidden">{timeOf(entry.at)}</span>
      <Link
        to={readerRoute(entry.id, finished ? 1 : entry.page)}
        className="relative z-[1] inline-flex h-8 shrink-0 items-center rounded-full border border-white/10 bg-white/[0.08] px-3 text-xs font-medium transition-colors hover:bg-white/[0.14]"
      >
        {finished ? 'Read again' : 'Continue'}
      </Link>
      <RemoveButton entry={entry} />
    </div>
  );
}
