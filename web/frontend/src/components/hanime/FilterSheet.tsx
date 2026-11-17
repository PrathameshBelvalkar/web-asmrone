import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Minus, Plus, SlidersHorizontal, X } from 'lucide-react';
import { hanimeStudiosOptions, hanimeTagsOptions } from '../../api/queries';
import type { HanimeBrowse } from '../../api/types';
import { activeFilters, tagLabel } from '../../lib/hanime';
import { Segmented } from '../manga/Segmented';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet';

const PILL = 'inline-flex h-8 items-center gap-1 rounded-full border px-3 text-sm transition-colors';
const OFF = 'border-white/10 bg-white/[0.06] hover:bg-white/[0.12]';
const thisYear = new Date().getUTCFullYear();

/**
 * Browse's filters: a button that opens a side sheet, and a removable chip per active filter. A tag
 * chip goes off → include → exclude → off; studios are picked from a list with a filter box.
 */
export function FilterSheet({ browse, onChange }: { browse: HanimeBrowse; onChange: (next: HanimeBrowse) => void }) {
  const [open, setOpen] = useState(false);
  const [studioFilter, setStudioFilter] = useState('');
  const tags = useQuery(hanimeTagsOptions());
  const studios = useQuery(hanimeStudiosOptions());
  const count = activeFilters(browse);

  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of tags.data ?? []) for (const t of g.tags) map.set(`tag:${t.slug}`, tagLabel(t.name));
    for (const s of studios.data ?? []) map.set(`studio:${s.slug}`, s.name);
    return map;
  }, [tags.data, studios.data]);
  const name = (kind: 'tag' | 'studio', slug: string) => names.get(`${kind}:${slug}`) ?? slug.replace(/-/g, ' ');

  const cycleTag = (slug: string) => {
    if (browse.tags.includes(slug)) {
      onChange({ ...browse, tags: browse.tags.filter((t) => t !== slug), exclude: [...browse.exclude, slug] });
    } else if (browse.exclude.includes(slug)) {
      onChange({ ...browse, exclude: browse.exclude.filter((t) => t !== slug) });
    } else {
      onChange({ ...browse, tags: [...browse.tags, slug] });
    }
  };
  const toggleStudio = (slug: string) =>
    onChange({
      ...browse,
      studios: browse.studios.includes(slug) ? browse.studios.filter((s) => s !== slug) : [...browse.studios, slug],
    });
  const [from, to] = (browse.year ?? '').split(',');
  const setYears = (a: string, b: string) => {
    const lo = a || b;
    const hi = b || a;
    onChange({ ...browse, year: lo ? (lo === hi ? lo : `${lo},${hi}`) : undefined });
  };
  const needle = studioFilter.trim().toLowerCase();
  const studioList = (studios.data ?? []).filter((s) => !needle || s.name.toLowerCase().includes(needle));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.08] px-4 text-sm font-medium hover:bg-white/[0.14]"
          >
            <SlidersHorizontal size={16} aria-hidden /> Filters
            {count > 0 && <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground tnum">{count}</span>}
          </button>
        </SheetTrigger>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Filter titles</SheetTitle>
            <SheetDescription>Tap a tag once to include it, again to leave it out, and a third time to clear it.</SheetDescription>
          </SheetHeader>
          <div className="space-y-6 px-4 pb-8">
            {browse.tags.length > 1 && (
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Titles with</legend>
                <Segmented<'and' | 'or'>
                  label="Tag match"
                  value={browse.tagMode}
                  onChange={(v) => onChange({ ...browse, tagMode: v })}
                  options={[
                    { value: 'and', label: 'All chosen tags' },
                    { value: 'or', label: 'Any chosen tag' },
                  ]}
                />
              </fieldset>
            )}
            {(tags.data ?? []).map((g) => (
              <fieldset key={g.group}>
                <legend className="mb-2 text-sm font-medium">{g.group}</legend>
                <div className="flex flex-wrap gap-2">
                  {g.tags.map((t) => {
                    const on = browse.tags.includes(t.slug);
                    const off = browse.exclude.includes(t.slug);
                    return (
                      <button
                        key={t.slug}
                        type="button"
                        aria-pressed={on ? 'true' : off ? 'mixed' : 'false'}
                        aria-label={`${tagLabel(t.name)}${on ? ', included' : off ? ', left out' : ''}`}
                        onClick={() => cycleTag(t.slug)}
                        className={`${PILL} ${on ? 'border-transparent bg-white text-black' : off ? 'border-red-400/40 bg-red-500/15 text-red-200 line-through' : OFF}`}
                      >
                        {on && <Plus size={13} aria-hidden />}
                        {off && <Minus size={13} aria-hidden />}
                        {tagLabel(t.name)}
                        <span className="text-xs opacity-60 tnum">{t.count}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Release year</legend>
              <div className="flex items-center gap-2">
                <YearSelect label="From" value={from ?? ''} onChange={(v) => setYears(v, to ?? '')} />
                <span className="text-muted-foreground">–</span>
                <YearSelect label="To" value={to ?? from ?? ''} onChange={(v) => setYears(from ?? '', v)} />
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Studios</legend>
              <input
                value={studioFilter}
                onChange={(e) => setStudioFilter(e.target.value)}
                placeholder="Filter studios"
                aria-label="Filter studios"
                className="mb-2 h-9 w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 text-sm outline-none focus:border-white/25"
              />
              <div className="max-h-64 space-y-0.5 overflow-y-auto pr-1">
                {studioList.map((s) => (
                  <label key={s.slug} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-white/[0.06]">
                    <input type="checkbox" checked={browse.studios.includes(s.slug)} onChange={() => toggleStudio(s.slug)} />
                    <span className="flex-1 truncate">{s.name}</span>
                    <span className="text-xs text-muted-foreground tnum">{s.count}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {count > 0 && (
              <button
                type="button"
                onClick={() => onChange({ ...browse, tags: [], exclude: [], studios: [], censored: 'all', year: undefined, series: undefined })}
                className="text-sm text-primary hover:underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {browse.tags.map((t) => (
        <RemovableChip key={`t:${t}`} label={name('tag', t)} onRemove={() => onChange({ ...browse, tags: browse.tags.filter((x) => x !== t) })} />
      ))}
      {browse.exclude.map((t) => (
        <RemovableChip key={`x:${t}`} label={`Not ${name('tag', t)}`} onRemove={() => onChange({ ...browse, exclude: browse.exclude.filter((x) => x !== t) })} />
      ))}
      {browse.studios.map((s) => (
        <RemovableChip key={`s:${s}`} label={name('studio', s)} onRemove={() => toggleStudio(s)} />
      ))}
      {browse.year && <RemovableChip label={browse.year.replace(',', '–')} onRemove={() => onChange({ ...browse, year: undefined })} />}
      {browse.series && <RemovableChip label={`Series: ${browse.series}`} onRemove={() => onChange({ ...browse, series: undefined })} />}
    </div>
  );
}

function RemovableChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remove ${label}`}
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] pl-3 pr-2 text-sm capitalize hover:bg-white/[0.12]"
    >
      {label}
      <X size={14} aria-hidden className="text-muted-foreground" />
    </button>
  );
}

function YearSelect({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <select
      aria-label={`Release year ${label.toLowerCase()}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-lg border border-white/10 bg-white/[0.06] px-2 text-sm"
    >
      <option value="">Any</option>
      {Array.from({ length: thisYear - 1983 }, (_, i) => String(thisYear - i)).map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </select>
  );
}
