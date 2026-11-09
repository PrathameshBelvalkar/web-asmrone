import { Mutex } from '../lib/mutex.js';

export interface Page<T> {
  readonly data: readonly T[];
  /** `null` means there are no more pages. */
  readonly continuation: string | null;
}

/**
 * Paged source of items. Port of Echo `common` PagedData. Each instance serialises its own
 * loads through a mutex, matching the Kotlin implementation.
 */
export abstract class PagedData<T> {
  private readonly mutex = new Mutex();

  loadAll(): Promise<T[]> {
    return this.mutex.run(() => this.loadAllInternal());
  }

  loadPage(continuation: string | null): Promise<Page<T>> {
    return this.mutex.run(() => this.loadListInternal(continuation));
  }

  abstract clear(): void;
  abstract invalidate(continuation: string | null): void;
  protected abstract loadAllInternal(): Promise<T[]>;
  protected abstract loadListInternal(continuation: string | null): Promise<Page<T>>;

  /** One page that is loaded once and then cached. Continuation is always null. */
  static single<T>(load: () => Promise<T[]>): PagedData<T> {
    return new SinglePagedData(load);
  }

  /** Pages loaded by continuation token. Each token's page is cached. */
  static continuous<T>(load: (continuation: string | null) => Promise<Page<T>>): PagedData<T> {
    return new ContinuousPagedData(load);
  }

  /**
   * Concatenates sources. Continuation is `"<sourceIndex>_<token>"`. When a source runs out of
   * pages the next source starts at `"<index+1>_"`. Matches Kotlin `PagedData.Concat`.
   */
  static concat<T>(...sources: PagedData<T>[]): PagedData<T> {
    return new ConcatPagedData(sources);
  }

  static empty<T>(): PagedData<T> {
    return new SinglePagedData<T>(() => Promise.resolve([]));
  }
}

class SinglePagedData<T> extends PagedData<T> {
  private loaded = false;
  private items: T[] = [];

  constructor(private readonly load: () => Promise<T[]>) {
    super();
  }

  clear(): void {
    this.items = [];
    this.loaded = false;
  }

  invalidate(): void {
    this.clear();
  }

  protected async loadAllInternal(): Promise<T[]> {
    return this.loadList();
  }

  protected async loadListInternal(): Promise<Page<T>> {
    return { data: await this.loadList(), continuation: null };
  }

  private async loadList(): Promise<T[]> {
    if (!this.loaded) {
      this.items.push(...(await this.load()));
      this.loaded = true;
    }
    return [...this.items];
  }
}

class ContinuousPagedData<T> extends PagedData<T> {
  private readonly pages = new Map<string | null, Page<T>>();

  constructor(private readonly load: (continuation: string | null) => Promise<Page<T>>) {
    super();
  }

  clear(): void {
    this.pages.clear();
  }

  invalidate(continuation: string | null): void {
    this.pages.delete(continuation);
  }

  protected async loadListInternal(continuation: string | null): Promise<Page<T>> {
    const cached = this.pages.get(continuation);
    if (cached) return cached;
    const page = await this.load(continuation);
    this.pages.set(continuation, page);
    return page;
  }

  protected async loadAllInternal(): Promise<T[]> {
    const all: T[] = [];
    let page = await this.loadListInternal(null);
    all.push(...page.data);
    while (page.continuation !== null) {
      page = await this.loadListInternal(page.continuation);
      all.push(...page.data);
    }
    return all;
  }
}

class ConcatPagedData<T> extends PagedData<T> {
  constructor(private readonly sources: PagedData<T>[]) {
    super();
    if (sources.length === 0) throw new RangeError('Concat must have at least one source');
  }

  clear(): void {
    for (const source of this.sources) source.clear();
  }

  invalidate(continuation: string | null): void {
    const [index, token] = splitContinuation(continuation);
    this.sources[index]?.invalidate(token);
  }

  protected async loadAllInternal(): Promise<T[]> {
    const parts = await Promise.all(this.sources.map((s) => s.loadAll()));
    return parts.flat();
  }

  protected async loadListInternal(continuation: string | null): Promise<Page<T>> {
    const [index, token] = splitContinuation(continuation);
    const source = this.sources[index];
    if (!source) return { data: [], continuation: null };
    const page = await source.loadPage(token);
    if (page.continuation !== null) {
      return { data: page.data, continuation: combine(index, page.continuation) };
    }
    return { data: page.data, continuation: combine(index + 1, null) };
  }
}

/** Kotlin: substringBefore/After with a missing delimiter returns the whole string. */
function splitContinuation(continuation: string | null): [number, string | null] {
  if (continuation === null) return [0, null];
  const underscore = continuation.indexOf('_');
  const head = underscore === -1 ? continuation : continuation.slice(0, underscore);
  const tail = underscore === -1 ? continuation : continuation.slice(underscore + 1);
  const index = /^-?\d+$/.test(head) ? Number(head) : -1;
  return [index, tail];
}

function combine(index: number, token: string | null): string {
  return `${index}_${token ?? ''}`;
}
