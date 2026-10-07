import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, type SepState } from './fixtures';
import { withUsers, unlock, PINS } from './p140-guard.fixture';

// P171: the QA chain over the workers and the plant (W1–W5, 7 Oct 2026). Each test fails on the build before its fix.
// Made-up names, numbers and places only.

const g = (page: Page, e: string) => page.evaluate(x => (0, eval)(x), e);
const day = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
function book(): SepState {
  const s: any = emptyState();
  s.incomingMaterial = noSeedIM();
  return s;
}
const tank = (id: string, name: string, station: string, status = 'run', since = day(-30)) =>
  ({ id, name, station, kind: 'tank', kgRound: 25, status, since, reason: '', condition: 'fair' });

test.describe('P171 W1: the plant register', () => {
  test('the unit after a figure is still a small label: the tile class is the plant’s own', async ({ page }) => {
    await loadAppWithState(page, book());
    const r: any = await g(page, `(function () { var s = document.createElement('span'); s.className = 'inv-unit'; s.textContent = '/kg'; document.body.appendChild(s);
      var c = getComputedStyle(s); var out = [c.display, c.borderLeftStyle, c.cursor]; s.remove(); return out; })()`);
    expect(r).toEqual(['inline', 'none', 'auto']);
  });

  test('before a unit’s first status line it reads what that line changed from, not its status now', async ({ page }) => {
    const s: any = book();
    s.plant = { units: [tank('A', 'Tank 1', 'vat-a1', 'down', day(0))], log: [{ id: 'L1', unitId: 'A', date: day(0), from: 'run', to: 'down', at: 1 }] };
    await loadAppWithState(page, s);
    expect(await g(page, `[pltStatusOn(pltUnitById('A'), '${day(-1)}'), pltStatusOn(pltUnitById('A'), '${day(0)}'), pltDownDays(pltUnitById('A'), '${day(-89)}', '${day(0)}')]`)).toEqual(['run', 'down', 1]);
  });

  test('Floor → Day’s units row opens Production’s Equipment', async ({ page }) => {
    const s: any = book();
    s.plant = { units: [tank('A', 'Tank 1', 'vat-a1'), tank('B', 'Tank 2', 'vat-a1', 'down', day(-2))], log: [] };
    await loadAppWithState(page, s);
    await switchTab(page, 'pageFloor');
    await page.locator('[data-line="vat-a1"] [data-flr-units] button').click();
    await expect(page.locator('#pageProduction')).toBeVisible();
    await expect(page.locator('#productionContent .inv-viewtab[data-tab="equipment"]')).toHaveAttribute('aria-selected', 'true');
  });

  test('a sep-plant file: unreadable status lines are left out and counted, a chance over 1 is a percentage', async ({ page }) => {
    await loadAppWithState(page, book());
    const r: any = await g(page, `(function () {
      var a = pltMergeImport({ format: 'sep-plant', version: 1, units: [{ id: 'X', name: 'Tank 9', station: 'vat-a2', risk: { p: 15, cost: '2000', days: -3 } }],
        log: [{ id: 'G1', unitId: 'X', date: '${day(-3)}', from: null, to: 'run' }, { id: 'G2', unitId: 'X', date: '${day(-1)}', from: 'run', to: '"><img src=x>' }] });
      return { dropped: a.dropped, logs: a.logs, risk: pltUnitById('X').risk, pip: pltPipsHtml(pltCapacity('vat-a2'), '${day(0)}') };
    })()`);
    expect(r.dropped).toBe(1);
    expect(r.logs).toBe(1);
    expect(r.risk).toEqual({ p: 0.15, cost: 2000, days: 0, say: '' });
    expect(r.pip).not.toContain('<img');
  });

  test('a status cannot be dated before its last change; the line a failure stops is kept and editable', async ({ page }) => {
    const s: any = book();
    s.plant = { units: [Object.assign(tank('A', 'Rectifier', 'power', 'down', day(-2)), { line: 'vat-a2' })], log: [{ id: 'L1', unitId: 'A', date: day(-2), from: 'run', to: 'down', at: 1 }] };
    await loadAppWithState(page, s);
    expect(await g(page, `pltMachines()[0].line`)).toBe('vat-a2');
    await g(page, `pltEdit('A')`);
    await expect(page.locator('#pltLine')).toHaveValue('vat-a2');
    await page.selectOption('#pltStatus', 'run');
    await page.fill('#pltSince', day(-5));
    await page.locator('[data-action="invPltSave"]').click();
    await expect(page.locator('.inv-dialog', { hasText: 'Before its last change' })).toBeVisible();
    expect(await g(page, `pltUnitById('A').status`)).toBe('down');
  });

  test('a snoozed down unit comes back when it turns red', async ({ page }) => {
    const s: any = book();
    s.plant = { units: [tank('A', 'Tank 1', 'vat-a1', 'down', day(-6))], log: [] };
    await loadAppWithState(page, s);
    const amber = await g(page, `TODO_RULE_FNS.plantDown()[0].sig`);
    await g(page, `pltUnitById('A').since = '${day(-7)}'`);
    const red = await g(page, `TODO_RULE_FNS.plantDown()[0].sig`);
    expect(String(amber).replace(/:[^:]*:[^:]*$/, '')).toBe(String(red).replace(/:[^:]*:[^:]*$/, ''));
    expect(amber).toContain('amber');
    expect(red).toContain('red');
  });
});

function crew(): SepState {
  const s: any = book();
  s.company = Object.assign({}, s.company || {}, { name: 'TEST WORKS' });
  s.staff = [{ id: 1, name: 'Asha Kumari', comp: 'daily', dayRate: 450, area: 'vat-a1', active: true, card: 'SEP-0001', profile: { phone: '98765 43210' } },
    { id: 2, name: 'Bina Devi', comp: 'daily', dayRate: 500, area: 'barrel', active: true, card: 'SEP-0002', profile: { phone: '91234 56780' } }];
  s.checkinCfg = { office: '919000000001', lat: 22.8001, lng: 86.1501, radius: 150, key: 'TESTK1', keyOn: todayIso() };
  return s;
}
const at = (iso: string, h: number, m: number) => { const d = new Date(iso + 'T00:00:00'); d.setHours(h, m, 0, 0); return d.getTime(); };

test.describe('P171 W4: the card scan into the day', () => {
  test('a time is put on its own day; a night out past midnight closes the evening before', async ({ page }) => {
    await loadAppWithState(page, crew());
    const r: any = await g(page, `(function () {
      var w = staffById(1), b = staffById(2);
      idcApply(w, 'SEP-0001', new Date(${at(day(-2), 9, 0)}), 'scan');
      idcApply(b, 'SEP-0002', new Date(${at(day(-1), 20, 0)}), 'scan');
      idcApply(b, 'SEP-0002', new Date(${at(day(0), 6, 0)}), 'scan');
      var y = attDay('${day(-1)}').marks[2];
      return { two: !!attDay('${day(-2)}').marks[1], todayA: !!(attDay('${day(0)}') && attDay('${day(0)}').marks[1]),
        night: [y.inMin, y.outMin, y.hours], todayB: !!(attDay('${day(0)}') && attDay('${day(0)}').marks[2]) };
    })()`);
    expect(r.two).toBe(true);
    expect(r.todayA).toBe(false);
    expect(r.night).toEqual([1200, 1800, 10]);
    expect(r.todayB).toBe(false);
  });

  test('a roll’s earlier in-time is kept; a half day scanned once is four hours', async ({ page }) => {
    const s: any = crew();
    s.attendance = { [day(0)]: { marks: { 1: { st: 'P', area: 'vat-a1', inMin: 360, outMin: 1020, outKnown: false, hours: 11, ot: 3, src: 'relay' }, 2: { st: 'H', area: 'barrel', hours: 4, ot: 0 } }, extra: [] } };
    await loadAppWithState(page, s);
    const r: any = await g(page, `(function () {
      idcApply(staffById(1), 'SEP-0001', new Date(${at(day(0), 8, 40)}), 'scan');
      idcApply(staffById(2), 'SEP-0002', new Date(${at(day(0), 8, 30)}), 'scan');
      var d = attDay('${day(0)}'); return [d.marks[1].inMin, d.marks[2].hours];
    })()`);
    expect(r).toEqual([360, 4]);
  });

  test('a card number is never given again, a merged hand’s scans go with them, ten cards fit one A4 page', async ({ page }) => {
    const s: any = crew();
    s.staff.push({ id: 3, name: 'Chandan Oraon', comp: 'daily', dayRate: 400, area: 'flex', active: true });
    for (let i = 4; i <= 12; i++) s.staff.push({ id: i, name: 'Hand ' + i, comp: 'daily', dayRate: 400, area: 'flex', active: true });
    s.attendance = { [day(-1)]: { marks: { 3: { st: 'P', area: 'flex', hours: 8, ot: 0 } }, extra: [], scans: { 3: [{ min: 510, at: at(day(-1), 8, 30), card: 'SEP-0003' }] } } };
    await loadAppWithState(page, s);
    const r: any = await g(page, `(function () {
      var c = staffById(3); idcEnsure(c); var card = c.card;
      mergeWorkers(3, 1);
      var w = { id: 99, name: 'New hand' }; S.staff.push(w); idcEnsure(w);
      return { card: card, next: w.card, moved: (attDay('${day(-1)}').scans[1] || []).length };
    })()`);
    expect(r.card).toBe('SEP-0003');
    expect(r.next).toBe('SEP-0004');
    expect(r.moved).toBe(1);
    await switchTab(page, 'pageStaff');
    await page.locator('#pageStaff .inv-viewtab[data-view="roster"]').click();
    await page.locator('#pageStaff [data-action="invIdcPrint"]').first().click();
    await page.locator('[data-action="invIdcPreview"]').click();
    await page.emulateMedia({ media: 'print' });
    const fit: any = await g(page, `(function () { var sh = document.querySelector('.inv-idc-sheet'), cs = sh.querySelectorAll('.inv-idc');
      var mm = 96 / 25.4; return { n: cs.length, bottom: Math.round((cs[cs.length - 1].getBoundingClientRect().bottom - sh.getBoundingClientRect().top) / mm) }; })()`);
    expect(fit.n).toBe(10);
    expect(fit.bottom).toBeLessThanOrEqual(297);
  });
});

test.describe('P171 W5: the office QR check-in', () => {
  const dmy = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);
  async function ck(page: Page, o: { iso?: string; hhmm: string; card: string; head?: string; place?: string; edit?: boolean; code?: string; noPlace?: boolean }) {
    const iso = o.iso || day(0), [h, m] = o.hhmm.split(':').map(Number);
    const place = o.noPlace ? '' : (o.place || '22.800100,86.150100');
    const code = o.code || await g(page, `ckCode('TESTK1', '${o.card}', '${iso}', ${h * 60 + m}, '${o.noPlace ? '' : '22.800100,86.150100'}', '')`);
    return (o.head === undefined ? `${dmy(iso)}, ${(h % 12) || 12}:${o.hhmm.split(':')[1]} ${h < 12 ? 'am' : 'pm'} - +91 98765 43210: ` : o.head) +
      `SEP check-in\nCard ${o.card}\nTime ${dmy(iso)} ${o.hhmm}\n${o.noPlace ? 'Place not shared (refused)' : 'Place ' + place + ' ±12 m'}\nCode ${code}` + (o.edit ? ' <This message was edited>' : '');
  }
  const rows = (page: Page, t: string) => g(page, `ckReview(ckFromText(${JSON.stringify(t)})).map(function (r) { return { iso: r.iso, tone: r.tone, tick: r.tick, notes: r.notes.map(function (n) { return n[1]; }).join(' | ') }; })`) as Promise<any[]>;

  test('yesterday’s check-in pasted today lands on yesterday', async ({ page }) => {
    await loadAppWithState(page, crew());
    await g(page, `_ckRows = ckReview(ckFromText(${JSON.stringify(await ck(page, { iso: day(-1), hhmm: '08:20', card: 'SEP-0001' }))})); ckSave()`);
    expect(await g(page, `[!!(attDay('${day(-1)}') && attDay('${day(-1)}').marks[1]), !!(attDay('${day(0)}') && attDay('${day(0)}').marks[1])]`)).toEqual([true, false]);
  });

  test('a place changed by hand fails the code; an edited message is red; no place shared is left unticked', async ({ page }) => {
    await loadAppWithState(page, crew());
    const t = [await ck(page, { hhmm: '08:20', card: 'SEP-0001', place: '22.800200,86.150100' }),
      await ck(page, { hhmm: '08:21', card: 'SEP-0002', head: `${dmy(day(0))}, 8:21 am - +91 91234 56780: `, edit: true }),
      await ck(page, { hhmm: '17:00', card: 'SEP-0002', head: `${dmy(day(0))}, 5:00 pm - +91 91234 56780: `, noPlace: true })].join('\n');
    const r = await rows(page, t);
    expect(r[0].notes).toContain('The code does not match');
    expect(r[1].notes).toContain('Edited after it was sent.');
    expect(r[1].tone).toBe('danger');
    expect([r[2].tone, r[2].tick]).toEqual(['warning', false]);
    expect(r[2].notes).toContain('did not share its location (refused).');
  });

  test('an iPhone export’s date, a number in direction marks, and check-ins pasted without their WhatsApp lines', async ({ page }) => {
    await loadAppWithState(page, crew());
    const iso = '2026-03-05';
    const ios = (await ck(page, { iso, hhmm: '08:27', card: 'SEP-0001', head: '[05/03/26, 8:27:13 AM] ‪+91 98765 43210‬: ' }));
    const r = await rows(page, ios);
    expect([r[0].tone, r[0].notes]).toEqual(['ok', '']);
    const bare = [await ck(page, { hhmm: '08:20', card: 'SEP-0001', head: '' }), await ck(page, { hhmm: '08:22', card: 'SEP-0002', head: '' })].join('\n');
    expect((await rows(page, bare)).length).toBe(2);
  });

  test('one phone, one worker a day across pastes; a red one saved keeps what it failed', async ({ page }) => {
    await loadAppWithState(page, crew());
    await g(page, `_ckRows = ckReview(ckFromText(${JSON.stringify(await ck(page, { hhmm: '08:20', card: 'SEP-0001' }))})); ckSave()`);
    const later = await ck(page, { hhmm: '08:40', card: 'SEP-0002' });   // Bina's card, from Asha's phone, in a later paste
    const r = await rows(page, later);
    expect(r[0].notes).toContain('The same phone checked in Asha Kumari that day.');
    const saved: any = await g(page, `(function () { _ckRows = ckReview(ckFromText(${JSON.stringify(later)})); _ckRows[0].tick = true; ckSave();
      var sc = attDay('${day(0)}').scans[2][0]; return [sc.checks, sc.notes.length > 0, sc.ackAt > 0]; })()`);
    expect(saved).toEqual(['danger', true, true]);
  });
});

test.describe('P171 W2: worker records', () => {
  function people(): SepState {
    const s: any = book();
    s.staff = [{ id: 1, name: 'Sarat Mahato', comp: 'daily', dayRate: 450, area: 'vat-a1', active: true },
      { id: 2, name: 'Uday Kumar', comp: 'monthly', dayRate: 500, area: 'barrel', active: true, profile: { joined: day(-800), phone: '90000 11111' } }];
    return s;
  }
  test('a details file: a first name alone is a guess, never picked; one worker on two rows is refused; dates read', async ({ page }) => {
    await loadAppWithState(page, people());
    await g(page, `pplImportData({ format: 'sep-people', version: 1, people: [{ name: 'Sarat Kumar', phone: '1' }, { name: 'Uday Kumar', dob: '12/03/1990', joined: '01/01/2099' }, { name: 'Uday K', phone: '2' }] })`);
    const dlg = page.locator('[data-ppl-import]');
    await expect(dlg.locator('[data-ppl-import-pick="0"]')).toHaveValue('');
    await expect(dlg.locator('[data-ppl-import-row="0"]')).toContainText('could be Sarat Mahato');
    await expect(dlg.locator('[data-ppl-import-pick="1"]')).toHaveValue('2');
    await dlg.locator('[data-ppl-import-pick="2"]').selectOption('2');
    await dlg.locator('[data-action="invPplImportKeep"]').click();
    await expect(page.locator('.inv-dialog', { hasText: 'Two rows on one worker' })).toBeVisible();
    expect(await g(page, `staffById(1).profile`)).toBeUndefined();
    await page.locator('.inv-dialog', { hasText: 'Two rows on one worker' }).locator('button').last().click();
    await dlg.locator('[data-ppl-import-pick="2"]').selectOption('');
    await dlg.locator('[data-action="invPplImportKeep"]').click();
    expect(await g(page, `[staffById(2).profile.dob, staffById(2).profile.joined]`)).toEqual(['1990-03-12', day(-800)]);
  });

  test('a check-in cancelled over the worker’s sheet keeps what was typed on the sheet', async ({ page }) => {
    await loadAppWithState(page, people());
    await switchTab(page, 'pageStaff');
    await page.locator('#pageStaff .inv-viewtab[data-view="roster"]').click();
    await page.locator('[data-action="invAttEditWorker"][data-id="1"]').first().click();
    const rate = page.locator('#wedName');
    await rate.fill('Sarat M');
    await page.locator('[data-ppl-sheet="1"] [data-action="invPplCheckin"]').click();
    await page.locator('[data-ppl-checkin-form] [data-action="invCloseConfirm"]').last().click();
    await expect(page.locator('[data-ppl-sheet="1"]')).toBeVisible();
    await expect(rate).toHaveValue('Sarat M');
  });

  test('no rise is judged on a year of rates kept, a cut is no rise; steady needs times', async ({ page }) => {
    const s: any = people();
    s.staff[1].rateHistory = [{ on: day(-500), from: { dayRate: 450 }, to: { dayRate: 500 } }, { on: day(-100), from: { dayRate: 500 }, to: { dayRate: 480 } }];
    s.attendance = {};
    for (let i = 1; i <= 20; i++) s.attendance[day(-i)] = { marks: { 1: { st: 'P', area: 'vat-a1', hours: 8, ot: 0 } }, extra: [] };
    await loadAppWithState(page, s);
    const r: any = await g(page, `[pplMotivation(staffById(2)).sig.map(function (x) { return x.word; }).filter(function (w) { return /rise/.test(w); }), pplStats(staffById(1)).consistency]`);
    expect(r[0]).toEqual(['no rise since ' + await g(page, `formatDate('${day(-500)}')`)]);
    expect(r[1]).toBeNull();
  });

  test('a role that does not see details: no joining date, no card code, and an export without them', async ({ page }) => {
    const s: any = people();
    s.staff[1].card = 'SEP-0001';
    s.peopleCheckins = [{ id: 'C1', staffId: 2, on: day(-1), score: 2, note: 'private', at: 1 }];
    await loadAppWithState(page, s);
    await withUsers(page);
    await unlock(page, 'U-sup', PINS.super);
    const r: any = await g(page, `(function () { var h = pplRecordHtml(staffById(2)) + idcRecordHtml(staffById(2)); return [/joined /.test(h), /inv-qr/.test(h)]; })()`);
    expect(r).toEqual([false, false]);
    const [dl] = await Promise.all([page.waitForEvent('download'), g(page, `exportData()`)]);
    const body = JSON.parse(require('fs').readFileSync(await dl.path(), 'utf8'));
    expect(dl.suggestedFilename()).toContain('without-details');
    expect(body.staff[1].profile).toBeUndefined();
    expect(body.peopleCheckins).toEqual([]);
  });
});
