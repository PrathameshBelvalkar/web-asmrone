import { startServer } from './start.js';

interface ParentPort {
  postMessage(message: unknown): void;
  on(event: 'message', listener: (event: { data: unknown }) => void): void;
}

async function main(): Promise<void> {
  const running = await startServer();
  const stop = (): void => {
    void running.close().finally(() => process.exit(0));
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  // When started by Electron's utilityProcess, talk to the parent over its message port.
  const parent = (process as { parentPort?: ParentPort }).parentPort;
  parent?.postMessage({ type: 'listening', port: running.port });
  parent?.on('message', (event) => {
    if ((event.data as { type?: string }).type === 'shutdown') stop();
  });
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
