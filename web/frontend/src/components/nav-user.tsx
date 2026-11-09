import { Link, useNavigate } from 'react-router-dom';
import { ChevronsUpDown, LogIn, LogOut, Settings } from 'lucide-react';
import { useLogout } from '../api/mutations';
import type { User } from '../api/types';
import { messageFor } from '../lib/errors';
import { toast } from '../lib/toast';
import { Avatar, AvatarFallback } from './ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from './ui/sidebar';

/** Footer of the sidebar: the signed-in user with account actions, or a login prompt. */
export function NavUser({ user }: { user: User | null | undefined }) {
  const { isMobile } = useSidebar();
  const navigate = useNavigate();
  const logoutMutation = useLogout();

  if (!user) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild tooltip="Log in to asmr.one">
            <Link to="/settings">
              <LogIn />
              <span>Log in to asmr.one</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  const initial = user.name.slice(0, 1).toUpperCase();
  const logout = async () => {
    try {
      await logoutMutation.mutateAsync();
      toast('Logged out');
      navigate('/settings');
    } catch (e) {
      toast(messageFor(e));
    }
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg bg-primary/15 text-primary">{initial}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs text-sidebar-foreground/70">Signed in</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 rounded-lg" side={isMobile ? 'bottom' : 'right'} align="end" sideOffset={4}>
            <DropdownMenuLabel className="font-normal">
              <div className="truncate text-sm font-medium">{user.name}</div>
              <div className="text-xs text-muted-foreground">asmr.one account</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate('/settings')}>
              <Settings />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void logout()}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
