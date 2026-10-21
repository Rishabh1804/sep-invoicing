import { test } from '@playwright/test';
import { heldCreate, heldVat, homeForWhoever } from './p240-quick-held.fixture';

// P240 (UI pass 3, U2R; docs/UI_PASS_3.md §24o, §1a-19) on the phone: Quick actions holds what was started here and not saved, each
// with Continue; Home is drawn again for whoever signs in next.

test('an invoice typed on Create waits on Quick actions, Continue goes back to it, and the row goes when nothing is held', async ({ page }) => { await heldCreate(page); });
test('a register page typed on Mine waits on its person’s Quick actions, and Continue opens it on its day and line', async ({ page }) => { await heldVat(page); });
test('Home drawn for one person is drawn again for the next: the owner’s board never shows to a supervisor', async ({ page }) => { await homeForWhoever(page); });
