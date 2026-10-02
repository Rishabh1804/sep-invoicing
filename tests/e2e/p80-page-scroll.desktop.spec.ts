import { test, expect, type Page } from '@playwright/test';
import { loadAppWithState, switchTab, todayIso } from './fixtures';
import { sweepState } from './sweep-fixture';

// P80 (desktop): a screen laid out as a list and its pane fills exactly the room under its own head and toolbar, so
// the page itself never scrolls — the list and the pane each scroll inside themselves. The host was sized
// `100vh - the PHONE bar`, which ignored the page's padding, view tabs and toolbar above it: the whole page scrolled
// a little on top of the list, and the wheel moved the page instead of the list.
//
// Covered: every screen that draws an inv-pane-host (Register, IM, Clients → Clients and Items, Stock → Lines), with
// the pane closed and with a row's pane open. Those are the fill-the-viewport layouts; everything else (Home, Stats,
// Finance, Staff, To-do, History, Create, Clients → Performance, Stock → Overview) is an ordinary long document and is
// meant to scroll, so it is not checked here.

// `opened`: what shows once `row` is opened, where that is not a pane (the pipeline opens another stage's list beside it).
type Stop = { name: string; go: (page: Page) => Promise<void>; row: string; opened?: string };

const STOPS: Stop[] = [
  { name: 'Register', go: p => switchTab(p, 'pageRegister'), row: '#regMaster [data-action="invSelectRegRow"]' },
  { name: 'IM', go: p => switchTab(p, 'pageIM'), row: '#imMaster [data-action="invSelectIMRow"]' },
  {
    name: 'Clients › Clients',
    go: async p => { await switchTab(p, 'pageClients'); await p.locator('#pageClients .inv-viewtab[data-view="clients"]').click(); },
    row: '#clientsMaster [data-action="invSelectClientRow"]',
  },
  {
    name: 'Clients › Items',
    go: async p => { await switchTab(p, 'pageClients'); await p.locator('#pageClients .inv-viewtab[data-view="items"]').click(); },
    row: '#clientsMaster [data-action="invSelectItemRow"]',
  },
  {
    name: 'Clients › Quotations',
    go: async p => { await switchTab(p, 'pageClients'); await p.locator('#pageClients .inv-viewtab[data-view="quotes"]').click(); },
    row: '#qtMaster [data-action="invQtOpen"]',
  },
  {
    name: 'Stock › Lines',
    go: async p => { await switchTab(p, 'pageStock'); await p.locator('#pageStock .inv-viewtab[data-view="list"]').click(); },
    row: '#stockMasterDetail [data-action="invStockOpen"]',
  },
  // Office → Pipeline (P137): the pipeline beside the open stage's list.
  { name: 'Pipeline', go: p => switchTab(p, 'pagePipeline'), row: '#pagePipeline button[data-pipe-stage="dispatched"]', opened: '#pipeList [data-pipe-list="dispatched"]' },
];

async function measure(page: Page) {
  await page.evaluate(() => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res))));
  return page.evaluate(() => {
    const se = document.scrollingElement!;
    const host = document.querySelector('.inv-page-active .inv-pane-host') as HTMLElement | null;
    const pg = document.querySelector('.inv-page-active') as HTMLElement;
    const r = host ? host.getBoundingClientRect() : null;
    // What may sit under the host: the page's own bottom padding (and a selection bar, when rows are ticked).
    const below = parseFloat(getComputedStyle(pg).paddingBottom) +
      Array.from(pg.querySelectorAll(':scope > [id$="SelBar"]')).reduce((t, e) => t + (e as HTMLElement).offsetHeight, 0);
    return {
      pageOver: se.scrollHeight - se.clientHeight,
      hasHost: !!host,
      // The host's foot sits on the page's foot: it fills the room, it does not stop short of it or run past it.
      hostGap: r ? Math.round(innerHeight - r.bottom - below) : null,
      hostH: r ? Math.round(r.height) : 0,
    };
  });
}

for (const [w, h] of [[1280, 800], [1024, 768]] as const) {
  test(`at ${w}×${h} no list-and-pane screen scrolls the page, pane closed or open`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: w, height: h });
    await loadAppWithState(page, sweepState());
    const bad: string[] = [];
    for (const s of STOPS) {
      await s.go(page);
      const closed = await measure(page);
      expect(closed.hasHost, s.name + ' draws a list-and-pane host').toBe(true);
      if (closed.pageOver > 1) bad.push(`${s.name} (closed): page scrolls ${closed.pageOver}px`);
      if (closed.hostGap !== null && Math.abs(closed.hostGap) > 1) bad.push(`${s.name} (closed): host foot ${closed.hostGap}px from the viewport's`);
      const row = page.locator(s.row).first();
      await expect(row, s.name + ' has a row to open').toHaveCount(1);
      await row.evaluate(el => (el as HTMLElement).click());
      await expect(page.locator(s.opened || '.inv-page-active .inv-pane-host.inv-pane-open')).toHaveCount(1);
      const open = await measure(page);
      if (open.pageOver > 1) bad.push(`${s.name} (open): page scrolls ${open.pageOver}px`);
      if (open.hostGap !== null && Math.abs(open.hostGap) > 1) bad.push(`${s.name} (open): host foot ${open.hostGap}px from the viewport's`);
    }
    expect(bad).toEqual([]);
  });
}

test('the list scrolls inside itself and the wheel moves the list, not the page', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const s = sweepState();
  // Enough invoices that the register overflows its list.
  const base = (s.invoices as any[])[0];
  for (let i = 0; i < 60; i++) (s.invoices as any[]).push({ ...base, id: 'INV-X' + i, invoiceNumber: String(500 + i).padStart(5, '0'), displayNumber: 'SEP/TEST-X' + i, date: todayIso() });
  await loadAppWithState(page, s);
  await switchTab(page, 'pageRegister');
  const list = page.locator('#regMaster');
  expect(await list.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  await list.hover();
  // Past the list's end, a wheel chains to the page — which must have nowhere to go.
  for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 800); await page.waitForTimeout(100); }
  await page.waitForTimeout(300);
  expect(await list.evaluate(el => el.scrollTop + el.clientHeight >= el.scrollHeight - 2)).toBe(true);
  expect(await page.evaluate(() => document.scrollingElement!.scrollTop)).toBe(0);
});

test('content above the list taller than the screen lets the page scroll and keeps the list usable', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await loadAppWithState(page, sweepState());
  await switchTab(page, 'pageRegister');
  // A filter that opens tall: the host gives up room only down to its minimum, and the page scrolls to reach it.
  await page.evaluate(() => { const d = document.createElement('div'); d.id = 'p80Tall'; d.setAttribute('style', 'height:900px'); document.getElementById('regToolbar')!.appendChild(d); });
  let m = await measure(page);
  expect(m.hostH).toBeGreaterThanOrEqual(300);
  expect(m.pageOver).toBeGreaterThan(0);
  // Closed again, the host fills the room and the page is still.
  await page.evaluate(() => document.getElementById('p80Tall')!.remove());
  m = await measure(page);
  expect(m.pageOver).toBeLessThanOrEqual(1);
  expect(m.hostH).toBeGreaterThanOrEqual(300);
});

test('IM\'s challan form, which hides the list, reads as an ordinary page and gives the room back on Cancel', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await loadAppWithState(page, sweepState());
  await switchTab(page, 'pageIM');
  const before = await measure(page);
  await page.evaluate(() => (window as any).showAddChallanForm());
  await expect(page.locator('#imAddForm')).not.toBeEmpty();
  // The page is not held to the viewport while the host is hidden: the form lays out as a document.
  expect(await page.locator('#pageIM').evaluate(el => getComputedStyle(el).display)).toBe('block');
  await page.locator('#imAddForm [data-action="invCancelChallan"]').click();
  const after = await measure(page);
  expect(after.pageOver).toBeLessThanOrEqual(1);
  expect(after.hostH).toBe(before.hostH);
});
