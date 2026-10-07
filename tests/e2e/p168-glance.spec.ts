import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, type SepState } from './fixtures';
import { withUsers, unlock, PINS } from './p140-guard.fixture';

// P168 (owner, 7 Oct 2026, docs/WORKERS_AND_PLANT.md W3): the 6-second screens. The roster row says who is steady and who is
// stretched at a glance; the owner's To-do asks for check-ins and names a worker to talk to; the plant register travels as a
// sep-plant file merged by id. Made-up names only.

const g = (page: Page, e: string) => page.evaluate(x => (0, eval)(x), e);
const day = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
function book(): SepState {
  const s: any = emptyState();
  s.incomingMaterial = noSeedIM();
  s.staff = [{ id: 1, name: 'Asha Kumari', comp: 'daily', dayRate: 450, area: 'vat-a1', active: true, skills: { 'vat-a1': 4, barrel: 2 } },
    { id: 2, name: 'Bina Devi', comp: 'daily', dayRate: 500, area: 'vat-a1', active: true }];
  s.attendance = {};
  let n = 0;
  for (let i = 1; n < 20; i++) {
    const iso = day(-i);
    if (new Date(iso + 'T00:00:00').getDay() === 0) continue;
    s.attendance[iso] = { marks: { 1: { st: 'P', area: 'vat-a1', hours: 10, ot: 2, inMin: 510, outMin: 1140 }, 2: { st: 'P', area: 'vat-a1', hours: 8, ot: 0, inMin: 510, outMin: 1020 } }, extra: [] };
    n++;
  }
  return s;
}
async function roster(page: Page) {
  await switchTab(page, 'pageStaff');
  await page.locator('#pageStaff .inv-viewtab[data-view="roster"]').click();
}

test.describe('P168 at a glance', () => {
  test('the roster row: three bars with their figures, tenure, top skills, and the owner’s motivation', async ({ page }) => {
    await loadAppWithState(page, book());
    await roster(page);
    const row = page.locator('[data-action="invAttEditWorker"][data-id="1"]').first();
    await expect(row.locator('[data-ppl-glance="reliability"]')).toContainText('100');
    await expect(row.locator('[data-ppl-glance="workload"]')).toContainText('h');
    await expect(row.locator('[data-ppl-glance-meta]')).toContainText('VAT A1 4/5, Barrel 2/5');
    await expect(row.locator('[data-ppl-glance-meta]')).toContainText('Motivation');
  });

  test('a supervisor’s roster has the bars and never the motivation', async ({ page }) => {
    await loadAppWithState(page, book());
    await withUsers(page);
    await unlock(page, 'U-sup', PINS.super);
    await roster(page);
    const row = page.locator('[data-action="invAttEditWorker"][data-id="1"]').first();
    await expect(row.locator('[data-ppl-glance="reliability"]')).toBeVisible();
    await expect(row.locator('[data-ppl-glance-meta]')).not.toContainText('Motivation');
  });

  test('the owner’s To-do: check-ins due; a worker on firm figures under 50 to talk to', async ({ page }) => {
    const s: any = book();
    s.peopleCheckins = [{ id: 'C1', staffId: 2, on: day(-3), score: 1, note: 'quiet', at: 1 }];
    s.staff[1].profile = { joined: day(-500) };
    await loadAppWithState(page, s);
    const r: any = await g(page, `({ ci: TODO_RULE_FNS.pplCheckin().map(function (t) { return t.facts.map(function (f) { return f[0]; }); })[0],
      watch: TODO_RULE_FNS.pplWatch().map(function (t) { return t.key + ':' + t.tone; }) })`);
    expect(r.ci).toEqual(['Asha Kumari']);
    // Bina: no rise recorded in a year (−10), check-in 1 of 5: 0.5 × 90 + 0 = 45, firm.
    expect(r.watch).toEqual(['pplWatch:2:amber']);
  });

  test('the plant register as a file: exported whole, imported by id, a unit held kept as it is', async ({ page }) => {
    await loadAppWithState(page, book());
    const r: any = await g(page, `(function () {
      var a = pltMergeImport({ format: 'sep-plant', version: 1, units: [
        { name: 'Tank 1', station: 'vat-a1', kgRound: 30 }, { name: 'Tank 2', station: 'vat-a1', kgRound: 30, status: 'down', reason: 'leak', since: '${day(-2)}' },
        { name: 'Mystery', station: 'nowhere' }] });
      var b = pltMergeImport({ format: 'sep-plant', version: 1, units: [{ name: 'tank 1', station: 'vat-a1', kgRound: 99 }] });
      return { a: [a.added, a.kept, a.bad], b: [b.added, b.kept], kg: pltUnits('vat-a1')[0].kgRound, log: S.plant.log.length, cap: pltCapWords(pltCapacity('vat-a1')) };
    })()`);
    expect(r.a).toEqual([2, 0, 1]);
    expect(r.b).toEqual([0, 1]);
    expect(r.kg).toBe(30);
    expect(r.log).toBe(2);
    expect(r.cap).toBe('1 of 2 tanks working · 50% available');
  });
});
