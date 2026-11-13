import { Menu, shell, type MenuItemConstructorOptions } from 'electron';

export interface MenuFolders {
  readonly dataDir: string;
  readonly logsDir: string;
  readonly licensesDir: string;
  readonly checkForUpdates: () => void;
}

/** Standard Mac menus plus Help. */
export function buildAppMenu(folders: MenuFolders): void {
  const template: MenuItemConstructorOptions[] = [
    { role: 'appMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        { label: 'Open log folder', click: () => void shell.openPath(folders.logsDir) },
        { label: 'Open data folder', click: () => void shell.openPath(folders.dataDir) },
        { label: 'Licences', click: () => void shell.openPath(folders.licensesDir) },
        { type: 'separator' },
        { label: 'Check for updates…', click: folders.checkForUpdates },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
