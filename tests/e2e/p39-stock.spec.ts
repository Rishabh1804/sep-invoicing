import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFileSync } from 'fs';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, recentTs, switchTab, todayIso, type SepState } from './fixtures';

// P39: the Stock tab. The supervisor's WhatsApp stock message is pasted in,
// read line by line, checked against its own arithmetic and the app's level,
// and saved as events that keep who sent them and the text they came from.
// The messages here are made up in the shop's shapes; real stock data is never
// committed (the repo is public).

const g = (page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr);

function dmy(offset: number): string {
  const d = new Date(todayIso() + 'T00:00:00');
  d.setDate(d.getDate() + offset);
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getFullYear()).slice(2) + '/';
}

const MSG1 = () => `[${dmy(0).slice(0, 8)}, 2:05 pm] Supervisor One: Chemical use chemical stock
${dmy(-6)}-${dmy(0)}

1) ZINK NIL 00

2) Q558 NIL

3) 16 SOLLT 40 KG

4) MONICOL 6-1=5 KG

5) BRIGHTNER 90 LTR 6 day 4×6=24use available 66LTR

6) NITRIC ACID add 50+20=70 LTR use 6 day 24 LTR available 70 LTR

7) HCL add 500 LTR
use ${dmy(-1)} 200 LTR available 300 LTR`;

const MSG2 = () => `Camical use camical stock ${dmy(1)} ${dmy(2)}

1) ZINK add ${dmy(2)} 400 kg use
berral & vat a1. 40 kg
available 360 kg

3) 16 SOLLT 55 KG

6) 46-6=40 LTR
.`;

function state(): SepState {
  const s = emptyState();
  s.incomingMaterial = noSeedIM();
  return s;
}

async function openStock(page: Page) {
  await switchTab(page, 'pageStock');
}

async function paste(page: Page, text: string) {
  await page.locator('[data-action="invStockPaste"]').click();
  await page.locator('#stockPasteText').fill(text);
  await page.locator('#stockBy').fill('Owner');
  await page.locator('[data-action="invStockRead"]').click();
}

test.describe('P39: stock', () => {
  test('the parser reads the shop\'s shorthand', async ({ page }) => {
    await loadAppWithState(page, state());
    const r = await g(page, `(function(){
      var p = parseStockMessage(${JSON.stringify(MSG1())});
      var o = { from: p.from, to: p.to, sentBy: p.sentBy, lines: {} };
      p.lines.forEach(function(l){ o.lines[l.key] = [l.O, l.A, l.U, l.C, l.unit, l.issues.length]; });
      var q = parseStockMessage(${JSON.stringify(MSG2())});
      o.second = q.lines.map(function(l){ return [l.n, l.key, l.O, l.A, l.U, l.C, l.addDate, l.note]; });
      return o;
    })()`);
    expect(r.sentBy).toBe('Supervisor One');
    expect(r.lines).toEqual({
      'ZINC': [null, null, null, 0, '', 0],
      'Q558': [null, null, null, 0, '', 0],
      '16 SALT': [null, null, null, 40, 'kg', 0],
      'MONICOL': [6, null, 1, 5, 'kg', 0],
      'BRIGHTENER': [90, null, 24, 66, 'L', 0],
      'NITRIC ACID': [20, 50, 24, 70, 'L', 0],
      'HCL': [null, 500, 200, 300, 'L', 0],
    });
    // A wrapped line keeps its note and its date; a line can arrive without a name.
    const iso = (s: string) => '20' + s.slice(6, 8) + '-' + s.slice(3, 5) + '-' + s.slice(0, 2);
    expect(r.second).toEqual([
      [1, 'ZINC', null, 400, 40, 360, iso(dmy(2)), 'berral vat a1'],
      [3, '16 SALT', null, null, null, 55, null, ''],
      [6, '', 46, null, 6, 40, null, ''],
    ]);
  });

  test('a pasted message is checked, then saved with who sent it and where it came from', async ({ page }) => {
    await loadAppWithState(page, state());
    await openStock(page);
    await expect(page.locator('.inv-stk-empty')).toBeVisible();
    await paste(page, MSG1());

    // Nitric contradicts itself: 20 + 50 − 24 is 46, the message says 70.
    const nitric = page.locator('.inv-stk-pr-red');
    await expect(nitric).toHaveCount(1);
    await expect(nitric).toContainText('20 + 50 − 24 is 46. The message says 70.');
    // HCl's delivery carries no date on a week-long take.
    await expect(page.locator('.inv-stk-pr-amber')).toContainText('Delivery date not stated');
    await expect(page.locator('#stockSentBy')).toHaveValue('Supervisor One');

    // Warn, never block: Save works before the question is answered.
    await expect(page.locator('[data-action="invStockSavePaste"]')).toBeEnabled();
    await page.locator('[data-action="invStockBal"][data-v="working"]').click();
    await expect(page.locator('.inv-stk-pr-red')).toHaveCount(0);
    await page.locator('[data-action="invStockSavePaste"]').click();

    const st = (await readStoredState(page)).stock;
    expect(st.items.map((i: any) => i.name)).toEqual(['Zinc', 'Q558', '16 Salt', 'Monicol', 'Brightener', 'Nitric Acid', 'HCL']);
    expect(st.pastes).toHaveLength(1);
    expect(st.pastes[0].text).toContain('NITRIC ACID add 50+20=70');
    const e = st.entries.find((x: any) => x.kind === 'count' && x.note === 'message said 70');
    expect(e.qty).toBe(46);
    expect(e.sentBy).toBe('Supervisor One');
    expect(e.by).toBe('Owner');
    expect(e.raw).toContain('available 70 LTR');

    // The list: Zinc is charged to the bath, not "out"; Q558 is out.
    await expect(page.locator('.inv-stk-sec').first()).toContainText('Out');
    await expect(page.locator('.inv-stk-row').filter({ hasText: 'Q558' })).toContainText('Out');
    await expect(page.locator('.inv-stk-row').filter({ hasText: 'Zinc' })).toContainText('Shelf empty');
    await expect(page.locator('.inv-stk-row').filter({ hasText: 'Brightener' })).toContainText('4 L/day');
    await expect(page.locator('#moreBadge')).toHaveText('1');

    // The same message twice is caught, and nothing is saved twice.
    await paste(page, MSG1());
    await expect(page.locator('.inv-stk-banner-red')).toContainText('already saved');
    await expect(page.locator('[data-action="invStockSavePaste"]')).toBeDisabled();
  });

  test('the next message: a nameless line by its position, a gain nobody explained', async ({ page }) => {
    await loadAppWithState(page, state());
    await openStock(page);
    await paste(page, MSG1());
    await page.locator('[data-action="invStockBal"][data-v="working"]').click();
    await page.locator('[data-action="invStockSavePaste"]').click();
    await paste(page, MSG2());

    const amber = page.locator('.inv-stk-pr-amber');
    await expect(amber.filter({ hasText: '6 · Nitric Acid' })).toContainText('No name on this line. Read as Nitric Acid');
    await expect(amber.filter({ hasText: '3 · 16 Salt' })).toContainText('Up 15 kg from the app\'s 40, with no delivery recorded.');
    // 46 carried from the chosen reading: the opening agrees, so no second question.
    await expect(amber.filter({ hasText: '6 · Nitric Acid' })).not.toContainText('Opening');
    await page.locator('[data-action="invStockSavePaste"]').click();

    const lv = await g(page, `(function(){ var o = {}; stockData().items.forEach(function(i){ o[i.name] = stockReplay(i.id).level; }); return o; })()`);
    expect(lv['Nitric Acid']).toBe(40);
    expect(lv['Zinc']).toBe(360);
    expect(lv['16 Salt']).toBe(55);
    // Zinc is charged into a bath, so its draw is a charge, not a use.
    expect(await g(page, `stockData().entries.filter(function(e){ return e.kind === 'charged'; }).map(function(e){ return [e.qty, e.note]; })`))
      .toEqual([[40, 'BARREL VAT A1']]);
  });

  test('by hand: a delivery with its price, a count that disagrees, and a void', async ({ page }) => {
    await loadAppWithState(page, state());
    await openStock(page);
    await paste(page, MSG1());
    await page.locator('[data-action="invStockSavePaste"]').click();

    await page.locator('[data-action="invStockManual"]').click();
    await page.locator('[data-action="invStockMode"][data-mode="received"]').click();
    const q558 = await g(page, `stockFindByKey('Q558').id`);
    await page.locator(`[data-stock-qty="${q558}"]`).fill('60');
    await page.locator(`[data-stock-price="${q558}"]`).fill('250');
    await page.locator('#stockManSupplier').fill('Supplier A');
    await page.locator('[data-action="invStockSaveManual"]').click();
    await expect(page.locator('.inv-stk-row').filter({ hasText: 'Q558' })).toContainText('60');

    await page.locator('[data-action="invStockManual"]').click();
    await page.locator(`[data-stock-qty="${q558}"]`).fill('55');
    await page.locator('[data-action="invStockSaveManual"]').click();
    await expect(page.locator('.inv-toast')).toContainText('1 count differs from the app');

    await page.locator('.inv-stk-row').filter({ hasText: 'Q558' }).click();
    await expect(page.locator('.inv-stk-hrow').first()).toContainText('The app expected 60 (-5 unexplained)');
    await expect(page.locator('.inv-stk-hero')).toContainText('Last paid');

    // A wrong entry is voided, never deleted, and stops counting.
    const voidBtn = page.locator('.inv-stk-hrow').first().locator('[data-action="invStockVoid"]');
    await voidBtn.click();
    await page.locator('.inv-stk-void-arm').click();
    await expect(page.locator('.inv-stk-hero-lv')).toContainText('60');
    const st = (await readStoredState(page)).stock;
    expect(st.entries.filter((e: any) => e.voided)).toHaveLength(1);
  });

  test('Stats costs chemicals from the stock record, and names what has no price', async ({ page }) => {
    const s: any = state();
    const t = todayIso();
    s.invoices = [{
      id: 'INV-1', invoiceNumber: '00001', displayNumber: 'SEP/T-00001', date: t, status: 'active', invoiceState: 'created',
      clientId: 1, clientName: 'TEST CLIENT KG', gstType: 'intra', clientAddress: { add1: '', add2: '', add3: '', state: 'JHARKHAND', stateCode: '20' },
      items: [{ partNumber: 'P', desc: 'P', unit: 'KG', qty: 1000, rate: 10, amount: 10000 }],
      taxableValue: 10000, cgstPer: 9, cgstAmt: 900, sgstPer: 9, sgstAmt: 900, igstPer: 0, igstAmt: 0,
      grandTotal: 11800, amountInWords: '', createdAt: recentTs(), updatedAt: recentTs(),
    }];
    s.stock = {
      items: [
        { id: 'A', name: 'Brightener', key: 'BRIGHTENER', unit: 'L', basis: 'draw', aliases: [] },
        { id: 'B', name: 'Q558', key: 'Q558', unit: 'kg', basis: 'draw', aliases: [] },
      ],
      entries: [
        { id: 'e1', itemId: 'A', kind: 'received', qty: 100, price: 200, date: t, at: 1, seq: 1 },
        { id: 'e2', itemId: 'A', kind: 'used', qty: 10, days: 1, date: t, at: 2, seq: 2 },
        { id: 'e3', itemId: 'B', kind: 'used', qty: 5, days: 1, date: t, at: 2, seq: 2 },
      ],
      pastes: [],
    };
    await loadAppWithState(page, s);
    await switchTab(page, 'pageStats');
    const card = page.locator('.inv-stats-card').filter({ hasText: 'Chemicals' });
    await expect(card).toContainText('₹2,000.00');
    await expect(card).toContainText('₹2.00/kg');
    await expect(card).toContainText('₹1.57/kg');
    await expect(card).toContainText('No price yet: Q558');
  });

  test('More holds Stock, Staff, Stats and History, and lights up while one is open', async ({ page }) => {
    await loadAppWithState(page, state());
    await expect(page.locator('.inv-tabs .inv-tab')).toHaveCount(6);
    await page.locator('.inv-tab-more').click();
    await expect(page.locator('.inv-more-item')).toHaveText([/Stock/, /Staff/, /Stats/, /History/]);
    await page.locator('.inv-more-item[data-tab="pageStaff"]').click();
    await expect(page.locator('#moreSheet')).toHaveCount(0);
    await expect(page.locator('#pageStaff')).toHaveClass(/inv-page-active/);
    await expect(page.locator('.inv-tab-more')).toHaveClass(/inv-tab-active/);
  });

  test('export carries the whole record; importing it again adds nothing', async ({ page }) => {
    await loadAppWithState(page, state());
    await openStock(page);
    await paste(page, MSG1());
    await page.locator('[data-action="invStockSavePaste"]').click();
    const dl = page.waitForEvent('download');
    await page.locator('[data-action="invStockExport"]').click();
    const file = await (await dl).path();
    const json = JSON.parse(readFileSync(file, 'utf8'));
    expect(json.format).toBe('sep-stock');
    expect(json.items).toHaveLength(7);
    expect(json.pastes).toHaveLength(1);
    expect(json.entries.every((e: any) => e.at && e.date && e.by === 'Owner')).toBe(true);
    const again = await g(page, `JSON.stringify(stockMergeImport(${JSON.stringify(json)}))`);
    expect(JSON.parse(again)).toEqual({ items: 0, entries: 0, pastes: 0 });
  });
});
