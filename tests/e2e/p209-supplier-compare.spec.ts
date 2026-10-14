import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, toolbarMore, type SepState } from './fixtures';

// P209: compare suppliers when ordering (owner, 10 Oct 2026: "When ordering stocks let's have an option to select and compare between
// suppliers, pros and cons. Right now, we don't have that option while ordering or planning for stock"). From the reorder list and a
// line's page: every supplier of the line side by side, its price and what it rests on, its lead time against the days left, what the
// order comes to, what is owed to it, and what speaks for and against it; a pick kept on the line, the app's own beside it; a price
// quoted weighs a supplier that never sold the line. Made-up suppliers; every date from today.

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const day = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); };
const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
const bill = (id: string, itemId: string, date: string, qty: number, price: number, supplier: string, billNo: string) =>
  ({ id, itemId, kind: 'bill', qty, price, amount: Math.round(qty * price * 100) / 100, date, billDate: date, supplier, billNo, at: 1 });

function book(): SepState {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
  s.stock = {
    items: [{ id: 'B', name: 'Brightener K', key: 'BRIGHTENER K', unit: 'L', basis: 'draw', aliases: [] },
      { id: 'Q', name: 'Salt Q', key: 'SALT Q', unit: 'kg', basis: 'draw', aliases: [] }],
    entries: [
      // Brightener: 5 L a day, 70 on the shelf (14 days). Kappa twice, the last at 205; Mu once at 186.
      { id: 'c1', itemId: 'B', kind: 'count', qty: 120, date: day(-10), at: 1, seq: 3 },
      { id: 'u1', itemId: 'B', kind: 'used', qty: 50, days: 10, from: day(-10), date: day(-1), at: 2, seq: 2 },
      bill('k101', 'B', day(-20), 30, 200, 'Kappa & Brothers', 'K/101'),
      bill('m55', 'B', day(-15), 30, 186, 'Mu Traders', 'M/55'),
      bill('k120', 'B', day(-5), 30, 205, 'Kappa & Brothers', 'K/120'),
      // Salt: 1 kg a day, 2 on the shelf (2 days). Mu last at 300, Kappa at 350; Omicron sold it cheapest, seven months ago.
      { id: 'c2', itemId: 'Q', kind: 'count', qty: 12, date: day(-10), at: 1, seq: 3 },
      { id: 'u2', itemId: 'Q', kind: 'used', qty: 10, days: 10, from: day(-10), date: day(-1), at: 2, seq: 2 },
      bill('o1', 'Q', day(-210), 20, 240, 'Omicron Salts', 'O/1'),
      bill('k090', 'Q', day(-30), 20, 350, 'Kappa & Brothers', 'K/090'),
      bill('m60', 'Q', day(-10), 50, 300, 'Mu Traders', 'M/60')],
    pastes: [] };
  // Mu takes 3 to 4 working days; Kappa delivers the same day, and is owed for a bill unpaid since before its balance's day.
  s.suppliers = [
    { id: 'SUP-mu', name: 'Mu Traders', names: [], leadMin: 3, leadMax: 4, at: 1 },
    { id: 'SUP-kappa', name: 'Kappa & Brothers', names: [], leadMin: 0, leadMax: 0, opening: { amount: 5000, date: day(-45) }, at: 1 }];
  return s;
}
const card = (page: Page, name: string) => page.locator('[data-supp-compare] [data-supp-cand]').filter({ has: page.locator('.inv-deck-title', { hasText: name }) });
async function reorder(page: Page) {
  await switchTab(page, 'pageStock');
  await toolbarMore(page, 'Reorder list');
}

test.describe('P209: compare suppliers when ordering', () => {
  test('a line’s suppliers side by side, for and against; the one picked is kept on the line, the app’s own said beside it', async ({ page }) => {
    await loadAppWithState(page, book());
    await reorder(page);
    // The list says who the brightener comes from and why; its door sets the suppliers side by side.
    const from = page.locator('[data-reorder-from="B"]').first();
    await expect(from).toContainText('Mu Traders: 3–4 working days, order by');
    await from.locator('[data-action="invSuppCompare"]').click();
    const dlg = page.locator('[data-supp-compare="B"]');
    await expect(dlg).toBeVisible();
    await expect(dlg.locator('[data-supp-cmp-ctx]')).toContainText('70 L on hand · 14 days left · ordering 120 L');
    // The app's pick first: the cheaper one, which comes before the line runs out.
    const cards = dlg.locator('[data-supp-cand]');
    await expect(cards).toHaveCount(2);
    await expect(cards.first()).toHaveAttribute('data-supp-cand', 'SUP-mu');
    const mu = card(page, 'Mu Traders'), kappa = card(page, 'Kappa & Brothers');
    await expect(mu.locator('.inv-deck-word')).toHaveText('The app’s pick');
    await expect(mu.locator('.inv-deck-fig')).toHaveText('₹186.00/L');
    await expect(mu.locator('[data-supp-pc="pro"]')).toContainText(['Cheapest: ₹19.00/L under Kappa & Brothers', 'Comes before the line runs out: order by']);
    await expect(mu.locator('[data-supp-pc="info"]')).toContainText(['One bill for this line on record']);
    await expect(mu).toHaveAttribute('data-tone', 'ok');
    await expect(mu.locator('[data-supp-cand-amount]')).toHaveAttribute('data-supp-cand-amount', '22320');
    // The one it last came from: dearer by so much on this order, the same day, bought from most, and owed past a month (the 5,000
    // set 45 days back and its three bills since: 7,080 + 7,257 + 8,260).
    await expect(kappa.locator('.inv-deck-word')).toHaveText('Last bought from');
    await expect(kappa.locator('[data-supp-pc="con"]')).toContainText(['₹19.00/L more than Mu Traders (₹2,280 on this order)', '₹27,597 owed to them, unpaid 45 days']);
    await expect(kappa.locator('[data-supp-pc="pro"]')).toContainText(['Delivers the same day', 'Bought from most: 2 bills for this line']);
    await expect(kappa).toHaveAttribute('data-tone', 'warning');

    // Ordering from Kappa: kept on the line, said on the list, the app's own beside it, and on the line's task.
    await kappa.locator('[data-action="invSuppPick"]').click();
    await expect(card(page, 'Kappa & Brothers').locator('.inv-deck-word')).toHaveText('Your pick · last bought');
    await expect(card(page, 'Kappa & Brothers').locator('.inv-deck-foot')).toContainText('Ordering from them');
    await expect(card(page, 'Mu Traders').locator('.inv-deck-word')).toHaveText('The app’s pick');
    expect((await readStoredState(page)).stock.items.find((i: any) => i.id === 'B').orderFrom).toMatchObject({ supplierId: 'SUP-kappa', name: 'Kappa & Brothers' });
    await page.locator('[data-supp-compare] [data-action="invCloseConfirm"]').last().click();
    await expect(page.locator('#stockReorder .inv-row-group').filter({ hasText: 'Kappa & Brothers' })).toBeVisible();
    await expect(page.locator('[data-reorder-from="B"]').first()).toContainText('Kappa & Brothers (your pick): same day');
    await expect(page.locator('[data-reorder-from="B"]').first()).toContainText('Your pick; the app would order from Mu Traders: ₹19.00 a unit less');
    const L = await ev(page, `stockReorderList().groups.map(function(g) { return [g.supplier, g.rows.map(function(r) { return [r.item.id, r.price]; })]; })`) as any[];
    expect(Object.fromEntries(L)['Kappa & Brothers']).toContainEqual(['B', 205]);
    expect(await ev(page, `(S.changeLog || []).some(function(e) { return e.coll === 'stock.items' && e.rid === 'B'; })`)).toBe(true);
    // Let the app pick again: back to Mu.
    await page.locator('[data-reorder-from="B"] [data-action="invSuppCompare"]').first().click();
    await page.locator('[data-supp-compare] [data-action="invSuppPick"][data-id=""]').click();
    expect((await readStoredState(page)).stock.items.find((i: any) => i.id === 'B').orderFrom).toBeUndefined();
    await expect(card(page, 'Mu Traders').locator('.inv-deck-word')).toHaveText('The app’s pick');
  });

  test('a price quoted weighs a supplier that never sold the line; the slow, the stale and the unknown said; the line’s page has the door', async ({ page }) => {
    await loadAppWithState(page, book());
    await switchTab(page, 'pageStock');
    await page.locator('#stockLines [data-action="invStockOpen"]').filter({ hasText: 'Salt Q' }).first().click();
    const row = page.locator('[data-stock-order-from]');
    // Two days left: Mu, last bought from, cannot come in time, so the app orders from Kappa the same day.
    await expect(row).toContainText('Kappa & Brothers: same day, order by');
    await row.locator('[data-action="invSuppCompare"]').click();
    const mu = card(page, 'Mu Traders');
    await expect(mu).toHaveAttribute('data-tone', 'danger');
    await expect(mu.locator('[data-supp-pc="con"]')).toContainText(['Takes 3–4 working days: the line runs out in 2 days']);
    // Sold cheapest, but seven months ago: said, never weighed as cheapest.
    const om = card(page, 'Omicron Salts');
    await expect(om.locator('[data-supp-pc="con"]')).toContainText(['Last bought ' ]);
    await expect(om.locator('[data-supp-pc="con"]').first()).toContainText('over six months ago: ask the price');
    await expect(om.locator('[data-supp-pc="con"]')).toContainText(['Lead time not set: when it comes is not known']);
    await expect(card(page, 'Mu Traders').locator('[data-supp-pc="pro"]')).toContainText(['Cheapest: ₹50.00/kg under Kappa & Brothers']);

    // A supplier that never sold it quotes 280: weighed beside the bills.
    await page.locator('[data-supp-compare] [data-action="invSuppQuoteForm"]').click();
    await page.locator('#suppQuoteSp').selectOption('+');
    await page.locator('#suppQuoteName').fill('Nu Chemicals');
    await page.locator('#suppQuotePrice').fill('280');
    await page.locator('[data-action="invSuppSaveQuote"]').click();
    const nu = card(page, 'Nu Chemicals');
    await expect(nu.locator('.inv-deck-word')).toHaveText('Quoted');
    await expect(nu.locator('.inv-deck-fig')).toHaveText('₹280.00/kg');
    await expect(nu.locator('[data-supp-pc="pro"]')).toContainText(['Cheapest: ₹20.00/kg under Mu Traders']);
    await expect(nu.locator('[data-supp-pc="con"]')).toContainText(['Lead time not set: when it comes is not known', 'Quoted only: never bought from them']);
    await expect(card(page, 'Mu Traders').locator('[data-supp-pc="con"]')).toContainText(['₹20.00/kg more than Nu Chemicals (₹560 on this order)']);
    const nuRec = (await readStoredState(page)).suppliers.find((r: any) => r.name === 'Nu Chemicals');
    expect(nuRec.quotes).toEqual([expect.objectContaining({ itemId: 'Q', price: 280, date: todayIso() })]);
    // With no lead time it is not the app's pick; set from its card (the supplier opens over the comparison), it comes in time.
    await nu.locator('[data-action="invSuppOpen"][data-form="set"]').click();
    await page.locator('#suppSetLeadMin').fill('1');
    await page.locator('#suppSetLeadMax').fill('1');
    await page.locator('[data-action="invSuppSaveSet"]').click();
    await page.locator('[data-supp-dialog] [data-action="invCloseConfirm"]').last().click();
    await expect(page.locator('[data-supp-compare]')).toBeVisible();
    await expect(card(page, 'Nu Chemicals').locator('[data-supp-pc="pro"]')).toContainText(['Comes before the line runs out: order by']);
    // The app orders from the fastest that comes in time when the last cannot; the cheaper one that also comes is the owner's to pick.
    await expect(card(page, 'Kappa & Brothers').locator('.inv-deck-word')).toContainText('The app’s pick');
    await card(page, 'Nu Chemicals').locator('[data-action="invSuppPick"]').click();
    await expect(card(page, 'Nu Chemicals').locator('.inv-deck-word')).toHaveText('Your pick');
    expect(await ev(page, `suppPickText(suppReorderPick(stockItem('Q'), suppDaysLeft(stockItem('Q'))))`)).toMatch(/^Nu Chemicals \(your pick\): 1 working day, order by /);

    // A price quoted is removed with a word; the supplier that only quoted leaves the comparison, and the pick with it.
    await page.locator('[data-supp-compare] [data-action="invSuppQuoteForm"]').click();
    await page.locator('[data-supp-quotes] [data-action="invSuppQuoteRemove"]').click();
    await answerAsk(page, 'ok');
    await page.locator('[data-supp-compare] [data-action="invSuppQuoteForm"][data-form=""]').click();
    await expect(card(page, 'Nu Chemicals')).toHaveCount(0);
    await expect(page.locator('[data-supp-compare] .inv-callout-warning')).toContainText('You chose Nu Chemicals for this line');
  });
});
