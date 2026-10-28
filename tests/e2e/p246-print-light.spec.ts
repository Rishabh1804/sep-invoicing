import { test } from '@playwright/test';
import { stateRules, checkIn, factAndDialog, redLeads, moneyFirst, dialogJobs, sendAsks, reloadSafe, offline, roles } from './p246-print-light.fixture';

// P246, the print station's light (owner, 28 Oct 2026), on the phone.

test('the light worked out: on, waiting, not seen, down, off, never, offline; red leads only with a job waiting', async ({ page }) => { await stateRules(page); });
test('the station checks in every 10 minutes on its own branch, made from the sync branch and moved back onto it each month', async ({ page }) => { await checkIn(page); });
test('on, the light is one of the masthead’s facts, and its words open the station', async ({ page }) => { await factAndDialog(page, false); });
test('red with a job waiting leads the masthead and Needs you, and blinks until it is opened and again when it gets worse', async ({ page }) => { await redLeads(page, false); });
test('money in danger leads before it; the light still blinks among the facts', async ({ page }) => { await moneyFirst(page); });
test('a job is cancelled from the dialog, and the jobs are printed here, each taken off the queue first and put back if it did not print', async ({ page }) => { await dialogJobs(page); });
test('Send to office asks first where the station is not on: Print here, Send anyway, or nothing', async ({ page }) => { await sendAsks(page); });
test('the station reloads to a new build only when nothing is typed, open, saving or pushing and it has been left alone', async ({ page }) => { await reloadSafe(page); });
test('offline it cannot check, and says so, never the last colour it saw', async ({ page }) => { await offline(page); });
test('the light is the owner’s and the office’s, while the office printer is on', async ({ page }) => { await roles(page); });
