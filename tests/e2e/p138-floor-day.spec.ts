import { test, expect } from '@playwright/test';
import { loadAppWithState, switchTab, openPulse } from './fixtures';
import { sweep, problems, type Stop } from './sweep-fixture';
import { floorBook, openFloor, card, hero, dayOff, g, T, Y, D2 } from './p138-floor-day.fixture';

// P138 (Direction B, step 5; owner, 1 Oct 2026): Floor → Day, the line board, now Floor → Overview (the tab map, TM4a). A card
// per line (VAT A1, VAT A2, Barrel, Pickling), the worst first: the heads against the day's number, the EXTRA booked to it, what
// it is running and its last round, what it plated and who plated it; the heroes say on site, plated and power. Every figure is
// the one its own screen shows: People → Day and Areas, Production → Lines, Power. A day is a place (?tab=pageFloor&d=…).
// Made-up names and parts.

test('each line’s card: its staffing against the day’s number, its EXTRA, what it ran and plated, and who plated it', async ({ page }) => {
  await loadAppWithState(page, floorBook());
  await openFloor(page);
  await expect(page.locator('#flrLines > .inv-hero')).toHaveCount(4);
  // The worst first (TM4a): Pickling is judged by its heads (met, ok); the plating lines have no units on record here, so their
  // efficiency is not judged (neutral) and they keep the line order after it.
  await expect(page.locator('#flrLines .inv-panel-title')).toHaveText(['Pickling', 'VAT A1', 'VAT A2', 'Barrel']);
  // Staffing: heads against areaNeedOn (A1's day number is 4, its usual 3); Barrel is barrel and barrel pickling, one unit of five.
  await expect(card(page, 'vat-a1').locator('[data-flr-staff]')).toHaveText('Short 1 · 3/4');
  await expect(card(page, 'vat-a1').locator('[data-flr-staff] .inv-dot')).toHaveClass(/inv-dot-warning/);
  await expect(card(page, 'vat-a2').locator('[data-flr-staff]')).toHaveText('Met 4/4');
  await expect(card(page, 'barrel').locator('[data-flr-staff]')).toHaveText('Met 5/5');
  await expect(card(page, 'pickling').locator('[data-flr-staff]')).toHaveText('Met 3/3');
  // EXTRA: only where hours were booked.
  await expect(card(page, 'vat-a2').locator('[data-flr-extra] .inv-badge-warning')).toHaveText('EXTRA 8 h');
  for (const l of ['vat-a1', 'barrel', 'pickling']) await expect(card(page, l).locator('[data-flr-extra]')).toHaveCount(0);
  // Running: the latest run, its last round and its size; plated: the line's figure for the day.
  const a1 = card(page, 'vat-a1').locator('[data-flr-run]');
  await expect(a1).toHaveAttribute('data-flr-run', 'R2');
  await expect(a1.locator('.inv-row-title')).toHaveText('BETA TEST AUTO · CLAMP 66X42 (30X6)');
  await expect(a1.locator('.inv-row-main .inv-row-meta')).toHaveText('a round of 150 · last 2:45 PM · 2 runs');
  // One unit (owner, 9 Oct 2026): the weight leads, the pieces under it.
  await expect(a1.locator('[data-flr-plated]')).toHaveText('182 kg');
  await expect(a1.locator('[data-flr-kg]')).toHaveText('870 NOS');
  await expect(card(page, 'vat-a2').locator('[data-flr-run] .inv-row-main .inv-row-meta')).toHaveText('a round of 56 · last 3:20 PM');
  await expect(card(page, 'barrel').locator('[data-flr-run] .inv-row-main .inv-row-meta')).toHaveText('the day’s list');
  await expect(card(page, 'barrel').locator('[data-flr-plated]')).toHaveText('108 kg');
  // Pickling: the latest load and the count of loads.
  await expect(card(page, 'pickling').locator('[data-flr-run]')).toHaveAttribute('data-flr-run', 'P2');
  await expect(card(page, 'pickling').locator('[data-flr-run] .inv-row-main .inv-row-meta')).toContainText('last 11:30 AM · 300 NOS');
  await expect(card(page, 'pickling').locator('[data-flr-plated]')).toHaveText('2 loads');
  // Crew: who stood the line (prodCrew); the pickling hands of both sides pickle (production's rule).
  await expect(card(page, 'vat-a1').locator('[data-flr-crew]')).toHaveText('Crew: Alfa, Bravo, Charlie');
  await expect(card(page, 'vat-a2').locator('[data-flr-crew]')).toHaveText('Crew: Delta, Echo, Foxtrot, Golf');
  await expect(card(page, 'barrel').locator('[data-flr-crew]')).toHaveText('Crew: Hotel, India, Juliet, Kilo, Lima');
  await expect(card(page, 'pickling').locator('[data-flr-crew]')).toHaveText('Crew: Kilo, Lima, Mike, November, Oscar');
});

test('the cards say what Staff → Day, Production → Lines and Entries say for the same day', async ({ page }) => {
  await loadAppWithState(page, floorBook());
  await openFloor(page);
  const floor = {
    a1Staff: await card(page, 'vat-a1').locator('[data-flr-staff]').innerText(),
    a1Title: await card(page, 'vat-a1').locator('[data-flr-run] .inv-row-title').innerText(),
    a1Plated: await card(page, 'vat-a1').locator('[data-flr-plated]').innerText(),
    a1Kg: await card(page, 'vat-a1').locator('[data-flr-kg]').innerText(),
    a1Crew: await card(page, 'vat-a1').locator('[data-flr-crew]').innerText(),
  };
  // Staff → Day: the board's VAT A1 card, 3 on it against the day's 4, short by one.
  await card(page, 'vat-a1').locator('[data-flr-staff]').click();
  await expect(page.locator('#pageStaff.inv-page-active')).toBeVisible();
  await expect(page.locator('#attDate')).toHaveValue(T);
  const board = page.locator('[data-att-area-card="vat-a1"] .inv-panel-head');
  await expect(board).toContainText('3/4');
  await expect(board).toContainText('Short 1');
  expect(floor.a1Staff).toContain('Short 1');
  expect(floor.a1Staff).toContain('3/4');
  // Production → Lines on VAT A1, the same day: the run and the figures.
  await page.goBack();
  await expect(page.locator('#pageFloor.inv-page-active')).toBeVisible();
  await card(page, 'vat-a1').locator('[data-action="invFlrLine"]').click();
  await expect(page.locator('#pageProduction.inv-page-active')).toBeVisible();
  await expect(page.locator('#productionContent [data-action="invProdLine"][data-line="vat-a1"]')).toHaveAttribute('aria-pressed', 'true');
  // Lines' card names the day (the phone's toolbar has no room for it) and its factors say what the Floor card says.
  await expect(page.locator('#prodLinesVerdict .inv-hero-eyebrow')).toContainText(await g(page, `stockShortDate('${T}')`) as string);
  await expect(page.locator('#prodRuns [data-prod-entry="R2"] .inv-row-title')).toHaveText(floor.a1Title);
  await expect(page.locator('#prodLinesVerdict [data-prod-line-tile="kg"] .inv-tile-value')).toHaveText(floor.a1Plated);
  await expect(page.locator('#prodLinesVerdict [data-prod-line-tile="pieces"] .inv-tile-value')).toHaveText(floor.a1Kg);
  // Production → Entries names the same crew for that run.
  await page.locator('[data-action="invProdTab"][data-tab="entries"]').click();
  await expect(page.locator('[data-prod-entry="R2"] [data-prod-crew]')).toHaveText(floor.a1Crew);
  // The EXTRA badge opens Areas, on the day's week.
  await openFloor(page);
  await card(page, 'vat-a2').locator('[data-flr-extra]').click();
  await expect(page.locator('#pageStaff [data-action="invAttView"][data-view="areas"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#areaExtra')).toBeVisible();
});

test('the heroes: on site, plated and power as People, Production and Power count them', async ({ page }) => {
  await loadAppWithState(page, floorBook());
  await openPulse(page);
  await openFloor(page);
  await expect(hero(page, 'people').locator('.inv-hero-fig')).toHaveText('16/17');
  await expect(hero(page, 'people').locator('.inv-hero-sub')).toContainText('1 absent');
  // 16 of 17 clears the rest-day gate's 90%, but VAT A1 stood 3 against the day's 4: the floor's number codes it (attOnSiteTone).
  await expect(hero(page, 'people')).toHaveClass(/inv-hero-warning/);
  await expect(hero(page, 'people').locator('.inv-hero-title')).toHaveText('VAT A1 short 1');
  await expect(hero(page, 'prod').locator('.inv-hero-fig')).toHaveText('374 kg');
  await expect(hero(page, 'power').locator('.inv-hero-fig')).toHaveText('1 cut');
  await expect(hero(page, 'power').locator('.inv-hero-title')).toHaveText('12 min dark');
  const onSite = await hero(page, 'people').locator('.inv-hero-fig').innerText();
  // Home's attendance card (People's own figure) says the same.
  await openPulse(page);
  await expect(page.locator('#homeAttOnSite')).toHaveText(onSite);
  // Power: the cut reported twice is one, of 12 minutes; Lines' power factor and Power → Cuts say so.
  await switchTab(page, 'pageProduction');
  await page.locator('[data-action="invProdTab"][data-tab="lines"]').click();
  await expect(page.locator('#prodLinesVerdict [data-prod-line-tile="cuts"] .inv-tile-value')).toHaveText('12 min');
  await expect(page.locator('#prodLinesVerdict [data-prod-line-tile="cuts"] .inv-tile-sub')).toHaveText('1 cut this day');
  await openFloor(page);
  await hero(page, 'power').locator('summary').click();
  await hero(page, 'power').locator('[data-action="invFlrPower"]').click();
  await expect(page.locator('#pagePower [data-action="invPowerTab"][data-tab="cuts"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator(`[data-power-cut="${T}|665"]`)).toContainText('12 min');
});

test('a day with no record says so: a dash with its reason, and the move that fills it', async ({ page }) => {
  await loadAppWithState(page, floorBook());
  await openFloor(page);
  // Yesterday: nothing at all.
  await page.locator('[data-action="invFlrStep"][data-step="-1"]').click();
  await expect(page.locator('#flrDate')).toHaveValue(Y);
  await expect(hero(page, 'people').locator('.inv-hero-fig')).toHaveText('—');
  await expect(hero(page, 'people').locator('.inv-hero-title')).toHaveText('No attendance recorded');
  await expect(hero(page, 'people').locator('.inv-hero-sub')).toHaveText('a gap, not a day off');
  await expect(hero(page, 'prod').locator('.inv-hero-fig')).toHaveText('—');
  await expect(hero(page, 'power').locator('.inv-hero-fig')).toHaveText('—');
  await expect(hero(page, 'power').locator('.inv-hero-title')).toHaveText('No floor record this day');
  await expect(card(page, 'vat-a1').locator('[data-flr-staff]')).toHaveText('No attendance');
  // Two days back: attendance, nothing plated. The staffing is judged, the run is a gap, the hands on the line are named.
  await page.locator('[data-action="invFlrStep"][data-step="-1"]').click();
  await expect(page.locator('#flrDate')).toHaveValue(D2);
  await expect(card(page, 'vat-a1').locator('[data-flr-staff]')).toHaveText('Short 1 · 2/3');
  await expect(hero(page, 'power').locator('.inv-hero-fig')).toHaveText('0 cuts');
  await expect(hero(page, 'power').locator('.inv-hero-title')).toHaveText('No cut reported');
  const a1 = card(page, 'vat-a1');
  await expect(a1.locator('[data-flr-run] .inv-row-title')).toHaveText('No record this day');
  await expect(a1.locator('[data-flr-crew]')).toHaveText('On the line: Alfa, Bravo');
  await expect(card(page, 'vat-a2').locator('[data-flr-crew]')).toHaveText('Nobody marked on the line that day');
  // The VAT lines' record is the register page; the barrel list and the pickling loads come by message.
  await expect(a1.locator('[data-action="invFlrPhoto"]')).toHaveText('Read register photo');
  await expect(card(page, 'barrel').locator('[data-action="invFlrPaste"]')).toHaveText('Paste message');
  await expect(card(page, 'pickling').locator('[data-action="invFlrPaste"]')).toHaveText('Paste message');
  // Read register photo is Production's own: the picker opens, on Production → Lines for the line and the day.
  await page.evaluate(() => localStorage.setItem('sep_inv_gemini_key', 'test-key'));
  const chooser = page.waitForEvent('filechooser');
  await a1.locator('[data-action="invFlrPhoto"]').click();
  await chooser;
  await expect(page.locator('#pageProduction.inv-page-active')).toBeVisible();
  await expect(page.locator('#productionContent [data-action="invProdLine"][data-line="vat-a1"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#prodLinesVerdict .inv-hero-eyebrow')).toContainText(await g(page, `stockShortDate('${D2}')`) as string);
  // Paste message opens Production's paste box.
  await openFloor(page);
  await expect(page.locator('#flrDate')).toHaveValue(D2);
  await card(page, 'barrel').locator('[data-action="invFlrPaste"]').click();
  await expect(page.locator('#productionContent #prodPasteText')).toBeVisible();
});

test('the day stepper: never past today, every day a place in the address, a reload opens it', async ({ page }) => {
  await loadAppWithState(page, floorBook());
  await openFloor(page);
  await expect(page.locator('#flrDate')).toHaveValue(T);
  await expect(page.locator('[data-action="invFlrStep"][data-step="1"]')).toBeDisabled();
  await expect(page).toHaveURL(/tab=pageFloor(?!.*[?&]d=)/);
  await page.locator('[data-action="invFlrStep"][data-step="-1"]').click();
  await expect(page).toHaveURL(new RegExp('tab=pageFloor&d=' + Y));
  await expect(page.locator('[data-action="invFlrStep"][data-step="1"]')).toBeEnabled();
  await page.locator('[data-action="invFlrStep"][data-step="-1"]').click();
  await expect(page).toHaveURL(new RegExp('tab=pageFloor&d=' + D2));
  // Back walks the days.
  await page.goBack();
  await expect(page.locator('#flrDate')).toHaveValue(Y);
  await page.locator('[data-action="invFlrToday"]').click();
  await expect(page.locator('#flrDate')).toHaveValue(T);
  await expect(page).not.toHaveURL(/[?&]d=/);
  // A day to come is today.
  await page.locator('#flrDate').fill(dayOff(3));
  await page.locator('#flrDate').dispatchEvent('change');
  await expect(page.locator('#flrDate')).toHaveValue(T);
  // A date picked is a place; a reload opens it.
  await page.locator('#flrDate').fill(D2);
  await page.locator('#flrDate').dispatchEvent('change');
  await expect(page).toHaveURL(new RegExp('d=' + D2));
  await page.reload();
  await page.waitForSelector('body.inv-booted', { state: 'attached' });
  await expect(page.locator('#pageFloor.inv-page-active')).toBeVisible();
  await expect(page.locator('#flrDate')).toHaveValue(D2);
  await expect(card(page, 'vat-a1').locator('[data-flr-staff]')).toHaveText('Short 1 · 2/3');
  // Opened at an address straight away.
  await page.goto('/?tab=pageFloor&d=' + Y);
  await page.waitForSelector('body.inv-booted', { state: 'attached' });
  await expect(page.locator('#flrDate')).toHaveValue(Y);
});

test('the page passes the sweep, light and dark, on a full day and an empty one', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await loadAppWithState(page, floorBook());
  const stops: Stop[] = [];
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await openFloor(page);
    if (await page.locator('[data-action="invFlrToday"]').isEnabled()) await page.locator('[data-action="invFlrToday"]').click();
    await expect(page.locator('#flrDate')).toHaveValue(T);
    stops.push(await sweep(page, `pageFloor today (${scheme})`));
    await page.locator('#flrDate').fill(D2);
    await page.locator('#flrDate').dispatchEvent('change');
    await expect(page.locator('#flrDate')).toHaveValue(D2);
    stops.push(await sweep(page, `pageFloor two days back (${scheme})`));
  }
  expect(problems(stops)).toEqual([]);
  expect(errors).toEqual([]);
});
