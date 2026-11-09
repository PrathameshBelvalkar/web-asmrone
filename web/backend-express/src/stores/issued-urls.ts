/**
 * URLs the extension has handed to the client (cover and stream URLs). The proxy serves only
 * these, so it cannot be used as an open proxy. Exact string match, bounded, oldest evicted.
 */
export class IssuedUrls {
  private readonly urls = new Set<string>();

  constructor(private readonly max: number) {
    if (!Number.isInteger(max) || max < 1) throw new RangeError('max must be a positive integer');
  }

  add(url: string): void {
    // Re-insert so a re-issued URL counts as recent.
    this.urls.delete(url);
    this.urls.add(url);
    while (this.urls.size > this.max) {
      const oldest = this.urls.values().next();
      if (oldest.done) break;
      this.urls.delete(oldest.value);
    }
  }

  has(url: string): boolean {
    return this.urls.has(url);
  }

  get size(): number {
    return this.urls.size;
  }
}
