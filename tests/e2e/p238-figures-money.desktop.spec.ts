import { test } from '@playwright/test';
import { inrCardCases, boardMoney, faces } from './p238-figures-money.fixture';

// P238 (UI pass 3, U2R; docs/UI_PASS_3.md §24k–§24l) on the desktop: inrCard's table and its edges; every amount on a board short, its
// exact figure its title; a Ledger's lines whole and adding up; a rate with its paise; figures in Geist and identifiers in Geist Mono.

test('inrCard: a board’s money short, every step through gstRound', async ({ page }) => { await inrCardCases(page); });
test('every amount on a board is short with its exact title, a Ledger adds up, a rate keeps its paise', async ({ page }) => { test.setTimeout(300_000); await boardMoney(page); });
test('a figure is Geist with tabular figures, an identifier Geist Mono with its slashed zero', async ({ page }) => { await faces(page); });
