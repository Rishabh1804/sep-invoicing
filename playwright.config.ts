import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const baseURL = `http://127.0.0.1:${PORT}`;

// Some sandboxes ship a pre-installed Chromium whose build number does not match
// the one this Playwright version expects, and downloading the matching build is
// disabled there. The SessionStart hook detects that case and points this at the
// browser that IS present. Unset everywhere else, where Playwright's own
// resolution is correct and should be left alone.
const chromiumPath = process.env.PW_CHROMIUM_PATH;
const launchOptions = chromiumPath ? { executablePath: chromiumPath } : {};

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    serviceWorkers: 'block',
    launchOptions,
  },
  webServer: {
    command: `node tests/e2e/server.mjs ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
  },
  projects: [
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 5'],
      },
      testIgnore: /.*\.desktop\.spec\.ts/,
    },
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
      testMatch: /.*\.desktop\.spec\.ts/,
    },
  ],
});
