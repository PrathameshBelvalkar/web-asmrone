import { utilityProcess, type UtilityProcess } from 'electron';
import { createWriteStream, existsSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

export interface ServerHandle {
  readonly port: number;
  stop(): Promise<void>;
}

export interface ServerProcessConfig {
  readonly entry: string;
  readonly port: number;
  readonly env: NodeJS.ProcessEnv;
  readonly logFile: string;
  /** Called when the server exits after it was running (not during start or stop). */
  readonly onUnexpectedExit: (code: number | null) => void;
}

const START_TIMEOUT_MS = 30_000;
const STOP_TIMEOUT_MS = 5_000;
const MAX_LOG_BYTES = 5 * 1024 * 1024;

/** Starts the server in a utility process and resolves when it reports its port. */
export function startServerProcess(config: ServerProcessConfig): Promise<ServerHandle> {
  mkdirSync(dirname(config.logFile), { recursive: true });
  rotateLog(config.logFile);
  const log = createWriteStream(config.logFile, { flags: 'a' });

  const child = utilityProcess.fork(config.entry, [], {
    env: config.env,
    stdio: 'pipe',
    serviceName: 'Echo server',
  });
  child.stdout?.pipe(log, { end: false });
  child.stderr?.pipe(log, { end: false });

  return new Promise<ServerHandle>((resolve, reject) => {
    let running = false;
    let stopping = false;
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill();
        reject(new Error(`The server did not start within ${START_TIMEOUT_MS / 1000} seconds. Log: ${config.logFile}`));
      }
    }, START_TIMEOUT_MS);

    child.once('exit', (code) => {
      clearTimeout(timer);
      log.end();
      if (!settled) {
        settled = true;
        reject(new Error(`The server stopped during start (code ${code}). Log: ${config.logFile}`));
        return;
      }
      if (running && !stopping) config.onUnexpectedExit(code);
    });

    child.on('message', (message: unknown) => {
      const msg = message as { type?: string; port?: number };
      if (msg.type === 'listening' && !settled) {
        settled = true;
        running = true;
        clearTimeout(timer);
        resolve({ port: msg.port ?? config.port, stop: () => stopChild(child, () => (stopping = true)) });
      }
    });
  });
}

/** Asks the server to close, waits up to 5 seconds, then kills it. */
function stopChild(child: UtilityProcess, markStopping: () => void): Promise<void> {
  markStopping();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill();
      resolve();
    }, STOP_TIMEOUT_MS);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    child.postMessage({ type: 'shutdown' });
  });
}

/** The old log becomes server.old.log once it is larger than 5 MB. */
function rotateLog(logFile: string): void {
  if (existsSync(logFile) && statSync(logFile).size > MAX_LOG_BYTES) {
    renameSync(logFile, join(dirname(logFile), 'server.old.log'));
  }
}
