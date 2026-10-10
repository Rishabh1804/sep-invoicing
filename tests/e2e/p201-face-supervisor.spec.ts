import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { loadAppWithState, todayIso, waitForBoot, switchTab } from './fixtures';
import { PINS, guardBook, unlock, lockNow } from './p140-guard.fixture';

// P201: the supervisor's face (docs/ENTRY_FACES.md, F3; owner, 10 Oct 2026: "[the supervisor] - Attendance, Stock, Barrel", "Should
// be per batch"). The two rolls are entered on Mine in the shop's own shape and saved through the roll's own reader, so the day holds
// what the same roll pasted from WhatsApp gives, and that roll pasted later is refused; a barrel batch is a plated entry on the barrel
// line, the barrel's register, checked against the load its barrel takes. Made-up names; every date from today.

const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
const today = todayIso();
const dmy = () => { const d = today.split('-'); return `${d[2]}/${d[1]}/${d[0].slice(2)}`; };

const STAFF = [
  { id: 1, name: 'Alfa', comp: 'monthly', area: 'vat-a1', dayRate: 500, active: true, onFloor: true },
  { id: 2, name: 'Bravo', comp: 'hourly', area: 'vat-a1', hourRate: 50, active: true, onFloor: true },
  { id: 3, name: 'Charu', comp: 'hourly', area: 'barrel', hourRate: 50, active: true, onFloor: true },
  { id: 4, name: 'Delta', comp: 'monthly', area: 'vat-a2', dayRate: 500, active: true, onFloor: true },
  { id: 5, name: 'Echo', comp: 'hourly', area: 'pickling-vat', hourRate: 50, active: true, onFloor: true },
  { id: 6, name: 'Foxy', comp: 'monthly', area: 'office', dayRate: 500, active: true, onFloor: false },
  { id: 7, name: 'Golu', comp: 'monthly', area: 'gate', dayRate: 500, active: true, onFloor: false },
  { id: 8, name: 'Hira', comp: 'hourly', area: 'flex', hourRate: 50, active: true, onFloor: true },
];
function book() {
  const s: any = guardBook();
  s.staff = STAFF;
  s.attendance = {};
  s.clients = [...s.clients, { id: 11, name: 'NOVA CLAMPS', billingMode: 'weight', gstType: 'intra', gstin: '', address: '' }];
  s.incomingMaterial = [...s.incomingMaterial, { id: 'IM-301', challanNo: '301', challanDate: today, clientId: 11, clientName: 'NOVA CLAMPS', receivedDate: today, notes: '', createdAt: 1,
    items: [{ id: 'L1', partNumber: 'CLAMP 165X83 (NT)', desc: '40X6', unit: 'KG', qty: 500, rate: 10, amount: 5000, invoiced: false }] }];
  s.plant = { units: [{ id: 'U-b1', name: 'Barrel 1', station: 'barrel', kind: 'barrel', kg: 100, status: 'run' }, { id: 'U-b2', name: 'Barrel 2', station: 'barrel', kind: 'barrel', kg: 100, status: 'run' }], log: [] };
  return s;
}
/* The owner and the supervisor, whose face is the rolls, the stock and the barrel. */
async function withSupervisor(page: Page) {
  await page.evaluate(async (pins) => {
    const w = window as any;
    const mk = async (id: string, name: string, role: string, pin: string, faces?: string[]) =>
      Object.assign({ id, name, role, secret: await w.grdMakeSecret(pin), active: true, createdAt: Date.now(), createdBy: null }, faces ? { faces } : {});
    const S = (0, eval)('S');
    S.users = [await mk('U-own', 'Asha Rao', 'owner', pins.owner), await mk('U-sup', 'Esha Pal', 'supervisor', pins.super, ['roll-in', 'stock', 'barrel', 'roll-out'])];
    await w.saveState();
  }, PINS);
  await page.reload();
  await waitForBoot(page);
}
const mark = (page: Page, id: number) => ev(page, `(S.attendance['${today}'] || { marks: {} }).marks[${id}] || null`);

test.describe('P201: the supervisor’s face', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date(today + 'T09:30:00') });
    await loadAppWithState(page, book());
    await withSupervisor(page);
    await unlock(page, 'U-sup', PINS.super);
    await expect(page.locator('#pageFace.inv-page-active')).toBeVisible();
  });

  test('the in-time roll on Mine: usual places, a 6 AM block, EXTRA; saved as the pasted roll is, refused when pasted', async ({ page }) => {
    // A mark entered on the day itself (People → Attendance): a roll leaves it, so the face shows it and does not offer to change it.
    await ev(page, `attDay('${today}', true).marks[6] = { st: 'P', area: 'office', hours: 8, ot: 0, inMin: 510, outMin: 1020 }; saveState()`);
    await page.locator('[data-face-duty="roll-in"] [data-action="invFaceOpen"]').last().click();
    await expect(page.locator('#pageFace')).toHaveAttribute('data-screen', 'form');
    await expect(page.locator('[data-face-counts]')).toHaveText('Office & gate 1 · Not marked 7');
    await expect(page.locator('#facePlace6')).toBeDisabled();
    await expect(page.locator('[data-face-hand="6"] .inv-row-meta')).toHaveText('Entered on the day (People → Attendance): the roll leaves it');
    // Usual places: everyone at their home area; a hand with none (Flex) stays to be placed.
    await page.locator('[data-action="invFaceUsual"]').click();
    await expect(page.locator('[data-face-counts]')).toHaveText('VAT A1 2 · VAT A2 1 · Barrel 1 · Pickling A1 & A2 1 · Office & gate 2 · Not marked 1');
    await page.locator('#facePlace4').selectOption('absent');
    await page.locator('#facePlace8').selectOption('vat-a2');
    // A 6 AM block on VAT A1, its crew by chips, its EXTRA and what it did.
    await page.locator('[data-face-early] [data-action="invFaceBlkAdd"]').click();
    await page.locator('[data-face-blk-areas="0"] [data-area="vat-a1"]').click();
    await page.locator('[data-face-crew="0"] [data-id="1"]').click();
    await page.locator('[data-face-crew="0"] [data-id="2"]').click();
    await page.locator('#faceBlkExtra0').fill('3');
    await page.locator('#faceBlkWork0').fill('NOVA CLAMP 1000 NOS');
    await page.locator('#faceExtravat-a1').fill('8');
    await page.locator('[data-action="invFaceSave"]').click();
    await expect(page.locator('[data-card="faceRollSaved"]')).toBeVisible();

    // The day as the roll gives it: the 6 AM crew from six, a monthly hand's hours past eight as OT, the gate seven to seven.
    expect(await mark(page, 1)).toMatchObject({ st: 'P', area: 'vat-a1', inMin: 360, hours: 11, ot: 3, src: 'relay' });
    expect(await mark(page, 2)).toMatchObject({ st: 'P', area: 'vat-a1', inMin: 360, hours: 11, ot: 0 });
    expect(await mark(page, 3)).toMatchObject({ st: 'P', area: 'barrel', hours: 8 });
    expect(await mark(page, 4)).toMatchObject({ st: 'A' });
    expect(await mark(page, 5)).toMatchObject({ st: 'P', area: 'pickling-vat' });
    expect(await mark(page, 6)).toEqual({ st: 'P', area: 'office', hours: 8, ot: 0, inMin: 510, outMin: 1020 });
    expect(await mark(page, 7)).toMatchObject({ st: 'P', area: 'gate', hours: 12 });
    expect(await mark(page, 8)).toMatchObject({ st: 'P', area: 'vat-a2' });
    const extra = await ev(page, `S.attendance['${today}'].extra.map(function(x){ return [x.kind, (x.areas || [x.area]).join('+'), x.hours, x.from || '', x.to || '', (x.crew || []).join(',')]; })`);
    expect(extra).toEqual([['block', 'vat-a1', 3, '06:00', '08:30', '1,2'], ['coverage', 'vat-a1', 8, '', '', '']]);
    // The roll is kept whole, as entered on a face, and is the message for the group.
    const rp = await ev(page, `S.relayPastes[S.relayPastes.length - 1]`);
    expect(rp).toMatchObject({ kind: 'in', date: today, face: 'Esha Pal' });
    expect(rp.text).toBe(`${dmy()}/ in time\n----6:00 AM----\n----VAT A1----\n1) ALFA\n2) BRAVO\nEXTRA 3 HOURS\nNOVA CLAMP 1000 NOS\n----8:30 AM----\n` +
      `----VAT A1----\n3) ALFA\n4) BRAVO\nEXTRA 8 HOURS\n----VAT A2----\n5) HIRA\n----BARREL----\n6) CHARU\n----PICKLING A1 & A2----\n7) ECHO\n` +
      `----OFFICE & GATE----\n8) FOXY\n9) GOLU\n----MONTHLY ABSENT----\n10) DELTA`);
    const href = await page.locator('[data-face-send-roll]').getAttribute('href');
    expect(decodeURIComponent(href!.split('text=')[1])).toBe(rp.text);
    // Saved again unchanged: nothing to do. Saved again changed, the roll restates the day, where a roll pasted on top only adds:
    // the day is read again from its rolls with the new one in the old one's place, and the old is kept to refuse it when pasted.
    await page.locator('[data-action="invFaceSave"]').click();
    await expect(page.locator('.inv-toast').last()).toContainText('nothing has changed');
    const first = rp.text;
    await page.locator('#facePlace2').selectOption('absent');
    // Absent is off site, so off the 6 AM block too.
    await expect(page.locator('[data-face-crew="0"] [data-id="2"]')).toHaveCount(0);
    await page.locator('[data-action="invFaceSave"]').click();
    await expect.poll(() => mark(page, 2)).toMatchObject({ st: 'A' });
    // The block taken off and the line's EXTRA cleared: both go, and the hand who came at six is on the 8:30 shift again.
    await page.locator('[data-action="invFaceBlkDel"]').click();
    await page.locator('#faceExtravat-a1').fill('');
    await page.locator('[data-action="invFaceSave"]').click();
    await expect(page.locator('.inv-toast').last()).toContainText('The day restated from its rolls');
    expect(await ev(page, `S.attendance['${today}'].extra.length`)).toBe(0);
    expect(await mark(page, 1)).toMatchObject({ st: 'P', area: 'vat-a1', inMin: 510, hours: 8, ot: 0, src: 'relay' });
    expect(await ev(page, `S.relayPastes.filter(function(p){ return p.face; }).map(function(p){ return !!p.replacedBy; })`)).toEqual([true, true, false]);
    // The day as it stood before each restatement is in the log, saying why.
    expect(await ev(page, `S.attendanceDeletes.map(function(x){ return x.how + ': ' + x.reason; })`))
      .toEqual(Array(2).fill('reread: the in-time roll written again on Esha Pal’s screen'));
    // Mine says it is in, and by whom on Today.
    await page.locator('[data-action="invFaceFormDone"]').first().click();
    await expect(page.locator('[data-face-duty="roll-in"]')).toHaveAttribute('data-state', 'in');

    // The roll sent to the group and pasted by the owner later is refused as saved before.
    await lockNow(page);
    await unlock(page, 'U-own', PINS.owner);
    await expect(page.locator('[data-tdy-input="roll-in"] .inv-step-meta')).toContainText('by Esha Pal');
    // The roll as it stands, and the first version too (sent to the group before it was corrected): neither is read twice.
    const last = await ev(page, `S.relayPastes[S.relayPastes.length - 1].text`);
    for (const text of [last, first]) {
      const plan = await ev(page, `(function(){ var t = ${JSON.stringify(`${dmy()}, 9:45 am - Esha Pal: `)} + ${JSON.stringify(text)}; var rv = { text: t, msgs: relaySplit(t), choices: {} }; var p = relayPlan(rv); return { dupes: p.dupes, days: p.days.length }; })()`);
      expect(plan).toEqual({ dupes: 1, days: 0 });
    }
  });

  test('the out-time roll: who left at five worked out, the late blocks and a night hold', async ({ page }) => {
    // The day holds the barrel's EXTRA twice (a roll read twice): one figure on the face, the two added; a row typed by hand is the
    // day's own and stays as it is.
    await ev(page, `var d = attDay('${today}', true); d.extra.push({ kind: 'coverage', area: 'barrel', hours: 8, src: 'relay' }, { kind: 'coverage', area: 'barrel', hours: 8, src: 'relay' },
      { kind: 'coverage', area: 'vat-a2', hours: 4 }); saveState()`);
    // The in-time roll, entered on the face.
    await page.locator('[data-face-duty="roll-in"] [data-action="invFaceOpen"]').last().click();
    await expect(page.locator('#faceExtrabarrel-pick')).toHaveValue('16');
    await expect(page.locator('#faceExtravat-a2')).toHaveValue('');
    await page.locator('[data-action="invFaceUsual"]').click();
    await page.locator('#facePlace8').selectOption('vat-a2');
    await page.locator('[data-action="invFaceSave"]').click();
    await expect(page.locator('[data-card="faceRollSaved"]')).toBeVisible();
    expect(await ev(page, `S.attendance['${today}'].extra.filter(function(x){ return x.kind === 'coverage'; }).map(function(x){ return x.area + ' ' + x.hours + (x.src ? '' : ' by hand'); })`))
      .toEqual(['vat-a2 4 by hand', 'barrel 16']);
    await page.locator('[data-action="invFaceFormDone"]').first().click();
    await page.clock.setFixedTime(new Date(today + 'T20:30:00'));

    // A lesson learnt from the owner's correction of a pasted roll: an evening "VAT A1" read as three areas. It moves a pasted roll's
    // heading; the face's headings are picks, read exactly as written.
    await ev(page, `relayLearnData().heads[relayLearnKey('VAT A1', 'out 20:00')] = { areas: ['vat-a1', 'vat-a2', 'pickling-vat'], day: '${today}' }; saveState()`);
    await page.locator('[data-face-duty="roll-out"] [data-action="invFaceOpen"]').last().click();
    await expect(page.locator('[data-face-five] .inv-panel-count')).toHaveText('8');
    await page.locator('[data-face-late] [data-action="invFaceBlkAdd"]').click();
    await page.locator('#faceBlkOut0').selectOption('20:00');
    await page.locator('[data-face-crew="0"] [data-id="1"]').click();
    await page.locator('[data-face-crew="0"] [data-id="3"]').click();
    await page.locator('#faceBlkExtra0').fill('6');
    // A block with its crew and no line is refused: the Areas check cannot weigh it.
    await page.locator('[data-action="invFaceSave"]').click();
    await expect(page.locator('.inv-toast').last()).toContainText('Tick the line block 1 ran on');
    await expect(page.locator('[data-card="faceRollSaved"]')).toHaveCount(0);
    // VAT A1 with its pickling: the pickling hands are the line's own, so the block is booked to the line.
    await page.locator('[data-face-blk-areas="0"] [data-area="vat-a1"]').click();
    await page.locator('[data-face-blk-areas="0"] [data-area="pickling-vat"]').click();
    await expect(page.locator('[data-face-blk-read="0"]')).toHaveText('Booked to VAT A1 (pickling with a line is counted in the line’s block)');
    // The night hold on two lines, the barrel and VAT A2, from eight; one that ends before eight is refused.
    await page.locator('[data-face-late] [data-action="invFaceBlkAdd"]').click();
    await page.locator('#faceBlkFrom1').selectOption('20:00');
    await page.locator('#faceBlkOut1').selectOption('19:00');
    await page.locator('[data-face-blk-areas="1"] [data-area="barrel"]').click();
    await page.locator('[data-face-blk-areas="1"] [data-area="vat-a2"]').click();
    await expect(page.locator('[data-face-blk-read="1"]')).toHaveText('Booked to Barrel + VAT A2');
    await page.locator('[data-face-crew="1"] [data-id="8"]').click();
    await page.locator('#faceBlkExtra1').fill('10');
    await page.locator('[data-action="invFaceSave"]').click();
    await expect(page.locator('.inv-toast').last()).toContainText('Block 2 ends before the night hold begins at 8 PM');
    await page.locator('#faceBlkOut1').selectOption('06:00');
    await expect(page.locator('[data-face-five] .inv-panel-count')).toHaveText('5');
    // A hand who went home at their own time, on no block.
    await page.locator('#faceOut2').selectOption('19:00');
    await page.locator('[data-action="invFaceSave"]').click();
    await expect(page.locator('[data-card="faceRollSaved"]')).toBeVisible();

    expect(await mark(page, 1)).toMatchObject({ st: 'P', outMin: 1200, hours: 11, ot: 3 });
    // Home at seven by their own time: an hourly hand's hours run to it, with no overtime.
    expect(await mark(page, 2)).toMatchObject({ st: 'P', outMin: 1140, hours: 10, ot: 0 });
    expect(await mark(page, 3)).toMatchObject({ st: 'P', outMin: 1200 });
    // Left at five, as the in-time roll already had it: the roll's reader leaves a mark it would write the same (as a paste).
    expect(await mark(page, 4)).toMatchObject({ st: 'P', outMin: 1020, hours: 8 });
    const blocks = await ev(page, `S.attendance['${today}'].extra.filter(function(x){ return x.kind === 'block'; }).map(function(x){ return [(x.areas || []).join('+'), x.hours, x.from, x.to, (x.crew || []).join(',')]; })`);
    expect(blocks).toEqual([['vat-a1', 6, '17:00', '20:00', '1,3'], ['barrel+vat-a2', 10, '20:00', '06:00', '8']]);
    const rp = await ev(page, `S.relayPastes[S.relayPastes.length - 1]`);
    expect(rp).toMatchObject({ kind: 'out', face: 'Esha Pal' });
    expect(rp.text).toBe(`${dmy()}/ out time\n----5:00 PM----\n1) BRAVO 7:00 PM\n2) DELTA\n3) ECHO\n4) FOXY\n5) GOLU\n----8:00 PM----\nVAT A1\n6) ALFA\n7) CHARU\nEXTRA 6 HOURS\n` +
      `NIGHT HOLD 8 PM TO 6 AM\n----BARREL & VAT A2----\n8) HIRA\nEXTRA 10 HOURS`);
    // The same text pasted (on another day's roll, so it is not refused as saved) takes the lesson: it is live.
    const pasted = await ev(page, `(function(){ var t = ${JSON.stringify(rp.text)}.replace(${JSON.stringify(dmy())}, '01/01/26'); var rv = { text: t, msgs: relaySplit(t), choices: {} };
      return relayPlan(rv).days[0].extras.map(function(x){ return (x.row.areas || [x.row.area]).join('+'); }); })()`);
    expect(pasted[0]).toBe('vat-a1+vat-a2+pickling-vat');
    // Opened again, the form is the day as it stands: the lines ticked as booked, the own time kept.
    await page.locator('[data-action="invFaceFormDone"]').first().click();
    await page.locator('[data-face-duty="roll-out"] [data-action="invFaceOpen"]').last().click();
    await expect(page.locator('#faceOut2')).toHaveValue('19:00');
    await expect(page.locator('[data-face-blk-areas="1"] [aria-pressed="true"]')).toHaveText(['VAT A2', 'Barrel']);
    await expect(page.locator('#faceBlkFrom1')).toHaveValue('20:00');
    await expect(page.locator('#faceBlkOut1')).toHaveValue('06:00');

    // The in-time roll corrected after the out-time roll: a hand now absent is no longer sent home at five. Who went home was worked
    // out, never written, so the out-time roll is worked out again with it; the blocks and own times stand.
    await page.locator('[data-action="invFaceFormDone"]').first().click();
    await page.locator('[data-face-duty="roll-in"] [data-action="invFaceOpen"]').last().click();
    await page.locator('#facePlace4').selectOption('absent');
    await page.locator('[data-action="invFaceSave"]').click();
    await expect.poll(() => mark(page, 4)).toMatchObject({ st: 'A' });
    await expect(page.locator('.inv-toast').last()).toContainText('the out-time roll worked out again with it');
    expect(await mark(page, 1)).toMatchObject({ st: 'P', outMin: 1200, hours: 11, ot: 3 });
    expect(await mark(page, 2)).toMatchObject({ st: 'P', outMin: 1140 });
    expect(await ev(page, `S.relayPastes.filter(function(p){ return p.face && !p.replacedBy; }).map(function(p){ return p.kind + (/DELTA/.test(p.text) ? ' names Delta' : ''); })`))
      .toEqual(['in names Delta', 'out']);
    expect(await ev(page, `S.attendance['${today}'].extra.filter(function(x){ return x.kind === 'block'; }).map(function(x){ return (x.areas || []).join('+') + ' ' + (x.crew || []).join(','); })`))
      .toEqual(['vat-a1 1,3', 'barrel+vat-a2 8']);
  });

  test('a barrel batch: the barrel’s register, counted over the relayed list, checked against the load its barrel takes', async ({ page }) => {
    // The supervisor's relayed list for the day: counted until a batch of the barrel's register is entered.
    await ev(page, `prodData().entries.push({ id: 'BL1', kind: 'plated', date: '${today}', line: 'barrel', lineSrc: 'written', slot: 'day', clientId: 11, part: 'CLAMP', qty: 900, unit: 'NOS', basis: 'relay', src: 'paste', at: 1 }); prodTouch(); saveState()`);
    expect(await ev(page, `prodIndex().countedSet.BL1 === true`)).toBe(true);
    await page.locator('[data-face-duty="barrel"] [data-action="invFaceOpen"]').last().click();
    await expect(page.locator('#faceBarrel option')).toHaveCount(3);
    await page.locator('#faceBarrel').selectOption('U-b1');
    await page.locator('#faceClient').selectOption('11');
    await page.locator('#facePart').selectOption({ index: 1 });
    await expect(page.locator('#faceUnit')).toHaveValue('KG');
    await page.locator('#faceQty').fill('140');
    await page.locator('#faceTimeOut').fill('10:30');
    await page.locator('[data-action="invFaceSave"]').click();
    const e = await ev(page, `S.production.entries.find(function(x){ return x.src === 'face'; })`);
    expect(e).toMatchObject({ kind: 'plated', date: today, time: '09:30', to: '10:30', line: 'barrel', lineSrc: 'written', slot: 'general', clientId: 11, part: 'CLAMP 165X83 (NT)',
      gauge: '40X6', qty: 140, unit: 'KG', basis: 'register', src: 'face', unitId: 'U-b1', barrel: 'Barrel 1', by: 'Esha Pal' });
    // The barrel's register is counted; the relayed list beside it is also reported.
    expect(await ev(page, `[prodIndex().countedSet['${e.id}'] === true, !prodIndex().countedSet.BL1]`)).toEqual([true, true]);
    // 140 kg into a barrel that takes 100: asked.
    const row = page.locator('[data-card="faceSaved"] [data-face-entry]');
    await expect(row).toContainText('Barrel 1 · in 9:30 AM, out 10:30 AM · 140 kg');
    await expect(row.locator('[data-face-check]')).toContainText('To check: 140 kg, past the 100 kg its barrel takes');
    const msg = decodeURIComponent((await row.locator('[data-face-send]').getAttribute('href'))!.split('text=')[1]);
    expect(msg).toBe(`${dmy()}\nBARREL 1: 9:30 AM - 10:30 AM\nNOVA CLAMPS\nCLAMP 165X83 (NT) (40X6) - 140 KG`);
    expect(await ev(page, `TODO_RULE_FNS.faceCheck().map(function(t){ return t.key; })`)).toEqual([`faceCheck:heavy|${today}`]);

    // A barrel the plant register does not hold, typed by its number, is judged by its own batches, never the other barrels': five
    // of barrel 3 at 50 kg and five of barrel 4 at 150 kg, then 100 kg in barrel 3 is past what it takes, and 160 in barrel 4 is not.
    const batch = (id: string, b: string, kg: number) => `{ id: '${id}', kind: 'plated', date: '${today}', time: '11:00', line: 'barrel', lineSrc: 'written', slot: 'general', clientId: 11, ` +
      `part: 'CLAMP 165X83 (NT)', gauge: '40X6', qty: ${kg}, unit: 'KG', basis: 'register', src: 'face', barrel: '${b}', by: 'Esha Pal', at: 2 }`;
    const typed = [1, 2, 3, 4, 5].map(i => batch('T3-' + i, '3', 50)).concat([1, 2, 3, 4, 5].map(i => batch('T4-' + i, '4', 150)), [batch('T3-x', '3', 100), batch('T4-x', '4', 160)]);
    await ev(page, `[${typed.join(',')}].forEach(function(e){ prodData().entries.push(e); }); prodTouch()`);
    expect(await ev(page, `[(faceChecks().byId['T3-x'] || []).map(function(c){ return c.code + ': ' + c.text; }), (faceChecks().byId['T4-x'] || []).length]`))
      .toEqual([['heavy: 100 kg, past the 50 kg its barrel takes by its own batches'], 0]);
  });
});
