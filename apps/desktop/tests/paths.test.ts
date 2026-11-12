import { describe, expect, it } from 'vitest';
import { osName, resolvePaths, serverEnv, type PathInput } from '../src/paths';

const base: PathInput = {
  isPackaged: false,
  resourcesPath: '/app/Resources',
  packageDir: '/repo/apps/desktop',
  userData: '/home/u/Library/Application Support/Echo',
  platform: 'darwin',
  arch: 'arm64',
  appVersion: '0.1.0',
};

describe('osName', () => {
  it('maps platforms to the folder names', () => {
    expect(osName('darwin')).toBe('mac');
    expect(osName('win32')).toBe('win');
    expect(osName('linux')).toBe('linux');
  });
});

describe('resolvePaths', () => {
  it('uses the repository for the server and UI in development', () => {
    const p = resolvePaths(base, () => false);
    expect(p.serverEntry).toBe('/repo/web/backend-express/dist/server.js');
    expect(p.uiDir).toBe('/repo/web/frontend/dist');
    expect(p.binDir).toBeUndefined();
    expect(p.dataDir).toBe(base.userData);
  });

  it('uses the bundled tools in development when they were built', () => {
    const p = resolvePaths(base, (path) => path.endsWith('mac-arm64'));
    expect(p.binDir).toBe('/repo/apps/desktop/resources/bin/mac-arm64');
  });

  it('uses the resources folder when packaged, on each platform', () => {
    const win = resolvePaths({ ...base, isPackaged: true, platform: 'win32', arch: 'x64' });
    expect(win.serverEntry).toBe('/app/Resources/server/server.mjs');
    expect(win.uiDir).toBe('/app/Resources/ui');
    expect(win.binDir).toBe('/app/Resources/bin');
    const linux = resolvePaths({ ...base, isPackaged: true, platform: 'linux', arch: 'x64' });
    expect(linux.licensesDir).toBe('/app/Resources/licenses');
  });

  it('uses ECHO_WEB_DATA as the data folder when it is set', () => {
    const p = resolvePaths({ ...base, envDataDir: '/tmp/echo-test' });
    expect(p.dataDir).toBe('/tmp/echo-test');
  });
});

describe('serverEnv', () => {
  it('passes the port, folders and version to the server', () => {
    const paths = resolvePaths({ ...base, isPackaged: true }, () => false);
    const env = serverEnv(paths, { ...base, isPackaged: true }, 47610, { KEEP: '1' });
    expect(env).toMatchObject({
      KEEP: '1',
      PORT: '47610',
      ECHO_WEB_DATA: base.userData,
      ECHO_WEB_DIST: '/app/Resources/ui',
      ECHO_BIN_DIR: '/app/Resources/bin',
      ECHO_DESKTOP_VERSION: '0.1.0',
      LOG_LEVEL: 'info',
    });
  });

  it('leaves ECHO_BIN_DIR out when there is no bundled folder', () => {
    const env = serverEnv(resolvePaths(base, () => false), base, 0, { ECHO_BIN_DIR: '/stale' });
    expect(env).not.toHaveProperty('ECHO_BIN_DIR');
    expect(env.PORT).toBe('0');
  });
});
