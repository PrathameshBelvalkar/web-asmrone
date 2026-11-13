import { Disc3, House, Library, Search, Settings } from 'lucide-react';
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

const BROWSE: { title: string; url: string; icon: LucideIcon; end?: boolean }[] = [
  { title: 'Home', url: '/', icon: House, end: true },
  { title: 'Search', url: '/search', icon: Search },
  { title: 'Library', url: '/library', icon: Library },
];

/** Taller nav rows; the active one is bold with its icon in the brand colour. */
const NAV_ITEM =
  'h-10 rounded-lg px-3 text-[15px] text-sidebar-foreground/80 hover:text-sidebar-accent-foreground data-[active=true]:bg-white/10 data-[active=true]:font-semibold data-[active=true]:text-white [&>svg]:size-[18px]! data-[active=true]:[&>svg]:text-primary';

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
                <span className="flex aspect-square size-8 items-center justify-center rounded-xl bg-gradient-to-br from-rose-400 via-primary to-fuchsia-600 text-white shadow-lg shadow-primary/30">
                  <Disc3 className="size-4" aria-hidden />
                </span>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-display text-lg font-extrabold tracking-tight">Echo</span>
                  <span className="truncate text-[11px] text-sidebar-foreground/60">asmr.one player</span>
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
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarMenu>
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
