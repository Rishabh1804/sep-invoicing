import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, toolbarMoreLabels, type SepState } from './fixtures';
import { longBook } from './load-fixture';

// P194 (desktop): across the app (docs/TAB_MAP.md TM6). The desktop's own places for the same facts: Needs you's floor card says
// who is on site in the tone Floor's People card says it; History's and Knowledge's filters sit inline in their one toolbar row;
// a client's pane carries its Money in Receivables' tone; Reports' Print is its action bar's. Made-up names; dates from today.

const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
const toneOf = (page: Page, sel: string) => page.locator(sel).first().evaluate(el => {
  const re = /^inv-(?:hero|tile|fig|dot)-(ok|warning|danger|info|neutral)$/;
  const of = (e: Element) => { for (const c of Array.from(e.classList)) { const m = re.exec(c); if (m) return m[1]; } return null; };
  const own = of(el);
  if (own) return own;
  for (const d of Array.from(el.querySelectorAll('*'))) { const t = of(d); if (t) return t; }
  return 'none';
});
/* A toolbar is one row: every control on it stands beside every other (their heights overlap). */
const oneRow = (page: Page, sel: string) => page.locator(sel).first().evaluate(el => {
  const boxes = Array.from(el.children).map(k => (k as HTMLElement).getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
  return boxes.every(b => boxes.every(o => b.top < o.bottom && o.top < b.bottom));
});

function floorBook(present: number): SepState {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
  const areas = ['vat-a1', 'vat-a1', 'vat-a1', 'vat-a2', 'vat-a2', 'barrel', 'barrel', 'barrel', 'office', 'gate'];
  s.staff = areas.map((a, i) => ({ id: i + 1, name: 'Hand ' + 'ABCDEFGHIJ'[i], comp: 'hourly', area: a, hourRate: 60, active: true, onFloor: a !== 'office' && a !== 'gate' }));
  const marks: any = {};
  s.staff.forEach((w: any, i: number) => { marks[w.id] = i >= present ? { st: 'A', area: w.area, hours: 0, ot: 0 } : { st: 'P', area: w.area, hours: 8, ot: 0 }; });
  s.attendance = { [todayIso()]: { marks, extra: [], note: '' } };
  return s as SepState;
}

test.describe('P194 (desktop): across the app', () => {
  for (const [present, tone] of [[8, 'warning'], [7, 'danger']] as const) {
    test(`TM6a: Needs you’s floor card says ${present} of 10 on site in Floor’s tone (${tone})`, async ({ page }) => {
      await loadAppWithState(page, floorBook(present));
      await switchTab(page, 'pageHome');
      await expect(page.locator('#pageHome [data-tdy-onsite]')).toContainText(present + ' of 10 on site');
      expect(await toneOf(page, '#pageHome [data-tdy-onsite]')).toBe(tone);
      await switchTab(page, 'pageFloor');
      expect(await toneOf(page, '#flrHeroes [data-card="flr-people"]')).toBe(tone);
    });
  }

  test('TM6c: History is one row on the desktop: the search, its filters inline, Range and More', async ({ page }) => {
    await loadAppWithState(page, longBook());
    await switchTab(page, 'pageHistory');
    const bar = '#pageHistory [data-history-toolbar]';
    expect(await oneRow(page, bar)).toBe(true);
    for (const sel of ['#historySearch', '#historyClientFilter', '#historyType', '[data-history-range]', '[data-action="invTbMore"]'])
      await expect(page.locator(bar + ' ' + sel), sel).toBeVisible();
    await expect(page.locator(bar + ' [data-action="invTbFilter"]')).toHaveCount(0);
    expect(await toolbarMoreLabels(page)).toEqual(['Export CSV']);
  });

  test('TM6e: a floor day in History is its count; the pane holds where everybody stood and opens the day', async ({ page }) => {
    await loadAppWithState(page, floorBook(8));
    await switchTab(page, 'pageHistory');
    const row = page.locator('#historyList tr[data-ev="shift"]');
    await expect(row).toContainText('Attendance recorded: 8 present, 2 absent');
    await expect(row).not.toContainText('VAT A1 3');
    await row.locator('[data-action="invHistoryOpen"]').first().click();
    await expect(page.locator('#historyPane .inv-history-full')).toHaveText('Attendance recorded: 8 present, 2 absent. By area: VAT A1 3, Barrel 3, VAT A2 2');
    await page.locator('#historyPane [data-action="invHistoryJumpDay"]').click();
    await expect(page.locator('#pageStaff')).toHaveClass(/inv-page-active/);
    expect(await ev(page, '_attDate')).toBe(todayIso());
  });

  test('TM6f: Knowledge’s filters are inline in its one row; the top bar’s book says what the list is linked to', async ({ page }) => {
    await loadAppWithState(page, longBook());
    await switchTab(page, 'pageKnow');
    await page.locator('#knowContent .inv-viewtab[data-tab="library"]').click();
    const bar = '#knowContent [data-kb-toolbar]';
    expect(await oneRow(page, bar)).toBe(true);
    for (const sel of ['#kbSearch', '#kbKindFilter', '#kbStatusFilter', '[data-action="invKbNew"].inv-btn-primary', '[data-action="invTbMore"]'])
      await expect(page.locator(bar + ' ' + sel), sel).toBeVisible();
    await page.locator(bar + ' #kbKindFilter').selectOption('guide');
    await expect(page.locator('#kbLibrary [data-kb-row]').first()).toBeVisible();
    expect(await ev(page, `_kbFilter.kind`)).toBe('guide');
    // The search stays above the list as it scrolls (History's), outside the list.
    expect(await ev(page, `!!document.querySelector('#kbSearch').closest('.inv-pane-list')`)).toBe(false);
    // From another screen, the book opens the guides linked to it, and says so as a token that clears it.
    await switchTab(page, 'pageRegister');
    await page.locator('.inv-topbar [data-action="invKbHelp"]:visible').click();
    await expect(page.locator('#kbLinkFilter')).toContainText('Linked to');
    await page.locator('#kbLinkFilter').click();
    await expect(page.locator('#kbLinkFilter')).toHaveCount(0);
  });

  test('TM6f: Reports’ Print is its action bar’s, under the sheet; its toolbar keeps the kind and the period', async ({ page }) => {
    await loadAppWithState(page, longBook());
    await switchTab(page, 'pageReports');
    await expect(page.locator('#reportsContent .inv-actionbar [data-action="invRptPrint"].inv-btn-primary')).toBeVisible();
    await expect(page.locator('#reportsContent .inv-toolbar .inv-btn-primary')).toHaveCount(0);
    await expect(page.locator('#reportsContent .inv-toolbar [data-action="invRptKind"]')).toHaveCount(5);
  });
});
