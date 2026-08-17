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

export async function loadAppWithState(page: Page, state: SepState): Promise<void> {
  await page.addInitScript(
    ([key, value]) => { localStorage.setItem(key as string, value as string); },
    [STORAGE_KEY, JSON.stringify(state)] as const,
  );
  await page.goto('/');
  await page.waitForSelector('nav.inv-tabs', { state: 'attached' });
}

export async function switchTab(page: Page, tabId: string): Promise<void> {
  // Layout exposes this action in multiple places (mobile bottom tabs + desktop sidebar + home quick-actions).
  // Any visible one works; pick the first so the helper is layout-agnostic.
  await page
    .locator(`[data-action="invSwitchTab"][data-tab="${tabId}"]`)
    .first()
    .click();
  await page.locator(`#${tabId}.inv-page-active`).waitFor();
}
