import { describe, expect, it } from 'vitest';
import { ExpiringRegistry } from '../../src/stores/expiring-registry.js';
import { IssuedUrls } from '../../src/stores/issued-urls.js';
import { LruCache } from '../../src/lib/lru-cache.js';
import { Mutex } from '../../src/lib/mutex.js';

/** Fake clock: tests move time explicitly. */
function fakeClock(start = 1_000) {
  let now = start;
  return { now: () => now, advance: (ms: number) => (now += ms) };
}

describe('ExpiringRegistry', () => {
  it('returns values until they expire', () => {
    const clock = fakeClock();
    const registry = new ExpiringRegistry<string>(10, 1_000, clock);
    const id = registry.put('feed');
    expect(registry.get(id)).toBe('feed');
    clock.advance(999);
    expect(registry.get(id)).toBe('feed');
  });

  it('slides: each get renews the idle timer', () => {
    const clock = fakeClock();
    const registry = new ExpiringRegistry<string>(10, 1_000, clock);
    const id = registry.put('feed');
    for (let i = 0; i < 5; i++) {
      clock.advance(900);
      expect(registry.get(id)).toBe('feed');
    }
    clock.advance(1_001);
    expect(registry.get(id)).toBeUndefined();
  });

  it('returns undefined for unknown ids', () => {
    const registry = new ExpiringRegistry<string>(10, 1_000, fakeClock());
    expect(registry.get('nope')).toBeUndefined();
  });

  it('evicts the oldest inserted entry when full (FIFO, not LRU)', () => {
    const clock = fakeClock();
    const registry = new ExpiringRegistry<string>(2, 60_000, clock);
    const first = registry.put('a');
    const second = registry.put('b');
    expect(registry.get(first)).toBe('a'); // a get does not change eviction order
    registry.put('c');
    expect(registry.get(first)).toBeUndefined();
    expect(registry.get(second)).toBe('b');
  });

  it('expires immediately with a negative ttl', () => {
    const registry = new ExpiringRegistry<string>(10, -1, fakeClock());
    const id = registry.put('x');
    expect(registry.get(id)).toBeUndefined();
  });

  it('issues UUID ids', () => {
    const registry = new ExpiringRegistry<string>(10, 1_000, fakeClock());
    expect(registry.put('x')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe('IssuedUrls', () => {
  it('matches exact strings only', () => {
    const issued = new IssuedUrls(10);
    issued.add('https://cdn.example/a.mp3');
    expect(issued.has('https://cdn.example/a.mp3')).toBe(true);
    expect(issued.has('https://cdn.example/a.mp3?x=1')).toBe(false);
    expect(issued.has('https://cdn.example/b.mp3')).toBe(false);
  });

  it('evicts the least recently added URL when over the limit', () => {
    const issued = new IssuedUrls(2);
    issued.add('a');
    issued.add('b');
    issued.add('a'); // re-adding makes a the most recent
    issued.add('c'); // evicts b
    expect(issued.has('a')).toBe(true);
    expect(issued.has('b')).toBe(false);
    expect(issued.has('c')).toBe(true);
    expect(issued.size).toBe(2);
  });
});

describe('LruCache', () => {
  it('evicts the least recently used entry', () => {
    const cache = new LruCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.get('a')).toBe(1); // a is now most recent
    cache.set('c', 3);
    expect(cache.has('b')).toBe(false);
    expect(cache.get('a')).toBe(1);
    expect(cache.get('c')).toBe(3);
  });

  it('rejects a non-positive size', () => {
    expect(() => new LruCache<string, number>(0)).toThrow(RangeError);
  });
});

describe('Mutex', () => {
  it('runs critical sections one at a time, in order', async () => {
    const mutex = new Mutex();
    const order: string[] = [];
    const task = (name: string, ms: number) =>
      mutex.run(async () => {
        order.push(`start ${name}`);
        await new Promise((r) => setTimeout(r, ms));
        order.push(`end ${name}`);
      });
    await Promise.all([task('a', 20), task('b', 1)]);
    expect(order).toEqual(['start a', 'end a', 'start b', 'end b']);
  });

  it('keeps running after a task fails', async () => {
    const mutex = new Mutex();
    await expect(mutex.run(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    await expect(mutex.run(() => Promise.resolve(42))).resolves.toBe(42);
  });
});
