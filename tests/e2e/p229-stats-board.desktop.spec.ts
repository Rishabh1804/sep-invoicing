import { test } from '@playwright/test';
import { twoViews, presetPacks, tablesSort, u3Widgets, oldPlaces } from './p229-stats-board.fixture';

// P229 (UI pass 3, U3; docs/UI_PASS_3.md §10, §26a) on the desktop: Stats as a dashboard and its tables.

test('Stats is two views on the desktop: the verdict, one toolbar row with Customise, the Tables a switch of four', async ({ page }) => { await twoViews(page, true); });
test('the owner’s Stats preset on the desktop: ten cards, four Smalls a row, packed with no hole', async ({ page }) => { await presetPacks(page, true); });
test('a table sorts by a tapped head on the desktop', async ({ page }) => { await tablesSort(page); });
test('the seven U3 widgets draw at every size on the desktop', async ({ page }) => { test.setTimeout(60_000); await u3Widgets(page); });
test('every old place lands where its cards went on the desktop', async ({ page }) => { await oldPlaces(page); });
