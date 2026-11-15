import { BookOpen, History, House, Library, Palette, Search, Settings, Tags } from 'lucide-react';
import appIcon from '../assets/echo-icon.png';
import type { LucideIcon } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { meOptions } from '../api/queries';
import { useSource } from '../lib/source';
import { NavUser } from './nav-user';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from './ui/sidebar';

type NavItem = { title: string; url: string; icon: LucideIcon; end?: boolean };

const BROWSE: NavItem[] = [
  { title: 'Home', url: '/', icon: House, end: true },
  { title: 'Search', url: '/search', icon: Search },
  { title: 'Library', url: '/library', icon: Library },
];

/** Nav rows; the active one gets a surface step and its icon in the brand colour. */
const NAV_ITEM =
  'h-9 rounded-lg px-3 text-sm text-sidebar-foreground/80 hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground [&>svg]:size-[18px]! data-[active=true]:[&>svg]:text-primary';

const MANGA: NavItem[] = [
  { title: 'Browse', url: '/manga', icon: BookOpen, end: true },
  { title: 'Search', url: '/manga/search', icon: Search },
  { title: 'Artists', url: '/manga/artists', icon: Palette },
  { title: 'Tags', url: '/manga/tags', icon: Tags },
];

/**
 * Which manga item a page belongs to: an artist's page goes with Artists, other tag pages with Tags,
 * and galleries, the reader and the language and category lists with Browse.
 */
function mangaActive(item: NavItem, pathname: string): boolean {
  const section = pathname.startsWith('/manga/search')
    ? '/manga/search'
    : pathname.startsWith('/manga/artist')
      ? '/manga/artists'
      : /^\/manga\/(?:tags|tag|character|parody|group)(?:\/|$)/.test(pathname)
        ? '/manga/tags'
        : pathname.startsWith('/manga')
          ? '/manga'
          : null;
  return section === item.url;
}

/** App navigation. Collapses to icons on desktop and becomes a sheet on phones. */
export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const me = useQuery(meOptions());
  const { pathname } = useLocation();
  const source = useSource((s) => s.source);
  // The library is asmr.one only (it needs an account there).
  const browse = source !== 'asmrone' ? BROWSE.filter((item) => item.url !== '/library') : BROWSE;
  const isActive = (url: string, end?: boolean) => (end ? pathname === url : pathname.startsWith(url));
  return (
    <Sidebar collapsible="icon" className="border-r-sidebar-border" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <NavLink to="/">
                <img src={appIcon} alt="" aria-hidden className="aspect-square size-8 shrink-0 rounded-lg ring-1 ring-white/10" />
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-base font-semibold">Echo</span>
                  <span className="truncate text-xs text-sidebar-foreground/60">asmr.one player</span>
                </div>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Browse</SidebarGroupLabel>
          <SidebarMenu>
            {browse.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild tooltip={item.title} isActive={isActive(item.url, item.end)} className={NAV_ITEM}>
                  <NavLink to={item.url} end={item.end}>
                    <item.icon aria-hidden />
                    <span>{item.title}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Manga &amp; Doujinshi</SidebarGroupLabel>
          <SidebarMenu>
            {MANGA.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  asChild
                  tooltip={`Manga: ${item.title}`}
                  isActive={mangaActive(item, pathname)}
                  className={NAV_ITEM}
                >
                  <NavLink to={item.url} end={item.end}>
                    <item.icon aria-hidden />
                    <span>{item.title}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="History" isActive={isActive('/history')} className={NAV_ITEM}>
                <NavLink to="/history">
                  <History aria-hidden />
                  <span>History</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Settings" isActive={isActive('/settings')} className={NAV_ITEM}>
                <NavLink to="/settings">
                  <Settings aria-hidden />
                  <span>Settings</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={me.data} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
