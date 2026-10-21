import { expect, type Page } from '@playwright/test';
import { loadAppWithState, todayIso } from './fixtures';
import { longBook } from './load-fixture';
import { geistReady } from './p235-family.fixture';
import { withUsers, unlock, lockNow, PINS, guardBook } from './p140-guard.fixture';

// P239 (UI pass 3, U2R; docs/UI_PASS_3.md §24j), shared by the phone and the desktop: Home's verdict is a masthead drawn flat (no fill,
// edge or lift; a hairline under it), never folded, 148 px on the desktop; its parts in order; the clock on the minute and the general
// shift before, during and after it; its Act by role; and on the phone the sentence and the clock in Home's first 200 px.

const mast = (page: Page) => page.locator('#homeDash [data-home-day]');

export async function flatAndOrdered(page: Page, desktop: boolean) {
  await page.clock.install({ time: new Date(todayIso() + 'T11:30:00') });
  await loadAppWithState(page, longBook());
  await geistReady(page);
  const m = mast(page);
  await expect(m).toBeVisible();
  const look = await m.evaluate(e => {
    const c = getComputedStyle(e), r = e.getBoundingClientRect();
    return { bg: c.backgroundColor, shadow: c.boxShadow, top: c.borderTopWidth, left: c.borderLeftWidth, bottom: c.borderBottomWidth, h: r.height,
      kids: Array.from(e.children).map(k => (k as HTMLElement).className.split(' ')[0]), folds: e.querySelectorAll('details, [data-action*="Fold"], [aria-expanded]').length };
  });
  expect(look.bg).toBe('rgba(0, 0, 0, 0)');
  expect(look.shadow).toBe('none');
  expect([look.top, look.left]).toEqual(['0px', '0px']);
  expect(parseFloat(look.bottom)).toBeGreaterThan(0);
  expect(look.folds).toBe(0);
  if (desktop) expect(Math.abs(look.h - 148)).toBeLessThan(1);
  expect(look.kids).toEqual(['inv-mast-date', 'inv-mast-say', 'inv-mast-facts', 'inv-mast-act', 'inv-mast-time']);
  // What leads it, and on the desktop how many are open after it; the facts each led by their lamp.
  await expect(m.locator('.inv-mast-say')).toHaveClass(/inv-dot-(danger|warning|ok|info)/);
  if (desktop) await expect(m.locator('.inv-mast-count')).toContainText('open');
  else await expect(m.locator('.inv-mast-count')).toHaveCount(0);
  if (!desktop) {
    // The six-second test: the sentence and the clock in Home's first 200 px.
    const at = await page.evaluate(() => {
      const top = (document.querySelector('#homeDash') as HTMLElement).getBoundingClientRect().top;
      const b = (s: string) => (document.querySelector('#homeDash ' + s) as HTMLElement).getBoundingClientRect().bottom - top;
      return [b('.inv-mast-say'), b('.inv-mast-clock')];
    });
    expect(Math.max(...at)).toBeLessThanOrEqual(200);
  }
}

/* The clock and the shift, before, during and after the general shift (8:30 AM to 5:00 PM), and the tick on the minute. */
export async function clockAndShift(page: Page, desktop: boolean) {
  await page.clock.install({ time: new Date(todayIso() + 'T07:40:00') });
  await loadAppWithState(page, longBook());
  const m = mast(page), shift = m.locator('[data-home-shift]'), clock = m.locator('[data-home-clock]'), track = m.locator('[data-home-track]');
  await expect(clock).toHaveText('7:40 AM');
  await expect(shift).toHaveText(desktop ? 'General shift starts 8:30 AM · in 50 min' : 'Shift starts 8:30 AM');
  if (desktop) {
    await expect(track).toBeVisible();
    expect(await track.evaluate(e => getComputedStyle(e).getPropertyValue('--shift-done').trim())).toBe('0');
  } else await expect(track).toHaveCount(0);
  // The minute turns: the clock and the shift move, nothing else is drawn again.
  // A handle to the element itself (an element passed back from evaluate is serialised, and never equal to anything).
  const before = await m.evaluateHandle(e => (e as HTMLElement).querySelector('.inv-mast-say') as Element);
  await page.clock.runFor(60_000);
  await expect(clock).toHaveText('7:41 AM');
  await expect(shift).toHaveText(desktop ? 'General shift starts 8:30 AM · in 49 min' : 'Shift starts 8:30 AM');
  expect(await m.evaluate((e, b) => (e as HTMLElement).querySelector('.inv-mast-say') === b, before)).toBe(true);
  // During it: what is left, and the track of the shift gone.
  await page.clock.setFixedTime(new Date(todayIso() + 'T12:45:00'));
  await page.clock.runFor(60_000);
  await expect(clock).toHaveText(/^12:4\d PM$/);
  if (desktop) {
    await expect(shift).toContainText('General shift ends 5:00 PM ·');
    await expect(shift).toContainText('left');
    const done = Number(await track.evaluate(e => getComputedStyle(e).getPropertyValue('--shift-done').trim()));
    expect(done).toBeGreaterThan(0.4);
    expect(done).toBeLessThan(0.6);
  } else await expect(shift).toHaveText('Shift ends 5:00 PM');
  // After it: said so, and no track.
  await page.clock.setFixedTime(new Date(todayIso() + 'T18:10:00'));
  await page.clock.runFor(60_000);
  await expect(shift).toHaveText(desktop ? 'The general shift has ended' : 'The shift has ended');
  if (desktop) await expect(track).toBeHidden();
}

/* The Act: Open Needs you for everyone (with the count on the phone), Make today's report only for a role that opens Reports. */
export async function actByRole(page: Page, desktop: boolean) {
  await loadAppWithState(page, guardBook());
  await withUsers(page);
  await unlock(page, 'U-own', PINS.owner);
  const act = mast(page).locator('.inv-mast-act');
  await expect(act.locator('[data-home-needs]')).toHaveClass(/inv-btn-tint/);
  if (desktop) await expect(act.locator('[data-action="invHomeReport"]')).toHaveCount(1);
  else await expect(act.locator('[data-home-needs]')).toContainText(/Open Needs you( · \d+)?/);
  // The supervisor does not open Reports: no report link.
  await lockNow(page);
  await unlock(page, 'U-sup', PINS.super);
  await expect(mast(page).locator('[data-action="invHomeReport"]')).toHaveCount(0);
  await expect(mast(page).locator('[data-home-needs]')).toBeVisible();
}
