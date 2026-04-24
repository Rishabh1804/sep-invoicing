import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    serviceWorkers: 'block',
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
