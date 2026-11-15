import type { ReactNode } from 'react';
import { BookOpen, Columns2, Rows3 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReaderBackground, ReaderDirection, ReaderFit, ReaderMode, ReaderPrefs } from '../../lib/manga';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import { Switch } from '../ui/switch';
import { cn } from '@/lib/utils';

const MODES: { value: ReaderMode; label: string; icon: LucideIcon }[] = [
  { value: 'single', label: 'Single', icon: BookOpen },
  { value: 'double', label: 'Two pages', icon: Columns2 },
  { value: 'strip', label: 'Long strip', icon: Rows3 },
];
const DIRECTIONS: { value: ReaderDirection; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'rtl', label: 'Right to left' },
  { value: 'ltr', label: 'Left to right' },
];
const FITS: { value: ReaderFit; label: string }[] = [
  { value: 'height', label: 'Fit screen' },
  { value: 'width', label: 'Fit width' },
  { value: 'original', label: 'Original' },
];
const BACKGROUNDS: { value: ReaderBackground; label: string; swatch: string }[] = [
  { value: 'black', label: 'Black', swatch: 'bg-black' },
  { value: 'gray', label: 'Grey', swatch: 'bg-neutral-800' },
  { value: 'white', label: 'White', swatch: 'bg-neutral-100' },
];

const SHORTCUTS: [string, string][] = [
  ['→ or D', 'Next page'],
  ['← or A', 'Previous page'],
  ['Space, Page Down', 'Next page'],
  ['Shift Space, Page Up', 'Previous page'],
  ['Home, End', 'First, last page'],
  ['M', 'Change reading mode'],
  ['T', 'Pages'],
  ['S', 'Settings'],
  ['F', 'Fullscreen'],
  ['Esc', 'Back to the gallery'],
];

/** The reader's settings, in a side panel. Every change applies at once and is remembered. */
export function ReaderSettings({
  open, onOpenChange, prefs, onChange, autoIsRtl,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefs: ReaderPrefs;
  onChange: (change: Partial<ReaderPrefs>) => void;
  /** What `auto` means for this gallery, shown under the direction choice. */
  autoIsRtl: boolean;
}) {
  const paged = prefs.mode !== 'strip';
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[22rem] max-w-[90vw] gap-0 overflow-y-auto sm:max-w-[22rem]"
        // Focusing the first choice on open would ring it and make it look selected.
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="border-b border-white/10">
          <SheetTitle>Reader settings</SheetTitle>
          <SheetDescription>Changes apply straight away and are remembered.</SheetDescription>
        </SheetHeader>

        <div className="space-y-7 p-4">
          <Section title="Reading mode">
            <div className="grid grid-cols-3 gap-2">
              {MODES.map((m) => {
                const active = prefs.mode === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onChange({ mode: m.value })}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-xl border px-2 py-3 text-xs font-medium transition-colors',
                      active ? 'border-primary bg-primary/15 text-foreground' : 'border-white/10 bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08] hover:text-foreground',
                    )}
                  >
                    <m.icon size={20} className={active ? 'text-primary' : ''} aria-hidden />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </Section>

          {prefs.mode === 'double' && (
            <Section
              title="Page order"
              note={
                prefs.direction === 'auto'
                  ? `Auto lays this gallery out ${autoIsRtl ? 'right to left, like Japanese manga: the earlier page is on the right' : 'left to right, like a Western comic'}. The right side and → always go to the next pages.`
                  : 'The right side and → always go to the next pages.'
              }
            >
              <Choice value={prefs.direction} options={DIRECTIONS} onChange={(direction) => onChange({ direction })} />
            </Section>
          )}

          {prefs.mode === 'double' && (
            <Section title="Two pages">
              <ToggleRow
                label="Cover on its own"
                hint="Turn off if pages are paired the wrong way round, so a spread shows across two screens."
                checked={prefs.coverAlone}
                onChange={(coverAlone) => onChange({ coverAlone })}
              />
            </Section>
          )}

          {paged && (
            <Section title="Page size">
              <Choice value={prefs.fit} options={FITS} onChange={(fit) => onChange({ fit })} />
            </Section>
          )}

          {!paged && (
            <Section title="Long strip">
              <ToggleRow label="Gaps between pages" checked={prefs.stripGap} onChange={(stripGap) => onChange({ stripGap })} />
            </Section>
          )}

          <Section title="Background">
            <div className="flex gap-3">
              {BACKGROUNDS.map((b) => {
                const active = prefs.background === b.value;
                return (
                  <button
                    key={b.value}
                    type="button"
                    aria-pressed={active}
                    aria-label={`${b.label} background`}
                    onClick={() => onChange({ background: b.value })}
                    className="flex flex-col items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <span
                      className={cn(
                        'size-10 rounded-full border border-white/20 ring-offset-2 ring-offset-background transition-shadow',
                        b.swatch,
                        active && 'ring-2 ring-primary',
                      )}
                    />
                    <span className={active ? 'text-foreground' : ''}>{b.label}</span>
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="Keyboard">
            <dl className="space-y-2 text-sm">
              {SHORTCUTS.map(([keys, what]) => (
                <div key={keys} className="flex items-baseline justify-between gap-4">
                  <dt className="shrink-0 font-mono text-xs text-foreground/80">{keys}</dt>
                  <dd className="text-right text-xs text-muted-foreground">{what}</dd>
                </div>
              ))}
            </dl>
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-medium text-muted-foreground">{title}</h3>
      {children}
      {note && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{note}</p>}
    </section>
  );
}

function Choice<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'h-8 rounded-lg px-2 text-xs font-medium transition-colors',
              active ? 'bg-white text-black' : 'text-muted-foreground hover:bg-white/[0.08] hover:text-foreground',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span className="min-w-0">
        <span className="block text-sm">{label}</span>
        {hint && <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{hint}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} className="mt-0.5" />
    </label>
  );
}
