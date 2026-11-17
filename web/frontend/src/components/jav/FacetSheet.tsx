import { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import type { JavIdolFilters } from '../../api/types';
import { filterValueLabel, IDOL_FILTERS } from '../../lib/jav';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet';

type ListKey = (typeof IDOL_FILTERS)[number]['key'];

const PILL = 'h-8 rounded-full border px-3 text-sm transition-colors';
const thisYear = new Date().getFullYear();

/** The idol filters: a button that opens a side sheet of toggles, and a removable chip per active value. */
export function FacetSheet({ filters, onChange }: { filters: JavIdolFilters; onChange: (next: JavIdolFilters) => void }) {
  const [open, setOpen] = useState(false);
  const active = IDOL_FILTERS.reduce((n, f) => n + (filters[f.key]?.length ?? 0), 0) + (filters.debutYear ? 1 : 0);

  const toggle = (key: ListKey, value: string) => {
    const current = filters[key] ?? [];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    onChange({ ...filters, [key]: next.length > 0 ? next : undefined });
  };
  const [from, to] = (filters.debutYear ?? '').split('-');
  const setYears = (a: string, b: string) => {
    const lo = a || b;
    const hi = b || a;
    onChange({ ...filters, debutYear: lo ? (lo === hi ? lo : `${lo}-${hi}`) : undefined });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.08] px-4 text-sm font-medium hover:bg-white/[0.14]"
          >
            <SlidersHorizontal size={16} aria-hidden /> Filters
            {active > 0 && <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground tnum">{active}</span>}
          </button>
        </SheetTrigger>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Filter idols</SheetTitle>
            <SheetDescription>Pick any number of values. The list updates as you choose.</SheetDescription>
          </SheetHeader>
          <div className="space-y-6 px-4 pb-8">
            {IDOL_FILTERS.map((f) => (
              <fieldset key={f.key}>
                <legend className="mb-2 text-sm font-medium">{f.label}</legend>
                <div className="flex flex-wrap gap-2">
                  {f.values.map((v) => {
                    const on = filters[f.key]?.includes(v.value) ?? false;
                    return (
                      <button
                        key={v.value}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggle(f.key, v.value)}
                        className={`${PILL} ${on ? 'border-transparent bg-white text-black' : 'border-white/10 bg-white/[0.06] hover:bg-white/[0.12]'}`}
                      >
                        {v.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Debut year</legend>
              <div className="flex items-center gap-2">
                <YearInput label="From" value={from ?? ''} onChange={(v) => setYears(v, to ?? '')} />
                <span className="text-muted-foreground">–</span>
                <YearInput label="To" value={to ?? from ?? ''} onChange={(v) => setYears(from ?? '', v)} />
              </div>
            </fieldset>
            {active > 0 && (
              <button type="button" onClick={() => onChange({})} className="text-sm text-primary hover:underline">
                Clear all filters
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {IDOL_FILTERS.flatMap((f) =>
        (filters[f.key] ?? []).map((value) => (
          <RemovableChip key={`${f.key}:${value}`} label={`${f.label}: ${filterValueLabel(f.key, value)}`} onRemove={() => toggle(f.key, value)} />
        )),
      )}
      {filters.debutYear && (
        <RemovableChip label={`Debut: ${filters.debutYear.replace('-', '–')}`} onRemove={() => onChange({ ...filters, debutYear: undefined })} />
      )}
    </div>
  );
}

function RemovableChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remove ${label}`}
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] pl-3 pr-2 text-sm hover:bg-white/[0.12]"
    >
      {label}
      <X size={14} aria-hidden className="text-muted-foreground" />
    </button>
  );
}

function YearInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <select
      aria-label={`Debut year ${label.toLowerCase()}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-lg border border-white/10 bg-white/[0.06] px-2 text-sm"
    >
      <option value="">Any</option>
      {Array.from({ length: thisYear - 1979 }, (_, i) => String(thisYear - i)).map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </select>
  );
}
