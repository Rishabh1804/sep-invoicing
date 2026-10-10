import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, toolbarMore, type SepState } from './fixtures';

// P198: a past day corrected where it is checked (owner, 10 Oct 2026: "Alright we can check, its just not in the production tab, it is
// in the day tab but corrections and comparisons are missing"). Floor → Day's line card opens Production → Lines on its line and day;
// there each run and pickling load opens to what it holds, its Correct and its Void; a correction goes back to that day; Enter by
// hand from a day stepped to starts on it; Entries opens on a day. Made-up clients and parts; dates from today.

const CLIENTS = [{ id: 11, name: 'NOVA CLAMPS PVT. LTD.', billingMode: 'piece', gstType: 'intra', gstin: '', address: '' }];
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const back = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() - n); return isoOf(d); };
const DAY = back(2);
const run = (id: string, time: string, qty: number) => ({ id, kind: 'plated', date: DAY, time, line: 'vat-a1', lineSrc: 'written', slot: 'general',
  clientId: 11, client: 'NOVA', part: 'CLAMP 165X83 (40X6)', gauge: '40X6', qty, unit: 'NOS', basis: 'hand', src: 'hand', at: 1 });
const state = (): SepState => ({ ...emptyState(), clients: CLIENTS, incomingMaterial: noSeedIM(), production: { entries: [
  run('R1', '09:00', 420), run('R2', '11:00', 300),
  { id: 'L1', kind: 'pickled', date: DAY, time: '08:30', clientId: 11, client: 'NOVA', part: 'CLAMP 165X83 (40X6)', gauge: '40X6', qty: 700, unit: 'NOS', basis: 'pickling', src: 'hand', at: 1 },
  { id: 'C1', kind: 'downtime', date: DAY, time: '12:00', to: '12:20', downtime: { cause: 'power', setAt: 1 }, basis: 'hand', src: 'hand', at: 1 },
  { id: 'T1', kind: 'plated', date: back(9), time: '10:00', line: 'vat-a1', lineSrc: 'written', slot: 'general', clientId: 11, client: 'NOVA', part: 'CLAMP 165X83 (40X6)', qty: 100, unit: 'NOS', basis: 'hand', src: 'hand', at: 1 },
], pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} } } } as any);

/* Floor → Day stepped back two days, then the line card's run: Production → Lines on that line and day. */
async function openDayLine(page: Page) {
  await switchTab(page, 'pageFloor');
  for (let k = 0; k < 2; k++) await page.locator('[data-action="invFlrStep"][data-step="-1"]').first().click();
  await page.locator('[data-line="vat-a1"] [data-action="invFlrLine"]').first().click();
  await expect(page.locator('#prodRuns')).toBeVisible();
}
const fold = (page: Page, id: string) => page.locator(`#pageProduction details[data-prod-entry="${id}"]`);
async function openFold(page: Page, id: string) {
  const d = fold(page, id);
  if (!(await d.evaluate(el => (el as HTMLDetailsElement).open))) await d.locator(':scope > summary').click({ position: { x: 12, y: 12 } });
}

test.describe('P198: a past day corrected where it is checked', () => {
  test('a run on a past day opens to its Correct; the correction goes back to that day and takes the run’s place', async ({ page }) => {
    await loadAppWithState(page, state());
    await openDayLine(page);
    expect(await page.evaluate(() => (window as any).prodLinesDay())).toBe(DAY);
    await expect(fold(page, 'R1')).toHaveCount(1);
    await openFold(page, 'R1');
    await fold(page, 'R1').locator('[data-action="invProdCorrect"]').click();
    await expect(page.locator('#prodHandQty')).toHaveValue('420');
    await expect(page.locator('#prodHandDate')).toHaveValue(DAY);
    await page.locator('#prodHandQty').fill('402');
    await page.locator('[data-action="invProdSaveHand"]').click();
    // Back on Lines, on the same day: the corrected run's place is taken by its correction.
    await expect(page.locator('#prodRuns')).toBeVisible();
    expect(await page.evaluate(() => (window as any).prodLinesDay())).toBe(DAY);
    const s = await readStoredState(page);
    const fix = s.production.entries.find((e: any) => e.replaces === 'R1');
    expect(fix).toMatchObject({ qty: 402, date: DAY, line: 'vat-a1' });
    await expect(fold(page, fix.id)).toContainText('402');
    await expect(fold(page, 'R1')).toHaveCount(0);
  });

  test('a run is voided with a reason from the day; a pickling load opens to its Correct too', async ({ page }) => {
    await loadAppWithState(page, state());
    await openDayLine(page);
    await openFold(page, 'R2');
    await fold(page, 'R2').locator('[data-action="invProdVoid"]').click();
    expect(await answerAsk(page, 'ok', 'Counted twice')).toBeTruthy();
    const s = await readStoredState(page);
    expect(s.production.entries.find((e: any) => e.id === 'R2')).toMatchObject({ voidReason: 'Counted twice' });
    expect(await page.evaluate(() => (window as any).prodLinesDay())).toBe(DAY);
    // Pickling is Lines' fourth: its loads fold the same way.
    await page.locator('[data-prod-line-switch] [data-line="pickling"]').click();
    await openFold(page, 'L1');
    await expect(fold(page, 'L1').locator('[data-action="invProdCorrect"]')).toBeVisible();
    await expect(fold(page, 'L1').locator('[data-action="invProdVoid"]')).toBeVisible();
  });

  test('Enter by hand starts on the day stepped to and its line; with no day stepped to, on today', async ({ page }) => {
    await loadAppWithState(page, state());
    await openDayLine(page);
    await toolbarMore(page, 'Enter by hand');
    await expect(page.locator('#prodHandDate')).toHaveValue(DAY);
    await expect(page.locator('#prodHandLine')).toHaveValue('vat-a1');
    // A fresh start on Lines shows the last recorded day, and a new entry there is today's.
    await loadAppWithState(page, state());
    await switchTab(page, 'pageProduction');
    await toolbarMore(page, 'Enter by hand');
    await expect(page.locator('#prodHandDate')).toHaveValue(todayIso());
  });

  test('Entries opens on a day: every entry of it, whatever its kind; the day clears', async ({ page }) => {
    await loadAppWithState(page, state());
    await openDayLine(page);
    await toolbarMore(page, 'Every entry of this day');
    await expect(page.locator('#prodEntries .inv-panel-title')).toContainText('Entries,');
    // The day's two runs, its load and its cut; not the run of nine days before.
    const ids = await page.locator('#prodEntries [data-prod-entry]').evaluateAll(els => els.map(e => e.getAttribute('data-prod-entry')));
    expect(ids.sort()).toEqual(['C1', 'L1', 'R1', 'R2']);
    await page.locator('#productionContent .inv-token').filter({ hasText: 'Day' }).click();
    await expect(page.locator('#prodEntries .inv-panel-title')).toContainText('60 days');
    await expect(page.locator('#prodEntries [data-prod-entry="T1"]')).toHaveCount(1);
  });
});
