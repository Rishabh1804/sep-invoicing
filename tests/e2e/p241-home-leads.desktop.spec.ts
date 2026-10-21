import { test } from '@playwright/test';
import { leadOrder, plantShut, presetsSeven, mtdPace, edgesToday } from './p241-home-leads.fixture';

// P241 (owner, 21 Oct 2026) on the desktop: the lead, a shut day with its shift and track, the presets with Tata Motors on the
// desktop's alone, Month to date's pace and the edges.

test('the masthead leads with what asks for something today: a red move before a move to know worth more', async ({ page }) => { await leadOrder(page); });
test('a day the plant is shut is marked from Home with why, and said in the masthead, on the floor and on Needs you', async ({ page }) => { await plantShut(page, true); });
test('the desktop holds the phone’s seven and Tata Motors, and nothing the masthead or another card says', async ({ page }) => { await presetsSeven(page, true); });
test('Month to date says where the month lands, its range from a Medium, its landing outlined on its bars', async ({ page }) => { await mtdPace(page); });
test('an edge asks for something today: a trend keeps its tone and is never edged', async ({ page }) => { await edgesToday(page); });
