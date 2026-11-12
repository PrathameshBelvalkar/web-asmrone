import { Menu, nativeImage, Tray } from 'electron';
import { existsSync } from 'node:fs';

/**
 * The tray icon keeps audio playing when the window is closed. Not created on Linux, where many
 * desktops show no tray.
 */
export function createTray(iconPath: string, showWindow: () => void, quit: () => void): Tray | null {
  if (process.platform === 'linux' || !existsSync(iconPath)) return null;
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
  if (process.platform === 'win32') tray.on('click', showWindow);
  return tray;
}
