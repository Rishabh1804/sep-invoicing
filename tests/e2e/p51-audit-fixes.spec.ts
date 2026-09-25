import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, openSettingsAt, type SepState } from './fixtures';

// P51: fixes from the 25 Sep 2026 audit. Fixed August 2026 dates on purpose:
// 15 Aug is the paid holiday one of these is about, and a past week does not move.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);
const week = ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14'];

function marks(id: number | string, days: string[], extra: Record<string, unknown> = {}) {
  const att: Record<string, any> = {};
  days.forEach(d => { att[d] = { marks: { [id]: { st: 'P', hours: 8, ot: 0, area: 'barrel', ...extra } }, extra: [], note: '' }; });
  return att;
}

test.describe('P51: audit fixes', () => {
  test('a worker set inactive still costs the days they worked', async ({ page }) => {
    const hand = { id: 1, name: 'Arun Das', comp: 'hourly', area: 'barrel', hourRate: 50, active: false, onFloor: true };
    await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM(), staff: [hand], attendance: marks(1, week) } as SepState);
    const lab = await g(page, `(function(){ var l = labourForRange('2026-08-10', '2026-08-14'); return { pool: l.pool, roster: l.rosterSize }; })()`) as any;
    expect(lab.pool).toBe(5 * 8 * 50);
    // Today's roster is still the active one.
    expect(lab.roster).toBe(0);
  });

  test('the daily tier’s weekly rest credit finds a worker whose id is text', async ({ page }) => {
    const hand = { id: 'W1', name: 'Bala', comp: 'daily', area: 'barrel', dayRate: 500, active: true, onFloor: true };
    const days = ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-08'];
    await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM(), staff: [hand], attendance: marks('W1', days) } as SepState);
    expect(await g(page, `labourForRange('2026-08-02', '2026-08-08').dailyRest`)).toBe(500);
  });

  test('a paid holiday is not a working day nobody typed', async ({ page }) => {
    const hand = { id: 1, name: 'Arun Das', comp: 'hourly', area: 'barrel', hourRate: 50, active: true, onFloor: true };
    await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM(), staff: [hand], attendance: marks(1, week) } as SepState);
    // Mon 10 – Sat 15 Aug: five days typed, the Saturday is Independence Day.
    const l = await g(page, `(function(){ var l = labourForRange('2026-08-10', '2026-08-15'); return [l.workingDays, l.daysRecorded, l.coverage]; })()`);
    expect(l).toEqual([5, 5, 1]);
    const row = await g(page, `liveCost('2026-08-10', '2026-08-15', 1000).rows.find(function(r){ return r.key === 'labour'; }).coverage`);
    expect(row).toBe(1);
  });

  test('Settings will not set the invoice number back over one already issued', async ({ page }) => {
    await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM() } as SepState);
    await g(page, `S.invPrefix = 'SEP/2026-27/'; S.invNextNum = 6; S.invoices.push({ id: 'I5', invoiceNumber: '00005', displayNumber: 'SEP/2026-27/00005', clientId: 1, date: '2026-08-10', status: 'filed', items: [], total: 0 }); saveState()`);
    await openSettingsAt(page, 'invoice');
    const save = page.locator('[data-action="invSaveSettingsSec"][data-sec="invoice"]');
    await page.locator('#setNextNum').fill('3');
    await save.click();
    await expect(page.locator('.inv-toast')).toContainText('must be above SEP/2026-27/00005');
    expect(await g(page, 'S.invNextNum')).toBe(6);
    // A new financial year's prefix has nothing issued under it: 1 is allowed.
    await page.locator('#setPrefix').fill('SEP/2027-28/');
    await page.locator('#setNextNum').fill('1');
    await save.click();
    await expect(page.locator('.inv-toast')).toContainText('Invoice series saved');
    expect(await g(page, '[S.invPrefix, S.invNextNum]')).toEqual(['SEP/2027-28/', 1]);
  });
});
