import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, toolbarMore, type SepState } from './fixtures';

// P214 on the desktop: the QA chain before PR 146 merges, Production (audit A5). The hand form's saved entries open to their actions
// where no pane stands beside them; the client a To-do jump filtered Entries by is a chip among the filters. Made-up names; dates from
// today.

const pad = (n: number) => String(n).padStart(2, '0');
const back = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() - n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);

const ORBIT = { id: 31, name: 'ORBIT FORGE', billingMode: 'weight', gstType: 'intra', isActive: true, rates: [{ ratePerKg: 12, effectiveFrom: '2020-04-01' }], itemRates: [] };
const NOVA = { id: 11, name: 'NOVA GEARS', billingMode: 'piece', gstType: 'intra', isActive: true, rates: [], itemRates: [] };
const run = (id: string, date: string) => ({ id, kind: 'plated', date, time: '09:00', to: '09:00', line: 'vat-a1', lineSrc: 'written', slot: 'general',
  clientId: 31, client: 'ORBIT FORGE', part: 'BRKT 9', qty: 300, unit: 'KG', basis: 'hand', src: 'hand', at: 1 });
const load = (id: string, date: string, clientId: number, client: string) => ({ id, kind: 'pickled', date, time: '16:00', clientId, client, part: 'CLAMP 165X83',
  gauge: '40X6', qty: 200, unit: 'NOS', basis: 'pickling', src: 'paste', at: 1 });
function book(entries: any[]): SepState {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM(), clients: [ORBIT, NOVA] };
  s.production = { entries, pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} } };
  return s;
}

test.describe('P214: Production on the desktop, the QA chain', () => {
  test('A5-10: the hand form’s saved entries open to their Void, and a tap on one leaves nothing open for Entries', async ({ page }) => {
    await loadAppWithState(page, book([run('R1', back(2))]));
    await switchTab(page, 'pageProduction');
    await toolbarMore(page, 'Enter by hand');
    await page.locator('#prodHandClient').selectOption('31');
    await page.locator('#prodHandPart').fill('BRKT 9');
    await page.locator('#prodHandQty').fill('120');
    await page.locator('#prodHandUnit').selectOption('KG');
    await page.locator('[data-action="invProdSaveHand"]').click();
    const saved = page.locator('[data-card="prodHandSaved"]');
    const row = saved.locator('details[data-prod-entry]');
    await expect(row).toHaveCount(1);
    await row.locator(':scope > summary').click({ position: { x: 12, y: 12 } });
    await expect(row.locator('[data-action="invProdVoid"]')).toBeVisible();
    expect(await ev(page, '_prodEntryOpen')).toBeNull();
    // Voided from the form: kept on the record, marked void, and the form stays for the next entry.
    await row.locator('[data-action="invProdVoid"]').click();
    await answerAsk(page, 'ok', 'Typed twice');
    await expect(saved.locator('details[data-prod-entry] .inv-badge', { hasText: 'void' })).toHaveCount(1);
    await expect(page.locator('#prodHandDate')).toBeVisible();
  });

  test('A5-13: the client a To-do jump filtered Entries by is a pressed chip among the filters, and its tap clears it', async ({ page }) => {
    await loadAppWithState(page, book([load('L1', back(2), 11, 'NOVA GEARS'), load('L2', back(2), 31, 'ORBIT FORGE')]));
    await switchTab(page, 'pageProduction');
    await ev(page, `todoGo(prodGo('entries', { client: 11, flag: 'nochallan' }))`);
    const chip = page.locator('#productionContent [data-prod-client-filter]');
    await expect(chip).toHaveText('NOVA GEARS');
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await chip.click();
    await expect(chip).toHaveCount(0);
    expect(await ev(page, '_prodFilter.client')).toBe('');
  });
});
