import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, type SepState } from './fixtures';

// P72 (phone): Staff on the v2.0 components (design principles §7, §9 step 3). View tabs that scroll the
// open one into view (the survey's cut-off sub-tabs); Paste message the one primary on Overview and Day,
// opening a sub-view with its way back; Day's stat strip and rows with P / H / A pressed in their tone —
// visible in dark as in light; Week a grid table; the labour card a flush panel of tiles and rows; the
// attendance paste as rows, callouts, tiles and an action bar. No v1.0 class is drawn on any of it.

function iso(offset: number): string {
  const d = new Date(todayIso() + 'T00:00:00');
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dmy(offset: number): string {
  const [y, m, d] = iso(offset).split('-');
  return `${d}/${m}/${y}`;
}

const STAFF = [
  { id: 1, name: 'Arun Das', comp: 'monthly', dayRate: 520, hourRate: 0, area: 'vat-a1', onFloor: true, active: true },
  { id: 2, name: 'Bala Singh', comp: 'hourly', dayRate: 0, hourRate: 47.5, area: 'barrel', onFloor: true, active: true },
  { id: 3, name: 'Chand Mahato', comp: 'hourly', dayRate: 0, hourRate: 47.5, area: 'vat-a2', onFloor: true, active: false },
];

function state(): SepState {
  return {
    ...emptyState(), incomingMaterial: noSeedIM(), staff: STAFF,
    areaTargets: { 'vat-a1': 4, barrel: 3 },
    attendance: {
      [todayIso()]: { marks: { 1: { st: 'P', ot: 2, hours: 0, area: 'vat-a1' }, 2: { st: 'H', ot: 0, hours: 4, area: 'barrel' } }, extra: [{ kind: 'coverage', area: 'vat-a1', hours: 8 }], note: '' },
    },
  } as unknown as SepState;
}

const V1 = '#pageStaff [class*="inv-att-"], #pageStaff [class*="inv-lab-"], #pageStaff [class*="inv-stk-"], #pageStaff [class*="inv-area-"], ' +
  '#pageStaff [class*="inv-rl-"], #pageStaff [class*="inv-client-"], #pageStaff [class*="inv-pay-"], #pageStaff .inv-card, #pageStaff .inv-stats-note, ' +
  '#pageStaff .inv-stats-caveat, #pageStaff .inv-form-input, #pageStaff .inv-form-select, #pageStaff .inv-td-fold, #pageStaff .inv-chip-active, #pageStaff .inv-empty-state';
const noV1 = async (page: Page, primaries: number) => {
  await expect(page.locator(V1)).toHaveCount(0);
  await expect(page.locator('#pageStaff .inv-btn-primary:visible')).toHaveCount(primaries);
};
const tab = (page: Page, v: string) => page.locator(`#attToolbar .inv-viewtab[data-view="${v}"]`);

test.describe('P72: Staff', () => {
  test('view tabs: six, the open one selected and scrolled into view; one primary per view; no v1.0 class', async ({ page }) => {
    await loadAppWithState(page, state());
    await switchTab(page, 'pageStaff');
    await expect(page.locator('#attToolbar .inv-viewtabs[role="tablist"] .inv-viewtab')).toHaveText(['Overview', 'Day', 'Week', 'Register', 'Pay', 'Areas', 'Roster']);
    await expect(tab(page, 'overview')).toHaveAttribute('aria-selected', 'true');
    await noV1(page, 1);
    for (const [v, primaries] of [['day', 1], ['week', 0], ['pay', 1], ['areas', 0], ['roster', 1]] as [string, number][]) {
      await tab(page, v).click();
      await expect(tab(page, v)).toHaveAttribute('aria-selected', 'true');
      await noV1(page, primaries);
    }
    // Roster sits past the phone's edge: opening it scrolls the tab row sideways, never leaving it cut off.
    const inView = await tab(page, 'roster').evaluate((el) => {
      const list = el.parentElement!.getBoundingClientRect(), r = el.getBoundingClientRect();
      return r.left >= list.left - 1 && r.right <= list.right + 1;
    });
    expect(inView).toBe(true);
    // Roster: whole-row buttons, an inactive hand muted and badged.
    const chand = page.locator('#attRoster [data-action="invAttEditWorker"][data-id="3"]');
    await expect(chand).toHaveClass(/inv-row-muted/);
    await expect(chand.locator('.inv-badge')).toContainText(['Hourly', 'VAT A2', 'Inactive']);
    await chand.click();
    await expect(page.locator('.inv-dialog .inv-field-label[for="wedName"]')).toHaveText('Name');
    await expect(page.locator('.inv-dialog .inv-form-group, .inv-dialog .inv-form-input')).toHaveCount(0);
  });

  test('Day: stat strip, P / H / A pressed in their tone in dark mode, the labour card as tiles and rows', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await loadAppWithState(page, state());
    await switchTab(page, 'pageStaff');
    await tab(page, 'day').click();
    await expect(page.locator('#attOnSite')).toHaveText('2');
    await expect(page.locator('#attHalf')).toHaveText('1');
    const arun = page.locator('[data-att-row="1"]');
    const p = arun.locator('[data-action="invAttSet"][data-st="P"]');
    await expect(p).toHaveAttribute('aria-pressed', 'true');
    await expect(arun.locator('.inv-row-meta')).toContainText('Present');
    // The chosen state reads in the tone's own colours, which differ from the row it sits on — in dark too.
    const look = await p.evaluate((el) => {
      const cs = getComputedStyle(el), row = getComputedStyle(el.closest('.inv-panel')!);
      const ok = getComputedStyle(document.documentElement).getPropertyValue('--ok');
      return { bg: cs.backgroundColor, fg: cs.color, panel: row.backgroundColor, scheme: getComputedStyle(document.documentElement).colorScheme, ok };
    });
    expect(look.bg).not.toBe(look.panel);
    expect(look.fg).not.toBe(look.bg);
    const half = page.locator('[data-att-row="2"] [data-action="invAttSet"][data-st="P"]');
    await expect(half).toHaveCount(1);
    // Hourly: no half day; Bala's half day was seeded, so neither P nor A is pressed and the row says so.
    await p.click();
    await expect(page.locator('[data-att-row="1"] [data-action="invAttSet"][data-st="P"]')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('[data-att-row="1"] .inv-row-meta')).toContainText('unmarked');
    await page.locator('[data-att-row="1"] [data-action="invAttSet"][data-st="A"]').click();
    const a = page.locator('[data-att-row="1"] [data-action="invAttSet"][data-st="A"]');
    await expect(a).toHaveAttribute('aria-pressed', 'true');
    await expect(a).toHaveClass(/inv-seg-btn-danger/);
    const aLook = await a.evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el.closest('.inv-panel')!).backgroundColor]);
    expect(aLook[0]).not.toBe(aLook[1]);
    await expect(page.locator('#attAbsent')).toHaveText('1');

    const card = page.locator('#attContent [data-card="labour"]');
    await expect(card.locator('.inv-panel-head')).toContainText('Day cost');
    await expect(card.locator('[data-tile="fixed"] .inv-tile-label')).toHaveText('Fixed');
    await expect(card.locator('.inv-row', { hasText: 'Extra (unattributed)' }).locator('.inv-num')).toHaveText('₹380.00');
  });

  test('Week is a grid table; a cell cycles; Sunday and today are marked', async ({ page }) => {
    await loadAppWithState(page, state());
    await switchTab(page, 'pageStaff');
    await tab(page, 'week').click();
    const grid = page.locator('#attWeekGrid table.inv-table.inv-table-grid');
    await expect(grid.locator('thead th')).toHaveCount(8);
    await expect(grid.locator('thead th').nth(1)).toHaveAttribute('data-sun', '');
    await expect(grid.locator('thead th[aria-current="date"]')).toHaveCount(1);
    const cell = grid.locator(`[data-action="invAttCycle"][data-id="1"][data-date="${todayIso()}"]`);
    await expect(cell).toHaveClass(/inv-cell-ok/);
    await expect(cell).toHaveText('P2');
    await cell.click();
    await expect(grid.locator(`[data-action="invAttCycle"][data-id="1"][data-date="${todayIso()}"]`)).toHaveClass(/inv-cell-warning/);
  });

  test('Paste message: a sub-view with its way back; the check as tiles, callouts, rows and an action bar', async ({ page }) => {
    await loadAppWithState(page, { ...state(), attendance: {} } as SepState);
    await switchTab(page, 'pageStaff');
    await tab(page, 'day').click();
    await page.locator('[data-action="invAttView"][data-view="paste"]').click();
    await expect(page.locator('#attToolbar .inv-viewtabs')).toHaveCount(0);
    await expect(page.locator('#attContent .inv-pagehead-title')).toHaveText('Paste message');
    await noV1(page, 1);
    // The way back returns to the view it was opened from.
    await page.locator('#attContent .inv-pagehead-back').click();
    await expect(tab(page, 'day')).toHaveAttribute('aria-selected', 'true');
    await page.locator('[data-action="invAttView"][data-view="paste"]').click();
    await page.locator('#relayPasteText').fill(`${dmy(-1)}/ in time\n----8:30 AM---\n---VAT A 1---\n1) ARUN\n---berral---\n2) BALA\n3) ZORO\nEXTRA 8 HOURS`);
    await page.locator('[data-action="invRelayRead"]').click();
    await expect(page.locator('#attContent .inv-pagehead-title')).toHaveText('Check before saving');
    await expect(page.locator('#relayReviewTiles [data-tile="red"]')).toHaveClass(/inv-tile-danger/);
    await expect(page.locator('#relayIssues .inv-callout-danger')).toContainText('ZORO');
    await expect(page.locator('#relayIssues .inv-select[data-relay-map="ZORO"]')).toHaveCount(1);
    await expect(page.locator('[data-relay-row]').filter({ hasText: 'Arun Das' }).locator('.inv-badge-ok')).toHaveText('New');
    await expect(page.locator('[data-relay-extra]')).toHaveCount(1);
    await page.locator('[data-action="invRelayLines"]').click();
    await expect(page.locator('#relayLines .inv-quote').first()).toBeVisible();
    await expect(page.locator('#relayLines [data-line-role="unknown"] .inv-dot-danger')).toHaveCount(1);
    await noV1(page, 1);
    await expect(page.locator('.inv-actionbar [data-action="invRelaySave"]')).toHaveText('Save 1 day');
    await page.locator('[data-action="invRelaySave"]').click();
    await expect(page.locator('#attDate')).toHaveValue(iso(-1));
  });
});
