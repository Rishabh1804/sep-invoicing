import { Page, expect } from '@playwright/test';

export const STORAGE_KEY = 'sep_invoicing_state';

export type SepState = {
  company?: Record<string, string>;
  clients: Array<{ id: number; name: string; billingMode?: string; gstType?: string; gstin?: string; address?: string }>;
  items: unknown[];
  partWeights: Record<string, unknown>;
  incomingMaterial: unknown[];
  invoices: unknown[];
  voidedNumbers?: unknown[];
  staff?: unknown[];
  attendance?: Record<string, unknown>;
  labour?: { otMult?: number; restCreditMinDays?: number; extraRate?: number; modelPerKg?: number };
  defaultCostPerKg?: number;
  invPrefix?: string;
  invNextNum?: number;
  bankDetails?: string;
  sellerGstin?: string;
  sellerName?: string;
  sellerAddress?: string;
  _nosQtySeeded?: boolean;
  _scanSeed1?: boolean;
};

export const emptyState = (): SepState => ({
  // loadAppWithState replaces the whole state object, so anything the app reads
  // unguarded has to be present. `formatInvoiceData` dereferences S.company.name
  // directly — without this, opening any invoice detail throws before it renders.
  company: {
    name: 'SOMA ELECTRO PRODUCTS', add1: 'Test Address', add2: 'Jamshedpur', add3: '',
    phone: '', mobile: '', email: '', gstin: '20AAPFS4718J2Z0',
    state: 'JHARKHAND', stateCode: '20',
  },
  clients: [
    { id: 1, name: 'TEST CLIENT KG', billingMode: 'kg', gstType: 'intra', gstin: '', address: '' },
  ],
  items: [],
  partWeights: {},
  incomingMaterial: [],
  invoices: [],
  defaultCostPerKg: 5.46,
  invPrefix: 'SEP/TEST-',
  invNextNum: 1,
  _nosQtySeeded: true,
  _scanSeed1: true,
});

/**
 * Today as YYYY-MM-DD, local time.
 *
 * Seeded invoices must carry a current-period date or they are filtered out of
 * the views under test: the Register filters on `regFilter.month`, which
 * defaults to the current month, and Stats defaults to `mtd`. A hardcoded date
 * makes a test pass only during the month it was written.
 */
/**
 * A placeholder challan that keeps `seed.js` from filling the fixture.
 *
 * `seed.js` seeds 50 demo challans whenever `S.incomingMaterial` is empty —
 * there is no one-time flag on it, only the emptiness test. So a state with
 * `incomingMaterial: []` does not stay empty, and any spec that asserts on
 * challan-derived data without setting its own gets 50 rows for client 1 that
 * it never asked for. Same shape of trap as a hardcoded date: the fixture is
 * not what it appears to be.
 *
 * The entry belongs to a client id no spec uses, so views scoped to a client
 * never show it.
 */
export const SEED_BLOCKER_CLIENT_ID = 9999;

export function noSeedIM(): unknown[] {
  return [{
    id: 'IM-SEED-BLOCK',
    challanNo: '',
    challanDate: todayIso(),
    clientId: SEED_BLOCKER_CLIENT_ID,
    clientName: 'UNUSED',
    items: [],
    receivedDate: todayIso(),
    notes: '',
    createdAt: 0,
  }];
}

/**
 * The last `count` working days (Mon–Sat), newest first, ending today or the
 * most recent working day before it.
 *
 * Labour coverage is measured as recorded working days over working days in
 * range, so a fixture that seeds Sundays or that skips a Tuesday does not read
 * as 100% covered — and the ₹/kg it is testing is then withheld for a reason
 * the spec never asked about. Same class of trap as a hardcoded date.
 */
export function workingDaysBack(count: number): string[] {
  const out: string[] = [];
  const d = new Date();
  while (out.length < count) {
    if (d.getDay() !== 0) {
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
    d.setDate(d.getDate() - 1);
  }
  return out;
}

export function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Today, or the last day before it that is an ordinary working day: not a Sunday and not one of the paid national
 * holidays (labour.js LABOUR_HOLIDAYS: 26 Jan, 15 Aug, 2 Oct). A worked holiday is paid like a Sunday, with no
 * overtime, so a labour spec dated "today" failed every 2 October (P24, P145 on 2 Oct 2026).
 */
export function workdayIso(): string {
  const d = new Date(todayIso() + 'T00:00:00');
  const iso = () => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  while (d.getDay() === 0 || ['01-26', '08-15', '10-02'].includes(iso().slice(5))) d.setDate(d.getDate() - 1);
  return iso();
}

/**
 * A timestamp guaranteed to sit inside the current month-to-date window.
 *
 * `filterByPeriod(…, 'mtd')` compares `createdAt` against midnight on the 1st,
 * so an offset like `Date.now() - 2 days` silently falls out of range on the
 * 1st and 2nd of every month. Clamps to the start of the month rather than
 * walking backwards past it.
 */
export function recentTs(msAgo = 0): number {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return Math.max(now.getTime() - msAgo, monthStart);
}

/* The app boots asynchronously — the store is IndexedDB — and adds
   `inv-booted` to <body> once S exists and the first render is done. Nothing
   that touches state may run before this. */
export async function waitForBoot(page: Page): Promise<void> {
  await page.waitForSelector('body.inv-booted', { state: 'attached' });
}

/* Seeds through the LEGACY localStorage key, which the app migrates into
   IndexedDB on a boot that finds the new store empty — so every spec also
   exercises that migration. The init script re-runs on each navigation, but a
   populated store wins over the legacy key, so a reload keeps whatever the test
   changed rather than restoring the fixture. A second call on the same page
   clears the store first so the new fixture is the one that loads. */
export async function loadAppWithState(page: Page, state: SepState): Promise<void> {
  if (!page.url().startsWith('about:')) {
    // A fresh device: the database and the marker that this device kept its book there (without the marker gone too, an
    // empty database is a book the browser threw away, and the app starts on a stand-in).
    await page.evaluate(() => new Promise<void>(resolve => {
      try { localStorage.removeItem('sep_inv_idb_used'); } catch { /* none */ }
      try {
        const q = indexedDB.deleteDatabase('sep-invoicing');
        q.onsuccess = q.onerror = q.onblocked = () => resolve();
      } catch { resolve(); }
    }));
  }
  await page.addInitScript(
    ([key, value]) => { localStorage.setItem(key as string, value as string); },
    [STORAGE_KEY, JSON.stringify(state)] as const,
  );
  await page.goto('/');
  await waitForBoot(page);
}

/* The state as the store holds it — what a reload would load. */
export async function readStoredState(page: Page): Promise<any> {
  return page.evaluate(async () => JSON.parse((await (window as any).readPersistedStateRaw()) || '{}'));
}

/** Stats is grouped into tabs (By client, Cost, Trends; the tab map, TM2: Overview's cards are Pulse's, Billing's dispatch cycle
 *  Pipeline's): open one by its id (`clients`, `cost`, `trends`). */
export async function openStatsTab(page: Page, tab: string): Promise<void> {
  await switchTab(page, 'pageStats');
  await page.locator(`[data-action="invStatsTab"][data-tab="${tab}"]`).click();
  await page.locator(`#statsToolbar .inv-viewtab[aria-selected="true"][data-tab="${tab}"]`).waitFor();
}

/* The workspaces (DIRECTION_B), restated from split/workspace.js WORKSPACES: which workspace holds each page. The phone
   bar and the desktop's rail carry Today, Office, Floor and Money. The tab map (9 Oct 2026): Today holds its Insights (Stats,
   Reports, the Planner); History and Knowledge are tools in the top bar and belong to no workspace. Create is held without a
   tab; the To-do joined Needs you (TM2). */
const WS_OF: Record<string, string> = {
  pageHome: 'today', pageStats: 'today', pageReports: 'today', pagePlanner: 'today',
  pagePipeline: 'office', pageIM: 'office', pageRegister: 'office', pageClients: 'office', pageCreate: 'office',
  pageFloor: 'floor', pageStaff: 'floor', pageProduction: 'floor', pageStock: 'floor', pagePower: 'floor',
  pageFinance: 'money',
};

export async function switchTab(page: Page, tabId: string): Promise<void> {
  // A visible door to the page: a workspace's tab, a sidebar entry, a link on the screen (Home's "View challans"). Any
  // one works; the first is taken, so the helper is layout-agnostic.
  const door = () => page.locator(`[data-action="invSwitchTab"][data-tab="${tabId}"]:visible`);
  const active = page.locator(`#${tabId}.inv-page-active`);
  // History is the top bar's (its clock, on both layouts).
  if (tabId === 'pageHistory' && !(await active.count())) {
    const tool = page.locator('.inv-topbar [data-action="invGoHistory"]:visible');
    if (await tool.count()) { await tool.first().click(); await active.waitFor(); return; }
  }
  let opened = false;
  if ((await door().count()) === 0) {
    // None on screen: open the page's workspace (its bar item on the phone, its head in the sidebar), whose tab row then
    // shows. The open workspace's own item would go to its first view, so it is not pressed.
    const ws = WS_OF[tabId];
    const here = await page.evaluate(() => (window as any).wsOf((document.querySelector('.inv-page-active') || {}).id));
    const item = page.locator(`[data-action="invWsGo"][data-ws="${ws}"]:visible`);
    if (ws && ws !== here && (await item.count())) {
      await item.first().click();
      await page.locator('.inv-page-active').first().waitFor();
      opened = true;
    }
  }
  if (opened && (await active.count())) { /* the workspace opened on the page itself (Money, Today) */ }
  else if (await door().count()) await door().first().click();
  else {
    // The last resort, where the shell has no door to the page: the page a workspace holds without a tab (Create) when
    // nothing on screen links to it. Opened the way a jump opens them, then recorded as a click's step would be.
    await page.evaluate(id => { (window as any).switchTab(id); (window as any).navSoon(); }, tabId);
  }
  await active.waitFor();
}

/** Today → Pulse (DIRECTION_B, B3): Home's cards (the month to date, money, attendance, sync, zinc, recent invoices, quick
 *  actions) are Pulse's widgets now, drawn only while it shows. Opens Today first when another page is on screen, then
 *  presses its Pulse tab the way the operator does. */
export async function openPulse(page: Page): Promise<void> {
  if (!(await page.locator('#pageHome.inv-page-active').count())) await switchTab(page, 'pageHome');
  const tab = page.locator('#wsTabs [data-v="pulse"]');
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click();
  await page.locator('#homePulse:not(.inv-hidden)').waitFor();
}

/** A Pulse widget opened to its body: each is a hero shut on the phone until opened (the tab map, TM2c), its line answering at a
 *  glance and its tiles, rows and buttons inside. Opens Pulse first. */
export async function openWidget(page: Page, key: string): Promise<void> {
  await openPulse(page);
  const hero = page.locator(`[data-home-w="${key}"] details.inv-hero`).first();
  if ((await hero.count()) && !(await hero.evaluate(el => (el as HTMLDetailsElement).open))) await hero.locator(':scope > summary').click();
}
/** Pulse's widgets every preset hides since the tab map (TM2c: To-do, Recent invoices and Money are Needs you's and Money's),
 *  shown on this device as Edit Home's switch shows them, the layout then the owner's own. Call before loadAppWithState: the
 *  layout is written before each load. */
export async function withHomeWidgets(page: Page, keys: string[]): Promise<void> {
  await page.addInitScript(ks => {
    try {
      const hidden: Record<string, boolean> = { production: true, power: true, stock: true, money: true, todo: true, recent: true };
      ks.forEach(k => { delete hidden[k]; });
      localStorage.setItem('sep_inv_home', JSON.stringify({ preset: 'custom', hidden, wide: { mtd: true, quick: true, recent: true },
        order: ['mtd', 'quick', 'money', 'todo', 'attendance', 'unbilled', 'production', 'power', 'stock', 'sync', 'zinc', 'recent'] }));
    } catch { /* storage refused: the presets stand */ }
  }, keys);
}

/** Office → Sales (the tab map, 9 Oct 2026): Prospects and Quotations are Sales' own row, on the page Clients shares. Opens Sales
 *  through Office's row, then `view`. */
export async function openSales(page: Page, view: 'prospects' | 'quotes' = 'prospects'): Promise<void> {
  await switchTab(page, 'pageClients');
  await page.locator('#wsTabs [data-action="invSwitchTab"][data-tab="pageClients"][data-v="prospects"]').click();
  if (view !== 'prospects') await page.locator(`#pageClients .inv-viewtab[data-view="${view}"]`).click();
  await page.locator(`#pageClients .inv-viewtab[data-view="${view}"][aria-selected="true"]`).waitFor();
}
/** The toolbar's Filter (one look, docs/TAB_MAP.md §1a-2): on the phone the screen's filters and sort sit in a dialog opened by
 *  Filter; on the desktop they are inline and this does nothing. Done or Esc shuts it (`closeFilter`). */
export async function phoneFilter(page: Page): Promise<void> {
  const btn = page.locator('.inv-page-active [data-action="invTbFilter"]:visible');
  if (!(await btn.count())) return;
  await btn.first().click();
  await page.locator('[data-tb-filter-dialog]').waitFor();
}
export async function closeFilter(page: Page): Promise<void> {
  const done = page.locator('[data-tb-filter-dialog] [data-action="invTbFilterDone"].inv-btn-primary');
  if (await done.count()) { await done.click(); await expect(page.locator('[data-tb-filter-dialog]')).toHaveCount(0); }
}
/** The toolbar's More (§1a-2, §1a-10): opens it, on either layout, and picks the row named `label` (its dialog shuts first, then
 *  the row acts). Without a label it only opens the dialog. */
export async function toolbarMore(page: Page, label?: string): Promise<void> {
  await page.locator('.inv-page-active [data-action="invTbMore"]:visible').first().click();
  const dlg = page.locator('[data-tb-more-dialog]');
  await dlg.waitFor();
  if (label != null) await dlg.locator('[data-tb-pick]', { hasText: label }).first().click();
}
/** The labels under the toolbar's More (§1a-10), read by opening it and shut again: what the screen on show offers there. */
export async function toolbarMoreLabels(page: Page): Promise<string[]> {
  const btn = page.locator('.inv-page-active [data-action="invTbMore"]:visible').first();
  if (!(await btn.count())) return [];
  await btn.click();
  const dlg = page.locator('[data-tb-more-dialog]');
  await dlg.waitFor();
  const labels = await dlg.locator('[data-tb-pick] .inv-row-title').allInnerTexts();
  await page.keyboard.press('Escape');
  await expect(dlg).toHaveCount(0);
  return labels;
}
/** Production → Entries (the tab map, TM4c): a flag the list is filtered by is a tile of the screen's card, which is shut on the
 *  phone until opened. */
export async function prodFlag(page: Page, flag: string): Promise<void> {
  const v = page.locator('#prodEntriesVerdict');
  if (await v.evaluate(el => el.tagName === 'DETAILS' && !(el as HTMLDetailsElement).open)) await v.locator(':scope > summary').click();
  await v.locator(`[data-action="invProdFilter"][data-flag="${flag}"]`).click();
}
/** An entry's action on Production → Entries: at the row's end, else in its fold on the phone (opened first), else in the pane
 *  beside the list on the desktop, as the hand does. A panel above the list (Line unknown, Not weighed) can name the same entry with
 *  the same mark, so the list's own row is the one acted on. */
export async function prodEntryAct(page: Page, id: string, action: string): Promise<void> {
  const shown = page.locator(`#pageProduction [data-prod-entry="${id}"] [data-action="${action}"]`).first();
  if (await shown.isVisible().catch(() => false)) { await shown.click(); return; }
  const fold = page.locator(`#pageProduction details[data-prod-entry="${id}"]`).first();
  if (await fold.count()) {
    if (!(await fold.evaluate(el => (el as HTMLDetailsElement).open))) await fold.locator(':scope > summary').click({ position: { x: 12, y: 12 } });
    await fold.locator(`[data-action="${action}"]`).first().click();
    return;
  }
  await page.locator(`#pageProduction [data-action="invProdEntryOpen"][data-id="${id}"]`).first().click();
  await page.locator(`#prodEntryPane [data-action="${action}"]`).first().click();
}
/* People → Attendance's Day, Week or Month (the tab map, TM4b): a switch under Attendance's toolbar, the tab returning to the last
   of the three. From anywhere on People, the Attendance tab first where the switch is not on screen. */
export async function openAttendance(page: Page, view: 'day' | 'week' | 'register' = 'day'): Promise<void> {
  const sw = page.locator(`#pageStaff [data-att-period] [data-view="${view}"]`);
  if (!(await sw.isVisible())) await page.locator('#pageStaff .inv-viewtab[data-action="invAttView"][data-view="attendance"]').click();
  // An empty roster draws Attendance's way in and no switch: there is nothing yet to read by day, week or month.
  if (!(await page.locator('#pageStaff [data-att-period]').count())) return;
  await sw.click();
}
/** People → Attendance → Day as the board or as Deepak's sheet (the tab map, TM4b): the toolbar's switch on the desktop, More's
 *  row on the phone, which offers only the way the day is not shown (nothing to do when it already is). */
export async function attDayAs(page: Page, as: 'board' | 'sheet'): Promise<void> {
  const seg = page.locator(`#pageStaff [data-att-toolbar="day"] [data-action="invAttDayAs"][data-v="${as}"]`);
  if (await seg.count()) { await seg.click(); return; }
  if ((await page.evaluate(() => (window as any).attDayAsSheet())) === (as === 'sheet')) return;
  await toolbarMore(page, as === 'sheet' ? 'Show as Deepak' : 'Show as the board');
  await page.locator(as === 'sheet' ? '#attSheetEntry' : '#pageStaff .inv-board').first().waitFor();
}
/** A fold (`details[data-fold="key"]`, uiFoldCard / uiFoldHtml) opened where it is shut: shut on the phone and open on the desktop
 *  by default, and a tap on an open one's head would shut it. */
export async function openFoldAt(page: Page, key: string): Promise<void> {
  const d = page.locator(`.inv-page-active details[data-fold="${key}"], .inv-scrim-dialog details[data-fold="${key}"]`).first();
  await d.waitFor({ state: 'attached' });
  if (!(await d.evaluate(el => (el as HTMLDetailsElement).open))) await d.locator(':scope > summary').click();
}
/** Money's Import of a bank statement (the tab map, TM3c): a door on the screen (the Bank toolbar's own button while no statement
 *  is held, the empty Receivables' or Payments' link), else the Bank toolbar's More. Opens the file chooser; the caller waits on it. */
export async function bankImportDoor(page: Page): Promise<void> {
  const shown = page.locator('#pageFinance [data-action="invBankImport"]:visible');
  if (await shown.count()) { await shown.first().click(); return; }
  await toolbarMore(page, 'Import a statement');
}
/** The phone's name for toolbarMore, kept for the specs written before the desktop took the same row (§1a-10). */
export const phoneMore = toolbarMore;
/** A work screen's verdict card (§3e) is shut on the phone until opened: opens it where it is shut, on either layout. */
export async function openVerdict(page: Page): Promise<void> {
  const v = page.locator('.inv-page-active [data-verdict]').first();
  await v.waitFor();
  if (await v.evaluate(el => el.tagName === 'DETAILS' && !(el as HTMLDetailsElement).open)) await v.locator(':scope > summary').click();
}

/** Open Settings the way the operator does and bring one section into view:
 *  its group chosen (desktop shows one group at a time) and the section unfolded.
 *  A section's Save keeps Settings open, so an open Settings is reused. */
export async function openSettingsAt(page: Page, sec: string): Promise<void> {
  if (!(await page.locator('#settingsScrim').count())) await page.locator('[data-action="invOpenSettings"]').first().click();
  const details = page.locator(`details[data-sec="${sec}"]`);
  const group = await details.evaluate(d => (d.closest('section[data-group]') as HTMLElement).dataset.group);
  const nav = page.locator(`[data-action="invSettingsGroup"][data-group="${group}"]`);
  if (await nav.isVisible()) await nav.click();
  if (!(await details.evaluate(d => (d as HTMLDetailsElement).open))) await details.locator(':scope > summary').click();
}

/** The app asks and tells through its own dialog (uiConfirm / uiAlert / uiPrompt in state.js), never the
 *  browser's confirm(), alert() or prompt(). Waits for the top one, answers it (typing `text` into a prompt
 *  first) and returns what it said, title and body. */
export async function answerAsk(page: Page, answer: 'ok' | 'cancel' = 'ok', text?: string): Promise<string> {
  const dlg = page.locator('[data-ui-ask]').last();
  await expect(dlg).toBeVisible();
  const id = await dlg.getAttribute('data-ui-ask');
  const said = await dlg.innerText();
  if (text != null) await dlg.locator('[data-ui-ask-input]').fill(text);
  await dlg.locator(`[data-ans="${answer}"]`).click();
  await expect(page.locator(`[data-ui-ask="${id}"]`)).toHaveCount(0);
  return said;
}
