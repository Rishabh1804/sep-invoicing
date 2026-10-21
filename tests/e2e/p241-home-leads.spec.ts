import { test } from '@playwright/test';
import { homeReadsMonth, needsBadge, leadOrder, plantShut, presetsSeven, mtdPace, edgesToday, comingWords, weatherPlace, directSources, quietUnderTest, phoneQuiet } from './p241-home-leads.fixture';

// P241 (owner, 21 Oct 2026: "Home screen should not feel heavy, and should lead and prioritise the user, control attention, makes
// information effortless, has a clear objective") on the phone.

test('Home reads this month: no period to pick on it, and Stats keeps its own', async ({ page }) => { await homeReadsMonth(page); });
test('Needs you carries its red count as a badge, which goes down as tasks are done and goes at none', async ({ page }) => { await needsBadge(page); });
test('the masthead leads with what asks for something today: a red move before a move to know worth more', async ({ page }) => { await leadOrder(page); });
test('a day the plant is shut is marked from Home with why, and said in the masthead, on the floor and on Needs you', async ({ page }) => { await plantShut(page, false); });
test('about seven cards on the phone, and nothing a preset holds that the masthead or another card says', async ({ page }) => { await presetsSeven(page, false); });
test('Month to date says where the month lands, its range from a Medium, its landing outlined on its bars', async ({ page }) => { await mtdPace(page); });
test('an edge asks for something today: a trend keeps its tone and is never edged', async ({ page }) => { await edgesToday(page); });
test('What’s coming names a client as written and short, and its headline never says a row again', async ({ page }) => { await comingWords(page); });
test('the weather’s place is the address, placed once by OpenStreetMap, and the weather is in the masthead', async ({ page }) => { await weatherPlace(page); });
test('where the feeds service cannot be reached, MET Norway and GDELT are asked straight, and Settings says so', async ({ page }) => { test.setTimeout(60_000); await directSources(page); });
test('under test the sources and the address’s place are never asked unless a spec says so', async ({ page }) => { await quietUnderTest(page); });
test('on the phone a quiet card is short, the board’s tools are in the masthead, and arranging keeps each size whole', async ({ page }) => { await phoneQuiet(page); });
