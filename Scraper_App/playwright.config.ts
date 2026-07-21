import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Timeout mare pentru scraper - 5 minute per test */
  timeout: 300_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'html',
  use: {
    /* Headless in CI (GitHub Actions), headed locally */
    headless: !!process.env.CI,
    /* Timeout mai mare pentru acțiuni individuale */
    actionTimeout: 15_000,
    trace: 'on-first-retry',
  },

  /* Doar Chromium */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
