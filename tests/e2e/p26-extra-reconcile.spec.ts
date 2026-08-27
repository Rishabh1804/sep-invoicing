import { test, expect, Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab } from './fixtures';

/**
 * The extra, reconciled against the staffing norms.
 *
 * The rule the floor is run to: a hand missing from an area running at full
 * tilt is covered by the crew who are there, and eight hours are booked to the
 * area for it. That makes the extra a *prediction* — `8 × (norm − heads)` per
 * sub-area per day — and a prediction can be checked.
 *
 * The headline spec reproduces a documented ruling to the rupee. The rest pin
 * the ways the record can disagree with the rule, which mean different things
 * and are therefore reported apart.
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

/** The floor's own full house: 4 · 4 · 3 · 2 · 3 = sixteen. */
const NORMS = { 'vat-a1': 4, 'vat-a2': 4, barrel: 3, 'pickling-barrel': 2, 'pickling-vat': 3 };

const LABOUR = {
  otMult: 1.1, restCreditMinDays: 6, extraRate: 47.5, modelPerKg: 3.55,
  gateFull: 0.9, gateHalf: 0.8, extraHoursPerHead: 8,
};

/** A crew of `n` hourly hands homed in `area`, ids offset so they never clash. */
function crew(area: string, n: number, base: number) {
  return [...Array(n)].map((_, i) => ({
    id: base + i, name: `${area.toUpperCase()}-${i + 1}`, comp: 'hourly',
    dayRate: 0, hourRate: 47.5, area, onFloor: true, active: true,
  }));
}

function state(staff: unknown[], attendance: Record<string, unknown>, areaTargets: Record<string, number> = NORMS) {
  return { ...emptyState(), incomingMaterial: noSeedIM(), staff, attendance, areaTargets, labour: LABOUR };
}

function marksFor(staff: Array<{ id: number; area: string }>) {
  const m: Record<string, unknown> = {};
  staff.forEach((w) => { m[w.id] = { st: 'P', hours: 8, ot: 0, area: w.area }; });
  return m;
}

async function openAreas(page: Page) {
  await switchTab(page, 'pageStaff');
  await page.locator('[data-action="invAttView"][data-view="areas"]').click();
}

const extraCard = (page: Page) => page.locator('.inv-lab-card', { hasText: 'The extra, checked' });

/* ===== THE RECONCILIATION ===== */

test('reproduces the recorded shortfall decode: three areas short one hand each', async ({ page }) => {
  // The case the rule was ruled on. A1 3/4, A2 3/4, Barrel 3/3, Barrel
  // pickling 2/2, Pickling A1+A2 2/3 — three sub-areas short one hand apiece,
  // 3 x 8 = 24 man-hours at Rs47.50 = Rs1,140, and 24 h booked.
  const staff = [
    ...crew('vat-a1', 3, 10), ...crew('vat-a2', 3, 20), ...crew('barrel', 3, 30),
    ...crew('pickling-barrel', 2, 40), ...crew('pickling-vat', 2, 50),
  ];
  const [, d2] = weekDays();
  await loadAppWithState(page, state(staff, {
    [d2]: {
      marks: marksFor(staff),
      extra: [
        { area: 'vat-a1', hours: 8 },
        { area: 'vat-a2', hours: 8 },
        { area: 'pickling-vat', hours: 8 },
      ],
      note: '',
    },
  }));
  await openAreas(page);

  const card = extraCard(page);
  await expect(card).toContainText('24.0 h');
  await expect(card).toContainText('exactly as predicted');
  await expect(card).toContainText('₹1,140.00');
  await expect(card).toContainText('passes');
});

test('the same day attributes the coverage pro-rata to the crews who carried it', async ({ page }) => {
  const staff = [
    ...crew('vat-a1', 3, 10), ...crew('vat-a2', 3, 20), ...crew('barrel', 3, 30),
    ...crew('pickling-barrel', 2, 40), ...crew('pickling-vat', 2, 50),
  ];
  const [, d2] = weekDays();
  await loadAppWithState(page, state(staff, {
    [d2]: {
      marks: marksFor(staff),
      extra: [{ area: 'vat-a1', hours: 8 }, { area: 'vat-a2', hours: 8 }, { area: 'pickling-vat', hours: 8 }],
      note: '',
    },
  }));
  await openAreas(page);

  const card = page.locator('.inv-card', { hasText: 'Coverage absorbed' });
  await expect(card).toBeVisible();
  // 8 h over the two-hand pickling crew is 4.0 each; over the three-hand VAT
  // crews it is 2.7. The barrel-pickling pair were at norm and carry nothing,
  // so they are absent from the list entirely.
  await expect(card).toContainText('4.0 h');
  await expect(card).toContainText('2.7 h');
  await expect(card).not.toContainText('PICKLING-BARREL');
  // And it must say, in place, that this is not money.
  await expect(card).toContainText('availability measure, not a wage');
});

test('more booked than the shortfall explains is called out as a surplus', async ({ page }) => {
  const staff = crew('barrel', 2, 10);          // 2 of a norm of 3 — short one
  const [d1] = weekDays();
  await loadAppWithState(page, state(staff, {
    [d1]: { marks: marksFor(staff), extra: [{ area: 'barrel', hours: 20 }], note: '' },
  }, { barrel: 3 }));
  await openAreas(page);
  const card = extraCard(page);
  await expect(card).toContainText('12.0 h more than the shortfall explains');
  await expect(card).toContainText('More was booked than the shortfall explains');
  await expect(card).toContainText('Booked, but not the predicted amount');
});

test('booking against an area at full complement is flagged on its own', async ({ page }) => {
  const staff = crew('barrel', 3, 10);          // exactly the norm
  const [d1] = weekDays();
  await loadAppWithState(page, state(staff, {
    [d1]: { marks: marksFor(staff), extra: [{ area: 'barrel', hours: 8 }], note: '' },
  }, { barrel: 3 }));
  await openAreas(page);
  const card = extraCard(page);
  await expect(card).toContainText('Booked at or above complement');
  await expect(card).toContainText('the rule predicts nothing here');
  await expect(card.locator('.inv-area-flag').first()).toContainText('8.0 h on 3/3');
});

test('less booked than allowed is not called an error — it may be a light day', async ({ page }) => {
  const staff = crew('barrel', 1, 10);          // 1 of 3: two hands short
  const [d1] = weekDays();
  await loadAppWithState(page, state(staff, {
    [d1]: { marks: marksFor(staff), extra: [], note: '' },
  }, { barrel: 3 }));
  await openAreas(page);
  const card = extraCard(page);
  await expect(card).toContainText('less than the shortfall allows');
  await expect(card).toContainText('upper bound');
  await expect(card).toContainText('Short, nothing booked');
  // The wording must not accuse: the rule only binds an area at full tilt.
  await expect(card).not.toContainText('More was booked');
});

test('with no complement anywhere the extra is counted but explicitly not checked', async ({ page }) => {
  const staff = crew('barrel', 2, 10);
  const [d1] = weekDays();
  await loadAppWithState(page, state(staff, {
    [d1]: { marks: marksFor(staff), extra: [{ area: 'barrel', hours: 8 }], note: '' },
  }, {}));
  await openAreas(page);
  const card = extraCard(page);
  await expect(card).toContainText('cannot be checked');
  await expect(card).toContainText('only counted');
  await expect(card).not.toContainText('exactly as predicted');
});

test('a line nobody stood on is idle, not short of its whole complement', async ({ page }) => {
  // One area of five running. Counting the four idle lines as short would
  // predict 13 missing hands and 104 hours of coverage on a day the plant
  // plainly did not work them.
  const staff = crew('barrel', 3, 10);
  const [d1] = weekDays();
  await loadAppWithState(page, state(staff, {
    [d1]: { marks: marksFor(staff), extra: [], note: '' },
  }));
  await openAreas(page);
  const card = extraCard(page);
  await expect(card).toContainText('0.0 h');
  await expect(card).not.toContainText('104');
  // The exclusion is reported rather than silent.
  await expect(card).toContainText('idle and not counted');
  await expect(card).toContainText('4 area-days');
});

test('the roster import carries the complements, so the check arrives switched on', async ({ page }) => {
  const staff = crew('barrel', 2, 10);
  const [d1] = weekDays();
  await loadAppWithState(page, state(staff, {
    [d1]: { marks: marksFor(staff), extra: [{ area: 'barrel', hours: 8 }], note: '' },
  }, {}));
  await openAreas(page);
  await expect(extraCard(page)).toContainText('cannot be checked');

  const res = await page.evaluate(() => (window as unknown as {
    applyRosterImport: (d: unknown) => { targets: number };
  }).applyRosterImport({
    staff: [],
    areaTargets: { barrel: 3, pickling: 3, 'not-an-area': 9 },
  }));
  // `pickling` is a retired id and is re-pointed on the way in; the unknown one
  // is dropped rather than creating a phantom area.
  expect(res.targets).toBe(2);

  await page.locator('[data-action="invAttView"][data-view="day"]').click();
  await page.locator('[data-action="invAttView"][data-view="areas"]').click();
  await expect(extraCard(page)).toContainText('exactly as predicted');
  await expect(page.locator('.inv-area-row', { hasText: 'Pickling A1+A2' })).toContainText('3');
});

/* ===== THE AREA REALIGNMENT ===== */

test('retired area ids are re-pointed: pickling to the VAT side, colour into A1', async ({ page }) => {
  const [d1] = weekDays();
  await loadAppWithState(page, {
    ...emptyState(),
    incomingMaterial: noSeedIM(),
    areaTargets: {},
    labour: LABOUR,
    staff: [
      { id: 1, name: 'OLD PICKLER', comp: 'hourly', dayRate: 0, hourRate: 47.5, area: 'pickling', onFloor: true, active: true },
      { id: 2, name: 'OLD COLOURIST', comp: 'hourly', dayRate: 0, hourRate: 47.5, area: 'colour', onFloor: true, active: true },
    ],
    attendance: {
      [d1]: {
        marks: {
          1: { st: 'P', hours: 8, ot: 0, area: 'pickling' },
          2: { st: 'P', hours: 8, ot: 0, area: 'colour' },
        },
        extra: [{ area: 'colour', hours: 4 }],
        note: '',
      },
    },
  });
  await openAreas(page);
  // Colour is a step inside VAT A1, not a place with a crew, so both the mark
  // and the extra booking land there.
  await expect(page.locator('.inv-area-row', { hasText: 'VAT A1' })).toContainText('4.0');
  await expect(page.locator('.inv-area-row', { hasText: 'Pickling A1+A2' })).toBeVisible();
  await expect(page.locator('#attContent')).not.toContainText('Colour');
});
