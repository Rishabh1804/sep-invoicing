import { test, expect } from '@playwright/test';
import { loadAppWithState } from './fixtures';
import { sweepState } from './sweep-fixture';
import { walkSelects, probed, type Jump } from './p79-select-scroll.fixture';

// P79 (desktop): picking an option in any drop-down, or pressing a filter chip or segment, on any page, view tab or
// dialog, leaves the page where it was. Receivables sent the page back to the top on every client picked.

test('a change inside a view never moves the page (desktop)', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await loadAppWithState(page, sweepState());
  const jumps: Jump[] = [];
  await walkSelects(page, jumps);
  // It reached the drop-downs the owner meant: Receivables' client pickers among them.
  expect(probed.filter(p => / select|#/.test(p)).length).toBeGreaterThan(15);
  expect(probed.some(p => p.includes('Receivables') && p.includes('data-bank-client'))).toBe(true);
  expect(jumps.map(j => `${j.where}: ${j.control} top ${j.before}→${j.after}, scroll ${j.scrollBefore}→${j.scrollAfter}`)).toEqual([]);
  expect(errors).toEqual([]);
});
