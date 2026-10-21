import { type Page } from '@playwright/test';
import { loadAppWithState, emptyState, noSeedIM } from './fixtures';
import { longBook } from './load-fixture';
import { bigSweepState } from './sweep-fixture';
import { drawBoard } from './p224-widget-sweep.fixture';

// The card family's walk (UI pass 3, U2R; docs/UI_PASS_3.md §24), shared by P235–P238 on both layouts: every widget the person may see,
// at every size it allows, drawn on a board of that size alone, on a book; then `check` reads every card on the board in the page and
// returns what is wrong, each named id@size. The fonts are Geist (the fixtures route them); a measure is taken only once the faces
// have loaded (document.fonts.check), so a title's width is Geist's and never a fallback's.

export const BOOKS: Record<string, () => any> = {
  long: longBook,
  empty: () => ({ ...emptyState(), incomingMaterial: noSeedIM() }),
  crore: bigSweepState,
};

/* The widgets the person on the device may see, each with its sizes and its type, in the gallery's order. */
export async function defsSeen(page: Page): Promise<Array<{ id: string; sizes: string[]; type: string }>> {
  return page.evaluate(() => (window as any).WIDGET_DEFS.filter((d: any) => (window as any).wdgSees(d)).map((d: any) => ({ id: d.id, sizes: d.sizes, type: d.type })));
}

/* Geist in hand before anything is measured: a title's width read in a fallback face is not a measurement. */
export async function geistReady(page: Page): Promise<void> {
  await page.waitForFunction(() => document.fonts.status === 'loaded' && document.fonts.check('600 13px Geist') && document.fonts.check('600 11px "Geist Mono"'));
}

/* Every widget at every size it allows, a board a size; `check` runs in the page over the board's cards and returns problems. */
export async function walkFamily(page: Page, books: string[], check: (page: Page, where: string) => Promise<string[]>): Promise<{ bad: string[]; drawn: number }> {
  const bad: string[] = [];
  let drawn = 0;
  for (const book of books) {
    await loadAppWithState(page, BOOKS[book]());
    await geistReady(page);
    const defs = await defsSeen(page);
    for (const size of ['s', 'm', 'l']) {
      const list = defs.filter(d => d.sizes.includes(size)).map(d => [d.id, size] as [string, string]);
      if (!list.length) continue;
      await drawBoard(page, list);
      await page.waitForTimeout(80);
      bad.push(...await check(page, `${book} ${size}`));
      drawn += await page.locator('#homeBoard .inv-widget').count();
    }
  }
  return { bad, drawn };
}
