import { useEffect, useState, type FormEvent } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { AppSidebar } from './app-sidebar';
import { AppBreadcrumb } from './AppBreadcrumb';
import { HeaderWash } from './HeaderWash';
import { PlayerBar } from './PlayerBar';
import { NowPlaying } from './NowPlaying';
import { Toasts } from './Toasts';
import { SidebarInset, SidebarProvider, SidebarTrigger } from './ui/sidebar';
import { CrumbProvider } from '../lib/crumbs';
import { usePlayer } from '../player/store';
import { currentTrack, togglePlay } from '../player/engine';
import { useAutoSubtitles } from '../hooks/use-auto-subtitles';
import { useToolsReadyToast } from '../hooks/use-tools-ready-toast';
import { usePlayerAccent } from '../hooks/use-player-accent';
import { useScrolled } from '../hooks/use-scroll';
import { cn } from '@/lib/utils';

/** App frame: sidebar, header with breadcrumbs, page content, and the player at the bottom. */
export function Shell() {
  return (
    <CrumbProvider>
      <SidebarProvider>
        <AppSidebar />
        {/* min-w-0: lets the page shrink beside the sidebar; long content (a breadcrumb title) would otherwise push it off-screen. */}
        <SidebarInset className="min-h-svh min-w-0">
          <ShellInner />
        </SidebarInset>
      </SidebarProvider>
    </CrumbProvider>
  );
}

function ShellInner() {
  const location = useLocation();
  const track = usePlayer((s) => (s.index >= 0 ? s.queue[s.index] : undefined));
  const nowPlayingOpen = usePlayer((s) => s.nowPlayingOpen);
  const setState = usePlayer((s) => s.setState);
  const scrolled = useScrolled();
  useAutoSubtitles();
  useToolsReadyToast();
  usePlayerAccent();

  // Space toggles playback unless focus is in a control.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName));
      if (e.code === 'Space' && !typing && currentTrack()) {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Now Playing closes on navigation.
  useEffect(() => {
    setState({ nowPlayingOpen: false });
  }, [location.pathname, setState]);

  return (
    <>
      <HeaderWash />

      {/* Clear over the wash at the top of the page; frosted once content scrolls under it. */}
      <header
        className={cn(
          'sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b px-3 transition-[background-color,border-color,backdrop-filter] duration-300 sm:px-6',
          scrolled ? 'border-border bg-background/70 backdrop-blur-xl backdrop-saturate-150' : 'border-transparent bg-transparent',
        )}
      >
        <SidebarTrigger className="-ml-1 rounded-full" />
        <div className="hidden min-w-0 flex-1 sm:block">
          <AppBreadcrumb />
        </div>
        <div className="min-w-0 flex-1 sm:hidden" />
        {location.pathname !== '/search' && <TopSearch />}
      </header>

      <main className={`relative z-[1] flex-1 px-4 pt-4 sm:px-6 sm:pt-6 lg:px-10 ${track ? 'pb-8' : 'pb-6'}`}>
        <div className="mx-auto max-w-[1600px]">
          <Outlet />
        </div>
      </main>

      <div className="sticky bottom-0 z-30">
        <PlayerBar />
      </div>

      {nowPlayingOpen && track && <NowPlaying />}
      <Toasts />
    </>
  );
}

/** Pill search field in the top bar (YouTube Music style). Submitting opens the search page. */
function TopSearch() {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = text.trim();
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
    setText('');
  };
  return (
    <form role="search" onSubmit={submit} className="w-full max-w-[22rem] shrink">
      <label className="group flex h-10 items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.07] px-4 text-sm text-muted-foreground transition focus-within:border-white/25 focus-within:bg-white/[0.12] hover:bg-white/10">
        <Search size={16} className="shrink-0 transition group-focus-within:text-foreground" aria-hidden />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search works, artists, playlists"
          aria-label="Search"
          className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
        />
      </label>
    </form>
  );
}
