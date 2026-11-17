import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';

/*
 * P280, the new address (S0): what is published there, and what a move carries. No browser: the files themselves.
 * - split/dist.sh writes only the app's own files; never CLAUDE.md, docs/, the tests, the sources or checkin.html (which stays
 *   on the old address). Everything the page, sw.js and the manifest load is in it.
 * - Every storage key the app's code names is either carried by the handover or listed with the reason it is not (move.js):
 *   a key added later without a word fails here, so the next move cannot leave it behind unnoticed.
 */

const ROOT = path.resolve(__dirname, '..', '..');

function walk(dir: string, base = dir): string[] {
  return readdirSync(dir).flatMap(f => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p, base) : [path.relative(base, p).split(path.sep).join('/')];
  });
}

test('dist holds the app and nothing else: no CLAUDE.md, no docs, no sources, no checkin.html', () => {
  const out = path.join(mkdtempSync(path.join(tmpdir(), 'p280-')), 'dist');
  execFileSync('bash', [path.join(ROOT, 'split', 'dist.sh'), out], { stdio: 'pipe' });
  const files = walk(out).sort();
  for (const f of files) {
    expect(f).not.toMatch(/(^|\/)(CLAUDE|AGENTS|Memory|PERSONA_REGISTRY|README)\.md$/);
    expect(f).not.toMatch(/^(docs|split|tests|tools|server|\.github|\.claude)\//);
    expect(f).not.toMatch(/\.(md|ts|mjs|sh)$/);
  }
  expect(files).not.toContain('checkin.html');
  expect(files).not.toContain('sep-invoicing.html');
  // The page is the built page, byte for byte.
  expect(readFileSync(path.join(out, 'index.html'), 'utf8')).toBe(readFileSync(path.join(ROOT, 'index.html'), 'utf8'));

  // Everything the app loads from its own address is there.
  const want = new Set<string>(['index.html', 'sw.js', 'manifest.json', 'version.json']);
  const sw = readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const core = sw.match(/const CORE_ASSETS = \[([\s\S]*?)\];/)![1];
  for (const m of core.matchAll(/'\.\/([^']+)'/g)) want.add(m[1]);
  const man = JSON.parse(readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  for (const i of man.icons) want.add(i.src);
  for (const w of man.widgets || []) {
    want.add(w.ms_ac_template);
    for (const s of w.screenshots || []) want.add(s.src);
    for (const i of w.icons || []) want.add(i.src);
  }
  const head = readFileSync(path.join(ROOT, 'split', 'head.html'), 'utf8');
  for (const m of head.matchAll(/<link[^>]+href="([^":]+)"/g)) want.add(m[1]);
  // The palette's icons, which appearance.js swaps in by name (icons/icon-<palette>.svg and -192.png).
  for (const p of ['zinc', 'teal', 'terracotta']) { want.add(`icons/icon-${p}.svg`); want.add(`icons/icon-${p}-192.png`); }
  for (const f of want) expect(files, f).toContain(f);
});

test('every storage key the app names is carried by the handover or listed with why it is not', () => {
  const ctx: Record<string, any> = {};
  vm.runInNewContext(readFileSync(path.join(ROOT, 'split', 'move.js'), 'utf8'), ctx);
  const carried: string[] = ctx.MOVE_CARRY_LS, keys: string[] = ctx.MOVE_CARRY_KEYS, not: Record<string, string> = ctx.MOVE_NOT_CARRIED;
  const known = new Set([...carried, ...keys, ...Object.keys(not)]);
  // No key in two lists.
  expect(carried.length + keys.length + Object.keys(not).length).toBe(known.size);
  for (const k of Object.keys(not)) expect(not[k].length, k).toBeGreaterThan(10);

  const named = new Set<string>();
  const srcDir = path.join(ROOT, 'split');
  // Named outside move.js, which names every one of them in its lists.
  for (const f of readdirSync(srcDir).filter(f => /\.(js|html)$/.test(f) && f !== 'move.js')) {
    const src = readFileSync(path.join(srcDir, f), 'utf8');
    for (const m of src.matchAll(/['"`](sep_inv_[a-z0-9_]+|sep_invoicing_(?:state|rev))['"`]/g)) named.add(m[1]);
  }
  expect(named.size).toBeGreaterThan(40);
  const unlisted = [...named].filter(k => !known.has(k));
  expect(unlisted, 'storage keys neither carried nor listed in MOVE_NOT_CARRIED').toEqual([]);
  // And no list names a key the app no longer uses.
  const stale = [...known].filter(k => !named.has(k) && k !== ctx.MOVE_MARK_OLD && k !== ctx.MOVE_MARK_NEW);
  expect(stale, 'listed in move.js but named nowhere else').toEqual([]);
});
