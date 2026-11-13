import { Menu, nativeImage, Tray } from 'electron';
import { existsSync } from 'node:fs';

/** The menu bar icon keeps audio playing when the window is closed. */
export function createTray(iconPath: string, showWindow: () => void, quit: () => void): Tray | null {
  if (!existsSync(iconPath)) return null;
  const image = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  const tray = new Tray(image);
  tray.setToolTip('Echo');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open Echo', click: showWindow },
      { type: 'separator' },
      { label: 'Quit Echo', click: quit },
    ]),
  );
  return tray;
}
