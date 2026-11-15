import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Ban, ChevronLeft, ChevronRight, GalleryThumbnails, Maximize, Minimize, RotateCcw, Settings2 } from 'lucide-react';
import { ApiError } from '../../api/client';
import { mangaGalleryOptions } from '../../api/queries';
import type { MangaGallery, MangaPage } from '../../api/types';
import { MangaImage } from '../../components/manga/MangaImage';
import { ReaderSettings } from '../../components/manga/ReaderSettings';
import { ErrorState, Spinner } from '../../components/States';
import { EmptyState, IconButton } from '../../components/ui';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../components/ui/sheet';
import { Slider } from '../../components/ui/slider';
import { useCrumbs } from '../../lib/crumbs';
import { recordRead } from '../../lib/history';
import {
  autoRtl,
  buildSpreads,
  galleryRoute,
  isRtl,
  loadPrefs,
  readerAction,
  readerRoute,
  saveResume,
  savePrefs,
  spreadIndexOf,
  tagRoute,
  type ReaderBackground,
  type ReaderFit,
  type ReaderMode,
  type ReaderPrefs,
} from '../../lib/manga';
import { cn } from '@/lib/utils';

const NEXT_MODE: Record<ReaderMode, ReaderMode> = { single: 'double', double: 'strip', strip: 'single' };
const STAGE_BG: Record<ReaderBackground, string> = { black: 'bg-black', gray: 'bg-neutral-800', white: 'bg-neutral-100' };
/** The bars fade out after this long without the mouse moving. */
const CHROME_IDLE_MS = 2500;
/** Taps in the outer 30 % on each side turn the page; the middle shows or hides the bars. */
const TAP_EDGE = 0.3;
/** How long the reading-order hint stays on a spread. */
const HINT_MS = 2600;

/**
 * The reader. Covers the whole window with the page(s) on a plain background; the top and bottom
 * bars fade out while you read and come back on a tap in the middle or when the mouse moves.
 *
 * Single page, two pages (as printed: cover alone, wide spreads alone, laid out right to left for
 * Japanese manga) or a long vertical strip. The right side, → and a swipe to the left always go
 * forward; the wheel turns too. Your page is remembered per gallery.
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
  const updatePrefs = useCallback((change: Partial<ReaderPrefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...change };
      savePrefs(next);
      return next;
    });
  }, []);
  const [thumbsOpen, setThumbsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [ended, setEnded] = useState(false);
  const [chrome, setChrome] = useState(true);
  /** Set when the page changes because the strip scrolled, so the strip isn't scrolled back. */
  const fromScroll = useRef(false);

  const strip = prefs.mode === 'strip';
  const rtl = !strip && !!g && isRtl(prefs.direction, g.tags);
  const spreads = useMemo(() => (g ? buildSpreads(g.pages, prefs.mode, prefs.coverAlone) : []), [g, prefs.mode, prefs.coverAlone]);
  const index = spreadIndexOf(spreads, page);
  const spread = spreads[index] ?? [page];

  // Which way to read a spread: an animated hint the first time two pages show, and again after
  // the page order or the mode changes.
  const [hint, setHint] = useState(false);
  const hintFor = useRef<string | null>(null);
  const orderKey = `${prefs.mode}:${rtl ? 'rtl' : 'ltr'}`;
  useEffect(() => {
    if (spread.length < 2 || hintFor.current === orderKey) return;
    hintFor.current = orderKey;
    setHint(true);
    const t = window.setTimeout(() => setHint(false), HINT_MS);
    return () => window.clearTimeout(t);
  }, [orderKey, spread.length]);

  const goTo = useCallback(
    (n: number, viaScroll = false) => {
      if (!total) return;
      setEnded(false);
      fromScroll.current = viaScroll;
      navigate(readerRoute(id, Math.min(Math.max(n, 1), total)), { replace: true });
    },
    [id, navigate, total],
  );

  /** Forward one spread (one page in the strip); past the last one, the end screen. */
  const next = useCallback(() => {
    const following = spreads[index + 1];
    if (following) goTo(following[0] ?? page);
    else setEnded(true);
  }, [goTo, index, page, spreads]);

  const prev = useCallback(() => {
    if (ended) return setEnded(false);
    const before = spreads[index - 1];
    if (before) goTo(before[0] ?? page);
  }, [ended, goTo, index, page, spreads]);

  // Remember the page, and put the gallery at the top of History.
  useEffect(() => {
    if (!g) return;
    saveResume(g.id, page);
    recordRead(g, page);
  }, [g, page]);

  // Load the next three pages and the one before ahead of time.
  useEffect(() => {
    if (!g || strip) return;
    const last = spread[spread.length - 1] ?? page;
    for (const n of [last + 1, last + 2, last + 3, spread[0]! - 1]) {
      const p = g.pages[n - 1];
      if (p) new Image().src = p.url;
    }
  }, [g, page, spread, strip]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    // The whole document, not the reader, so menus and panels (portalled to <body>) still show.
    else void document.documentElement.requestFullscreen?.();
  }, []);

  // The bars stay while a panel or the end screen is open, and fade after the mouse rests.
  const pinned = settingsOpen || thumbsOpen || ended;
  const idle = useRef<number | undefined>(undefined);
  const wake = useCallback(() => {
    setChrome(true);
    window.clearTimeout(idle.current);
    idle.current = window.setTimeout(() => setChrome(false), CHROME_IDLE_MS);
  }, []);
  useEffect(() => {
    wake();
    return () => window.clearTimeout(idle.current);
  }, [wake]);
  const showChrome = chrome || pinned;

  // Keys. Listens in the capture phase so the player's Space shortcut doesn't fire while reading.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Open panels handle their own keys (Esc closes them).
      if (thumbsOpen || settingsOpen) return;
      if (e.code === 'Space') {
        e.stopPropagation();
        if (!strip) {
          e.preventDefault();
          if (e.shiftKey) prev();
          else next();
        }
        return;
      }
      const action = readerAction(e.key);
      if (action === null) return;
      // In the strip, Page Up and Down scroll as usual.
      if (strip && (action === 'next' || action === 'prev') && e.key.startsWith('Page')) return;
      e.preventDefault();
      e.stopPropagation();
      switch (action) {
        case 'next':
          if (strip) goTo(page + 1);
          else next();
          break;
        case 'prev':
          if (strip) goTo(page - 1);
          else prev();
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
          setThumbsOpen(true);
          break;
        case 'settings':
          setSettingsOpen(true);
          break;
        case 'close':
          if (document.fullscreenElement) void document.exitFullscreen();
          else if (ended) setEnded(false);
          else navigate(galleryRoute(id));
          break;
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [ended, goTo, id, navigate, next, page, prefs.mode, prev, settingsOpen, strip, thumbsOpen, toggleFullscreen, total, updatePrefs]);

  if (gallery.error instanceof ApiError && gallery.error.status === 451) {
    return (
      <EmptyState icon={Ban} title="Not available">
        This gallery has content Echo doesn't show.
      </EmptyState>
    );
  }
  if (gallery.error) return <ErrorState error={gallery.error} onRetry={() => void gallery.refetch()} />;
  if (!g) return <Spinner label="Opening gallery" />;

  /** The right side always goes forward; right to left only changes how two pages are laid out. */
  const turn = (side: 'left' | 'right') => (side === 'right' ? next() : prev());
  const shown = rtl ? [...spread].reverse() : spread;
  const lastShown = spread[spread.length - 1] ?? page;
  const counter = spread.length > 1 ? `${spread[0]}–${lastShown}` : String(page);
  const progress = total ? lastShown / total : 0;

  // Portalled to <body>: the page content sits in its own stacking layer under the header, sidebar
  // and player bar, and the reader has to cover all of them.
  return createPortal(
    <div
      className={cn('fixed inset-0 z-50 overflow-hidden text-foreground', STAGE_BG[prefs.background], !showChrome && 'cursor-none')}
      role="dialog"
      aria-label={`Reading ${g.title}`}
      onPointerMove={(e) => {
        if (e.pointerType === 'mouse') wake();
      }}
    >
      {strip ? (
        <Strip
          pages={g.pages}
          page={page}
          gap={prefs.stripGap}
          fromScroll={fromScroll}
          onVisible={(n) => goTo(n, true)}
          onTap={() => (showChrome ? setChrome(false) : wake())}
        />
      ) : (
        <Stage
          fit={prefs.fit}
          spreadKey={spread.join('-')}
          onTap={(zone) => (zone === 'middle' ? (showChrome ? setChrome(false) : wake()) : turn(zone))}
          onSwipe={(towards) => turn(towards)}
          onWheel={(down) => (down ? next() : prev())}
        >
          {shown.map((n, i) => {
            const p = g.pages[n - 1];
            if (!p) return null;
            // The two halves sit against the gap in the middle, like an open book.
            const side = shown.length > 1 ? (i === 0 ? 'left' : 'right') : 'center';
            return (
              <PageView
                key={p.url}
                page={p}
                fit={prefs.fit}
                share={shown.length}
                side={side}
                // In a spread, each page shows its number (and which comes first) while the bars are up.
                badge={shown.length > 1 && (showChrome || hint) ? { n, first: n === spread[0] } : null}
              />
            );
          })}
          {hint && spread.length > 1 && <ReadingOrderHint rtl={rtl} />}
        </Stage>
      )}

      {/* Reading progress: a thin line along the top. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 bg-white/10" aria-hidden>
        <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${progress * 100}%` }} />
      </div>

      <TopBar
        visible={showChrome}
        gallery={g}
        counter={`${counter} / ${total}`}
        fullscreen={fullscreen}
        onBack={() => navigate(galleryRoute(id))}
        onPages={() => setThumbsOpen(true)}
        onSettings={() => setSettingsOpen(true)}
        onFullscreen={toggleFullscreen}
      />

      <BottomBar
        visible={showChrome}
        pages={g.pages}
        page={page}
        counter={counter}
        total={total}
        onPrev={prev}
        onNext={next}
        canPrev={index > 0 || ended}
        canNext={!ended}
        onSeek={(n) => goTo(n)}
      />

      {/* A quiet page number while the bars are hidden. */}
      <div
        className={cn(
          'pointer-events-none absolute bottom-3 right-3 z-10 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white/80 backdrop-blur transition-opacity duration-300 tnum',
          showChrome ? 'opacity-0' : 'opacity-100',
        )}
        aria-hidden
      >
        {counter} / {total}
      </div>

      {ended && <EndScreen gallery={g} onAgain={() => goTo(1)} onClose={() => setEnded(false)} />}

      <ReaderSettings
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        prefs={prefs}
        onChange={updatePrefs}
        autoIsRtl={autoRtl(g.tags)}
      />

      <Sheet open={thumbsOpen} onOpenChange={setThumbsOpen}>
        <SheetContent side="bottom" className="max-h-[70svh]">
          <SheetHeader>
            <SheetTitle>Pages</SheetTitle>
            <SheetDescription>Pick a page to jump to it.</SheetDescription>
          </SheetHeader>
          <ol className="scroll-thin grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-3 overflow-y-auto px-4 pb-6">
            {g.pages.map((p) => {
              const current = spread.includes(p.n);
              return (
                <li key={p.n}>
                  <button
                    type="button"
                    aria-current={current ? 'page' : undefined}
                    onClick={() => {
                      goTo(p.n);
                      setThumbsOpen(false);
                    }}
                    className={cn('block w-full rounded-lg', current && 'ring-2 ring-primary ring-offset-2 ring-offset-background')}
                  >
                    <MangaImage src={p.thumb} fallbacks={[p.url]} className="aspect-[1/1.41] w-full rounded-lg" imgClassName="h-full w-full object-cover" />
                    <span className={cn('mt-1 block text-center text-xs tnum', current ? 'text-foreground' : 'text-muted-foreground')}>{p.n}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </SheetContent>
      </Sheet>
    </div>,
    document.body,
  );
}

/** Title, page count and the reader's buttons. Fades out with the bottom bar. */
function TopBar({
  visible, gallery, counter, fullscreen, onBack, onPages, onSettings, onFullscreen,
}: {
  visible: boolean;
  gallery: MangaGallery;
  counter: string;
  fullscreen: boolean;
  onBack: () => void;
  onPages: () => void;
  onSettings: () => void;
  onFullscreen: () => void;
}) {
  const button = 'text-white/80 hover:bg-white/10 hover:text-white';
  return (
    <header
      className={cn(
        'absolute inset-x-0 top-0 z-20 flex items-center gap-2 bg-gradient-to-b from-black/85 via-black/50 to-transparent px-2 pb-10 pt-2 text-white transition-[opacity,transform] duration-300 sm:px-4',
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-3 opacity-0',
      )}
    >
      <IconButton icon={ArrowLeft} label="Back to gallery (Esc)" className={button} onClick={onBack} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{gallery.prettyTitle ?? gallery.title}</p>
        <p className="text-xs text-white/60 tnum" aria-live="polite">
          Page {counter}
        </p>
      </div>
      <IconButton icon={GalleryThumbnails} label="Pages (T)" className={button} onClick={onPages} />
      <IconButton icon={Settings2} label="Reader settings (S)" className={button} onClick={onSettings} />
      <IconButton icon={fullscreen ? Minimize : Maximize} label={fullscreen ? 'Leave fullscreen (F)' : 'Fullscreen (F)'} className={button} onClick={onFullscreen} />
    </header>
  );
}

/**
 * Page turners and the page slider. The slider shows a thumbnail of the page you're dragging to;
 * the jump happens when you let go.
 */
function BottomBar({
  visible, pages, page, counter, total, onPrev, onNext, canPrev, canNext, onSeek,
}: {
  visible: boolean;
  pages: MangaPage[];
  page: number;
  counter: string;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  onSeek: (page: number) => void;
}) {
  const [dragging, setDragging] = useState<number | null>(null);
  const shownPage = dragging ?? page;
  const preview = dragging !== null ? pages[dragging - 1] : undefined;
  const position = total > 1 ? (shownPage - 1) / (total - 1) : 0;
  const button = 'text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-30';
  return (
    <footer
      className={cn(
        'absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-3 pb-3 pt-12 text-white transition-[opacity,transform] duration-300 sm:px-6',
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0',
      )}
    >
      <div className="mx-auto flex max-w-3xl items-center gap-2 sm:gap-3">
        <IconButton icon={ChevronLeft} label="Previous page" className={button} disabled={!canPrev} onClick={onPrev} />
        <span className="w-10 text-right text-xs text-white/60 tnum">1</span>
        <div className="relative flex-1">
          {preview && (
            <div
              className="pointer-events-none absolute bottom-6 z-10 w-24 -translate-x-1/2 overflow-hidden rounded-lg border border-white/15 bg-black shadow-2xl shadow-black/60"
              style={{ left: `${position * 100}%` }}
            >
              <MangaImage src={preview.thumb} fallbacks={[preview.url]} className="aspect-[1/1.41] w-full" imgClassName="h-full w-full object-cover" />
              <p className="py-1 text-center text-xs tnum">{preview.n}</p>
            </div>
          )}
          <Slider
            min={1}
            max={Math.max(total, 1)}
            step={1}
            value={[shownPage]}
            onValueChange={([v]) => v !== undefined && setDragging(v)}
            onValueCommit={([v]) => {
              setDragging(null);
              if (v !== undefined) onSeek(v);
            }}
            aria-label="Page"
          />
        </div>
        <span className="w-10 text-xs text-white/60 tnum">{total}</span>
        <IconButton icon={ChevronRight} label="Next page" className={button} disabled={!canNext} onClick={onNext} />
        <span className="hidden min-w-16 rounded-full bg-white/10 px-2.5 py-1 text-center text-xs tnum sm:inline">{counter}</span>
      </div>
    </footer>
  );
}

/**
 * The paged view. Taps at the edges turn the page, a tap in the middle shows or hides the bars,
 * a horizontal swipe turns, and the mouse wheel turns when the page fits the screen.
 */
function Stage({
  fit, spreadKey, onTap, onSwipe, onWheel, children,
}: {
  fit: ReaderFit;
  /** Changes when the shown pages change, so the view starts at their top. */
  spreadKey: string;
  onTap: (zone: 'left' | 'middle' | 'right') => void;
  onSwipe: (towards: 'left' | 'right') => void;
  onWheel: (down: boolean) => void;
  children: React.ReactNode;
}) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const lastWheel = useRef(0);
  const scroll = useRef<HTMLDivElement>(null);
  const fitsScreen = fit === 'height';

  // A new page starts at its top (not on every render: the bars fading would jump the page back).
  useEffect(() => {
    const el = scroll.current;
    if (el) {
      el.scrollTop = 0;
      el.scrollLeft = 0;
    }
  }, [spreadKey]);

  return (
    <div
      ref={scroll}
      className={cn('absolute inset-0 select-none touch-pan-y', fitsScreen ? 'overflow-hidden' : 'overflow-auto')}
      onPointerDown={(e) => {
        start.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e) => {
        const from = start.current;
        start.current = null;
        if (!from) return;
        const dx = e.clientX - from.x;
        const dy = e.clientY - from.y;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          // Swiping the page to the left uncovers what's on its right.
          onSwipe(dx < 0 ? 'right' : 'left');
          return;
        }
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) return;
        const box = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - box.left) / box.width;
        onTap(x < TAP_EDGE ? 'left' : x > 1 - TAP_EDGE ? 'right' : 'middle');
      }}
      onWheel={(e) => {
        if (!fitsScreen || Math.abs(e.deltaY) < 20) return;
        // One turn per scroll gesture, not one per wheel tick.
        if (e.timeStamp - lastWheel.current < 350) return;
        lastWheel.current = e.timeStamp;
        onWheel(e.deltaY > 0);
      }}
    >
      <div className={cn('relative flex min-h-full justify-center gap-3', fitsScreen ? 'h-full items-center' : 'items-start')}>{children}</div>
    </div>
  );
}

/** One page, boxed to its known size before the image loads so nothing jumps. */
function PageView({
  page, fit, share, side, badge,
}: {
  page: MangaPage;
  fit: ReaderFit;
  share: number;
  side: 'left' | 'right' | 'center';
  /** In a spread: the page number, marked when it's the one to read first. */
  badge: { n: number; first: boolean } | null;
}) {
  const ratio = page.width && page.height ? page.width / page.height : 1 / 1.41;
  const [retry, setRetry] = useState(0);
  // Two pages share the width, less half the gap between them.
  const share100 = share > 1 ? `calc(${100 / share}% - 0.375rem)` : '100%';
  const box =
    fit === 'height'
      ? { className: 'h-full', style: { aspectRatio: ratio, maxWidth: share100 } }
      : fit === 'width'
        ? { className: '', style: { aspectRatio: ratio, width: share100, maxWidth: share > 1 ? undefined : '64rem' } }
        : { className: 'shrink-0', style: { aspectRatio: ratio, width: page.width ? `${page.width}px` : undefined } };
  return (
    <div className={cn('relative', box.className)} style={box.style}>
      <MangaImage
        key={retry}
        src={page.url}
        alt={`Page ${page.n}`}
        loading="eager"
        className="h-full w-full bg-white/[0.04]"
        // Each half sits against the gap in the middle of the spread.
        imgClassName={cn('h-full w-full object-contain', side === 'left' && 'object-right', side === 'right' && 'object-left')}
        onRetry={() => setRetry((r) => r + 1)}
      />
      {badge && (
        <span
          className={cn(
            // Under the top bar, on the side of the gap, so the bars never cover it.
            'pointer-events-none absolute top-16 rounded-full px-2.5 py-1 text-xs font-medium shadow-lg shadow-black/40 backdrop-blur tnum',
            side === 'left' ? 'right-3' : 'left-3',
            badge.first ? 'bg-primary text-primary-foreground' : 'bg-black/70 text-white',
          )}
          style={{ animation: 'rise 250ms cubic-bezier(0.22, 1, 0.36, 1) both' }}
        >
          {badge.first ? `Read first · ${badge.n}` : badge.n}
        </span>
      )}
    </div>
  );
}

/**
 * Over the gap of a spread: which way to read, with an arrow that sweeps in that direction. The
 * page badges mark which page comes first. Shown for a moment, then it fades.
 */
function ReadingOrderHint({ rtl }: { rtl: boolean }) {
  const Arrow = rtl ? ArrowLeft : ArrowRight;
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center" aria-live="polite">
      <div
        className={cn(
          'flex items-center gap-3 rounded-full border border-white/15 bg-black/75 px-5 py-3 text-sm font-medium text-white shadow-2xl shadow-black/60 backdrop-blur-md',
          rtl && 'flex-row-reverse',
        )}
        style={{ animation: `reading-hint ${HINT_MS}ms ease both` }}
      >
        <span>{rtl ? 'Read right to left' : 'Read left to right'}</span>
        <span className="relative flex h-5 w-14 items-center overflow-hidden" aria-hidden>
          <Arrow
            size={20}
            className="absolute text-primary"
            style={{ animation: `${rtl ? 'sweep-left' : 'sweep-right'} 1100ms cubic-bezier(0.22, 1, 0.36, 1) infinite` }}
          />
        </span>
      </div>
    </div>
  );
}

/** Every page, one under the other. Scrolling sets the current page; jumping scrolls to it. */
function Strip({
  pages, page, gap, fromScroll, onVisible, onTap,
}: {
  pages: MangaPage[];
  page: number;
  gap: boolean;
  fromScroll: React.MutableRefObject<boolean>;
  onVisible: (n: number) => void;
  onTap: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const refs = useMemo(() => new Map<number, HTMLElement>(), []);
  const start = useRef<{ x: number; y: number } | null>(null);

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
    <div
      ref={scroller}
      className="absolute inset-0 overflow-y-auto"
      onPointerDown={(e) => {
        start.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e) => {
        const from = start.current;
        start.current = null;
        // A tap (not a scroll or a drag) shows or hides the bars.
        if (from && Math.abs(e.clientX - from.x) < 10 && Math.abs(e.clientY - from.y) < 10) onTap();
      }}
    >
      <div className={cn('mx-auto flex max-w-3xl flex-col', gap && 'gap-3 py-3')}>
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

/** After the last page: read again, back to the gallery, or more by the same artist. */
function EndScreen({ gallery, onAgain, onClose }: { gallery: MangaGallery; onAgain: () => void; onClose: () => void }) {
  const artist = gallery.tags.find((t) => t.kind === 'artist');
  const action = 'inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition-colors';
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/75 p-6 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-background p-6 text-center shadow-2xl shadow-black/60"
        style={{ animation: 'rise 300ms cubic-bezier(0.22, 1, 0.36, 1) both' }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm text-muted-foreground">You've reached the end</p>
        <h2 className="mt-1 line-clamp-3 text-lg font-semibold leading-snug">{gallery.prettyTitle ?? gallery.title}</h2>
        <div className="mt-6 flex flex-col gap-2">
          <Link to={galleryRoute(gallery.id)} className={cn(action, 'bg-primary text-primary-foreground hover:brightness-110')}>
            <ArrowLeft size={16} aria-hidden /> Back to gallery
          </Link>
          {artist && (
            <Link to={tagRoute('artist', artist.slug)} className={cn(action, 'border border-white/15 hover:bg-white/10')}>
              More by {artist.name}
            </Link>
          )}
          <button type="button" onClick={onAgain} className={cn(action, 'text-muted-foreground hover:bg-white/10 hover:text-foreground')}>
            <RotateCcw size={16} aria-hidden /> Read again
          </button>
        </div>
      </div>
    </div>
  );
}
