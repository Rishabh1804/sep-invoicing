import { chromium, devices } from '@playwright/test';
import fs from 'fs';
const [,, OUT, MODE, THEME] = process.argv;
const raw = fs.readFileSync('/tmp/claude-0/-home-user-sep-invoicing/f651307a-9311-5da9-b167-21e828d05cb3/scratchpad/live-state.json', 'utf8');
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
const ctx = await b.newContext(MODE === 'desktop' ? { viewport: { width: 1280, height: 860 } } : { ...devices['Pixel 5'] });
const page = await ctx.newPage();
await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
await page.addInitScript(() => { window.print = () => {}; window.open = () => null; });
await page.addInitScript(([s, th]) => { if (!localStorage.getItem('sep_shot')) { localStorage.setItem('sep_invoicing_state', s); localStorage.setItem('sep_shot', '1'); } if (th === 'dark') localStorage.setItem('sep_inv_theme','dark'); }, [raw, THEME]);
await page.goto('http://127.0.0.1:4174/');
await page.waitForSelector('body.inv-booted', { timeout: 60000 });

const ev = e => page.evaluate(x => (0, eval)(x), e);
const snap = async n => { await page.waitForTimeout(400); await page.screenshot({ path: `${OUT}/${MODE}-${THEME}-${n}.png`, fullPage: MODE !== 'desktop' ? false : false }); };
const steps = [
  ['home', `switchTab('pageHome')`],
  ['create', `switchTab('pageCreate')`],
  ['im', `switchTab('pageIM')`],
  ['register', `switchTab('pageRegister')`],
  ['clients', `switchTab('pageClients')`],
  ['items', `document.querySelector('[data-action="invSwitchSubView"][data-view="items"]').click()`],
  ['perf', `document.querySelector('[data-action="invSwitchSubView"][data-view="performance"]').click()`],
  ['todo', `switchTab('pageTodo')`],
  ['stock', `switchTab('pageStock')`],
  ['staff-day', `switchTab('pageStaff'); document.querySelector('[data-action="invAttView"][data-view="day"]').click()`],
  ['staff-week', `document.querySelector('[data-action="invAttView"][data-view="week"]').click()`],
  ['staff-pay', `document.querySelector('[data-action="invAttView"][data-view="pay"]').click()`],
  ['staff-areas', `document.querySelector('[data-action="invAttView"][data-view="areas"]').click()`],
  ['stats-overview', `switchTab('pageStats'); statsSetTab('overview')`],
  ['stats-clients', `statsSetTab('clients')`],
  ['stats-cost', `statsSetTab('cost')`],
  ['history', `switchTab('pageHistory')`],
  ['settings', `openSettings()`],
];
for (const [n, js] of steps) { try { await ev(js); await page.evaluate(() => window.scrollTo(0, 0)); await snap(n); } catch (e) { console.log(n, e.message.slice(0, 120)); } }
await b.close();
