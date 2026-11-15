/** A row of mutually exclusive options (sort orders, index kinds), styled like the feed's chip tabs. */
export function Segmented<T extends string>({
  value, options, onChange, label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="no-scrollbar -mx-1 flex max-w-full gap-2 overflow-x-auto px-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`h-9 shrink-0 rounded-lg border px-4 text-sm font-medium transition-colors duration-150 ${active ? 'border-transparent bg-white text-black' : 'border-white/10 bg-white/[0.08] text-foreground hover:bg-white/[0.14]'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
