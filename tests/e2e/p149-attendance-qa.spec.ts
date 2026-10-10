import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, workdayIso, type SepState, openAttendance, attDayAs, toolbarMore } from './fixtures';
import { PINS, withUsers, unlock } from './p140-guard.fixture';

// P149: the QA chain's findings on Staff → Day (2 Oct 2026). Every name is made up.

const ev = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);

function book(day = todayIso()): SepState {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
  s.staff = [
    { id: 1, name: 'Alfa', comp: 'monthly', area: 'vat-a1', dayRate: 480, active: true, onFloor: true },
    { id: 2, name: 'Bravo', comp: 'hourly', area: 'vat-a2', hourRate: 50, active: true, onFloor: true },
    { id: 3, name: 'Charlie', comp: 'monthly', area: 'barrel', dayRate: 480, active: true, onFloor: true },
  ];
  s.attendance = { [day]: { marks: {
    1: { st: 'P', area: 'vat-a1', hours: 0, ot: 0 }, 2: { st: 'P', area: 'vat-a2', hours: 0, ot: 0 }, 3: { st: 'P', area: 'barrel', hours: 0, ot: 0 },
  }, extra: [], note: '' } };
  return s as SepState;
}
async function openDay(page: Page, as: 'board' | 'sheet' = 'board') {
  await switchTab(page, 'pageStaff');
  await openAttendance(page, 'day');
  await attDayAs(page, as);
}
const dayOf = async (page: Page, iso = todayIso()) => (await readStoredState(page)).attendance[iso];

/* A time typed with the keyboard, as a hand types it: the field focused, its keys, and then the field must still be THE
   field focused (marked before the keys). Chrome completes a time, and fires its change, before the last key's Tab: a
   redraw then replaced the field, focus came back on its hour, and the keys meant for the next field went into it again. */
async function typeTime(page: Page, sel: string, keys: string) {
  const f = page.locator(sel);
  await f.focus();
  await f.evaluate((el: any) => { el.__p149 = 1; });
  await page.keyboard.type(keys);
  expect(await page.evaluate(() => !!(document.activeElement as any).__p149)).toBe(true);
}
/* Tab on until `sel` has focus, as a hand does (Chrome walks a time field's parts first). */
async function tabTo(page: Page, sel: string) {
  const f = page.locator(sel);
  for (let i = 0; i < 6 && !(await f.evaluate(el => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(f).toBeFocused();
}

/* ---------- QA6-1: a time typed with the keyboard ---------- */
test('QA6-1 the sheet: In and Out typed with the keyboard, Tab between them, land as typed', async ({ page }) => {
  await loadAppWithState(page, book());
  await openDay(page, 'sheet');
  const row = '[data-att-sheet-row="1"]';
  await typeTime(page, `${row} input[data-att-in]`, '0830A');
  await expect.poll(async () => (await dayOf(page)).marks['1']).toMatchObject({ inMin: 510, hours: 8, ot: 0 });
  await tabTo(page, `${row} input[data-att-out]`);
  await typeTime(page, `${row} input[data-att-out]`, '0530P');
  await page.keyboard.press('Tab');
  await expect.poll(async () => (await dayOf(page)).marks['1']).toMatchObject({ inMin: 510, outMin: 1050, hours: 9, ot: 1 });
  // The row's figures follow at once.
  await expect(page.locator(`${row} [data-att-sheet-hours]`)).toHaveText('9');
  await expect(page.locator(`${row} [data-att-sheet-ot]`)).toHaveText('1');
  await expect(page.locator(`${row} input[data-att-in]`)).toHaveValue('08:30');
  // And the next hand's row is typed the same way.
  await typeTime(page, '[data-att-sheet-row="3"] input[data-att-in]', '0600A');
  await tabTo(page, '[data-att-sheet-row="3"] input[data-att-out]');
  await typeTime(page, '[data-att-sheet-row="3"] input[data-att-out]', '0700P');
  await expect.poll(async () => (await dayOf(page)).marks['3']).toMatchObject({ inMin: 360, outMin: 1140, hours: 13, ot: 5 });
});

test('QA6-1 the hand’s dialog: In and Out typed with the keyboard land as typed; the note, OT and the board follow', async ({ page }) => {
  await loadAppWithState(page, book());
  await openDay(page, 'board');
  await page.locator('[data-att-row="1"] [data-action="invAttEdit"]').click();
  const dlg = page.locator('[data-att-edit="1"]');
  await typeTime(page, '[data-att-edit="1"] input[data-att-in]', '0830A');
  await tabTo(page, '[data-att-edit="1"] input[data-att-out]');
  await typeTime(page, '[data-att-edit="1"] input[data-att-out]', '0745P');
  await expect.poll(async () => (await dayOf(page)).marks['1']).toMatchObject({ inMin: 510, outMin: 1185, hours: 11, ot: 3 });
  await expect(dlg.locator('[data-att-times-note]')).toContainText('11 h, OT 3 h');
  await expect(dlg.locator('input[data-att-ot]')).toHaveValue('3');
  // The board behind it is current already.
  await expect(page.locator('[data-att-row="1"]')).toContainText('8:30 AM – 7:45 PM');
  // Done closes it at the first tap, and the board says what was typed.
  await dlg.locator('.inv-dialog-foot [data-action="invAttEditClose"]').click();
  await expect(page.locator('[data-att-edit]')).toHaveCount(0);
  await expect(page.locator('[data-att-row="1"]')).toContainText('OT 3 h');
});

test('QA6-1 an OT figure typed in the dialog, then Done: one tap closes it and the figure is kept', async ({ page }) => {
  await loadAppWithState(page, book());
  await openDay(page, 'board');
  await page.locator('[data-att-row="1"] [data-action="invAttEdit"]').click();
  await page.locator('[data-att-edit="1"] input[data-att-ot]').click();
  await page.keyboard.type('2');
  // The change fires on the blur this tap causes: the dialog must not be drawn again under it.
  await page.locator('[data-att-edit="1"] .inv-dialog-foot [data-action="invAttEditClose"]').click();
  await expect(page.locator('[data-att-edit]')).toHaveCount(0);
  expect((await dayOf(page)).marks['1'].ot).toBe(2);
  await expect(page.locator('[data-att-row="1"]')).toContainText('OT 2 h');
});

test('QA6-1 EXTRA hours typed, then a tap on the board: the tap lands', async ({ page }) => {
  const s: any = book();
  s.attendance[todayIso()].extra = [{ kind: 'coverage', area: 'barrel', hours: 2 }];
  await loadAppWithState(page, s);
  await openDay(page, 'board');
  await page.locator('details[data-extra-row="0"] > summary').click();   // one line until opened (TM4b)
  await page.locator('input[data-att-extra-hours][data-idx="0"]').click();
  await page.keyboard.press('End');
  await page.keyboard.type('4');
  await page.locator('[data-att-row="3"] [data-action="invAttSet"][data-st="A"]').click();
  await expect.poll(async () => (await dayOf(page)).marks['3'].st).toBe('A');
  expect((await dayOf(page)).extra[0].hours).toBe(24);
});

test('QA6-1 a number typed, then Tab: the next field has the focus and takes the next keys; the row it left is drawn', async ({ page }) => {
  await loadAppWithState(page, book());
  await openDay(page, 'board');
  await page.locator('[data-fold="attNeed"] > summary').click();
  await page.locator('[data-need-area="vat-a1"] [data-att-need]').fill('1');
  await page.locator('[data-need-area="vat-a1"] [data-att-need]').press('Tab');
  await expect(page.locator('[data-need-area="vat-a2"] [data-att-need]')).toBeFocused();
  await page.keyboard.type('3');
  await expect.poll(async () => (await readStoredState(page)).shiftNeeds[todayIso()]).toEqual({ 'vat-a1': 1, 'vat-a2': 3 });
  await expect(page.locator('[data-need-area="vat-a1"]')).toContainText('Met');
});

test('QA6-1 an OT block’s In and Out typed with the keyboard land as typed; its length follows', async ({ page }) => {
  const s: any = book();
  s.attendance[todayIso()].extra = [{ kind: 'block', areas: ['vat-a1'], area: 'vat-a1', crew: [1], hours: 3 }];
  await loadAppWithState(page, s);
  await openDay(page, 'board');
  await typeTime(page, 'input[data-att-block-from][data-idx="0"]', '0500P');
  await tabTo(page, 'input[data-att-block-to][data-idx="0"]');
  await typeTime(page, 'input[data-att-block-to][data-idx="0"]', '0800P');
  await expect.poll(async () => (await dayOf(page)).extra[0]).toMatchObject({ from: '17:00', to: '20:00' });
  await expect(page.locator('[data-block="0"] [data-block-len]')).toHaveText('3.0 h');
  await expect(page.locator('input[data-att-block-from][data-idx="0"]')).toHaveValue('17:00');
});

/* ---------- QA6-2, 3, 8, 10, 11: a hand's OT slot is the hand's own pick, kept apart from the rows ---------- */
function dmy(iso: string): string { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y.slice(2)}`; }
/* An out-time roll with one evening block: VAT A1, Alfa and Charlie, EXTRA 3 hours, 5 PM to 8 PM. */
const OUT_ONE = (iso: string) => `${dmy(iso)}/ out time
----8:00 PM---
VAT A 1
1) ALFA
2) CHARLIE
EXTRA 3 HOURS`;
/* Two evening blocks under one heading: VAT A1 (Alfa) and VAT A2 (Charlie), 3 hours each. */
const OUT_TWO = (iso: string) => `${dmy(iso)}/ out time
----8:00 PM---
VAT A 1
1) ALFA
EXTRA 3 HOURS
VAT A 2
2) CHARLIE
EXTRA 3 HOURS`;
async function pasteRoll(page: Page, text: string) {
  await page.locator('[data-action="invAttView"][data-view="paste"]').first().click();
  await page.locator('#relayPasteText').fill(text);
  await page.locator('[data-action="invRelayRead"]').click();
}
const blocks = (d: any) => (d.extra || []).filter((x: any) => x.kind === 'block');
function dayBefore(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

test('QA6-2 a hand put on a slot by hand does not hold the slot: the roll’s evening block and its EXTRA are added', async ({ page }) => {
  await loadAppWithState(page, book());
  await openDay(page, 'sheet');
  await page.locator('[data-att-sheet-row="2"] select[data-att-slot="evening"]').selectOption('vat-a2');
  let d = await dayOf(page);
  expect(d.slotHand).toEqual({ 2: { evening: 'vat-a2' } });
  expect(blocks(d)).toEqual([expect.objectContaining({ areas: ['vat-a2'], area: 'vat-a2', crew: [2], hours: 0, from: '17:00', to: '20:00', slotMade: true })]);
  await pasteRoll(page, OUT_ONE(todayIso()));
  // Nothing on the day holds the slot: the roll's block is added, nothing is listed as kept or replaced.
  await expect(page.locator('[data-relay-extra]')).toHaveCount(1);
  await expect(page.locator('[data-relay-extra][data-kept]')).toHaveCount(0);
  await expect(page.locator('[data-relay-replaced]')).toHaveCount(0);
  await page.locator('[data-action="invRelaySave"]').click();
  d = await dayOf(page);
  expect(blocks(d).find((x: any) => x.src === 'relay')).toMatchObject({ areas: ['vat-a1'], hours: 3, from: '17:00', to: '20:00', crew: [1, 3] });
  // The pick stands, on the block made for it; the bill counts the roll's 3 hours.
  expect(blocks(d).find((x: any) => x.slotMade)).toMatchObject({ areas: ['vat-a2'], crew: [2] });
  expect(await ev(page, `labourForRange('${todayIso()}', '${todayIso()}').extraHours`)).toBe(3);
});

test('QA6-2 a pick onto an area the roll’s block covers moves the hand onto that block when the roll is saved', async ({ page }) => {
  await loadAppWithState(page, book());
  await openDay(page, 'sheet');
  await page.locator('[data-att-sheet-row="2"] select[data-att-slot="evening"]').selectOption('vat-a1');
  await pasteRoll(page, OUT_ONE(todayIso()));
  await page.locator('[data-action="invRelaySave"]').click();
  const d = await dayOf(page);
  // One evening block, the roll's, with the picked hand on it; the block made for the pick is gone. Still the roll's row.
  expect(blocks(d)).toEqual([expect.objectContaining({ src: 'relay', areas: ['vat-a1'], hours: 3, crew: [1, 3, 2] })]);
  await expect(page.locator('[data-att-sheet-row="2"] select[data-att-slot="evening"]')).toHaveValue('vat-a1');
});

test('QA6-3 a pick on a roll’s block keeps it the roll’s: read again, every block of the slot comes back with its EXTRA', async ({ page }) => {
  await loadAppWithState(page, book());
  await openDay(page, 'sheet');
  await pasteRoll(page, OUT_TWO(todayIso()));
  await page.locator('[data-action="invRelaySave"]').click();
  let d = await dayOf(page);
  expect(blocks(d).map((x: any) => [x.areas[0], x.hours, x.src])).toEqual([['vat-a1', 3, 'relay'], ['vat-a2', 3, 'relay']]);
  // Bravo, on no block, is put on the evening VAT A1 block: it stays the roll's.
  await page.locator('[data-att-sheet-row="2"] select[data-att-slot="evening"]').selectOption('vat-a1');
  d = await dayOf(page);
  expect(blocks(d).every((x: any) => x.src === 'relay')).toBe(true);
  expect(blocks(d).find((x: any) => x.areas[0] === 'vat-a1').crew).toEqual([1, 2]);
  // Read the rolls again: both blocks are read afresh, with their 3 hours each, and the pick is put back on.
  await toolbarMore(page, 'Read the rolls again');   // Day's More (TM4b)
  await answerAsk(page, 'ok');
  await page.locator('[data-action="invRelaySave"]').click();
  d = await dayOf(page);
  expect(blocks(d).map((x: any) => [x.areas[0], x.hours, x.src, x.crew])).toEqual([['vat-a1', 3, 'relay', [1, 2]], ['vat-a2', 3, 'relay', [3]]]);
  expect(await ev(page, `labourForRange('${todayIso()}', '${todayIso()}').extraHours`)).toBe(6);
});

test('QA6-8 a block over two areas: the pick says which, and the OT is booked there', async ({ page }) => {
  const day = workdayIso(), s: any = book(day);
  s.attendance[day].marks[3] = { st: 'P', area: 'barrel', hours: 11, ot: 3, inMin: 510, outMin: 1200 };
  s.attendance[day].extra = [{ kind: 'block', areas: ['barrel', 'vat-a2'], area: 'barrel', crew: [3], hours: 6, from: '17:00', to: '20:00', src: 'relay' }];
  await loadAppWithState(page, s);
  await openDay(page, 'sheet');
  await page.locator('#attDate').fill(day);
  await page.locator('#attDate').dispatchEvent('change');
  const pick = page.locator('[data-att-sheet-row="3"] select[data-att-slot="evening"]');
  await expect(pick).toHaveValue('barrel');
  await pick.selectOption('vat-a2');
  await expect(pick).toHaveValue('vat-a2');
  const d = await dayOf(page, day);
  // Still on the same block (it covers VAT A2), which is still the roll's.
  expect(blocks(d)).toEqual([expect.objectContaining({ crew: [3], src: 'relay', hours: 6 })]);
  const by = await ev(page, `(function(){ var b = labourForRange('${day}', '${day}').byArea; return [b['vat-a2'] ? b['vat-a2'].hours : 0, b.barrel ? b.barrel.hours : 0]; })()`) as number[];
  // VAT A2: Charlie's 3 OT hours, where he stood. The barrel: the block's 6 EXTRA hours, which Labour books to the block's
  // own area (it used to take his OT as well: the first area was the only one a pick could name).
  expect(by).toEqual([3, 6]);
});

test('QA6-11 a roll’s block that named no line puts its crew’s OT on their general shift’s area, never on Flex', async ({ page }) => {
  const day = workdayIso(), s: any = book(day);
  s.attendance[day].marks[1] = { st: 'P', area: 'vat-a1', hours: 11, ot: 3, inMin: 510, outMin: 1200, src: 'relay' };
  s.attendance[day].extra = [{ kind: 'block', areas: [], area: 'flex', crew: [1], hours: 0, from: '17:00', to: '20:00', src: 'relay' }];
  await loadAppWithState(page, s);
  const r = await ev(page, `(function(){ var lab = labourForRange('${day}', '${day}'), as = areaStats('${day}', '${day}'), ah = areaHoursForRange('${day}', '${day}');
    var row = function(id) { return as.rows.find(function(a){ return a.id === id; }); };
    return { lab: lab.byArea.flex ? lab.byArea.flex.hours : 0, labA1: lab.byArea['vat-a1'] && lab.byArea['vat-a1'].hours,
      ot: row('vat-a1').otHours, otFlex: row('flex').otHours, ahFlex: (ah.rows.find(function(a){ return a.id === 'flex'; }) || { ot: 0 }).ot,
      slot: attHandSlotArea(S.attendance['${day}'], 1, 'evening') }; })()`);
  expect(r).toEqual({ lab: 0, labA1: 3, ot: 3, otFlex: 0, ahFlex: 0, slot: 'vat-a1' });
});

test('QA6-10 a block made for a pick is no EXTRA row on paper or in History; Shyam’s sheet has the hand out at their own time', async ({ page }) => {
  // An earlier day: Shyam's sheet comes out filled only for a day before today.
  const day = dayBefore(todayIso()), s: any = book(day);
  s.attendance[day].marks[2] = { st: 'P', area: 'vat-a2', hours: 10, ot: 0, inMin: 540, outMin: 1140 };
  await loadAppWithState(page, s);
  await ev(page, `_attDate = '${day}'; setAttSlotArea(2, 'evening', 'vat-a2')`);
  const r = await ev(page, `(function(){ var ev = []; pushFloorEvents(ev); var rec = S.attendance['${day}'];
    return { made: rec.extra.filter(function(x){ return x.slotMade; }).length, history: ev.map(function(e){ return e.text; }).filter(function(t){ return /OT block/.test(t); }),
      deepak: attSheetDeepakHtml('${day}', true), shyam: attSheetShyamHtml('${day}', rec) }; })()`) as any;
  expect(r.made).toBe(1);
  expect(r.history).toEqual([]);
  // Deepak's EXTRA table: no row for it (no Flex, no 0); the hand's own line says where they stood.
  const exTable = r.deepak.split('<div class="inv-as-slot">EXTRA</div>')[1];
  expect(exTable).not.toContain('Flex');
  expect(exTable).not.toContain('Bravo');
  expect(r.deepak).toMatch(/Bravo[\s\S]*?VAT A2[\s\S]*?VAT A2/);
  // Shyam's back page: Bravo in the 5 PM list at his own 7 PM, no evening block "out at 8:00 PM".
  expect(r.shyam).toContain('Bravo 7:00 PM');
  expect(r.shyam).not.toContain('8:00 PM');
});

/* ---------- QA6-4, 5, 9: the times a hand's hours are worked out from ---------- */
test('QA6-4 an in typed with no out, past the shift’s end, is no out: 0 hours until it is typed', async ({ page }) => {
  await loadAppWithState(page, book());
  await openDay(page, 'sheet');
  await typeTime(page, '[data-att-sheet-row="1"] input[data-att-in]', '0800P');
  await expect.poll(async () => (await dayOf(page)).marks['1']).toMatchObject({ inMin: 1200, hours: 0, ot: 0 });
  await tabTo(page, '[data-att-sheet-row="1"] input[data-att-out]');
  await typeTime(page, '[data-att-sheet-row="1"] input[data-att-out]', '0600A');
  await expect.poll(async () => (await dayOf(page)).marks['1']).toMatchObject({ inMin: 1200, outMin: 1800, hours: 10, ot: 2 });
});

test('QA6-5 moving a hand’s area keeps an OT typed in the dialog; onto the gate it is worked out again', async ({ page }) => {
  const s: any = book();
  s.attendance[todayIso()].marks[1] = { st: 'P', area: 'vat-a1', hours: 8, ot: 0, inMin: 510, outMin: 1020 };
  await loadAppWithState(page, s);
  await openDay(page, 'board');
  await page.locator('[data-att-row="1"] [data-action="invAttEdit"]').click();
  const dlg = page.locator('[data-att-edit="1"]');
  await dlg.locator('input[data-att-ot]').fill('2');
  // The figure is committed (its change, on leaving the field) before the area is picked.
  await dlg.locator('input[data-att-ot]').blur();
  await expect.poll(async () => (await dayOf(page)).marks['1'].ot).toBe(2);
  await dlg.locator('select[data-att-area]').selectOption('vat-a2');
  await expect.poll(async () => (await dayOf(page)).marks['1'].area).toBe('vat-a2');
  expect((await dayOf(page)).marks['1']).toMatchObject({ area: 'vat-a2', ot: 2, hours: 8 });
  await dlg.locator('select[data-att-area]').selectOption('gate');
  expect((await dayOf(page)).marks['1']).toMatchObject({ area: 'gate', ot: 0 });
});

test('QA6-9 present to half day with times typed: the hours are worked out again, and back', async ({ page }) => {
  await loadAppWithState(page, book());
  await openDay(page, 'sheet');
  await typeTime(page, '[data-att-sheet-row="1"] input[data-att-in]', '0830A');
  await expect.poll(async () => (await dayOf(page)).marks['1']).toMatchObject({ inMin: 510, hours: 8 });
  await page.locator('[data-att-sheet-row="1"] [data-action="invAttSet"][data-st="H"]').click();
  expect((await dayOf(page)).marks['1']).toMatchObject({ st: 'H', hours: 4, ot: 0 });
  await page.locator('[data-att-sheet-row="1"] [data-action="invAttSet"][data-st="P"]').click();
  expect((await dayOf(page)).marks['1']).toMatchObject({ st: 'P', hours: 8, ot: 0 });
});

/* ---------- QA6-7: overtime placed alike by Labour, the Areas card and Hours by area ---------- */
test('QA6-7 one split: each hand’s overtime in the area of their OT slot, on all three readings', async ({ page }) => {
  const day = workdayIso(), s: any = book(day);
  s.attendance[day].marks[1] = { st: 'P', area: 'vat-a1', hours: 11, ot: 3, inMin: 510, outMin: 1200 };
  s.attendance[day].marks[2] = { st: 'P', area: 'vat-a2', hours: 11, ot: 0, inMin: 510, outMin: 1200 };
  s.attendance[day].slotHand = { 1: { evening: 'vat-a2' }, 2: { evening: 'vat-a1' } };
  s.attendance[day].extra = [
    { kind: 'block', areas: ['vat-a2'], area: 'vat-a2', crew: [1], hours: 0, from: '17:00', to: '20:00', slotMade: true },
    { kind: 'block', areas: ['vat-a1'], area: 'vat-a1', crew: [2], hours: 0, from: '17:00', to: '20:00', slotMade: true }];
  await loadAppWithState(page, s);
  const r = await ev(page, `(function(){ var lab = labourForRange('${day}', '${day}').byArea, as = areaStats('${day}', '${day}').rows, ah = areaHoursForRange('${day}', '${day}').rows;
    var a = function(list, id) { return list.find(function(x){ return x.id === id; }) || {}; };
    return { lab: [lab['vat-a1'].hours, lab['vat-a2'].hours],
      areas: [[a(as, 'vat-a1').otHours, a(as, 'vat-a1').hours], [a(as, 'vat-a2').otHours, a(as, 'vat-a2').hours]],
      hours: [[a(ah, 'vat-a1').hours, a(ah, 'vat-a1').ot], [a(ah, 'vat-a2').hours, a(ah, 'vat-a2').ot]] }; })()`);
  // Alfa (monthly): 3 OT to VAT A2. Bravo (hourly): 3 hours past eight to VAT A1, 8 on VAT A2's general shift. Those 3 are
  // hours, not overtime (the hourly tier has none): the Areas card and Hours by area both count them as no OT.
  expect(r).toEqual({ lab: [3, 11], areas: [[0, 3], [3, 8]], hours: [[11, 0], [11, 3]] });
});

/* ---------- QA6-6: wages are the guard's "wages" setting, everywhere on Staff ---------- */
test('QA6-6 a role that may not see wages sees hours and heads on Staff, never a ₹; the worker sheet keeps the rates', async ({ page }) => {
  const day = workdayIso(), s: any = book(day);
  s.attendance[day].marks[1] = { st: 'P', area: 'vat-a1', hours: 11, ot: 3, inMin: 510, outMin: 1200 };
  s.attendance[day].extra = [{ kind: 'coverage', area: 'barrel', hours: 8 }];
  s.labour = { extraRate: 47.5 };
  await loadAppWithState(page, s);
  await withUsers(page);
  await unlock(page, 'U-sup', PINS.super);
  await switchTab(page, 'pageStaff');
  const content = page.locator('#attContent');
  // People opens on Attendance's Day (TM4b; its Overview went): no labour ₹/kg and no payroll, which are Pay's.
  await expect(page.locator('#attDayVerdict')).toBeVisible();
  await expect(page.locator('#dashLabour')).toHaveCount(0);
  await expect(page.locator('#dashPayBank')).toHaveCount(0);
  // Day: no day's cost, no EXTRA rate.
  await openAttendance(page, 'day');
  await page.locator('#attDate').fill(day);
  await page.locator('#attDate').dispatchEvent('change');
  await expect(page.locator('#attExtra')).toBeVisible();
  await expect(page.locator('[data-fold="attDayCost"]')).toHaveCount(0);
  await expect(content).not.toContainText('₹');
  // Week: the grid, no week's cost.
  await openAttendance(page, 'week');
  await expect(page.locator('#attWeekGrid')).toBeVisible();
  await expect(page.locator('[data-card="labour"]')).toHaveCount(0);
  await expect(content).not.toContainText('₹');
  // Areas: the extra in hours, who carried it in hours, the staffing without "worked here".
  await page.locator('[data-action="invAttView"][data-view="areas"]').click();
  await expect(page.locator('#areaStaffing')).toBeVisible();
  await expect(page.locator('#areaAbsorb')).toContainText('8.0 h');
  await expect(content).not.toContainText('₹');
  // The worker sheet: no rate fields, and a save keeps the rates stored.
  await page.locator('[data-action="invAttView"][data-view="roster"]').click();
  await page.locator('[data-action="invAttEditWorker"][data-id="1"]').click();
  await expect(page.locator('#wedName')).toBeVisible();
  await expect(page.locator('#wedDay, #wedHour, #wedMonth')).toHaveCount(0);
  await expect(page.locator('[data-wages-hidden]')).toBeVisible();
  await page.locator('#wedArea').selectOption('vat-a2');
  await page.locator('[data-action="invAttSaveWorker"]').click();
  await expect.poll(async () => (await readStoredState(page)).staff.find((w: any) => w.id === 1).area).toBe('vat-a2');
  expect((await readStoredState(page)).staff.find((w: any) => w.id === 1)).toMatchObject({ dayRate: 480, comp: 'monthly' });
  await expect(page.locator('[data-grd-ask]')).toHaveCount(0);
});

/* ---------- QA6-12: an entry on Staff → Day is a floor entry ---------- */
test('QA6-12 a role that may not make floor entries is told so on Staff → Day, never asked a PIN, and nothing is written', async ({ page }) => {
  await loadAppWithState(page, book());
  await withUsers(page, { roles: { supervisor: { pages: ['pageHome', 'pageFloor', 'pageStaff', 'pageProduction', 'pageStock', 'pagePower'], may: [], wages: false, finance: false } } });
  await unlock(page, 'U-sup', PINS.super);
  await openDay(page, 'sheet');
  const refused = async () => {
    expect(await answerAsk(page, 'ok')).toContain('Your ID can’t enter attendance. Ask the owner.');
    await expect(page.locator('[data-grd-ask]')).toHaveCount(0);
  };
  await page.locator('[data-att-sheet-row="1"] [data-action="invAttSet"][data-st="A"]').click();
  await refused();
  await page.locator('[data-att-sheet-row="1"] input[data-att-in]').fill('08:30');
  await page.locator('[data-att-sheet-row="1"] input[data-att-in]').dispatchEvent('change');
  await refused();
  await expect(page.locator('[data-att-sheet-row="1"] input[data-att-in]')).toHaveValue('');
  await page.locator('[data-att-sheet-row="1"] select[data-att-slot="evening"]').selectOption('vat-a2');
  await refused();
  await page.locator('[data-att-sheet-row="1"] select[data-att-area]').selectOption('barrel');
  await refused();
  await page.locator('[data-action="invAttAddExtra"]').click();
  await refused();
  await toolbarMore(page, 'Delete this day');   // Day's More (TM4b)
  await refused();
  const d = await dayOf(page);
  expect(d.marks['1']).toEqual({ st: 'P', area: 'vat-a1', hours: 0, ot: 0 });
  expect(d.slotHand).toBeUndefined();
  expect(d.extra).toEqual([]);
});

/* ---------- QA2-8: a roll arrives when WhatsApp sent it ---------- */
test('QA2-8 a roll keeps the minute WhatsApp sent it, and Today reads its arrival from that, not from the paste', async ({ page }) => {
  await loadAppWithState(page, book());
  await openDay(page, 'board');
  const d = dmy(todayIso());
  await pasteRoll(page, `${d}, 8:50 am - Supervisor One: ${d}/ in time
----8:30 AM---
---VAT A 1----
1) ALFA
---VAT A 2----
2) BRAVO`);
  await page.locator('[data-action="invRelaySave"]').click();
  const p = (await readStoredState(page)).relayPastes[0];
  expect(p).toMatchObject({ sentOn: todayIso(), sentAt: 530, kind: 'in' });
  expect(p.text.startsWith(`${d}/ in time`)).toBe(true);
  expect(await ev(page, `tdyArrival(S.relayPastes[0].text, S.relayPastes[0].at, '${todayIso()}', S.relayPastes[0])`)).toBe(530);
  expect(await ev(page, `tdyInput(TDY_INPUTS[0], '${todayIso()}').text`)).toContain('8:50 AM');
});
