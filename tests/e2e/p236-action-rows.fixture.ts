import { expect, type Page } from '@playwright/test';
import { loadAppWithState, waitForBoot } from './fixtures';
import { longBook } from './load-fixture';
import { walkFamily, geistReady } from './p235-family.fixture';
import { drawBoard } from './p224-widget-sweep.fixture';

// P236 (UI pass 3, U2R; docs/UI_PASS_3.md §24e): a census of everything a person can press in every card, at every size, on the long
// and the empty book. Each is in one of the five rows (Open: the head; Choose: in the head, or under it on the phone; More: the list's
// last row; Act; Source) or is an item's own (a row's own action, a tile, a key on a tray, a chart's datum). An Act holds one tinted
// and one text button at most; the Source is the card's last line and its links are only Refresh and a feed's credit; a Choose is
// drawn only at the sizes its widget offers it; nothing secondary, ghost, primary or a chip in a card; every target 44 px on the phone.

const ITEM = ['.inv-docket-row', '.inv-plant-row', '.inv-ledger-line', '.inv-brief-move', '.inv-brief-movecard', '.inv-brief-when', '.inv-crew-row',
  '.inv-wire-item', '.inv-tray', '.inv-docket-stage', '.inv-tile', '.inv-chart-ranked-row', '.inv-row', 'svg', '.inv-chart-keys', '.inv-blank',
  '.inv-mkt-week'].join(', ');

export async function rowProblems(page: Page, where: string): Promise<string[]> {
  const bad = await page.evaluate(([ITEM]) => {
    const w = window as any, out: string[] = [], phone = !document.body.classList.contains('inv-desktop');
    document.querySelectorAll('#homeBoard .inv-widget').forEach(el => {
      const card = el as HTMLElement, def = w.wdgDef(card.dataset.w), size = card.dataset.size as string, at = card.dataset.w + '@' + size;
      const press = Array.from(card.querySelectorAll('button, a[href], select, input:not([type="hidden"]), [data-action]')) as HTMLElement[];
      press.forEach(p => {
        if (!p.checkVisibility()) return;
        const name = p.tagName.toLowerCase() + '.' + String(p.className && p.className.baseVal != null ? p.className.baseVal : p.className).split(' ')[0] + ' "' + (p.textContent || '').trim().slice(0, 24) + '"';
        const row = p.closest('.inv-widget-head') ? 'open' : p.closest('.inv-widget-choose') ? 'choose' : p.closest('[data-wdg-more]') ? 'more'
          : p.closest('.inv-widget-act') ? 'act' : p.closest('.inv-widget-src') ? 'source' : p.closest('.inv-widget-body') && p.closest(ITEM) ? 'item' : '';
        if (!row) out.push(at + ': pressed outside the five rows and every item: ' + name);
        if (p.matches('.inv-btn-secondary, .inv-btn-ghost, .inv-btn-primary, .inv-chip')) out.push(at + ': a ' + p.className + ' in a card');
        if (row === 'source' && !p.matches('.inv-widget-refresh, a[target="_blank"]')) out.push(at + ': the Source links ' + name);
        // Every target 44 px on the phone, a chart's own datum aside (it is read by its <title> and the chart's screen). A tick box
        // is pressed through the label it sits in (a row's tick reaches the row's edges), so the label is the target measured.
        const tgt = p.matches('input') && p.closest('label') ? p.closest('label') as HTMLElement : p, th = tgt.getBoundingClientRect().height;
        if (phone && !p.closest('svg') && th < 43.5 && !p.matches('.inv-chart-ranked-row')) out.push(at + ': a target ' + Math.round(th) + 'px: ' + name);
      });
      const act = card.querySelector('.inv-widget-act');
      if (act) {
        const kids = Array.from(act.children) as HTMLElement[];
        if (kids.filter(k => k.matches('.inv-btn-tint')).length > 1 || kids.filter(k => k.matches('.inv-btn-link')).length > 1 ||
          kids.some(k => !k.matches('.inv-btn-tint, .inv-btn-link'))) out.push(at + ': the Act holds ' + kids.map(k => k.className).join(' | '));
      }
      // A Choose only where the widget offers it (Large unless it says), in the head on the desktop and under it on the phone.
      const choose = card.querySelector('.inv-seg-choose, [data-corr-picks], .inv-corr-pair') as HTMLElement | null;
      const offered = !!def.choose && (def.choose.at || ['l']).indexOf(size) >= 0;
      if (choose && !offered) out.push(at + ': a Choose at ' + size);
      if (choose && (phone ? !choose.closest('.inv-widget-choose') && !choose.closest('.inv-widget-head') : !choose.closest('.inv-widget-head'))) out.push(at + ': a Choose out of its place');
    });
    return out;
  }, [ITEM]);
  return bad.map(b => where + ' · ' + b);
}

export async function actionCensus(page: Page) {
  const errs: string[] = [];
  page.on('pageerror', e => errs.push(e.message));
  const { bad, drawn } = await walkFamily(page, ['long', 'empty'], rowProblems);
  expect(drawn).toBeGreaterThan(60);
  expect(errs).toEqual([]);
  expect(bad).toEqual([]);
}

/* A Choose is the person's: picked, the card alone is drawn again, and a reload keeps it. */
export async function chooseKept(page: Page) {
  await loadAppWithState(page, longBook());
  await geistReady(page);
  await drawBoard(page, [['owed', 'l'], ['prodday', 'l']]);
  const owed = page.locator('#homeBoard .inv-widget[data-w="owed"]');
  await expect(owed.locator('[data-action="invWdgChoose"][data-v="client"]')).toHaveAttribute('aria-pressed', 'true');
  await owed.locator('[data-action="invWdgChoose"][data-v="age"]').click();
  await expect(owed.locator('[data-action="invWdgChoose"][data-v="age"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(owed.locator('.inv-meter')).toHaveCount(1);
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('sep_inv_layout') || '{}'));
  expect(st.people['-'].home.opts.owed.choose).toBe('age');
  await page.reload();
  await waitForBoot(page);
  await expect(page.locator('#homeBoard .inv-widget[data-w="owed"] [data-action="invWdgChoose"][data-v="age"]')).toHaveAttribute('aria-pressed', 'true');
  // A Medium has no Choose: the widget draws its default there.
  await drawBoard(page, [['owed', 'm']]);
  await expect(page.locator('#homeBoard .inv-widget[data-w="owed"] .inv-seg-choose')).toHaveCount(0);
}

/* A move opens its own dialog, where Add to my list is; its action stays at the row's end. */
export async function moveDialog(page: Page) {
  await loadAppWithState(page, longBook());
  await drawBoard(page, [['dofirst', 'm']]);
  const card = page.locator('#homeBoard .inv-widget[data-w="dofirst"]');
  const move = card.locator('.inv-brief-move').first();
  await expect(move.locator('.inv-btn-tint')).toHaveCount(1);
  await move.locator('[data-action="invWdgMoveOpen"]').click();
  const dlg = page.locator('[data-adv-dialog]');
  await expect(dlg).toBeVisible();
  await expect(dlg.locator('[data-action="invAdvTask"]')).toHaveText('Add to my list');
  await dlg.locator('[data-action="invAdvTask"]').click();
  // On the list: the dialog says so where its button stood, and the task is the owner's own.
  await expect(dlg.locator('[data-action="invAdvTask"]')).toHaveCount(0);
  await expect(dlg).toContainText('On your list');
  const tasks = await page.evaluate(() => (window as any).todoData().tasks.filter((t: any) => t.advKey).length);
  expect(tasks).toBe(1);
}
