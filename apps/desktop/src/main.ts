import { app, BrowserWindow, dialog, shell, type Tray } from 'electron';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { buildAppMenu } from './menu';
import { migrate } from './migrate';
import { checkForUpdates, initUpdater } from './updater';
import { pickPort } from './ports';
import { resolvePaths, serverEnv, type AppPaths, type PathInput } from './paths';
import { startServerProcess, type ServerHandle } from './server-process';
import { runSmoke } from './smoke';
import { createTray } from './tray';

const SMOKE = process.argv.includes('--smoke-test');
const devUrl = process.env.ECHO_DEV_URL;

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let server: ServerHandle | null = null;
let paths: AppPaths;
let pathInput: PathInput;
let serverPort = 0;
let quitting = false;
let crashes = 0;

// Only one copy of Echo runs. A second start focuses the first window.
if (!app.requestSingleInstanceLock()) {
  app.quit();
}
app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
});

app.setName('Echo');
if (process.platform === 'win32') app.setAppUserModelId('ai.airrived.echo');

// Keep the app running in the tray on macOS and Windows; Linux quits when the window closes.
const KEEPS_RUNNING_ON_CLOSE = process.platform !== 'linux';

app
  .whenReady()
  .then(async () => {
    pathInput = {
      isPackaged: app.isPackaged,
      resourcesPath: process.resourcesPath,
      packageDir: join(__dirname, '..'),
      userData: app.getPath('userData'),
      envDataDir: process.env.ECHO_WEB_DATA,
      platform: process.platform,
      arch: process.arch,
      appVersion: app.getVersion(),
    };
    paths = resolvePaths(pathInput);
    mkdirSync(paths.dataDir, { recursive: true });

    // Only for the default data folder. With ECHO_WEB_DATA set, the folder is chosen on purpose and
    // the user's old web data must not be copied or moved into it.
    try {
      if (!process.env.ECHO_WEB_DATA) migrate(paths.dataDir, homedir());
    } catch (err) {
      console.error('Migration from the web version failed:', err);
    }

    serverPort = await pickPort();
    server = await startServer(serverPort);

    if (SMOKE) {
      const code = await runSmoke(paths, server);
      app.exit(code);
      return;
    }

    initUpdater(paths.dataDir);
    buildAppMenu({
      dataDir: paths.dataDir,
      logsDir: paths.logsDir,
      licensesDir: paths.licensesDir,
      checkForUpdates: () => checkForUpdates(true),
    });
    createWindow(server.port);
    tray = createTray(
      app.isPackaged ? join(paths.resources, 'icon.png') : join(__dirname, '..', 'build', 'icon.png'),
      showWindow,
      () => app.quit(),
    );
  })
  .catch((err: unknown) => {
    dialog.showErrorBox('Echo could not start', err instanceof Error ? err.message : String(err));
    app.exit(1);
  });

app.on('activate', () => {
  showWindow();
});

app.on('window-all-closed', () => {
  // Quitting is handled by before-quit. Closing the last window on Linux quits there.
  if (!KEEPS_RUNNING_ON_CLOSE) app.quit();
});

app.on('before-quit', (event) => {
  if (!server || quitting) return;
  quitting = true;
  event.preventDefault();
  const running = server;
  server = null;
  void running.stop().finally(() => app.exit(0));
});

function startServer(port: number): Promise<ServerHandle> {
  return startServerProcess({
    entry: paths.serverEntry,
    port,
    env: serverEnv(paths, pathInput, port, process.env),
    logFile: join(paths.logsDir, 'server.log'),
    onUnexpectedExit: handleServerCrash,
  });
}

/** Restarts the server once on the same port. A second failure shows a message and quits. */
async function handleServerCrash(): Promise<void> {
  if (quitting) return;
  crashes++;
  if (crashes === 1) {
    try {
      server = await startServer(serverPort);
      win?.reload();
      return;
    } catch {
      // Falls through to the message below.
    }
  }
  dialog.showErrorBox('Echo stopped working', `Please restart Echo. Log file: ${join(paths.logsDir, 'server.log')}`);
  app.quit();
}

interface WindowState {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

function windowStateFile(): string {
  return join(paths.dataDir, 'window.json');
}

function loadWindowState(): WindowState {
  try {
    const parsed = JSON.parse(readFileSync(windowStateFile(), 'utf8')) as WindowState;
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function saveWindowState(window: BrowserWindow): void {
  if (window.isMinimized() || window.isFullScreen()) return;
  const bounds = window.getBounds();
  writeFileSync(windowStateFile(), JSON.stringify(bounds));
}

function showWindow(): void {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function createWindow(port: number): void {
  const saved = loadWindowState();
  const window = new BrowserWindow({
    width: saved.width ?? 1280,
    height: saved.height ?? 800,
    x: saved.x,
    y: saved.y,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0a0b0d',
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win = window;

  const url = devUrl ?? `http://127.0.0.1:${port}/`;
  const origin = new URL(url).origin;
  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:/.test(target)) void shell.openExternal(target);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, target) => {
    if (new URL(target).origin !== origin) event.preventDefault();
  });
  window.on('close', (event) => {
    saveWindowState(window);
    if (!quitting && KEEPS_RUNNING_ON_CLOSE) {
      event.preventDefault();
      window.hide();
    }
  });
  window.on('closed', () => {
    win = null;
  });
  void window.loadURL(url);
}
