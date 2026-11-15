/** Three bouncing bars marking what's playing. Uses the current text colour. */
export function Equaliser({ className = '' }: { className?: string }) {
  return (
    <span className={`flex h-4 items-end gap-0.5 ${className}`} aria-label="Playing" role="img">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[3px] origin-bottom rounded-full bg-current"
          style={{ height: '100%', animation: `eq 900ms ease-in-out ${i * 150}ms infinite` }}
        />
      ))}
    </span>
  );
}
