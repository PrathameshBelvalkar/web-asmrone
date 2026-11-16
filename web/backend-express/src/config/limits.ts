/** Fixed limits and timeouts. Values mirror the Kotlin server (see web/backend/server). */
export const LIMITS = {
  /** Idle time before a feed or page id is forgotten (sliding). */
  registryTtlMs: 30 * 60_000,
  /** Maximum live feeds, and maximum live pages, kept at once. */
  registryMaxSize: 500,
  /** Maximum URLs the extension may hand out for proxying. */
  issuedUrlsMax: 20_000,
  /** asmr.one: connect and response-header timeouts. Track lists take about 20 s upstream. */
  asmrConnectTimeoutMs: 10_000,
  asmrResponseTimeoutMs: 60_000,
  /** Proxy upstream timeouts. */
  proxyConnectTimeoutMs: 15_000,
  proxyReadTimeoutMs: 60_000,
  /** japaneseasmr.com: connect and response-header timeouts, and how long fetched pages are kept. */
  jasmrConnectTimeoutMs: 10_000,
  jasmrResponseTimeoutMs: 30_000,
  jasmrCacheTtlMs: 30 * 60_000,
  /** jasmr.net (JSON API): timeouts, the gap between requests, and how long responses are kept. */
  jnetConnectTimeoutMs: 10_000,
  jnetResponseTimeoutMs: 30_000,
  jnetRequestGapMs: 1_000,
  jnetCacheTtlMs: 30 * 60_000,
  /** hentaiasmr.moe (HTML pages): timeouts, the gap between requests, and how long pages are kept. */
  hasmrConnectTimeoutMs: 10_000,
  hasmrResponseTimeoutMs: 30_000,
  hasmrRequestGapMs: 3_000,
  hasmrCacheTtlMs: 30 * 60_000,
  /** 3hentai.to (Manga & Doujinshi): timeouts, the gap between requests, and how long pages are kept. */
  threehentaiConnectTimeoutMs: 10_000,
  threehentaiResponseTimeoutMs: 30_000,
  threehentaiRequestGapMs: 1_000,
  threehentaiListingTtlMs: 5 * 60_000,
  threehentaiGalleryTtlMs: 60 * 60_000,
  threehentaiIndexTtlMs: 24 * 60 * 60_000,
  /** javdatabase.com (JAV): timeouts, the gap between requests, and how long pages are kept. */
  javdatabaseConnectTimeoutMs: 10_000,
  javdatabaseResponseTimeoutMs: 30_000,
  javdatabaseRequestGapMs: 1_000,
  javdatabaseListingTtlMs: 10 * 60_000,
  javdatabaseDetailTtlMs: 6 * 60 * 60_000,
  javdatabaseStaticTtlMs: 24 * 60 * 60_000,
  /** How long the page where released movies start is remembered (Latest and Upcoming). */
  javBoundaryTtlMs: 60 * 60_000,
  /**
   * jav.guru (JAV streams): timeouts, the gap between requests to jav.guru and to the embed host,
   * and how long each step's answer is kept. Search is rate-limited on the site, so the gap is wide.
   */
  javguruConnectTimeoutMs: 10_000,
  javguruResponseTimeoutMs: 30_000,
  javguruRequestGapMs: 2_000,
  javguruEmbedGapMs: 1_000,
  javguruPostTtlMs: 7 * 24 * 60 * 60_000,
  javguruMissTtlMs: 24 * 60 * 60_000,
  javguruServersTtlMs: 24 * 60 * 60_000,
  javguruStreamTtlMs: 60 * 60_000,
} as const;
