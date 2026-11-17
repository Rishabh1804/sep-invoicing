import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerAsk, emptyState, loadAppWithState, todayIso, waitForBoot } from './fixtures';

// P276: Backspace and the single-key shortcuts read one rule for "the user is typing" (navTyping, nav.js). Backspace goes back
// (owner, 28 Sep 2026: "Backspace goes back through the screens visited") from anything but a field typed in: a text, number,
// date or time field, a textarea, a select, anything editable keeps its own Backspace. A checkbox, a radio, a button and the
// page go back. Over a dialog, Backspace closes the top one, as Back and Escape do, and never moves the screen behind it. A held
// Backspace takes one step, and none during an IME composition. Made-up data only (HR-10).

const where = (p: Page) => { const u = new URL(p.url()); return [u.searchParams.get('tab'), u.searchParams.get('v') || '']; };

/* Finance on GST, then Bank: one step to go back to. */
async function twoSteps(page: Page): Promise<void> {
  await loadAppWithState(page, emptyState());
  await page.goto('/?tab=pageFinance&v=gst');
  await waitForBoot(page);
  await page.locator('[data-action="invFinTab"][data-tab="bank"]').click();
  await expect.poll(() => where(page)).toEqual(['pageFinance', 'bank']);
}

/* A bench of every kind of control, beside the app (the rule is the element's kind, not the screen's). */
async function bench(page: Page): Promise<void> {
  await page.evaluate((today) => {
    const vals: Record<string, string> = {
      text: 'QX1', number: '42', date: today, time: '10:30', search: 'QX1', tel: '9000', email: 'a@b.in', url: 'https://x.in',
      password: 'QX1', month: today.slice(0, 7), 'datetime-local': today + 'T10:30', week: '',
    };
    const d = document.createElement('div');
    d.id = 'p276Bench';
    d.innerHTML = Object.keys(vals).map(t => '<input id="p276-' + t + '" type="' + t + '">').join('') +
      '<input id="p276-empty" type="text"><input id="p276-plain">' +
      '<textarea id="p276-textarea">QX1</textarea><div id="p276-editable" contenteditable="true">QX1</div>' +
      '<select id="p276-select"><option>A</option><option>B</option></select>' +
      '<input id="p276-checkbox" type="checkbox"><input id="p276-radio" type="radio" name="p276r">' +
      '<input id="p276-ibutton" type="button" value="Go"><input id="p276-range" type="range">' +
      '<button id="p276-button" type="button">Go</button>';
    document.body.appendChild(d);
    Object.keys(vals).forEach(t => { if (vals[t]) (document.getElementById('p276-' + t) as HTMLInputElement).value = vals[t]; });
  }, todayIso());
}

const stays = async (page: Page, at: string[]) => {
  await page.waitForTimeout(250);
  expect(where(page)).toEqual(at);
  await expect(page.locator('#pageFinance')).toHaveClass(/inv-page-active/);
};

test.describe('P276: Backspace', () => {
  test('in every field typed in it edits the field and never goes back', async ({ page }) => {
    await twoSteps(page);
    await bench(page);
    const here = where(page);
    // Text-like: the character before the caret goes, and the screen stays.
    for (const [id, after] of [['text', 'QX'], ['search', 'QX'], ['tel', '900'], ['url', 'https://x.i'], ['password', 'QX'],
      ['email', 'a@b.i'], ['number', '4'], ['textarea', 'QX']] as const) {
      const f = page.locator('#p276-' + id);
      await f.focus();
      await page.keyboard.press('End');
      await page.keyboard.press('Backspace');
      await expect(f, id).toHaveValue(after);
      await stays(page, here);
    }
    const ed = page.locator('#p276-editable');
    await ed.focus();
    await page.keyboard.press('End');
    await page.keyboard.press('Backspace');
    await expect(ed).toHaveText('QX');
    await stays(page, here);
    // Date and time fields, a select, and an empty field: the field's own, and no step back.
    for (const id of ['date', 'time', 'month', 'week', 'datetime-local', 'select', 'empty', 'plain']) {
      await page.locator('#p276-' + id).focus();
      await page.keyboard.press('Backspace');
      await stays(page, here);
      await expect(page.locator('#p276-' + id), id).toBeFocused();
    }
  });

  test('on a checkbox, a radio, a button, a range and the page it goes back', async ({ page }) => {
    await twoSteps(page);
    await bench(page);
    for (const id of ['checkbox', 'radio', 'ibutton', 'range', 'button', '']) {
      if (id) await page.locator('#p276-' + id).focus();
      else await page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur(); });
      await page.keyboard.press('Backspace');
      await expect.poll(() => where(page), id || 'body').toEqual(['pageFinance', 'gst']);
      await expect(page.locator('[data-action="invFinTab"][data-tab="gst"]')).toHaveAttribute('aria-selected', 'true');
      // Forward again for the next control.
      await page.goForward();
      await expect.poll(() => where(page)).toEqual(['pageFinance', 'bank']);
    }
    // A checkbox focused goes back without being ticked.
    await expect(page.locator('#p276-checkbox')).not.toBeChecked();
  });

  test('over a dialog it edits the dialog field, then closes the dialog, and the screen behind stays', async ({ page }) => {
    await twoSteps(page);
    const here = where(page);
    await page.evaluate(() => { (window as any).p276Ans = 'open'; (window as any).uiPrompt({ title: 'Reason', value: 'QX1' }).then((v: unknown) => { (window as any).p276Ans = v; }); });
    const box = page.locator('[data-ui-ask-input]');
    await expect(box).toBeFocused();
    await page.keyboard.press('End');
    await page.keyboard.press('Backspace');
    await expect(box).toHaveValue('QX');
    await stays(page, here);
    await expect(page.locator('.inv-scrim-dialog')).toHaveCount(1);
    // A number field in a dialog: the same.
    await page.evaluate(() => {
      const f = document.createElement('input');
      f.type = 'number'; f.id = 'p276DlgNum'; f.value = '42';
      document.querySelector('.inv-scrim-dialog .inv-dialog')!.appendChild(f);
    });
    await page.locator('#p276DlgNum').focus();
    await page.keyboard.press('End');
    await page.keyboard.press('Backspace');
    await expect(page.locator('#p276DlgNum')).toHaveValue('4');
    await stays(page, here);
    // On the dialog's button: the dialog closes (a question answers cancel), and only the dialog.
    await page.locator('[data-ans="cancel"]').focus();
    await page.keyboard.press('Backspace');
    await expect(page.locator('.inv-scrim-dialog')).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).p276Ans)).toBeNull();
    await stays(page, here);
    // The next Backspace goes back one step, from the screen itself.
    await page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur(); });
    await page.keyboard.press('Backspace');
    await expect.poll(() => where(page)).toEqual(['pageFinance', 'gst']);
  });

  test('a dialog opened on the first step closes on Backspace, and the app stays where it is', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    await page.goto('/?tab=pageFinance&v=gst');
    await waitForBoot(page);
    const here = where(page);
    // Opened and pressed in the same moment: before the step for the layer is written.
    await page.evaluate(() => {
      (window as any).uiAlert({ title: 'Note', body: 'A made-up note.' });
      const ok = document.querySelector('.inv-scrim-dialog [data-ans="ok"]') as HTMLElement;
      ok.focus();
      ok.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }));
    });
    await expect(page.locator('.inv-scrim-dialog')).toHaveCount(0);
    await page.waitForTimeout(250);
    expect(where(page)).toEqual(here);
  });

  test('a dialog holding typed work asks before Backspace closes it', async ({ page }) => {
    await twoSteps(page);
    const here = where(page);
    await page.evaluate(() => {
      const s = (window as any).dialogOpen('<div class="inv-dialog" data-p276-dlg><input id="p276DlgText"><button type="button" id="p276DlgBtn">Go</button></div>');
      s.dataset.typed = '1';
    });
    await page.locator('#p276DlgBtn').focus();
    await page.keyboard.press('Backspace');
    // The leave question: Stay keeps the dialog and the screen.
    await answerAsk(page, 'cancel');
    await expect(page.locator('[data-p276-dlg]')).toHaveCount(1);
    await stays(page, here);
  });

  test('held down, it takes one step: never a run of screens, and a field it empties keeps the rest', async ({ page }) => {
    await loadAppWithState(page, emptyState());
    await page.goto('/?tab=pageFinance&v=gst');
    await waitForBoot(page);
    await page.locator('[data-action="invFinTab"][data-tab="bank"]').click();
    await expect.poll(() => where(page)).toEqual(['pageFinance', 'bank']);
    await page.locator('[data-action="invFinTab"][data-tab="payments"]').click();
    await expect.poll(() => where(page)).toEqual(['pageFinance', 'payments']);
    await bench(page);
    // A field emptied by a held key: the repeats after it is empty stay in it.
    const f = page.locator('#p276-text');
    await f.focus();
    await page.keyboard.press('End');
    for (let i = 0; i < 8; i++) await page.keyboard.down('Backspace');
    await page.keyboard.up('Backspace');
    await expect(f).toHaveValue('');
    await page.waitForTimeout(300);
    expect(where(page)).toEqual(['pageFinance', 'payments']);
    // A field the app re-draws empty, its focus going to the page as the key repeats: still no step.
    await f.fill('QX');
    await f.focus();
    await page.keyboard.press('End');
    await page.keyboard.down('Backspace');
    await page.keyboard.down('Backspace');
    await page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur(); });
    for (let i = 0; i < 5; i++) await page.keyboard.down('Backspace');
    await page.keyboard.up('Backspace');
    await page.waitForTimeout(300);
    expect(where(page)).toEqual(['pageFinance', 'payments']);
    // Held on the page: one step back, to Bank, never on to GST.
    for (let i = 0; i < 6; i++) await page.keyboard.down('Backspace');
    await page.keyboard.up('Backspace');
    await expect.poll(() => where(page)).toEqual(['pageFinance', 'bank']);
    await page.waitForTimeout(400);
    expect(where(page)).toEqual(['pageFinance', 'bank']);
  });

  test('during an IME composition it never goes back', async ({ page }) => {
    await twoSteps(page);
    const here = where(page);
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', isComposing: true, bubbles: true, cancelable: true }));
    });
    await stays(page, here);
  });
});

test.describe('P276: the other single keys read the same rule', () => {
  test('A and / work from a checkbox or a button, and type into a number or date field', async ({ page }) => {
    await twoSteps(page);
    await bench(page);
    // From a checkbox (not typing): A opens Add.
    await page.locator('#p276-checkbox').focus();
    await page.keyboard.press('a');
    await expect(page.locator('[data-add-sheet]')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('.inv-scrim-dialog')).toHaveCount(0);
    // From a radio: / opens search.
    await page.locator('#p276-radio').focus();
    await page.keyboard.press('/');
    await expect(page.locator('[data-search]')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('.inv-scrim-dialog')).toHaveCount(0);
    // In fields typed in, the keys are the field's.
    for (const id of ['text', 'search', 'tel', 'textarea', 'editable', 'date', 'number', 'select']) {
      await page.locator('#p276-' + id).focus();
      await page.keyboard.press('a');
      await page.keyboard.press('/');
      await expect(page.locator('.inv-scrim-dialog'), id).toHaveCount(0);
    }
    await expect(page.locator('#p276-text')).toHaveValue('QX1a/');
  });
});
