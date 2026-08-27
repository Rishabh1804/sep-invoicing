import { test, expect, Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab } from './fixtures';

/**
 * Staff → Areas: the floor by place rather than by person.
 *
 * Two things it has to get right. Staffing has to be measured against a
 * complement the owner set, and say plainly when none is set rather than
 * reporting every area as overstaffed against zero. And the extra — the one
 * part of the wage bill nothing in the record corroborates — has to be
 * cross-checked without the check being dressed up as more than it is.
 */

/** Monday of the current week, so the week nav lands on the seeded days. */
function weekDays(): string[] {
  const mon = new Date();
  mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  return [...Array(6)].map((_, i) => {
    const d = new Date(mon);
    d.setDate(d.getDate() + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
}

const LEAD = { id: 1, name: 'BARREL LEAD', comp: 'monthly', dayRate: 470, hourRate: 0, area: 'barrel', onFloor: true, active: true };
const HAND = { id: 2, name: 'BARREL HAND', comp: 'hourly', dayRate: 0, hourRate: 47.5, area: 'barrel', onFloor: true, active: true };
const FLOATER = { id: 3, name: 'FLOATER', comp: 'hourly', dayRate: 0, hourRate: 47.5, area: 'flex', onFloor: true, active: true };

const LABOUR = { otMult: 1.1, restCreditMinDays: 6, extraRate: 47.5, modelPerKg: 3.55, gateFull: 0.9, gateHalf: 0.8 };

function areaState(attendance: Record<string, unknown>, areaTargets: Record<string, number> = {}) {
  return {
    ...emptyState(),
    incomingMaterial: noSeedIM(),
    staff: [LEAD, HAND, FLOATER],
    attendance,
    areaTargets,
    labour: LABOUR,
  };
}

async function openAreas(page: Page) {
  await switchTab(page, 'pageStaff');
  await page.locator('[data-action="invAttView"][data-view="areas"]').click();
}

const row = (page: Page, label: string) => page.locator('.inv-area-row', { hasText: label });

test('an empty range says so rather than drawing empty areas', async ({ page }) => {
  await loadAppWithState(page, areaState({}));
  await openAreas(page);
  await expect(page.locator('#attContent')).toContainText('No attendance recorded in this range');
});

test('heads are counted where the worker actually stood, not where the roster says they live', async ({ page }) => {
  const [d1, d2] = weekDays();
  await loadAppWithState(page, areaState({
    // The barrel hand is lent to pickling on the second day. Their roster area
    // is barrel; the mark says pickling, and the mark is what happened.
    [d1]: { marks: { [HAND.id]: { st: 'P', hours: 8, ot: 0, area: 'barrel' } }, extra: [], note: '' },
    [d2]: { marks: { [HAND.id]: { st: 'P', hours: 8, ot: 0, area: 'pickling' } }, extra: [], note: '' },
  }));
  await openAreas(page);
  // Two recorded days, one head-day each: 0.5 average apiece.
  await expect(row(page, 'Barrel')).toContainText('0.5');
  await expect(row(page, 'Pickling')).toContainText('0.5');
});

test('an area with no complement set says so instead of reading as overstaffed', async ({ page }) => {
  const [d1] = weekDays();
  await loadAppWithState(page, areaState({
    [d1]: { marks: { [LEAD.id]: { st: 'P', hours: 0, ot: 0, area: 'barrel' } }, extra: [], note: '' },
  }));
  await openAreas(page);
  await expect(row(page, 'Barrel')).toContainText('no complement');
  await expect(row(page, 'Barrel')).not.toContainText('over');
});

test('a complement turns the headcount into a variance, in both directions', async ({ page }) => {
  const [d1] = weekDays();
  await loadAppWithState(page, areaState({
    [d1]: {
      marks: {
        [LEAD.id]: { st: 'P', hours: 0, ot: 0, area: 'barrel' },
        [HAND.id]: { st: 'P', hours: 8, ot: 0, area: 'barrel' },
        [FLOATER.id]: { st: 'P', hours: 8, ot: 0, area: 'pickling' },
      },
      extra: [], note: '',
    },
  }, { barrel: 4, pickling: 1 }));
  await openAreas(page);
  // Two heads against a complement of four.
  await expect(row(page, 'Barrel')).toContainText('-2.0 under');
  await expect(row(page, 'Barrel')).toHaveClass(/inv-area-under/);
  // One head against a complement of one.
  await expect(row(page, 'Pickling')).toContainText('at complement');
  await expect(row(page, 'Pickling')).toHaveClass(/inv-area-ok/);
});

test('setting a complement in place moves the variance', async ({ page }) => {
  const [d1] = weekDays();
  await loadAppWithState(page, areaState({
    [d1]: { marks: { [LEAD.id]: { st: 'P', hours: 0, ot: 0, area: 'barrel' } }, extra: [], note: '' },
  }));
  await openAreas(page);
  await expect(row(page, 'Barrel')).toContainText('no complement');
  await page.locator('[data-area-target][data-area="barrel"]').fill('3');
  await page.locator('[data-area-target][data-area="barrel"]').blur();
  await expect(row(page, 'Barrel')).toContainText('-2.0 under');
});

/* ===== THE EXTRA ===== */

test('extra booked where nobody was marked is flagged, with the area and the date', async ({ page }) => {
  const [d1, d2, d3] = weekDays();
  await loadAppWithState(page, areaState({
    [d1]: { marks: { [HAND.id]: { st: 'P', hours: 8, ot: 0, area: 'barrel' } }, extra: [{ area: 'barrel', hours: 6 }], note: '' },
    [d2]: { marks: { [HAND.id]: { st: 'P', hours: 8, ot: 0, area: 'barrel' } }, extra: [{ area: 'colour', hours: 12 }], note: '' },
    [d3]: { marks: { [HAND.id]: { st: 'P', hours: 8, ot: 0, area: 'barrel' } }, extra: [{ area: 'colour', hours: 8 }], note: '' },
  }));
  await openAreas(page);

  const card = page.locator('.inv-lab-card', { hasText: 'The extra, checked' });
  await expect(card).toBeVisible();
  // The barrel booking has somebody under it; the two colour bookings do not.
  await expect(card).toContainText('Booked where nobody was marked');
  await expect(card).toContainText('20.0 h');
  await expect(card).toContainText('across 2 area-days');
  await expect(card.locator('.inv-area-flag').first()).toContainText('Colour');
  // The flag is on the paperwork, and the card must not claim more than that.
  await expect(card).toContainText('it does not say which half is wrong');
});

test('a range where every booking is manned says the check passed', async ({ page }) => {
  const [d1] = weekDays();
  await loadAppWithState(page, areaState({
    [d1]: { marks: { [HAND.id]: { st: 'P', hours: 8, ot: 0, area: 'barrel' } }, extra: [{ area: 'barrel', hours: 6 }], note: '' },
  }));
  await openAreas(page);
  const card = page.locator('.inv-lab-card', { hasText: 'The extra, checked' });
  await expect(card).toContainText('passes');
  await expect(card.locator('.inv-area-flag')).toHaveCount(0);
});

test('the extra is shown against named hours and priced at the contract tier', async ({ page }) => {
  const [d1] = weekDays();
  await loadAppWithState(page, areaState({
    [d1]: {
      marks: { [HAND.id]: { st: 'P', hours: 10, ot: 0, area: 'barrel' } },
      extra: [{ area: 'barrel', hours: 10 }], note: '',
    },
  }));
  await openAreas(page);
  const card = page.locator('.inv-lab-card', { hasText: 'The extra, checked' });
  // 10 named against 10 extra: half the paid hours carry no name.
  await expect(card).toContainText('50.0% of paid hours, nobody named');
  await expect(card).toContainText('475.00');   // 10 h x Rs47.50
});

test('extra per head-day is a plausibility test and says so', async ({ page }) => {
  const [d1, d2] = weekDays();
  const marks = {
    [LEAD.id]: { st: 'P', hours: 0, ot: 0, area: 'barrel' },
    [HAND.id]: { st: 'P', hours: 8, ot: 0, area: 'barrel' },
  };
  await loadAppWithState(page, areaState({
    [d1]: { marks, extra: [{ area: 'barrel', hours: 16 }], note: '' },
    [d2]: { marks, extra: [{ area: 'barrel', hours: 16 }], note: '' },
  }));
  await openAreas(page);
  // 32 extra hours over 4 worker-days = 8.0 each, on top of what they logged.
  await expect(row(page, 'Barrel')).toContainText('8.0');
  await expect(row(page, 'Barrel')).toContainText('extra /head-day');
  await expect(page.locator('#attContent')).toContainText('plausibility test, not an');
});

test('flex marks are counted against no area, and the shortfall is named', async ({ page }) => {
  const [d1] = weekDays();
  await loadAppWithState(page, areaState({
    [d1]: { marks: { [FLOATER.id]: { st: 'P', hours: 8, ot: 0, area: 'flex' } }, extra: [], note: '' },
  }));
  await openAreas(page);
  await expect(page.locator('#attContent')).toContainText('sit on Flex and are counted against no area');
});

test('the span chips widen the range without moving the anchor', async ({ page }) => {
  const [d1] = weekDays();
  await loadAppWithState(page, areaState({
    [d1]: { marks: { [HAND.id]: { st: 'P', hours: 8, ot: 0, area: 'barrel' } }, extra: [], note: '' },
  }));
  await openAreas(page);
  await expect(page.locator('#attContent')).toContainText('Week ');
  await page.locator('[data-action="invAreaSpan"][data-span="4"]').click();
  await expect(page.locator('#attContent')).toContainText('4 weeks');
  // Still anchored on the same Monday, so the seeded day is still in range.
  await expect(row(page, 'Barrel')).toBeVisible();
});
