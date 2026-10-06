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

/** Stats is grouped into tabs (Overview, Clients, Cost, Billing, Trends): open one. */
export async function openStatsTab(page: Page, tab: string): Promise<void> {
  await switchTab(page, 'pageStats');
  await page.locator(`[data-action="invStatsTab"][data-tab="${tab}"]`).click();
  await page.locator(`#statsToolbar .inv-viewtab[aria-selected="true"][data-tab="${tab}"]`).waitFor();
}

/* The workspaces (DIRECTION_B), restated from split/workspace.js WORKSPACES: which workspace holds each page. The phone
   bar carries Today, Office, Floor and Money; Insights has no bar item. Create and the To-do are held without a tab. */
const WS_OF: Record<string, string> = {
  pageHome: 'today', pageTodo: 'today',
  pagePipeline: 'office', pageIM: 'office', pageRegister: 'office', pageClients: 'office', pageCreate: 'office',
  pageFloor: 'floor', pageStaff: 'floor', pageProduction: 'floor', pageStock: 'floor', pagePower: 'floor',
  pageFinance: 'money',
  pageStats: 'insights', pageReports: 'insights', pagePlanner: 'insights', pageHistory: 'insights',
  pageKnow: 'insights',
};

export async function switchTab(page: Page, tabId: string): Promise<void> {
  // A visible door to the page: a workspace's tab, a sidebar entry, a link on the screen (Home's "View challans"). Any
  // one works; the first is taken, so the helper is layout-agnostic.
  const door = () => page.locator(`[data-action="invSwitchTab"][data-tab="${tabId}"]:visible`);
  const active = page.locator(`#${tabId}.inv-page-active`);
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
    // The last resort, where the shell has no door to the page: the Insights pages on the phone (reached from Today →
    // Pulse and from search, other steps' work), and the pages a workspace holds without a tab (Create, the To-do) when
    // nothing on screen links to them. Opened the way a jump opens them, then recorded as a click's step would be.
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
