---
subject: "UI pass 3: sign-in and the 4-digit PIN (U8)"
domain: design
modules: []
specs: [docs/UI_PASS_3.md]
tests: [P140, P152, P234]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### UI pass 3: sign-in (U8)
`docs/UI_PASS_3.md` §15, §26f, §26m (owner, 16 Oct 2026: *"B with wells, 4-digit PIN"*). P234 (phone and desktop); P140, P152 and the
fixture's `unlock` rewritten to the same facts (four digits where a spec sets a PIN, the new words, Not you?, Later), never weakened.
- **A PIN is four digits** (`grdPinProblem`, `GRD_PIN_LEN`): not one digit four times, not a run up or down, not 1212, 1004, 2000, 2580
  or 6969, both entries alike. `grdMakeSecret` stores `len: 4` on a PIN of four digits (`grdIsFour`). **A PIN from before** (any other)
  is typed in a field that says so; once right, the lock asks for four digits twice (**Set a 4-digit PIN**), its save after the sign-in
  so the change log names the person; **Later** signs in on the old one and asks again next time. The fixtures' PINs stay eight digits
  (a short PIN turns up inside a hash by chance), so `unlock` taps Later (`laterIfAsked`); a spec setting a PIN uses four digits, and
  looks for one in the book as a value of its own (`"4829"`), never as a substring.
- **The wells** (`grdWellsHtml`, design §6.40): one input four digits long over four wells, a dot a digit; on the phone `inputmode="none"`
  and **the keypad** (`grdKeypadHtml`: 1–9, the lock's *Forgot your PIN?*, 0, ⌫; `invGuardKey`) writes into the group last used and runs
  on to the next; on the desktop typed. On the lock, the PIN asked again and Settings' PIN forms. **Sign in is enabled at four digits**
  on the lock (`grdGoSet`) and never sent at the fourth. A wrong PIN turns the wells red and shakes them (a colour alone under reduced
  motion): *Wrong PIN · 4 tries left*, the counts and lockout as before.
- **The phone**: the theme in the corner, the mark in its tile, the company as the eyebrow, *Welcome back*, the person remembered in a
  well with **Not you?** (the IDs as a sheet inside the lock, `data-grd-sheet`: a dialog over the lock would be inert), the wells, the
  keypad, Sign in, the foot (this phone registered, synced). **The desktop**: a panel (the company and its address, the clock and the
  date, the weather where the device holds a copy, Tata's plant this week, the book's last sync) beside the card (Pick your ID, the IDs
  as rows with when each was last in, the wells, Sign in, *Forgot your PIN?* with its hint). **No figure of the book is drawn before
  sign-in**; the print station's light is not. When each ID was last in is the device's (`sep_inv_guard_seen`). The layout switch draws
  the lock again.
- **The icons** (`tools/make-icons.mjs`, run by hand when the mark or an accent changes): the mark drawn in each palette's light accent
  in Playwright's Chromium: `icons/icon-<palette>.svg`, `-192.png`, `-512.png`; at the root `icon-192.png`, `icon-512.png` (Zinc & brass),
  `icon-512-maskable.png`, `favicon.svg`, `favicon-32.png`; the manifest's `background_color` `#e1e6eb`; the service worker `sep-inv-v32`.
- **SERVER.md §4**: the sealing key is never wrapped by a PIN (the recovery code on the hub, a device key on each owner device).
- The guide *Setting up: IDs, PINs and roles* is version 2. **A data flow**: `len: 4` on a user's secret, with the users.
