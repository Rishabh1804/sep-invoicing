// The Worker's tests run inside the Workers runtime itself (workerd, through Cloudflare's vitest pool), with the assets
// binding wrangler.toml declares over dist/: build it first (bash split/build.sh at the repository's root; CI does).
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    include: ['test/**/*.test.js'],
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
      },
    },
  },
});
