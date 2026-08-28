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
 * it — but state the population, not a superlative. Over the swept blocks in
 * W24/W31/W32/W33 (17 blocks / 23 rows once the raw relay's tags are
 * restored) the norm-gap reading reproduces every tag but ONE, named in
 * CLAUDE.md rather than smoothed away: W33 Tue 11 Aug, which reconciles only
 * at four pickling hands against a ceiling of three. (W31 Mon 27 Jul was
 * named beside it and is struck — tagged in the raw, under-booked, and
 * under-booking is an upper bound, never an error.) The per-hand reading it
 * replaces is not uniformly wrong either — it reproduces individual rows,
 * including that surviving exception.
 *
 * Each headline spec below reproduces one recorded tag, including the one
 * `soma-internal/attendance/2026-W31.md:150` calls "internally inconsistent".
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

/* The BLOCK section, and every block assertion must be scoped to it.
   Asserting on the whole card is how the 6 AM spec below went green for the
   wrong reason: `exactly` was satisfied by the general-shift headline reading
   "Booked 0.0 h — exactly as predicted" (these fixtures supply no marks, so
   that panel is 0 against 0), while the block's own verdict on the same card
   read "not the predicted amount". Both Governors caught it independently. */
function blocks(page: Page) {
  return page.locator('.inv-area-blocks');
}

/* ===== THE RECORDED TAGS ===== */

test('reproduces the 6 AM tag on the credited length, not the clock', async ({ page }) => {
  // soma-internal/attendance/2026-W24.md:61 — five hands in the 6:00–8:30
  // block, tagged `EXTRA — 3 hours`, and the same line states the convention:
  // "6:00–8:30 AM = 3 OT hr". The span is 2.5; the CREDIT is 3.
  //
  // Norm 4 + the 2 VAT-side pickling hands the line pulls with it = 6, five
  // stood, short one, 1 x 3 h = 3 — the tag at face value. On the clock span
  // it would predict 2.5 and flag the shop's most common block every morning.
  const hands = crew('vat-a1', 5, 10);
  await loadAppWithState(page, state(hands, [{
    area: 'vat-a1', areas: ['vat-a1'], hours: 3, kind: 'block',
    from: '06:00', to: '08:30', crew: hands.map((w) => w.id),
  }]));
  await openAreas(page);
  await expect(blocks(page)).toContainText('3.0 h');
  await expect(blocks(page)).toContainText('exactly');
  // The assertion that would have caught this spec passing for the wrong
  // reason. Without it, `exactly` is satisfied by the 0-vs-0 coverage panel.
  await expect(blocks(page)).not.toContainText('not the predicted amount');
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
  await expect(blocks(page)).toContainText('42.0 h');   // both rows, both exact
  await expect(blocks(page)).toContainText('exactly');
  await expect(blocks(page)).not.toContainText('not the predicted amount');
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
  await expect(blocks(page)).toContainText('28.0 h');
  await expect(blocks(page)).toContainText('exactly');
  await expect(blocks(page)).not.toContainText('not the predicted amount');
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
  await expect(blocks(page)).toContainText('35.0 h');
  await expect(blocks(page)).toContainText('exactly');
  await expect(blocks(page)).not.toContainText('not the predicted amount');
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
  await expect(blocks(page)).toContainText('28.0 h');
  await expect(blocks(page)).not.toContainText('not the predicted amount');
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
  await expect(blocks(page)).toContainText('28.0 h');
  await expect(blocks(page)).toContainText('exactly');
  await expect(blocks(page)).not.toContainText('not the predicted amount');
});

/* ===== THE MULTIPLIER IS THE WHOLE DIFFERENCE ===== */

test('the same shortfall books eight on a shift and the block’s own hours on a block', async ({ page }) => {
  // One hand short of VAT A1 twice over: once on the general shift, once in a
  // 3-hour morning block. 8 against 3 — same rule, different multiplier.
  const shift = crew('vat-a1', 3, 10);
  // Five on A2's block: norm 4 + the 2 pickling hands it pulls = 6, short 1,
  // x 3 credited = 3. The earlier fixture used three hands and was short THREE
  // — it only looked right because the assertion was card-wide.
  const blockCrew = crew('vat-a2', 5, 20);
  await loadAppWithState(page, state([...shift, ...blockCrew], [
    { area: 'vat-a1', hours: 8, kind: 'coverage' },
    { area: 'vat-a2', areas: ['vat-a2'], hours: 3, kind: 'block',
      from: '06:00', to: '09:00', crew: blockCrew.map((w) => w.id) },
  ], Object.fromEntries([...shift, ...blockCrew].map((w) => [w.id,
    { st: 'P', hours: 8, ot: 0, area: w.area }]))));
  await openAreas(page);
  // The shift side: A1 at 3 of 4, short 1, x 8 — asserted OUTSIDE the block
  // section so the two cannot satisfy each other's assertions.
  await expect(extraCard(page)).toContainText('8.0');
  // The block side, reported apart rather than summed into it.
  await expect(blocks(page)).toContainText('3.0 h');
  await expect(blocks(page)).not.toContainText('not the predicted amount');
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
  await expect(blocks(page)).toContainText('14.0 h');
  await expect(blocks(page)).toContainText('exactly');
  await expect(blocks(page)).not.toContainText('not the predicted amount');
});

test('a co-tagged `VAT A1 & pickling` row folds, as the sheet writes it', async ({ page }) => {
  // 2026-W31.md:150's own header is `----VAT A1 & pickling`. Read as pickling
  // separately staffed it predicts 4+3=7 → 28 against a tag of 21, and the
  // shop's shorthand becomes unenterable. A co-tag on a VAT row names the
  // hands that line pulls with it: norm 4 + fold 2 = 6, short 3, 3 x 7 = 21.
  // Barrel already reads `berral & pickling` this way; VAT now matches.
  const g1 = crew('vat-a1', 3, 10);
  await loadAppWithState(page, state(g1, [{
    area: 'vat-a1', areas: ['vat-a1', 'pickling-vat'], hours: 21, kind: 'block',
    from: '17:00', to: '00:00', crew: g1.map((w) => w.id),
  }]));
  await openAreas(page);
  await expect(blocks(page)).toContainText('21.0 h');
  await expect(blocks(page)).not.toContainText('not the predicted amount');
});

test('a standalone pickling row still turns the fold off for the whole block', async ({ page }) => {
  // The distinction the co-tag rule turns on: pickling with its OWN crew line
  // and no VAT line carries its own norm of 3, and nothing folds anywhere in
  // that block. 2026-W32.md:170 is exactly this shape.
  const a1 = crew('vat-a1', 3, 10);
  await loadAppWithState(page, state(a1, [
    { area: 'vat-a1', areas: ['vat-a1'], hours: 7, kind: 'block',
      from: '17:00', to: '00:00', crew: a1.map((w) => w.id) },
    { area: 'pickling-vat', areas: ['pickling-vat'], hours: 21, kind: 'block',
      from: '17:00', to: '00:00', crew: [] },
  ]));
  await openAreas(page);
  // A1 on a bare 4: short 1, 1 x 7 = 7. Pickling short 3: 21. Total 28.
  await expect(blocks(page)).toContainText('28.0 h');
  await expect(blocks(page)).not.toContainText('not the predicted amount');
});

test('an untagged sibling row still tells the fold pickling was manned', async ({ page }) => {
  // 2026-W33.md:39 — a tagged VAT A2 line beside an UNTAGGED pickling line with
  // its own crew. A row booking nothing is still evidence about staffing, so it
  // must survive the zero-hours filter: dropped, A2 folds hands that were
  // standing right there and predicts 7.5 against a tag of 3.
  const a2 = crew('vat-a2', 3, 10);
  const pick = crew('pickling-vat', 2, 20);
  await loadAppWithState(page, state([...a2, ...pick], [
    { area: 'vat-a2', areas: ['vat-a2'], hours: 3, kind: 'block',
      from: '06:00', to: '08:30', crew: a2.map((w) => w.id) },
    { area: 'pickling-vat', areas: ['pickling-vat'], hours: 0, kind: 'block',
      from: '06:00', to: '08:30', crew: pick.map((w) => w.id) },
  ]));
  await openAreas(page);
  // A2 on a bare 4, three stood, short 1, x 3 credited = 3. Exactly the tag.
  await expect(blocks(page)).toContainText('3.0 h');
  await expect(blocks(page)).not.toContainText('not the predicted amount');
});

test('an unset pickling complement folds nothing rather than phantom hands', async ({ page }) => {
  // areaTargets ships EMPTY, so a partly-normed device is the ordinary state.
  // With no pickling complement there are no hands to lend; folding 2 anyway
  // would invent heads and inflate the shortfall on every VAT block.
  const a1 = crew('vat-a1', 3, 10);
  await loadAppWithState(page, {
    ...emptyState(), incomingMaterial: noSeedIM(), labour: LABOUR,
    areaTargets: { 'vat-a1': 4 },
    staff: a1,
    attendance: { [todayIso()]: { marks: {}, note: '', extra: [{
      area: 'vat-a1', areas: ['vat-a1'], hours: 7, kind: 'block',
      from: '17:00', to: '00:00', crew: a1.map((w) => w.id),
    }] } },
  });
  await openAreas(page);
  // Norm 4, not 6: short 1, 1 x 7 = 7.
  await expect(blocks(page)).toContainText('7.0 h');
  await expect(blocks(page)).not.toContainText('not the predicted amount');
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
  await expect(blocks(page)).toContainText('Not checkable');
  await expect(blocks(page)).toContainText('21.0 h');
  // Counted in the bill regardless — it is unverifiable, not unpaid. That
  // line lives on the card, not in the block section.
  await expect(extraCard(page)).toContainText('Extra at the contract tier');
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
  await expect(blocks(page)).toContainText('Not checkable');
});

test('a block whose booking the shortfall does not explain is flagged with its date', async ({ page }) => {
  const hands = crew('vat-a1', 4, 10);
  await loadAppWithState(page, state(hands, [{
    area: 'vat-a1', areas: ['vat-a1'], hours: 30, kind: 'block',
    from: '17:00', to: '00:00', crew: hands.map((w) => w.id),
  }]));
  await openAreas(page);
  await expect(blocks(page)).toContainText('not the predicted amount');
  await expect(blocks(page)).toContainText('30.0 h against 14.0 h');
});

/* ===== THE EXCEPTION LEDGER =====

   A disagreement the rule cannot explain is a question; once examined it
   becomes a RECORD carrying a required reason — the treatment `voidedNumbers`
   gives a number gap and `dupeAck` an accepted duplicate. One recorded block
   needs it: W33 Tue 11 Aug. */

async function explain(page: Page, reason: string) {
  await page.locator('[data-action="invAreaExplain"]').first().click();
  await page.locator('#areaExReason').fill(reason);
  await page.locator('[data-action="invAreaExplainSave"]').click();
}

function mismatchedState() {
  const hands = crew('vat-a1', 4, 10);
  return state(hands, [{
    area: 'vat-a1', areas: ['vat-a1'], hours: 30, kind: 'block',
    from: '17:00', to: '00:00', crew: hands.map((w) => w.id),
  }]);
}

test('an examined disagreement becomes a record with its reason on it', async ({ page }) => {
  await loadAppWithState(page, mismatchedState());
  await openAreas(page);
  await expect(blocks(page)).toContainText('not the predicted amount');

  await explain(page, 'no fold value reconciles both rows of this block');
  await expect(page.locator('.inv-toast')).toContainText('Exception recorded');

  // It moves from accusation to precedent, and carries the reason in place.
  await expect(blocks(page)).toContainText('Explained exceptions');
  await expect(blocks(page)).toContainText('no fold value reconciles both rows');
  await expect(blocks(page)).not.toContainText('not the predicted amount');

  const ex = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('sep_invoicing_state')!).extraExceptions);
  expect(ex).toHaveLength(1);
  expect(ex[0].reason).toBe('no fold value reconciles both rows of this block');
  // The figures it was granted against are stored WITH it — that is what makes
  // the staleness check below possible.
  expect(ex[0].booked).toBe(30);
  expect(ex[0].expected).toBe(14);
});

test('an exception with no reason is refused', async ({ page }) => {
  // Required, for the reason the void ledger's is: an exception with no
  // explanation cannot be told from one nobody was shown.
  await loadAppWithState(page, mismatchedState());
  await openAreas(page);
  await page.locator('[data-action="invAreaExplain"]').first().click();
  await page.locator('[data-action="invAreaExplainSave"]').click();

  await expect(page.locator('.inv-toast')).toContainText('A reason is required');
  const ex = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('sep_invoicing_state')!).extraExceptions);
  expect(ex).toEqual([]);
});

test('an explanation that no longer matches the figures does not silence them', async ({ page }) => {
  // The guard that stops an old note covering a new problem. An exception is
  // granted against specific numbers; if the data moves, the note no longer
  // describes what is there and the disagreement must surface again.
  await loadAppWithState(page, mismatchedState());
  await openAreas(page);
  await explain(page, 'brought-in casual labour, different ledger line');
  await expect(blocks(page)).toContainText('Explained exceptions');

  // The tag is retyped: 30 becomes 40. Same block, same day, different number.
  // Edited on the live state and re-rendered rather than through a reload —
  // `loadAppWithState` seeds via addInitScript, so a navigation would put the
  // original fixture back and quietly test nothing.
  // Driven through the app's own setter rather than by rewriting storage: `S`
  // is `let`-scoped and not on `window`, and a reload would re-seed the
  // fixture (loadAppWithState uses addInitScript), quietly testing nothing.
  await page.evaluate(() => {
    const w = window as unknown as {
      setAttExtraHours: (i: number, h: number) => void; renderAttendance: () => void;
    };
    w.setAttExtraHours(0, 40);
    w.renderAttendance();
  });

  await expect(blocks(page)).toContainText('Explanation no longer matches');
  await expect(blocks(page)).toContainText('not the predicted amount');
  await expect(blocks(page)).not.toContainText('Explained exceptions');
});

test('a recorded exception can be reopened', async ({ page }) => {
  await loadAppWithState(page, mismatchedState());
  await openAreas(page);
  await explain(page, 'checked against the sheet — the tag is right');
  await page.locator('[data-action="invAreaUnexplain"]').first().click();

  await expect(blocks(page)).toContainText('not the predicted amount');
  const ex = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('sep_invoicing_state')!).extraExceptions);
  expect(ex).toEqual([]);
});

/* ===== ENTRY ===== */

test('the card does not claim a pass while a block sits mismatched above it', async ({ page }) => {
  // The pass note speaks for the whole card. Gated on the general-shift
  // disagreements alone it rendered "30.0 h against 14.0 h" and "every booking
  // reconciles exactly" one after the other — a surface reporting a pass it
  // did not measure.
  const hands = crew('vat-a1', 4, 10);
  await loadAppWithState(page, state(hands, [{
    area: 'vat-a1', areas: ['vat-a1'], hours: 30, kind: 'block',
    from: '17:00', to: '00:00', crew: hands.map((w) => w.id),
  }]));
  await openAreas(page);
  await expect(blocks(page)).toContainText('not the predicted amount');
  await expect(extraCard(page)).not.toContainText('the whole cross-check');
});

test('the entry row shows the clock span and the credited length', async ({ page }) => {
  // 6:00–8:30 is 2.5 on the clock and credited 3. Both are shown, so nothing
  // is rounded behind the operator's back.
  const hands = crew('vat-a1', 5, 10);
  await loadAppWithState(page, state(hands, [{
    area: 'vat-a1', areas: ['vat-a1'], hours: 3, kind: 'block',
    from: '06:00', to: '08:30', crew: hands.map((w) => w.id),
  }]));
  await switchTab(page, 'pageStaff');
  const len = page.locator('.inv-att-block-len').first();
  await expect(len).toContainText('2.5');
  await expect(len).toContainText('3');
  await expect(len).toContainText('credited');
});

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
