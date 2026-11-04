import { expect, type Page } from '@playwright/test';
import { loadAppWithState, switchTab, toolbarMore, readStoredState } from './fixtures';
import { longBook } from './load-fixture';
import { guardBook, withUsers, unlock, PINS } from './p140-guard.fixture';

// P229 (UI pass 3, U3; docs/UI_PASS_3.md §10, §26a; owner, 15 Oct 2026: "The stats page doesn't look like a stats page at all, we
// have stored and displayed our data on tables essentially"), shared by the phone and the desktop. Stats is two views: the
// Dashboard, a board of widgets each person arranges with Stats' own period, and the Tables, By client · By part · By month · Cost,
// sorted by a head, exported to CSV and Excel. One verdict leads both. The three tabs it replaced land where their cards went.
// The long book's made-up clients; every date from today.

const g = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);
const board = (page: Page) => page.locator('#statsBoard .inv-wboard[data-board="stats"]');
async function openStats(page: Page) {
  await switchTab(page, 'pageStats');
  await board(page).or(page.locator('#statsTable, #statsContent .inv-panel')).first().waitFor();
}
async function view(page: Page, v: 'board' | 'tables') {
  await page.locator(`#statsToolbar [data-action="invStatsTab"][data-tab="${v}"]`).click();
  await expect(page.locator(`#statsToolbar .inv-viewtab[aria-selected="true"][data-tab="${v}"]`)).toHaveCount(1);
}
async function table(page: Page, t: string) {
  await view(page, 'tables');
  await page.locator(`[data-stats-table] [data-action="invStatsTable"][data-table="${t}"]`).click();
  await expect(page.locator(`[data-stats-table] [data-table="${t}"][aria-pressed="true"]`)).toHaveCount(1);
}
const shown = (page: Page) => page.evaluate(() => Array.from(document.querySelectorAll('#statsBoard .inv-widget')).map(w => (w as HTMLElement).dataset.w));

/* Two views, the Dashboard first; one verdict and one toolbar row lead each; the Tables' switch under the row. */
export async function twoViews(page: Page, desktop: boolean) {
  const errs: string[] = [];
  page.on('pageerror', e => errs.push(e.message));
  await loadAppWithState(page, longBook());
  await openStats(page);
  await expect(page.locator('#statsToolbar .inv-viewtab')).toHaveText(['Dashboard', 'Tables']);
  await expect(page.locator('#statsToolbar .inv-viewtab[aria-selected="true"]')).toHaveAttribute('data-tab', 'board');
  expect(page.url()).toContain('v=board');
  await expect(page.locator('#pageStats [data-verdict]')).toHaveCount(1);
  await expect(page.locator('#statsVerdict')).toBeVisible();
  // The period's price against the live cost leads, and its four factors.
  await expect(page.locator('#statsVerdict [data-tile]')).toHaveCount(4);
  for (const t of ['revenue', 'tonnage', 'realisation', 'margin']) await expect(page.locator(`#statsVerdict [data-tile="${t}"]`)).toHaveCount(1);
  expect(await page.locator('#statsVerdict').innerText()).toMatch(/a kilo (over|under) the live cost|At the live cost/);
  // One toolbar row: the period, Customise and More.
  const tb = page.locator('[data-stats-toolbar]');
  await expect(tb.locator('[data-action="invStatsPeriod"]')).toHaveCount(4);
  await expect(tb.locator('[data-action="invWdgArrange"][data-board="stats"]')).toHaveCount(1);
  // Rows as P195 counts them: controls whose heights overlap stand on one row.
  const rows = await tb.evaluate(el => {
    let n = 0, bottom = -Infinity;
    Array.from(el.children).map(c => (c as HTMLElement).getBoundingClientRect()).filter(r => r.height > 0).sort((a, b) => a.top - b.top)
      .forEach(r => { if (r.top >= bottom - 1) { n++; bottom = r.bottom; } else bottom = Math.max(bottom, r.bottom); });
    return n;
  });
  expect(rows, 'the toolbar is one row').toBe(1);
  // Each widget on the board reads Stats' functions, none drawn as an error.
  const states = await page.locator('#statsBoard .inv-widget').evaluateAll(els => els.map(e => (e as HTMLElement).dataset.w + ':' + (e as HTMLElement).dataset.state));
  expect(states.filter(s => s.endsWith(':error'))).toEqual([]);
  // The board's foot opens the tables.
  await page.locator('[data-stats-foot] [data-action="invStatsTables"]').click();
  await expect(page.locator('#statsToolbar .inv-viewtab[aria-selected="true"]')).toHaveAttribute('data-tab', 'tables');
  await expect(page.locator('[data-stats-table] .inv-seg-btn')).toHaveText(['By client', 'By part', 'By month', 'Cost']);
  await expect(page.locator('#pageStats [data-verdict]')).toHaveCount(1);
  await expect(page.locator('#statsTable table[data-stats-tbl="client"]')).toHaveCount(1);
  expect(page.url()).toContain('v=tables%2Fclient');
  // The worst large account's breakdown under it: its judged tiles coded wells of their tones (HR-9, design §3.3), the plain one not.
  const worst = page.locator('#statsWorst [data-worst-tiles]');
  await expect(worst).toHaveCount(1);
  const bg = async (sel: string) => worst.locator(sel).first().evaluate(el => getComputedStyle(el).backgroundImage);
  expect(await bg('.inv-tile-danger')).toContain('gradient');
  expect(await bg('[data-tile="even"]')).not.toContain('gradient');
  await table(page, 'part');
  await expect(page.locator('#statsTable table[data-stats-tbl="part"]')).toHaveCount(1);
  await table(page, 'month');
  await expect(page.locator('#statsTable table[data-stats-tbl="month"] tbody tr')).toHaveCount(6);
  await table(page, 'cost');
  // Cost is the labour and the live cost as they were, its parts folding open with their sources.
  await expect(page.locator('#statsContent [data-card="labour"]')).toHaveCount(1);
  await expect(page.locator('#statsContent details[data-cost]').first()).toBeAttached();
  // Back walks the tables, then the views (a table is a place).
  await page.goBack();
  await expect(page.locator('[data-stats-table] [data-table="month"][aria-pressed="true"]')).toHaveCount(1);
  expect(errs).toEqual([]);
  void desktop;
}

/* The period is Stats' own: its chips move the verdict and every widget on its board (wdgPeriod('stats')); Home reads this month. */
export async function periodOwn(page: Page) {
  await loadAppWithState(page, longBook());
  await openStats(page);
  await expect(page.locator('#statsVerdict')).toContainText('Stats · MTD');
  await page.locator('[data-stats-toolbar] [data-action="invStatsPeriod"][data-period="qtd"]').click();
  await expect(page.locator('#statsVerdict')).toContainText('Stats · QTD');
  expect(await g(page, 'wdgPeriod("stats")')).toBe('qtd');
  expect(await g(page, 'wdgPeriod("home")')).toBe('mtd');
  // A widget's Source names the period it read.
  await expect(page.locator('#statsBoard .inv-widget[data-w="kilo"] .inv-widget-src')).toContainText('this quarter');
  await expect(page.locator('#statsBoard .inv-widget[data-w="clientprice"] .inv-widget-src')).toContainText('this quarter');
  // Home's board still reads this month.
  await switchTab(page, 'pageHome');
  await page.locator('#homeBoard').waitFor();
  expect(await g(page, 'wdgPeriod("home")')).toBe('mtd');
}

/* The owner's preset on Stats: its cards in order, about seven on the phone, packing with no hole on both layouts. */
export async function presetPacks(page: Page, desktop: boolean) {
  await loadAppWithState(page, longBook());
  await openStats(page);
  const ids = await shown(page);
  if (desktop) expect(ids).toEqual(['pricecost', 'kilo', 'share', 'clientprice', 'turn', 'dtp', 'owed', 'labour', 'corr', 'heat']);
  else expect(ids).toEqual(['pricecost', 'kilo', 'share', 'clientprice', 'turn', 'dtp', 'owed']);
  // No hole: every cell of the rows the cards cover is a card's (P237's rule, on Stats' board).
  const holes = await page.evaluate(() => {
    const grid = document.querySelector('#statsBoard .inv-wgrid') as HTMLElement;
    const cols = (getComputedStyle(grid).gridTemplateColumns || '').split(' ').filter(x => x && x !== 'none').length;
    const cards = Array.from(grid.querySelectorAll(':scope > .inv-widget')) as HTMLElement[];
    const gb = grid.getBoundingClientRect(), colW = (gb.width - (cols - 1) * parseFloat(getComputedStyle(grid).columnGap)) / cols;
    const rows: number[] = [];
    cards.forEach(c => { const r = c.getBoundingClientRect(); rows.push(Math.round(r.top)); });
    const byRow: Record<number, number> = {};
    // Width taken at each distinct top, in columns; a row not full is a hole unless a taller card from above stands in it.
    const spans = cards.map(c => { const r = c.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), w: Math.round((r.width + parseFloat(getComputedStyle(grid).columnGap)) / (colW + parseFloat(getComputedStyle(grid).columnGap))) }; });
    const tops = Array.from(new Set(spans.map(s => s.top))).sort((a, b) => a - b);
    tops.forEach(t => { byRow[t] = spans.filter(s => s.top <= t + 1 && s.bottom > t + 1).reduce((n, s) => n + s.w, 0); });
    return tops.filter(t => byRow[t] < cols).map(t => t + ': ' + byRow[t] + ' of ' + cols);
  });
  expect(holes, 'the board packs with no hole').toEqual([]);
}

/* Customise arranges Stats' own layout, kept per board: a change on Stats leaves Home's as it was, and Reset asks. */
export async function arrangeOwn(page: Page) {
  await loadAppWithState(page, longBook());
  const homeBefore = await g(page, 'JSON.stringify(wdgItems("home"))');
  await openStats(page);
  await page.locator('[data-stats-toolbar] [data-action="invWdgArrange"]').click();
  await expect(page.locator('#statsBoard .inv-wboard[data-arranging]')).toHaveCount(1);
  await expect(page.locator('[data-stats-toolbar][data-arranging] [data-action="invWdgDone"]')).toHaveCount(1);
  await page.locator('#statsBoard .inv-widget[data-w="kilo"] [data-action="invWdgRemove"]').click();
  await page.locator('[data-stats-toolbar] [data-action="invWdgDone"]').click();
  await expect(page.locator('#statsBoard .inv-wboard[data-arranging]')).toHaveCount(0);
  expect(await shown(page)).not.toContain('kilo');
  expect(await g(page, 'wdgCustom("stats")')).toBe(true);
  expect(await g(page, 'JSON.stringify(wdgItems("home"))')).toBe(homeBefore);
  // Kept across a reload, never in the book.
  await page.reload();
  await page.locator('body.inv-booted').waitFor();
  await openStats(page);
  expect(await shown(page)).not.toContain('kilo');
  const st = await readStoredState(page);
  expect(JSON.stringify(st)).not.toContain('sep_inv_layout');
  // Leaving Stats while arranging ends it.
  await page.locator('[data-stats-toolbar] [data-action="invWdgArrange"]').click();
  await switchTab(page, 'pageHome');
  expect(await g(page, 'wdgArrangeOn("stats")')).toBe(false);
}

/* The gallery offers Stats' board beside Home's, and adds there; a role that does not open Stats is offered no Stats board. */
export async function galleryBoards(page: Page) {
  await loadAppWithState(page, longBook());
  await openStats(page);
  await page.locator('[data-stats-foot] [data-action="invWdgGallery"]').click();
  const seg = page.locator('[data-wdg-gallery] [data-action="invWdgGalleryBoard"]');
  await expect(seg).toHaveCount(2);
  await expect(page.locator('[data-wdg-gallery] [data-action="invWdgGalleryBoard"][data-board="stats"]')).toHaveAttribute('aria-pressed', 'true');
  // The seven U3 widgets are in it, each on its own card.
  for (const id of ['pricecost', 'share', 'labour', 'months', 'trend', 'topitems', 'costcheck']) await expect(page.locator(`[data-gallery-w="${id}"]`)).toHaveCount(1);
  await page.locator('[data-gallery-w="months"] [data-action="invWdgGalleryAdd"]').click();
  await page.locator('[data-wdg-gallery] [data-action="invWdgGalleryDone"]').last().click();
  expect(await shown(page)).toContain('months');
  // On Home's board it is not.
  expect(await g(page, 'wdgItems("home").some(function(x) { return x[0] === "months"; })')).toBe(false);
  // An office ID with no Stats: Home's gallery has one board, and no Stats widget.
  await loadAppWithState(page, guardBook());
  await withUsers(page);
  await unlock(page, 'U-off', PINS.office);
  expect(await g(page, 'wdgBoardSeen("stats")')).toBe(false);
  expect(await g(page, 'wdgBoardSeen("home")')).toBe(true);
  expect(await g(page, 'wdgSees(wdgDef("pricecost"))')).toBe(false);
}

/* The tables: a head sorts by its column, again the other way, said on the head (aria-sort); a client's row opens the client. */
export async function tablesSort(page: Page) {
  await loadAppWithState(page, longBook());
  await openStats(page);
  await page.locator('[data-action="invStatsPeriod"][data-period="ytd"]').click();
  await table(page, 'client');
  const t = page.locator('#statsTable table[data-stats-tbl="client"]');
  // The default: worst priced first (vs full, rising).
  await expect(t.locator('th[aria-sort]')).toHaveCount(1);
  await expect(t.locator('th[aria-sort="ascending"] button')).toContainText('vs full');
  const rev = async () => t.locator('tbody tr[data-client-row]').evaluateAll(rs => rs.map(r => Number(((r.children[1] as HTMLElement).innerText || '').replace(/[^\d.]/g, ''))));
  await t.locator('[data-action="invStatsSort"][data-col="rev"]').click();
  await expect(t.locator('th[aria-sort="descending"] button')).toContainText('Revenue');
  const down = await rev();
  expect(down.length).toBeGreaterThan(1);
  expect(down).toEqual(down.slice().sort((a, b) => b - a));
  await page.locator('#statsTable [data-action="invStatsSort"][data-col="rev"]').click();
  await expect(page.locator('#statsTable th[aria-sort="ascending"] button')).toContainText('Revenue');
  const up = await rev();
  expect(up).toEqual(up.slice().sort((a, b) => a - b));
  // By part, by its price a kilo.
  await table(page, 'part');
  await page.locator('#statsTable [data-action="invStatsSort"][data-col="perKg"]').click();
  await expect(page.locator('#statsTable th[aria-sort] button')).toContainText('₹/kg');
}

/* The exports: the table on show as CSV, every table as one workbook, each from the rows on screen in their order. */
export async function exportsWork(page: Page) {
  await loadAppWithState(page, longBook());
  await openStats(page);
  await page.locator('[data-action="invStatsPeriod"][data-period="ytd"]').click();
  await table(page, 'client');
  const names = await page.locator('#statsTable tbody tr[data-client-row] .inv-row-title').allInnerTexts();
  const [csv] = await Promise.all([page.waitForEvent('download'), toolbarMore(page, 'Export this table (CSV)')]);
  expect(csv.suggestedFilename()).toMatch(/^sep-stats-client-ytd-\d{4}-\d{2}-\d{2}\.csv$/);
  const text = (await (await import('fs')).promises.readFile(await csv.path() as string, 'utf8')).replace(/^﻿/, '');
  const lines = text.split('\n');
  expect(lines[0]).toBe('Client,Revenue,Of revenue,t,Weighed,Of tonnes,₹/kg,vs var.,vs full,₹ on period,Next challan');
  // A client's figures in the file are its row's on screen (Iuno): its revenue to the paisa.
  const first = await page.locator('#statsTable tbody tr[data-client-row]').first().locator('td').nth(1).innerText();
  expect(Number(lines[1].split(',')[1])).toBe(Number(first.replace(/[^\d.]/g, '')));
  expect(lines.slice(1).map(l => l.split(',')[0].replace(/^"|"$/g, ''))).toEqual(names);
  const [xl] = await Promise.all([page.waitForEvent('download'), toolbarMore(page, 'Export the tables (Excel)')]);
  expect(xl.suggestedFilename()).toMatch(/\.xlsx$/);
  const buf = await (await import('fs')).promises.readFile(await xl.path() as string);
  // A stored zip: its workbook part names the four sheets.
  const s = buf.toString('latin1');
  for (const n of ['By client', 'By part', 'By month', 'Cost']) expect(s).toContain('name="' + n + '"');
}

/* Every old place lands where its cards went: an address, the device's remembered tab, and a task saved naming a tab. */
export async function oldPlaces(page: Page) {
  await loadAppWithState(page, longBook());
  for (const [v, want, tbl] of [['clients', 'tables', 'client'], ['cost', 'tables', 'cost'], ['trends', 'board', '']] as const) {
    await page.goto('/sep-invoicing.html?tab=pageStats&v=' + v);
    await page.locator('body.inv-booted').waitFor();
    await expect(page.locator('#pageStats.inv-page-active')).toHaveCount(1);
    await expect(page.locator(`#statsToolbar .inv-viewtab[aria-selected="true"][data-tab="${want}"]`)).toHaveCount(1);
    if (tbl) await expect(page.locator(`[data-stats-table] [data-table="${tbl}"][aria-pressed="true"]`)).toHaveCount(1);
    expect(page.url()).toContain(want === 'board' ? 'v=board' : 'v=tables%2F' + tbl);
  }
  // A tab remembered on the device from before (sep_inv_stats_tab = cost).
  await page.evaluate(() => { localStorage.setItem('sep_inv_stats_tab', 'clients'); localStorage.removeItem('sep_inv_stats_table'); });
  await switchTab(page, 'pageHome');
  await switchTab(page, 'pageStats');
  await expect(page.locator('#statsToolbar .inv-viewtab[aria-selected="true"][data-tab="tables"]')).toHaveCount(1);
  await expect(page.locator('[data-stats-table] [data-table="client"][aria-pressed="true"]')).toHaveCount(1);
  // A saved task's jump naming an old tab.
  await switchTab(page, 'pageHome');
  await g(page, 'todoGo({ kind: "stats", tab: "trends" })');
  await expect(page.locator('#statsToolbar .inv-viewtab[aria-selected="true"][data-tab="board"]')).toHaveCount(1);
  await g(page, 'todoGo({ kind: "stats", tab: "cost" })');
  await expect(page.locator('[data-stats-table] [data-table="cost"][aria-pressed="true"]')).toHaveCount(1);
  // The live cost's move (advice.js) opens the Tables' Cost with its part open.
  await g(page, 'advGoTo({ kind: "liveCost", key: "labour" })');
  await expect(page.locator('[data-stats-table] [data-table="cost"][aria-pressed="true"]')).toHaveCount(1);
  // A widget's head opens its table.
  await view(page, 'board');
  await page.locator('#statsBoard .inv-widget[data-w="clientprice"] [data-action="invWdgGo"]').click();
  await expect(page.locator('[data-stats-table] [data-table="client"][aria-pressed="true"]')).toHaveCount(1);
}

/* The seven U3 widgets, each drawn at every size it allows on the long book, as Ledgers, trends (never edged), and none an error. */
export async function u3Widgets(page: Page) {
  await loadAppWithState(page, longBook());
  await openStats(page);
  await page.locator('[data-action="invStatsPeriod"][data-period="ytd"]').click();
  // One board a size: a board holds a widget once.
  for (const size of ['s', 'm', 'l']) {
    const list = await g(page, `['pricecost','share','labour','months','trend','topitems','costcheck'].filter(function(id) { return wdgDef(id).sizes.indexOf('${size}') >= 0; })
      .map(function(id) { return [id, '${size}']; })`) as Array<[string, string]>;
    await g(page, `wdgItemsPut('stats', wdgLay(), ${JSON.stringify(list)}); renderStats();`);
    await page.waitForTimeout(100);
    const cards = await page.locator('#statsBoard .inv-widget').evaluateAll(els => els.map(e => {
      const c = e as HTMLElement;
      return { id: c.dataset.w + '@' + c.dataset.size, type: c.dataset.type, state: c.dataset.state, trend: c.hasAttribute('data-trend'), over: c.scrollHeight - c.clientHeight };
    }));
    expect(cards.length).toBe(list.length);
    for (const c of cards) {
      expect(c.type, c.id).toBe('ledger');
      expect(c.state, c.id).not.toBe('error');
      if (c.state === 'ok') expect(c.trend, c.id + ' is a trend').toBe(true);
      expect(c.over, c.id + ' runs past its size').toBeLessThanOrEqual(1);
    }
  }
  await g(page, `wdgItemsPut('stats', wdgLay(), [['pricecost', 'l'], ['months', 'l'], ['trend', 'l']]); renderStats();`);
  await page.waitForTimeout(100);
  // Price against cost draws its two lines; Top parts its ranked bars; Six months a row a month.
  await expect(page.locator('#statsBoard .inv-widget[data-w="pricecost"] .inv-widget-viz svg').first()).toBeAttached();
  await expect(page.locator('#statsBoard .inv-widget[data-w="months"] [data-wc-months]').first()).toBeAttached();
  // Trend's Choose (Large) changes its series and is kept with the layout.
  const ch = page.locator('#statsBoard .inv-widget[data-w="trend"][data-size="l"] [data-action="invWdgChoose"][data-v="tonnage"]');
  await ch.click();
  await expect(page.locator('#statsBoard .inv-widget[data-w="trend"][data-size="l"] .inv-widget-say')).toContainText('Plated and billed');
  expect(await g(page, 'wdgOpts("stats", "trend").choose')).toBe('tonnage');
}

/* The QA chain's (4 Nov 2026). Castor H-1: the labour card is wages, drawn on the Tables' Cost only for an ID that sees them; the
   labour widget agrees with it to the paisa. Iuno H-1: what the period left after the full cost is its whole revenue less its whole
   cost. Vulcanus H-1: Top parts names a part with its gauge. */
export async function qaChain(page: Page) {
  await loadAppWithState(page, longBook());
  await openStats(page);
  await page.locator('[data-action="invStatsPeriod"][data-period="all"]').click();
  // The widget's ₹ a kilo is the labour card's measured tile.
  await g(page, `wdgItemsPut('stats', wdgLay(), [['labour', 'm'], ['topitems', 'l']]); renderStats();`);
  const w = (await page.locator('#statsBoard .inv-widget[data-w="labour"] .inv-widget-fig').innerText()).replace(/[^\d.]/g, '');
  await table(page, 'cost');
  const card = (await page.locator('#statsContent [data-card="labour"] [data-tile="perkg"] .inv-tile-value').innerText()).replace(/[^\d.]/g, '');
  expect(w).toBe(card);
  // Left after the full cost: the period's revenue less its whole live cost.
  const want = await g(page, `(function(){ var a = statsPulseArgs('all'), r = statsRangeIso('all'), c = liveCost(r.from, r.to, a.tonnage.kg); return gstRound(sumTaxable(a.filtered) - c.total); })()`) as number;
  const tile = (await page.locator('#statsVerdict [data-tile="margin"] .inv-tile-value').innerText()).replace(/[^\d.\u2212-]/g, '').replace('\u2212', '-');
  expect(Number(tile)).toBeCloseTo(want, 2);
  // Top parts names each part as By part does, its gauge with it.
  await view(page, 'board');
  const labels = await page.locator('#statsBoard .inv-widget[data-w="topitems"] .inv-chart-ranked-label').allInnerTexts();
  const want2 = await g(page, `buildTopItems(statsPulseArgs('all').filtered, 'value').rows.map(statsPartLabel)`) as string[];
  expect(labels.length).toBeGreaterThan(0);
  expect(labels.map(x => x.trim())).toEqual(want2.slice(0, labels.length));
}
export async function noWagesNoLabour(page: Page) {
  await loadAppWithState(page, guardBook());
  await g(page, `(function(){ var S0 = (0, eval)('S'); S0.guardCfg = S0.guardCfg || {}; S0.guardCfg.roles = S0.guardCfg.roles || {};
    S0.guardCfg.roles.office = { pages: ['pageHome', 'pageCreate', 'pageIM', 'pageRegister', 'pageClients', 'pagePipeline', 'pageStats'], may: ['billing'], wages: false, finance: true }; saveState(); })()`);
  await withUsers(page);
  await unlock(page, 'U-off', PINS.office);
  expect(await g(page, 'wdgSees(wdgDef("labour"))')).toBe(false);
  expect(await g(page, 'wdgSees(wdgDef("kilo"))')).toBe(true);
  await page.goto('/sep-invoicing.html?tab=pageStats&v=tables/cost');
  await page.locator('body.inv-booted').waitFor();
  if (await page.locator('#guardRoot').count()) await unlock(page, 'U-off', PINS.office);
  await expect(page.locator('#pageStats.inv-page-active')).toHaveCount(1);
  await expect(page.locator('#statsContent [data-card="labour"]')).toHaveCount(0);
  await expect(page.locator('#statsContent [data-card="labour-hidden"]')).toHaveCount(1);
  await expect(page.locator('#statsContent #liveCost')).toHaveCount(1);
}
