import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AppSidebar } from './app-sidebar';
import { AppBreadcrumb } from './AppBreadcrumb';
import { PlayerBar } from './PlayerBar';
import { NowPlaying } from './NowPlaying';
import { Toasts } from './Toasts';
import { Separator } from './ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from './ui/sidebar';
import { CrumbProvider } from '../lib/crumbs';
import { usePlayer } from '../player/store';
import { currentTrack, togglePlay } from '../player/engine';
import { useAutoSubtitles } from '../hooks/use-auto-subtitles';

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
  useAutoSubtitles();

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
      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur sm:px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-1 h-4" />
        <AppBreadcrumb />
      </header>

      <main className={`flex-1 px-4 pt-6 sm:px-8 sm:pt-8 ${track ? 'pb-8' : 'pb-6'}`}>
        <div className="mx-auto max-w-6xl">
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
