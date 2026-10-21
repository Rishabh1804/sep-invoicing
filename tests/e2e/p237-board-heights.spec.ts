import { test } from '@playwright/test';
import { sizesExact, presetsWhole, holesAndSlots, fitLetsGo, fitGivesBack } from './p237-board-heights.fixture';

// P237 (UI pass 3, U2R; docs/UI_PASS_3.md §24h–§24i) on the phone: each size exactly its rows while arranging, and as tall as what it
// holds within them otherwise (owner, 21 Oct 2026: "Cards only as tall as needed"; P241); every preset with no hole, packing on
// and off; a later card filling a hole with the DOM in the layout's order; arranging's slots and Add here; wdgPlace against the
// browser's own placement; the fit's order and counts.

test('a card is its size’s rows while arranging, and as tall as what it holds within them on the board', async ({ page }) => { await sizesExact(page); });
test('every preset packs with no hole, packing on and off', async ({ page }) => { test.setTimeout(120_000); await presetsWhole(page); });
test('a later card fills a hole in the layout’s order; arranging shows the hole as a slot whose Add here puts a widget there', async ({ page }) => { await holesAndSlots(page); });
// Owed at Large: a phone's Medium gives its room to the verdict, the age bar and its key, so its debts are a Large's (fitGivesBack).
test('the fit lets go of the last rows, More counts them and a Ledger’s rest line keeps the total', async ({ page }) => { await fitLetsGo(page, 'l'); });
test('what went first comes back where a list’s going freed its room: Owed’s age key on a Medium', async ({ page }) => { await fitGivesBack(page); });
