import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, type SepState } from './fixtures';

// P130: the QA chain's screen sweep of 30 Sep 2026 (every page and view measured and shot on the real book, phone and
// desktop). Power → Cuts ran 21.6 phone screens, a paragraph of arithmetic under every cut; Staff → Day's P / H / A read
// "P.." once the Day became a board; Production's tonnage tile said 0.03 t beside 3,600 pieces with nothing saying how
// few were weighed. Made-up names.

const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** A working day (not Sunday) `n` days back from today. */
function wday(n: number): string {
  const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() - n);
  while (d.getDay() === 0) d.setDate(d.getDate() - 1);
  return isoOf(d);
}
const cut = (id: string, date: string, time: string, to?: string) => ({ id, kind: 'downtime', date, time, ...(to ? { to } : {}),
  downtime: { cause: 'power', open: !to }, basis: 'relay', src: 'paste', at: 1 });

function book(extra: any = {}): SepState {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
  s.staff = [{ id: 1, name: 'Alfa', comp: 'monthly', area: 'vat-a1', dayRate: 500, active: true, onFloor: true },
    { id: 2, name: 'Bravo', comp: 'monthly', area: 'vat-a1', dayRate: 500, active: true, onFloor: true }];
  return Object.assign(s, extra) as SepState;
}

test('Staff → Day: each of P / H / A is a whole touch target, never cut to "P.."', async ({ page }) => {
  await loadAppWithState(page, book({ attendance: { [todayIso()]: { marks: { 1: { st: 'P', area: 'vat-a1', hours: 8, ot: 0 }, 2: { st: 'H', area: 'vat-a1', hours: 4, ot: 0 } }, extra: [], note: '' } } }));
  await switchTab(page, 'pageStaff');
  await page.locator('[data-action="invAttView"][data-view="day"]').first().click();
  const btns = page.locator('[data-att-row="1"] .inv-seg-btn');
  await expect(btns).toHaveText(['P', 'H', 'A']);
  const box = await btns.evaluateAll(els => els.map(e => ({ w: e.getBoundingClientRect().width, cut: e.scrollWidth > e.clientWidth })));
  for (const b of box) { expect(b.w).toBeGreaterThanOrEqual(43.5); expect(b.cut).toBe(false); }
});

test('Power → Cuts: a cut is one line that opens to its damage, the newest month open and the older ones folded', async ({ page }) => {
  // Twenty-four cuts this month and twelve a month back: the list that ran 21.6 phone screens on the real book.
  const now: any[] = [], before: any[] = [];
  for (let i = 0; i < 24; i++) now.push(cut('N' + i, wday(i % 20), `${String(9 + (i % 6)).padStart(2, '0')}:${String(10 + i).padStart(2, '0')}`, `${String(9 + (i % 6)).padStart(2, '0')}:${String(40 + (i % 15)).padStart(2, '0')}`));
  const old = new Date(todayIso() + 'T00:00:00'); old.setDate(1); old.setDate(0);          // the last day of last month
  const oldMonth = isoOf(old).slice(0, 7);
  for (let i = 0; i < 12; i++) before.push(cut('O' + i, `${oldMonth}-${String(2 + i).padStart(2, '0')}`, '10:00', '10:25'));
  const nowMonth = todayIso().slice(0, 7);
  const entries = [...now.filter(c => c.date.slice(0, 7) === nowMonth), ...before];
  const d = wday(3);
  const attendance: any = {};
  for (const c of entries) attendance[c.date] = { marks: { 1: { st: 'P', area: 'vat-a1', hours: 8, ot: 0 } }, extra: [], note: '' };
  await loadAppWithState(page, book({ production: { entries, pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} } }, attendance,
    costBills: [{ id: 'B1', kind: 'power', month: d.slice(0, 7), amount: 50000, fixed: 3000, at: 1 },
      // a bill for this month too: the first row is this month's, and on the 1st three working days back is last month
      ...(d.slice(0, 7) === nowMonth ? [] : [{ id: 'B2', kind: 'power', month: nowMonth, amount: 50000, fixed: 3000, at: 1 }])] }));
  await switchTab(page, 'pagePower');
  await page.locator('[data-action="invPowerTab"][data-tab="cuts"]').click();
  const cur = page.locator(`[data-power-month="${nowMonth}"]`), prev = page.locator(`[data-power-month="${oldMonth}"]`);
  await expect(cur).toHaveAttribute('open', '');
  await expect(prev).not.toHaveAttribute('open', '');
  await expect(prev.locator(':scope > summary')).toContainText('12');
  // Ten cuts show, the rest behind one row that says how many.
  const n = await cur.locator('details[data-power-cut]:not([hidden])').count();
  const all = await cur.locator('details[data-power-cut]').count();
  expect(n).toBe(Math.min(10, all));
  if (all > 10) await expect(cur.locator('[data-action="invShowMore"]')).toContainText(`Show ${all - 10} more cuts`);
  // A row's title is the day and the clock with no year (the month says it), never cut; its meta a line, not a paragraph.
  const row = cur.locator('details[data-power-cut]').first();
  const title = row.locator('summary .inv-row-title');
  await expect(title).toHaveText(/^\d{1,2} [A-Z][a-z]{2} · \d{1,2}:\d{2}( [AP]M)? – \d{1,2}:\d{2} [AP]M$/);
  expect(await title.evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
  await expect(row.locator('summary .inv-row-meta')).not.toContainText('contribution');
  // Opened, it lists what the damage is made of, and those parts add up to the figure on the row (the fixed charge is paid anyway).
  const row3 = row;
  await row3.locator('summary').click();
  await expect(row3.locator('.inv-row-children')).toBeVisible();
  const sum = await row3.evaluate(el => {
    const num = (t: string) => Number(t.replace(/[^\d.-]/g, ''));
    const parts = Array.from(el.querySelectorAll('.inv-row-children .inv-row')).filter(r => !/Fixed charge/.test(r.textContent || ''));
    return { total: num(el.querySelector('summary .inv-num')!.textContent || ''), parts: parts.reduce((s, r) => s + num(r.querySelector('.inv-num')!.textContent || ''), 0),
      labels: Array.from(el.querySelectorAll('.inv-row-children .inv-row-title')).map(t => t.textContent) };
  });
  expect(sum.labels).toEqual(expect.arrayContaining(['Restart', 'Output not made', 'Wages that bought nothing', 'Fixed charge']));
  expect(Math.abs(sum.parts - sum.total)).toBeLessThanOrEqual(0.02);
  // The whole tab now fits in a few phone screens (it was a screen or more per three cuts).
  await row3.locator('summary').click();
  const screens = await g(page, 'document.documentElement.scrollHeight / window.innerHeight') as number;
  expect(screens).toBeLessThan(4.5);
});

test('Production → Overview: a day whose pieces are mostly unweighed shows the pieces, and says how much was weighed', async ({ page }) => {
  const d = wday(1);
  const clients = [{ id: 11, name: 'NOVA CLAMPS PVT. LTD.', billingMode: 'piece', gstType: 'intra', gstin: '', address: '' }];
  const E = (id: string, o: any) => ({ id, at: 1, time: '10:00', unit: 'NOS', basis: 'register', src: 'photo', kind: 'plated', line: 'vat-a1', lineSrc: 'written', slot: 'general', clientId: 11, date: d, ...o });
  await loadAppWithState(page, book({ clients, production: { entries: [E('P1', { part: 'LINER 88', qty: 3500 }), E('P2', { part: 'PAD 150', qty: 100 })],
    pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} } }, partWeights: { 'PAD 150': 0.3 } }));
  await switchTab(page, 'pageProduction');
  const t = page.locator('[data-prod-tile="last"]');
  await expect(t.locator('.inv-tile-value')).toHaveText('3,600 NOS');
  await expect(t.locator('.inv-tile-sub')).toContainText('0.03 t known, 3% of the pieces weighed');
  // Weighed in full, the tonnes are the figure again.
  await g(page, `S.partWeights = { 'PAD 150': 0.3, 'LINER 88': 0.2 }; prodTouch(); renderProduction();`);
  await expect(t.locator('.inv-tile-value')).toHaveText('0.73 t');
  await expect(t.locator('.inv-tile-sub')).toContainText('3,600 NOS');
});
