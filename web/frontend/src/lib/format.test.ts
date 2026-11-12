import { describe, expect, it } from 'vitest';
import { formatBytes, formatEta, formatSpeed } from './format';

describe('formatBytes', () => {
  it('uses megabytes for model-sized numbers', () => {
    expect(formatBytes(574_041_195)).toBe('547 MB');
    expect(formatBytes(190 * 1024 * 1024)).toBe('190 MB');
  });

  it('uses gigabytes from one gigabyte up, and kilobytes below a megabyte', () => {
    expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe('2.0 GB');
    expect(formatBytes(5 * 1024)).toBe('5 KB');
  });
});

describe('formatEta', () => {
  it('says about how many minutes are left', () => {
    // 180 MB left at 1 MB/s is 3 minutes.
    expect(formatEta(180 * 1024 * 1024, 1024 * 1024)).toBe('about 3 minutes left');
    expect(formatEta(60 * 1024 * 1024, 1024 * 1024)).toBe('about 1 minute left');
  });

  it('says less than a minute when it is close', () => {
    expect(formatEta(10 * 1024 * 1024, 1024 * 1024)).toBe('less than a minute left');
  });

  it('does not guess before any speed is known', () => {
    expect(formatEta(100, 0)).toBe('Working out the time left');
  });
});

describe('formatSpeed', () => {
  it('turns the speed factor into minutes per hour of audio', () => {
    expect(formatSpeed(0.08)).toBe('1 hour of audio takes about 5 minutes');
    expect(formatSpeed(1)).toBe('1 hour of audio takes about 60 minutes');
  });

  it('says less than a minute for very fast computers', () => {
    expect(formatSpeed(0.005)).toBe('1 hour of audio takes less than a minute');
  });
});
