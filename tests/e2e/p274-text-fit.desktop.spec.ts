import { test, expect, type Page } from '@playwright/test';
import { loadAppWithState, switchTab } from './fixtures';
import { walkPages, walkDialogs, setStopHook, type Stop } from './sweep-fixture';
import { fitState, fitScan, fitShown, CI_TEXT, type FitHit } from './fit-fixture';

// P274 on the desktop: the same sweep at 1024px, the narrowest desktop (the layout switches there) and where the shell and a
// page's side pane leave a card least room, in both themes; then the invoice's line editor, which the walk draws empty.

for (const scheme of ['light', 'dark'] as const) {
  test(`every screen and dialog at 1024px (${scheme}): text fits its box`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.emulateMedia({ colorScheme: scheme });
    await loadAppWithState(page, fitState());
    await page.addStyleTag({ content: CI_TEXT });
    const hits: FitHit[] = [];
    setStopHook(async (p, where) => { hits.push(...await fitScan(p, where)); });
    const stops: Stop[] = [];
    try {
      await walkPages(page, `p274-1024-${scheme}`, stops);
      await walkDialogs(page, `p274-1024-${scheme}`, stops);
    } finally { setStopHook(null); }
    expect(stops.length).toBeGreaterThan(40);
    expect(fitShown(hits)).toEqual([]);
  });
}

/* Create with one line carrying a long part, a long description and a crore: 10,991,241.8 kg at ₹9.50. */
async function createWithLongLine(page: Page) {
  await switchTab(page, 'pageCreate');
  await page.evaluate(() => (0, eval)(`selectClient(1); addLineItem();
    invoiceForm.items[0].partNumber = 'QX1-MOUNTING-BRACKET-ASSEMBLY-LH-0001234567';
    invoiceForm.items[0].desc = 'ZINC ELECTROPLATING OF MOUNTING BRACKET ASSEMBLY LEFT HAND WITH TRIVALENT BLUE PASSIVATION AND SEALER';
    invoiceForm.items[0].qty = 10991241.8; invoiceForm.items[0].rate = 9.5; recalcLineItem(invoiceForm.items[0], S.clients[0]); renderCreateForm()`));
  await expect(page.locator('#pageCreate .inv-line')).toHaveCount(1);
}
const lineBox = (page: Page) => page.locator('#pageCreate .inv-lines').evaluate(l => {
  const lb = l.getBoundingClientRect(), part = l.querySelector('.inv-line-part')!.getBoundingClientRect();
  const amt = l.querySelector('.inv-line-amt input') as HTMLInputElement;
  const past = Array.from(l.querySelectorAll('.inv-line *')).filter(e => (e as HTMLElement).checkVisibility() && e.getBoundingClientRect().right > lb.right + 1).length;
  return { w: lb.width, sw: l.scrollWidth, part: part.width, amtCut: amt.scrollWidth > amt.clientWidth + 1, amt: amt.value, past,
    head: getComputedStyle(l.querySelector('.inv-lines-head')!).display };
});

test('the line editor keeps its part and its amount in a card at 1024px', async ({ page }) => {
  // Beside What Save records the lines are 538px: the row's fixed columns left the part field no width at all and ran the amount
  // 120px past the card. Under 48rem the desktop's lines take the phone's grid, labelled.
  await page.setViewportSize({ width: 1024, height: 768 });
  await loadAppWithState(page, fitState());
  await page.addStyleTag({ content: CI_TEXT });
  await createWithLongLine(page);
  const r = await lineBox(page);
  expect(r.w).toBeLessThan(48 * 16);
  expect(r.sw).toBeLessThanOrEqual(Math.ceil(r.w) + 1);
  expect(r.past).toBe(0);
  expect(r.part).toBeGreaterThan(r.w / 2);
  expect(r.amtCut, r.amt).toBe(false);
  expect(r.head).toBe('none');
  await expect(page.locator('#pageCreate .inv-line .inv-field-label', { hasText: 'Amount' })).toBeVisible();
});

test('the line editor is a row at 1280px and shows a crore amount whole', async ({ page }) => {
  // In the row the amount's field was 7rem with 12px insets: 104416797.10 read "104416797.1", another figure.
  await page.setViewportSize({ width: 1280, height: 800 });
  await loadAppWithState(page, fitState());
  await page.addStyleTag({ content: CI_TEXT });
  await createWithLongLine(page);
  const r = await lineBox(page);
  expect(r.w).toBeGreaterThanOrEqual(48 * 16);
  expect(r.head).toBe('grid');
  expect(r.sw).toBeLessThanOrEqual(Math.ceil(r.w) + 1);
  expect(r.part).toBeGreaterThan(64);
  expect(r.amt).toBe('104416797.10');
  expect(r.amtCut, r.amt).toBe(false);
});

test('the desktop bar keeps the page’s name and a few letters of each step at 1024px', async ({ page }) => {
  // A long trail took the page's own name down to "Ho…" and an earlier step to "…" alone. The name never gives way; a step keeps
  // 2.5rem.
  await page.setViewportSize({ width: 1024, height: 768 });
  await loadAppWithState(page, fitState());
  await page.addStyleTag({ content: CI_TEXT });
  for (const id of ['pageHome', 'pageFloor', 'pageKnow', 'pagePlanner', 'pageStats', 'pageReports']) await switchTab(page, id);
  await expect(page.locator('#navTrail .inv-btn-link')).not.toHaveCount(0);
  const t = await page.evaluate(() => {
    const title = document.getElementById('topbarTitle')!;
    return { title: title.textContent, cut: title.scrollWidth > title.clientWidth + 1,
      steps: Array.from(document.querySelectorAll('#navTrail .inv-btn-link')).map(b => ({ t: b.textContent, w: b.getBoundingClientRect().width })) };
  });
  expect(t.cut, t.title!).toBe(false);
  for (const s of t.steps) expect(s.w, s.t!).toBeGreaterThanOrEqual(39.5);
});
