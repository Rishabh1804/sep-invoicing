import { test, expect } from '@playwright/test';
import { walkWidgets, walkRoles } from './p224-widget-sweep.fixture';

// P224 (UI pass 3, U2; docs/UI_PASS_3.md §7i) on the phone: every widget at every size it allows, three books, both themes, each
// preset and three seeded random arrangements; no layout breaks the screen. Then each role sees only what it may.

test('every widget at every size, every preset and random arrangements draw whole on the phone', async ({ page }) => {
  test.setTimeout(600_000);
  const { errs, bad, drawn } = await walkWidgets(page, 'phone');
  expect(drawn).toBeGreaterThan(100);
  expect(errs).toEqual([]);
  expect(bad).toEqual([]);
});

test('each role, the guard on, is shown only the widgets it may see', async ({ page }) => {
  test.setTimeout(120_000);
  const seen = await walkRoles(page);
  // The office opens no money, wages or floor screen; the supervisor sees no money.
  for (const id of ['money', 'cash', 'owed', 'dtp', 'gst', 'mtd', 'pace', 'q-money', 'q-smooth', 'dofirst', 'why', 'figures', 'zinc', 'zincpaid', 'prodday', 'floornow', 'atttoday', 'stockdays',
    'clientprice', 'kilo', 'heat', 'eff', 'risk', 'turn', 'attweek', 'ot'])
    expect(seen['U-off'], 'office: ' + id).not.toContain(id);
  for (const id of ['money', 'cash', 'owed', 'dtp', 'gst', 'mtd', 'pace', 'q-money', 'dofirst', 'why', 'figures', 'zinc', 'zincpaid', 'recent', 'unbilled',
    'clientprice', 'kilo'])
    expect(seen['U-sup'], 'supervisor: ' + id).not.toContain(id);
  // The world outside is every role's (§7d: tata anyone signed in, weather anyone).
  for (const who of ['U-own', 'U-off', 'U-sup']) for (const id of ['tata', 'weather']) expect(seen[who], who + ': ' + id).toContain(id);
  expect(seen['U-own'].length).toBeGreaterThan(seen['U-off'].length);
});
