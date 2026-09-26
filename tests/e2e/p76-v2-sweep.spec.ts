import { test, expect } from '@playwright/test';
import { loadAppWithState } from './fixtures';
import { sweepState, walkPages, walkDialogs, problems, type Stop } from './sweep-fixture';

// P76: design system step 4, the clean-up. Every screen, every view tab on it and every dialog, on the phone, in
// both themes: no class the design system retired (§6's "Replaces" lists) is drawn anywhere, every inv- class the
// app draws is one the stylesheet defines (or a named hook), no <select> carries a data-action (a select speaks
// through `change`), no id is drawn twice, and no page renders blank. Nothing throws on the way round.

for (const scheme of ['light', 'dark'] as const) {
  test(`every screen and dialog is v2.0 only (${scheme})`, async ({ page }) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.emulateMedia({ colorScheme: scheme });
    await loadAppWithState(page, sweepState());
    const stops: Stop[] = [];
    await walkPages(page, `phone-${scheme}`, stops);
    await walkDialogs(page, `phone-${scheme}`, stops);
    expect(stops.length).toBeGreaterThan(40);
    expect(problems(stops)).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('no <select> anywhere carries a data-action, in the source either', async ({ page }) => {
  // The rendered sweep reads what is on screen; this reads every template, so a select on a screen the sweep did
  // not reach is caught too.
  const fs = await import('fs');
  const path = await import('path');
  const dir = path.join(__dirname, '..', '..', 'split');
  const hits: string[] = [];
  for (const f of fs.readdirSync(dir).filter(f => /\.(js|html)$/.test(f))) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const m of src.match(/<select\b[^>]*>/g) || []) if (/data-action=/.test(m)) hits.push(f + ': ' + m);
  }
  expect(hits).toEqual([]);
  await page.goto('about:blank');
});
