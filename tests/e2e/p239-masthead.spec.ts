import { test } from '@playwright/test';
import { flatAndOrdered, clockAndShift, actByRole } from './p239-masthead.fixture';

// P239 (UI pass 3, U2R; docs/UI_PASS_3.md §24j) on the phone: the masthead drawn flat and never folded, its parts in order, the sentence
// and the clock in Home's first 200 px; the clock on the minute and the shift before, during and after it; the Act by role, the board's tools at the act row's end.

test('the masthead is flat, never folded, its parts in order, the sentence and the clock in the first 200 px', async ({ page }) => { await flatAndOrdered(page, false); });
test('the clock ticks on the minute and the shift is said before, during and after it', async ({ page }) => { await clockAndShift(page, false); });
test('its Act is the lead’s one button and the board’s tools; the reports are More’s, for a role that opens Reports', async ({ page }) => { await actByRole(page, false); });
