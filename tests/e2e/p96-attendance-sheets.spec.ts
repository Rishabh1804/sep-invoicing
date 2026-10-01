import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, type SepState } from './fixtures';

// P96: the attendance paper route (owner, 29 Sep 2026). Staff → Day → Print sheets gives, for the day on screen:
// Shyam's sheet (his WhatsApp roll on paper: In time with the 6 AM blocks and the 8:30 AM areas in his order, numbered
// blank lines, EXTRA boxes and the absent; Out time on the back), Deepak's sheet (the Day entry: the roster in the Day
// view's order, P / H / A, area, in, out, hours, OT, the EXTRA table, three signatures), and a copy filled from what the
// app holds. Every page is one A4 sheet. Names here are made up.

const STAFF = [
  { id: 'W1', name: 'Arun', comp: 'monthly', area: 'vat-a1', dayRate: 500, active: true, onFloor: true },
  { id: 'W2', name: 'Bala', comp: 'hourly', area: 'barrel', hourRate: 50, active: true, onFloor: true },
  { id: 'W3', name: 'Chand', comp: 'hourly', area: 'vat-a1', hourRate: 50, active: true, onFloor: true },
  { id: 'W4', name: 'Esha', comp: 'monthly', area: 'vat-a2', dayRate: 500, active: true, onFloor: true },
  { id: 'W5', name: 'Gopal', comp: 'hourly', area: 'pickling-vat', hourRate: 50, active: true, onFloor: true },
];
function state(withDay: boolean): SepState {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM(), staff: STAFF, attendance: {} };
  if (withDay) s.attendance[todayIso()] = {
    marks: {
      W1: { st: 'P', area: 'vat-a1', hours: 0, ot: 2, inMin: 510, outMin: 1140, src: 'relay' },
      W2: { st: 'P', area: 'barrel', hours: 11, ot: 0, inMin: 360, outMin: 1020 },
      W4: { st: 'A', area: 'flex', hours: 0, ot: 0 },
    },
    extra: [{ area: 'vat-a1', hours: 8, kind: 'coverage' }, { area: 'barrel', hours: 3, kind: 'block', from: '17:00', to: '20:00', crew: ['W2'] }],
    note: '',
  };
  return s as SepState;
}
const g = (p: Page, expr: string) => p.evaluate(e => (0, eval)(e), expr);
async function openDay(page: Page) {
  await switchTab(page, 'pageStaff');
  await page.locator('[data-action="invAttView"][data-view="day"]').first().click();
}

test.describe('P96: attendance sheets', () => {
  test('Print sheets on the Day view offers the three and previews them, each page one A4 sheet', async ({ page }) => {
    await loadAppWithState(page, state(true));
    await openDay(page);
    await page.locator('[data-action="invAttSheetOpen"]').click();
    await expect(page.locator('[data-as-pick="filled"]')).toBeEnabled();
    await page.locator('[data-action="invAttSheetPreview"]').click();
    const pages = page.locator('.inv-print-view-active .inv-as-page');
    await expect(pages).toHaveCount(4);
    expect(await pages.evaluateAll(ps => ps.map(p => (p as HTMLElement).dataset.sheet))).toEqual(['shyam-in', 'shyam-out', 'deepak', 'filled']);
    // On paper each page fits one A4 sheet (297mm, less nothing: the gutters are its own padding).
    await page.emulateMedia({ media: 'print' });
    const mm = await pages.evaluateAll(ps => ps.map(p => p.getBoundingClientRect().height / (96 / 25.4)));
    for (const h of mm) expect(h).toBeLessThanOrEqual(297);
    // Deepak's sheet is written by hand: In and Out have room for a time, and each area column a word (owner, 1 Oct 2026:
    // "In time Out time hardly has any space"; they were 7 and 10 mm once the shift areas were added).
    const w = await page.locator('[data-sheet="deepak"] table[data-as-entry] th').evaluateAll(ths =>
      Object.fromEntries(ths.map(t => [t.textContent, t.getBoundingClientRect().width / (96 / 25.4)])));
    for (const k of ['In', 'Out', 'General', 'Morning OT', 'Evening OT', 'Night']) expect(w[k]).toBeGreaterThanOrEqual(15);
  });

  test("Shyam's In time follows his roll: 6 AM blocks, then the 8:30 AM areas in his order, numbered on, EXTRA and the absent", async ({ page }) => {
    await loadAppWithState(page, state(false));
    await g(page, `document.getElementById('invPrintBody').innerHTML = attSheetShyamHtml('${todayIso()}')`);
    const front = page.locator('[data-sheet="shyam-in"]');
    const heads = await front.locator('.inv-as-box-h').allInnerTexts();
    // Civil under its own heading in the office's box (P124: a civil hand printed under "No line written").
    expect(heads).toEqual(['Block 1', 'Block 2', 'VAT A1', 'VAT A2', 'Barrel & pickling', 'Pickling A1 & A2', 'Office & gate', 'Civil', 'Monthly absent', 'Weekly absent']);
    expect(await front.locator('.inv-as-slot').allInnerTexts()).toEqual(['6:00 AM', '8:30 AM']);
    // Numbers run on across the areas, as he writes them: VAT A1 1–6, VAT A2 7–12 …
    const nums = await front.locator('.inv-as-grid').nth(1).locator('.inv-as-num').allInnerTexts();
    expect(nums.slice(0, 8)).toEqual(['1)', '2)', '3)', '4)', '5)', '6)', '7)', '8)']);
    // No names are printed on his sheet (blank lines, owner).
    await expect(front).not.toContainText('Arun');
    await expect(page.locator('[data-sheet="shyam-out"] .inv-as-slot')).toHaveText(['5:00 PM', 'Later']);
  });

  test("Deepak's sheet is the Day entry blank; the filled copy carries what the app holds", async ({ page }) => {
    await loadAppWithState(page, state(true));
    await g(page, `document.getElementById('invPrintBody').innerHTML = attSheetDeepakHtml('${todayIso()}', false) + attSheetDeepakHtml('${todayIso()}', true)`);
    const blank = page.locator('[data-sheet="deepak"]');
    // The roster in the Day view's order, then three rows for anyone not on it.
    const names = await blank.locator('tbody').first().locator('tr td:nth-child(2)').allInnerTexts();
    const order = await g(page, 'staffActive().map(function(w){ return w.name; })') as string[];
    expect(names).toEqual([...order, '', '', '']);
    await expect(blank.locator('.inv-as-sign')).toContainText('Checked by Deepak');
    await expect(blank.locator('tbody').first()).not.toContainText('7:00 PM');

    const filled = page.locator('[data-sheet="filled"]');
    const arun = filled.locator('tbody').first().locator('tr', { hasText: 'Arun' });
    await expect(arun.locator('td')).toHaveText(['1', 'Arun', 'M', 'P', '', '', 'VAT A1', '', '', '', '8:30 AM', '7:00 PM', '', '2.0']);
    await expect(filled.locator('tbody').first().locator('tr', { hasText: 'Esha' }).locator('td').nth(5)).toHaveText('A');
    const ex = filled.locator('tbody').nth(1);
    await expect(ex.locator('tr').nth(1).locator('td')).toHaveText(['Barrel', '5:00 PM', '8:00 PM', 'Bala', '3.0']);
  });

  test('with nothing entered for the day, the filled copy cannot be picked', async ({ page }) => {
    await loadAppWithState(page, state(false));
    await openDay(page);
    await page.locator('[data-action="invAttSheetOpen"]').click();
    await expect(page.locator('[data-as-pick="filled"]')).toBeDisabled();
    await page.locator('[data-action="invAttSheetPreview"]').click();
    await expect(page.locator('.inv-print-view-active .inv-as-page')).toHaveCount(3);
  });

  test("Shyam's sheet for an earlier day with a record comes out filled in his shape, as a worked example", async ({ page }) => {
    const y = (() => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
    const s: any = state(false);
    s.attendance[y] = {
      marks: { W1: { st: 'P', area: 'vat-a1' }, W3: { st: 'P', area: 'vat-a1', outMin: 1140 }, W2: { st: 'P', area: 'barrel' }, W4: { st: 'A' }, W5: { st: 'A' } },
      extra: [{ kind: 'coverage', area: 'vat-a1', hours: 8 }, { kind: 'block', areas: ['barrel'], from: '17:00', to: '20:00', crew: ['W2'], hours: 3 }], note: '',
    };
    await loadAppWithState(page, s);
    expect(await g(page, `!!attSheetFillFor('${y}') + '|' + !!attSheetFillFor('${todayIso()}')`)).toBe('true|false');
    await g(page, `document.getElementById('invPrintBody').innerHTML = attSheetShyamHtml('${y}', attSheetFillFor('${y}'))`);
    const front = page.locator('[data-sheet="shyam-in"]');
    await expect(front).toHaveAttribute('data-filled', '');
    const box = (h: string) => front.locator('.inv-as-box', { has: page.locator('.inv-as-box-h', { hasText: h }) });
    expect(await box('VAT A1').locator('.inv-as-fill').allInnerTexts()).toEqual(['Arun', 'Chand', '8']);
    expect(await box('Monthly absent').locator('.inv-as-fill').allInnerTexts()).toEqual(['Esha', 'Gopal']);
    const back = page.locator('[data-sheet="shyam-out"]');
    // Chand left at 7 with no block: in the 5 PM list with his own time; Bala stood the 5–8 PM barrel block.
    await expect(back.locator('.inv-as-grid').first()).toContainText('Chand 7:00 PM');
    await expect(back.locator('.inv-as-grid').first()).not.toContainText('Bala');
    // The second 5 PM box numbers on from the first's eight lines.
    await expect(back.locator('.inv-as-grid').first().locator('.inv-as-box').nth(1).locator('.inv-as-num').first()).toHaveText('9)');
    const later = back.locator('.inv-as-grid').nth(1).locator('.inv-as-box').first();
    expect(await later.locator('.inv-as-fill').allInnerTexts()).toEqual(['8:00 PM', 'Barrel', 'Bala', '3']);
  });
});
