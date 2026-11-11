#!/usr/bin/env node
// The atlas's structure and budgets (docs/atlas/README.md). Plain Node, no dependencies.
//   node tools/atlas-check.mjs            the hard checks; exit 1 on any failure
//   node tools/atlas-check.mjs --base <ref>   also warn when a split/ module changed and no topic naming it did
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ATLAS = join(ROOT, 'docs/atlas');
const LIMIT = { core: 16 * 1024, topic: 28 * 1024, readme: 6 * 1024 };
const fails = [];
const warns = [];
const fail = (m) => fails.push(m);
const read = (p) => readFileSync(p, 'utf8');
const size = (p) => statSync(p).size;
const kb = (n) => (n / 1024).toFixed(1) + ' KB';

// L0: the core.
const corePath = join(ROOT, 'CLAUDE.md');
const core = read(corePath);
if (size(corePath) > LIMIT.core) fail(`CLAUDE.md is ${kb(size(corePath))}, over its ${kb(LIMIT.core)} budget: move detail into a topic`);
// An import is '@path' at a line's start or after a space; Claude Code loads it at launch, past the budget unseen.
core.split('\n').forEach((l, i) => {
  const m = /(^|\s)@([\w./~-]+\.(md|txt|json|ya?ml))\b/.exec(l);
  if (m || /^@\S/.test(l)) fail(`CLAUDE.md:${i + 1} imports a file (${(m ? '@' + m[2] : l.trim())}): link to it instead`);
});

// A path in backticks in a file agents load: it must exist. Placeholders (<x>, *, …, NNN) are skipped.
function checkTicks(file) {
  const rel = file.slice(ROOT.length + 1);
  const re = /`((?:docs|tools|split|tests|\.claude|\.github|\.githooks|server)\/[^`\s]+|[A-Za-z_]+\.md)`/g;
  let m;
  const text = read(file);
  while ((m = re.exec(text))) {
    const p = m[1].replace(/[.,;:]+$/, '');
    if (/[<>*…]|NNN|YYYY/.test(p)) continue;
    // A bare file name is looked for beside the file that names it, then at the root.
    if (!existsSync(join(ROOT, p)) && !existsSync(join(dirname(file), p))) fail(`${rel} names \`${p}\`, which does not exist`);
  }
}

// Links in a markdown file, relative to it.
function links(file) {
  const out = [];
  const re = /\]\(([^)#\s]+)(#[^)]*)?\)/g;
  let m;
  const text = read(file);
  while ((m = re.exec(text))) if (!/^[a-z]+:/i.test(m[1])) out.push(m[1]);
  return out;
}
function checkLinks(file) {
  for (const l of links(file)) if (!existsSync(join(dirname(file), l))) fail(`${file.slice(ROOT.length + 1)} links to ${l}, which does not exist`);
}

// A topic's header.
function header(file) {
  const L = read(file).split('\n');
  if (L[0] !== '---') return null;
  const end = L.indexOf('---', 1);
  if (end < 0) return null;
  const h = {};
  for (const l of L.slice(1, end)) {
    const m = /^([a-z]+):\s*(.*)$/.exec(l);
    if (m) h[m[1]] = m[2];
  }
  const list = (v) => (v || '').replace(/^\[|\]$/g, '').split(',').map((s) => s.trim()).filter(Boolean);
  return { subject: h.subject, domain: h.domain, modules: list(h.modules), specs: list(h.specs), tests: list(h.tests), updated: h.updated };
}

// L1: the index.
const indexPath = join(ATLAS, 'INDEX.md');
if (!existsSync(indexPath)) fail('docs/atlas/INDEX.md is missing');
const index = existsSync(indexPath) ? read(indexPath) : '';
for (const f of ['INDEX.md', 'MODULES.md', 'HEADINGS.md', 'README.md']) {
  if (existsSync(join(ATLAS, f))) checkLinks(join(ATLAS, f));
  else fail(`docs/atlas/${f} is missing`);
}
checkLinks(corePath);
checkTicks(corePath);
if (existsSync(join(ATLAS, 'README.md'))) checkTicks(join(ATLAS, 'README.md'));
if (existsSync(join(ROOT, 'docs/NEXT_SESSION.md'))) checkTicks(join(ROOT, 'docs/NEXT_SESSION.md'));

// L2 and L3.
const domains = readdirSync(ATLAS).filter((d) => statSync(join(ATLAS, d)).isDirectory()).sort();
const named = new Map(); // module -> topics naming it
let topics = 0;
let topicBytes = 0;
const biggest = [];
for (const d of domains) {
  const dir = join(ATLAS, d);
  const readme = join(dir, 'README.md');
  if (!index.includes(`(${d}/README.md)`)) fail(`domain ${d} is not listed in docs/atlas/INDEX.md`);
  if (!existsSync(readme)) { fail(`docs/atlas/${d}/README.md is missing`); continue; }
  if (size(readme) > LIMIT.readme) fail(`docs/atlas/${d}/README.md is ${kb(size(readme))}, over its ${kb(LIMIT.readme)} budget`);
  checkLinks(readme);
  const listed = read(readme);
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.md') && x !== 'README.md').sort()) {
    const file = join(dir, f);
    const rel = `docs/atlas/${d}/${f}`;
    topics++;
    topicBytes += size(file);
    biggest.push([size(file), rel]);
    if (size(file) > LIMIT.topic) fail(`${rel} is ${kb(size(file))}, over the ${kb(LIMIT.topic)} topic budget: split it and index both halves`);
    if (!listed.includes(`(${f})`)) fail(`${rel} is not listed in docs/atlas/${d}/README.md`);
    if (!index.includes(`(${d}/${f})`)) fail(`${rel} is not listed in docs/atlas/INDEX.md`);
    const h = header(file);
    if (!h) { fail(`${rel} has no header (--- subject, domain, modules, specs, tests, updated ---)`); continue; }
    if (!h.subject) fail(`${rel}: header has no subject`);
    if (h.domain !== d) fail(`${rel}: header says domain ${h.domain}, the file is in ${d}`);
    if (!h.updated) fail(`${rel}: header has no updated line`);
    for (const m of h.modules) {
      if (!existsSync(join(ROOT, m))) fail(`${rel}: modules names ${m}, which is not a file`);
      if (!named.has(m)) named.set(m, []);
      named.get(m).push(rel);
    }
    for (const s of h.specs) if (!existsSync(join(ROOT, s))) fail(`${rel}: specs names ${s}, which is not a file`);
  }
}

// Every module has an owner, in MODULES.md and in a topic's header.
const modulesMd = existsSync(join(ATLAS, 'MODULES.md')) ? read(join(ATLAS, 'MODULES.md')) : '';
const mods = readdirSync(join(ROOT, 'split')).filter((f) => f.endsWith('.js')).sort();
for (const m of mods) {
  const row = new RegExp('`split/' + m.replace(/[.]/g, '\\.') + '` \\| \\[([^\\]]+)\\]').exec(modulesMd);
  if (!row) { fail(`split/${m} has no row in docs/atlas/MODULES.md: give it an owning topic`); continue; }
  const owner = `docs/atlas/${row[1]}.md`;
  if (!existsSync(join(ROOT, owner))) fail(`docs/atlas/MODULES.md: split/${m} is owned by ${row[1]}, which is not a topic`);
  else if (!(named.get(`split/${m}`) || []).includes(owner)) fail(`${owner} owns split/${m} in MODULES.md but does not name it in its header`);
}

// The path rules: every module in exactly one rule's paths, and every topic a rule names exists.
const rulesDir = join(ROOT, '.claude/rules');
const ruled = new Map();
for (const f of existsSync(rulesDir) ? readdirSync(rulesDir).filter((x) => x.endsWith('.md')).sort() : []) {
  const file = join(rulesDir, f);
  const L = read(file).split('\n');
  const end = L[0] === '---' ? L.indexOf('---', 1) : -1;
  if (end < 0) { fail(`.claude/rules/${f} has no paths header`); continue; }
  for (const l of L.slice(1, end)) {
    const m = /^\s+-\s+"([^"]+)"/.exec(l);
    if (!m) continue;
    if (!ruled.has(m[1])) ruled.set(m[1], []);
    ruled.get(m[1]).push(f);
    if (!/[*]/.test(m[1]) && !existsSync(join(ROOT, m[1]))) fail(`.claude/rules/${f}: paths names ${m[1]}, which does not exist`);
  }
  checkTicks(file);
}
for (const m of mods) {
  const r = ruled.get(`split/${m}`) || [];
  if (r.length !== 1) fail(`split/${m} is in ${r.length} path rules (${r.join(', ') || 'none'}): it belongs in exactly one, its owner's domain`);
}

// On a pull request: a module changed, and no topic naming it did.
const baseAt = process.argv.indexOf('--base');
if (baseAt > -1 && process.argv[baseAt + 1]) {
  try {
    const changed = execFileSync('git', ['diff', '--name-only', `${process.argv[baseAt + 1]}...HEAD`], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
    const touched = new Set(changed);
    for (const c of changed.filter((x) => /^split\/[^/]+\.js$/.test(x))) {
      const ts = named.get(c) || [];
      if (ts.length && !ts.some((t) => touched.has(t))) warns.push(`${c} changed; no topic naming it did (${ts.slice(0, 3).join(', ')}). If behaviour a topic describes changed, update it.`);
    }
  } catch (e) {
    warns.push(`could not compare with ${process.argv[baseAt + 1]}: ${String(e.message).split('\n')[0]}`);
  }
}

biggest.sort((a, b) => b[0] - a[0]);
console.log(`atlas: CLAUDE.md ${kb(size(corePath))} of ${kb(LIMIT.core)} · ${domains.length} domains · ${topics} topics, ${kb(topicBytes)} · ${mods.length} modules owned`);
console.log(`largest topics: ${biggest.slice(0, 3).map(([n, p]) => `${p.replace('docs/atlas/', '')} ${kb(n)}`).join(' · ')}`);
for (const w of warns) console.log(`${process.env.GITHUB_ACTIONS ? '::warning::' : 'warning: '}${w}`);
if (fails.length) {
  for (const f of fails) console.error(`FAIL: ${f}`);
  process.exit(1);
}
console.log('atlas: ok');
