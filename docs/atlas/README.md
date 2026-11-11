# The atlas: how agents find, record and improve what this repo knows

Until 11 Nov 2026 `CLAUDE.md` held everything: 620 KB, loaded whole into every session and every subagent. It now holds
only the rules that bind every change. The rest is here, in four levels, read when the work needs it.

## The levels

| Level | File | Loaded | Budget |
|---|---|---|---:|
| L0 | `CLAUDE.md` | always | 16 KB |
| L1 | `docs/atlas/INDEX.md` (with `MODULES.md`, `HEADINGS.md`) | on a lookup | — |
| L2 | `docs/atlas/<domain>/README.md` | on a lookup | 6 KB |
| L3 | `docs/atlas/<domain>/<topic>.md` | when the subject is worked on | 28 KB |

Below L3 are the things a topic names: the modules (`split/*.js`), the spec (`docs/*.md`), the tests (`tests/e2e/`).

`.claude/rules/atlas-<domain>.md` are path rules. When a module is opened, the rule for its domain loads and names the
topic to read first.

## A topic file

```yaml
---
subject: "Pay"
domain: people
modules: [split/payroll.js, split/payslip.js]   # the modules it owns, then others it holds rules for
specs: [docs/…]                                  # where one exists
tests: [P205, P207, P260, P262]
updated: 2026-11-09 (#185)
---
```

The body is the record: what was built, the owner's words that ruled it, the reasons, the measurements, what is open.
A topic owns a module when it is the first place to send someone editing it; `MODULES.md` lists every module's owner.
A module with rules in several topics is named in each one's header, and its path rule lists them all, the owner first.

## The protocol

Every agent follows it, builder or reviewer, in a main session or as a subagent.

### 1. Look up by the route
`CLAUDE.md` → `INDEX.md` → the domain's README → the topic → the code, spec and tests it names.
- Starting from a module: `MODULES.md`, or the path rule that loaded with it.
- Starting from an old citation (*CLAUDE.md § Credit notes*): `HEADINGS.md`.
- A repo-wide search is for what the atlas does not cover, and its result is recorded (below).

### 2. Record the path
The atlas is the recorded path. Two rules keep it true.
- **A miss is fixed in the same PR.** If answering needed a search the atlas should have routed, add the pointer before
  the PR leaves draft: a `see also` line in the topic, a module in its header, a row in an index.
- **A change updates its topic.** A PR that changes behaviour a topic describes edits the topic and its `updated` line
  (the date and the PR). A new subject is a new topic file, listed in its domain's README and in `INDEX.md`. A module
  added to `split/` is given an owner in a topic's header and a row in `MODULES.md`.

Nothing new is written into `CLAUDE.md` unless it binds every change in the repo, and then one line, with the detail in
a topic.

### 3. Iterate
- **Over budget, split.** A topic over 28 KB is cut by sub-subject into two topics, both indexed. A README over 6 KB
  means the domain wants a sub-domain.
- **Re-file what is misfiled.** The first cut (11 Nov 2026) moved `CLAUDE.md`'s sections word for word, in the order they
  had grown. Where a topic bundles two subjects, split it when you next work in it.
- **Stale is a defect.** A topic that contradicts the code is fixed where it is found, in that PR.
- **Sessions.** `docs/NEXT_SESSION.md` holds the latest close. The data flows are in `docs/DATA_FLOWS.md`. At a close, the
  new entry replaces the old, which moves to `docs/sessions/<YYYY-MM>.md`.

## The checker

`node tools/atlas-check.mjs` runs in CI's build job. It fails on:
- `CLAUDE.md` over 16 KB, or carrying an `@` import line;
- a topic with no header, over 28 KB, or missing from its domain's README; a domain missing from `INDEX.md`;
- a link in an index that does not resolve; a `modules:` entry that is not a file;
- a `split/*.js` module that no topic owns in `MODULES.md`, or that is not in exactly one path rule;
- a path in backticks in `CLAUDE.md`, `docs/NEXT_SESSION.md`, this file or a path rule that does not exist.

It prints each level's size on every run, so growth is seen. On a pull request it warns, without failing, when a module
changed and no topic naming it did.

## HR-10 holds here

The atlas is public, as the repo is. A topic says *a client*, never a client's name, and every example is made up. The
passages moved from `CLAUDE.md` were already public; passages that name clients beside their figures are the owner's to
keep or to move to the private codex.
