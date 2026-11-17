/** Headers sent upstream with an issued URL, for example a Referer that the host requires. */
export type UrlHeaders = Readonly<Record<string, string>>;

export interface IssueOptions {
  /**
   * For an HLS playlist: only its child playlists go through the proxy, and its segments are left
   * as direct addresses for the browser to load from their host.
   */
  readonly directSegments?: boolean;
}

interface Issued {
  readonly headers: UrlHeaders;
  readonly directSegments: boolean;
}

/**
 * URLs the extension has handed to the client (cover, stream and playlist-segment URLs), with the
 * headers the proxy must send for each. The proxy serves only these, so it cannot be used as an open
 * proxy. Exact string match, bounded, oldest evicted.
 */
export class IssuedUrls {
  private readonly urls = new Map<string, Issued>();

  constructor(private readonly max: number) {
    if (!Number.isInteger(max) || max < 1) throw new RangeError('max must be a positive integer');
  }

  add(url: string, headers: UrlHeaders = {}, options: IssueOptions = {}): void {
    // Re-insert so a re-issued URL counts as recent.
    this.urls.delete(url);
    this.urls.set(url, { headers, directSegments: options.directSegments === true });
    while (this.urls.size > this.max) {
      const oldest = this.urls.keys().next();
      if (oldest.done) break;
      this.urls.delete(oldest.value);
    }
  }

  has(url: string): boolean {
    return this.urls.has(url);
  }

  /** Headers to send upstream for an issued URL, or undefined when the URL was not issued. */
  headersOf(url: string): UrlHeaders | undefined {
    return this.urls.get(url)?.headers;
  }

  /** True when an issued playlist's segments are to be loaded directly (see IssueOptions). */
  directSegments(url: string): boolean {
    return this.urls.get(url)?.directSegments === true;
  }

  get size(): number {
    return this.urls.size;
  }
}
