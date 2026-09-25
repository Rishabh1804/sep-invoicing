import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, openSettingsAt, readStoredState, switchTab, type SepState } from './fixtures';

// P50: Settings in six groups, each section folded to a line that says what it
// is set to, each section saved on its own; desktop two-pane. Part weights moved
// to Items; the zinc uplift measured from the shop's own bills.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);

async function load(page: Page, extra: Partial<SepState> = {}) {
  await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM(), ...extra } as SepState);
}

test.describe('P50: Settings', () => {
  test('six groups, every section folded, and each line says what it is set to', async ({ page }) => {
    await load(page);
    await page.evaluate(() => localStorage.removeItem('sep_inv_settings_ui'));
    await page.locator('[data-action="invOpenSettings"]').first().click();
    await expect(page.locator('.inv-set-group-title')).toHaveText(['Business', 'Checks & alerts', 'Costing', 'Labour', 'Connections', 'Data & device']);
    expect(await page.locator('details.inv-set-sec[open]').count()).toBe(0);
    await expect(page.locator('[data-sum="rateCheck"]')).toHaveText('10% · ₹100 · ±3%');
    await expect(page.locator('[data-sum="overtime"]')).toContainText('cap ₹68.20/h from 01 Sep 2026');
    await expect(page.locator('[data-sum="rest"]')).toHaveText('full at 90% · half at 80% · 3 paid holidays');
    // Part weights are no longer here.
    await expect(page.locator('#setPWPart')).toHaveCount(0);
  });

  test('a section saves on its own, and closing with an unsaved one asks', async ({ page }) => {
    await load(page);
    const before = await g(page, 'S.bankDetails') as string;
    await openSettingsAt(page, 'company');
    const save = page.locator('[data-action="invSaveSettingsSec"][data-sec="company"]');
    await expect(save).toBeDisabled();
    await page.locator('#setCompName').fill('Test Plating Works');
    await expect(save).toBeEnabled();
    await expect(page.locator('details[data-sec="company"]')).toHaveClass(/inv-set-dirty/);

    // An edit elsewhere, not saved.
    await page.locator('details[data-sec="bank"] > summary').click();
    await page.locator('#setBank').fill('A bank nobody saved');
    await save.click();
    await expect(page.locator('.inv-toast')).toContainText('Company saved');
    await expect(save).toBeDisabled();
    await expect(page.locator('[data-sum="company"]')).toContainText('Test Plating Works');
    const s = await readStoredState(page);
    expect(s.company.name).toBe('Test Plating Works');
    expect(s.bankDetails).toBe(before);

    let asked = '';
    page.once('dialog', d => { asked = d.message(); d.dismiss(); });
    await page.locator('[data-action="invCloseSettings"]').click();
    expect(asked).toContain('Bank details');
    await expect(page.locator('#settingsScrim')).toHaveCount(1);
    page.once('dialog', d => d.accept());
    await page.locator('[data-action="invCloseSettings"]').click();
    await expect(page.locator('#settingsScrim')).toHaveCount(0);
    expect(await g(page, 'S.bankDetails')).toBe(before);
  });

  test('a refused figure leaves the section unsaved', async ({ page }) => {
    await load(page, { creditNotes: [{ id: 'CN1', cnNumber: 7, status: 'issued' }] } as Partial<SepState>);
    await openSettingsAt(page, 'cn');
    await page.locator('#setCnNextNum').fill('5');
    await page.locator('[data-action="invSaveSettingsSec"][data-sec="cn"]').click();
    await expect(page.locator('.inv-toast')).toContainText('must be above');
    await expect(page.locator('details[data-sec="cn"]')).toHaveClass(/inv-set-dirty/);
  });

  test('open sections are remembered, and the phone stacks every group', async ({ page }) => {
    await load(page);
    await openSettingsAt(page, 'overtime');
    await page.locator('[data-action="invCloseSettings"]').click();
    await page.locator('[data-action="invOpenSettings"]').first().click();
    await expect(page.locator('details[data-sec="overtime"]')).toHaveAttribute('open', '');
    await expect(page.locator('#setOtCap')).toBeVisible();
    await expect(page.locator('.inv-set-nav')).toBeHidden();
    await expect(page.locator('.inv-set-group[data-group="business"]')).toBeVisible();
  });

  test('labour sections each save only their own figures', async ({ page }) => {
    await load(page);
    await openSettingsAt(page, 'rest');
    await page.locator('#setGateFull').fill('70');
    await page.locator('#setGateHalf').fill('95');
    await page.locator('#setHolidays').fill('01-26, 08-15, 10-02, 2026-11-01, junk');
    await page.locator('[data-action="invSaveSettingsSec"][data-sec="rest"]').click();
    const l = (await readStoredState(page)).labour;
    // Half above full is swapped, junk dropped, the OT cap untouched.
    expect([l.gateFull, l.gateHalf]).toEqual([0.95, 0.7]);
    expect(l.holidays).toEqual(['01-26', '08-15', '10-02', '2026-11-01']);
    expect(l.otCap).toBe(68.2);
    await expect(page.locator('[data-sum="rest"]')).toHaveText('full at 95% · half at 70% · 4 paid holidays');
  });

  test('part weights live in Items now', async ({ page }) => {
    await load(page, { partWeights: { 'HINGE PIN': 0.045 } } as Partial<SepState>);
    await switchTab(page, 'pageClients');
    await page.locator('[data-action="invSwitchSubView"][data-view="items"]').first().click();
    const btn = page.locator('[data-action="invOpenPartWeights"]');
    await expect(btn).toHaveText('Part weights (1)');
    await btn.click();
    await expect(page.locator('#setPWList')).toContainText('HINGE PIN');
    await page.locator('#setPWPart').fill('bolt 10');
    await page.locator('#setPWWeight').fill('0.02');
    await page.locator('[data-action="invAddPartWeight"]').click();
    await expect(page.locator('#setPWList')).toContainText('BOLT 10');
    expect((await readStoredState(page)).partWeights).toEqual({ 'HINGE PIN': 0.045, 'BOLT 10': 0.02 });
    await expect(btn).toHaveText('Part weights (2)');
  });

  test('the uplift is measured from zinc bills against LME on their dates, and offered, not applied', async ({ page }) => {
    // Three bills. One date is already in the LME record; two are looked up on
    // metals.dev, which answers in USD per troy ounce as its docs show.
    const stock = {
      items: [{ id: 'Z', key: 'ZINC', name: 'Zinc', unit: 'kg', basis: 'charge', active: true, createdAt: 1 }],
      entries: [
        { id: 'b1', itemId: 'Z', kind: 'bill', qty: 500, price: 415, date: '2026-07-10', billDate: '2026-07-10', supplier: 'Alpha', billNo: 'A1', at: 1 },
        { id: 'b2', itemId: 'Z', kind: 'bill', qty: 500, price: 405, date: '2026-08-12', billDate: '2026-08-12', supplier: 'Alpha', billNo: 'A2', at: 2 },
        { id: 'b3', itemId: 'Z', kind: 'bill', qty: 500, price: 430, date: '2026-09-06', billDate: '2026-09-06', supplier: 'Beta', billNo: 'B1', at: 3 },
      ],
      pastes: [],
    };
    // 6 Sep is a Sunday: the record holds Fri 4 Sep, two days back, and that stands for it.
    const zinc = { ratePerKg: 360, premiumPerKg: 15, upliftPct: 14, basis: 'lme', updatedAt: Date.now(), source: 'metals.dev · metals.zinc', lmeHistory: { '2026-09-04': 360 } };
    await load(page, { stock, zinc } as Partial<SepState>);
    await page.evaluate(() => localStorage.setItem('sep_inv_metals_key', 'test-key'));

    const asked: string[] = [];
    // INR per USD = 1 / 0.0125 = 80; LME in USD/toz so that INR/kg is round.
    const toz = (inrKg: number) => inrKg * 0.0125 / 32.1507466;
    await page.route('https://api.metals.dev/v1/timeseries**', route => {
      const u = new URL(route.request().url());
      asked.push(u.searchParams.get('start_date') + '..' + u.searchParams.get('end_date'));
      const end = u.searchParams.get('end_date')!;
      const inr = end === '2026-07-10' ? 350 : 340;
      route.fulfill({ json: { status: 'success', currency: 'USD', unit: 'toz', rates: {
        [end]: { date: end, currencies: { INR: 0.0125, USD: 1 }, metals: { zinc: toz(inr), gold: 2000 } },
      } } });
    });

    await openSettingsAt(page, 'zinc');
    await page.locator('[data-action="invZincDeriveUplift"]').click();
    const out = page.locator('#zincUpliftOut');
    // (415 − 15) / 350 = 14.3%; (405 − 15) / 340 = 14.7%; (430 − 15) / 360 = 15.3%.
    await expect(out).toContainText('14.3%');
    await expect(out).toContainText('14.7%');
    await expect(out).toContainText('15.3%');
    await expect(out).toContainText('(04 Sep 2026)');
    await expect(out).toContainText('Median of 3 bills: 14.7% against 14.0% set');
    expect(asked).toEqual(['2026-07-06..2026-07-10', '2026-08-08..2026-08-12']);

    // Offered, not applied: the field moves and the section is unsaved.
    expect(await g(page, 'S.zinc.upliftPct')).toBe(14);
    await page.locator('[data-action="invZincUseUplift"]').click();
    await expect(page.locator('#setZincUplift')).toHaveValue('14.7');
    await expect(page.locator('details[data-sec="zinc"]')).toHaveClass(/inv-set-dirty/);
    await page.locator('[data-action="invSaveSettingsSec"][data-sec="zinc"]').click();
    const z = (await readStoredState(page)).zinc;
    expect(z.upliftPct).toBe(14.7);
    // What metals.dev answered is kept, so asking again costs nothing.
    expect(z.lmeHistory).toMatchObject({ '2026-07-10': 350, '2026-08-12': 340, '2026-09-04': 360 });
    await page.locator('[data-action="invZincDeriveUplift"]').click();
    await expect(out).toContainText('Median of 3 bills');
    expect(asked).toHaveLength(2);
  });
});
