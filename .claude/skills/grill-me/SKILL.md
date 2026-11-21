---
name: grill-me
description: Interview the owner relentlessly about a plan or design for the app until every branch of its decision tree is resolved, one multiple-choice question at a time, then record the decisions. Use when he says "grill me", "let's do a grill me session", asks to stress-test a plan or a design, or to be interviewed about one.
---

# Grill me

Interview the owner about the plan in front of you until you both hold the same picture of it. Walk the design tree one branch
at a time, settling each decision before the ones that depend on it.

## Asking

- **Every question goes through `AskUserQuestion`.** Never ask in plain text in your reply.
- **One question at a time.** Wait for the answer before the next.
- **Two to four concrete options**, each a direction he might really take, with a short description of what it would mean in the
  app. A plain yes/no only when the question is truly binary. "Other" is always there for him.
- **When you have a recommendation, put it first and mark it "(Recommended)"**, with the reason in its description.
- **Make each question stand on its own.** He may see only the dialog: name the screen, the data or the constraint you found, in
  the question itself.
- **Say what a choice costs** where it costs something: a dependency, a device that must stay on, a new place private data would
  sit, a habit asked of the floor.

## Before you ask

- **If the code or the atlas can answer it, look it up instead of asking.** Follow the route (`CLAUDE.md` → `docs/atlas/INDEX.md`
  → the domain's `README.md` → the topic → the code, spec and tests it names). For a screen: the tab map
  (`docs/atlas/design/tab-map-*.md`) and the screen's own topic.
- **Ground the options in what exists**: the stores on `S`, the screens, the guard's roles and who sees money and wages, how
  fresh the data is. Don't offer what the app cannot do without saying so.
- **The hard rules bind the options**: the design principles (`docs/SEP_INVOICING_DESIGN_PRINCIPLES.md`), the screen budgets
  P195 holds, the guard, *no second arithmetic*.

## Answers

- **Read each answer for what it says.** He often answers with more than an option ("all of the above", "option 1 and 2", a
  sentence of his own). Take all of it, and let it open the branches it opens.
- **After each answer**: acknowledge the decision in a sentence or two, then ask the next question at once.
- **Don't re-ask a settled branch** or argue a decision he has made. Where an answer creates a real conflict (a cost, a security
  hole, a constraint you found), say so plainly once, in the next question's options.
- **Each answer is his word.** Move the unattended-close check after every one (`CLAUDE.md`, *The unattended close*).

## Finishing

- **Keep going until every branch is resolved**, then ask whether to continue to the next subject or stop and record.
- **Record it**:
  - **With the codex attached**: in the codex, as its own copy of this skill says (the day's `decisions/` file with his words
    quoted, a task file for each piece of work).
  - **Without it**: in this repo, the decisions in the topic of the subject (a new topic with its index row if there is none) and
    the next steps in `docs/NEXT_SESSION.md`.
- **This repository is public (HR-10).** A grill here may name screens, stores and features; it never records a client's name,
  a part, a rate, a quantity or anything about the shop. Where an answer carries one, it goes to the codex, or it is said as
  *a client*.
- **Close with a short summary in chat**: the decisions, the work opened, and its order.
