---
subject: "Quotations and prospects"
domain: billing
modules: [split/prospects.js, split/quote.js]
specs: []
tests: [P131, P176]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### Quotations
Office → Sales → **Quotations** (Clients → Quotations until the tab map of 9 Oct 2026; `quote.js`; owner, 1 Oct 2026: *"a quotation generator as well … I think we have the template for that
in our Soma internal repo"*). Built to the rules of soma-internal's quotation register (`operations/quotations/README.md`) and in the
layout of its issued quotations; both are read-only references, and nothing of them is in this repo. P131.
- **A draft holds no number.** Its face says DRAFT and its number reads *Draft*: the register's duplicate `001` came from drafts that
  printed one. **Issue** takes `SEP/QTN/<FY>/NNN` (the token from `S.invPrefix`, the year from the quotation's own date, `qtFyOf`), the
  highest taken in that year + 1, voids and superseded counted: a number is never reused. The number is worked out again after
  the questions, on the book as it is then: another window's issue meanwhile moves it, and the toast says so (two windows had
  issued one number). Issue needs a GST rate; rates are kept to four places and printed as typed (₹0.125).
- **An issued quotation is never edited.** *Revise* (a reason, required) copies it as a draft under the same number with Rev N
  (`…/005 Rev 1`); issuing the revision marks the old one `superseded` (`supersededBy`). A price after negotiation is a revision too.
  *Void* (issued, never sent; a reason, required) keeps the number spent, and deletes a revision drafted of it (it would issue on
  the void number), saying so first; a revision of a void is never issued. *Accepted* / *Declined* record the answer. Only a
  draft is deleted.
- **Two live prices for one item let a counterparty anchor at the lower** (the register's rule): issuing while another live quotation
  names the same client or registered name and the same item asks whether to supersede it (`qtRivals`).
- **On acceptance the rate is offered to the client's record, never written unasked** (`qtPostPlan`, `qtPostRates`; the confirm says
  exactly what will be written): a weight-billed or nos_to_weight client gets an `itemRates` row (unit piece or kg), **never a billingMode
  change** (the register's "itemRates, never billingMode"); a piece client a dated `pieceRates` entry; a kg rate for a piece client, or a
  line with no part number, is named *set by hand*. The line is stamped `postedAt` / `postedTo`. **A row is written only where
  it can price the client's lines as they are billed** (`qtPartBilledUnits`: the units of its own invoices and challans for
  the part, else what the basis means for its billing mode), since an override prices a line only in its own unit (The rate
  on record); one that cannot is named *set by hand*. **It goes before every row whose pattern the part contains**
  (`qtItemRatePlace`, in place of one naming the part exactly): the first matching row prices a line, so a row added after
  `TM5181` never priced `TM5181-20`. The confirm names what it goes before, what it still cannot reach and what it newly prices.
- **Terms are generated from the form's options** (`qtTermsFor`): billing basis, transport (excluded, included with the minimum
  consignment, or loading at our works), GST and SAC, defects, the material's condition, liability, payment, rate specific to the items,
  the reference weight (only on a piece line with one), the lot size (only when set), validity. They follow the options until a term is
  edited; *Reset to the standard terms* regenerates.
- **The printed quotation** (`qtDocHtml`, `qtPrint` through the one print view) reads S.company; signatory, title and foot note are
  Settings → Business → Quotations (`S.qtnCfg`), which also shows the next number per year. Its own pt tokens (`.inv-qt-doc`), `@page`
  margin 0, one frame table like the invoice's and the report's (`.inv-qt-frame`: on paper its repeating head and foot rows are the
  12 mm and 10 mm gutters, so a second page starts 12 mm down, not at the edge), the terms' tail and the signature one unbreakable
  box: **one A4 page** for three lines and eleven terms (soma-internal's
  003 first rendered with its signature alone on page 2). A typed recipient carries the reminder that the registered name is checked
  against the recipient's own paper.
- A client's detail lists its quotations; History logs issued, revised, superseded, voided, accepted and declined.
- **Left open:** a per-kg quotation for "all components" (no part number) is not posted to the ₹/kg ladder; it says to set it by hand.

### Prospects
Office → Sales → **Prospects** (Clients' fifth view until the tab map of 9 Oct 2026; `prospects.js`, P176; owner, 7 Oct 2026: *"start with 3 and 4"*). The plant runs about three quarters full (~24 t
a month spare), and nothing kept who was approached, what they were offered or when to call again.
- **A prospect** (`S.prospects`): the firm, a contact, phone and e-mail, the work (process and parts), tonnes a month as estimated, a
  target ₹/kg, a stage (**new · contacted · sample · quoted · won · lost**), the next follow-up, notes, and a dated log of each stage.
  Lost needs a reason; a name already on the list is refused. In the change log.
- **The list** is Sales' first view: search, a stage `<select>` (Open by default), **Add prospect** the one primary; the follow-ups due
  first, most late first. Four tiles: open (and how many due), the **pipeline** (tonnes a month weighted by a chance per stage: new 10%,
  contacted 20%, sample 40%, quoted 60%, said on the screen as a working assumption, beside the tonnes if all came), the **spare** (the
  last 90 days' invoiced tonnes against ~2 t a shift, two shifts, Stats' capacity), and what share of the spare the pipeline fills.
- **Its quotations are the Quotations' own**: *Draft quotation* opens one addressed to the prospect at its target rate per kg
  (`qtOpenDraft` with `to` and `prospectId`); one issued makes the prospect read *quoted* (`prsStage`) until it is moved on.
- **Won makes the client**: the client form opens filled from the prospect; saving it links the two (`clientId`, `prsClientAdded`) and
  gives its quotations the client, so accepting one can post its rates.
- **To-do `prospectFollow`**: a follow-up due amber, a week late red. **Home → Is the plant full?** (a question widget) names the pipeline against the
  spare with what it would bill a month, weighted (`prsPlantMove`). Search finds the screen.
