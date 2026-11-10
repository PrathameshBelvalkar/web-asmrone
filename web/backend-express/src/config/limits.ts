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
} as const;
