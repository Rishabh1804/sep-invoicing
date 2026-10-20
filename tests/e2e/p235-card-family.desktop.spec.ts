import { test } from '@playwright/test';
import { familySkeleton, nothingFocused } from './p235-card-family.fixture';

// P235 (UI pass 3, U2R; docs/UI_PASS_3.md §24b–§24d) on the desktop: every widget at every size on three books in one skeleton (the
// head 44 px, the corner 14 px, the sides, the parts in order), its type's surface, salience by severity (quiet, the amber edge, the
// red edge and tint, the world outside never edged), every title whole in Geist, every chart label 11 px or more as drawn; and
// nothing focused when Home is drawn.

test('every card is one skeleton in its type, salient by severity, its title whole in Geist and its chart labels readable', async ({ page }) => {
  test.setTimeout(300_000);
  await familySkeleton(page);
});

test('nothing is focused when Home is drawn', async ({ page }) => {
  await nothingFocused(page);
});
