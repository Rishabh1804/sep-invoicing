import { test } from '@playwright/test';
import { factAndDialog, redLeads, moneyFirst, dialogJobs } from './p246-print-light.fixture';

// P246, the print station's light (owner, 28 Oct 2026), on the desktop: a fact beside the plant's, never under the clock, the
// masthead keeping its 148 px; the lead and its count; the dialog and the jobs printed here.

test('on, the light is one of the masthead’s facts, the masthead keeps its height, and its words open the station', async ({ page }) => { await factAndDialog(page, true); });
test('red with a job waiting leads the masthead, its count leaves out its own task, and it blinks until it is opened', async ({ page }) => { await redLeads(page, true); });
test('money in danger leads before it; the light still blinks among the facts', async ({ page }) => { await moneyFirst(page); });
test('a job is cancelled from the dialog, and the jobs are printed here, each taken off the queue first', async ({ page }) => { await dialogJobs(page); });
