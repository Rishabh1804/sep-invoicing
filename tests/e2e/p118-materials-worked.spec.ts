import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, recentTs, switchTab, type SepState } from './fixtures';

// P118 (owner, 30 Sep 2026): Clients → Performance shows every material worked, how much and when, in any period, for one
// client or all of them; a code two clients send is counted apart and said so; one part however it was spelt does not
// read as stopped; and a part plated by the round is judged by what a line-hour of it earns. Made-up clients and parts.

const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);
function daysAgo(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
let seq = 0;
function inv(clientId: number, dayAgo: number, part: string, desc: string, qty: number, unit: 'KG' | 'NOS', rate: number) {
  seq += 1;
  return { id: `INV-${seq}`, invoiceNumber: String(seq).padStart(5, '0'), displayNumber: `SEP/TEST-${String(seq).padStart(5, '0')}`, date: daysAgo(dayAgo),
    status: 'active', invoiceState: 'filed', clientId, clientName: '', gstType: 'intra', clientAddress: { state: 'JHARKHAND', stateCode: '20' },
    items: [{ partNumber: part, desc, hsn: '998873', unit, qty, rate, amount: qty * rate, nosQty: null }],
    taxableValue: qty * rate, cgstPer: 9, cgstAmt: 0, sgstPer: 9, sgstAmt: 0, igstPer: 0, igstAmt: 0, grandTotal: qty * rate, createdAt: recentTs() };
}
function ch(clientId: number, dayAgo: number, no: string, part: string, desc: string, qty: number, unit: 'KG' | 'NOS', nosQty: number | null = null) {
  seq += 1;
  return { id: `IM-T${seq}`, challanNo: no, challanDate: daysAgo(dayAgo), clientId, clientName: '', vehicleNo: '', receivedDate: daysAgo(dayAgo), createdAt: recentTs(),
    items: [{ id: `IM-T${seq}-0`, partNumber: part, desc, hsn: '998873', unit, qty, rate: 0, amount: 0, nosQty, invoiced: true }] };
}
function book(): SepState {
  seq = 0;
  const s: any = emptyState();
  s.clients = [
    { id: 1, name: 'ALPHA CLAMPS', billingMode: 'weight', gstType: 'intra', isActive: true, rates: [{ ratePerKg: 6, effectiveFrom: '2020-04-01' }], itemRates: [] },
    { id: 2, name: 'BETA AUTO', billingMode: 'weight', gstType: 'intra', isActive: true, rates: [{ ratePerKg: 13, effectiveFrom: '2020-04-01' }], itemRates: [] },
    { id: 3, name: 'SAMARTH TEST WORKS', billingMode: 'piece', gstType: 'intra', isActive: true, rates: [{ ratePerKg: 14, effectiveFrom: '2020-04-01' }], itemRates: [] },
  ];
  // The same clamp, written two ways: CLAMP 149X83(40X6) to ~3 months ago, then 149X83 with the gauge in the description.
  const im: any[] = [], invs: any[] = [];
  [200, 180, 160, 140, 120, 100].forEach((d, i) => { im.push(ch(1, d, String(100 + i), 'CLAMP 149X83(40X6)', 'CLAMP 149X83(40X6)', 500, 'KG', 2000)); invs.push(inv(1, d - 2, 'CLAMP 149X83(40X6)', 'CLAMP 149X83(40X6)', 500, 'KG', 6)); });
  [80, 60, 40, 20, 5].forEach((d, i) => { im.push(ch(1, d, String(200 + i), '149X83', 'CLAMP (40X6)', 400, 'KG', 1600)); invs.push(inv(1, d - 2 < 0 ? 0 : d - 2, '149X83', 'CLAMP (40X6)', 400, 'KG', 6)); });
  // A code both clients send.
  im.push(ch(1, 30, '300', 'BRACKET 5501', 'BRACKET 5501', 120, 'KG'));
  im.push(ch(2, 25, 'B-7', 'BRACKET 5501', 'BRACKET 5501', 60, 'KG'));
  im.push(ch(2, 10, 'B-8', 'CLAMP 66X42', 'CLAMP 66X42 (30X6)', 300, 'NOS'));
  // Parts billed by the piece and plated by the round.
  invs.push(inv(3, 12, '5174 5460 3302', 'BRACKET', 240, 'NOS', 9));
  invs.push(inv(3, 11, '5166 5460 3303', 'BRACKET', 800, 'NOS', 3));
  s.incomingMaterial = im.length ? im : noSeedIM();
  s.invoices = invs;
  return s as SepState;
}

async function openPerf(page: Page, clientId: number) {
  await switchTab(page, 'pageClients');
  await page.locator('[data-action="invSwitchSubView"][data-view="performance"]').click();
  await page.locator('#cpClientSelect').selectOption(String(clientId));
}

test('one clamp spelt two ways is one part, steady, and the old spelling is not called stopped', async ({ page }) => {
  await loadAppWithState(page, book());
  await openPerf(page, 1);
  expect(await g(page, `JSON.stringify([cpPartIdentity('CLAMP 149X83(40X6)', 'CLAMP 149X83(40X6)'), cpPartIdentity('149X83', 'CLAMP (40X6)'), cpPartIdentity('5174 5460 3302', 'BRACKET')])`))
    .toBe(JSON.stringify([{ base: '149X83', gauge: '40X6' }, { base: '149X83', gauge: '40X6' }, { base: '517454603302', gauge: '' }]));
  await expect(page.locator('[data-cp-group="stopped"]')).toContainText('Stopped · 0');
  await expect(page.locator('[data-cp-group="steady"]')).toContainText('149X83');
});

test('materials worked: a period, a search, every challan by date, and a code another client also sends', async ({ page }) => {
  await loadAppWithState(page, book());
  await openPerf(page, 1);
  const card = page.locator('[data-card="worked"]');
  await card.locator('[data-action="invCpPeriod"][data-p="3m"]').click();
  await card.locator('#cpMatSearch').fill('clamp');
  // 3 months: the four 149X83 challans inside 90 days (80, 60, 40, 20) and the one 5 days ago, 400 kg and 1,600 pieces each.
  const clamp = card.locator('[data-cp-worked="1|149X83|40X6"]');
  await expect(clamp).toContainText('8,000 NOS · 2,000 kg');
  await expect(clamp).toContainText('5 challans');
  await expect(card.locator('[data-cp-worked-total]')).toContainText('“clamp” · 1 part');
  await expect(card.locator('#cpMatSearch')).toBeFocused();
  await clamp.locator('summary').click();
  await expect(clamp.locator('.inv-row-children [data-action="invHistoryJumpChallan"]')).toHaveCount(5);
  // The shared code says so, and is counted apart.
  await card.locator('#cpMatSearch').fill('5501');
  await expect(card.locator('[data-cp-shared]')).toContainText('BETA AUTO also sends it');
  await expect(card.locator('[data-cp-worked="1|BRACKET5501|"]')).toContainText('120 kg');
  // All clients: each client's own row.
  await card.locator('[data-action="invCpScope"][data-s="all"]').click();
  await expect(page.locator('[data-card="worked"] [data-cp-worked]')).toHaveCount(2);
  await expect(page.locator('[data-card="worked"] [data-cp-worked="2|BRACKET5501|"]')).toContainText('60 kg');
  // All clients, clamps: both clients' clamps, each named.
  await page.locator('[data-card="worked"] #cpMatSearch').fill('clamp');
  await expect(page.locator('[data-card="worked"] [data-cp-worked-total]')).toContainText('2 parts · 2 clients');
  await expect(page.locator('[data-card="worked"] [data-cp-worked="2|66X42|30X6"]')).toContainText('300 NOS');
});

test('by the hour: a round is pickle + plate + 15 minutes; Samarth’s are set once, at the register’s rounds, and removed stays removed', async ({ page }) => {
  await loadAppWithState(page, book());
  const c = (await readStoredState(page)).clients.find((x: any) => x.id === 3);
  // Set at 24 and 80 first, then at the register's rounds (56, 156; owner, 30 Sep 2026), the connector's 50 added.
  expect(c.partTimes.map((t: any) => [t.name, t.line, t.pieces, t.plateMin])).toEqual([['5174 5460 3302', 'vat-a2', 56, 30], ['5166 5460 3303', 'vat-a2', 156, 30], ['5167 5461 3302', 'vat-a1', 50, undefined]]);
  await openPerf(page, 3);
  const card = page.locator('[data-card="hours"]');
  // No pickling on record: 30 + 15 = 45 min a round. 56 × ₹9 over 0.75 h is ₹672 an hour; 156 × ₹3 is ₹624.
  await expect(card.locator('[data-cp-time="PT-seed1"] summary')).toContainText('₹672.00');
  await expect(card.locator('[data-cp-time="PT-seed2"] summary')).toContainText('₹624.00');
  await expect(card.locator('[data-cp-time="PT-seed1"] summary')).toContainText('+ plate 30 min (set) + 15 min logistics');
  // The constant is the owner's to change: 5 minutes makes a round 35.
  await card.locator('#cpOverhead').fill('5');
  await card.locator('#cpOverhead').dispatchEvent('change');
  await expect(page.locator('[data-card="hours"] [data-cp-time="PT-seed1"] summary')).toContainText('₹864.00');
  await expect(page.locator('[data-card="hours"] [data-cp-hour-ref]')).toContainText('An hour costs the plant');
  await page.locator('[data-card="hours"] [data-cp-time="PT-seed2"] summary').click();
  await page.locator('[data-card="hours"] [data-cp-time="PT-seed2"] [data-action="invCpTimeRemove"]').click();
  await page.reload();
  await page.waitForSelector('body.inv-booted');
  expect((await readStoredState(page)).clients.find((x: any) => x.id === 3).partTimes).toHaveLength(2);
});

test('the times are learnt from the production record, the trend is read, and a set figure the record no longer bears out is said', async ({ page }) => {
  const s: any = book();
  const d = (n: number) => daysAgo(n);
  const plated = (id: string, date: string, times: string[], qty: number) => ({ id, kind: 'plated', date, line: 'vat-a2', lineSrc: 'written', clientId: 3, part: '5174 5460 3302', qty: qty * times.length, unit: 'NOS',
    basis: 'register', src: 'photo', time: times[0], to: times[times.length - 1], rounds: times.map(t => ({ time: t, qty })), at: 1 });
  const pickled = (id: string, date: string, time: string, part: string, qty: number) => ({ id, kind: 'pickled', date, clientId: 3, part, qty, unit: 'NOS', time, basis: 'pickling', src: 'paste', at: 1 });
  s.production = { entries: [
    // 60 to 40 days ago: 30-minute rounds of 24.
    plated('A1', d(60), ['9:00', '9:30', '10:00', '10:30'], 24), plated('A2', d(45), ['9:00', '9:30', '10:00'], 24),
    // The last 30 days: 40-minute rounds, and a round of 20.
    plated('B1', d(20), ['9:00', '9:40', '10:20', '11:00'], 24), plated('B2', d(10), ['12:40', '1:20 PM', '2:00 PM'], 20),
    // Pickling: 48 pieces, the next load 24 minutes later: half a minute a piece.
    pickled('K1', d(10), '8:00', '5174 5460 3302', 48), pickled('K2', d(10), '8:24', 'OTHER 1', 10),
  ], pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} } };
  await loadAppWithState(page, s);
  const m = JSON.parse(await g(page, `JSON.stringify(cpMeasured(cpMeasure(3, '517454603302', '')))`) as string);
  expect(m).toMatchObject({ nPlate: 10, nPickle: 1, pcsMax: 24, trendBefore: 30, trendNow: 40 });
  await openPerf(page, 3);
  const row = page.locator('[data-card="hours"] [data-cp-time="PT-seed1"]');
  await row.locator('summary').click();
  await expect(row).toContainText('10 plating rounds timed');
  await expect(row).toContainText('+33%');
  // Set at 30, measured at 40 now: said, with a button to take the measure.
  await row.locator('[data-action="invCpTimeUseMeasured"]').click();
  const t = (await readStoredState(page)).clients.find((x: any) => x.id === 3).partTimes[0];
  expect(t.plateMin).toBe(Math.round(m.plateMin));
  expect(t.history[0]).toMatchObject({ plateMin: 30 });
});

test('Stats’ top items read one clamp however it was spelt, and say when another client sends the same code', async ({ page }) => {
  await loadAppWithState(page, book());
  const top = await g(page, `JSON.stringify(buildTopItems(S.invoices.filter(i => i.clientId === 1), 'value').rows.map(r => [r.base, r.gauge, r.amount]))`);
  expect(JSON.parse(top as string)).toEqual([['149X83', '40X6', 6 * 500 * 6 + 5 * 400 * 6]]);
});
