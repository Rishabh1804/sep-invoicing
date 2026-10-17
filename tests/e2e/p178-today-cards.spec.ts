import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, openPulse, todayIso, type SepState, openNeeds } from './fixtures';
import { sweepState } from './sweep-fixture';

// P178: Today as cards (owner, 8 Oct 2026: "need the pulse screen and needs you screen to have less cognitive load, data
// presentation on these screens are still primitive"; "If it is in list form, it should be presented better, maybe as a card
// or atleast an expandable hero card"; "Hero cards should have gradient colour filling as per the theme, make sure the colours
// are coded"). Needs you: the day's inputs a hero of steps, the tasks three heroes of cards. Pulse: each question a hero that
// leads with its figure and opens to its story and its moves. Every hero is filled in its status tone's gradient. Made-up names.

const g = (p: Page, e: string) => p.evaluate(x => (0, eval)(x), e);
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

test('Needs you is cards: the day’s inputs a hero of steps with a meter, the tasks heroes of cards coded by when they want doing', async ({ page }) => {
  await loadAppWithState(page, state());
  await openNeeds(page);
  const inputs = page.locator('#homeNeeds [data-card="inputs"]');
  // On the phone, shut while a red task waits, so the red tasks lead (the survey of 8 Oct 2026): its head still says how many are
  // in, with a meter. A tap opens the day as steps.
  await expect(inputs).toHaveJSProperty('open', false);
  await expect(inputs.locator('.inv-hero-viz svg.inv-meter')).toHaveCount(1);
  await expect(inputs.locator('[data-tdy-in]')).toContainText('of 5 in');
  await inputs.locator(':scope > summary').click();
  await expect(inputs.locator('.inv-step[data-tdy-input]')).toHaveCount(5);
  await expect(inputs.locator('.inv-step[data-tdy-input]').first()).toBeVisible();
  await expect(inputs.locator('.inv-step[data-tdy-input="roll-in"]')).toHaveAttribute('data-state', 'in');
  // Now: red, open, a card per task with its move at the card's foot.
  const now = page.locator('[data-tdy-group="now"]');
  await expect(now).toHaveClass(/inv-hero-danger/);
  await expect(now).toHaveJSProperty('open', true);
  await expect(now.locator('[data-tdy-count]')).toHaveText('1');
  await expect(now.locator('.inv-hero-viz svg.inv-meter')).toHaveCount(1);
  const card = now.locator('.inv-deck-item[data-tdy-task]').first();
  await expect(card).toHaveAttribute('data-tone', 'red');
  await expect(card.locator('.inv-deck-foot button, .inv-deck-foot a')).toHaveCount(1);
  // This week: amber, folded to a line that names what is in it, opened with a tap.
  const week = page.locator('[data-tdy-group="week"]');
  await expect(week).toHaveClass(/inv-hero-warning/);
  await expect(week).toHaveJSProperty('open', false);
  await expect(week.locator('.inv-hero-sub')).toHaveText('Call the drum supplier');
  await week.locator(':scope > summary').click();
  await expect(week.locator('.inv-deck-item[data-todo="mine"]')).toContainText('Call the drum supplier');
  // A card's whole face opens the task: the button reaches the card's edges.
  const [box, main] = await Promise.all([card.boundingBox(), card.locator('.inv-deck-main').boundingBox()]);
  expect(main!.width).toBeGreaterThan(box!.width * 0.8);
});

test('with nothing to do, Now says so in the tone that all is well, and nothing opens', async ({ page }) => {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
  await loadAppWithState(page, s);
  await openNeeds(page);
  const now = page.locator('[data-tdy-group="now"]');
  await expect(now).toHaveClass(/inv-hero-ok/);
  await expect(now).toContainText('Nothing needs you now');
  await expect(now.locator('.inv-hero-body')).toHaveCount(0);
  // With no red task waiting, the day's inputs open while one is still to come.
  await expect(page.locator('#homeNeeds [data-card="inputs"]')).toHaveJSProperty('open', true);
});

test('every hero is filled in its status tone’s gradient, mixed from the theme’s tokens and switched with it', async ({ page }) => {
  await loadAppWithState(page, state());
  // A hero names its tone (--tone, --tone-bg, §3.3 Fills) and its fill is mixed from them on the card itself.
  const read = () => g(page, `(function () {
    var box = document.createElement('div'); box.id = 'p178';
    box.innerHTML = ['danger', 'warning', 'ok', 'info', 'neutral', ''].map(function (t) { return uiHeroHtml({ tone: t, eyebrow: t || 'accent', title: 'A' }); }).join('');
    document.body.appendChild(box);
    var out = Array.prototype.map.call(box.children, function (el) { return getComputedStyle(el).backgroundImage; });
    box.remove();
    return { bg: out };
  })()`);
  const light: any = await read();
  for (const b of light.bg) expect(b).toMatch(/^linear-gradient\(/);
  // Six tones, six fills: the colour says the status. No stop is the plain surface: the fill stays in its tone (HR-9).
  expect(new Set(light.bg).size).toBe(6);
  for (const b of light.bg) expect(b).not.toMatch(/rgb\(236, 244, 245\)/);
  await page.emulateMedia({ colorScheme: 'dark' });
  const dark: any = await read();
  for (let i = 0; i < 6; i++) expect(dark.bg[i]).not.toBe(light.bg[i]);
});

test('Home: each question a widget that leads with its figure; at Large it takes the row with its story and its moves as cards', async ({ page }) => {
  await loadAppWithState(page, sweepState());
  // Pulse's questions are widgets on Home's board since UI pass 3 (U2), laid out at Large here (openPulse).
  await openPulse(page);
  const qs = page.locator('#homeBoard [data-tdy-q]');
  expect(await qs.count()).toBeGreaterThanOrEqual(4);
  // Each is its question, a figure or an answer, and its tone.
  const money = page.locator('[data-tdy-q="money"]');
  await expect(money.locator('.inv-widget-title')).toHaveText('Are we making money?');
  await expect(money.locator('.inv-widget-fig')).toHaveCount(1);
  await expect(money).toHaveClass(/inv-hero-(danger|warning|ok|info|neutral)/);
  // The month's realisation against the cost, drawn small.
  await expect(money.locator('.inv-widget-viz svg.inv-spark')).toHaveCount(1);
  // At Large, what you can do, as cards; its story beside them where the card has room for both, else the story gives way to the
  // moves (the phone's Large has Medium's room) and is the question's own, a tap away on its head.
  await expect(money.locator('[data-tdy-moves]')).toBeVisible();
  await expect(money.locator('[data-tdy-moves] [data-adv-move]').first()).toBeVisible();
  const story = money.locator('.inv-hero-sheet[data-tdy-story]');
  await expect(story).toHaveCount(1);
  if ((await story.getAttribute('data-wdg-cut')) === null) await expect(story).toBeVisible();
  else {
    await expect(story).toBeHidden();
    await money.locator('.inv-widget-door').click();
    await expect(page.locator('[data-tdy-q-open="money"] [data-story-say]')).toBeVisible();
    await page.locator('[data-tdy-q-open="money"] [data-action="invCloseOverlay"]').first().click();
  }
  // Large spans the board's row.
  const [w, gw] = await money.evaluate(e => [e.getBoundingClientRect().width, e.parentElement!.getBoundingClientRect().width]);
  expect(Math.abs(w - gw)).toBeLessThan(2);
  // The moves worth most, across the questions, as cards: three at Medium, five at Large.
  const first = page.locator('#homeDash [data-card="first"]');
  const n = await first.locator('.inv-deck-item').count();
  expect(n).toBeGreaterThan(0);
  expect(n).toBeLessThanOrEqual(5);
});

test('the month’s tiles each carry a line of the months before', async ({ page }) => {
  await loadAppWithState(page, sweepState());
  await openPulse(page);
  await expect(page.locator('#mtdRevenueViz svg.inv-spark')).toHaveCount(1);
  await expect(page.locator('#mtdCountViz svg.inv-spark')).toHaveCount(1);
});
