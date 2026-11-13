import { app, dialog, shell } from 'electron';
import { autoUpdater, type UpdateInfo } from 'electron-updater';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { updateMode } from './update-policy';

const DOWNLOAD_PAGE = 'https://github.com/PrathameshBelvalkar/web-asmrone/releases/latest';
const FIRST_CHECK_MS = 10_000;
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

let logFile = '';
/** True while a check started from the menu is waiting for its answer. */
let userAsked = false;

/** Errors go to a log file only. They are never shown as dialogs. */
function log(message: string): void {
  if (!logFile) return;
  appendFileSync(logFile, `${new Date().toISOString()} ${message}\n`);
}

/** Starts the update checks. Only in the installed app; a development run does nothing. */
export function initUpdater(dataDir: string): void {
  if (!app.isPackaged) return;
  const logDir = join(dataDir, 'logs');
  mkdirSync(logDir, { recursive: true });
  logFile = join(logDir, 'updater.log');

  const mode = updateMode();
  autoUpdater.autoDownload = mode === 'auto';

  autoUpdater.on('error', (err) => {
    log(`error: ${err.message}`);
    if (userAsked) {
      userAsked = false;
      void dialog.showMessageBox({ type: 'info', message: 'Echo could not check for updates.' });
    }
  });

  autoUpdater.on('update-not-available', () => {
    log('no update');
    if (userAsked) {
      userAsked = false;
      void dialog.showMessageBox({ type: 'info', message: 'You have the latest version of Echo.' });
    }
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    log(`available: ${info.version}`);
    if (mode !== 'manual') return;
    userAsked = false;
    void dialog
      .showMessageBox({
        type: 'info',
        message: `Echo ${info.version} is available.`,
        buttons: ['Open download page', 'Later'],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) void shell.openExternal(DOWNLOAD_PAGE);
      });
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    log(`downloaded: ${info.version}`);
    void dialog
      .showMessageBox({
        type: 'question',
        message: `Echo ${info.version} is ready. Restart now?`,
        buttons: ['Restart', 'Later'],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall();
      });
  });

  setTimeout(() => runCheck(false), FIRST_CHECK_MS);
  setInterval(() => runCheck(false), CHECK_EVERY_MS);
}

/** Checks for an update now. `fromMenu` shows the answer even when there is nothing new. */
export function checkForUpdates(fromMenu = true): void {
  if (!app.isPackaged) {
    if (fromMenu) void dialog.showMessageBox({ type: 'info', message: 'Updates are checked in the installed app.' });
    return;
  }
  runCheck(fromMenu);
}

function runCheck(fromMenu: boolean): void {
  userAsked = fromMenu;
  autoUpdater.checkForUpdates().catch((err: unknown) => {
    log(`check failed: ${err instanceof Error ? err.message : String(err)}`);
    if (fromMenu) {
      userAsked = false;
      void dialog.showMessageBox({ type: 'info', message: 'Echo could not check for updates.' });
    }
  });
}
