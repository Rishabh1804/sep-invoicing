import { test, expect } from '@playwright/test';
import { loadAppWithState, todayIso } from './fixtures';
import { type Load, longBook, measureLoad, pinFace, walkMap } from './load-fixture';

// P195: the cognitive-load benchmark's instrument (docs/TAB_MAP.md §3b, I10, TM1 item 12; owner, 8–9 Oct 2026: "survey all the
// screens to make sure the app is up to the mark for our cognitive load benchmark", then the tab map built to it). Every screen
// of the map, on the phone, over the long book (the owner's book's shape at a small scale, made up): its length in phone
// screens, its blocks of text over 120 characters, its meta lines chaining three facts or more with "·", its toolbar's rows,
// and, where §3d asks for one, a verdict inside the first screen.
//
// A budget is a ceiling, never a target: each step that assembles a screen lowers its budget to the new measure in the same
// commit, and no budget is raised to get green. The budgets below are TM1's, then each step's for the screens it assembled
// (TM2: Today's; TM3: Money's): every screen measured on eleven days of the calendar (a Sunday, a month's first and last days, the financial
// year's first, the year's), the worst of them kept, the length rounded up to the next half screen. The face is pinned
// (Liberation, as on every runner) and the clock to 11:30 on today, so a screen measures the same on any machine at any hour.
// What is measured is what is drawn: a view or widget the page hides is not on the screen's face (TM2: Pulse had been charged
// with Needs you's tasks and the widgets TM2c hides).

/* "Section › Row view › Own view": { screens, blocks, chains, toolbarRows }. */
const LOAD_BUDGET: Record<string, Omit<Load, 'verdictTop'>> = {
  // TM2. Needs you's one toolbar row is the To-do's Add (TM2a puts it there; the one budget a step has raised, and said so
  // at the stop, I10). Pulse took Stats → Overview's cards and gave the room back (three widgets hidden, the cards and the
  // widgets shut on the phone).
  'Today › Needs you': { screens: 3, blocks: 1, chains: 2, toolbarRows: 1 },
  'Today › Pulse': { screens: 4, blocks: 0, chains: 1, toolbarRows: 1 },
  'Today › Stats › By client': { screens: 3.5, blocks: 0, chains: 0, toolbarRows: 1 },
  'Today › Stats › Cost': { screens: 3, blocks: 0, chains: 0, toolbarRows: 1 },
  'Today › Stats › Trends': { screens: 2, blocks: 0, chains: 0, toolbarRows: 1 },
  'Today › Reports': { screens: 3, blocks: 0, chains: 0, toolbarRows: 5 },
  'Today › Planner › Play': { screens: 2.5, blocks: 0, chains: 0, toolbarRows: 1 },
  'Today › Planner › Ledger': { screens: 3.5, blocks: 0, chains: 0, toolbarRows: 1 },
  'Today › Planner › A day': { screens: 2.5, blocks: 0, chains: 0, toolbarRows: 1 },
  'Today › Planner › Moves': { screens: 4, blocks: 0, chains: 0, toolbarRows: 1 },
  'Office › Pipeline': { screens: 5, blocks: 0, chains: 12, toolbarRows: 1 },
  'Office › Challans › Awaiting invoice': { screens: 4, blocks: 0, chains: 0, toolbarRows: 2 },
  'Office › Challans › Invoiced': { screens: 2.5, blocks: 0, chains: 0, toolbarRows: 4 },
  'Office › Invoices': { screens: 4, blocks: 0, chains: 0, toolbarRows: 8 },
  'Office › Clients › Clients': { screens: 2, blocks: 0, chains: 0, toolbarRows: 2 },
  'Office › Clients › Parts': { screens: 1.5, blocks: 0, chains: 3, toolbarRows: 4 },
  'Office › Clients › Performance': { screens: 3, blocks: 5, chains: 8, toolbarRows: 1 },
  'Office › Sales › Prospects': { screens: 1.5, blocks: 0, chains: 0, toolbarRows: 2 },
  'Office › Sales › Quotations': { screens: 1.5, blocks: 0, chains: 3, toolbarRows: 2 },
  'Floor › Overview': { screens: 2.5, blocks: 1, chains: 0, toolbarRows: 2 },
  'Floor › People › Overview': { screens: 3.5, blocks: 3, chains: 0, toolbarRows: 1 },
  'Floor › People › Day': { screens: 3, blocks: 3, chains: 0, toolbarRows: 7 },
  'Floor › People › Week': { screens: 3.5, blocks: 4, chains: 0, toolbarRows: 1 },
  'Floor › People › Register': { screens: 1.5, blocks: 1, chains: 0, toolbarRows: 3 },
  'Floor › People › Pay': { screens: 4, blocks: 4, chains: 4, toolbarRows: 1 },
  'Floor › People › Areas': { screens: 3, blocks: 6, chains: 10, toolbarRows: 1 },
  'Floor › People › Roster': { screens: 2.5, blocks: 0, chains: 0, toolbarRows: 2 },
  'Floor › Production › Overview': { screens: 5, blocks: 1, chains: 7, toolbarRows: 2 },
  'Floor › Production › Equipment': { screens: 2, blocks: 0, chains: 0, toolbarRows: 3 },
  'Floor › Production › In plant': { screens: 8, blocks: 3, chains: 64, toolbarRows: 3 },
  'Floor › Production › Lines': { screens: 3, blocks: 3, chains: 0, toolbarRows: 4 },
  'Floor › Production › Entries': { screens: 17.5, blocks: 0, chains: 109, toolbarRows: 5 },
  'Floor › Stock › Overview': { screens: 3, blocks: 1, chains: 0, toolbarRows: 2 },
  'Floor › Stock › Lines': { screens: 1.5, blocks: 0, chains: 0, toolbarRows: 3 },
  'Floor › Power › Overview': { screens: 3, blocks: 1, chains: 2, toolbarRows: 1 },
  'Floor › Power › Cuts': { screens: 2.5, blocks: 0, chains: 13, toolbarRows: 1 },
  'Floor › Power › Causes': { screens: 3, blocks: 2, chains: 2, toolbarRows: 1 },
  'Floor › Power › Load & bills': { screens: 1.5, blocks: 0, chains: 0, toolbarRows: 1 },
  'Floor › Power › Case': { screens: 4, blocks: 0, chains: 0, toolbarRows: 1 },
  // TM3. Receivables, Payments and Bank have the one toolbar row a work screen has (§3e: Cheque received; Add a bill; search,
  // Filter and More), raised from 0 and said to the owner (I10). Each gave the room back: Receivables and Payments show the
  // first few of what needs the owner, the Overview's charts fold, Payments' sections fold.
  'Money › Overview': { screens: 1.5, blocks: 1, chains: 0, toolbarRows: 1 },
  'Money › Receivables': { screens: 3, blocks: 0, chains: 0, toolbarRows: 1 },
  'Money › Payments': { screens: 2, blocks: 0, chains: 0, toolbarRows: 1 },
  'Money › Bank': { screens: 3.5, blocks: 0, chains: 0, toolbarRows: 1 },
  'Money › GST': { screens: 1.5, blocks: 0, chains: 0, toolbarRows: 0 },
  'History': { screens: 4.5, blocks: 0, chains: 4, toolbarRows: 5 },
  'Knowledge › Start': { screens: 2, blocks: 0, chains: 2, toolbarRows: 1 },
  'Knowledge › Library': { screens: 3, blocks: 0, chains: 2, toolbarRows: 5 },
  'Knowledge › Troubleshoot': { screens: 1.5, blocks: 0, chains: 2, toolbarRows: 2 },
  'Knowledge › Records': { screens: 1.5, blocks: 0, chains: 2, toolbarRows: 4 },
  'Knowledge › Training': { screens: 3, blocks: 0, chains: 14, toolbarRows: 1 },
};

/* The screens §3d marks *verdict*: a [data-verdict] in the first phone screen. Each joins in the step that builds its verdict. */
const VERDICT: string[] = [
  // TM2
  'Today › Stats › By client', 'Today › Stats › Cost', 'Today › Stats › Trends',
  'Today › Planner › Play', 'Today › Planner › Ledger', 'Today › Planner › A day', 'Today › Planner › Moves',
  // TM3: Money's five (the Overview's first hero carries its verdict).
  'Money › Overview', 'Money › Receivables', 'Money › Payments', 'Money › Bank', 'Money › GST',
];

test('every screen of the map is within its load budget on the long book', async ({ page }) => {
  test.setTimeout(300_000);
  const errs: string[] = [];
  page.on('pageerror', e => errs.push(e.message));
  await pinFace(page);
  await page.clock.install({ time: new Date(todayIso() + 'T11:30:00') });
  await loadAppWithState(page, longBook());
  const seen: Record<string, Load> = {};
  await walkMap(page, async name => { seen[name] = await measureLoad(page); });

  const over: string[] = [];
  const vh = page.viewportSize()!.height;
  for (const [name, m] of Object.entries(seen)) {
    const b = LOAD_BUDGET[name];
    if (!b) { over.push(name + ': no budget (measured ' + JSON.stringify(m) + ')'); continue; }
    for (const k of ['screens', 'blocks', 'chains', 'toolbarRows'] as const) {
      if (m[k] > b[k]) over.push(name + ': ' + k + ' ' + m[k] + ' over its budget of ' + b[k]);
    }
    if (VERDICT.includes(name) && (m.verdictTop == null || m.verdictTop >= vh)) over.push(name + ': no verdict in the first screen');
  }
  for (const name of Object.keys(LOAD_BUDGET)) if (!seen[name]) over.push(name + ': a budget for a screen the map no longer has');
  for (const name of VERDICT) if (!seen[name]) over.push(name + ': a verdict asked of a screen the map no longer has');
  // Everything measured, for the step's report (before → after), whether or not it passed.
  await test.info().attach('load', { body: JSON.stringify(seen, null, 1), contentType: 'application/json' });
  expect(errs, 'no page error on any screen').toEqual([]);
  expect(over, 'every screen within its budget').toEqual([]);
});
