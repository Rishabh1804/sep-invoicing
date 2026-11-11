---
subject: "Zinc pricing"
domain: billing
modules: [split/zinc.js]
specs: []
tests: [P99]
updated: 2026-11-11 (moved verbatim from CLAUDE.md)
---

### Zinc pricing
metals.dev publishes no MCX base metal — its MCX coverage is precious metals only, and
`zinc` / `lme_zinc` are the same LME figure. LME sits below MCX by basic customs duty plus
freight and local premium: ~10.5% when calibrated (LME ₹355.11 against MCX ~₹392).

So a fetched rate is LME and MCX is **derived** from it by a recalibratable uplift, with the
whole chain shown on the card. A rate typed into Settings is taken as MCX itself and is never
uplifted. Nothing is labelled MCX without saying it was estimated — at ~425 kg/month a 10%
error in zinc is ₹0.22/kg of an ₹8.55 cost.

**The uplift is measured from the shop's own zinc bills** (owner, 25 Sep 2026: *"I just change the LME - MCX
uplift % — if that can be derived using data from the internet then that's even better"*, set at 14%). No free
service publishes MCX zinc (searched: metals.dev, MetalpriceAPI, Metals-API, commodities-API all carry LME
only), but a zinc bill is priced at MCX + the supplier premium, so **price before GST − premium is the MCX the
shop actually paid** — a better figure than a market quote, because it is the one the cost is made of.
Settings → Costing → Zinc rate → **Derive from zinc bills** sets the last six priced bills against LME on
each bill's date (the last rate on or up to four days before, since LME does not trade at weekends), shows every
row's arithmetic, and **offers** the median: it fills the field and marks the section unsaved, never applies it.
LME for a past date comes from `S.zinc.lmeHistory` (every Refresh is kept by day, INR/kg) and, where that is
empty, from metals.dev's `timeseries` with the same key — converted from whatever currency and unit it answers
in, and kept, so asking twice costs no request.

**The market against what each bill paid** (owner, 29 Sep 2026: *"we have the data to show the Zinc rate calculated per
refresh too - that way we can see how much variation we are paying when buying and from which supplier … This can show us
opportunities or risk of buying the particular stock at a particular time"*). Stock → Spend and prices → Price trend, on Zinc
(`zincTrend`, zinc.js; `dashZincHtml`, dash.js). The **market** is every day `S.zinc.lmeHistory` holds, landed as a bill is
priced: LME × (1 + uplift) + premium, **at the uplift and premium set now**, since neither is kept per day (the chart says
so). Each bill is set against the market on its day (the last LME up to four days before, the derivation's rule); **over**
is price − market, per kg before GST, and a supplier's over is **weighted by kilos**, so a 25 kg top-up does not count
like a tonne. **Timing** places the market on the bill's day within the 30 days before it (≥ 5 market days): near the
low, the middle or the high. The panel: range chips, four tiles (market now, last bill, paid over market, the range's
low–high), the market dashed beside each supplier's bills on a **time axis** (`opts.xs`; spaced by count, a bill from
August sat beside one from September) with a frame round the prices (`opts.fit`), the market now against the last bill,
and suppliers as rows (*Lowest* / *Highest* over the market) that open their bills. A bill with no LME for its day is
counted, and **Look up LME** asks metals.dev with the derivation's own lookup (`_zincFetchMissing`, shared), keeping the
answer. Other stock lines keep their plain price line: no market feed exists for chemicals. P99.
