// Launches the packaged app (release/<unpacked>) on a throwaway data folder and checks the first
// start: the home page opens with no prompt, and AI subtitles are off in Settings.
import { _electron as electron, expect, test } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const appDir = join(__dirname, '..', '..');
const executable = join(appDir, 'release', 'mac-arm64', 'Echo.app', 'Contents', 'MacOS', 'Echo');

test('first start: home page without a prompt, AI subtitles off', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'echo-e2e-'));
  // The app must not see the shell's own Electron flag, or it runs as plain Node.
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && key !== 'ELECTRON_RUN_AS_NODE') env[key] = value;
  }
  const app = await electron.launch({
    executablePath: executable,
    env: { ...env, ECHO_WEB_DATA: dataDir },
  });
  try {
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await expect(window).toHaveTitle('Echo Web');

    // No dialog or setup screen on the home page.
    await expect(window.locator('a[data-sidebar="menu-button"]', { hasText: 'Home' })).toBeVisible();
    await expect(window.getByRole('dialog')).toHaveCount(0);

    await window.locator('a[data-sidebar="menu-button"]', { hasText: 'Settings' }).click();
    await expect(window.getByText('AI subtitles', { exact: true }).first()).toBeVisible();
    await expect(window.getByRole('switch', { name: 'AI subtitles' })).toHaveAttribute('aria-checked', 'false');
  } finally {
    await app.close();
    rmSync(dataDir, { recursive: true, force: true });
  }
});
