import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { loadAppWithState, switchTab, toolbarMore } from './fixtures';
import { guardBook } from './p140-guard.fixture';

// P287 (owner, 23 Nov 2026): the sheets for the days he is away. A hand fills them on paper and sends a photo every half hour; the
// app is to take only the new rows from each photo. So Production → More → Print sheets prints a run of days at once, each
// blank sheet carrying its code (kind, day, page), a strip of half hours to tick when the photo is sent, numbered rows that run
// on to a spare page 2, and the rule for a wrong row; with a stop sheet for the whole plant and the attendance sheet. Each page
// one A4 sheet. Made-up names; fixed dates, since a run of days is about the calendar (a Monday to the Monday after).

const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
const MON = '2026-11-23', NEXT_MON = '2026-11-30';

function book() {
  const s: any = guardBook();
  s.staff = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, name: 'Hand ' + (i + 1), comp: i % 2 ? 'hourly' : 'monthly', area: 'vat-a1', dayRate: 500, hourRate: 50, active: true, onFloor: true }));
  return s;
}
const pages = (page: Page) => page.locator('.inv-print-view-active .inv-as-page');
async function open(page: Page) {
  await loadAppWithState(page, book());
  await switchTab(page, 'pageProduction');
  await toolbarMore(page, 'Print sheets');
}
async function oneSheetEach(page: Page) {
  const n = await pages(page).count();
  await page.setViewportSize({ width: 794, height: 1123 });
  await page.emulateMedia({ media: 'print' });
  const hs = await pages(page).evaluateAll(ps => ps.map(p => [(p as HTMLElement).querySelector('[data-fsh-code]')?.textContent, p.getBoundingClientRect().height / (96 / 25.4)]));
  for (const [code, h] of hs) expect(h as number, String(code)).toBeLessThanOrEqual(297);
  const pdf = await page.pdf({ format: 'A4', printBackground: true });
  expect((pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length).toBe(n);
  await page.emulateMedia({ media: 'screen' });
}

test.describe('P287: sheets to photograph as they fill', () => {
  test('one day, coded: each sheet its code, the strip, rows that run on to page 2, the rule; one A4 sheet each', async ({ page }) => {
    await open(page);
    await page.locator('#fshDate').fill(MON);
    for (const k of ['stops', 'attsheet']) await page.locator(`[data-fsh-pick="${k}"]`).check();
    await page.locator('#fshCoded').check();
    await expect(page.locator('#fshSpare')).toBeChecked();
    await page.locator('[data-action="invFshPreview"][data-kind="blank"]').click();
    // Six kinds; five have a spare page 2, the attendance sheet is its roster and has one page.
    const codes = await pages(page).evaluateAll(ps => ps.map(p => (p as HTMLElement).querySelector('[data-fsh-code]')!.getAttribute('data-fsh-code')));
    expect(codes).toEqual(['PKL', 'PKL', 'BRL', 'BRL', 'VA1', 'VA1', 'VA2', 'VA2', 'STP', 'STP'].map((k, i) => `SEP SHEET ${k} ${MON} PAGE ${i % 2 + 1}`).concat([`SEP SHEET ATT ${MON} PAGE 1`]));
    // The code is printed as it is kept.
    await expect(pages(page).first().locator('[data-fsh-code]')).toHaveText(`SEP SHEET PKL ${MON} PAGE 1`);
    // VAT A1: page 1's rows are 1 to 23, page 2 runs on from 24.
    const nums = (i: number) => pages(page).nth(i).locator('[data-fsh="rounds"] tbody tr td:first-child').allInnerTexts();
    const p1 = await nums(4), p2 = await nums(5);
    expect(p1[0]).toBe('1');
    expect(p2[0]).toBe(String(p1.length + 1));
    expect(p2.length).toBe(p1.length);
    // The strip: 24 half hours from 8:00, on every sheet that is photographed through the day.
    const strip = await pages(page).nth(4).locator('[data-fsh="sent"] td').allInnerTexts();
    expect(strip.length).toBe(24);
    expect([strip[0], strip[1], strip[11], strip[12], strip[23]]).toEqual(['8:00', '8:30', '1:30', '2:00', '7:30']);
    await expect(pages(page).nth(10).locator('[data-fsh="sent"]')).toHaveCount(0);
    // The rule for a wrong row, and the stop sheet's five causes.
    await expect(pages(page).nth(4)).toContainText('strike it with one line and write it again on the next free row');
    const stops = pages(page).nth(8);
    await expect(stops.locator('[data-fsh="stops"] thead')).toContainText('Stopped at');
    for (const why of ['Power', 'No material', 'Breakdown', 'Short of hands', 'Other']) await expect(stops).toContainText(why);
    await oneSheetEach(page);
  });

  test('a run of days leaves Sundays out, and a sheet not coded prints as it always did', async ({ page }) => {
    await open(page);
    await page.locator('#fshDate').fill(MON);
    await page.locator('#fshTo').fill(NEXT_MON);
    for (const k of ['pickling', 'barrel', 'vat-a2']) await page.locator(`[data-fsh-pick="${k}"]`).uncheck();
    await page.locator('#fshCoded').check();
    await page.locator('#fshSpare').uncheck();
    await page.locator('[data-action="invFshPreview"][data-kind="blank"]').click();
    const days = await pages(page).evaluateAll(ps => ps.map(p => (p as HTMLElement).querySelector('[data-fsh-code]')!.getAttribute('data-fsh-code')!.split(' ')[3]));
    // Monday to Saturday, then the Monday after: seven days, the Sunday between them left out.
    expect(days).toEqual(['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-30']);
    await expect(page.locator('.inv-toast').last()).toContainText('7 days, 7 sheets');
    await page.locator('[data-action="invClosePrint"]').first().click();
    // Not coded: no code, no strip, the rows it always had.
    await toolbarMore(page, 'Print sheets');
    await page.locator('#fshTo').fill('');
    await page.locator('#fshCoded').uncheck();
    await page.locator('[data-action="invFshPreview"][data-kind="blank"]').click();
    await expect(pages(page)).toHaveCount(1);
    await expect(page.locator('[data-fsh-code], [data-fsh="sent"]')).toHaveCount(0);
    await expect(page.locator('[data-line="vat-a1"] [data-fsh="rounds"] tbody tr')).toHaveCount(28);
    expect(await ev(page, `fshRunDays('2026-11-29', '2026-11-29').length`)).toBe(1);   // one day is always itself, a Sunday too
  });
});
