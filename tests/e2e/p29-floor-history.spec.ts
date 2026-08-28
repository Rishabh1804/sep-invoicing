import { test, expect, Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, recentTs, switchTab, todayIso } from './fixtures';

/*
 * The floor in the activity log, and the door the history arrives through.
 *
 * Two things are under test here and they are halves of one job. Attendance is
 * seeded through the ROSTER route — Settings → Import replaces the whole state
 * and would take every invoice with it — and once seeded it has to be readable
 * as history, which is what the Floor rows are for.
 *
 * The load-bearing property on the import side is that marks name a WORKER, not
 * an id. Ids are per-device: two devices that typed the same person gave them
 * different numbers, so an id in a file attaches a day's marks to whoever holds
 * that number here. It is the same reason the roster itself merges by name.
 *
 * The load-bearing property on the history side is that TWO CLOCKS meet in one
 * list. An invoice is dated by when it was recorded; a floor day has no such
 * stamp and is dated by the day it describes. Every floor row says so, because
 * unlabelled the two read as a single timeline.
 */

/* Invented people on invented rates. The repo is public and its built page is
   served to anyone, so a fixture pairing a real name with a real day rate would
   publish payroll — which is the whole reason the roster ships empty and arrives
   through an import instead. What is under test is the name-resolution
   mechanism, and that does not care whose names these are. */
const ROSTER = [
  { name: 'Test Monthly', comp: 'monthly', dayRate: 400, hourRate: 0, area: 'vat-a2' },
  { name: 'Test Hourly', comp: 'hourly', dayRate: 0, hourRate: 50, area: 'pickling-barrel' },
  { name: 'Test Second', comp: 'hourly', dayRate: 0, hourRate: 50, area: 'vat-a1' },
];

const TARGETS = { 'vat-a1': 4, 'vat-a2': 4, barrel: 3, 'pickling-barrel': 2, 'pickling-vat': 3 };

/* Arm importRoster's own onchange handler and hand it a real File, so what is
   under test is the handler rather than a re-implementation of it. */
async function importFile(page: Page, payload: unknown) {
  await switchTab(page, 'pageStaff');
  await page.evaluate((data) => {
    (window as unknown as { importRoster: () => void }).importRoster();
    const inp = document.getElementById('rosterFileInput') as HTMLInputElement;
    const dt = new DataTransfer();
    dt.items.add(new File([JSON.stringify(data)], 'seed.json', { type: 'application/json' }));
    inp.files = dt.files;
    inp.dispatchEvent(new Event('change'));
  }, payload);
}

/* State is read back off disk rather than off a global, the same way every
   other spec here does it — and it also proves the import was persisted. */
function stored(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('sep_invoicing_state')!));
}

async function seedFloor(page: Page, attendance: Record<string, unknown>) {
  await importFile(page, { staff: ROSTER, areaTargets: TARGETS, attendance });
  await expect(page.locator('.inv-toast')).toContainText('day', { timeout: 5000 });
}

async function floorRows(page: Page) {
  await switchTab(page, 'pageHistory');
  return page.locator('.inv-history-item');
}

test.describe('P29: attendance through the roster door', () => {
  test('marks resolve by name onto this device’s ids', async ({ page }) => {
    await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM() });
    await seedFloor(page, {
      '2026-05-04': {
        marks: [
          { name: 'Test Monthly', st: 'P', ot: 0, hours: 0, area: 'vat-a2' },
          { name: 'Test Second', st: 'P', ot: 0, hours: 0, area: 'vat-a1' },
        ],
        extra: [],
      },
    });

    const S = await stored(page);
    const day = S.attendance['2026-05-04'];
    const ids = Object.keys(day.marks);
    const state = {
      names: ids.map((id) => S.staff.find((w: any) => String(w.id) === id)?.name).sort(),
      areas: ids.map((id) => day.marks[id].area).sort(),
    };
    // The file named nobody by id, and the marks still landed on the right two.
    expect(state.names).toEqual(['Test Monthly', 'Test Second']);
    expect(state.areas).toEqual(['vat-a1', 'vat-a2']);
  });

  test('a name not on the roster is dropped and COUNTED, never invented', async ({ page }) => {
    await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM() });
    await importFile(page, {
      staff: ROSTER,
      attendance: {
        '2026-05-04': {
          marks: [
            { name: 'Test Monthly', st: 'P', area: 'vat-a2' },
            { name: 'Nobody At All', st: 'P', area: 'vat-a1' },
          ],
          extra: [],
        },
      },
    });
    // Creating the worker would put a row with no comp class and no rate on the
    // roster, and the labour figure would then read short with nothing saying why.
    await expect(page.locator('.inv-toast')).toContainText('1 mark for names not on the roster');
    expect((await stored(page)).staff.length).toBe(3);
  });

  test('a day already recorded is KEPT, never overwritten by a seed', async ({ page }) => {
    await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM() });
    await seedFloor(page, {
      '2026-05-04': { marks: [{ name: 'Test Monthly', st: 'P', area: 'vat-a2' }], extra: [] },
    });
    // Same date, different content: the second import must not touch it.
    await importFile(page, {
      staff: ROSTER,
      attendance: {
        '2026-05-04': { marks: [{ name: 'Test Second', st: 'A', area: 'vat-a1' }], extra: [] },
      },
    });
    await expect(page.locator('.inv-toast')).toContainText('1 already recorded, kept');
    const day = (await stored(page)).attendance['2026-05-04'];
    const id = Object.keys(day.marks)[0];
    expect({ n: Object.keys(day.marks).length, st: day.marks[id].st })
      .toEqual({ n: 1, st: 'P' });
  });

  test('a crew-less block imports and reports as Not checkable, hours still counted',
    async ({ page }) => {
      await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM() });
      await seedFloor(page, {
        '2026-05-04': {
          marks: [{ name: 'Test Monthly', st: 'P', area: 'vat-a2' }],
          // The pre-27-July shape: times and a tag, written as prose with no
          // names. This is the honest read — not a reason to drop the row.
          extra: [{ kind: 'block', areas: ['vat-a1'], crew: [], from: '17:00', to: '00:00', hours: 21 }],
        },
      });
      const block = (await stored(page)).attendance['2026-05-04'].extra[0];
      expect(block.kind).toBe('block');
      expect(block.crew).toEqual([]);
      expect(block.hours).toBe(21);

      // The claim in the title is about the RECONCILER, so the reconciler is
      // what gets asserted: an empty crew is "no crew recorded", never a head
      // count of zero — read as zero it invents a full-complement shortfall
      // and books the hours as evidence about staffing.
      await page.locator('[data-action="invAttView"][data-view="areas"]').first().click();
      // Walk the Areas card back to the seeded week.
      for (let i = 0; i < 20; i++) {
        const txt = await page.locator('#attContent').innerText();
        if (!txt.includes('No attendance recorded')) break;
        await page.locator('[data-action="invAttWeekStep"][data-step="-1"]').click();
      }
      const card = page.locator('#attContent');
      await expect(card).toContainText('Not checkable');
      await expect(card).toContainText('21.0 h');
    });

  test('a mistyped absence never imports as a paid present day', async ({ page }) => {
    await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM() });
    await importFile(page, {
      staff: ROSTER,
      attendance: {
        '2026-05-04': {
          marks: [
            { name: 'Test Monthly', st: ' a ', ot: 2, hours: 3 },   // padded lowercase absence
            { name: 'Test Hourly', st: 'X', area: 'vat-a1' },        // unrecognised state
          ],
          extra: [],
        },
      },
    });
    // The unrecognised state is dropped and counted, never coerced to present.
    await expect(page.locator('.inv-toast')).toContainText('1 mark for names not on the roster');
    const day = (await stored(page)).attendance['2026-05-04'];
    const ids = Object.keys(day.marks);
    expect(ids.length).toBe(1);
    const m = day.marks[ids[0]];
    // Normalised to a real absence — and absent pays nothing and worked
    // nothing, so the stray ot/hours are zeroed, the same invariant the entry
    // UI enforces.
    expect(m.st).toBe('A');
    expect(m.ot).toBe(0);
    expect(m.hours).toBe(0);
  });

  test('a dropped booked-hours entry and a partially-resolved crew are COUNTED',
    async ({ page }) => {
      await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM() });
      await importFile(page, {
        staff: ROSTER,
        attendance: {
          '2026-05-04': {
            marks: [{ name: 'Test Monthly', st: 'P', area: 'vat-a2' }],
            extra: [
              { kind: 'coverage', area: 'cantee', hours: 8 },   // typo'd area
              // One unknown crew name makes the whole head count unreliable —
              // dropping just that name would leave a SMALLER count that reads
              // as real, and the reconciler would derive a shortfall from it.
              { kind: 'block', areas: ['vat-a1'], crew: ['Test Second', 'Nobody Here'],
                from: '17:00', to: '00:00', hours: 21 },
            ],
          },
        },
      });
      const toast = page.locator('.inv-toast');
      await expect(toast).toContainText('1 booked-hours entry not recognised');
      await expect(toast).toContainText('1 block crew with unknown names, kept as not checkable');
      const day = (await stored(page)).attendance['2026-05-04'];
      expect(day.extra.length).toBe(1);
      expect(day.extra[0].crew).toEqual([]);
    });
});

test.describe('P29: the floor in the activity log', () => {
  test('a block naming NO area is kept, not dropped — the hours are still paid',
    async ({ page }) => {
      await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM() });
      await seedFloor(page, {
        '2026-05-04': {
          marks: [{ name: 'Test Monthly', st: 'P', area: 'vat-a2' }],
          // The shop writes some evening blocks purely as out-times, which
          // states the hours without saying which line ran. Dropping the row
          // would take real booked hours out of the bill.
          extra: [{ kind: 'block', areas: [], crew: [], from: '17:00', to: '00:00', hours: 13 }],
        },
      });
      const block = (await stored(page)).attendance['2026-05-04'].extra[0];
      expect(block.kind).toBe('block');
      expect(block.areas).toEqual([]);
      expect(block.hours).toBe(13);
      // Unattributed cost buckets to flex, which is what an unplaced hand is.
      expect(block.area).toBe('flex');
    });

  test('an attendance day is dated by the day it describes, and says so', async ({ page }) => {
    await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM() });
    await seedFloor(page, {
      '2026-05-04': {
        marks: [
          { name: 'Test Monthly', st: 'P', ot: 2, area: 'vat-a2' },
          { name: 'Test Second', st: 'H', area: 'vat-a1' },
          { name: 'Test Hourly', st: 'A', area: 'pickling-barrel' },
        ],
        extra: [],
      },
    });
    const rows = await floorRows(page);
    const shift = rows.filter({ hasText: 'Attendance recorded' });
    await expect(shift).toHaveCount(1);
    await expect(shift).toContainText('1 present, 1 half, 1 absent');
    await expect(shift).toContainText('2.0 h OT');
    // Absent hands are not "where everybody was".
    await expect(shift).toContainText('VAT A2 1');
    // The clock label is the whole point: two clocks in one list, told apart.
    await expect(shift).toContainText('floor day');
    await expect(shift).toContainText('4 May 2026');
    // Nothing recorded an entry time, so none is shown: the midday anchor is a
    // sort key, and rendering it would put a plausible-looking '12:00' on
    // exactly the rows the two-clock labelling exists to keep honest.
    await expect(shift).not.toContainText('12:00');
  });

  test('each booked extra is its own row, naming where it went', async ({ page }) => {
    await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM() });
    await seedFloor(page, {
      '2026-05-04': {
        marks: [{ name: 'Test Monthly', st: 'P', area: 'vat-a2' }],
        extra: [
          { kind: 'coverage', area: 'vat-a1', hours: 8 },
          { kind: 'block', areas: ['vat-a1', 'pickling-vat'], crew: [], from: '17:00', to: '00:00', hours: 21 },
        ],
      },
    });
    const rows = await floorRows(page);
    await expect(rows.filter({ hasText: 'general shift' }))
      .toContainText('8.0 h booked to VAT A1');
    const block = rows.filter({ hasText: 'OT block' });
    await expect(block).toContainText('21.0 h booked to VAT A1 + Pickling A1+A2');
    await expect(block).toContainText('17:00–00:00');
    // Says WHICH input is missing, in the row — rather than making the reader
    // open the Areas card to find out why the block never reconciles.
    await expect(block).toContainText('no crew recorded');
  });

  test('the Floor chip filters to the floor, and a client filter excludes it',
    async ({ page }) => {
      const state = emptyState();
      state.incomingMaterial = noSeedIM();
      // One invoice so the client dropdown has something to select — and so the
      // filtered list has a row that legitimately survives.
      state.invoices = [{
        id: 1, clientId: 1, clientName: 'TEST CLIENT KG', displayNumber: 'SEP/TEST-001',
        date: todayIso(), createdAt: recentTs(), status: 'created', lineItems: [],
        grandTotal: 1000, taxableValue: 1000,
      }];
      await loadAppWithState(page, state);
      await seedFloor(page, {
        '2026-05-04': {
          marks: [{ name: 'Test Monthly', st: 'P', area: 'vat-a2' }],
          extra: [{ kind: 'coverage', area: 'vat-a1', hours: 8 }],
        },
      });
      await switchTab(page, 'pageHistory');
      await page.locator('[data-action="invHistoryType"][data-type="floor"]').click();
      const rows = page.locator('.inv-history-item');
      // The attendance day and its one booked extra — and NOT the invoice.
      await expect(rows).toHaveCount(2);
      await expect(rows.filter({ hasText: 'SEP/TEST-001' })).toHaveCount(0);

      // A client filter is a question about one account. The floor has no
      // account, so listing the shop's Tuesday under a client asserts a
      // connection that does not exist.
      await page.locator('[data-action="invHistoryType"][data-type="all"]').click();
      await page.selectOption('#historyClientFilter', { index: 1 });
      await expect(page.locator('.inv-history-item').filter({ hasText: 'Attendance recorded' }))
        .toHaveCount(0);
      // The account's own row is still there — the filter narrowed, it did not empty.
      await expect(page.locator('.inv-history-item').filter({ hasText: 'SEP/TEST-001' }))
        .not.toHaveCount(0);
    });

  test('an explained exception is on the RECORDED clock, not the floor one',
    async ({ page }) => {
      const state = emptyState();
      state.incomingMaterial = noSeedIM();
      (state as Record<string, unknown>).extraExceptions = [{
        iso: '2026-05-04', scope: 'area', key: 'vat-a1', kind: 'over', label: 'VAT A1',
        expected: 8, booked: 16, reason: 'Second crew ran the rework batch',
        at: new Date(2026, 6, 1, 9, 30).getTime(),
      }];
      await loadAppWithState(page, state);
      await switchTab(page, 'pageHistory');
      const row = page.locator('.inv-history-item').filter({ hasText: 'exception explained' });
      await expect(row).toContainText('expected 8.0 h, booked 16.0 h');
      await expect(row).toContainText('Second crew ran the rework batch');
      // It has a real record-time, so it is NOT relabelled as a floor day —
      // and it is dated July, when it was written, not May, which it is about.
      await expect(row).not.toContainText('floor day');
      await expect(row).toContainText('1 Jul 2026');
    });

  test('the CSV carries the clock too, so screen and export cannot disagree',
    async ({ page }) => {
      await loadAppWithState(page, { ...emptyState(), incomingMaterial: noSeedIM() });
      await seedFloor(page, {
        '2026-05-04': { marks: [{ name: 'Test Monthly', st: 'P', area: 'vat-a2' }], extra: [] },
      });
      await switchTab(page, 'pageHistory');
      const csv = await page.evaluate(() => {
        const rows: string[] = [];
        const orig = URL.createObjectURL;
        (URL as unknown as Record<string, unknown>).createObjectURL = (b: Blob) => {
          (b as Blob).text().then((t) => rows.push(t));
          return 'blob:stub';
        };
        (window as unknown as { exportHistoryCSV: () => void }).exportHistoryCSV();
        (URL as unknown as Record<string, unknown>).createObjectURL = orig;
        return new Promise<string>((r) => setTimeout(() => r(rows.join('')), 200));
      });
      // The header row is joined raw, not run through cell() — unquoted.
      expect(csv).toContain('Dated by');
      expect(csv).toContain('"floor day"');
    });
});
