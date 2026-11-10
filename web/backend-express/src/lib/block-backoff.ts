/**
 * Pauses requests to a site after it answers with a block or bot-check page. The first pause is
 * FIRST_PAUSE_MS; each repeated block doubles it, up to MAX_PAUSE_MS. A successful answer resets it.
 * This never tries to get past a block: it only stops asking for a while.
 */
export const FIRST_PAUSE_MS = 15 * 60_000;
export const MAX_PAUSE_MS = 2 * 60 * 60_000;

export class BlockBackoff {
  private blockedUntil = 0;
  private pauseMs = FIRST_PAUSE_MS;

  constructor(private readonly now: () => number = Date.now) {}

  /** True while the site has asked us to stop. */
  isPaused(): boolean {
    return this.now() < this.blockedUntil;
  }

  /** Record a block: pause, and make the next pause longer. */
  block(): void {
    this.blockedUntil = this.now() + this.pauseMs;
    this.pauseMs = Math.min(this.pauseMs * 2, MAX_PAUSE_MS);
  }

  /** A normal answer came back: the next block starts from the first pause again. */
  reset(): void {
    this.pauseMs = FIRST_PAUSE_MS;
  }
}
