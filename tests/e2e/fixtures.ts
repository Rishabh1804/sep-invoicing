import { Page } from '@playwright/test';

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
    await page.evaluate(() => new Promise<void>(resolve => {
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
  await page.locator(`.inv-stats-tab-on[data-tab="${tab}"]`).waitFor();
}

export async function switchTab(page: Page, tabId: string): Promise<void> {
  // Layout exposes this action in multiple places (mobile bottom tabs + desktop sidebar + home quick-actions).
  // Any visible one works; pick the first so the helper is layout-agnostic. On the
  // phone bar Stock, Staff, Stats and History sit behind More, so open it first.
  // A page with two sidebar entries (Clients/Items, Staff/Pay) routes its plain entry through
  // invSideGo; that entry, never the one carrying data-sub, is the page's own door.
  const target = page.locator(`:is([data-action="invSwitchTab"], [data-action="invSideGo"]:not([data-sub]))[data-tab="${tabId}"]:visible`);
  if ((await target.count()) === 0) await page.locator('.inv-navbar-more').click();
  await target.first().click();
  await page.locator(`#${tabId}.inv-page-active`).waitFor();
}

/** Open Settings the way the operator does and bring one section into view:
 *  its group chosen (desktop shows one group at a time) and the section unfolded.
 *  A section's Save keeps Settings open, so an open Settings is reused. */
export async function openSettingsAt(page: Page, sec: string): Promise<void> {
  if (!(await page.locator('#settingsScrim').count())) await page.locator('[data-action="invOpenSettings"]').first().click();
  const details = page.locator(`details.inv-set-sec[data-sec="${sec}"]`);
  const group = await details.evaluate(d => (d.closest('.inv-set-group') as HTMLElement).dataset.group);
  const nav = page.locator(`[data-action="invSettingsGroup"][data-group="${group}"]`);
  if (await nav.isVisible()) await nav.click();
  if (!(await details.evaluate(d => (d as HTMLDetailsElement).open))) await details.locator(':scope > summary').click();
}
