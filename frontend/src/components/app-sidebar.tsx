import { Disc3, House, Library, Search, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { meOptions } from '../api/queries';
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

/** App navigation. Collapses to icons on desktop and becomes a sheet on phones. */
export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const me = useQuery(meOptions());
  const { pathname } = useLocation();
  const isActive = (url: string, end?: boolean) => (end ? pathname === url : pathname.startsWith(url));
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <NavLink to="/">
                <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Disc3 className="size-4" aria-hidden />
                </span>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Echo</span>
                  <span className="truncate text-xs text-sidebar-foreground/70">asmr.one player</span>
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
            {BROWSE.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild tooltip={item.title} isActive={isActive(item.url, item.end)}>
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
              <SidebarMenuButton asChild tooltip="Settings" isActive={isActive('/settings')}>
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
