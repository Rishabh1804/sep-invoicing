import { test } from '@playwright/test';
import { twoViews, periodOwn, presetPacks, arrangeOwn, galleryBoards, tablesSort, exportsWork, oldPlaces, u3Widgets } from './p229-stats-board.fixture';

// P229 (UI pass 3, U3; docs/UI_PASS_3.md §10, §26a) on the phone: Stats as a dashboard and its tables.

test('Stats is two views, the Dashboard first: one verdict and one toolbar row lead each, the Tables a switch of four', async ({ page }) => { await twoViews(page, false); });
test('the period is Stats’ own: its chips move the verdict and every widget on its board, and Home reads this month', async ({ page }) => { await periodOwn(page); });
test('the owner’s Stats preset: about seven cards on the phone, packed with no hole', async ({ page }) => { await presetPacks(page, false); });
test('Customise arranges Stats’ own layout, kept per board and never in the book; leaving Stats ends it', async ({ page }) => { await arrangeOwn(page); });
test('the gallery offers Stats’ board beside Home’s with the seven new widgets; a role without Stats gets no Stats board', async ({ page }) => { await galleryBoards(page); });
test('a table sorts by a tapped head, again the other way, said on the head', async ({ page }) => { await tablesSort(page); });
test('the table on show exports as CSV and every table as one workbook, in the order on screen', async ({ page }) => { await exportsWork(page); });
test('every old place lands where its cards went: an address, the remembered tab, a saved task, the live cost’s move', async ({ page }) => { await oldPlaces(page); });
test('the seven U3 widgets draw at every size as Ledgers and trends, none an error, Trend’s Choose kept', async ({ page }) => { test.setTimeout(60_000); await u3Widgets(page); });
