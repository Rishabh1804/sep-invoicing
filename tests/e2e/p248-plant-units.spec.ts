import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState } from './fixtures';

// P248 (T-IO, 29 Oct 2026; Vulcanus V-2, V-4, V-5, V-6 of 28 Oct): what counts toward a line is one rule, a tank or a barrel at
// the line's station (pltPlates). A rectifier or any other unit supports a line: it is never one of the line's units, it names
// the line it stops when it fails (pltLineOf), and a power cut tied to it lands on that line (pltPlaceOf). The unit's form
// follows its station until a kind or a line is picked, and offers no line to a unit that plates. Made-up units.

const g = (page: Page, e: string) => page.evaluate(x => (0, eval)(x), e);
const day = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const unit = (id: string, name: string, station: string, kind: string, extra: any = {}) =>
  Object.assign({ id, name, station, kind, kgRound: 30, status: 'run', since: day(-30), reason: '', condition: 'fair' }, extra);
function book(units: any[] = [], entries: any[] = [], causes: any[] = []): SepState {
  const s: any = emptyState();
  s.incomingMaterial = noSeedIM();
  s.plant = { units, log: [] };
  if (entries.length || causes.length) {
    s.production = { entries, pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} } };
    s.power = { causes };
  }
  return s;
}
/** Three months billed, so the planner has a book to plan from (P245's shape, made up). */
function withInvoices(s: any): SepState {
  s.clients = [{ id: 1, name: 'DELTA AUTO', billingMode: 'weight', gstType: 'intra', gstin: '', address: '', rates: [] }];
  s.invoices = [1, 2, 3].map(i => {
    const x = new Date(); x.setDate(1); x.setMonth(x.getMonth() - i); x.setDate(10);
    const date = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-10`;
    return { id: 'INV' + i, invoiceNumber: i, displayNumber: 'SEP/TEST-' + i, date, status: 'active', invoiceState: 'filed', clientId: 1, clientName: 'DELTA AUTO',
      items: [{ partNumber: 'BRACKET', desc: 'BRACKET', unit: 'KG', qty: 2000, rate: 12, amount: 24000 }], taxableValue: 24000, grandTotal: 28320, createdAt: Date.now() };
  });
  return s;
}
async function openEquipment(page: Page) {
  await switchTab(page, 'pageProduction');
  await page.locator('#productionContent .inv-viewtab[data-tab="equipment"]').click();
}
const dlg = (p: Page) => p.locator('[data-plt-dialog]');
const lineField = (p: Page) => dlg(p).locator('[data-plt-linefield]');
const lineOwn = (p: Page) => dlg(p).locator('[data-plt-lineown]');
const stored = async (p: Page) => (await readStoredState(p)) as any;

test.describe('P248 a line’s units, and the units that support it', () => {
  test('the form follows its station until a kind or a line is picked, and offers no line to a unit that plates', async ({ page }) => {
    await loadAppWithState(page, book());
    await openEquipment(page);
    await page.locator('[data-prod-toolbar="equipment"] [data-action="invPltEdit"]').click();
    await dlg(page).locator('details summary').click();
    // Add a unit opens at VAT A1, a tank, which stops its own line: no line is offered.
    await expect(dlg(page).locator('#pltStation')).toHaveValue('vat-a1');
    await expect(dlg(page).locator('#pltKind')).toHaveValue('tank');
    await expect(lineField(page)).toBeHidden();
    await expect(lineOwn(page)).toContainText('Its own, VAT A1: a tank stops its share of the line');
    // The station moves the kind it has not been given.
    await dlg(page).locator('#pltStation').selectOption('barrel');
    await expect(dlg(page).locator('#pltKind')).toHaveValue('barrel');
    await expect(lineOwn(page)).toContainText('Its own, Barrel: a barrel stops its share');
    // Away from a line it is Other, and it supports one: its line is offered, none until picked.
    await dlg(page).locator('#pltStation').selectOption('other');
    await expect(dlg(page).locator('#pltKind')).toHaveValue('other');
    await expect(lineField(page)).toBeVisible();
    await expect(lineOwn(page)).toBeHidden();
    await expect(dlg(page).locator('#pltLine')).toHaveValue('');
    // A kind picked is the owner's: a station changed after it moves the line, never the kind.
    await dlg(page).locator('#pltKind').selectOption('rectifier');
    await dlg(page).locator('#pltStation').selectOption('vat-a2');
    await expect(dlg(page).locator('#pltKind')).toHaveValue('rectifier');
    await expect(dlg(page).locator('#pltLine')).toHaveValue('vat-a2');
    await expect(lineField(page)).toBeVisible();
    // A line picked is the owner's too.
    await dlg(page).locator('#pltLine').selectOption('vat-a1');
    await dlg(page).locator('#pltStation').selectOption('other');
    await expect(dlg(page).locator('#pltLine')).toHaveValue('vat-a1');
    await dlg(page).locator('#pltName').fill('Rectifier 8');
    await dlg(page).locator('[data-action="invPltSave"]').click();
    await expect(dlg(page)).toHaveCount(0);
    const u = (await stored(page)).plant.units.find((x: any) => x.name === 'Rectifier 8');
    expect(u).toMatchObject({ station: 'other', kind: 'rectifier', line: 'vat-a1' });
  });

  test('a rectifier added at Other, its fold never opened, stops no line; a line never picked is not stored', async ({ page }) => {
    await loadAppWithState(page, book());
    await openEquipment(page);
    await page.locator('[data-prod-toolbar="equipment"] [data-action="invPltEdit"]').click();
    await dlg(page).locator('#pltName').fill('Rectifier 9');
    await dlg(page).locator('#pltStation').selectOption('other');
    await dlg(page).locator('#pltKind').selectOption('rectifier');
    await dlg(page).locator('[data-action="invPltSave"]').click();
    await expect(dlg(page)).toHaveCount(0);
    const u = (await stored(page)).plant.units.find((x: any) => x.name === 'Rectifier 9');
    expect(u).toMatchObject({ station: 'other', kind: 'rectifier' });
    expect('line' in u).toBe(false);
    // It had stopped VAT A1 whole, the station the form opened at.
    expect(await g(page, `pltLineOf(S.plant.units.find(function (x) { return x.name === 'Rectifier 9'; }))`)).toBe('');
  });

  test('a barrel that carried another line stops its own; saved, the old field goes', async ({ page }) => {
    await loadAppWithState(page, book([unit('B6', 'Barrel 6', 'barrel', 'barrel', { line: 'vat-a1' }), unit('B7', 'Barrel 7', 'barrel', 'barrel')]));
    expect(await g(page, `pltLineOf(pltUnitById('B6'))`)).toBe('barrel');
    await openEquipment(page);
    await page.locator('[data-plt-station="barrel"] [data-plt-unit="B6"] [data-action="invPltEdit"]').click();
    await expect(lineField(page)).toHaveAttribute('hidden', '');
    await dlg(page).locator('[data-action="invPltSave"]').click();
    await expect(dlg(page)).toHaveCount(0);
    const u = (await stored(page)).plant.units.find((x: any) => x.id === 'B6');
    expect('line' in u).toBe(false);
    // The trials read the barrel's own line, as before.
    expect(await g(page, `pltMachines().find(function (m) { return m.id === 'B6'; }).line`)).toBe('barrel');
  });

  test('a rectifier at a line’s station is no tank of it: the line counts its tanks, and the rectifier supports it', async ({ page }) => {
    await loadAppWithState(page, book([unit('T1', 'Tank 1', 'vat-a1', 'tank'), unit('T2', 'Tank 2', 'vat-a1', 'tank'),
      unit('R5', 'Rectifier 5', 'vat-a1', 'rectifier', { status: 'down', reason: 'card failed' }),
      unit('R6', 'Rectifier 6', 'other', 'tank', { line: 'vat-a2' }), unit('T3', 'Tank 3', 'vat-a2', 'tank')]));
    const cap: any = await g(page, `(function () { var c = pltCapacity('vat-a1'); var d = pltCapacity('vat-a1', localDateStr(), true);
      return { n: c.n, a: c.nAvail, kg: c.kgTotal, words: pltCapWords(c), dayN: d.nAvail, a2: pltCapacity('vat-a2').n }; })()`);
    // Two tanks of 30 kg, both working: the rectifier down is neither a tank nor down on the line (it had read 2 of 3).
    expect(cap).toEqual({ n: 2, a: 2, kg: 60, words: '2 of 2 tanks working · 100% available', dayN: 2, a2: 1 });
    await openEquipment(page);
    const a1 = page.locator('[data-plt-station="vat-a1"]');
    await expect(a1.locator('[data-plt-unit]')).toHaveCount(2);
    await expect(a1.locator('[data-plt-unit="R5"]')).toHaveCount(0);
    const sup = page.locator('[data-plt-station="support"]');
    await expect(sup.locator('[data-plt-unit="R5"] .inv-row-meta')).toContainText('VAT A1');
    await expect(sup.locator('[data-plt-unit="R5"] .inv-dot-danger')).toHaveText('Down');
    // Where it stands and the line it stops are one fact.
    await expect(sup.locator('[data-plt-unit="R6"] .inv-row-meta')).toContainText('Other, for VAT A2');
    // The card judges the rectifier apart from VAT A1's tanks.
    await expect(page.locator('#pltVerdict .inv-hero-title')).toHaveText('1 of 1 unit down on VAT A1’s supporting equipment');
    await expect(page.locator('#pltVerdict [data-plt-factor="vat-a1"]')).toContainText('100% available');
  });

  test('a power cut tied to a supporting unit lands on the line it stops: its words, the causes’ places and the line’s note', async ({ page }) => {
    const cut = (id: string, n: number) => ({ id, kind: 'downtime', date: day(-n), time: '10:00', to: '10:20', basis: 'relay', src: 'paste', at: 1,
      downtime: { cause: 'power', reason: 'RS1', unitId: 'R6', where: 'other', setAt: 1 } });
    await loadAppWithState(page, book([unit('R6', 'Rectifier 6', 'other', 'tank', { line: 'vat-a2' }), unit('T3', 'Tank 3', 'vat-a2', 'tank')],
      [cut('C1', 2), cut('C2', 3)], [{ id: 'RS1', kind: 'reason', name: 'Rectifier card trip', aliases: [], scope: 'plant', at: 1, by: 'Owner' }]));
    const r: any = await g(page, `(function () { var z = pcsAnalysis();
      return { word: pcsWhereWord('other', 'R6'), places: z.places.map(function (p) { return p.key; }), a2: !!pcsStationNote('vat-a2'), other: !!pcsStationNote('other') }; })()`);
    // It had read "Rectifier 6 (Other)", been counted under Other and left off VAT A2's panel.
    expect(r).toEqual({ word: 'Rectifier 6 (VAT A2)', places: ['vat-a2'], a2: true, other: false });
    await openEquipment(page);
    await expect(page.locator('[data-plt-station="vat-a2"] [data-pcs-station="vat-a2"]')).toContainText('2 power cuts hit VAT A2 in 90 days: Rectifier card trip');
  });

  test('Repairs and sales: a down rectifier names the line it serves and moves no figure; a pickling tank is a share of its kilos an hour', async ({ page }) => {
    await loadAppWithState(page, withInvoices(book([unit('R6', 'Rectifier 6', 'other', 'rectifier', { line: 'vat-a2', status: 'down', reason: 'card failed' }),
      unit('T3', 'Tank 3', 'vat-a2', 'tank'), unit('P1', 'Pickling 1', 'pick', 'tank'), unit('P2', 'Pickling 2', 'pick', 'tank', { status: 'down', reason: 'leak' })])));
    const r: any = await g(page, `(function () { var m = plnUnitMoveOf('fix:R6'), p = plnUnitMoveOf('fix:P2');
      return { line: m.line, share: m.share, pline: p.line, pshare: Math.round(p.share * 100) }; })()`);
    // The pickling tank's share is its kilos over the kilos working: one of two back doubles them.
    expect(r).toEqual({ line: 'vat-a2', share: 0, pline: 'pick', pshare: 100 });
    await switchTab(page, 'pagePlanner');
    await page.locator('#pagePlanner [data-action="invPlnView"][data-v="moves"]').click();
    await page.locator('#pagePlanner [data-action="invPlnMoves"][data-k="plant"]').click();
    const row = page.locator('[data-pl-unit="fix:R6"]');
    await expect(row).toContainText('back working for VAT A2');
    await expect(row).not.toContainText('no line named');
    await expect(page.locator('[data-pl-unit="fix:P2"]')).toContainText('100% more pickling an hour');
    await expect(page.locator('[data-pl-unit="fix:P2"]')).not.toContainText('on pick');
    const detail: any = await g(page, `(function () { var el = document.querySelector('[data-pl-detail="fix:R6"]'); return el ? el.textContent : ''; })()`);
    expect(detail).toContain('The line it serves');
    expect(detail).not.toContain('Its share of the line');
  });
});
