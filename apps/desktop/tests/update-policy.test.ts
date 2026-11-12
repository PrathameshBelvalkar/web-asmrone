import { describe, expect, it } from 'vitest';
import { updateMode } from '../src/update-policy';

describe('updateMode', () => {
  it('installs Windows updates itself', () => {
    expect(updateMode('win32', false)).toBe('auto');
  });

  it('installs Linux AppImage updates itself, but not .deb updates', () => {
    expect(updateMode('linux', true)).toBe('auto');
    expect(updateMode('linux', false)).toBe('manual');
  });

  it('sends macOS users to the download page until the app is signed', () => {
    expect(updateMode('darwin', false)).toBe('manual');
  });
});
