// The Worker's tests run inside the Workers runtime itself (workerd, through Cloudflare's
// vitest pool), with the bindings and vars wrangler.toml declares. GDELT and MET Norway are
// never reached: every test hands the Worker a fake upstream (test/helpers.js).
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
