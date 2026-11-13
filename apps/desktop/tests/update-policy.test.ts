import { describe, expect, it } from 'vitest';
import { updateMode } from '../src/update-policy';

describe('updateMode', () => {
  it('sends users to the download page until the app is signed', () => {
    expect(updateMode()).toBe('manual');
  });

  it('installs updates itself once signing is turned on', () => {
    expect(updateMode(true)).toBe('auto');
  });
});
