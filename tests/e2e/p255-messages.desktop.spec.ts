import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, readStoredState, switchTab, todayIso, type SepState } from './fixtures';

// P255 desktop: the Messages screen as the desktop draws it (msgview.js): the list beside the open message (History's list and pane),
// the filters inline, an address naming a message opening it in the pane, a production message read line by line, and Back walking
// out of the pane and off the screen. Made-up names and figures.

const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const shift = (from: string, n: number) => { const d = new Date(from + 'T00:00:00'); d.setDate(d.getDate() + n); return isoOf(d); };
const DAY = (() => { let d = shift(todayIso(), -3); while ([0, 6].includes(new Date(d + 'T00:00:00').getDay())) d = shift(d, -1); return d; })();
const dmy = (d: string) => { const [y, m, dd] = d.split('-'); return dd + '/' + m + '/' + y.slice(2); };
const ev = (page: Page, js: string) => page.evaluate(src => (0, eval)(src), js);

const ROLL = `${dmy(DAY)}/ IN TIME\n------8:30 AM------\n----VAT A 1----\n01) ALFA`;
const PICK = `DELTA AUTO\nCLAMP 120X80(30X6) - 400 nos\nPickling time 9:00 AM`;
function rec(id: string, kind: string, text: string, over: any = {}) {
  return { id, key: 'k-' + id, sentBy: 'Kilo Romeo', sentAt: 540, sentOn: DAY, text, edited: false, src: 'paste', importId: null, kind, conf: 0.8,
    why: 'a test', status: 'new', saved: [], textWas: [], fix: null, at: Date.now(), by: null, ...over };
}
function book(): SepState {
  return { ...emptyState(), incomingMaterial: noSeedIM(),
    clients: [{ id: 7, name: 'DELTA AUTO', billingMode: 'weight', gstType: 'intra', isActive: true, rates: [{ ratePerKg: 10, effectiveFrom: '2025-04-01' }], itemRates: [] }],
    staff: [{ id: 1, name: 'Alfa Oraon', comp: 'monthly', dayRate: 520, area: 'vat-a1', onFloor: true, active: true }], attendance: {},
    messages: [rec('MSG-A', 'in', ROLL), rec('MSG-P', 'pickling', PICK, { sentAt: 560 }), rec('MSG-N', 'other', 'Tea at four', { status: 'notread', conf: 0, sentAt: 600 })],
  } as unknown as SepState;
}

test.describe('P255: the Messages screen (desktop)', () => {
  test('the list sits beside the open message, and the filters are inline', async ({ page }) => {
    await loadAppWithState(page, book());
    await switchTab(page, 'pageMessages');
    await expect(page.locator('#mvHost')).toBeVisible();
    await expect(page.locator('#mvHost [data-mv-row]')).toHaveCount(3);
    await expect(page.locator('#mvPane [data-mv-message]')).toHaveCount(0);
    // Inline: the kind is a select on the row, and a change filters at once.
    await page.locator('#pageMessages #mvKind').selectOption('pickling');
    await expect(page.locator('#mvHost [data-mv-row]')).toHaveCount(1);
    await page.locator('#pageMessages #mvKind').selectOption('');
    await page.locator('[data-mv-row="MSG-P"]').click();
    await expect(page.locator('#mvHost')).toHaveClass(/inv-pane-open/);
    await expect(page.locator('#mvPane [data-mv-message="MSG-P"]')).toBeVisible();
    await expect(page.locator('[data-mv-row="MSG-P"]')).toHaveAttribute('aria-current', 'true');
    // Production's reader: the load read as pickled for the client.
    await expect(page.locator('#mvPane [data-mv-lines] [data-mv-line]', { hasText: '400 nos' })).toContainText('Pickled');
    await expect(page.locator('#mvPane [data-mv-lines]')).toContainText('DELTA AUTO');
    // The page never scrolls: the list and the pane scroll inside themselves.
    const scroll = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    expect(scroll).toBeLessThanOrEqual(2);
  });

  test('an address opens the message in the pane, and Back walks out of it and off the screen', async ({ page }) => {
    await loadAppWithState(page, book());
    await switchTab(page, 'pageHome');
    await page.goto('/sep-invoicing.html?tab=pageMessages&id=MSG-N');
    await page.locator('body.inv-booted').waitFor();
    await expect(page.locator('#mvPane [data-mv-message="MSG-N"]')).toBeVisible();
    await expect(page.locator('#pageMessages')).toHaveAttribute('data-screen', 'work');
    await page.locator('[data-mv-row="MSG-A"]').click();
    await expect(page).toHaveURL(/id=MSG-A/);
    await page.goBack();
    await expect(page.locator('#mvPane [data-mv-message="MSG-N"]')).toBeVisible();
    await page.locator('#mvPane [data-action="invMsgClose"]').click();
    await expect(page.locator('#mvPane [data-mv-message]')).toHaveCount(0);
    await expect(page).not.toHaveURL(/id=/);
  });

  test('Read every message again lists what moved and writes no record', async ({ page }) => {
    await loadAppWithState(page, book());
    await switchTab(page, 'pageMessages');
    // The roll stored as Not read is sorted again by the sorter as it stands.
    await ev(page, `msgById('MSG-A').kind = 'other'; msgById('MSG-A').status = 'notread'; renderMessages()`);
    const before = await readStoredState(page);
    await page.locator('#pageMessages [data-action="invTbMore"]').click();
    await page.locator('[data-tb-more-dialog] [data-tb-pick]', { hasText: 'Read every message again' }).click();
    await expect(page.locator('[data-mv-reread]')).toContainText('1 message moved');
    await expect(page.locator('[data-mv-reread] [data-mv-moved]')).toContainText('Not read → In-time roll');
    const s = await readStoredState(page);
    expect(s.messages.find((m: any) => m.id === 'MSG-A')).toMatchObject({ kind: 'in', status: 'new' });
    expect(s.relayPastes || []).toEqual(before.relayPastes || []);
    expect(s.attendance).toEqual(before.attendance);
  });
});
