import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState, openPulse } from './fixtures';

// P90: one paste box (Home → Paste message, Staff → Paste message) for every message the floor sends. A roll is
// attendance, a chemical message is Stock's, and the pickling hand's loads and the barrel list are Production's.
// A roll carrying a production block is still read as attendance, EXACTLY as it was before Production existed; the
// block is offered to Production beside it.

const CLIENTS = [{ id: 12, name: 'DURGA AUTO', billingMode: 'kg', gstType: 'intra', gstin: '', address: '' }];
const STAFF = [
  { id: 1, name: 'Arun', comp: 'hourly', area: 'barrel', hourRate: 50, active: true, onFloor: true },
  { id: 2, name: 'Bala', comp: 'hourly', area: 'vat-a1', hourRate: 50, active: true, onFloor: true },
];
function dmy(offset = 0) {
  const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + offset);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`;
}
const ROLL = (block: boolean) => `${dmy(-1)}/ out time
----5:00 pm---
---VAT A 1---
1) BALA
----8:00 PM---
---berral---
1) ARUN
EXTRA 6 HOURS` + (block ? `
----production----
Durga auto 0101--400 nos` : '');

async function load(page: Page, staff = STAFF) {
  await loadAppWithState(page, { ...emptyState(), clients: CLIENTS, staff, attendance: {}, incomingMaterial: noSeedIM() } as SepState);
}
async function paste(page: Page, text: string) {
  await switchTab(page, 'pageStaff');
  await page.locator('[data-action="invAttView"][data-view="paste"]').click();
  await page.locator('#relayPasteText').fill(text);
  await page.locator('[data-action="invRelayRead"]').click();
}

test.describe('P90: where a pasted message goes', () => {
  test('the pickling hand\'s messages open Production\'s check, with no roster needed', async ({ page }) => {
    await load(page, []);
    await openPulse(page);
    await page.locator('[data-action="invHomeQuick"][data-go="paste"]').click();
    await page.locator('#relayPasteText').fill(`${dmy(-1)}, 9:40 am - Pickler: DURGA AUTO\n0140--300 nos\nPickling Time 9:00AM`);
    await page.locator('[data-action="invRelayRead"]').click();
    await expect(page.locator('#pageProduction')).toHaveClass(/inv-page-active/);
    await expect(page.locator('[data-prod-row="0:0"] .inv-verdict-text')).toContainText('DURGA AUTO');
    await expect(page.locator('[data-action="invProdSaveReview"]')).toBeEnabled();
  });

  test('a chemical message still goes to Stock', async ({ page }) => {
    await load(page);
    await paste(page, `${dmy(0)}/ Camical use camical stock\n1) NITRIC 10-2=8 L`);
    await expect(page.locator('#pageStock')).toHaveClass(/inv-page-active/);
  });

  test('a roll with a production block: attendance exactly as without it, the block offered to Production', async ({ page }) => {
    const saved = async (text: string) => {
      await load(page);
      await paste(page, text);
      await expect(page.locator('#pageStaff')).toHaveClass(/inv-page-active/);
      const note = await page.locator('#relayProdNote').count();
      await page.locator('[data-action="invRelaySave"]').click();
      return { note, att: (await readStoredState(page)).attendance };
    };
    const plain = await saved(ROLL(false));
    const withBlock = await saved(ROLL(true));
    expect(plain.note).toBe(0);
    expect(withBlock.note).toBe(1);
    // The relay has always kept a roll's notes on the day; everything it reads as attendance is identical.
    const strip = (att: any) => JSON.parse(JSON.stringify(att, (k, v) => (k === 'note' ? undefined : v)));
    const day = Object.keys(plain.att)[0];
    expect(Object.keys(plain.att)).toHaveLength(1);
    expect(strip(withBlock.att)).toEqual(strip(plain.att));
    expect(withBlock.att[day].note).toBe('Durga auto 0101--400 nos');

    // Read in Production: the same text on Production's check, the block's line only suggested.
    await load(page);
    await paste(page, ROLL(true));
    await page.locator('[data-action="invRelayToProd"]').click();
    await expect(page.locator('#pageProduction')).toHaveClass(/inv-page-active/);
    const row = page.locator('[data-prod-row="0:0"]');
    await expect(row.locator('.inv-quote')).toHaveText('Durga auto 0101--400 nos');
    await expect(row.locator('.inv-verdict-text')).toContainText('line unknown');
  });
});
