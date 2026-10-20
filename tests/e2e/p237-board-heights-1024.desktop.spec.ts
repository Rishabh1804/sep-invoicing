import { test } from '@playwright/test';
import { sizesExact, presetsWhole, holesAndSlots } from './p237-board-heights.fixture';

// P237 (UI pass 3, U2R; docs/UI_PASS_3.md §24h–§24i) on the desktop at 1024 px, a board of six columns: each size exactly its rows,
// every preset with no hole, packing on and off, and a hole filled and offered as a slot.

test.use({ viewport: { width: 1024, height: 768 } });
test('a card is exactly its size’s rows on six columns', async ({ page }) => { await sizesExact(page); });
test('every preset packs with no hole on six columns, packing on and off', async ({ page }) => { test.setTimeout(120_000); await presetsWhole(page); });
test('a hole on six columns is filled in the layout’s order and offered as a slot while arranging', async ({ page }) => { await holesAndSlots(page); });
