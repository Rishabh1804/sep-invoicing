---
subject: "The owner's rulings of 13 Oct 2026"
domain: core
modules: []
specs: []
tests: [P56, P210]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### The owner's rulings of 13 Oct 2026
Ten open items were put to the owner with choices, and answered: *"1. B / 2. A / 3. We gotta remove scan and gemini image reading
options actually, it simply never works, so it's better we take that off, it's waste. And, give me a visual comparison of this
change. / 4. B / 5. C. This issue should be resolved once we have separate apps for everyone on the floor / 6. Fixed / 7. I'll
update those CN in time, make sure the app has space where I can do that / 8. A / 9. B, read off a bill - will update those figures
where available / 10. We shall discuss this."* P210.
1. **Challans waiting to be invoiced are amber at 3 days and red at 6** (were 5 and 10): the To-do's challan task, the challan's own
   dot and Pipeline's first stage, all from `challanDays` (Settings → Checks & alerts → To-do). A book still on 5 moves to 3 once
   (`_challanDays3`, which travels with the book); any other figure set stays.
2. **Heads against the day's number keep their tones**: a short area amber, one with extra hands info.
3. **The challan Scan and every photo read by Gemini came out** (read by Claude since 3 Nov 2026, owner: *Photos read by Claude*, below). `vision.js` and `scanner.js` are deleted. Challans offers Add
   challan (Invoiced's More: Add challan, Duplicate check); Add has no Photo (a photo picked under File is named as one and not
   read); Production, Floor → Overview's line cards and Today's production step offer **Enter by hand** on that line and day; the
   monthly register's doors are Import and Start this month; Settings → Connections is the zinc rate key and GitHub sync. Each
   device forgets the Gemini key, the model it answered on and the last read kept as a draft at its next start (`forgetGeminiKey`:
   `sep_inv_gemini_key`, `sep_inv_gemini_model`, `sep_inv_prod_photo_draft`). What photos read before stays in the book and
   counts as before; the register's reader in code (`prodFromRegisterRead`) reads a page typed on Mine and a file. The ID card
   scanner reads a QR with the camera and no Gemini, and stays. The owner's comparison is an artifact: eight places, before and
   after, phone and desktop, on the sweep book.
4. **The three cards that lengthened their screens fold shut on the phone** (Challans → Invoiced, Knowledge → Training and
   Troubleshoot): `uiVerdictHtml({foldFacts})` puts a card of facts alone under its line, shut on the phone and open on the
   desktop.
5. **The barrel list against the roll's OT blocks stays unknown**: on a day with the list the blocks are shown beside it, never
   added. The faces (Mine) are the owner's route to settling it.
6. **Contract labour is fixed.** Stats' contribution counts all of labour as fixed (`statsClientMargins`: the variable cost is the
   live cost less the labour row, known with nothing recorded), so the worst large account is settled one way (*Contributes* or
   *Below its variable cost*, *Against the full cost*, *Pays its share at*; the badge *labour fixed*), the *Settle the labour
   question* moves are gone (Pulse's *Who is driving it?*, and the insight's, which now opens the month's contribution in its
   report), and the insight below the variable cost, the report and the Pulse's *more work* and *new quotation* worths read the
   same cost. Overtime is counted fixed with the rest, as in the ₹0.53/kg the ruling was asked on. The labour card keeps its
   split of the monthly crew from the pool (what the pay is made of); the power case keeps the monthly crew's split
   (`statsCostSplit`, `powerMargin`), since it adds the wages a cut leaves idle on top and would count them twice otherwise.
7. **Past credit notes are the owner's to record** (CN/004 and CN/005 on paper, and CN/001 or an April–May rebate as the owner
   rules): Office → Invoices → Credit notes (under More) → **Record issued** takes a note with its own number and year, its date, the
   invoice it names (picked, or typed as printed), the GST as printed and, for a rebate, its discount and period (P56); a rebate
   owed for a period not yet noted is raised from a Register selection. The guide (*Using the app: credit notes* v3) says where.
8. **A paid holiday worked is paid as a worked Sunday**: the holiday's credit and one day on top, as built.
9. **The power cut's restart is the figure set in the app** (Power → Case → the options' figures; the owner, 26 Oct 2026:
   *"the restart cost is set in the app … and remains so till I edit it in the app. The power case should be calculated using
   the figures from the app and not the repo"*; it had read *stays the ₹600 estimate until a quote*), and the ~₹5,000 a month since the load went to 50 kVA was
   read off a bill; the owner will enter the figures where available (Power → Load & bills, a bill's penalty and details).
10. **The next build's order is to be discussed** with the owner.
