import { test } from '@playwright/test';
import { sizesExact, presetsWhole, holesAndSlots, fitLetsGo } from './p237-board-heights.fixture';

// P237 (UI pass 3, U2R; docs/UI_PASS_3.md §24h–§24i) on the desktop at 1280 px: each size exactly its rows; every preset with no hole, packing on
// and off; a later card filling a hole with the DOM in the layout's order; arranging's slots and Add here; wdgPlace against the
// browser's own placement; the fit's order and counts.

test('a card is exactly its size’s rows', async ({ page }) => { await sizesExact(page); });
test('every preset packs with no hole, packing on and off', async ({ page }) => { test.setTimeout(120_000); await presetsWhole(page); });
test('a later card fills a hole in the layout’s order; arranging shows the hole as a slot whose Add here puts a widget there', async ({ page }) => { await holesAndSlots(page); });
test('the fit lets go of the last rows, More counts them and a Ledger’s rest line keeps the total', async ({ page }) => { await fitLetsGo(page); });
