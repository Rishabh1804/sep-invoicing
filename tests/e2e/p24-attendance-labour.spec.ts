import { test, expect, Page } from '@playwright/test';
import {
  emptyState, loadAppWithState, noSeedIM, switchTab, todayIso, recentTs, workingDaysBack,
} from './fixtures';

/**
 * Staff tab + labour breakdown.
 *
 * Labour is 42% of this business's cost and was a single number typed into
 * Settings. These specs pin the two things that make the measured version worth
 * more than the typed one: that the arithmetic follows the recorded marks, and
 * that what is *not* recorded is reported rather than averaged away.
 */

const PERM = { id: 1, name: 'PERM LEAD', comp: 'permanent', monthly: 15000, dayRate: 0, hourRate: 60, area: 'vat-a1', onFloor: true, active: true };
const CW = { id: 2, name: 'CONTRACT HAND', comp: 'contract', monthly: 0, dayRate: 500, hourRate: 47.5, area: 'barrel', onFloor: true, active: true };
const GUARD = { id: 3, name: 'GATE GUARD', comp: 'permanent', monthly: 12000, dayRate: 0, hourRate: 0, area: 'gate', onFloor: false, active: true };

function staffState(extra: Record<string, unknown> = {}) {
  return {
    ...emptyState(),
    incomingMaterial: noSeedIM(),
    staff: [PERM, CW, GUARD],
    attendance: {},
    labour: { otMult: 1.1, restCreditMinDays: 6, extraRate: 47.5, modelPerKg: 3.55 },
    ...extra,
  };
}

async function openStaff(page: Page) {
  await switchTab(page, 'pageStaff');
}

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
  await page.locator('#wedComp').selectOption('contract');
  await page.locator('#wedDay').fill('460');
  await page.locator('[data-action="invAttSaveWorker"]').click();

  await expect(page.locator('#attContent')).toContainText('NEW HAND');
  await page.locator('[data-action="invAttView"][data-view="day"]').click();
  await expect(page.locator('#attContent')).toContainText('NEW HAND');
});

test('marking the day moves the headcount and the day cost', async ({ page }) => {
  await loadAppWithState(page, staffState());
  await openStaff(page);

  // Nobody marked: on site reads 0 of 3, and all three are unmarked.
  await expect(page.locator('.inv-att-count-value')).toHaveText('0');
  await expect(page.locator('.inv-att-pill-u')).toContainText('3 unmarked');

  // One contract day at ₹500. Permanent salary accrues over the day regardless,
  // so the total is the contract wage plus one day of both monthly salaries.
  await page.locator(`[data-action="invAttSet"][data-id="${CW.id}"][data-st="P"]`).click();
  await expect(page.locator('.inv-att-count-value')).toHaveText('1');
  await expect(page.locator('.inv-lab-variable .inv-lab-half-value')).toContainText('500.00');
  await expect(page.locator('.inv-lab-fixed .inv-lab-half-value')).not.toHaveText('₹0.00');

  // Tapping the same state again clears the row back to unmarked.
  await page.locator(`[data-action="invAttSet"][data-id="${CW.id}"][data-st="P"]`).click();
  await expect(page.locator('.inv-att-count-value')).toHaveText('0');
});

test('a half day is worth half a day', async ({ page }) => {
  await loadAppWithState(page, staffState());
  await openStaff(page);
  await page.locator(`[data-action="invAttSet"][data-id="${CW.id}"][data-st="H"]`).click();
  await expect(page.locator('.inv-lab-variable .inv-lab-half-value')).toContainText('250.00');
  await expect(page.locator('.inv-att-pill-h')).toContainText('1 half');
});

test('the week grid cycles a cell and the headcount row follows', async ({ page }) => {
  await loadAppWithState(page, staffState());
  await openStaff(page);
  await page.locator('[data-action="invAttView"][data-view="week"]').click();

  const cell = page.locator(`[data-action="invAttCycle"][data-id="${CW.id}"][data-date="${todayIso()}"]`);
  await expect(cell).toHaveText('·');
  await cell.click();
  await expect(cell).toHaveText('P');
  await cell.click();
  await expect(cell).toHaveText('H');
  await cell.click();
  await expect(cell).toHaveText('A');
  await cell.click();
  await expect(cell).toHaveText('·');
});

test('extra hours are counted in the bill and reported as unattributed', async ({ page }) => {
  const day = todayIso();
  await loadAppWithState(page, staffState({
    attendance: { [day]: { marks: { [CW.id]: { st: 'P', ot: 0, area: 'barrel' } }, extra: [{ area: 'barrel', hours: 10 }], note: '' } },
  }));
  await openStaff(page);

  // 10 h at ₹47.50 = ₹475, and the card must name it as hours nobody is on.
  await expect(page.locator('.inv-lab-card')).toBeVisible();
  await expect(page.locator('.inv-lab-card')).toContainText('475.00');
  await expect(page.locator('.inv-lab-card')).toContainText('Extra (unattributed)');
  await expect(page.locator('.inv-lab-card')).toContainText('booked to an area rather than to a person');
});

test('named overtime is paid at the multiplier, not flat', async ({ page }) => {
  const day = todayIso();
  await loadAppWithState(page, staffState({
    attendance: { [day]: { marks: { [CW.id]: { st: 'P', ot: 4, area: 'barrel' } }, extra: [], note: '' } },
  }));
  await openStaff(page);
  // 4 h × ₹47.50 × 1.1 = ₹209.00 — flat would be ₹190.
  await expect(page.locator('.inv-lab-card')).toContainText('209.00');
});

test('overtime for a worker with no hour rate is counted in hours and named as unpriced', async ({ page }) => {
  const day = todayIso();
  await loadAppWithState(page, staffState({
    attendance: { [day]: { marks: { [GUARD.id]: { st: 'P', ot: 3, area: 'gate' } }, extra: [], note: '' } },
  }));
  await openStaff(page);
  await expect(page.locator('.inv-lab-card .inv-stats-caveat')).toBeVisible();
  await expect(page.locator('.inv-lab-card')).toContainText('3.0 h');
  await expect(page.locator('.inv-lab-card')).toContainText('GATE GUARD');
  await expect(page.locator('.inv-lab-card')).toContainText('no hour rate on the roster');
});

test('off-floor wages are split out of plating cost', async ({ page }) => {
  const day = todayIso();
  await loadAppWithState(page, staffState({
    attendance: { [day]: { marks: { [GUARD.id]: { st: 'P', ot: 0, area: 'gate' } }, extra: [], note: '' } },
  }));
  await openStaff(page);
  await expect(page.locator('.inv-lab-card')).toContainText('off floor (gate, office)');
});

test('variable labour is broken down by the area it was worked in', async ({ page }) => {
  const day = todayIso();
  await loadAppWithState(page, staffState({
    attendance: {
      [day]: {
        marks: {
          [CW.id]: { st: 'P', ot: 0, area: 'barrel' },
          [PERM.id]: { st: 'P', ot: 2, area: 'pickling' },
        },
        extra: [{ area: 'vat-a1', hours: 4 }],
        note: '',
      },
    },
  }));
  await openStaff(page);

  const ranked = page.locator('.inv-lab-card .inv-chart-ranked');
  await expect(ranked).toBeVisible();
  // Ranked by cost, not by headcount: barrel ₹500 > vat-a1 ₹190 > pickling ₹132.
  const labels = ranked.locator('.inv-chart-ranked-label');
  await expect(labels).toHaveText(['Barrel', 'VAT A1', 'Pickling']);
  // Permanent payroll is excluded and the card has to say so, or the shares
  // read as a full allocation of the labour bill.
  await expect(page.locator('.inv-lab-card')).toContainText('Permanent payroll is not in here');
});

test('a day range states its coverage and withholds ₹/kg with the reason', async ({ page }) => {
  await loadAppWithState(page, staffState());
  await openStaff(page);
  // The day card carries no tonnage at all, so no ₹/kg block is drawn — but the
  // coverage sentence is unconditional and has to be there either way.
  await expect(page.locator('.inv-lab-card')).toContainText('working days');
  await expect(page.locator('.inv-lab-perkg')).toHaveCount(0);
});

test('deleting a worker who is on a recorded day is refused, with the count', async ({ page }) => {
  const day = todayIso();
  await loadAppWithState(page, staffState({
    attendance: { [day]: { marks: { [CW.id]: { st: 'P', ot: 0, area: 'barrel' } }, extra: [], note: '' } },
  }));
  await openStaff(page);
  await page.locator('[data-action="invAttView"][data-view="roster"]').click();
  await page.locator(`[data-action="invAttEditWorker"][data-id="${CW.id}"]`).click();
  await page.locator(`[data-action="invAttDeleteWorker"][data-id="${CW.id}"]`).click();

  await expect(page.locator('.inv-toast')).toBeVisible();
  await expect(page.locator('.inv-toast')).toContainText('1 recorded day');
  // Still on the roster.
  await page.locator('[data-action="invCloseOverlay"]').first().click();
  await expect(page.locator('#attContent')).toContainText('CONTRACT HAND');
});

/* ===== STATS ===== */

function fullyRecordedMonth() {
  const days = workingDaysBack(26);
  const attendance: Record<string, unknown> = {};
  days.forEach((d) => {
    attendance[d] = { marks: { [CW.id]: { st: 'P', ot: 0, area: 'barrel' } }, extra: [], note: '' };
  });
  return attendance;
}

test('Stats prints a labour ₹/kg once coverage and range allow, against the model', async ({ page }) => {
  await loadAppWithState(page, staffState({
    attendance: fullyRecordedMonth(),
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
  // Only the two ends of the range recorded: the span is long enough, the
  // coverage is not.
  [days[0], days[days.length - 1]].forEach((d) => {
    attendance[d] = { marks: { [CW.id]: { st: 'P', ot: 0, area: 'barrel' } }, extra: [], note: '' };
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
