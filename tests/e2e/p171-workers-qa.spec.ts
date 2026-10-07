import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, type SepState } from './fixtures';

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
