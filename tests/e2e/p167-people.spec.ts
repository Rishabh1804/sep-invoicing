import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, readStoredState, type SepState } from './fixtures';
import { withUsers, unlock, PINS } from './p140-guard.fixture';

// P167 (owner, 7 Oct 2026, docs/WORKERS_AND_PLANT.md W2): a worker's record. Tenure, reliability, consistency and workload
// worked out from the marks with the days they rest on; the motivation index from signals and the owner's monthly check-in;
// skills beside the days worked; relationships; personal details the owner's alone and never in the change log's values.
// Made-up names only.

const g = (page: Page, e: string) => page.evaluate(x => (0, eval)(x), e);
const day = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
/* Thirty weekdays back: Asha on VAT A1 in at 8:30 most days, late (8:55) on 5, absent on 3; Bina beside her. */
function book(): SepState {
  const s: any = emptyState();
  s.incomingMaterial = noSeedIM();
  s.staff = [{ id: 1, name: 'Asha Kumari', comp: 'daily', dayRate: 450, hourRate: 0, area: 'vat-a1', active: true, onFloor: true },
    { id: 2, name: 'Bina Devi', comp: 'daily', dayRate: 500, hourRate: 0, area: 'vat-a1', active: true, onFloor: true }];
  s.attendance = {};
  let n = 0;
  for (let i = 1; n < 30; i++) {
    const iso = day(-i);
    if (new Date(iso + 'T00:00:00').getDay() === 0) continue;
    const a = n < 3 ? { st: 'A' } : { st: 'P', area: 'vat-a1', hours: 8, ot: 0, inMin: n < 8 ? 535 : 510, outMin: 1020 };
    s.attendance[iso] = { marks: { 1: a, 2: { st: 'P', area: 'vat-a1', hours: 8, ot: 0, inMin: 510, outMin: 1020 } }, extra: [] };
    n++;
  }
  return s;
}

test.describe('P167 a worker’s record', () => {
  test('worked out from the marks: tenure, reliability, consistency, workload, who they stand beside', async ({ page }) => {
    await loadAppWithState(page, book());
    const st: any = await g(page, `(function () { var s = pplStats(staffById(1)); return { marked: s.marked, firm: s.firm, abs: s.n.A, late: s.late, rel: s.reliability, beside: s.beside[0].name, tenure: s.tenure.src }; })()`);
    expect(st.marked).toBe(30);
    expect(st.firm).toBe(true);
    expect(st.abs).toBe(3);
    expect(st.late).toBe(5);
    // present 27 of 30 = 90%, late on 5 of 27 timed: 90 × (1 − 0.5 × 5/27) = 82
    expect(st.rel).toBe(82);
    expect(st.beside).toBe('Bina Devi');
    expect(st.tenure).toBe('marked');
    await switchTab(page, 'pageStaff');
    await page.locator('#pageStaff .inv-viewtab[data-view="roster"]').click();
    await page.locator('[data-action="invAttEditWorker"][data-id="1"]').first().click();
    const rec = page.locator('[data-ppl-sheet="1"]');
    await expect(rec.locator('[data-ppl-tile="reliability"]')).toContainText('82');
    await expect(rec.locator('[data-ppl-tile="reliability"]')).toContainText('present 90% of 30 days marked · late 5');
    await expect(rec.locator('[data-ppl-skill="vat-a1"]')).toContainText('27 days there in 90');
  });

  test('the motivation index: signals with their reasons, and the check-in as half of it', async ({ page }) => {
    const s: any = book();
    // Bina joined later and is paid more on the same tier; Asha took an advance three weeks running.
    s.staff[0].profile = { joined: day(-400) };
    s.staff[1].profile = { joined: day(-100) };
    const wk = (n: number) => day(-7 * n - 1);
    s.staffPayments = [0, 1, 2].map(n => ({ id: 'P' + n, staffId: 1, date: wk(n), amount: 500, kind: 'advance', at: 1 }));
    await loadAppWithState(page, s);
    const mo: any = await g(page, `(function () { var m = pplMotivation(staffById(1)); return { keys: m.sig.map(function (x) { return x.key; }).sort(), firm: m.firm, score: m.score }; })()`);
    // Her three absences are all in the last 30 days, and 27 days at ₹450 less ₹1,500 of advances are owed.
    // No rise is judged only on a year of rates recorded (the QA chain, 7 Oct 2026): none is kept yet, so it is not said.
    expect(mo.keys).toEqual(['absent', 'advance', 'owed', 'peer']);
    expect(mo.firm).toBe(false);   // no check-in yet
    expect(mo.score).toBe(40);     // 100 − 15 − 10 − 20 − 15
    await switchTab(page, 'pageStaff');
    await page.locator('#pageStaff .inv-viewtab[data-view="roster"]').click();
    await page.locator('[data-action="invAttEditWorker"][data-id="1"]').first().click();
    await page.locator('[data-ppl-sheet="1"] [data-action="invPplCheckin"]').click();
    await page.locator('[data-action="invPplScore"][data-score="2"]').click();
    await page.fill('#pplCiNote', 'wants more hours');
    await page.locator('[data-action="invPplCheckinSave"]').click();
    // Back on the sheet: 0.5 × 40 + 0.5 × 25 = 32.5, firm now, so red.
    const m = page.locator('[data-ppl-sheet="1"] [data-ppl-motivation]');
    await expect(m.locator('.inv-panel-count')).toHaveText('33');
    await expect(m).toContainText('Low');
    await expect(m).toContainText('wants more hours');
  });

  test('details, skills and ties are the owner’s, typed once; the change log never holds the details', async ({ page }) => {
    await loadAppWithState(page, book());
    await switchTab(page, 'pageStaff');
    await page.locator('#pageStaff .inv-viewtab[data-view="roster"]').click();
    await page.locator('[data-action="invAttEditWorker"][data-id="1"]').first().click();
    await page.locator('[data-ppl-sheet="1"] [data-action="invPplEdit"]:not([data-part])').click();
    await page.fill('#pplPhone', '90000 11111');
    await page.fill('#pplId4', '1234-5678-9012');
    await page.selectOption('#pplSkill-vat-a1', '4');
    await page.selectOption('#pplTieKind0', 'family');
    await page.selectOption('#pplTieWho0', '2');
    await page.locator('[data-action="invPplSave"]').click();
    const rec = page.locator('[data-ppl-sheet="1"]');
    await expect(rec.locator('[data-ppl-personal]')).toContainText('90000 11111');
    await expect(rec.locator('[data-ppl-personal]')).toContainText('•••• 9012');
    await expect(rec.locator('[data-ppl-skill="vat-a1"] .inv-skill-dot[data-on]')).toHaveCount(4);
    await expect(rec.locator('[data-ppl-ties]')).toContainText('Family of Bina Devi');
    const st = await readStoredState(page);
    expect(st.staff[0].profile.idLast4).toBe('9012');
    expect(JSON.stringify(st.changeLog || [])).not.toContain('90000 11111');
  });

  test('a supervisor sees the record, never the motivation or the details, and cannot change them', async ({ page }) => {
    const s: any = book();
    s.staff[0].profile = { phone: '98765 43210' };
    await loadAppWithState(page, s);
    await withUsers(page);
    await unlock(page, 'U-sup', PINS.super);
    await switchTab(page, 'pageStaff');
    await page.locator('#pageStaff .inv-viewtab[data-view="roster"]').click();
    await page.locator('[data-action="invAttEditWorker"][data-id="1"]').first().click();
    const rec = page.locator('[data-ppl-sheet="1"]');
    await expect(rec.locator('[data-ppl-tile="reliability"]')).toBeVisible();
    await expect(rec.locator('[data-ppl-motivation]')).toHaveCount(0);
    await expect(rec.locator('[data-ppl-personal]')).toHaveCount(0);
    await expect(rec).not.toContainText('98765');
    expect(await g(page, `pplEdit(1); !!document.getElementById('pplPhone')`)).toBe(false);
  });

  test('a details file is checked row by row: a whole name found, a spelling only offered, nobody made up', async ({ page }) => {
    await loadAppWithState(page, book());
    await page.evaluate(() => (0, eval)(`pplImportData({ format: 'sep-people', version: 1, people: [
      { name: 'Asha Kumari', designation: 'Line technician', phone: '90000 22222', guardian: 'Ravi Kumar', bloodGroup: 'B+', emergency: { relation: 'Brother', phone: '90000 33333' },
        ties: [{ kind: 'family', name: 'Bina Devi', note: 'same father' }] },
      { name: 'Beena', phone: '90000 44444' },
      { name: 'Chandan Oraon', phone: '90000 55555' }] })`));
    const dlg = page.locator('[data-ppl-import]');
    await expect(dlg.locator('[data-ppl-import-row="0"]')).toContainText('Found');
    await expect(dlg.locator('[data-ppl-import-pick="0"]')).toHaveValue('1');
    // A spelling is a guess: said, never picked; the owner picks it to keep it.
    await expect(dlg.locator('[data-ppl-import-row="1"]')).toContainText('could be Bina Devi');
    await expect(dlg.locator('[data-ppl-import-pick="1"]')).toHaveValue('');
    await dlg.locator('[data-ppl-import-pick="1"]').selectOption('2');
    await expect(dlg.locator('[data-ppl-import-row="2"]')).toContainText('Not found');
    await dlg.locator('[data-action="invPplImportKeep"]').click();
    const st = await readStoredState(page);
    expect(st.staff.length).toBe(2);
    expect(st.staff[0].profile).toMatchObject({ designation: 'Line technician', phone: '90000 22222', guardian: 'Ravi Kumar', bloodGroup: 'B+', emergency: { relation: 'Brother', phone: '90000 33333' } });
    expect(st.staff[0].ties).toEqual([{ kind: 'family', staffId: 2, note: 'same father' }]);
    expect(st.staff[1].profile.phone).toBe('90000 44444');
  });
});
