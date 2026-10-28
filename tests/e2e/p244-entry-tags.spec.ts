import { test, expect, type Page } from '@playwright/test';
import { loadAppWithState, todayIso, recentTs, switchTab, openAttendance } from './fixtures';
import { guardBook, withUsers, unlock, lockNow, PINS } from './p140-guard.fixture';

// P244: who entered an entry and who changed it, by ID (owner, 26 Oct 2026: "For areas that have multiple people that can
// enter it before my approval, lets simply tag their IDs and show who updated what"); where two phones changed one hand's
// mark, both versions are kept, each with its stamp, for the owner to pick (owner, 28 Oct 2026: "keep both versions").

const ev = (page: Page, e: string) => page.evaluate(x => (0, eval)(x), e);
const book = () => {
  const s: any = guardBook();
  s.staff = [{ id: 21, name: 'ALFA KUMAR', comp: 'monthly', dayRate: 500, area: 'vat-a1', onFloor: true, active: true },
    { id: 22, name: 'BRAVO DAS', comp: 'monthly', dayRate: 500, area: 'vat-a2', onFloor: true, active: true }];
  // An entry and a day from before the stamps: never stamped by a save that does not change them.
  s.production = { entries: [{ id: 'PE-old', kind: 'plated', date: todayIso(), line: 'vat-a1', qty: 100, unit: 'NOS', at: recentTs(), by: 'Typed name' }] };
  s.attendance = { '2026-10-01': { marks: { 21: { st: 'P', area: 'vat-a1', hours: 8 }, 22: { st: 'P', area: 'vat-a2', hours: 8, by: 'U-own' } },
    extra: [{ area: 'vat-a1', hours: 8, kind: 'general' }], note: '' } };
  return s;
};

test('a stock entry, a production entry, a mark and an EXTRA row carry the ID that entered them and the ID that changed them', async ({ page }) => {
  await loadAppWithState(page, book());
  await withUsers(page);
  await unlock(page, 'U-sup', PINS.super);
  const day = todayIso();
  await ev(page, `S.stock.entries.push({ id: 'SE-1', itemId: 'N', kind: 'used', qty: 2, date: '${day}', at: Date.now() });
    S.production.entries.push({ id: 'PE-1', kind: 'plated', date: '${day}', line: 'vat-a2', qty: 50, unit: 'NOS', at: Date.now() });
    attDay('${day}', true).marks[21] = { st: 'P', area: 'vat-a1', hours: 8 };
    attDay('${day}', true).extra.push({ area: 'vat-a2', hours: 8, kind: 'general' });
    saveState()`);
  const t = await ev(page, `({ s: S.stock.entries.find(e => e.id === 'SE-1').tagIn, p: S.production.entries.find(e => e.id === 'PE-1').tagIn,
    m: S.attendance['${day}'].marks[21].tagIn, x: S.attendance['${day}'].extra[0].tagIn,
    old: S.production.entries.find(e => e.id === 'PE-old').tagIn || null, oldMark: S.attendance['2026-10-01'].marks[21].tagIn || null })`);
  for (const k of ['s', 'p', 'm', 'x']) expect((t as any)[k].by).toBe('U-sup');
  // What was in the book before is never stamped as the supervisor's.
  expect((t as any).old).toBeNull();
  expect((t as any).oldMark).toBeNull();
  // An EXTRA row from before the stamps, edited: changed by the editor, never entered by them.
  await ev(page, `S.attendance['2026-10-01'].extra[0].hours = 16; saveState()`);
  const ox = await ev(page, `S.attendance['2026-10-01'].extra[0]`);
  expect((ox as any).tagIn).toBeUndefined();
  expect((ox as any).tagCh.by).toBe('U-sup');
  // The owner changes the mark and voids the stock entry: each says who changed it, the entry keeps who entered it.
  await lockNow(page);
  await unlock(page, 'U-own', PINS.owner);
  await ev(page, `S.attendance['${day}'].marks[21].st = 'H'; S.stock.entries.find(e => e.id === 'SE-1').voided = true; saveState()`);
  const c = await ev(page, `({ m: S.attendance['${day}'].marks[21], s: S.stock.entries.find(e => e.id === 'SE-1'), t: tagWho(S.stock.entries.find(e => e.id === 'SE-1')) })`);
  expect((c as any).m.tagIn.by).toBe('U-sup');
  expect((c as any).m.tagCh.by).toBe('U-own');
  expect((c as any).t).toMatch(/^Entered by Birsa Munda · changed by Asha Rao, /);
  // Shown where the entry is: the stock line's row, the production entry, the hand's day.
  await switchTab(page, 'pageStock');
  expect(await ev(page, `stockEntryRowHtml(S.stock.entries.find(e => e.id === 'SE-1'), null, 'L')`)).toContain('entered by Birsa Munda · changed by Asha Rao');
  expect(await ev(page, `JSON.stringify(prodEntryKv(S.production.entries.find(e => e.id === 'PE-1')))`)).toContain('Birsa Munda');
  expect(await ev(page, `JSON.stringify(prodEntryKv(S.production.entries.find(e => e.id === 'PE-old')))`)).toContain('Typed name');
  await switchTab(page, 'pageStaff');
  await openAttendance(page, 'day');
  await ev(page, `attEditOpen(21)`);
  await expect(page.locator('[data-att-who]')).toHaveText(/^Entered by Birsa Munda · changed by Asha Rao, /);
  // A mark from before the stamps, typed by hand, says the ID that typed it.
  await ev(page, `closeOverlay(); _attDate = '2026-10-01'; attEditOpen(22)`);
  await expect(page.locator('[data-att-who]')).toHaveText('Typed by Asha Rao');
});

test('two phones marking different hands on one day are both kept; one hand marked differently keeps both versions for the owner', async ({ page }) => {
  await loadAppWithState(page, book());
  const r: any = await ev(page, `(function () {
    var day = '2026-10-02', mk = function (st, by) { return { st: st, area: 'vat-a1', hours: st === 'A' ? 0 : 8, tagIn: { by: by, at: 5 } }; };
    var base = { attendance: {}, users: [], changeLog: [] };
    base.attendance[day] = { marks: {}, extra: [], note: '' };
    var mine = JSON.parse(JSON.stringify(base)), theirs = JSON.parse(JSON.stringify(base));
    mine.attendance[day].marks = { 21: mk('P', 'U-sup'), 22: mk('P', 'U-sup') };
    theirs.attendance[day].marks = { 21: mk('A', 'U-off') };
    var res = mrgMerge(base, mine, theirs, {});
    return { marks: res.book.attendance[day].marks, held: res.held.map(function (h) { return { field: h.field, kept: h.kept.v, other: h.other.v }; }) };
  })()`);
  // Bravo was marked on one phone only: taken. Alfa was marked on both, differently: one stands, the other is held whole.
  expect(r.marks[22].st).toBe('P');
  expect(r.held).toHaveLength(1);
  expect(r.held[0].field).toBe('marks.21');
  expect([r.held[0].kept.tagIn.by, r.held[0].other.tagIn.by].sort()).toEqual(['U-off', 'U-sup']);
});

test('a hand’s held version is shown on its day, and the owner uses it there', async ({ page }) => {
  const s = book(), day = todayIso();
  s.attendance[day] = { marks: { 21: { st: 'P', area: 'vat-a1', hours: 8, tagIn: { by: 'U-sup', at: 5 } } }, extra: [], note: '' };
  s.mergeHeld = [{ id: 'MH-1', at: 6, coll: 'attendance', rid: day, field: 'marks.21', label: 'today', why: 'both', status: 'open', from: 'GitHub',
    kept: { side: 'm', v: s.attendance[day].marks[21] }, other: { side: 't', v: { st: 'A', area: 'vat-a1', hours: 0, tagIn: { by: 'U-off', at: 5 } } } }];
  await loadAppWithState(page, s);
  await withUsers(page);
  await unlock(page, 'U-own', PINS.owner);
  await switchTab(page, 'pageStaff');
  await openAttendance(page, 'day');
  await ev(page, `attEditOpen(21)`);
  const held = page.locator('[data-att-held="MH-1"]');
  await expect(held).toContainText('Standing: Present');
  await expect(held).toContainText('Birsa Munda');
  await expect(held).toContainText('Held from the other phone: Absent');
  await expect(held).toContainText('Chitra Sen');
  await held.locator('[data-action="invMrgUseHere"]').click();
  await expect.poll(() => ev(page, `S.attendance['${day}'].marks[21].st`)).toBe('A');
  await expect(page.locator('[data-att-held]')).toHaveCount(0);
  // The held list says it as a hand's mark, never as JSON.
  expect(await ev(page, `mrgHeldRowHtml(S.mergeHeld[0])`)).toContain('ALFA KUMAR’s mark on today');
});
