/**
 * How an update is applied on each platform. Kept free of Electron so it can be tested.
 *
 *  - auto:   the update downloads in the background and the app offers to restart.
 *  - manual: the app tells the user an update exists and opens the download page.
 *
 * macOS installs updates only into a signed app, so macOS is manual until signing is added.
 * Set MAC_AUTO_INSTALL to true after the Developer ID signing and notarisation secrets exist.
 */
export const MAC_AUTO_INSTALL = false;

export type UpdateMode = 'auto' | 'manual';

export function updateMode(platform: NodeJS.Platform, isAppImage: boolean): UpdateMode {
  if (platform === 'win32') return 'auto';
  if (platform === 'linux') return isAppImage ? 'auto' : 'manual';
  return MAC_AUTO_INSTALL ? 'auto' : 'manual';
}
