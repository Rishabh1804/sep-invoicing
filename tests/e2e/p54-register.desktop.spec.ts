import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, recentTs, switchTab, todayIso } from './fixtures';

// P54 desktop: the register table fits the list beside its pane. The resizable split it
// replaced left the table in 40% of the screen, Total cut off and each client name wrapped
// over three lines — and nothing in the suite measured it.

const NAME = 'DILIP PRESS METAL & AGROTECH PRIVATE LIMITED';

function state() {
  const s = emptyState();
  s.incomingMaterial = noSeedIM() as any;
  s.clients = [{ id: 1, name: NAME, gstin: '20AACCD1457H1Z6', billingMode: 'weight', ratePerKg: 13.5, isActive: true } as any];
  s.invoices = Array.from({ length: 6 }, (_, i) => ({
    id: 'INV-' + i, invoiceNumber: String(900 + i).padStart(5, '0'), displayNumber: 'SEP/2026-27/' + String(900 + i).padStart(5, '0'),
    date: todayIso(), status: 'active', invoiceState: 'created', clientId: 1, clientName: NAME, clientGSTIN: '20AACCD1457H1Z6',
    clientAddress: { add1: '', add2: '', add3: '', state: '', stateCode: '' }, gstType: 'intra',
    items: [{ partNumber: 'P' + i, desc: 'P' + i, hsn: '998873', unit: 'KG', qty: 100, rate: 13.5, amount: 1350, nosQty: null }],
    taxableValue: 1350, cgstPer: 9, cgstAmt: 121.5, sgstPer: 9, sgstAmt: 121.5, igstPer: 0, igstAmt: 0, grandTotal: 1593,
    amountInWords: '', challanNo: '834, 835, 838, 836', challanDate: '', poNumber: '', poDate: '', despatchDate: '',
    transport: '', remarks: '', createdAt: recentTs(i),
  })) as any;
  return s;
}

async function fit(page: Page) {
  return page.evaluate(() => {
    const list = document.getElementById('regMaster')!, table = list.querySelector('table')!;
    const cell = list.querySelector('td.inv-col-grow') as HTMLElement;
    return {
      listShown: list.offsetWidth > 0,
      overflow: table.scrollWidth - list.clientWidth,
      // The client's name as laid out: one line box, however tall the row is.
      clientLines: (() => { const r = document.createRange(); r.selectNodeContents(cell); return new Set([...r.getClientRects()].map(x => Math.round(x.top))).size; })(),
      total: [...list.querySelectorAll('thead th')].some(th => (th as HTMLElement).offsetWidth > 0 && th.textContent!.startsWith('Total')),
    };
  });
}

for (const width of [1280, 1024]) {
  test(`at ${width}px the table fits beside its pane and never wraps a client`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await loadAppWithState(page, state());
    await switchTab(page, 'pageRegister');

    const closed = await fit(page);
    expect(closed.overflow).toBeLessThanOrEqual(0);
    expect(closed.total).toBe(true);
    expect(closed.clientLines).toBe(1);

    await page.locator('#regMaster [data-invnum]').first().click();
    await expect(page.locator('#regDetail')).toContainText('Grand total');
    const open = await fit(page);
    if (open.listShown) {
      // The list gives up columns rather than overflow; Total and the client stay.
      expect(open.overflow).toBeLessThanOrEqual(0);
      expect(open.total).toBe(true);
      expect(open.clientLines).toBe(1);
    } else {
      // Too narrow for both: the invoice takes the list's place, and closing it brings the list back.
      await page.locator('[data-action="invRegClosePane"]').click();
      expect((await fit(page)).listShown).toBe(true);
    }
  });
}

test('the pane opens from the keyboard and says the state once', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loadAppWithState(page, state());
  await switchTab(page, 'pageRegister');
  await page.locator('#regMaster [data-invnum]').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#regDetail [aria-current="step"]')).toHaveCount(1);
  await expect(page.locator('#regDetail [data-line]')).toHaveCount(1);
});
