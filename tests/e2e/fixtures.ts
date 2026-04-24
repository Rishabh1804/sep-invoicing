import { Page } from '@playwright/test';

export const STORAGE_KEY = 'sep_invoicing_state';

export type SepState = {
  clients: Array<{ id: number; name: string; billingMode?: string; gstType?: string; gstin?: string; address?: string }>;
  items: unknown[];
  partWeights: Record<string, unknown>;
  incomingMaterial: unknown[];
  invoices: unknown[];
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
