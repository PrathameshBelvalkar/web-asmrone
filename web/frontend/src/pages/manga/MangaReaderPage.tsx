import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Ban, GalleryThumbnails, Maximize, Minimize } from 'lucide-react';
import { ApiError } from '../../api/client';
import { mangaGalleryOptions } from '../../api/queries';
import type { MangaPage } from '../../api/types';
import { MangaImage } from '../../components/manga/MangaImage';
import { ErrorState, Spinner } from '../../components/States';
import { EmptyState, IconButton } from '../../components/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../components/ui/sheet';
import { Slider } from '../../components/ui/slider';
import { useCrumbs } from '../../lib/crumbs';
import {
  galleryRoute,
  loadPrefs,
  readerAction,
  readerRoute,
  saveResume,
  savePrefs,
  spreadAt,
  stepPage,
  type ReaderFit,
  type ReaderMode,
  type ReaderPrefs,
} from '../../lib/manga';

const MODES: { value: ReaderMode; label: string }[] = [
  { value: 'single', label: 'Single page' },
  { value: 'double', label: 'Two pages' },
  { value: 'strip', label: 'Long strip' },
];
const FITS: { value: ReaderFit; label: string }[] = [
  { value: 'height', label: 'Fit height' },
  { value: 'width', label: 'Fit width' },
  { value: 'original', label: 'Original size' },
];
const NEXT_MODE: Record<ReaderMode, ReaderMode> = { single: 'double', double: 'strip', strip: 'single' };

/**
 * The reader. Covers the whole window. Single page, two pages (cover alone, then pairs, optionally
 * right to left) or a long vertical strip. Keys: arrows / A D / PgUp PgDn to turn, Home and End, F for
 * fullscreen, M for mode, T for thumbnails, Esc to leave. Your page is remembered per gallery.
 */
export function MangaReaderPage() {
  const { id = '', page: pageParam } = useParams();
  const navigate = useNavigate();
  const gallery = useQuery(mangaGalleryOptions(id));
  const g = gallery.data;
  const total = g?.pages.length ?? 0;
  const page = Math.min(Math.max(Number(pageParam) || 1, 1), Math.max(total, 1));
  useCrumbs([
    { label: 'Manga & Doujinshi', to: '/manga' },
    { label: g?.prettyTitle ?? g?.title ?? `#${id}`, to: galleryRoute(id) },
    { label: `Page ${page}` },
  ]);

  const [prefs, setPrefs] = useState<ReaderPrefs>(loadPrefs);
  const updatePrefs = (change: Partial<ReaderPrefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...change };
      savePrefs(next);
      return next;
    });
  };
  const [thumbsOpen, setThumbsOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  /** Set when the page changes because the strip scrolled, so the strip isn't scrolled back. */
  const fromScroll = useRef(false);

  const goTo = useCallback(
    (n: number, viaScroll = false) => {
      if (!total) return;
      const target = Math.min(Math.max(n, 1), total);
      fromScroll.current = viaScroll;
      navigate(readerRoute(id, target), { replace: true });
    },
    [id, navigate, total],
  );

  // Remember the page.
  useEffect(() => {
    if (g) saveResume(g.id, page);
  }, [g, page]);

  // Load the next three pages and the one before ahead of time.
  useEffect(() => {
    if (!g || prefs.mode === 'strip') return;
    for (const n of [page + 1, page + 2, page + 3, page - 1]) {
      const p = g.pages[n - 1];
      if (p) new Image().src = p.url;
    }
  }, [g, page, prefs.mode]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    // The whole document, not the reader, so menus and the page sheet (portalled to <body>) still show.
    else void document.documentElement.requestFullscreen?.();
  }, []);

  // Keys. Listens in the capture phase so the player's Space shortcut doesn't fire while reading.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // The page sheet handles its own keys (Esc closes it).
      if (thumbsOpen) return;
      if (e.code === 'Space') {
        e.stopPropagation();
        if (prefs.mode !== 'strip') {
          e.preventDefault();
          goTo(stepPage(page, total, prefs.mode, e.shiftKey ? -1 : 1));
        }
        return;
      }
      const action = readerAction(e.key, prefs.rtl && prefs.mode !== 'strip');
      if (action === null) return;
      if (prefs.mode === 'strip' && (action === 'next' || action === 'prev') && e.key.startsWith('Page')) return;
      e.preventDefault();
      e.stopPropagation();
      switch (action) {
        case 'next':
        case 'prev':
          goTo(stepPage(page, total, prefs.mode, action === 'next' ? 1 : -1));
          break;
        case 'first':
          goTo(1);
          break;
        case 'last':
          goTo(total);
          break;
        case 'fullscreen':
          toggleFullscreen();
          break;
        case 'mode':
          updatePrefs({ mode: NEXT_MODE[prefs.mode] });
          break;
        case 'thumbs':
          setThumbsOpen((o) => !o);
          break;
        case 'close':
          if (document.fullscreenElement) void document.exitFullscreen();
          else navigate(galleryRoute(id));
          break;
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [goTo, id, navigate, page, prefs.mode, prefs.rtl, thumbsOpen, toggleFullscreen, total]);

  if (gallery.error instanceof ApiError && gallery.error.status === 451) {
    return (
      <EmptyState icon={Ban} title="Not available">
        This gallery has content Echo doesn't show.
      </EmptyState>
    );
  }
  if (gallery.error) return <ErrorState error={gallery.error} onRetry={() => void gallery.refetch()} />;
  if (!g) return <Spinner label="Opening gallery" />;

  const spread = spreadAt(page, total, prefs.mode);
  const shown = prefs.rtl ? [...spread].reverse() : spread;
  const turn = (side: 'left' | 'right') => {
    const forward = prefs.rtl ? side === 'left' : side === 'right';
    goTo(stepPage(page, total, prefs.mode, forward ? 1 : -1));
  };

  // Portalled to <body>: the page content sits in its own stacking layer under the header, sidebar
  // and player bar, and the reader has to cover all of them.
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-foreground" role="dialog" aria-label={`Reading ${g.title}`}>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-white/10 bg-background/80 px-2 backdrop-blur-xl sm:px-4">
        <IconButton icon={ArrowLeft} label="Back to gallery" size="sm" className="text-foreground/70 hover:text-foreground" onClick={() => navigate(galleryRoute(id))} />
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground/90">{g.prettyTitle ?? g.title}</p>
        <span className="hidden text-sm text-muted-foreground tnum sm:inline" aria-live="polite">
          {spread.length > 1 ? `${spread[0]}–${spread[1]}` : page} / {total}
        </span>
        <ReaderSelect label="Mode" value={prefs.mode} options={MODES} onChange={(mode) => updatePrefs({ mode })} />
        {prefs.mode !== 'strip' && (
          <ReaderSelect label="Fit" value={prefs.fit} options={FITS} onChange={(fit) => updatePrefs({ fit })} />
        )}
        {prefs.mode !== 'strip' && (
          <button
            type="button"
            aria-pressed={prefs.rtl}
            onClick={() => updatePrefs({ rtl: !prefs.rtl })}
            title="Right to left (Japanese reading order)"
            className={`hidden h-8 rounded-lg border px-3 text-xs font-medium transition-colors sm:inline ${prefs.rtl ? 'border-transparent bg-white text-black' : 'border-white/10 bg-white/[0.08] text-foreground hover:bg-white/[0.14]'}`}
          >
            RTL
          </button>
        )}
        <IconButton icon={GalleryThumbnails} label="Pages (T)" size="sm" className="text-foreground/70 hover:text-foreground" onClick={() => setThumbsOpen(true)} />
        <IconButton
          icon={fullscreen ? Minimize : Maximize}
          label={fullscreen ? 'Leave fullscreen (F)' : 'Fullscreen (F)'}
          size="sm"
          className="text-foreground/70 hover:text-foreground"
          onClick={toggleFullscreen}
        />
      </header>

      {prefs.mode === 'strip' ? (
        <Strip pages={g.pages} page={page} fromScroll={fromScroll} onVisible={(n) => goTo(n, true)} />
      ) : (
        <div
          className={`relative min-h-0 flex-1 ${prefs.fit === 'height' ? 'overflow-hidden' : 'overflow-auto'}`}
          onClick={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            turn(e.clientX - box.left < box.width / 2 ? 'left' : 'right');
          }}
        >
          <div className={`flex min-h-full justify-center gap-1 ${prefs.fit === 'height' ? 'h-full items-center p-2' : 'items-start'}`}>
            {shown.map((n) => {
              const p = g.pages[n - 1];
              return p ? <PageView key={p.url} page={p} fit={prefs.fit} share={shown.length} /> : null;
            })}
          </div>
        </div>
      )}

      <footer className="flex h-14 shrink-0 items-center gap-3 border-t border-white/10 bg-background/80 px-4 backdrop-blur-xl">
        <span className="w-8 text-right text-xs text-muted-foreground tnum">{prefs.rtl ? total : 1}</span>
        <Slider
          min={1}
          max={Math.max(total, 1)}
          step={1}
          inverted={prefs.rtl && prefs.mode !== 'strip'}
          value={[page]}
          onValueChange={([v]) => v !== undefined && goTo(v)}
          aria-label="Page"
          className="flex-1"
        />
        <span className="w-8 text-xs text-muted-foreground tnum">{prefs.rtl ? 1 : total}</span>
      </footer>

      <Sheet open={thumbsOpen} onOpenChange={setThumbsOpen}>
        <SheetContent side="bottom" className="max-h-[70svh]">
          <SheetHeader>
            <SheetTitle>Pages</SheetTitle>
            <SheetDescription>Pick a page to jump to it.</SheetDescription>
          </SheetHeader>
          <ol className="scroll-thin grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-3 overflow-y-auto px-4 pb-6">
            {g.pages.map((p) => (
              <li key={p.n}>
                <button
                  type="button"
                  aria-current={spread.includes(p.n) ? 'page' : undefined}
                  onClick={() => {
                    goTo(p.n);
                    setThumbsOpen(false);
                  }}
                  className={`block w-full rounded-md ${spread.includes(p.n) ? 'ring-2 ring-primary' : ''}`}
                >
                  <MangaImage src={p.thumb} fallbacks={[p.url]} className="aspect-[1/1.41] w-full rounded-md" imgClassName="h-full w-full object-cover" />
                  <span className="mt-1 block text-center text-xs text-muted-foreground tnum">{p.n}</span>
                </button>
              </li>
            ))}
          </ol>
        </SheetContent>
      </Sheet>
    </div>,
    document.body,
  );
}

/** One page, boxed to its known size before the image loads so nothing jumps. */
function PageView({ page, fit, share }: { page: MangaPage; fit: ReaderFit; share: number }) {
  const ratio = page.width && page.height ? page.width / page.height : 1 / 1.41;
  const [retry, setRetry] = useState(0);
  const box =
    fit === 'height'
      ? { className: 'h-full', style: { aspectRatio: ratio, maxWidth: `${100 / share}%` } }
      : fit === 'width'
        ? { className: '', style: { aspectRatio: ratio, width: `${100 / share}%`, maxWidth: share > 1 ? undefined : '64rem' } }
        : { className: 'shrink-0', style: { aspectRatio: ratio, width: page.width ? `${page.width}px` : undefined } };
  return (
    <MangaImage
      key={retry}
      src={page.url}
      alt={`Page ${page.n}`}
      loading="eager"
      className={`${box.className} bg-white/[0.04]`}
      style={box.style}
      imgClassName="h-full w-full object-contain"
      onRetry={() => setRetry((r) => r + 1)}
    />
  );
}

/** Every page, one under the other. Scrolling sets the current page; jumping scrolls to it. */
function Strip({
  pages, page, fromScroll, onVisible,
}: {
  pages: MangaPage[];
  page: number;
  fromScroll: React.MutableRefObject<boolean>;
  onVisible: (n: number) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const refs = useMemo(() => new Map<number, HTMLElement>(), []);

  // Jump to the page when it changes from outside the strip (slider, thumbnails, keys, first open).
  useEffect(() => {
    if (fromScroll.current) {
      fromScroll.current = false;
      return;
    }
    refs.get(page)?.scrollIntoView({ block: 'start' });
  }, [page, refs, fromScroll]);

  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const top = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        const n = Number((top?.target as HTMLElement | undefined)?.dataset.page);
        if (n) onVisible(n);
      },
      { root, rootMargin: '-45% 0px -45% 0px' },
    );
    for (const el of refs.values()) observer.observe(el);
    return () => observer.disconnect();
  }, [onVisible, refs, pages]);

  return (
    <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-4xl flex-col">
        {pages.map((p) => (
          <div
            key={p.n}
            data-page={p.n}
            ref={(el) => {
              if (el) refs.set(p.n, el);
              else refs.delete(p.n);
            }}
          >
            <MangaImage
              src={p.url}
              alt={`Page ${p.n}`}
              className="w-full bg-white/[0.04]"
              style={{ aspectRatio: p.width && p.height ? p.width / p.height : 1 / 1.41 }}
              imgClassName="h-full w-full object-contain"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ReaderSelect<T extends string>({
  label, value, options, onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger aria-label={label} size="sm" className="h-8 w-auto rounded-lg border-white/10 bg-white/[0.08] text-xs font-medium hover:bg-white/[0.14]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
