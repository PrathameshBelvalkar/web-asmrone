import { describe, expect, it } from 'vitest';
import { PagedData } from '../../src/models/paged-data.js';

describe('PagedData.single', () => {
  it('loads once and returns null as the continuation', async () => {
    let calls = 0;
    const paged = PagedData.single(() => {
      calls++;
      return Promise.resolve([1, 2]);
    });
    expect(await paged.loadPage(null)).toEqual({ data: [1, 2], continuation: null });
    expect(await paged.loadAll()).toEqual([1, 2]);
    expect(calls).toBe(1);
  });
});

describe('PagedData.continuous', () => {
  it('caches each page by its token', async () => {
    const requested: (string | null)[] = [];
    const paged = PagedData.continuous<string>((cont) => {
      requested.push(cont);
      const next = cont === null ? '1' : cont === '1' ? '2' : null;
      return Promise.resolve({ data: [`p${cont ?? '0'}`], continuation: next });
    });
    await paged.loadPage(null);
    await paged.loadPage(null);
    await paged.loadPage('1');
    expect(requested).toEqual([null, '1']);
  });

  it('loadAll walks every page', async () => {
    const paged = PagedData.continuous<number>((cont) => {
      const n = cont === null ? 1 : Number(cont);
      return Promise.resolve({ data: [n], continuation: n < 3 ? String(n + 1) : null });
    });
    expect(await paged.loadAll()).toEqual([1, 2, 3]);
  });

  it('invalidate forces a reload', async () => {
    let calls = 0;
    const paged = PagedData.continuous<number>(() => {
      calls++;
      return Promise.resolve({ data: [calls], continuation: null });
    });
    await paged.loadPage(null);
    paged.invalidate(null);
    expect((await paged.loadPage(null)).data).toEqual([2]);
  });
});

describe('PagedData.concat', () => {
  it('continues across sources with "<index>_<token>" continuations', async () => {
    const a = PagedData.continuous<string>((cont) =>
      Promise.resolve(cont === null ? { data: ['a1'], continuation: 'x' } : { data: ['a2'], continuation: null }),
    );
    const b = PagedData.single(() => Promise.resolve(['b1']));
    const paged = PagedData.concat(a, b);

    const first = await paged.loadPage(null);
    expect(first).toEqual({ data: ['a1'], continuation: '0_x' });
    const second = await paged.loadPage('0_x');
    expect(second).toEqual({ data: ['a2'], continuation: '1_' });
    const third = await paged.loadPage('1_');
    expect(third).toEqual({ data: ['b1'], continuation: '2_' });
    expect(await paged.loadPage('2_')).toEqual({ data: [], continuation: null });
  });

  it('loadAll concatenates all sources', async () => {
    const paged = PagedData.concat(
      PagedData.single(() => Promise.resolve([1])),
      PagedData.single(() => Promise.resolve([2, 3])),
    );
    expect(await paged.loadAll()).toEqual([1, 2, 3]);
  });

  it('requires at least one source', () => {
    expect(() => PagedData.concat<number>()).toThrow(RangeError);
  });
});
