import { test } from '@playwright/test';
import { actionCensus, chooseKept, moveDialog } from './p236-action-rows.fixture';

// P236 (UI pass 3, U2R; docs/UI_PASS_3.md §24e) on the desktop: everything a person can press in a card is in one of its five rows or
// is an item's own; an Act holds a tinted and a text button at most; the Source's links are only Refresh and a feed's credit; a
// Choose only where offered, kept per person across a reload; nothing secondary, ghost, primary or a chip.

test('everything pressed in a card is in one of the five rows or an item’s own, each row as §24e draws it', async ({ page }) => {
  test.setTimeout(300_000);
  await actionCensus(page);
});

test('a Choose is drawn at Large, picks for the person, and a reload keeps it', async ({ page }) => {
  await chooseKept(page);
});

test('a move opens its own dialog, where Add to my list is', async ({ page }) => {
  await moveDialog(page);
});
