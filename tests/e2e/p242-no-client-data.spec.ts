import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { waitForBoot } from './fixtures';

// P242: the build holds no client's data (CLAUDE.md, HR-10; owner, 22 Oct 2026). This repository and the page built from it are
// public. Until that day a new device started on 21 real clients with their GSTINs (15 with contacts, 19 with rates), 759 parts
// (298 with a rate), 50 seeded challans and seven more from a first-run seed, and a once-only migration gave a client its vehicle
// and P.O. pattern by name. A device's clients, parts, prices and records now come from its own book (a backup or GitHub sync),
// never from the build.

test('a new device starts with an empty book: no client, part, price or challan comes from the build', async ({ page }) => {
  // A test's browser context starts with no storage: this is a device that has never held a book.
  await page.goto('/');
  await waitForBoot(page);
  const got = await page.evaluate(() => {
    const g = (0, eval);
    const S = g('S');
    return {
      seedClients: g('SEED_CLIENTS').length,
      itemsMaster: g('ITEMS_MASTER').length,
      clients: S.clients.length,
      items: S.items.length,
      challans: S.incomingMaterial.length,
      invoices: S.invoices.length,
      seedFn: g('typeof seedIncomingMaterial'),
      // The seeds' and the client migration's flags: a book that never ran them never gains them.
      flags: [S._scanSeed1, S._nosQtySeeded, S._clientDocDefaults1].map(f => f === undefined ? 'unset' : String(f)),
    };
  });
  expect(got).toEqual({
    seedClients: 0, itemsMaster: 0, clients: 0, items: 0, challans: 0, invoices: 0,
    seedFn: 'undefined', flags: ['unset', 'unset', 'unset'],
  });
});

test('the published page carries no seeded client, part or challan', () => {
  // What GitHub Pages serves is the built page (index.html, a copy of sep-invoicing.html), not the split sources: read it.
  for (const file of ['sep-invoicing.html', 'index.html']) {
    const html = readFileSync(file, 'utf8');
    expect(html, file).toContain('const ITEMS_MASTER = [];');
    expect(html, file).toContain('const SEED_CLIENTS = [];');
    expect(html, file).not.toContain('function seedIncomingMaterial');
    // A rate written in (the empty rate the app starts a new client with, ratePerKg: 0, is no client's).
    expect(html, file).not.toMatch(/ratePerKg:\s*[1-9]/);
  }
});
