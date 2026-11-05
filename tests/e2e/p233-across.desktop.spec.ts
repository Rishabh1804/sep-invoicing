import { test, expect } from '@playwright/test';
import { loadAppWithState, switchTab } from './fixtures';
import { longBook } from './load-fixture';

// P233 on the desktop (docs/UI_PASS_3.md §14a): every list-and-pane screen's list stands in a card on the page, the rows as dense as
// before, the table's head at the card's top in the card's own colour, the open row in the accent's soft colour, a group's head in
// small capitals; the page never scrolls (P80 holds the measure). Made-up names.

test('a list stands in a card: corners, edge and lift; its head the card’s colour; rows keep their height; the open row the accent’s soft colour', async ({ page }) => {
  await loadAppWithState(page, longBook());
  for (const tab of ['pageRegister', 'pageIM', 'pageClients']) {
    await switchTab(page, tab);
    const host = page.locator('.inv-page-active .inv-pane-host').first();
    await expect(host, tab).toBeVisible();
    const box = await host.evaluate(el => {
      const cs = getComputedStyle(el), probe = document.createElement('div');
      probe.style.background = 'var(--surface)'; probe.style.borderRadius = 'var(--r-card)'; probe.style.height = 'var(--row-h)'; document.body.appendChild(probe);
      const p = getComputedStyle(probe), out = { bg: cs.backgroundColor, r: cs.borderTopLeftRadius, shadow: cs.boxShadow, surf: p.backgroundColor, rc: p.borderTopLeftRadius, rowH: parseFloat(p.height),
        th: (() => { const th = el.querySelector('.inv-table thead th'); return th ? getComputedStyle(th).backgroundColor : null; })(),
        td: (() => { const td = el.querySelector('.inv-table tbody td'); return td ? td.getBoundingClientRect().height : null; })() };
      probe.remove(); return out;
    });
    expect(box.bg, tab).toBe(box.surf);
    expect(box.r, tab).toBe(box.rc);
    expect(box.shadow, tab).not.toBe('none');
    if (box.th) expect(box.th, tab).toBe(box.surf);
    if (box.td) expect(Math.round(box.td), tab).toBe(Math.round(box.rowH));
  }
  // The open row: the accent's soft colour with its rule.
  await switchTab(page, 'pageRegister');
  await page.locator('#pageRegister .inv-table tbody tr[data-action]').first().click();
  const open = page.locator('#pageRegister .inv-table tr[aria-current="true"] td').first();
  await expect(open).toBeVisible();
  const fill = await open.evaluate(el => { const p = document.createElement('div'); p.style.background = 'var(--accent-soft)'; document.body.appendChild(p); const v = getComputedStyle(p).backgroundColor; p.remove(); return [getComputedStyle(el).backgroundColor, v]; });
  expect(fill[0]).toBe(fill[1]);
  // A group's head (a day, a status) in small capitals.
  await switchTab(page, 'pageStock');
  const head = page.locator('#pageStock .inv-row-group').first();
  if (await head.count()) expect(await head.evaluate(el => getComputedStyle(el).fontVariantCaps)).toBe('all-small-caps');
  // The page itself never scrolls.
  await switchTab(page, 'pageRegister');
  expect(await page.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight)).toBeLessThanOrEqual(1);
});
