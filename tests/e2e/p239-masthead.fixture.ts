import { expect, type Page } from '@playwright/test';
import { loadAppWithState, todayIso, toolbarMoreLabels } from './fixtures';
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
  // Its parts in order: the date, the sentence, the facts and the weather where there are any, the act row, the clock. On the phone the
  // act row is always drawn: the board's tools stand at its end (owner, 21 Oct 2026; P241).
  const order = ['inv-mast-date', 'inv-mast-say', 'inv-mast-facts', 'inv-mast-act', 'inv-mast-time'];
  expect(look.kids).toEqual(order.filter(k => look.kids.includes(k)));
  for (const k of ['inv-mast-date', 'inv-mast-say', 'inv-mast-time'].concat(desktop ? [] : ['inv-mast-act'])) expect(look.kids).toContain(k);
  const facts = await page.evaluate(() => { const w = window as any, l = w.homeMastLead(); return l.facts.length + (w.feedWeatherVizHtml() ? 1 : 0); });
  expect(look.kids.includes('inv-mast-facts')).toBe(facts > 0);
  // What leads it in its tone; the count of what needs you is the Needs you tab's badge, and on the desktop a link beside a lead that
  // is not that count; the old count of what is open is gone.
  await expect(m.locator('.inv-mast-say')).toHaveClass(/inv-dot-(danger|warning|ok|info)/);
  await expect(m.locator('.inv-mast-count')).toHaveCount(0);
  const red = await page.evaluate(() => (window as any).homeMastLead().red);
  if (desktop && red) await expect(m.locator('.inv-btn-link[data-home-needs]')).toHaveText(red + (red === 1 ? ' thing needs' : ' things need') + ' you now');
  else await expect(m.locator('.inv-btn-link[data-home-needs]')).toHaveCount(0);
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

/* The Act (owner, 21 Oct 2026: "Lead with the first move"; P241): one tinted button at most, the lead's own (its move's, Open Money,
   or Open Needs you where the count leads), for every role; the reports are the toolbar's More's, today's and the month's, only for a
   role that opens Reports; on the phone the board's tools end the act row, on the desktop they keep the row under the masthead. */
export async function actByRole(page: Page, desktop: boolean) {
  await loadAppWithState(page, guardBook());
  await withUsers(page);
  await unlock(page, 'U-own', PINS.owner);
  const check = async (reports: boolean) => {
    const m = mast(page), act = m.locator('.inv-mast-act');
    const lead = await page.evaluate(() => { const l = (window as any).homeMastLead(); return { act: !!l.act, move: l.move || null }; });
    await expect(act.locator(':scope > .inv-btn-tint')).toHaveCount(lead.act ? 1 : 0);
    if (lead.move) await expect(act.locator(':scope > [data-home-lead="move"]')).toHaveCount(1);
    await expect(m.locator('[data-action="invHomeReport"]')).toHaveCount(0);
    if (desktop) {
      await expect(act.locator('[data-home-toolbar]')).toHaveCount(0);
      await expect(page.locator('#homeDash > [data-home-toolbar] [data-action="invWdgArrange"]')).toBeVisible();
    } else {
      await expect(act.locator('[data-home-toolbar] [data-action="invWdgArrange"]')).toBeVisible();
      await expect(act.locator('[data-home-toolbar] [data-action="invTbMore"]')).toBeVisible();
      await expect(page.locator('#homeDash > [data-home-toolbar]')).toHaveCount(0);
    }
    const labels = await toolbarMoreLabels(page);
    if (reports) expect(labels).toEqual(expect.arrayContaining(['Make today’s report', 'Make a report']));
    else { expect(labels).not.toContain('Make today’s report'); expect(labels).not.toContain('Make a report'); }
  };
  await check(true);
  // The supervisor does not open Reports: no report to make.
  await lockNow(page);
  await unlock(page, 'U-sup', PINS.super);
  await check(false);
}
