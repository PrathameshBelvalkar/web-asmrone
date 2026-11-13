/**
 * How an update is applied. Kept free of Electron so it can be tested.
 *
 *  - auto:   the update downloads in the background and the app offers to restart.
 *  - manual: the app tells the user an update exists and opens the download page.
 *
 * macOS installs updates only into a signed app, so updates are manual until signing is added.
 * Set MAC_AUTO_INSTALL to true after the Developer ID signing and notarisation secrets exist.
 */
export const MAC_AUTO_INSTALL = false;

export type UpdateMode = 'auto' | 'manual';

export function updateMode(autoInstall: boolean = MAC_AUTO_INSTALL): UpdateMode {
  return autoInstall ? 'auto' : 'manual';
}
