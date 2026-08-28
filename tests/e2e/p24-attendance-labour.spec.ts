import { test, expect, Page } from '@playwright/test';
import {
  emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, recentTs, workingDaysBack,
} from './fixtures';

/**
 * Staff tab + labour breakdown.
 *
 * Labour is 42% of this business's cost and was a single number typed into
 * Settings. These specs pin the two things that make the measured version worth
 * more than the typed one: that the arithmetic follows the recorded marks — in
 * whichever of the three pay mechanics the worker is actually on — and that
 * what is *not* recorded is reported rather than averaged away.
 */

/** Monthly tier: day rate x days, rest days gated, OT derived at rate/8. */
const LEAD = { id: 1, name: 'AREA LEAD', comp: 'monthly', dayRate: 500, hourRate: 0, area: 'vat-a1', onFloor: true, active: true };
/** Hourly pool: every hour at one flat rate, no day rate, no multiplier. */
const POOL = { id: 2, name: 'POOL HAND', comp: 'hourly', dayRate: 0, hourRate: 47.5, area: 'barrel', onFloor: true, active: true };
/** Monthly tier, off the plant floor. */
const GUARD = { id: 3, name: 'GATE GUARD', comp: 'monthly', dayRate: 300, hourRate: 0, area: 'gate', onFloor: false, active: true };
/** On the roster before the rate was settled — the card has to say so. */
const NORATE = { id: 4, name: 'UNRATED HAND', comp: 'hourly', dayRate: 0, hourRate: 0, area: 'pickling-vat', onFloor: true, active: true };

function staffState(extra: Record<string, unknown> = {}) {
  return {
    ...emptyState(),
    incomingMaterial: noSeedIM(),
    staff: [LEAD, POOL, GUARD, NORATE],
    attendance: {},
    labour: { otMult: 1.1, restCreditMinDays: 6, extraRate: 47.5, modelPerKg: 3.55, gateFull: 0.9, gateHalf: 0.8 },
    ...extra,
  };
}

const openStaff = (page: Page) => switchTab(page, 'pageStaff');

test('an empty roster says so and offers the way in', async ({ page }) => {
  await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM(), staff: [], attendance: {} });
  await openStaff(page);
  await expect(page.locator('#attContent')).toContainText('No one on the roster yet');
  await expect(page.locator('[data-action="invAttAddWorker"]')).toBeVisible();
});

test('a worker added through the overlay reaches the roster and the day view', async ({ page }) => {
  await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM(), staff: [], attendance: {} });
  await openStaff(page);
  await page.locator('[data-action="invAttAddWorker"]').first().click();
  await page.locator('#wedName').fill('NEW HAND');
  await page.locator('#wedComp').selectOption('hourly');
  await page.locator('#wedHour').fill('47.5');
  await page.locator('[data-action="invAttSaveWorker"]').click();

  // Saving lands back on whichever view was open — Day — so the tier shows as
  // the row badge here and as the rate label only in Roster.
  await expect(page.locator('#attContent')).toContainText('NEW HAND');
  await expect(page.locator('#attContent')).toContainText('Hourly');
  await page.locator('[data-action="invAttView"][data-view="roster"]').click();
  await expect(page.locator('#attContent')).toContainText('₹47.50/h, every hour');
});

/* ===== THE THREE PAY MECHANICS ===== */

test('the monthly tier is paid by the day, not by a flat salary', async ({ page }) => {
  await loadAppWithState(page, staffState());
  await openStaff(page);

  await expect(page.locator('.inv-att-count-value')).toHaveText('0');
  await expect(page.locator('.inv-att-pill-u')).toContainText('4 unmarked');

  await page.locator(`[data-action="invAttSet"][data-id="${LEAD.id}"][data-st="P"]`).click();
  await expect(page.locator('.inv-att-count-value')).toHaveText('1');
  await expect(page.locator('.inv-lab-fixed .inv-lab-half-value')).toContainText('500.00');
  // Nothing has been paid on the variable side: nobody in the hourly pool has
  // logged an hour, and the first cut's flat-monthly accrual would have put a
  // figure here regardless.
  await expect(page.locator('.inv-lab-variable .inv-lab-half-value')).toHaveText('₹0.00');

  await page.locator(`[data-action="invAttSet"][data-id="${LEAD.id}"][data-st="P"]`).click();
  await expect(page.locator('.inv-att-count-value')).toHaveText('0');
});

test('a half day is worth half a day on the monthly tier', async ({ page }) => {
  await loadAppWithState(page, staffState());
  await openStaff(page);
  await page.locator(`[data-action="invAttSet"][data-id="${LEAD.id}"][data-st="H"]`).click();
  await expect(page.locator('.inv-lab-fixed .inv-lab-half-value')).toContainText('250.00');
  await expect(page.locator('.inv-att-pill-h')).toContainText('1 half');
});

test('the hourly pool is paid flat for every hour — no day rate, no multiplier', async ({ page }) => {
  const day = todayIso();
  await loadAppWithState(page, staffState({
    attendance: { [day]: { marks: { [POOL.id]: { st: 'P', hours: 14, ot: 0, area: 'barrel' } }, extra: [], note: '' } },
  }));
  await openStaff(page);
  // 14 h x Rs47.50 = Rs665.00 flat. A day rate with six hours of overtime at
  // x1.1 — the shape the first cut imposed — would not produce this number.
  await expect(page.locator('.inv-lab-card')).toContainText('665.00');
  await expect(page.locator('.inv-lab-card')).toContainText('Hourly pool');
  await expect(page.locator('.inv-lab-card')).toContainText('no multiplier');
});

test('an hourly worker has no half day to reach, in either view', async ({ page }) => {
  await loadAppWithState(page, staffState());
  await openStaff(page);
  await expect(page.locator(`[data-action="invAttSet"][data-id="${POOL.id}"][data-st="H"]`)).toHaveCount(0);
  await expect(page.locator(`[data-action="invAttSet"][data-id="${LEAD.id}"][data-st="H"]`)).toBeVisible();

  await page.locator('[data-action="invAttView"][data-view="week"]').click();
  const cell = page.locator(`[data-action="invAttCycle"][data-id="${POOL.id}"][data-date="${todayIso()}"]`);
  await cell.click();
  await expect(cell).toHaveText('P');
  await cell.click();
  await expect(cell).toHaveText('A');   // no H in the hourly cycle
  await cell.click();
  await expect(cell).toHaveText('·');
});

test('the week grid cycles a monthly worker through the half day', async ({ page }) => {
  await loadAppWithState(page, staffState());
  await openStaff(page);
  await page.locator('[data-action="invAttView"][data-view="week"]').click();

  const cell = page.locator(`[data-action="invAttCycle"][data-id="${LEAD.id}"][data-date="${todayIso()}"]`);
  await expect(cell).toHaveText('·');
  for (const expected of ['P', 'H', 'A', '·']) {
    await cell.click();
    await expect(cell).toHaveText(expected);
  }
});

test('monthly overtime derives from the day rate, at rate ÷ 8 × the multiplier', async ({ page }) => {
  const day = todayIso();
  await loadAppWithState(page, staffState({
    attendance: { [day]: { marks: { [LEAD.id]: { st: 'P', ot: 4, hours: 0, area: 'vat-a1' } }, extra: [], note: '' } },
  }));
  await openStaff(page);
  // 4 h x (500/8) x 1.1 = Rs275.00 — the rate card's own OT column, falling out
  // of the day rate rather than being a second number kept in step by hand.
  await expect(page.locator('.inv-lab-card')).toContainText('275.00');
});

/* A real week's hourly pool, reproduced.

   The shop's weekly slip for one W32 week foots to Rs27,549 across ten hands
   at Rs47.50/hr — 580 hours in strings like `15+18+18+18+11`, with three
   half-rupee roundings taken down. Feeding those same hours through this model
   has to land on Rs27,550.00, and the Rs1 is the slip's own rounding.

   The names are generic and the hours are not: an hour count is not payroll,
   and the point of the fixture is that the ARITHMETIC ties to a document
   somebody was actually paid against. A model that cannot reproduce a slip is
   a model nobody should price a decision with. */
test('the hourly pool reproduces a real weekly slip to the rupee', async ({ page }) => {
  const HOURS = [63, 62, 80, 73, 70, 80, 48, 40, 48, 16];   // 580 h
  const hands = HOURS.map((h, i) => ({
    id: 100 + i, name: `HAND ${String.fromCharCode(65 + i)}`, comp: 'hourly',
    dayRate: 0, hourRate: 47.5, area: 'barrel', onFloor: true, active: true,
  }));
  const day = todayIso();
  const marks: Record<string, unknown> = {};
  hands.forEach((w, i) => { marks[w.id] = { st: 'P', hours: HOURS[i], ot: 0, area: 'barrel' }; });

  await loadAppWithState(page, {
    ...emptyState(),
    incomingMaterial: noSeedIM(),
    staff: hands,
    attendance: { [day]: { marks, extra: [], note: '' } },
    labour: { otMult: 1.1, restCreditMinDays: 6, extraRate: 47.5, modelPerKg: 3.55, gateFull: 0.9, gateHalf: 0.8 },
  });
  await openStaff(page);

  const row = page.locator('.inv-lab-row', { hasText: 'Hourly pool' });
  await expect(row.locator('.inv-lab-value')).toHaveText('₹27,550.00');
  await expect(row).toContainText('580.0 h');
  // Every rupee of it is variable, and none of it is a day rate.
  await expect(page.locator('.inv-lab-variable .inv-lab-half-value')).toHaveText('₹27,550.00');
  await expect(page.locator('.inv-lab-fixed .inv-lab-half-value')).toHaveText('₹0.00');
});

/* ===== THE REST-DAY GATE ===== */

function recordedDays(count: number, marks: Record<string, unknown>) {
  const attendance: Record<string, unknown> = {};
  workingDaysBack(count).forEach((d) => {
    attendance[d] = { marks: JSON.parse(JSON.stringify(marks)), extra: [], note: '' };
  });
  return attendance;
}

test('full attendance credits the range’s rest days to the monthly tier', async ({ page }) => {
  await loadAppWithState(page, staffState({
    attendance: recordedDays(26, { [LEAD.id]: { st: 'P', ot: 0, hours: 0, area: 'vat-a1' } }),
  }));
  await switchTab(page, 'pageStats');
  await page.locator('[data-action="invStatsPeriod"][data-period="all"]').click();

  const row = page.locator('.inv-lab-row', { hasText: 'Rest days credited' });
  await expect(row).toBeVisible();
  await expect(row.locator('.inv-lab-value')).not.toHaveText('₹0.00');
});

test('attendance below the gate credits no rest days at all', async ({ page }) => {
  // Two of the twenty-six working days in the same span: well under the 80%
  // floor, so the entitlement zeroes rather than merely shrinking.
  const days = workingDaysBack(26);
  const attendance: Record<string, unknown> = {};
  [days[0], days[days.length - 1]].forEach((d) => {
    attendance[d] = { marks: { [LEAD.id]: { st: 'P', ot: 0, hours: 0, area: 'vat-a1' } }, extra: [], note: '' };
  });
  await loadAppWithState(page, staffState({ attendance }));
  await switchTab(page, 'pageStats');
  await page.locator('[data-action="invStatsPeriod"][data-period="all"]').click();

  const row = page.locator('.inv-lab-row', { hasText: 'Rest days credited' });
  await expect(row.locator('.inv-lab-value')).toHaveText('₹0.00');
});

/* ===== WHAT THE CARD REFUSES TO SAY ===== */

test('extra hours are counted in the bill and reported as unattributed', async ({ page }) => {
  const day = todayIso();
  await loadAppWithState(page, staffState({
    attendance: { [day]: { marks: { [POOL.id]: { st: 'P', hours: 8, ot: 0, area: 'barrel' } }, extra: [{ area: 'barrel', hours: 10 }], note: '' } },
  }));
  await openStaff(page);
  await expect(page.locator('.inv-lab-card')).toBeVisible();
  await expect(page.locator('.inv-lab-card')).toContainText('475.00');   // 10 h x Rs47.50
  await expect(page.locator('.inv-lab-card')).toContainText('Extra (unattributed)');
  await expect(page.locator('.inv-lab-card')).toContainText('booked to an area rather than to a person');
});

test('hours for a worker with no rate are counted and named as unpriced', async ({ page }) => {
  const day = todayIso();
  await loadAppWithState(page, staffState({
    attendance: { [day]: { marks: { [NORATE.id]: { st: 'P', hours: 3, ot: 0, area: 'pickling-vat' } }, extra: [], note: '' } },
  }));
  await openStaff(page);
  await expect(page.locator('.inv-lab-card .inv-stats-caveat')).toBeVisible();
  await expect(page.locator('.inv-lab-card')).toContainText('3.0 h');
  await expect(page.locator('.inv-lab-card')).toContainText('UNRATED HAND');
  await expect(page.locator('.inv-lab-card')).toContainText('no rate to price them at');
});

test('off-floor wages are split out of plating cost', async ({ page }) => {
  const day = todayIso();
  await loadAppWithState(page, staffState({
    attendance: { [day]: { marks: { [GUARD.id]: { st: 'P', ot: 0, hours: 0, area: 'gate' } }, extra: [], note: '' } },
  }));
  await openStaff(page);
  await expect(page.locator('.inv-lab-card')).toContainText('off floor (gate, office)');
  await expect(page.locator('.inv-lab-card')).toContainText('300.00');
});

test('variable labour is broken down by the area it was worked in', async ({ page }) => {
  const day = todayIso();
  await loadAppWithState(page, staffState({
    attendance: {
      [day]: {
        marks: {
          [POOL.id]: { st: 'P', hours: 10, ot: 0, area: 'barrel' },     // 475.00
          [LEAD.id]: { st: 'P', ot: 2, hours: 0, area: 'pickling-vat' },   // OT 137.50
        },
        extra: [{ area: 'vat-a1', hours: 4 }],                          // 190.00
        note: '',
      },
    },
  }));
  await openStaff(page);

  const ranked = page.locator('.inv-lab-card .inv-chart-ranked');
  await expect(ranked).toBeVisible();
  await expect(ranked.locator('.inv-chart-ranked-label')).toHaveText(['Barrel', 'VAT A1', 'Pickling A1+A2']);
  // The monthly tier's day pay is excluded and the card has to say so, or the
  // shares read as a full allocation of the labour bill.
  await expect(page.locator('.inv-lab-card')).toContainText('day pay and rest days are not in here');
});

test('a day range states its coverage and draws no ₹/kg', async ({ page }) => {
  await loadAppWithState(page, staffState());
  await openStaff(page);
  await expect(page.locator('.inv-lab-card')).toContainText('working days');
  await expect(page.locator('.inv-lab-perkg')).toHaveCount(0);
});

test('deleting a worker who is on a recorded day is refused, with the count', async ({ page }) => {
  const day = todayIso();
  await loadAppWithState(page, staffState({
    attendance: { [day]: { marks: { [POOL.id]: { st: 'P', hours: 8, ot: 0, area: 'barrel' } }, extra: [], note: '' } },
  }));
  await openStaff(page);
  await page.locator('[data-action="invAttView"][data-view="roster"]').click();
  await page.locator(`[data-action="invAttEditWorker"][data-id="${POOL.id}"]`).click();
  await page.locator(`[data-action="invAttDeleteWorker"][data-id="${POOL.id}"]`).click();

  await expect(page.locator('.inv-toast')).toBeVisible();
  await expect(page.locator('.inv-toast')).toContainText('1 recorded day');
  await page.locator('[data-action="invCloseOverlay"]').first().click();
  await expect(page.locator('#attContent')).toContainText('POOL HAND');
});

/* ===== ROSTER IMPORT ===== */

test('a roster import merges by name, keeps attendance, and leaves invoices alone', async ({ page }) => {
  const day = todayIso();
  await loadAppWithState(page, staffState({
    attendance: { [day]: { marks: { [POOL.id]: { st: 'P', hours: 8, ot: 0, area: 'barrel' } }, extra: [], note: '' } },
    invoices: [{
      id: 'INV1', displayNumber: 'SEP/TEST-00001', clientId: 1, clientName: 'TEST CLIENT KG',
      date: day, createdAt: recentTs(), status: 'active', invoiceState: 'created',
      items: [{ partNumber: 'PLATE', desc: 'PLATE', unit: 'KG', qty: 100, rate: 9, amount: 900 }],
      taxableValue: 900, grandTotal: 1062,
    }],
  }));
  await openStaff(page);

  const result = await page.evaluate(() => (window as unknown as {
    applyRosterImport: (d: unknown) => Record<string, number>;
  }).applyRosterImport({
    staff: [
      { name: 'pool hand', comp: 'hourly', hourRate: 60, area: 'pickling-vat' },  // case-insensitive match
      { name: 'BRAND NEW', comp: 'monthly', dayRate: 420, area: 'vat-a2' },
      { name: '   ' },                                                        // no name → skipped
    ],
  }));
  // `targets` counts area complements set; this file carries none. The three
  // attendance counters are reported on every import, zero included: an import
  // that carried no days has to say so rather than leaving the caller to guess
  // whether the key is missing because nothing arrived or because nothing landed.
  expect(result).toEqual({
    added: 1, updated: 1, skipped: 1, targets: 0,
    days: 0, daysKept: 0, marksDropped: 0,
  });

  // `S` is declared with `let`, so it is a global binding and not a property of
  // `window` — the persisted copy is the readable one, and reading it proves
  // the write reached storage rather than only the in-memory object.
  await page.evaluate(() => (window as unknown as { saveState: () => void }).saveState());
  const after = await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('sep_invoicing_state') || '{}') as {
      staff: Array<{ id: number; name: string; hourRate: number; area: string }>;
      invoices: unknown[];
      attendance: Record<string, { marks: Record<string, unknown> }>;
    };
    return {
      pool: st.staff.find((w) => w.name === 'pool hand'),
      names: st.staff.map((w) => w.name).sort(),
      invoices: st.invoices.length,
      markedIds: Object.keys(st.attendance[Object.keys(st.attendance)[0]].marks),
    };
  });

  // Updated in place, so the id — and every attendance mark hanging off it —
  // survives. Matching on id instead would have duplicated the row.
  expect(after.pool?.id).toBe(POOL.id);
  expect(after.pool?.hourRate).toBe(60);
  expect(after.pool?.area).toBe('pickling-vat');
  expect(after.markedIds).toContain(String(POOL.id));
  expect(after.names).toContain('BRAND NEW');
  // The whole point of a roster-scoped door: Settings → Import would have
  // replaced this invoice with nothing.
  expect(after.invoices).toBe(1);
});

test('a file with no staff array is refused rather than half-applied', async ({ page }) => {
  await loadAppWithState(page, staffState());
  await openStaff(page);
  const res = await page.evaluate(() => (window as unknown as {
    applyRosterImport: (d: unknown) => { error?: string };
  }).applyRosterImport({ clients: [] }));
  expect(res.error).toContain('No staff array');
});

/* ===== MIGRATION ===== */

test('a worker on the retired flat-monthly shape is migrated to a day rate', async ({ page }) => {
  await loadAppWithState(page, {
    ...emptyState(),
    incomingMaterial: noSeedIM(),
    attendance: {},
    staff: [{ id: 1, name: 'OLD SHAPE', comp: 'permanent', monthly: 15000, dayRate: 0, hourRate: 0, area: 'vat-a1', onFloor: true, active: true }],
  });
  await openStaff(page);
  await page.locator('[data-action="invAttView"][data-view="roster"]').click();
  // 15000 / 30 = Rs500.00 a day, which is the figure the payout slips are
  // written in — the flat monthly was always the derived number, not this one.
  await expect(page.locator('#attContent')).toContainText('Monthly');
  await expect(page.locator('#attContent')).toContainText('₹500.00/day');
});

/* ===== STATS ===== */

test('Stats prints a labour ₹/kg once coverage and range allow, against the model', async ({ page }) => {
  await loadAppWithState(page, staffState({
    attendance: recordedDays(26, { [POOL.id]: { st: 'P', hours: 8, ot: 0, area: 'barrel' } }),
    invoices: [{
      id: 'INV1', displayNumber: 'SEP/TEST-00001', clientId: 1, clientName: 'TEST CLIENT KG',
      date: todayIso(), createdAt: recentTs(), status: 'active', invoiceState: 'created',
      items: [{ partNumber: 'PLATE', desc: 'PLATE', unit: 'KG', qty: 20000, rate: 9, amount: 180000 }],
      taxableValue: 180000, grandTotal: 212400,
    }],
  }));
  await switchTab(page, 'pageStats');
  // 'All' spans the attendance store's own dates, which the fixture controls
  // end to end — MTD would depend on what day of the month the suite runs.
  await page.locator('[data-action="invStatsPeriod"][data-period="all"]').click();

  const card = page.locator('.inv-lab-card');
  await expect(card).toBeVisible();
  await expect(card).toContainText('/kg');
  await expect(card).toContainText('measured labour');
  await expect(card).toContainText('modelled');
});

test('Stats withholds labour ₹/kg when the days are not on file, and says which', async ({ page }) => {
  const days = workingDaysBack(26);
  const attendance: Record<string, unknown> = {};
  [days[0], days[days.length - 1]].forEach((d) => {
    attendance[d] = { marks: { [POOL.id]: { st: 'P', hours: 8, ot: 0, area: 'barrel' } }, extra: [], note: '' };
  });
  await loadAppWithState(page, staffState({
    attendance,
    invoices: [{
      id: 'INV1', displayNumber: 'SEP/TEST-00001', clientId: 1, clientName: 'TEST CLIENT KG',
      date: todayIso(), createdAt: recentTs(), status: 'active', invoiceState: 'created',
      items: [{ partNumber: 'PLATE', desc: 'PLATE', unit: 'KG', qty: 20000, rate: 9, amount: 180000 }],
      taxableValue: 180000, grandTotal: 212400,
    }],
  }));
  await switchTab(page, 'pageStats');
  await page.locator('[data-action="invStatsPeriod"][data-period="all"]').click();

  const card = page.locator('.inv-lab-card');
  // Visible, not merely composed: a reporting path that only proves its message
  // reached the DOM is the trap the certificate run's toast fell into.
  await expect(card.locator('.inv-lab-perkg-none')).toBeVisible();
  await expect(card).toContainText('₹/kg withheld');
  await expect(card).toContainText('working days are recorded');
  await expect(card).toContainText('never neutral');
});

test('Stats stays silent about labour while the roster is empty', async ({ page }) => {
  await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM(), staff: [], attendance: {} });
  await switchTab(page, 'pageStats');
  await expect(page.locator('.inv-lab-card')).toHaveCount(0);
});
