import { test, expect, Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab } from './fixtures';

/**
 * The extra, reconciled against the staffing norms.
 *
 * The rule the floor is run to: a hand missing from an area running at full
 * tilt is covered by the crew who are there, and eight hours are booked to the
 * area for it. That makes the extra a *prediction* — `8 × (norm − heads)` per
 * unit per day — and a prediction can be checked.
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
  // The case the rule was ruled on. The recorded decode lists four rows —
  // A1 3/4, A2 3/4, Barrel pickling 2/2 (at norm), Pickling A1+A2 2/3 — three
  // short one hand apiece, 3 x 8 = 24 man-hours at Rs47.50 = Rs1,140, against
  // 24 h booked. Barrel is staffed to its norm here so the barrel block nets to
  // no shortfall, which is what lets the four-row decode and this five-area
  // fixture agree.
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

  const card = page.locator('.inv-card', { hasText: 'The extra, paid pro-rata' });
  await expect(card).toBeVisible();
  // 8 h over the two-hand pickling crew is 4.0 each; over the three-hand VAT
  // crews it is 2.7. The barrel-pickling pair were at norm and carry nothing,
  // so they are absent from the list entirely.
  await expect(card).toContainText('4.0 h');
  await expect(card).toContainText('2.7 h');
  await expect(card).not.toContainText('PICKLING-BARREL');
  // The shares ARE money now (owner, 28 Aug 2026): 4.0 h at the default
  // 47.50 contract rate is a priced share — but it stays under the EXTRA
  // line, disbursed by Shyam on the floor, never a per-worker wage line.
  await expect(card).toContainText('₹190.00');
  await expect(card).toContainText('disbursed by Shyam on the floor');
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
  // The barrel block fully crewed (3 + 2 = its combined norm of five) and
  // nothing else running or booked. Counting the three idle units as short
  // would predict eleven missing hands and 88 hours of coverage on a day the
  // plant plainly did not work them.
  const staff = [...crew('barrel', 3, 10), ...crew('pickling-barrel', 2, 20)];
  const [d1] = weekDays();
  await loadAppWithState(page, state(staff, {
    [d1]: { marks: marksFor(staff), extra: [], note: '' },
  }));
  await openAreas(page);
  const card = extraCard(page);
  await expect(card).toContainText('0.0 h');
  await expect(card).not.toContainText('88');
  // The exclusion is reported rather than silent.
  await expect(card).toContainText('idle and not counted');
  await expect(card).toContainText('3 unit-days');
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

test('a unit with no heads but hours booked to it is fully short, not idle', async ({ page }) => {
  // The recorded shape: a zero-head `Pickling A1/A2` row carrying EXTRA 24
  // HOURS against a norm of three — 8 x 3, exact. Judging it idle would drop it
  // from the expected side while keeping it on the booked side, and the card
  // would cry surplus on a day the shop reconciles to the hour.
  const staff = [...crew('barrel', 3, 10), ...crew('pickling-barrel', 2, 20)];
  const [d1] = weekDays();
  await loadAppWithState(page, state(staff, {
    [d1]: { marks: marksFor(staff), extra: [{ area: 'pickling-vat', hours: 24 }], note: '' },
  }));
  await openAreas(page);
  const card = extraCard(page);
  // Pickling A1+A2 short its whole norm of three, covered by 8 x 3; the barrel
  // block at its complement of five contributes nothing either way.
  await expect(card).toContainText('exactly as predicted');
  await expect(card).not.toContainText('More was booked');
  // The day nobody was marked on is REPORTED — the marks were never typed, and
  // that is worth knowing — but it is not one of the three disagreements, so it
  // does not hold the check open. Before this it did, and the canonical case
  // could therefore never pass its own cross-check.
  await expect(card).toContainText('Read as fully short');
  await expect(card).toContainText('fully short and fully covered');
  await expect(card).not.toContainText('flags on the');
});

test('barrel and barrel pickling reconcile as one unit of five', async ({ page }) => {
  // Both hands typed onto the barrel side off a merged relay row. Read apart,
  // barrel is 2/3 short one (8 h expected) and barrel pickling is idle — a
  // sixteen-hour false surplus against the 24 the shop booked. Read as one
  // block of five it is short three, which is 24.
  const staff = crew('barrel', 2, 10);
  const [d1] = weekDays();
  await loadAppWithState(page, state(staff, {
    [d1]: { marks: marksFor(staff), extra: [{ area: 'barrel', hours: 24 }], note: '' },
  }, { barrel: 3, 'pickling-barrel': 2 }));
  await openAreas(page);
  const card = extraCard(page);
  await expect(card).toContainText('exactly as predicted');
  await expect(card).not.toContainText('More was booked');
});

test('a block never moves the general-shift gap, whatever else it does', async ({ page }) => {
  // Superseded 28 Aug 2026: a block IS reconciled now, against its own
  // shortfall and its own length (see p28). What survives from the earlier
  // reading is the part that was always right — a block's hours are a separate
  // question from the general shift's and must never enter its arithmetic.
  // This row carries neither times nor crew, so it is reported as unchecked
  // rather than reconciled at a guess; either way the shift gap must not move.
  const staff = crew('barrel', 3, 10);
  const [d1] = weekDays();
  await loadAppWithState(page, state(staff, {
    [d1]: { marks: marksFor(staff), extra: [{ area: 'barrel', hours: 3, kind: 'block' }], note: '' },
  }, { barrel: 3 }));   // barrel alone carries a norm, so the shift is 3 of 3
  await openAreas(page);
  const card = extraCard(page);
  await expect(card).toContainText('Not checkable');
  await expect(card).not.toContainText('Booked at or above complement');
  await expect(card).not.toContainText('More was booked');
});

test('the recorded counter-cases surface as a quantity mismatch, not as silence', async ({ page }) => {
  // W27 Mon 29 Jun and W28 Fri 10 Jul: VAT A1 at 2 of 4, tagged 8 where the
  // per-hand rule predicts 16. The owner's rule stands; these days are real and
  // the card has to show them rather than smooth them away.
  const staff = crew('vat-a1', 2, 10);
  const [d1] = weekDays();
  await loadAppWithState(page, state(staff, {
    [d1]: { marks: marksFor(staff), extra: [{ area: 'vat-a1', hours: 8 }], note: '' },
  }, { 'vat-a1': 4 }));
  await openAreas(page);
  const card = extraCard(page);
  await expect(card).toContainText('Booked, but not the predicted amount');
  await expect(card.locator('.inv-area-flag-warn').first()).toContainText('8.0 h against 16.0 h');
});

test('a share past a shift is flagged as pay to check, not settled', async ({ page }) => {
  // 24 coverage hours over two present hands is twelve each on top of a full
  // shift. The 28-Aug ruling names the payee — the crew received it — but it
  // does not repeal arithmetic: the row is flagged for checking against the
  // record rather than read as settled pay.
  const staff = crew('barrel', 2, 10);
  const [d1] = weekDays();
  await loadAppWithState(page, state(staff, {
    [d1]: { marks: marksFor(staff), extra: [{ area: 'barrel', hours: 24 }], note: '' },
  }));
  await openAreas(page);
  const card = page.locator('.inv-card', { hasText: 'The extra, paid pro-rata' });
  await expect(card.locator('.inv-area-absorb-flag').first()).toBeVisible();
  await expect(card).toContainText('does not repeal arithmetic');
});

test('hours typed on the side the heads are not is not an unmanned booking', async ({ page }) => {
  // The relay writes `Barrel & pickling` as one row about as often as two, so a
  // fully-staffed block routinely carries its heads on one id and its hours on
  // the other. Judged per area that reads as "booked where nobody was marked";
  // judged per unit — which is how the shortfall is judged — it is a unit at
  // its complement of five, and the rule predicts nothing.
  const staff = [...crew('barrel', 3, 10), ...crew('pickling-barrel', 2, 20)];
  const [d1] = weekDays();
  await loadAppWithState(page, state(staff, {
    [d1]: { marks: marksFor(staff), extra: [{ area: 'pickling-barrel', hours: 8 }], note: '' },
  }, { 'barrel': 3, 'pickling-barrel': 2 }));
  await openAreas(page);
  const card = extraCard(page);
  await expect(card).not.toContainText('Read as fully short');
  await expect(card).toContainText('Booked at or above complement');
});

test('a block is absorbed by its own crew, never by the area’s day crew', async ({ page }) => {
  // Superseded 28 Aug 2026, and the replacement is stronger: a block names the
  // people who stood the slot, so its absorption is exact rather than inferred.
  // A block with NO crew therefore has nobody to absorb it — spreading it over
  // the three hands who worked the general shift would attribute evening hours
  // to men who had gone home.
  const staff = crew('barrel', 3, 10);
  const [d1] = weekDays();
  await loadAppWithState(page, state(staff, {
    [d1]: { marks: marksFor(staff), extra: [{ area: 'barrel', hours: 3, kind: 'block' }], note: '' },
  }, { barrel: 3 }));
  await openAreas(page);
  await expect(extraCard(page)).toContainText('Not checkable');
  await expect(page.locator('.inv-card', { hasText: 'The extra, paid pro-rata' })).toHaveCount(0);
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
