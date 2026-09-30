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

test('by the hour: Samarth’s parts are set once, and each is judged against what a line-hour costs', async ({ page }) => {
  await loadAppWithState(page, book());
  const c = (await readStoredState(page)).clients.find((x: any) => x.id === 3);
  expect(c.partTimes.map((t: any) => [t.name, t.line, t.pieces, t.minutes])).toEqual([['5174 5460 3302', 'vat-a2', 24, 30], ['5166 5460 3303', 'vat-a2', 80, 30]]);
  await openPerf(page, 3);
  const card = page.locator('[data-card="hours"]');
  // 24 × ₹9 in half an hour is ₹432 a line-hour; 80 × ₹3 is ₹480.
  await expect(card.locator('[data-cp-time="PT-seed1"]')).toContainText('₹432.00');
  await expect(card.locator('[data-cp-time="PT-seed2"]')).toContainText('₹480.00');
  await card.locator('[data-action="invCpPeriod"]').count();
  await expect(card.locator('[data-cp-time="PT-seed1"]')).toContainText('240 pcs billed, 5.0 line-hours of VAT A2');
  await expect(card.locator('[data-cp-hour-ref]')).toContainText('A line-hour costs the plant');
  // Removed stays removed: the seed does not come back on a reload.
  await card.locator('[data-cp-time="PT-seed2"] [data-action="invCpTimeRemove"]').click();
  await page.reload();
  await page.waitForSelector('body.inv-booted');
  expect((await readStoredState(page)).clients.find((x: any) => x.id === 3).partTimes).toHaveLength(1);
});

test('Stats’ top items read one clamp however it was spelt, and say when another client sends the same code', async ({ page }) => {
  await loadAppWithState(page, book());
  const top = await g(page, `JSON.stringify(buildTopItems(S.invoices.filter(i => i.clientId === 1), 'value').rows.map(r => [r.base, r.gauge, r.amount]))`);
  expect(JSON.parse(top as string)).toEqual([['149X83', '40X6', 6 * 500 * 6 + 5 * 400 * 6]]);
});
