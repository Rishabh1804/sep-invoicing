import { expect, type Page } from '@playwright/test';
import { loadAppWithState, emptyState, noSeedIM } from './fixtures';
import { longBook } from './load-fixture';
import { drawBoard } from './p224-widget-sweep.fixture';
import { geistReady } from './p235-family.fixture';

// P237 (UI pass 3, U2R; docs/UI_PASS_3.md §24h–§24i), shared by the phone and the desktop at 1280 and 1024 px: a card is exactly its
// size's height; every preset packs with no hole, packing on and off; a later card fills a hole an earlier one left, the DOM keeping
// the layout's order; arranging shows each hole as a slot whose Add here puts the widget there; wdgPlace says where the browser puts
// each card; the fit lets go of the optional parts, then a list's last rows, its More counting them and a Ledger's rest line their sum.

const grid = (page: Page) => page.evaluate(() => {
  const g = document.querySelector('#homeBoard .inv-wgrid') as HTMLElement, cs = getComputedStyle(g);
  return { row: parseFloat(cs.gridAutoRows), gap: parseFloat(cs.rowGap), cols: (window as any).wdgGridCols(g) };
});
/* Each card's place as the browser drew it: its row and column (1-based) from its box, and its spans. */
const placed = (page: Page) => page.evaluate(() => {
  const g = document.querySelector('#homeBoard .inv-wgrid') as HTMLElement, cs = getComputedStyle(g), gr = g.getBoundingClientRect();
  const row = parseFloat(cs.gridAutoRows), gap = parseFloat(cs.rowGap), cols = (window as any).wdgGridCols(g);
  const colW = (gr.width - parseFloat(cs.columnGap) * (cols - 1)) / cols, cgap = parseFloat(cs.columnGap);
  return Array.from(g.querySelectorAll(':scope > .inv-widget')).map(el => {
    const r = el.getBoundingClientRect();
    return { id: (el as HTMLElement).dataset.w, size: (el as HTMLElement).dataset.size, r: Math.round((r.top - gr.top) / (row + gap)) + 1, c: Math.round((r.left - gr.left) / (colW + cgap)) + 1,
      w: Math.round((r.width + cgap) / (colW + cgap)), h: Math.round((r.height + gap) / (row + gap)) };
  });
});

export async function sizesExact(page: Page) {
  await loadAppWithState(page, longBook());
  await geistReady(page);
  await drawBoard(page, [['mtd', 's'], ['q-money', 's'], ['cash', 'm'], ['owed', 'l']]);
  const g = await grid(page), phone = g.cols <= 2;
  const h = await page.locator('#homeBoard .inv-widget').evaluateAll(els => els.map(e => [(e as HTMLElement).dataset.size, e.getBoundingClientRect().height]));
  for (const [size, px] of h as Array<[string, number]>) {
    const rows = size === 's' ? 1 : size === 'l' && phone ? 3 : 2;
    expect(Math.abs(px - (rows * g.row + (rows - 1) * g.gap)), size + ' is ' + rows + ' rows').toBeLessThan(1);
  }
  // The rows are the tokens' (§24b): 172 px and a 16 px gap on a board of 6 or 12 columns, 168 and 12 on the phone's 2.
  expect([Math.round(g.row), Math.round(g.gap)]).toEqual(phone ? [168, 12] : [172, 16]);
}

/* Every preset as its layout draws it, packing on (dense) and off (arranging): no hole in either. */
export async function presetsWhole(page: Page) {
  await loadAppWithState(page, longBook());
  await geistReady(page);
  for (const p of ['owner', 'office', 'supervisor', 'floor']) {
    const list = await page.evaluate(p => {
      const w = window as any, ps = w.WDG_PRESETS[p], phone = w.wdgLay() === 'phone';
      return ps.home.map((x: string[]) => [x[0], w.wdgFitSize(w.wdgDef(x[0]), phone && x[1] !== 's' ? 'm' : x[1])]);
    }, p);
    await drawBoard(page, list);
    const g = await grid(page), at = await placed(page);
    const occ = new Set<string>();
    let rows = 0;
    for (const x of at) for (let r = x.r; r < x.r + x.h; r++) for (let c = x.c; c < x.c + x.w; c++) { occ.add(r + ':' + c); rows = Math.max(rows, r); }
    const holes: string[] = [];
    for (let r = 1; r <= rows; r++) for (let c = 1; c <= g.cols; c++) if (!occ.has(r + ':' + c)) holes.push(r + ':' + c);
    expect(holes, p + ' packed').toEqual([]);
    // Packing off: arranging places each card where wdgPlace says, and finds no hole to offer.
    await page.locator('#homeDash [data-action="invWdgArrange"]').click();
    await expect(page.locator('#homeBoard .inv-wboard[data-arranging]')).toHaveCount(1);
    await expect(page.locator('#homeBoard .inv-wgrid-slot'), p + ' arranged').toHaveCount(0);
    await page.locator('[data-action="invWdgDone"]').first().click();
  }
}

/* A hole an earlier card leaves is filled by a later one that fits it, the DOM keeping the layout's order; arranging, the hole is a
   slot, and Add here puts the widget picked there. */
export async function holesAndSlots(page: Page) {
  await loadAppWithState(page, longBook());
  await geistReady(page);
  const layout: Array<[string, string]> = [['pace', 'm'], ['mtd', 's'], ['coming', 'm'], ['cash', 's']];
  await drawBoard(page, layout);
  expect(await page.locator('#homeBoard .inv-widget').evaluateAll(els => els.map(e => (e as HTMLElement).dataset.w))).toEqual(layout.map(x => x[0]));
  const at = await placed(page), by = Object.fromEntries(at.map(x => [x.id, x]));
  // Cash, last in the order, stands in the row Month to date left room in, before What's coming.
  expect(by.cash.r).toBe(by.mtd.r);
  expect(by.cash.r).toBeLessThan(by.coming.r);
  // Without it the hole is a slot while arranging: Room for a Small, Add here.
  await drawBoard(page, layout.slice(0, 3));
  await page.locator('#homeDash [data-action="invWdgArrange"]').click();
  const slot = page.locator('#homeBoard .inv-wgrid-slot').first();
  await expect(slot).toContainText('Room for a Small');
  // wdgPlace says where the browser puts each card with packing off.
  const want = await page.evaluate(() => {
    const w = window as any, g = document.querySelector('#homeBoard .inv-wgrid') as HTMLElement, cols = w.wdgGridCols(g);
    const els = Array.from(g.querySelectorAll(':scope > .inv-widget'));
    return w.wdgPlace(els.map(e => w.wdgSpan((e as HTMLElement).dataset.size, cols)), cols).at.map((p: any) => [p.r, p.c]);
  });
  expect((await placed(page)).map(x => [x.r, x.c])).toEqual(want);
  await slot.locator('[data-action="invWdgAddHere"]').click();
  const gal = page.locator('.inv-dialog:has(.inv-gallery)');
  await expect(gal).toBeVisible();
  await gal.locator('[data-gallery-w="dtp"] [data-action="invWdgGalleryAdd"]').click();
  await expect.poll(() => page.evaluate(() => (window as any).wdgItems('home').map((x: string[]) => x[0]).indexOf('dtp'))).toBeGreaterThan(-1);
  const order = await page.evaluate(() => (window as any).wdgItems('home').map((x: string[]) => x[0]));
  expect(order.indexOf('dtp')).toBe(order.indexOf('mtd') + 1);
  expect(order.indexOf('dtp')).toBeLessThan(order.indexOf('coming'));
  if (await gal.isVisible()) await gal.locator('[data-action="invCloseOverlay"], .inv-dialog-close').first().click();
  if (await page.locator('#homeBoard .inv-wboard[data-arranging]').count()) await page.locator('[data-action="invWdgDone"]').first().click();
}

/* The fit: a card too full lets go of its optional parts, then its list's last rows; More counts them; a Ledger's rest line is their
   sum, so the lines still add up to the total ruled under them. */
/* `owedAt`: the size Owed lets its debts go at. A phone's Medium gives its room to the verdict, the age bar and its key, and lets the
   debts go whole (fitGivesBack): there the debts are a Large's. */
export async function fitLetsGo(page: Page, owedAt: 'm' | 'l' = 'm') {
  await loadAppWithState(page, longBook());
  await geistReady(page);
  await drawBoard(page, [['owed', owedAt], ['unbilled', 'm']]);
  const led = await page.evaluate(() => {
    const card = document.querySelector('#homeBoard .inv-widget[data-w="owed"]') as HTMLElement;
    const lines = Array.from(card.querySelectorAll('.inv-ledger > .inv-ledger-line')) as HTMLElement[];
    const shown = lines.filter(l => !l.hidden && !l.classList.contains('inv-ledger-total') && !l.classList.contains('inv-ledger-rest'));
    const hidden = lines.filter(l => l.hidden);
    const rest = card.querySelector('.inv-ledger-rest') as HTMLElement | null, total = card.querySelector('.inv-ledger-total') as HTMLElement | null;
    const num = (s: string) => Number(s.replace(/[^\d.−-]/g, '').replace('−', '-'));
    return { shown: shown.map(l => Number(l.dataset.amt)), hidden: hidden.map(l => Number(l.dataset.amt)), rest: rest ? rest.textContent : '', restAmt: rest ? num(rest.querySelector('.inv-ledger-amt')!.textContent || '') : 0,
      total: total ? Number(total.dataset.amt) : null, over: card.scrollHeight - card.clientHeight };
  });
  expect(led.hidden.length).toBeGreaterThan(0);
  expect(led.rest).toContain(led.hidden.length + ' more client');
  expect(Math.abs(led.restAmt - led.hidden.reduce((a, b) => a + b, 0))).toBeLessThan(1);
  expect(Math.abs(led.shown.reduce((a, b) => a + b, 0) + led.restAmt - (led.total as number))).toBeLessThan(0.5 * (led.shown.length + led.hidden.length));
  expect(led.over).toBeLessThanOrEqual(1);
  const dock = await page.evaluate(() => {
    const card = document.querySelector('#homeBoard .inv-widget[data-w="unbilled"]') as HTMLElement;
    const rows = Array.from(card.querySelectorAll('.inv-docket-row')) as HTMLElement[];
    const more = card.querySelector('[data-wdg-more]') as HTMLElement | null;
    return { hidden: rows.filter(r => r.hidden).length, more: more ? more.textContent : '', body: (card.querySelector('.inv-widget-body') as HTMLElement).scrollHeight - (card.querySelector('.inv-widget-body') as HTMLElement).clientHeight };
  });
  expect(dock.hidden).toBeGreaterThan(0);
  expect(dock.more).toContain(dock.hidden + ' more challan');
  expect(dock.body).toBeLessThanOrEqual(1);
  // An empty book has nothing to let go of: no More is drawn.
  await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM() });
  await drawBoard(page, [['owed', 'm'], ['unbilled', 'm']]);
  await expect(page.locator('#homeBoard [data-wdg-more]')).toHaveCount(0);
}

/* What the fit let go first comes back where a list's going freed the room it needs (UI pass 3 §24h): on a phone's Medium, Owed's
   debts all go, and its age key, cut first as a part it can do without, is drawn again under the bar, the card running past nothing. */
export async function fitGivesBack(page: Page) {
  await loadAppWithState(page, longBook());
  await geistReady(page);
  await drawBoard(page, [['owed', 'm']]);
  const r = await page.evaluate(() => {
    const card = document.querySelector('#homeBoard .inv-widget[data-w="owed"]') as HTMLElement;
    const seen = (el: Element | null) => !!el && (el as HTMLElement).getClientRects().length > 0;
    const key = card.querySelector('.inv-meter-key');
    const lines = Array.from(card.querySelectorAll('.inv-ledger > .inv-ledger-line:not(.inv-ledger-total, .inv-ledger-rest)'));
    return { key: seen(key), keyCut: !!key && key.hasAttribute('data-wdg-cut'), meter: seen(card.querySelector('.inv-meter')),
      linesShown: lines.filter(seen).length, over: card.scrollHeight - card.clientHeight };
  });
  expect(r.linesShown).toBe(0);
  expect(r.meter).toBe(true);
  expect(r.keyCut).toBe(false);
  expect(r.key).toBe(true);
  expect(r.over).toBeLessThanOrEqual(1);
}
