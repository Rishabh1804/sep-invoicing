import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { loadAppWithState, todayIso, waitForBoot, switchTab, toolbarMore } from './fixtures';
import { PINS, guardBook, unlock } from './p140-guard.fixture';

// P203: the sheets on paper (docs/ENTRY_FACES.md, F5; owner, 10 Oct 2026: "Every one will have an option to print out their sheets
// as well, if they want to fill in manually and file it in my table"). Mine prints the blank sheet of each duty its person enters
// (the roll and the attendance sheet and the stock message as they were; the pickling sheet, the barrel batch sheet and the VAT
// register pages new), and the day as entered, to file: each duty's record of the day, whoever entered it, a voided or corrected
// record never. Production prints the floor's three for any day. Each page one A4 sheet. Made-up names; every date from today.

const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
const today = todayIso();
const addDays = (iso: string, n: number) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

function book() {
  const s: any = guardBook();
  s.staff = [{ id: 1, name: 'Alfa', comp: 'monthly', area: 'vat-a1', dayRate: 500, active: true, onFloor: true },
    { id: 2, name: 'Bravo', comp: 'hourly', area: 'barrel', hourRate: 50, active: true, onFloor: true }];
  s.attendance = { [today]: { marks: { 1: { st: 'P', area: 'vat-a1', hours: 8, src: 'relay', inMin: 510, outMin: 1020 }, 2: { st: 'A' } }, extra: [] } };
  s.clients = [...s.clients, { id: 11, name: 'NOVA CLAMPS', billingMode: 'weight', gstType: 'intra', gstin: '', address: '' },
    { id: 12, name: 'ORBIT ENGG', billingMode: 'piece', gstType: 'intra', gstin: '', address: '' }];
  s.power = { causes: [{ id: 'PCS-1', kind: 'reason', name: 'Grid trip', scope: 'grid', spellings: ['grid trip'], at: 1 }] };
  s.production = { entries: [
    // Two loads into the tank (one on Mine, one from WhatsApp, re-pickled), one voided, one corrected by the load after it.
    { id: 'P1', kind: 'pickled', date: today, time: '09:00', clientId: 11, client: 'NOVA CLAMPS', part: 'CLAMP 165X83 (NT)', gauge: '40X6', qty: 774, unit: 'NOS', basis: 'pickling', src: 'face', by: 'Ravi Kant', at: 1 },
    { id: 'P2', kind: 'pickled', date: today, time: '10:15', clientId: 12, client: 'ORBIT ENGG', part: 'TINA(3303)', qty: 36.5, unit: 'KG', basis: 'pickling', src: 'paste', sentBy: 'Ravi', rework: true, at: 2 },
    { id: 'P3', kind: 'pickled', date: today, time: '08:00', clientId: 11, client: 'NOVA CLAMPS', part: 'LINER', qty: 999, unit: 'NOS', basis: 'pickling', src: 'face', by: 'Ravi Kant', voidedAt: 3, voidReason: 'typed twice', at: 3 },
    { id: 'P4', kind: 'pickled', date: today, time: '11:00', clientId: 11, client: 'NOVA CLAMPS', part: 'BRKT 9', qty: 50, unit: 'NOS', basis: 'pickling', src: 'face', by: 'Ravi Kant', at: 4 },
    { id: 'P5', kind: 'pickled', date: today, time: '11:00', clientId: 11, client: 'NOVA CLAMPS', part: 'BRKT 9', qty: 500, unit: 'NOS', basis: 'pickling', src: 'face', by: 'Ravi Kant', replaces: 'P4', at: 5 },
    { id: 'A1', kind: 'arrived', date: today, time: '08:30', clientId: 11, part: 'CLAMP 165X83 (NT)', gauge: '40X6', qty: 2000, unit: 'NOS', basis: 'floor-in', src: 'face', challanNo: '301', by: 'Ravi Kant', at: 6 },
    // A barrel batch entered on Mine.
    { id: 'B1', kind: 'plated', date: today, time: '10:00', to: '11:30', line: 'barrel', lineSrc: 'written', slot: 'general', clientId: 12, part: 'BOLT M8', qty: 45, unit: 'KG', basis: 'register', src: 'face', barrel: 'Barrel 2', by: 'Mohan Iyer', at: 7 },
    // VAT A1 from a page entered on Mine; VAT A2 read from a photo of the page, a batch a round.
    { id: 'V1', kind: 'plated', date: today, time: '09:45', to: '10:20', line: 'vat-a1', lineSrc: 'written', slot: 'general', clientId: 11, part: 'CLAMP 165X83(40X6)', qty: 960, unit: 'NOS', basis: 'register', src: 'face', pageId: 'PG1', by: 'Indu Sen',
      rounds: [{ time: '9:45 AM', qty: 120, written: '120' }, { time: '10:20 AM', qty: 840, written: '3+4x120' }], at: 8 },
    { id: 'V2', kind: 'plated', date: today, time: '10:30', to: '13:05', line: 'vat-a2', lineSrc: 'written', slot: 'general', clientId: 11, part: 'LINER', qty: 936, unit: 'NOS', basis: 'register', src: 'photo',
      rounds: [{ time: '11:45', qty: 468, batch: true, written: '3×156' }, { time: '1:05', qty: 468, batch: true, written: '3x156' }], at: 9 },
    { id: 'D1', kind: 'downtime', date: today, time: '11:16', to: '11:21', basis: 'register', src: 'face', logId: 'face|' + today, downtime: { cause: 'power', reason: 'PCS-1', setAt: 10, setBy: 'Indu Sen' }, at: 10 },
  ], pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} },
  pages: [{ id: 'PG1', date: today, line: 'vat-a1', style: 'rounds', by: 'Indu Sen', uid: 'U-all', at: 11, counted: 960, total: 1000,
    rows: [{ time: '09:45', to: '', client: '11', part: 'CLAMP 165X83(40X6)', fig: '120' }, { time: '10:20', to: '', client: '11', part: 'CLAMP 165X83(40X6)', fig: '3+4x120' }] }] };
  return s;
}
/* The owner and one person; `faces` are the duties they enter. */
async function withFace(page: Page, faces: string[]) {
  await page.evaluate(async ({ pins, faces }) => {
    const w = window as any;
    const mk = async (id: string, name: string, role: string, pin: string, f?: string[]) =>
      Object.assign({ id, name, role, secret: await w.grdMakeSecret(pin), active: true, createdAt: Date.now(), createdBy: null }, f ? { faces: f } : {});
    const S = (0, eval)('S');
    S.users = [await mk('U-own', 'Asha Rao', 'owner', pins.owner), await mk('U-all', 'Indu Sen', 'supervisor', pins.super, faces)];
    await w.saveState();
  }, { pins: PINS, faces });
  await page.reload();
  await waitForBoot(page);
  await unlock(page, 'U-all', PINS.super);
  await expect(page.locator('#pageFace.inv-page-active')).toBeVisible();
}
const sheets = (page: Page) => page.locator('.inv-print-view-active .inv-as-page').evaluateAll(ps => ps.map(p => (p as HTMLElement).dataset.sheet + ((p as HTMLElement).dataset.line ? ':' + (p as HTMLElement).dataset.line : '')));
const cells = (page: Page, sel: string) => page.locator(sel).evaluateAll(rs => rs.map(r => Array.from(r.children).map(c => (c.textContent || '').trim())));
/* Each page one A4 sheet: measured at the sheet's width under print media, and the PDF has as many pages as there are sheets. */
async function oneSheetEach(page: Page) {
  const n = (await sheets(page)).length;
  await page.setViewportSize({ width: 794, height: 1123 });
  await page.emulateMedia({ media: 'print' });
  for (const h of await page.locator('.inv-print-view-active .inv-as-page').evaluateAll(ps => ps.map(p => p.getBoundingClientRect().height / (96 / 25.4)))) expect(h).toBeLessThanOrEqual(297);
  const pdf = await page.pdf({ format: 'A4', printBackground: true });
  expect((pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length).toBe(n);
  await page.emulateMedia({ media: 'screen' });
  await page.setViewportSize({ width: 393, height: 851 });
}

test.describe('P203: the sheets on paper', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date(today + 'T17:30:00') });
    await loadAppWithState(page, book());
  });

  test('Mine prints the blank sheet of every duty it carries, in the day’s order, each page one A4 sheet', async ({ page }) => {
    await withFace(page, ['roll-in', 'pickling', 'incoming', 'stock', 'attsheet', 'barrel', 'vat', 'roll-out']);
    await expect(page.locator('[data-face-sheets] .inv-row-meta')).toContainText('Pickling sheet');
    await page.locator('[data-action="invFacePrint"][data-kind="blank"]').click();
    expect(await sheets(page)).toEqual(['shyam-in', 'shyam-out', 'deepak', 'pickling', 'stock-sup', 'barrel', 'vat:vat-a1', 'vat:vat-a2']);
    // The pickling sheet: loads into the tank, then Material in; nothing filled.
    const pk = page.locator('[data-sheet="pickling"]');
    await expect(pk.locator('[data-fsh="loads"] th')).toHaveText(['#', 'Into the tank at', 'Client', 'Part and gauge', 'Quantity', 'NOS / KG', 'Re-pickled', 'Note']);
    await expect(pk.locator('[data-fsh="loads"] tbody tr')).toHaveCount(17);
    await expect(pk.locator('[data-fsh="incoming"] th')).toHaveText(['#', 'Came in at', 'Client', 'Challan no.', 'Part and gauge', 'Counted', 'NOS / KG', 'Note']);
    await expect(pk.locator('.inv-as-fill')).toHaveCount(0);
    // The barrel: a batch a row, in and out. VAT A1: a round a row; VAT A2: a batch a row, began and ended; both with the power log.
    await expect(page.locator('[data-sheet="barrel"] [data-fsh="batches"] th')).toHaveText(['#', 'Barrel', 'Client', 'Part and gauge', 'Quantity', 'NOS / KG', 'In', 'Out', 'Rework', 'Note']);
    await expect(page.locator('[data-line="vat-a1"] [data-fsh="rounds"] th')).toHaveText(['#', 'Time', 'Client', 'Part', 'Figure as written', 'Note']);
    await expect(page.locator('[data-line="vat-a1"] [data-fsh="rounds"] tbody tr')).toHaveCount(28);
    await expect(page.locator('[data-line="vat-a2"] [data-fsh="rounds"] th')).toHaveText(['#', 'Began (START)', 'Ended (END)', 'Client', 'Part', 'Figure as written', 'Note']);
    await expect(page.locator('[data-line="vat-a2"] [data-fsh="cuts"] tbody tr')).toHaveCount(4);
    await expect(page.locator('[data-sheet="vat"] .inv-as-fill')).toHaveCount(0);
    await oneSheetEach(page);
  });

  test('each face prints only its own: the pickling hand a sheet of loads, the clerk the attendance sheet and the VAT pages', async ({ page }) => {
    await withFace(page, ['pickling']);
    await page.locator('[data-action="invFacePrint"][data-kind="blank"]').click();
    expect(await sheets(page)).toEqual(['pickling']);
    await expect(page.locator('[data-fsh="incoming"]')).toHaveCount(0);
    await expect(page.locator('[data-fsh="loads"] tbody tr')).toHaveCount(26);
    await oneSheetEach(page);
    await page.locator('[data-action="invClosePrint"]').first().click();
    // The day as entered: the loads alone (the face does not count what comes in).
    await page.locator('[data-action="invFacePrint"][data-kind="filled"]').click();
    expect(await sheets(page)).toEqual(['pickling-filled']);
    await expect(page.locator('[data-fsh="incoming"]')).toHaveCount(0);

    await page.evaluate(() => { (0, eval)('S').users[1].faces = ['attsheet', 'vat']; (0, eval)('renderFace()'); });
    await page.locator('[data-action="invClosePrint"]').first().click();
    await page.locator('[data-action="invFacePrint"][data-kind="blank"]').click();
    expect(await sheets(page)).toEqual(['deepak', 'vat:vat-a1', 'vat:vat-a2']);
  });

  test('the day as entered: each duty’s record of the day, who entered it, a voided or corrected record never', async ({ page }) => {
    await withFace(page, ['roll-in', 'pickling', 'incoming', 'stock', 'barrel', 'vat', 'roll-out']);
    await page.locator('[data-action="invFacePrint"][data-kind="filled"]').click();
    expect(await sheets(page)).toEqual(['shyam-in', 'shyam-out', 'pickling-filled', 'stock-sup', 'barrel-filled', 'vat-filled:vat-a1', 'vat-filled:vat-a2']);
    // The roll filled from the day, said as entered rather than as a worked example.
    await expect(page.locator('[data-sheet="shyam-in"]')).toContainText('As entered in the app.');
    await expect(page.locator('[data-sheet="shyam-in"]')).not.toContainText('worked example');
    // The stock as entered: a supervisor does not see money, so the face prints their own sheet filled, never the prices.
    await expect(page.locator('[data-sheet="stock-sup"]')).toContainText('As entered in the app.');
    await expect(page.locator('[data-sheet="stock-sup"]')).not.toContainText('₹');
    // Loads in time order: the voided one never, the corrected one as corrected (500, not 50).
    const pk = page.locator('[data-sheet="pickling-filled"]');
    await expect(pk.locator('[data-fsh-from]')).toHaveText('As entered: 3 on Mine by Ravi Kant, 1 from WhatsApp.');
    expect(await cells(page, '[data-sheet="pickling-filled"] [data-fsh="loads"] tbody tr')).toEqual([
      ['1', '9:00 AM', 'NOVA CLAMPS', 'CLAMP 165X83 (NT) (40X6)', '774', 'NOS', '', 'Mine, Ravi Kant'],
      ['2', '10:15 AM', 'ORBIT ENGG', 'TINA(3303)', '36.50', 'KG', 'Yes', 'WhatsApp, Ravi'],
      ['3', '11:00 AM', 'NOVA CLAMPS', 'BRKT 9', '500', 'NOS', '', 'Mine, Ravi Kant']]);
    expect(await cells(page, '[data-sheet="pickling-filled"] [data-fsh="incoming"] tbody tr')).toEqual([
      ['1', '8:30 AM', 'NOVA CLAMPS', '301', 'CLAMP 165X83 (NT) (40X6)', '2,000', 'NOS', 'Mine, Ravi Kant']]);
    expect(await cells(page, '[data-sheet="barrel-filled"] [data-fsh="batches"] tbody tr')).toEqual([
      ['1', '2', 'ORBIT ENGG', 'BOLT M8', '45', 'KG', '10:00 AM', '11:30 AM', '', 'Mine, Mohan Iyer']]);
    // VAT A1 as typed on Mine: the run's client and part where it begins, the ditto under them, the figure as written; the total
    // the page wrote and what the app counts.
    const a1 = page.locator('[data-line="vat-a1"]');
    await expect(a1.locator('[data-fsh-from]')).toContainText('Entered on Mine by Indu Sen');
    expect(await cells(page, '[data-line="vat-a1"] [data-fsh="rounds"] tbody tr')).toEqual([
      ['1', '9:45 AM', 'NOVA CLAMPS', 'CLAMP 165X83(40X6)', '120', ''], ['2', '10:20 AM', '"', '"', '3+4x120', '']]);
    await expect(a1.locator('.inv-as-field').first()).toContainText('1,000');
    await expect(a1.locator('.inv-as-field').nth(1)).toContainText('960 NOS');
    // The day's power log on the page, with why it went.
    expect(await cells(page, '[data-line="vat-a1"] [data-fsh="cuts"] tbody tr')).toEqual([['1', '11:16 AM', '11:21 AM', 'Grid trip', '']]);
    // VAT A2 from a photo: a batch a row, the time as the page wrote it (the register's 1:05 is the afternoon).
    expect(await cells(page, '[data-line="vat-a2"] [data-fsh="rounds"] tbody tr')).toEqual([
      ['1', '10:30 AM', '11:45', 'NOVA CLAMPS', 'LINER', '3×156', 'Register photo'], ['2', '', '1:05', '"', '"', '3x156', '']]);
    await oneSheetEach(page);

    // A day with nothing entered: the day as entered is not offered.
    await page.locator('[data-action="invClosePrint"]').first().click();
    await page.locator('[data-action="invFaceStep"][data-step="-1"]').click();
    await expect(page.locator('[data-action="invFacePrint"][data-kind="filled"]')).toBeDisabled();
    await expect(page.locator('[data-face-sheets] .inv-row-meta')).toContainText('nothing entered on ' + await ev(page, `formatDate('${addDays(today, -1)}')`) + ' yet');
  });

  test('Production prints the floor’s sheets for any day: blank, or as entered with what has nothing left out and said', async ({ page }) => {
    await switchTab(page, 'pageProduction');
    await toolbarMore(page, 'Print sheets');
    await expect(page.locator('#fshDate')).toHaveValue(today);
    await page.locator('[data-action="invFshPreview"][data-kind="blank"]').click();
    expect(await sheets(page)).toEqual(['pickling', 'barrel', 'vat:vat-a1', 'vat:vat-a2']);
    await expect(page.locator('[data-sheet="pickling"] [data-fsh="incoming"]')).toHaveCount(1);
    await page.locator('[data-action="invClosePrint"]').first().click();

    // Yesterday holds nothing: as entered prints nothing, and says why.
    await toolbarMore(page, 'Print sheets');
    await page.locator('#fshDate').fill(addDays(today, -1));
    await page.locator('[data-action="invFshPreview"][data-kind="filled"]').click();
    await expect(page.locator('.inv-toast').last()).toContainText('Nothing is entered on');
    // Today, with VAT A2 unticked: what is entered, the rest left out.
    await page.locator('#fshDate').fill(today);
    await page.locator('[data-fsh-pick="vat-a2"]').uncheck();
    await page.locator('[data-action="invFshPreview"][data-kind="filled"]').click();
    expect(await sheets(page)).toEqual(['pickling-filled', 'barrel-filled', 'vat-filled:vat-a1']);
    await oneSheetEach(page);
  });
});
