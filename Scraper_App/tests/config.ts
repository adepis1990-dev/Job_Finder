/**
 * Configurare globală pentru scrapere.
 * Valorile pot fi suprascrise prin variabile de mediu (environment variables).
 */
export class ScraperConfig {
  /** Numărul maxim de rezultate per scraper (env: SCRAPER_MAX_RESULTS) */
  static get MAX_RESULTS(): number {
    return parseInt(
      process.env.SCRAPER_MAX_RESULTS ||
      process.env.EJOBS_MAX ||
      process.env.HIPO_MAX ||
      '10',
      10
    );
  }

  /** Timeout general pentru navigare (ms) */
  static readonly NAV_TIMEOUT = 15000;

  /** Timeout pentru acțiuni individuale (ms) */
  static readonly ACTION_TIMEOUT = 8000;
}
