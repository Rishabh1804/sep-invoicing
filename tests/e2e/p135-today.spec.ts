import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, todayIso, waitForBoot, type SepState } from './fixtures';

// P135: Today (DIRECTION_B, step B3; owner, 1 Oct 2026). Home is Today, two views: Needs you (the day's inputs, each
// with when it usually arrives, and every open task grouped Now / This week / Later with its one-tap move) and Pulse
// (the questions with what to do, then the widgets the owner arranged). Each view has an address, so Back walks them.
// Every name is made up; dates are from today.

const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);
const where = (p: Page) => { const u = new URL(p.url()); return [u.searchParams.get('tab'), u.searchParams.get('v') || '']; };

function iso(offset: number): string {
  const d = new Date(todayIso() + 'T00:00:00');
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/* One stock line out (a red task), a task of the owner's own due in three days, and a hand on the roster marked today. */
function state(): SepState {
  return {
    ...emptyState(), incomingMaterial: noSeedIM(),
    staff: [{ id: 1, name: 'Alfa', comp: 'monthly', area: 'vat-a1', dayRate: 480, active: true, onFloor: true }],
    attendance: { [todayIso()]: { marks: { 1: { st: 'P', area: 'vat-a1', hours: 8, ot: 0 } }, extra: [], note: '' } },
    stock: {
      items: [{ id: 'N', name: 'Nitric acid', key: 'NITRIC ACID', unit: 'L', basis: 'draw', aliases: [] }],
      entries: [{ id: 'n1', itemId: 'N', kind: 'count', qty: 0, date: iso(-1), at: 1, seq: 1 }],
      pastes: [],
    },
    todo: { tasks: [{ id: 'm1', text: 'Call the drum supplier', due: iso(3), note: '', link: null, createdAt: 1, doneAt: null }], snoozes: {} },
  } as unknown as SepState;
}

test('Today opens on Needs you: the day’s inputs, then the tasks grouped by when they want doing', async ({ page }) => {
  await loadAppWithState(page, state());
  await expect(page.locator('#pageHome')).toHaveClass(/inv-page-active/);
  await expect(page.locator('#homeNeeds')).toBeVisible();
  await expect(page.locator('#homePulse')).toBeHidden();
  // Five inputs; the roll is in because the day was entered by hand.
  const inputs = page.locator('[data-tdy-input]');
  await expect(inputs).toHaveCount(5);
  await expect(page.locator('[data-tdy-input="roll-in"]')).toHaveAttribute('data-state', 'in');
  await expect(page.locator('[data-tdy-input="roll-in"]')).toContainText('entered by hand');
  await expect(page.locator('[data-tdy-in]')).toContainText('of 5 in');
  // A stock line out is red: Now. The owner's own task due within the week: This week.
  await expect(page.locator('[data-tdy-group="now"]')).toBeVisible();
  await expect(page.locator('[data-tdy-group="week"]')).toBeVisible();
  const groups = await page.locator('[data-tdy-group]').evaluateAll(els => els.map(e => (e as HTMLElement).dataset.tdyGroup));
  expect(groups.indexOf('now')).toBeLessThan(groups.indexOf('week'));
  await expect(page.locator('[data-card="tasks"]')).toContainText('Call the drum supplier');
  // The app task carries one move to where it is made, at the foot of its card.
  const app = page.locator('[data-tdy-task]').first();
  await expect(app.locator('.inv-deck-foot button, .inv-deck-foot a')).toHaveCount(1);
});

test('Pulse is the second view; each view has its address and Back walks between them', async ({ page }) => {
  await loadAppWithState(page, state());
  expect(where(page)).toEqual(['pageHome', 'needs']);
  await page.locator('#wsTabs [data-v="pulse"]').click();
  await expect(page.locator('#homePulse')).toBeVisible();
  await expect(page.locator('#homeNeeds')).toBeHidden();
  await expect.poll(() => where(page)).toEqual(['pageHome', 'pulse']);
  await expect(page.locator('#wsTabs [data-v="pulse"]')).toHaveAttribute('aria-selected', 'true');
  await page.goBack();
  await expect(page.locator('#homeNeeds')).toBeVisible();
  await expect.poll(() => where(page)).toEqual(['pageHome', 'needs']);
  // A reload opens the view the address names.
  await page.goto(page.url().replace('v=needs', 'v=pulse'));
  await waitForBoot(page);
  await expect(page.locator('#homePulse')).toBeVisible();
  expect(await g(page, 'tdyView()')).toBe('pulse');
});

test('an input not in yet offers its door, and a row opens where it lands', async ({ page }) => {
  await loadAppWithState(page, state());
  const stock = page.locator('[data-tdy-input="stock"]');
  await expect(stock).not.toHaveAttribute('data-state', 'in');
  await expect(stock.locator('[data-action="invTdyPaste"]')).toHaveCount(1);
  // On the phone the card is shut while a red task waits (the stock line out); a tap opens it.
  await page.locator('#homeNeeds [data-card="inputs"] > summary').click();
  await page.locator('[data-tdy-input="roll-in"] [data-action="invTdyInput"]').click();
  await expect(page.locator('#pageStaff')).toHaveClass(/inv-page-active/);
  expect(await g(page, '_attView')).toBe('day');
});
