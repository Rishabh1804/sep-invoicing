import { test, expect, Page } from '@playwright/test';
import { emptyState, loadAppWithState, noSeedIM, switchTab, todayIso } from './fixtures';

/*
 * OT blocks.
 *
 * The owner's rule (28 Aug 2026): an OT block books the extra exactly as a
 * general shift does — against the shortfall in the area that ran — credited
 * the block's OWN length rather than a full eight.
 *
 * This replaces the earlier per-hand reading, and the corpus is what settles
 * it: the norm-gap reading reproduces every recorded block tag, including the
 * one `soma-internal/attendance/2026-W31.md:150` calls "internally
 * inconsistent". Each headline spec below reproduces one of those tags.
 *
 * A block needs three things the marks cannot give it: its length (from its
 * own in/out times), its complement (from the areas it covers) and its head
 * count (from its named crew — a hand on one area all day turns up in another
 * area's evening block, so the marks would put the head in the wrong place).
 * Any of the three missing and the row is reported, never reconciled at a
 * guess.
 */

const NORMS = {
  'vat-a1': 4, 'vat-a2': 4, barrel: 3, 'pickling-barrel': 2, 'pickling-vat': 3,
};

const LABOUR = {
  otMult: 1.1, restCreditMinDays: 6, extraRate: 47.5,
  modelPerKg: 3.55, gateFull: 0.9, gateHalf: 0.8, extraHoursPerHead: 8,
};

/** `n` hourly hands, ids from `base`, all on `area` for the general shift. */
function crew(area: string, n: number, base: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: base + i, name: `W${base + i}`, comp: 'hourly',
    dayRate: 0, hourRate: 47.5, area, onFloor: true, active: true,
  }));
}

function state(staff: unknown[], extra: unknown[], marks: Record<string, unknown> = {}) {
  return {
    ...emptyState(),
    incomingMaterial: noSeedIM(),
    labour: LABOUR,
    areaTargets: NORMS,
    staff,
    attendance: { [todayIso()]: { marks, extra, note: '' } },
  };
}

async function openAreas(page: Page) {
  await switchTab(page, 'pageStaff');
  await page.locator('[data-action="invAttView"][data-view="areas"]').click();
}

function extraCard(page: Page) {
  return page.locator('.inv-lab-card', { hasText: 'The extra, checked' });
}

/* ===== THE RECORDED TAGS ===== */

test('reproduces the 6 AM tag the per-hand reading had to reinterpret', async ({ page }) => {
  // soma-internal/attendance/2026-W24.md:61 — five hands in the 6:00–8:30
  // block on VAT A1, tagged `EXTRA — 3 hours`. The norm-gap reading takes the
  // tag at face value: A1's 4 plus the 2 VAT-side pickling hands it pulls with
  // it is 6, five stood, short one, 1 x 3 h = 3. The per-hand reading had to
  // restate the same tag as 5 x 3 = 15.
  const hands = crew('vat-a1', 5, 10);
  await loadAppWithState(page, state(hands, [{
    area: 'vat-a1', areas: ['vat-a1'], hours: 3, kind: 'block',
    from: '06:00', to: '08:30', crew: hands.map((w) => w.id),
  }]));
  await openAreas(page);
  const card = extraCard(page);
  await expect(card).toContainText('OT blocks');
  await expect(card).toContainText('3.0 h');
  await expect(card).toContainText('exactly');
});

test('reproduces the tag the codex called internally inconsistent', async ({ page }) => {
  // 2026-W31.md:150, Tue 28, 5 PM–12 AM. Two groups, both tagged 21.
  //   group 1 — A1 + pickling, 3 hands: norm 4+2=6, short 3, 3 x 7 = 21
  //   group 2 — barrel + pickling, 2 hands: norm 3+2=5, short 3, 3 x 7 = 21
  // The codex read group 2 as 2 x 7 = 14 and called the pair inconsistent.
  // Under the shortfall rule both are exactly 21 and nothing is inconsistent.
  const g1 = crew('vat-a1', 3, 10);
  const g2 = crew('barrel', 2, 20);
  await loadAppWithState(page, state([...g1, ...g2], [
    { area: 'vat-a1', areas: ['vat-a1'], hours: 21, kind: 'block',
      from: '17:00', to: '00:00', crew: g1.map((w) => w.id) },
    { area: 'barrel', areas: ['barrel'], hours: 21, kind: 'block',
      from: '17:00', to: '00:00', crew: g2.map((w) => w.id) },
  ]));
  await openAreas(page);
  const card = extraCard(page);
  await expect(card).toContainText('42.0 h');   // both rows, both exact
  await expect(card).toContainText('exactly');
  await expect(card).not.toContainText('not the predicted amount');
});

test('one tag spanning both VAT lines takes all three pickling hands', async ({ page }) => {
  // 2026-W32.md:143 — A1 four hands, A2 three, ONE tag of 28 over the pair.
  // Only 4+4+3 = 11 reconciles: short 4, 4 x 7 = 28. Folding 2 per line would
  // give 12, short 5, and predict 35 against a day that balances exactly.
  const a1 = crew('vat-a1', 4, 10);
  const a2 = crew('vat-a2', 3, 20);
  await loadAppWithState(page, state([...a1, ...a2], [{
    area: 'vat-a1', areas: ['vat-a1', 'vat-a2'], hours: 28, kind: 'block',
    from: '17:00', to: '00:00', crew: [...a1, ...a2].map((w) => w.id),
  }]));
  await openAreas(page);
  await expect(extraCard(page)).toContainText('28.0 h');
  await expect(extraCard(page)).toContainText('exactly');
});

test('when pickling carries its own row nothing folds into the VAT rows', async ({ page }) => {
  // 2026-W32.md:170 — three separate tags, 7 / 7 / 21. Pickling is tagged in
  // its own right, so A1 and A2 are judged on a bare 4 rather than 4+2: three
  // hands each, short one each, 1 x 7 = 7. Pickling stood nobody against its
  // 3, so 3 x 7 = 21. Folding here would predict 14 / 14 and break all three.
  const a1 = crew('vat-a1', 3, 10);
  const a2 = crew('vat-a2', 3, 20);
  await loadAppWithState(page, state([...a1, ...a2], [
    { area: 'vat-a1', areas: ['vat-a1'], hours: 7, kind: 'block',
      from: '17:00', to: '00:00', crew: a1.map((w) => w.id) },
    { area: 'vat-a2', areas: ['vat-a2'], hours: 7, kind: 'block',
      from: '17:00', to: '00:00', crew: a2.map((w) => w.id) },
    { area: 'pickling-vat', areas: ['pickling-vat'], hours: 21, kind: 'block',
      from: '17:00', to: '00:00', crew: [] },
  ]));
  await openAreas(page);
  await expect(extraCard(page)).toContainText('35.0 h');
  await expect(extraCard(page)).toContainText('exactly');
});

test('two VAT rows in one block still take three pickling hands, never four', async ({ page }) => {
  // Owner, 28 Aug 2026: both VAT lines at full tilt is 4 + 4 + 3 — never
  // 4 + 4 + 4. Folding 2 into each row would assert four pickling hands where
  // three exist, so the fold is computed for the BLOCK and shared out.
  const a1 = crew('vat-a1', 4, 10);
  const a2 = crew('vat-a2', 3, 20);
  await loadAppWithState(page, state([...a1, ...a2], [
    { area: 'vat-a1', areas: ['vat-a1'], hours: 14, kind: 'block',
      from: '17:00', to: '00:00', crew: a1.map((w) => w.id) },
    { area: 'vat-a2', areas: ['vat-a2'], hours: 14, kind: 'block',
      from: '17:00', to: '00:00', crew: a2.map((w) => w.id) },
  ]));
  await openAreas(page);
  // Block norm 11 across the pair, 7 hands, short 4, 4 x 7 = 28 — the same
  // total as W32 (143) writes on ONE row. Per-row folding would give 12,
  // short 5, and predict 35.
  await expect(extraCard(page)).toContainText('28.0 h');
});

test('the prediction does not depend on how the relay split the sheet', async ({ page }) => {
  // The invariance that makes the fold trustworthy: the same day, tagged as
  // one row over both VAT lines or as two rows of one line each, must predict
  // the same total. Otherwise the answer turns on nothing but the tagging.
  const a1 = crew('vat-a1', 4, 10);
  const a2 = crew('vat-a2', 3, 20);
  const both = [...a1, ...a2].map((w) => w.id);

  await loadAppWithState(page, state([...a1, ...a2], [{
    area: 'vat-a1', areas: ['vat-a1', 'vat-a2'], hours: 28, kind: 'block',
    from: '17:00', to: '00:00', crew: both,
  }]));
  await openAreas(page);
  await expect(extraCard(page)).toContainText('28.0 h');
  await expect(extraCard(page)).toContainText('exactly');
});

/* ===== THE MULTIPLIER IS THE WHOLE DIFFERENCE ===== */

test('the same shortfall books eight on a shift and the block’s own hours on a block', async ({ page }) => {
  // One hand short of VAT A1 twice over: once on the general shift, once in a
  // 3-hour morning block. 8 against 3 — same rule, different multiplier.
  const shift = crew('vat-a1', 3, 10);
  const blockCrew = crew('vat-a2', 3, 20);
  await loadAppWithState(page, state([...shift, ...blockCrew], [
    { area: 'vat-a1', hours: 8, kind: 'coverage' },
    { area: 'vat-a2', areas: ['vat-a2'], hours: 3, kind: 'block',
      from: '06:00', to: '09:00', crew: blockCrew.map((w) => w.id) },
  ], Object.fromEntries([...shift, ...blockCrew].map((w) => [w.id,
    { st: 'P', hours: 8, ot: 0, area: w.area }]))));
  await openAreas(page);
  const card = extraCard(page);
  // The shift side: A1 at 3 of 4, short 1, x 8.
  await expect(card).toContainText('8.0');
  // The block side, reported apart rather than summed into it.
  await expect(card).toContainText('OT blocks');
  await expect(card).toContainText('3.0 h');
});

test('a block past midnight is measured forwards, not backwards', async ({ page }) => {
  // 17:00 to 00:00 is seven hours, not minus seventeen. The evening slot runs
  // to midnight habitually, so this is the common case rather than an edge.
  const hands = crew('vat-a1', 4, 10);
  await loadAppWithState(page, state(hands, [{
    area: 'vat-a1', areas: ['vat-a1'], hours: 14, kind: 'block',
    from: '17:00', to: '00:00', crew: hands.map((w) => w.id),
  }]));
  await openAreas(page);
  // 2026-W32.md:121 — four hands, norm 6, short 2, 2 x 7 = 14.
  await expect(extraCard(page)).toContainText('14.0 h');
  await expect(extraCard(page)).toContainText('exactly');
});

/* ===== WHAT IT REFUSES TO GUESS ===== */

test('a block missing its times is reported, never reconciled at a guess', async ({ page }) => {
  // Without the length there is no multiplier, and 21 is three hands short of
  // a 7-hour block and also seven short of a 3-hour one. Deriving it from the
  // tag would make the check vacuous by construction.
  const hands = crew('vat-a1', 3, 10);
  await loadAppWithState(page, state(hands, [{
    area: 'vat-a1', areas: ['vat-a1'], hours: 21, kind: 'block',
    crew: hands.map((w) => w.id),
  }]));
  await openAreas(page);
  const card = extraCard(page);
  await expect(card).toContainText('Not checkable');
  await expect(card).toContainText('21.0 h');
  // Counted in the bill regardless — it is unverifiable, not unpaid.
  await expect(card).toContainText('Extra at the contract tier');
});

test('a block missing its crew is reported rather than read off the marks', async ({ page }) => {
  // The marks say where a worker stood on the GENERAL shift. W31 Wed has a
  // hand on barrel pickling all day and in the VAT A1 evening block; reading
  // the marks would put that head in the wrong area and invent a shortfall.
  const hands = crew('vat-a1', 3, 10);
  await loadAppWithState(page, state(hands, [{
    area: 'vat-a1', areas: ['vat-a1'], hours: 21, kind: 'block',
    from: '17:00', to: '00:00',
  }], Object.fromEntries(hands.map((w) => [w.id, { st: 'P', hours: 8, ot: 0, area: 'vat-a1' }]))));
  await openAreas(page);
  await expect(extraCard(page)).toContainText('Not checkable');
});

test('a block whose booking the shortfall does not explain is flagged with its date', async ({ page }) => {
  const hands = crew('vat-a1', 4, 10);
  await loadAppWithState(page, state(hands, [{
    area: 'vat-a1', areas: ['vat-a1'], hours: 30, kind: 'block',
    from: '17:00', to: '00:00', crew: hands.map((w) => w.id),
  }]));
  await openAreas(page);
  const card = extraCard(page);
  await expect(card).toContainText('not the predicted amount');
  await expect(card).toContainText('30.0 h against 14.0 h');
});

/* ===== ENTRY ===== */

test('the entry row shows the block’s own check as it is typed', async ({ page }) => {
  const hands = crew('vat-a1', 5, 10);
  await loadAppWithState(page, state(hands, [{
    area: 'vat-a1', areas: ['vat-a1'], hours: 3, kind: 'block',
    from: '06:00', to: '08:30', crew: hands.map((w) => w.id),
  }]));
  await switchTab(page, 'pageStaff');

  const block = page.locator('.inv-att-block').first();
  await expect(block).toBeVisible();
  await expect(block.locator('.inv-att-block-len')).toContainText('2.5');
  // 5 of 6, short 1, x 2.5 h = 2.5 — and the row says so where it is typed
  // rather than making the operator leave for the Areas view to find out.
  await expect(block.locator('.inv-att-block-check')).toContainText('5 of 6');
});

test('the entry preview agrees with the card about the pickling fold', async ({ page }) => {
  // The fold depends on whether ANOTHER row in the same block tags pickling,
  // so the preview has to see its siblings. Judged on the row alone it would
  // fold 2 into A1 and show a norm of 6 where the card, seeing the pickling
  // row, uses 4 — the two surfaces disagreeing about the same day.
  const a1 = crew('vat-a1', 3, 10);
  await loadAppWithState(page, state(a1, [
    { area: 'vat-a1', areas: ['vat-a1'], hours: 7, kind: 'block',
      from: '17:00', to: '00:00', crew: a1.map((w) => w.id) },
    { area: 'pickling-vat', areas: ['pickling-vat'], hours: 21, kind: 'block',
      from: '17:00', to: '00:00', crew: [] },
  ]));
  await switchTab(page, 'pageStaff');
  // 3 of 4, not 3 of 6 — pickling is carrying its own norm on the next row.
  await expect(page.locator('.inv-att-block-check').first()).toContainText('3 of 4');
});

test('toggling an area off leaves the row booked somewhere real', async ({ page }) => {
  // `area` is what the per-area hour and cost tallies bucket on, so a row that
  // lost its last area must not keep booking against the one it used to name.
  const hands = crew('vat-a1', 3, 10);
  await loadAppWithState(page, state(hands, [{
    area: 'vat-a1', areas: ['vat-a1'], hours: 7, kind: 'block',
    from: '17:00', to: '00:00', crew: hands.map((w) => w.id),
  }]));
  await switchTab(page, 'pageStaff');
  await page.locator('.inv-att-block-areas .inv-att-chip-on').first().click();

  const x = await page.evaluate((iso) => {
    const s = JSON.parse(localStorage.getItem('sep_invoicing_state')!);
    return s.attendance[iso].extra[0];
  }, todayIso());
  expect(x.areas).toEqual([]);
  expect(x.area).toBe('flex');
});
