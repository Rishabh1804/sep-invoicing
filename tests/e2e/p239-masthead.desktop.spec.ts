import { test } from '@playwright/test';
import { flatAndOrdered, clockAndShift, actByRole } from './p239-masthead.fixture';

// P239 (UI pass 3, U2R; docs/UI_PASS_3.md §24j) on the desktop: the masthead drawn flat, 148 px, never folded, its parts in order and
// the open count after its sentence; the clock on the minute, the shift and its track before, during and after it; the Act by role.

test('the masthead is flat, 148 px, never folded, its parts in order', async ({ page }) => { await flatAndOrdered(page, true); });
test('the clock ticks on the minute and the shift and its track are said before, during and after it', async ({ page }) => { await clockAndShift(page, true); });
test('its Act is Open Needs you and Make today’s report; no report link for a role that does not open Reports', async ({ page }) => { await actByRole(page, true); });
