/* ===== INIT ===== */

/* ===== BOOTSTRAP SEEDS AND CLEANUPS =====
   One-time writes of business records, keyed on flags the state carries.
   Bootstrap-only by design (see CLAUDE.md, Persistence): a pull or an import
   never re-fires them. Runs from bootApp() once S exists. */
function runBootstrapSeeds() {
/* Phase 4: Seed NOS qty on Dorabji + Highco IM items (one-time migration) */
if (S.incomingMaterial && S.incomingMaterial.length > 0 && !S._nosQtySeeded) {
  var nosMap = {"IMI-0001-0":198,"IMI-0001-1":172,"IMI-0002-0":395,"IMI-0002-1":30,"IMI-0002-2":100,"IMI-0003-0":196,"IMI-0004-0":475,"IMI-0004-1":200,"IMI-0005-0":444,"IMI-0005-1":100,"IMI-0005-2":100,"IMI-0006-0":215,"IMI-0007-0":290,"IMI-0008-0":388,"IMI-0008-1":76,"IMI-0008-2":100,"IMI-0009-0":1464,"IMI-0010-0":294,"IMI-0010-1":200,"IMI-0011-0":178,"IMI-0012-0":200,"IMI-0013-0":100,"IMI-0014-0":280,"IMI-0014-1":150,"IMI-0015-0":602,"IMI-0015-1":50,"IMI-0016-0":246,"IMI-0016-1":510,"IMI-0016-2":108,"IMI-0017-0":270,"IMI-0018-0":157,"IMI-0019-0":70,"IMI-0019-1":148,"IMI-0050-0":80};
  S.incomingMaterial.forEach(function(im) {
    im.items.forEach(function(it) {
      if (nosMap[it.id] != null) it.nosQty = nosMap[it.id];
    });
  });
  S._nosQtySeeded = true;
  saveJSON(STORAGE_KEY, S);
}

/* Phase 4: Seed 7 scanned challans from Apr 8-9 delivery challan photos */
if (!S._scanSeed1) {
  var scanned = [
    {"id":"IM-SC-036","challanNo":"36","challanDate":"2026-04-08","clientId":1,"clientName":"DORABJI AUTO","vehicleNo":"JH 05BZ 9693","items":[{"id":"IM-SC-036-0","partNumber":"5069 4370 0108","desc":"Bracket 5069 4370 0108 (Kanghi)","hsn":"998873","unit":"KG","qty":60.4,"rate":13,"amount":785.2,"nosQty":592,"invoiced":false,"invoiceId":null},{"id":"IM-SC-036-1","partNumber":"5079 5470 0101","desc":"Bracket 5079 5470 0101 (Chidiya)","hsn":"998873","unit":"KG","qty":64.1,"rate":13,"amount":833.3,"nosQty":504,"invoiced":false,"invoiceId":null},{"id":"IM-SC-036-2","partNumber":"5181 4370 0105","desc":"Bracket 5181 4370 0105","hsn":"998873","unit":"KG","qty":46.4,"rate":13,"amount":603.2,"nosQty":197,"invoiced":false,"invoiceId":null}],"receivedDate":"2026-04-08","notes":"","createdAt":1775721660000},
    {"id":"IM-SC-037","challanNo":"37","challanDate":"2026-04-08","clientId":1,"clientName":"DORABJI AUTO","vehicleNo":"JH 05BZ 9693","items":[{"id":"IM-SC-037-0","partNumber":"2525 2015 8202","desc":"Bracket 2525 2015 8202","hsn":"998873","unit":"KG","qty":1.7,"rate":13,"amount":22.1,"nosQty":8,"invoiced":false,"invoiceId":null},{"id":"IM-SC-037-1","partNumber":"5737 0117 3304","desc":"Bracket 5737 0117 3304","hsn":"998873","unit":"KG","qty":57.1,"rate":13,"amount":742.3,"nosQty":1019,"invoiced":false,"invoiceId":null},{"id":"IM-SC-037-2","partNumber":"5567 5450 0103","desc":"Bracket 5567 5450 0103","hsn":"998873","unit":"KG","qty":10.2,"rate":13,"amount":132.6,"nosQty":17,"invoiced":false,"invoiceId":null}],"receivedDate":"2026-04-08","notes":"","createdAt":1775721661000},
    {"id":"IM-SC-038","challanNo":"38","challanDate":"2026-04-08","clientId":1,"clientName":"DORABJI AUTO","vehicleNo":"JH 05DN 6730","items":[{"id":"IM-SC-038-0","partNumber":"2715 2671 0140","desc":"Bracket 2715 2671 0140 (New Material)","hsn":"998873","unit":"KG","qty":105.5,"rate":13,"amount":1371.5,"nosQty":300,"invoiced":false,"invoiceId":null}],"receivedDate":"2026-04-08","notes":"","createdAt":1775721662000},
    {"id":"IM-SC-039","challanNo":"39","challanDate":"2026-04-08","clientId":1,"clientName":"DORABJI AUTO","vehicleNo":"JH 05DL 3376","items":[{"id":"IM-SC-039-0","partNumber":"5181 4370 0105","desc":"Bracket 5181 4370 0105","hsn":"998873","unit":"KG","qty":23.2,"rate":13,"amount":301.6,"nosQty":98,"invoiced":false,"invoiceId":null}],"receivedDate":"2026-04-08","notes":"","createdAt":1775721663000},
    {"id":"IM-SC-041","challanNo":"41","challanDate":"2026-04-09","clientId":1,"clientName":"DORABJI AUTO","vehicleNo":"JH 05DL 4176","items":[{"id":"IM-SC-041-0","partNumber":"5152 4370 3301","desc":"Twist Bracket 5152 4370 3301","hsn":"998873","unit":"KG","qty":23.8,"rate":13,"amount":309.4,"nosQty":100,"invoiced":false,"invoiceId":null}],"receivedDate":"2026-04-09","notes":"","createdAt":1775721664000},
    {"id":"IM-SC-M41","challanNo":"41","challanDate":"2026-04-08","clientId":2,"clientName":"SSSMEHTA ENTERPRISES AND INDUSTRIES PVT LTD","vehicleNo":"JH 05DR 2505","items":[{"id":"IM-SC-M41-0","partNumber":"Clamp 106x81","desc":"Clamp 106x81 (25x6)","hsn":"998873","unit":"NOS","qty":237,"rate":2.24,"amount":530.88,"nosQty":237,"invoiced":false,"invoiceId":null},{"id":"IM-SC-M41-1","partNumber":"Clamp 74x81","desc":"Clamp 74x81 (25x6)","hsn":"998873","unit":"NOS","qty":240,"rate":1.81,"amount":434.4,"nosQty":240,"invoiced":false,"invoiceId":null}],"receivedDate":"2026-04-08","notes":"","createdAt":1775721665000},
    {"id":"IM-SC-M43","challanNo":"43","challanDate":"2026-04-09","clientId":2,"clientName":"SSSMEHTA ENTERPRISES AND INDUSTRIES PVT LTD","vehicleNo":"JH 05DR 2505","items":[{"id":"IM-SC-M43-0","partNumber":"Clamp 133x83","desc":"Clamp 133x83 (40x6)","hsn":"998873","unit":"NOS","qty":358,"rate":4.24,"amount":1517.92,"nosQty":358,"invoiced":false,"invoiceId":null},{"id":"IM-SC-M43-1","partNumber":"Clamp 165x83","desc":"Clamp 165x83 (40x6)","hsn":"998873","unit":"NOS","qty":365,"rate":4.89,"amount":1784.85,"nosQty":365,"invoiced":false,"invoiceId":null},{"id":"IM-SC-M43-2","partNumber":"Clamp 181x83","desc":"Clamp 181x83 (40x6)","hsn":"998873","unit":"NOS","qty":368,"rate":5.06,"amount":1862.08,"nosQty":368,"invoiced":false,"invoiceId":null}],"receivedDate":"2026-04-09","notes":"","createdAt":1775721666000}
  ];
  scanned.forEach(function(ch) { S.incomingMaterial.push(ch); });
  S._scanSeed1 = true;
  saveState();
}

/* Phase 6b: Remove Belrise trading items (rate > 25) — one-time cleanup.

   Bootstrap-only, and DELIBERATELY not a structural migration: it deletes
   catalogue rows. The flag on an imported backup describes the device that
   wrote it, so re-running this against someone else's state would delete rows
   on the strength of a flag that was never about them. See the banner below. */
if (!S._rateCleanup1) {
  var before = S.items.length;
  S.items = S.items.filter(function(it) { return (it.rate || 0) <= 25; });
  var removed = before - S.items.length;
  if (removed > 0) console.log('Rate cleanup: removed ' + removed + ' items with rate > 25 (Belrise trading remnants)');
  S._rateCleanup1 = true;
  saveJSON(STORAGE_KEY, S);
}

}

/* ===== STRUCTURAL MIGRATIONS =====

   Everything below runs at bootstrap AND again whenever the whole state is
   REPLACED — a GitHub pull or a Settings → Import. It used not to, and the
   consequence was silent: a state pulled from a device that had never run the
   area realignment still carried `pickling` and `colour` marks, which
   `areaStats` drops on the floor (`if (!a) return;`). Heads under-counted,
   every shortfall inflated to match, and the Areas card read wrong until the
   next reload happened to migrate it. Nothing said so.

   What is IN here and what is not is the load-bearing distinction. A
   structural migration RE-POINTS or REPAIRS records the state already holds,
   so running it against someone else's backup is exactly as correct as running
   it against your own, and running it twice is a no-op. A SEED writes new
   business records, and a one-time data cleanup DELETES them: neither is safe
   to fire at an imported state, because the incoming flags describe the device
   that wrote the backup and not the records in it. Re-running `_scanSeed1`
   against a pull would push seven challans a second time — into the one app in
   this repo with a whole module devoted to duplicate receipts.

   So the seeds (`_nosQtySeeded`, `_scanSeed1`) and the Belrise rate cleanup
   (`_rateCleanup1`) stay above this line, bootstrap-only, deliberately. */
function migrateState() {

/* Phase 5: Migrate existing invoices to lifecycle states */
(function() {
  var migrated = 0;
  (S.invoices || []).forEach(function(inv) {
    if (!inv.invoiceState) {
      inv.invoiceState = 'created';
      if (!inv.dispatchedAt) inv.dispatchedAt = null;
      if (!inv.deliveredAt) inv.deliveredAt = null;
      if (!inv.filedAt) inv.filedAt = null;
      migrated++;
    }
  });
  if (migrated > 0) saveJSON(STORAGE_KEY, S);
})();

/* Phase 5: Seed recentVehicles on clients from IM challan data */
(function() {
  var seeded = false;
  (S.incomingMaterial || []).forEach(function(im) {
    if (!im.vehicleNo || !im.vehicleNo.trim()) return;
    var v = im.vehicleNo.trim().toUpperCase();
    var client = S.clients.find(function(c) { return c.id === im.clientId; });
    if (!client) return;
    if (!client.recentVehicles) { client.recentVehicles = []; seeded = true; }
    if (client.recentVehicles.indexOf(v) < 0) {
      client.recentVehicles.push(v);
      seeded = true;
    }
  });
  if (seeded) saveJSON(STORAGE_KEY, S);
})();

/* Phase 5: Orphan detection — reset IM items pointing to deleted invoices */
(function() {
  var invoiceIds = {};
  (S.invoices || []).forEach(function(inv) { invoiceIds[inv.id] = true; });
  var repaired = 0;
  (S.incomingMaterial || []).forEach(function(im) {
    im.items.forEach(function(it) {
      if (it.invoiced && (!it.invoiceId || !invoiceIds[it.invoiceId])) {
        it.invoiced = false;
        it.invoiceId = null;
        repaired++;
      }
    });
  });
  if (repaired > 0) {
    saveJSON(STORAGE_KEY, S);
    console.log('Orphan repair: reset ' + repaired + ' IM item(s) pointing to deleted invoices');
  }
})();

/* Lift a bare gauge out of the description into its own field. Idempotent.

   166 catalogue rows used `desc` to hold nothing but a steel strip size —
   "40X6", "25X6" — which is a specification, not a description. It is also
   the only thing distinguishing several clamp rows that share a part number,
   so it needs to be a field the app can see rather than free text.

   The rule is deliberately narrow: exactly two dimensions, and the text must
   not simply repeat the part number (part "82X81" describes itself and is not
   a gauge). Three-dimension values like "150X68X3" are sizes, not gauges, and
   are left alone. */
(function() {
  var GAUGE_RE = /^\s*\d+\s*[Xx]\s*\d+\s*$/;
  var moved = 0;
  (S.items || []).forEach(function(it) {
    if (it.gauge) return;
    var d = String(it.desc || '').trim();
    if (!GAUGE_RE.test(d)) return;
    if (d.toLowerCase() === String(it.partNumber || '').trim().toLowerCase()) return;
    it.gauge = d.toUpperCase();
    it.desc = '';
    moved++;
  });
  if (moved > 0) {
    saveJSON(STORAGE_KEY, S);
    console.log('Items Master: moved ' + moved + ' gauge value(s) out of the description field');
  }
})();

/* Repair duplicate item ids. Idempotent.

   The seed shipped id 4586 on two different rows (CLAMP 45X86(BOX) and
   BOX CLAMP 45X86). Every lookup — openItemEdit, _renderItemDetail,
   selectPartForLine — resolves by id through .find(), so the second row was
   unreachable and picking it in autocomplete silently selected the first. */
(function() {
  var seen = {};
  var maxId = (S.items || []).reduce(function(mx, it) { return Math.max(mx, it.id || 0); }, 0);
  var repaired = 0;
  (S.items || []).forEach(function(it) {
    if (it.id == null || seen[it.id]) {
      it.id = ++maxId;
      repaired++;
    }
    seen[it.id] = true;
  });
  if (repaired > 0) {
    saveJSON(STORAGE_KEY, S);
    console.log('Items Master: reassigned ' + repaired + ' duplicate item id(s)');
  }
})();

/* Collapse redundant Items Master rows. Idempotent — no version flag needed.

   A row is redundant ONLY when another row matches it on partNumber, gauge,
   unit, rate AND stdWeightKg, and at most one distinct informative
   description exists in the group ("informative" = non-empty and not just a
   copy of the part number). The discarded row then carries no information the
   kept row lacks, so this cannot lose data.

   Deliberately conservative: rows sharing a part number but differing in
   gauge, rate or unit are LEFT ALONE. CLAMP 133X83 (NT) exists as 35X6 at
   3.67 and 40X6 at 4.24. Nothing prices off these rows — invoice and challan
   lines both resolve rate through getLineItemRate() against the client ladder
   — so merging them would misprice nothing today, but it would erase the only
   record of which gauge costs what. Use the Merge tool for judgement calls. */
(function() {
  var items = S.items || [];
  var groups = {};
  var order = [];

  function keyOf(it) {
    return [
      String(it.partNumber || '').trim().toLowerCase(),
      String(it.gauge || '').trim().toUpperCase(),
      it.unit || '',
      it.rate == null ? 0 : it.rate,
      it.stdWeightKg == null ? '' : it.stdWeightKg
    ].join('\u0000');
  }

  function informative(it) {
    var d = String(it.desc || '').trim();
    return d !== '' && d.toLowerCase() !== String(it.partNumber || '').trim().toLowerCase();
  }

  items.forEach(function(it) {
    var k = keyOf(it);
    if (!groups[k]) { groups[k] = []; order.push(k); }
    groups[k].push(it);
  });

  var kept = [];
  order.forEach(function(k) {
    var group = groups[k];
    if (group.length < 2) { kept.push(group[0]); return; }
    var descs = {};
    group.forEach(function(it) {
      if (informative(it)) descs[String(it.desc).trim().toLowerCase()] = true;
    });
    // Conflicting real descriptions — not safely mergeable, keep every row.
    if (Object.keys(descs).length > 1) { kept.push.apply(kept, group); return; }
    var winner = null;
    for (var i = 0; i < group.length; i++) {
      if (informative(group[i])) { winner = group[i]; break; }
    }
    kept.push(winner || group[0]);
  });

  if (kept.length !== items.length) {
    var removed = items.length - kept.length;
    S.items = kept;
    saveJSON(STORAGE_KEY, S);
    console.log('Items Master: collapsed ' + removed + ' redundant row' + (removed !== 1 ? 's' : ''));
  }
})();

/* Comp classes rebuilt against the two pay mechanics the shop actually runs.

   The first cut of the Staff tab shipped `permanent` (a flat monthly, accrued
   by calendar day) and `contract` (days at a day rate, OT at a multiplier).
   Neither matched a payout slip: the salaried tier is paid ₹/day × days with
   its rest days gated on attendance, and the weekly pool is paid a flat rate
   for every hour with no day boundary and no multiplier at all.

   `permanent` becomes `monthly`, and where such a worker carried only a flat
   salary it is divided by 30 to recover the day rate the slips are written in.
   That is an approximation and it is the only lossy step here — but the tier
   was never *paid* off a flat monthly, so the flat figure was the approximation
   in the first place. `contract` becomes `daily`, which is the same arithmetic
   under a name that no longer claims to describe this shop's contract pool.

   Idempotent, and a no-op on the overwhelmingly likely case: the roster ships
   empty, so most devices have nothing to migrate. */
if (!S._staffComp1) {
  var _sc = 0;
  (S.staff || []).forEach(function(w) {
    if (w.comp === 'permanent') {
      w.comp = 'monthly';
      if (!(w.dayRate > 0) && w.monthly > 0) w.dayRate = gstRound(w.monthly / 30);
      _sc++;
    } else if (w.comp === 'contract') {
      w.comp = 'daily';
      _sc++;
    }
    delete w.monthly;
  });
  S._staffComp1 = true;
  saveJSON(STORAGE_KEY, S);
  if (_sc > 0) console.log('Staff: migrated ' + _sc + ' worker' + (_sc === 1 ? '' : 's') + ' to the tiered comp model');
}

/* Area ids realigned to the shop's own staffing units.

   The first cut had one flat `pickling` and a `colour` area. Neither survives
   contact with the norms the floor is actually run to: pickling is two
   sub-areas with separate complements (barrel-side 2, VAT-side 3) that the
   daily relay already divides, and colour is the dedicated passivation HAND
   inside VAT A1's complement of four rather than a place with its own crew.
   The step itself is not A1's — A2 passivates its own work and so does the
   barrel route — which is why the marks re-point to A1 but the claim behind
   them is about the post, not the process.

   Marks, home areas, extra-hour bookings and complements all carry an area id,
   so all four are re-pointed here. Idempotent via the flag; the aliases are
   read from staff.js so there is one table, not two. */
if (!S._staffAreas2) {
  var _ar = 0;
  var _alias = function(id) { return STAFF_AREA_ALIASES[id] || null; };

  (S.staff || []).forEach(function(w) {
    var to = _alias(w.area);
    if (to) { w.area = to; _ar++; }
  });
  Object.keys(S.attendance || {}).forEach(function(iso) {
    var rec = S.attendance[iso];
    if (!rec) return;
    Object.keys(rec.marks || {}).forEach(function(id) {
      var to = _alias(rec.marks[id].area);
      if (to) { rec.marks[id].area = to; _ar++; }
    });
    (rec.extra || []).forEach(function(x) {
      var to = _alias(x.area);
      if (to) { x.area = to; _ar++; }
    });
  });
  if (S.areaTargets) {
    Object.keys(S.areaTargets).forEach(function(id) {
      var to = _alias(id);
      if (!to) return;
      // A complement already set on the destination wins: it was set against
      // the new structure and is the more considered number.
      if (!(S.areaTargets[to] > 0)) S.areaTargets[to] = S.areaTargets[id];
      delete S.areaTargets[id];
      _ar++;
    });
  }

  S._staffAreas2 = true;
  saveJSON(STORAGE_KEY, S);
  if (_ar > 0) {
    // Both aliases are ambiguous and both are disclosed. `pickling` cannot be
    // told apart from the barrel side after the fact; and while `colour` sits
    // inside VAT A1 on every recent grid, the May 2026 relay carried a colour
    // hand inside VAT A2 and a standalone colour row on four days, so a mark
    // from that era can land on the wrong line too. Naming one and not the
    // other would make the quieter case look settled.
    console.log('Areas: re-pointed ' + _ar + ' reference' + (_ar === 1 ? '' : 's') +
      ' — check by hand any that meant Barrel pickling rather than Pickling A1+A2, ' +
      'and any colour mark from before Jun 2026, which may have belonged to VAT A2');
  }
}

/* Phase 9: Default cost per KG for margin dashboard (IL-4) — idempotent */
if (S.defaultCostPerKg === undefined) {
  S.defaultCostPerKg = 8.55;
  saveJSON(STORAGE_KEY, S);
}

/* Derive standard weights from piece pricing — one-time, idempotent.

   Stats measures this business in rupees per kilogram, and a line whose part
   has no weight cannot be counted at all. On live data 90 of 168 catalogue rows
   had no weight, and the gap was not random: it was almost entirely the
   piece-billed work, which is the low-realisation end of the book. So tonnage
   covered 61% of revenue and realisation was computed over the well-priced
   remainder — the one account the figures existed to examine was the one they
   could not see. Leaving that behind a button nobody had pressed made the
   dashboard quietly wrong rather than visibly incomplete.

   Where a client bills per piece off a rate per kg, weight = pieceRate /
   ratePerKg recovers the weight exactly. It fills only empty weights and never
   touches billing: rates resolve through getLineItemRate() against the client
   ladder, and stdWeightKg is read by Stats and Items Master alone. The
   nos_to_weight billing path reads S.partWeights, which this does not write.

   Note what such a weight is and is not. Defined as rate/ratePerKg it prices
   back at exactly ratePerKg, so it measures tonnage, not margin.

   The flag is only set once there was something to derive from, so a device
   that loads empty and imports a backup afterwards still gets its pass. */
if (!S._deriveWeights1) {
  var _dw = applyDerivedWeights();
  if (_dw.sources > 0) {
    S._deriveWeights1 = true;
    saveJSON(STORAGE_KEY, S);
    if (_dw.derived > 0) {
      console.log('Weights: derived ' + _dw.derived + ' from piece rates' +
        (_dw.highVariance > 0 ? ' (' + _dw.highVariance + ' with inconsistent rates)' : ''));
    }
  }
}

/* The credit note series did not start in this app. CN/001 to CN/005 of
   2026-27 were raised by hand before it existed — the 04/08/26 reference is
   CN/005 — so the first one issued here is 006, not 001. Restarting the series
   at 001 would put a number the customer already holds on a second document.

   Runs once, and only while the app has issued none of its own, so it can
   never walk over a real number. Settings → Business → Credit note series carries it
   afterwards, for the next financial year or a correction. */
var CN_SERIES_START = 6;
if (!S._cnSeriesStart1) {
  if ((S.creditNotes || []).length === 0 && (!S.cnNextNum || S.cnNextNum < CN_SERIES_START)) {
    S.cnNextNum = CN_SERIES_START;
  }
  S._cnSeriesStart1 = true;
  saveJSON(STORAGE_KEY, S);
}

/* ===== A CREDIT NOTE NAMES ONE INVOICE, RETROSPECTIVELY TOO =====

   The note used to print the batch as a range. The customer asked for a single
   invoice number, and the ones already issued have to say the same thing when
   they are reprinted — a document reissued under a new rule must not read
   differently from the copy the customer holds unless somebody decided it
   should, and here somebody did.

   This is a STRUCTURAL migration, not a seed: it re-points records the state
   already holds, writes no business data, and is idempotent — so it is inside
   `migrateState()` and runs on a GitHub pull and a Settings import as well as
   on the loader, which is what stops a note stamped here reverting to a range
   the moment somebody syncs from another device.

   It stamps ONLY what `cnPickAgainstInvoice` would choose today, so a note
   reprinted after this migration names exactly what a note raised after it
   would. Where the batch's invoices are no longer in the register there is
   nothing to compute from and the note is left unstamped — the label falls back
   and says so rather than inventing a number. */
(function() {
  var stamped = 0, tooSmall = 0, gone = 0;
  (S.creditNotes || []).forEach(function(cn) {
    // A CANCELLED note credits nothing and exports at zero, so it has no credit
    // to attribute — the same reading that stops a cancelled INVOICE being named
    // and stops a cancelled NOTE consuming headroom. It also has to be skipped
    // for the two halves to agree: cnSetAgainstInvoice refuses a cancelled note,
    // so stamping one here would write a reference the operator cannot correct.
    if (cn.status === 'cancelled') return;
    if (cn.againstInvoice) {
      // Backfill only. A note stamped before the date was carried would never
      // get one, and the whole stated reason for snapshotting it — that a
      // deleted invoice must not strip a statutory particular off the
      // customer's copy — would silently not apply to it.
      if (!cn.againstInvoiceDate && cn.againstInvoiceId) {
        var held = (S.invoices || []).find(function(i) { return i.id === cn.againstInvoiceId; });
        if (held && held.date) { cn.againstInvoiceDate = held.date; stamped++; }
      }
      return;
    }
    var against = typeof cnDeriveAgainstInvoice === 'function' ? cnDeriveAgainstInvoice(cn) : null;
    if (!against) {
      var ids = cn.invoiceIds || [];
      if (!ids.length) return;
      // The two failures are different questions and get counted apart — see
      // cnAgainstInvoiceLabel(). A batch sitting in the register whose every
      // invoice is too small is the operator's call; a batch that is gone is not.
      var present = ids.filter(function(id) {
        return (S.invoices || []).some(function(i) { return i.id === id && i.status !== 'cancelled'; });
      }).length;
      if (present) tooSmall++; else gone++;
      return;
    }
    cn.againstInvoice = against.displayNumber;
    cn.againstInvoiceId = against.id;
    cn.againstInvoiceDate = against.date || '';
    stamped++;
  });
  // ⚠ WRITE ONLY IF SOMETHING CHANGED. Keying the save on the failure counts too
  // meant a note that can never be stamped rewrote the whole state on every
  // single boot, for no change.
  if (stamped) saveJSON(STORAGE_KEY, S);
  if (stamped || tooSmall || gone) {
    console.log('[migrate] credit notes: ' + stamped + ' stamped with an against-invoice' +
      (tooSmall ? ', ' + tooSmall + ' with no invoice large enough' : '') +
      (gone ? ', ' + gone + ' whose batch is no longer in the register' : ''));
  }
})();

/* ===== ₹0 LINES CARRY A REASON, RETROSPECTIVELY TOO =====

   The owner ruled (24 Sep 2026) that the lines billed at ₹0 are replating —
   work returned to be re-plated, not billed a second time. The history held 25
   such lines across 14 invoices with nothing on them saying so. They are stamped
   `replating` AND `zeroReasonBackfilled`, so the register can tell a reason the
   ruling supplied from one an operator chose, and an operator who later picks a
   reason on edit replaces the stamp.

   STRUCTURAL and idempotent: it only annotates a line that has no reason yet,
   writes no amount, and so runs on a pull and an import as well as the loader —
   a backup from a device that never ran it gets the same annotation.

   ⚠ Bounded to invoices DATED on or before the ruling. The ruling covers the
   history it was made about; a ₹0 line written after it by a device on an
   older build has no reason, and the register says "No reason recorded" rather
   than the migration inventing one forever. A backfilled line that was
   something else is corrected by picking the reason on edit. */
(function() {
  var stamped = 0;
  (S.invoices || []).forEach(function(inv) {
    if (!inv.date || inv.date > '2026-09-24') return;
    (inv.items || []).forEach(function(li) {
      if (!isZeroBilledLine(li) || li.zeroReason) return;
      li.zeroReason = 'replating';
      li.zeroReasonBackfilled = '2026-09-24';
      stamped++;
    });
  });
  if (stamped) {
    saveJSON(STORAGE_KEY, S);
    console.log('[migrate] ' + stamped + ' zero-billed line(s) stamped replating (owner ruling 24 Sep 2026)');
  }
})();


}

/* ===== LAYOUT MODE (Phase 8A) ===== */
var _resizeTimer = null;

function updateLayoutMode() {
  if (!S) return; // a resize before boot has nothing to lay out yet
  var w = window.innerWidth;
  var newDesktop = w >= 1024;
  var newTablet = w >= 768 && w < 1024;

  // No mode change — just update tablet class
  if (newDesktop === _isDesktop) {
    _isTablet = newTablet;
    document.body.classList.toggle('inv-tablet', _isTablet);
    return;
  }

  // Mode change — defer if overlay or form is active
  if (document.querySelector('.inv-overlay-scrim') || _challanForm) {
    _pendingModeSwitch = true;
    return;
  }

  _applyModeSwitch(newDesktop, newTablet);
}

function _applyModeSwitch(newDesktop, newTablet) {
  _isDesktop = newDesktop;
  _isTablet = newTablet;
  document.body.classList.toggle('inv-desktop', _isDesktop);
  document.body.classList.toggle('inv-tablet', _isTablet);
  applyAppearance(); // density follows the layout (§3.5)
  _regToolbarRendered = false;
  _imToolbarRendered = false;
  renderSidebar();
  switchTab(regFilter.activeTab || 'pageHome');
}

/* Desktop sidebar (design system §4.2): labelled, grouped, always expanded. Items and Pay open their
   parent tab on that sub-view, so an entry carries data-sub as well as data-tab. */
var SIDE_ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  create: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M12 11v6M9 14h6"/>',
  im: '<path d="M12 2.5 20.5 7.3v9.4L12 21.5l-8.5-4.8V7.3z"/>',
  register: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M9 13h6M9 17h6"/>',
  clients: '<path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.2a3.5 3.5 0 0 1 0 6.6"/>',
  items: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  stock: '<path d="M9 3h6M10 3v6L4.5 19a1.3 1.3 0 0 0 1.1 2h12.8a1.3 1.3 0 0 0 1.1-2L14 9V3M7.5 14h9"/>',
  staff: '<path d="M15 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 3 18.5V20M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M16 11l2 2 4-4"/>',
  pay: '<path d="M3 7h18v10H3zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5"/>',
  finance: '<path d="M4 21h16M5 10h14M12 3 4 7h16zM7 10v8M12 10v8M17 10v8"/>',
  todo: '<path d="M9 11l3 3 8-8M20 12v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h11"/>',
  stats: '<path d="M4 20V11M10 20V5M16 20v-6M3 20h18"/>',
  history: '<path d="M12 7v5l3 2M3.5 12a8.5 8.5 0 1 0 2.5-6M3 4v4h4"/>',
  settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4"/>'
};
var SIDE_NAV = [
  ['Daily', [['pageHome', 'Home', 'home'], ['pageCreate', 'Create invoice', 'create'], ['pageIM', 'Challans', 'im'], ['pageRegister', 'Register', 'register']]],
  ['Book', [['pageClients', 'Clients', 'clients'], ['pageClients', 'Items', 'items', 'items']]],
  ['Money', [['pageFinance', 'Finance', 'finance']]],
  ['Floor', [['pageStock', 'Stock', 'stock'], ['pageStaff', 'Staff', 'staff'], ['pageStaff', 'Pay', 'pay', 'pay']]],
  ['Review', [['pageTodo', 'To-do', 'todo'], ['pageStats', 'Stats', 'stats'], ['pageHistory', 'History', 'history']]]
];
function _sideSvg(k) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + SIDE_ICONS[k] + '</svg>'; }

function renderSidebar() {
  var existing = document.getElementById('invSidebar');
  if (existing) existing.remove();
  if (!_isDesktop) return;
  var html = '<div class="inv-side-brand"><svg class="inv-side-mark" viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="96"/>' +
    '<polygon points="256,106 385.9,181 385.9,331 256,406 126.1,331 126.1,181"/><polygon points="256,160 339.1,208 339.1,304 256,352 172.9,304 172.9,208"/><circle cx="256" cy="256" r="38"/></svg>' +
    '<span>Soma Electro</span></div>';
  SIDE_NAV.forEach(function(g) {
    html += '<div class="inv-side-group">' + g[0] + '</div>';
    g[1].forEach(function(it) {
      html += '<button class="inv-side-item" data-action="' + (SIDE_SUB_DEFAULT[it[0]] ? 'invSideGo' : 'invSwitchTab') + '" data-tab="' + it[0] + '"' +
        (it[3] ? ' data-sub="' + it[3] + '"' : '') + '>' + _sideSvg(it[2]) +
        '<span class="inv-side-label">' + it[1] + '</span><span class="inv-side-count" data-count="' + it[0] + (it[3] ? '-' + it[3] : '') + '"></span></button>';
    });
  });
  html += '<div class="inv-side-spacer"></div><button class="inv-side-item" data-action="invOpenSettings">' + _sideSvg('settings') + '<span class="inv-side-label">Settings</span></button>';
  var sidebar = document.createElement('nav');
  sidebar.className = 'inv-side';
  sidebar.id = 'invSidebar';
  sidebar.setAttribute('aria-label', 'Main');
  sidebar.innerHTML = html;
  document.body.insertBefore(sidebar, document.body.firstChild);
  markSideActive(regFilter.activeTab || 'pageHome');
  updateSideCounts();
}

function _currentSub(tabId) {
  if (tabId === 'pageClients') return getItemsSubView();
  if (tabId === 'pageStaff') return _attView;
  return '';
}

/* An entry with data-sub is on only on that sub-view; its parent entry is on for every other one. */
function markSideActive(tabId) {
  var items = document.querySelectorAll('.inv-side-item[data-tab]');
  if (!items.length) return;
  var sub = _currentSub(tabId);
  var subHit = Array.prototype.some.call(items, function(b) { return b.dataset.tab === tabId && b.dataset.sub === sub; });
  items.forEach(function(b) {
    var on = b.dataset.tab === tabId && (b.dataset.sub ? b.dataset.sub === sub : !subHit);
    b.classList.toggle('inv-side-item-on', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
}

/* Counts are toned only when they count a problem (§4.2). */
function updateSideCounts() {
  function put(key, n, tone) {
    var el = document.querySelector('.inv-side-count[data-count="' + key + '"]');
    if (!el) return;
    el.textContent = n ? String(n) : '';
    el.className = 'inv-side-count' + (n && tone ? ' inv-side-count-' + tone : '');
  }
  if (!S) return;
  put('pageTodo', typeof todoRedCount === 'function' ? todoRedCount() : 0, 'danger');
  put('pageStock', typeof stockOutCount === 'function' ? stockOutCount() : 0, 'danger');
}

/* Two pages carry two sidebar entries each: Clients and Items, Staff and Pay. The plain entry used to
   be a bare switchTab, so from Pay, Staff switched to the page already open, on the view already
   showing, and nothing moved (owner, 26 Sep 2026). A plain entry now leaves any view that belongs to
   its sibling for the page's own default, and keeps every other view (Staff from Week stays on Week). */
var SIDE_SUB_DEFAULT = { pageClients: 'clients', pageStaff: 'overview' };
function sideGo(tabId, sub) {
  if (!sub) {
    var cur = _currentSub(tabId);
    var claimed = SIDE_NAV.some(function(g) { return g[1].some(function(it) { return it[0] === tabId && it[3] === cur; }); });
    sub = claimed ? SIDE_SUB_DEFAULT[tabId] : cur;
  }
  if (tabId === 'pageClients') setItemsSubView(sub);
  if (tabId === 'pageStaff') _attView = sub;
  switchTab(tabId);
  if (tabId === 'pageClients') renderClientsPage();
  markSideActive(tabId);
}

// Debounced ResizeObserver
new ResizeObserver(function() {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(updateLayoutMode, 150);
}).observe(document.documentElement);

/* Manifest app shortcuts land here as ?tab=<pageId>[&new=1]. Writing the target
   into regFilter before the first layout pass means both the desktop and the
   mobile restore paths pick it up without a second switchTab, and the query is
   stripped so a later refresh returns to the ordinary saved tab. */
var _launchNew = false;
var _launchTodo = '';   // the widget's action when it opened the app: 'open', 'add', 'open:m:<id>', 'open:a:<key>'
(function() {
  var params;
  try { params = new URLSearchParams(window.location.search); } catch (e) { return; }
  var wanted = params.get('tab');
  if (!wanted || !document.getElementById(wanted)) return;
  regFilter.activeTab = wanted;
  saveRegFilter();
  _launchNew = params.get('new') === '1';
  _launchTodo = params.get('todo') || '';
  try { history.replaceState(null, '', window.location.pathname); } catch (e) {}
})();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

/* ===== BOOT =====
   Everything that needs S, in the order it always ran: state.js's own reset,
   seed.js, the bootstrap seeds, the structural migrations, then layout and
   the tab restore. The load is asynchronous now that the store is IndexedDB,
   so this runs from loadState().then(...) at the end of the file, and
   `body.inv-booted` is the signal that it has. Until then the shell is
   visible but inert. */
function bootApp() {
  seedIncomingMaterial();
  runBootstrapSeeds();
  migrateState();

  // Initial layout detection (no debounce)
  updateLayoutMode();
  updateStockBadge();

  /* Phase 6b: Restore active tab on refresh */
  // If updateLayoutMode triggered _applyModeSwitch, it already called switchTab.
  // Only do manual restore if we're still on mobile (no mode switch happened).
  if (!_isDesktop) {
    var _savedTab = regFilter.activeTab || 'pageHome';
    if (_savedTab !== 'pageHome' && document.getElementById(_savedTab)) {
      switchTab(_savedTab);
    } else {
      renderHome();
    }
  }

  /* The "Add Challan" app shortcut opens the form, not just the tab. Runs after
     the tab restore above so the IM view exists to render into. */
  if (_launchNew && regFilter.activeTab === 'pageIM' && !_isDesktop) {
    showAddChallanForm();
  }

  /* The widget: apply the Done taps it queued while the app was shut, open
     what it asked for, and hand it a fresh payload. */
  if (_launchTodo) todoHandleLaunch(_launchTodo);
  else todoApplyWidgetQueue();
  todoWidgetPublish();

  /* A read that threw at load used to fall through to a fresh default state
     and say nothing. It is the one storage failure the operator most needs to
     hear about: the store is read-only for this session (persistState refuses
     to write over a copy it could not open), so nothing entered here is kept. */
  if (_storageHealth.readError) {
    showStorageBanner('This browser could not read the stored copy (' + _storageHealth.readError +
      '). Nothing is written on this device until it can, so that copy is not lost \u2014 but nothing entered here is kept either.', 'read');
  }

  document.body.classList.add('inv-booted');
}

/* ===== BUILD IDENTITY + UPDATE CHECK =====
   The worker is network-first, so a fresh OPEN always gets the newest build —
   but an installed app resumed from the recents screen never navigates, and
   nothing told an open page that a build had shipped. It could run one build
   for weeks. build.sh stamps the document and writes the same stamp to
   version.json; the page re-reads that file whenever it comes back into view
   and offers a reload when the two disagree. Offers, never forces: a reload
   discards a half-typed challan, and that is the operator's call. */
var APP_BUILD = (function() {
  var m = document.querySelector('meta[name="app-build"]');
  return (m && m.getAttribute('content')) || 'dev';
})();
var UPDATE_CHECK_GAP_MS = 5 * 60 * 1000;
var _updateCheckedAt = 0;
var _updateDismissed = null;

// Resolves to 'newer' (banner shown), 'current', or 'unknown' (offline, or an
// unbuilt copy that carries no stamp). The three are kept apart so a manual
// check cannot report "up to date" on a device that simply had no signal.
function checkForUpdate(force) {
  if (APP_BUILD === 'dev') return Promise.resolve('unknown');
  var now = Date.now();
  if (!force && now - _updateCheckedAt < UPDATE_CHECK_GAP_MS) return Promise.resolve('current');
  _updateCheckedAt = now;
  return fetch('version.json', { cache: 'no-store' })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(v) {
      var build = v && typeof v.build === 'string' ? v.build : '';
      if (!build) return 'unknown';
      if (build === APP_BUILD) return 'current';
      if (force || build !== _updateDismissed) showUpdateBanner(build);
      return 'newer';
    })
    .catch(function() { return 'unknown'; });
}

function showUpdateBanner(build) {
  var existing = document.querySelector('.inv-update-bar');
  if (existing) existing.remove();
  var bar = document.createElement('div');
  bar.className = 'inv-update-bar';
  bar.setAttribute('role', 'status');
  bar.dataset.build = build;
  bar.innerHTML =
    '<span class="inv-update-text">A newer version is available. Reload to update &mdash; ' +
    'finish anything half-typed first.</span>' +
    '<span class="inv-update-actions">' +
    '<button class="inv-btn inv-btn-ghost inv-update-btn" data-action="invDismissUpdate">Later</button>' +
    '<button class="inv-btn inv-btn-primary inv-update-btn" data-action="invReloadForUpdate">Reload</button>' +
    '</span>';
  document.body.appendChild(bar);
}

function dismissUpdateBanner() {
  var bar = document.querySelector('.inv-update-bar');
  if (!bar) return;
  _updateDismissed = bar.dataset.build || null;
  bar.remove();
}

function checkForUpdateManually() {
  checkForUpdate(true).then(function(result) {
    if (result === 'current') showToast('You are on the latest version (build ' + APP_BUILD + ')');
    else if (result === 'unknown') showToast('Could not reach the server to check', 'warning');
  });
}

/* Both directions, on open and on close: shown, the app takes what the widget
   queued; hidden or shut, it leaves the widget its latest list. */
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'visible') {
    checkForUpdate(false);
    if (S) todoApplyWidgetQueue();
  } else if (S) {
    todoWidgetPublish();
  }
});
window.addEventListener('pagehide', function() { if (S) todoWidgetPublish(); });
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', function(e) { todoOnWorkerMessage(e.data); });
}
checkForUpdate(false);

loadState().then(function(loaded) {
  bootState(loaded);
  bootApp();
});
