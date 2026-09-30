import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, answerAsk, type SepState } from './fixtures';

// P107: the QA sweep's fold over Staff — attendance rolls, Areas, labour and Pay. Names are made up in the shop's shapes
// (the repo is public), ids are numbers as on a real device, and every date is built from today.

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);

function iso(offset = -1): string {
  const d = new Date(todayIso() + 'T00:00:00');
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dmy(offset = -1): string {
  const [y, m, d] = iso(offset).split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

const ROSTER = [
  { id: 1, name: 'Arun', comp: 'monthly', area: 'vat-a1', dayRate: 500, active: true, onFloor: true },
  { id: 2, name: 'Bala', comp: 'hourly', area: 'barrel', hourRate: 50, active: true, onFloor: true },
  { id: 3, name: 'Chand', comp: 'hourly', area: 'vat-a1', hourRate: 50, active: true, onFloor: true },
  { id: 4, name: 'Kiran', comp: 'hourly', area: 'pickling-barrel', hourRate: 50, active: true, onFloor: true },
];

async function load(page: Page, extra: Record<string, unknown> = {}) {
  await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM(), staff: ROSTER, attendance: {}, ...extra } as unknown as SepState);
}
async function paste(page: Page, text: string) {
  await switchTab(page, 'pageStaff');
  await page.locator('[data-action="invAttView"][data-view="paste"]').first().click();
  await page.locator('#relayPasteText').fill(text);
  await page.locator('[data-action="invRelayRead"]').click();
}
async function pasteAndSave(page: Page, text: string) {
  await paste(page, text);
  await page.locator('[data-action="invRelaySave"]').click();
  await expect(page.locator('[data-action="invRelaySave"]')).toHaveCount(0);
}
const parse = (page: Page, text: string) => g(page, `(function(){ var r = parseRelayRoll(${JSON.stringify(text)}, relayRoster({}), null);
  var d = r.days[r.date] || { people: {}, extra: [] }, m = {};
  Object.keys(d.people).forEach(function(id){ var w = staffById(id); m[w.name] = relayPersonMark(d.people[id], w, d.restOut); });
  return { date: r.date, marks: m, extra: d.extra, issues: r.issues.map(function(i){ return i.tone + ':' + i.text; }) }; })()`) as Promise<any>;

const IN = (extra = 'EXTRA 8 HOURS') => `${dmy()}/ in time
----8:30 AM---
---VAT A 1----
1) ARUN
2) CHAND
${extra}
---berral & pickling---
3) BALA
4) KIRAN`;

test.describe('P107: attendance rolls', () => {
  test('W1: an out-time roll\'s "everyone else left at" reaches hands the in-time roll saved', async ({ page }) => {
    await load(page);
    await pasteAndSave(page, IN());
    expect((await readStoredState(page)).attendance[iso()].marks[3]).toMatchObject({ hours: 8, outMin: 1020 });
    // The out-time roll names only Arun; the rest left at 7 PM.
    await paste(page, `${dmy()}/ out time\n----8:00 PM---\nVAT A 1\n1) ARUN\nEXTRA 6 HOURS\nBaki sab 7 pm out`);
    const chand = page.locator('[data-relay-row]').filter({ hasText: 'Chand' });
    await expect(chand).toContainText('Updated');
    await expect(chand).toContainText('7 PM');
    await page.locator('[data-action="invRelaySave"]').click();
    const day = (await readStoredState(page)).attendance[iso()];
    expect(day.marks[3]).toMatchObject({ st: 'P', hours: 10, ot: 0, outMin: 1140, outKnown: true, src: 'relay' });
    expect(day.marks[2]).toMatchObject({ hours: 10, outMin: 1140 });
    expect(day.marks[1]).toMatchObject({ outMin: 1200 });
  });

  test('W9: a roll pasted again after an edit replaces its own EXTRA; a row corrected by hand is kept', async ({ page }) => {
    await load(page);
    await pasteAndSave(page, IN());
    // The supervisor edits the message: the line's EXTRA was 16, not 8. A new hash, so it is read again.
    await paste(page, IN('EXTRA 16 HOURS'));
    await expect(page.locator('[data-relay-replaced]')).toHaveCount(1);
    await expect(page.locator('[data-relay-replaced]')).toContainText('8 h');
    await page.locator('[data-action="invRelaySave"]').click();
    let cov = (await readStoredState(page)).attendance[iso()].extra.filter((e: any) => e.kind === 'coverage');
    expect(cov.map((e: any) => e.hours)).toEqual([16]);

    // Corrected by hand on the day, the row is the owner's: the next edit of the roll does not write over it.
    await g(page, `_attDate = '${iso()}'; setAttExtraHours(0, 12)`);
    await paste(page, IN('EXTRA 20 HOURS'));
    await expect(page.locator('[data-relay-extra][data-kept]')).toHaveCount(1);
    await page.locator('[data-action="invRelaySave"]').click();
    cov = (await readStoredState(page)).attendance[iso()].extra.filter((e: any) => e.kind === 'coverage');
    expect(cov.map((e: any) => e.hours)).toEqual([12]);
  });

  test('WB6: a mark the roll wrote and the owner corrected is kept by the next roll', async ({ page }) => {
    await load(page);
    await pasteAndSave(page, IN());
    await g(page, `_attDate = '${iso()}'; setAttOt(1, 2)`);
    await paste(page, `${dmy()}/ out time\n----8:00 PM---\nVAT A 1\n1) ARUN\nEXTRA 6 HOURS`);
    await expect(page.locator('[data-relay-row]').filter({ hasText: 'Arun' })).toContainText('Kept');
    await page.locator('[data-action="invRelaySave"]').click();
    expect((await readStoredState(page)).attendance[iso()].marks[1]).toMatchObject({ ot: 2, hours: 8 });
  });

  test('W10: a spelling two workers share matches neither; a placed spelling beats another worker\'s name', async ({ page }) => {
    await load(page, { staff: [
      { id: 1, name: 'Raju Das', comp: 'hourly', area: 'vat-a1', hourRate: 50, active: true, relayNames: ['GOLU'] },
      { id: 2, name: 'Mohan', comp: 'hourly', area: 'vat-a1', hourRate: 50, active: true, relayNames: ['GOLU', 'RAJU'] },
    ] });
    const r = await parse(page, `${dmy()}/ in time\n----8:30 AM---\n---VAT A 1----\n1) GOLU\n2) RAJU`);
    expect(r.issues.some((i: string) => i.startsWith('red:"GOLU"'))).toBe(true);
    // RAJU is Raju Das's first name and a spelling the owner placed on Mohan: the placement is the decision.
    expect(Object.keys(r.marks)).toEqual(['Mohan']);
  });

  test('W13: a roll dated with a day the calendar lacks, or with no day at all, saves nothing', async ({ page }) => {
    await load(page);
    expect(await g(page, `[isoFromDmy('31', '09', '26'), isoFromDmy('30', '09', '26')]`)).toEqual([null, '2026-09-30']);
    const r = await parse(page, `31/09/26/ in time\n----8:30 AM---\n---VAT A 1----\n1) ARUN`);
    expect(r.date).toBeNull();
    expect(r.issues.some((i: string) => i.startsWith('red:"31/09/26" is not a date'))).toBe(true);
    await paste(page, `31/09/26/ in time\n----8:30 AM---\n---VAT A 1----\n1) ARUN`);
    await expect(page.locator('[data-action="invRelaySave"]')).toBeDisabled();
    await page.locator('[data-action="invRelayBack"]').click();
    await page.locator('#relayPasteText').fill(`in time\n----8:30 AM---\n---VAT A 1----\n1) ARUN`);
    await page.locator('[data-action="invRelayRead"]').click();
    await expect(page.locator('[data-action="invRelaySave"]')).toBeDisabled();
    expect(await g(page, `Object.keys(S.attendance)`)).toEqual([]);
  });

  test('W14: with nobody on the roster, a stock message pasted in the one box still reaches Stock', async ({ page }) => {
    await load(page, { staff: [] });
    await switchTab(page, 'pageHome');
    await page.locator('[data-action="invHomeQuick"][data-go="paste"]').click();
    await page.locator('#relayPasteText').fill(`[${dmy(0)}, 2:05 pm] Supervisor One: Chemical use chemical stock\n${dmy(-6)}/-${dmy(0)}/\n\n1) Q558 NIL\n\n2) MONICOL 6-1=5 KG`);
    await page.locator('[data-action="invRelayRead"]').click();
    await expect(page.locator('#pageStock.inv-page-active')).toBeVisible();
    await expect(page.locator('[data-action="invStockSavePaste"]')).toBeVisible();
  });

  test('W18: a night heading that writes one time keeps the night hold\'s other end', async ({ page }) => {
    await load(page);
    const end = await parse(page, `${dmy()}/ out time\n----night hold 6 am----\n----berral----\n1) BALA\nEXTRA 10 HOURS`);
    expect(end.extra[0]).toMatchObject({ from: '20:00', to: '06:00' });
    const start = await parse(page, `${dmy()}/ out time\n----night hold 8 pm----\n----berral----\n1) BALA\nEXTRA 10 HOURS`);
    expect(start.extra[0]).toMatchObject({ from: '20:00', to: '06:00' });
    expect(start.marks.Bala.outMin).toBe(1800);
  });

  test('W7: a lesson is kept for its heading in its slot, with every area the heading read', async ({ page }) => {
    await load(page);
    await pasteAndSave(page, IN());
    await pasteAndSave(page, `${dmy()}/ out time\n----8:00 PM---\nVAT A 1\n1) ARUN\nEXTRA 6 HOURS`);
    await g(page, `_attDate = '${iso()}'`);
    const ex = await g(page, `S.attendance['${iso()}'].extra.map(function(x){ return [x.kind, x.srcAt, (x.srcAreas || []).join('+')]; })`);
    expect(ex).toEqual([['coverage', 'in 08:30', 'vat-a1'], ['block', 'out 20:00', 'vat-a1']]);
    // The evening block ran on VAT A2, not A1.
    const blk = await g(page, `S.attendance['${iso()}'].extra.findIndex(function(x){ return x.kind === 'block'; })`);
    await g(page, `toggleAttBlockArea(${blk}, 'vat-a2'); toggleAttBlockArea(${blk}, 'vat-a1')`);
    expect(await g(page, `Object.keys(relayLearnData().heads)`)).toEqual(['VAT A 1 @ out 20:00']);
    // The 8:30 shift's "VAT A 1" is untouched: its hands still stood on A1.
    const inRoll = await parse(page, IN());
    expect(inRoll.marks.Chand.area).toBe('vat-a1');
    expect(inRoll.issues.join(' ')).not.toContain('learnt from your correction');
    const outRoll = await parse(page, `${dmy()}/ out time\n----8:00 PM---\nVAT A 1\n1) ARUN\nEXTRA 6 HOURS`);
    expect(outRoll.extra[0].areas).toEqual(['vat-a2']);

    // A general-shift EXTRA booked to one area of a heading that read two: the lesson keeps both, and books where corrected.
    const cov = await g(page, `(function(){ var d = S.attendance['${iso()}']; d.extra.push({ kind: 'coverage', area: 'barrel', hours: 8, src: 'relay',
      srcHead: 'berral & pickling', srcAt: 'in 08:30', srcAreas: ['barrel', 'pickling-barrel'] }); return d.extra.length - 1; })()`);
    await g(page, `setAttExtraArea(${cov}, 'pickling-barrel')`);
    const again = await parse(page, IN().replace('3) BALA', '3) BALA\nEXTRA 8 HOURS'));
    expect(again.extra.find((x: any) => x.kind === 'coverage' && x.area !== 'vat-a1').area).toBe('pickling-barrel');
    expect(again.marks.Bala.area).toBe('barrel');
    expect(again.marks.Kiran.area).toBe('pickling-barrel');
    // Put back as read, the lesson goes.
    await g(page, `setAttExtraArea(${cov}, 'barrel')`);
    expect(await g(page, `Object.keys(relayLearnData().heads)`)).toEqual(['VAT A 1 @ out 20:00']);
  });
});

function ym(k: number): string {
  const d = new Date(todayIso().slice(0, 7) + '-01T00:00:00');
  d.setMonth(d.getMonth() + k);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

test.describe('P107: the monthly payroll as paid', () => {
  const PAYSTAFF = [
    { id: 1, name: 'Ramu Singh', comp: 'monthly', area: 'vat-a1', dayRate: 500, active: true, onFloor: true },
    { id: 5, name: 'Sarat Mahato', comp: 'monthly', area: 'vat-a2', dayRate: 450, active: true, onFloor: true },
  ];

  test('W2: a slip row is matched by name like a roll (a unique first name), never by the id the file carries', async ({ page }) => {
    const m = ym(-2);
    const bankRows = [
      { id: 'R1', date: ym(-3) + '-01', valueDate: ym(-3) + '-01', narration: 'SMS CHARGES', chq: '', dr: 1, cr: 0, balance: 90000, dayIdx: 0 },
      { id: 'R2', date: ym(-1) + '-14', valueDate: ym(-1) + '-14', narration: 'NEFT-SARAT M', chq: '', dr: 9500, cr: 0, balance: 80000, dayIdx: 0, set: { cat: 'wages', staffId: 5 } },
      { id: 'R3', date: iso(-1), valueDate: iso(-1), narration: 'SMS CHARGES', chq: '', dr: 1, cr: 0, balance: 79999, dayIdx: 0 }];
    await load(page, {
      staff: PAYSTAFF,
      // The file's staffId names Ramu; the row is Sarat's. And "Ramu Kumar" is not Ramu Singh, whatever the first name.
      payrollPaid: [{ id: 'PP1', month: m, status: 'paid', at: 1, rows: [
        { name: 'Sarat', staffId: 1, dayPay: 9000, ot: 0, worked: 20 },
        { name: 'Ramu Kumar', dayPay: 7000, ot: 0, worked: 14 }] }],
      bank: { rows: bankRows, imports: [{ id: 'BI', at: 1, file: 't.xls', account: '', from: bankRows[0].date, to: bankRows[2].date, rows: 3, added: 3, closing: 79999 }], parties: {}, opening: {}, gstNotes: {} },
    });
    const who = await g(page, `S.payrollPaid[0].rows.map(function(r){ var w = payrollWorker(r); return w ? w.name : null; })`);
    expect(who).toEqual(['Sarat Mahato', null]);
    const lab = await g(page, `(function(){ var l = labourForRange('${m}-01', payMonthEnd('${m}-01')); return [l.byWorker[5].total, l.byWorker[5].asPaid, l.byWorker[1] ? !!l.byWorker[1].asPaid : false]; })()`);
    expect(lab).toEqual([9000, true, false]);
    // The wage check reads the slip the same way: Sarat was paid 9,500 against a slip of 9,000.
    const t = await g(page, `TODO_RULE_FNS.wageVsSlip().map(function(x){ return x.sub; })`);
    expect(t).toEqual(['Sarat Mahato over ₹500.00']);
    await switchTab(page, 'pageStaff');
    await page.locator('[data-action="invAttView"][data-view="pay"]').click();
    await expect(page.locator('#payrollPaid')).toContainText('not on the roster: Ramu Kumar (read as Ramu Singh?');
  });

  test('W17: a re-import that changes only what was actually paid supersedes the record', async ({ page }) => {
    await load(page, { staff: PAYSTAFF });
    const file: any = { kind: 'sep-payroll-paid', months: [{ month: ym(-2), status: 'paid', source: 'slip', rows: [
      { name: 'Sarat Mahato', worked: 20, dayPay: 9000, ot: 0, paid: 9000 }] }] };
    expect(await g(page, `payrollPaidImport(${JSON.stringify(file)}).added`)).toBe(1);
    expect(await g(page, `payrollPaidImport(${JSON.stringify(file)}).same`)).toBe(1);
    file.months[0].rows[0].paid = 8520.97;
    file.months[0].rows[0].note = '₹479.03 still owed';
    expect(await g(page, `payrollPaidImport(${JSON.stringify(file)}).superseded`)).toBe(1);
    expect(await g(page, `S.payrollPaid.filter(function(r){ return !r.voidedAt; })[0].rows[0].paid`)).toBe(8520.97);
  });
});

test.describe('P107: the roster', () => {
  test('W3: an import takes only the fields the file carries; W11: a name is keyed as a roll reads it', async ({ page }) => {
    await load(page, { staff: [
      { id: 7, name: 'Sarat Mahato', comp: 'monthly', area: 'vat-a1', dayRate: 520, hourRate: 0, monthWage: 0, active: false, onFloor: true },
      { id: 8, name: 'Uday', comp: 'monthly', area: 'gate', dayRate: 0, monthWage: 9000, active: true, onFloor: false },
    ] });
    const res = await g(page, `applyRosterImport({ staff: [{ name: 'SARAT  MAHATO.', area: 'vat-a2' }, { name: 'Uday', area: 'office' }] })`) as any;
    expect(res).toMatchObject({ added: 0, updated: 2 });
    const st = await g(page, `S.staff.map(function(w){ return [w.name, w.area, w.dayRate, w.monthWage, w.comp, w.active, w.onFloor]; })`);
    expect(st).toEqual([
      ['Sarat Mahato', 'vat-a2', 520, 0, 'monthly', false, true],
      ['Uday', 'office', 0, 9000, 'monthly', true, false],
    ]);
  });

  test('W8: a merge moves payments, the bank\'s wage rules and slip rows; a worker named by a payment is not deleted', async ({ page }) => {
    await load(page, {
      staff: [{ id: 1, name: 'Shyam', comp: 'monthly', dayRate: 500, area: 'vat-a1', active: true },
        { id: 2, name: 'Shyam Bera', comp: 'monthly', dayRate: 500, area: 'vat-a1', active: true },
        { id: 3, name: 'Tara', comp: 'hourly', hourRate: 50, area: 'barrel', active: true }],
      staffPayments: [{ id: 'P1', staffId: 1, date: iso(-2), amount: 500, kind: 'advance', at: 1 },
        { id: 'P2', staffId: 3, date: iso(-2), amount: 100, kind: 'payment', at: 1, voidedAt: 2, voidReason: 'typo' }],
      bank: { rows: [{ id: 'R', date: iso(-3), narration: 'NEFT-SHYAM', dr: 900, cr: 0, balance: 1, set: { cat: 'wages', staffId: 1 } }],
        imports: [], parties: { SHYAMB: { cat: 'wages', staffId: 1 } }, opening: {}, gstNotes: {} },
      payrollPaid: [{ id: 'PP', month: ym(-2), status: 'paid', at: 1, rows: [{ name: 'Shyam', staffId: 1, dayPay: 1, ot: 0 }] }],
    });
    const r = await g(page, `mergeWorkers(1, 2).payments`);
    expect(r).toBe(3);
    const after = await g(page, `[S.staffPayments[0].staffId, S.bank.rows[0].set.staffId, S.bank.parties.SHYAMB.staffId, S.payrollPaid[0].rows[0].staffId]`);
    expect(after).toEqual([2, 2, 2, 2]);
    // Tara is on no day, but a (void) payment names her: the record stays, so does she.
    await switchTab(page, 'pageStaff');
    await page.locator('[data-action="invAttView"][data-view="roster"]').click();
    await page.locator('[data-action="invAttEditWorker"][data-id="3"]').click();
    await page.locator('[data-action="invAttDeleteWorker"][data-id="3"]').click();
    await expect(page.locator('.inv-toast')).toContainText('1 payment names Tara');
    expect(await g(page, `S.staff.length`)).toBe(2);
  });

  test('W12: the Day view\'s block check reads the block\'s own Needed, and an unnamed crew is not checkable', async ({ page }) => {
    const hands = [1, 2, 3].map(i => ({ id: i, name: 'Hand ' + 'ABC'[i - 1], comp: 'hourly', hourRate: 50, area: 'vat-a1', active: true, onFloor: true }));
    await load(page, { staff: hands, areaTargets: { 'vat-a1': 4 }, attendance: { [todayIso()]: { marks: {}, note: '', extra: [
      { kind: 'block', areas: ['vat-a1'], area: 'vat-a1', from: '17:00', to: '20:00', hours: 0, crew: [1, 2, 3], need: 3 },
      { kind: 'block', areas: ['vat-a1'], area: 'vat-a1', from: '06:00', to: '09:00', hours: 3, crew: [] }] } } });
    await switchTab(page, 'pageStaff');
    await page.locator('[data-action="invAttView"][data-view="day"]').first().click();
    await expect(page.locator('[data-block="0"] [data-block-check]')).toContainText('3 of 3');
    await expect(page.locator('[data-block="0"] [data-block-check]')).toHaveAttribute('data-block-check', 'ok');
    await expect(page.locator('[data-block="1"] [data-block-check]')).toHaveAttribute('data-block-check', 'none');
    await expect(page.locator('[data-block="1"] [data-block-check]')).toContainText('its crew');
  });

  test('WB7: moving the Day view\'s date moves the week; WB9: the rate line shows what an OT hour pays', async ({ page }) => {
    await load(page, { staff: [{ id: 1, name: 'Shyam', comp: 'monthly', dayRate: 576, area: 'vat-a1', active: true }] });
    await switchTab(page, 'pageStaff');
    await page.locator('[data-action="invAttView"][data-view="day"]').first().click();
    for (let k = 0; k < 8; k++) await page.locator('[data-action="invAttStep"][data-step="-1"]').click();
    expect(await g(page, `_attWeekStart === attWeekStartOf(_attDate)`)).toBe(true);
    await page.locator('[data-action="invAttView"][data-view="roster"]').click();
    await expect(page.locator('[data-action="invAttEditWorker"][data-id="1"]')).toContainText('OT ₹68.20/h (capped)');
  });
});
