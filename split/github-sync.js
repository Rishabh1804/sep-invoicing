/* ===== GITHUB SYNC =====
   Backup and cross-device transfer for a localStorage-only app. Pushes the
   whole state object to one JSON file in a GitHub repo through the Contents
   API, and pulls it back on another device.

   Two things this deliberately is not. It is not a merge: the state is a
   single document with no per-record clocks, so anything other than
   last-writer-wins would be inventing a reconciliation it cannot verify. And
   it is not silent: every overwrite in either direction is confirmed, because
   the thing being overwritten is a GST filing record.

   What it does guarantee is that no overwrite happens blind. Each device
   remembers the blob SHA it last exchanged; if the SHA on the server has moved
   since, another device wrote in between and the operator is told whose and
   when before anything is replaced. */

const GH_SYNC_KEY = 'sep_inv_github_sync';
const GH_TOKEN_KEY = 'sep_inv_github_token';
const GH_SCHEMA = 1;

/* The token lives in its own localStorage entry, never on S — same rule the
   Gemini and metals.dev keys follow, so an exported backup can never carry a
   credential. The rest of the config is kept off S too: a file SHA and a
   device id describe *this* device's relationship to the remote, and restoring
   someone else's backup must not hand this device their sync position. */
/* The token is locked to the device now (devices.js): read once at the start into memory, stored encrypted under a
   key this browser cannot hand out. setGhToken resolves once it is stored. */
function getGhToken() {
  if (typeof devTokenGet === 'function') return devTokenGet();
  try { return localStorage.getItem(GH_TOKEN_KEY) || ''; } catch (e) { return ''; }
}
function setGhToken(t) {
  if (typeof devTokenSet === 'function') return devTokenSet(t);
  try { localStorage.setItem(GH_TOKEN_KEY, t); } catch (e) {}
  return Promise.resolve(true);
}

function getGhConfig() {
  var c = loadJSON(GH_SYNC_KEY, null) || {};
  if (!c.deviceId) {
    // One id for the device: its sync config and its row on the device list (devices.js) name the same device.
    c.deviceId = typeof devId === 'function' ? devId() : 'dev-' + Math.random().toString(36).slice(2, 8);
    saveJSON(GH_SYNC_KEY, c);
  }
  return {
    owner: c.owner || '',
    repo: c.repo || '',
    branch: c.branch || 'main',
    path: c.path || 'sep-invoicing-data.json',
    deviceId: c.deviceId,
    deviceName: c.deviceName || '',
    sha: c.sha || null,
    lastPushAt: c.lastPushAt || null,
    lastPullAt: c.lastPullAt || null,
    autoPush: !!c.autoPush
  };
}

function setGhConfig(cfg) { saveJSON(GH_SYNC_KEY, cfg); }

function ghIsConfigured() {
  var c = getGhConfig();
  return !!(c.owner && c.repo && c.path && getGhToken());
}

function ghLastSyncAt() {
  var c = getGhConfig();
  return Math.max(c.lastPushAt || 0, c.lastPullAt || 0) || null;
}

/* ===== ENCODING =====
   The Contents API carries base64. btoa() only handles Latin-1, and client
   names and notes are not — so the string goes through TextEncoder first.
   The byte array is walked in chunks because String.fromCharCode.apply blows
   the call stack on a large state file. */
function ghEncode(str) {
  var bytes = new TextEncoder().encode(str);
  var bin = '';
  var chunk = 0x8000;
  for (var i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function ghDecode(b64) {
  var bin = atob(String(b64).replace(/\s/g, ''));
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function ghContentsUrl(cfg) {
  return 'https://api.github.com/repos/' +
    encodeURIComponent(cfg.owner) + '/' + encodeURIComponent(cfg.repo) +
    '/contents/' + cfg.path.split('/').filter(Boolean).map(encodeURIComponent).join('/');
}

/* One place where an HTTP status becomes something an operator can act on.
   "404" on this endpoint almost never means what it says — a fine-grained
   token without Contents access gets a 404, not a 403. */
function ghErrorMessage(status, body) {
  var detail = body && body.message ? body.message : '';
  if (status === 401) return 'GitHub rejected the token. Check it has not expired.';
  if (status === 403) return 'GitHub refused the request (rate limit, or the token lacks Contents write). ' + detail;
  if (status === 404) return 'Not found — check owner, repo and branch, and that the token grants Contents access to this repo.';
  if (status === 409) return 'The file changed on GitHub while this push was in flight. Pull first, or push again.';
  if (status === 422) return 'GitHub rejected the file contents. ' + detail;
  return 'GitHub error ' + status + (detail ? ': ' + detail : '');
}

async function ghRequest(url, options) {
  var token = getGhToken();
  var opts = options || {};
  var res;
  try {
    res = await fetch(url, {
      method: opts.method || 'GET',
      // Never from the browser's HTTP cache. GitHub marks these responses
      // cacheable for 60 s and gives the JSON and the raw form of a file the
      // SAME ETag, so a cached metadata response could be revalidated with a 304
      // and handed back as the "raw" file — a pull on one phone read the file's
      // metadata and refused it as not a backup while the desktop pulled fine.
      // Sync also needs the live SHA: a cached one would defeat the conflict check.
      cache: 'no-store',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': opts.raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
  } catch (err) {
    // fetch only rejects on a transport failure, which offline is.
    throw new Error('No connection to GitHub. The data is safe on this device — sync when you are back online.');
  }
  if (opts.raw && res.ok) return res.text();
  var payload = null;
  try { payload = await res.json(); } catch (e) { payload = null; }
  if (!res.ok) {
    var e2 = new Error(ghErrorMessage(res.status, payload));
    e2.status = res.status;
    throw e2;
  }
  return payload;
}

/* Reads the remote file. Returns null when it does not exist yet, which is
   the ordinary first-push case and not an error.

   🔴 Over 1 MB the Contents API returns the file's metadata with `content`
   EMPTY (`encoding: "none"`) — it still takes a PUT of up to 100 MB, so push
   kept working while every pull read an empty envelope and refused a real
   4.3 MB backup as "not a SEP Invoicing backup". The book passed 1 MB long
   ago. So when the content is missing the file is fetched again as raw bytes,
   which the same endpoint serves up to 100 MB. `opts.body === false` skips
   the body when only the SHA is wanted (the push's conflict check). */
async function ghGetRemote(cfg, opts) {
  var url = ghContentsUrl(cfg) + '?ref=' + encodeURIComponent(cfg.branch);
  try {
    var data = await ghRequest(url);
    var text = null;
    if (data && data.content) text = ghDecode(data.content);
    else if (data && data.sha && !(opts && opts.body === false)) text = await ghRequest(url, { raw: true });
    var envelope = null;
    if (text) {
      try { envelope = JSON.parse(text); } catch (e) { envelope = null; }
    }
    return { sha: data ? data.sha : null, envelope: envelope, size: data ? data.size : 0,
      path: cfg.path, got: ghDescribeText(text, data) };
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

/* What actually arrived, in words, for when it is not a backup — so an error
   says which file and what was in it rather than only that it was wrong. */
function ghDescribeText(text, data) {
  if (!text) return data && data.encoding === 'none' ? 'GitHub sent no content' : 'an empty file';
  var parsed = null;
  try { parsed = JSON.parse(text); } catch (e) { return 'not JSON (starts "' + String(text).slice(0, 24) + '")'; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return 'JSON, but not an object';
  if (parsed.app === 'sep-invoicing') return 'a SEP Invoicing backup';
  if (parsed.type === 'file' && parsed.sha && 'content' in parsed) return 'GitHub\'s description of the file, not the file';
  if (parsed.company && parsed.clients) return 'a Settings → Export backup, not a sync file';
  return 'JSON with ' + Object.keys(parsed).slice(0, 4).join(', ');
}

function ghBuildEnvelope(cfg) {
  return {
    app: 'sep-invoicing',
    schema: GH_SCHEMA,
    savedAt: Date.now(),
    device: cfg.deviceName || cfg.deviceId,
    deviceId: cfg.deviceId,
    counts: {
      invoices: (S.invoices || []).length,
      challans: (S.incomingMaterial || []).length,
      clients: (S.clients || []).length,
      items: (S.items || []).length
    },
    state: S
  };
}

function ghDescribeEnvelope(env) {
  if (!env) return 'an unreadable file';
  var c = env.counts || {};
  var who = env.device ? ' from ' + env.device : '';
  var when = env.savedAt ? ' on ' + formatTimestamp(env.savedAt) : '';
  return (c.invoices != null ? c.invoices + ' invoices, ' + c.challans + ' challans' : 'a backup') + who + when;
}

/* What a push or a pull learnt, written onto the config as it is NOW. It was read before the network and the owner's
   answer, and writing that copy back undid whatever Settings saved meanwhile: a new target, auto-push switched off (the
   QA sweep, 29 Sep 2026). The remembered SHA belongs to the target it was read from, so a changed target takes none. */
function ghRecord(from, fields) {
  var now = getGhConfig();
  var same = ['owner', 'repo', 'path', 'branch'].every(function(k) { return now[k] === from[k]; });
  if (!same) return false;
  Object.keys(fields).forEach(function(k) { now[k] = fields[k]; });
  setGhConfig(now);
  return true;
}

/* Push and Pull use the settings as saved: pressed with the section's edits unsaved, they reached the old target and
   said nothing (the QA sweep, 29 Sep 2026). */
function ghFieldsUnsaved() {
  if (!document.querySelector('#settingsScrim details[data-sec="sync"][data-dirty]')) return false;
  showToast('Save the GitHub sync section first: Push and Pull use what is saved', 'warning');
  return true;
}

/* What this window holds, counted the way an envelope counts. */
function ghCountsText() {
  return (S.invoices || []).length + ' invoices, ' + (S.incomingMaterial || []).length + ' challans';
}

/* A book replaced by hand (Settings → Import) is not the copy this device last exchanged with GitHub. With the SHA still
   matching, auto-push sent an older backup over GitHub's copy unasked (the QA audit of 30 Sep 2026); without it the next
   push asks, and auto-push pauses. */
function ghForgetSha() {
  var c = loadJSON(GH_SYNC_KEY, null);
  if (c && c.sha) { c.sha = null; setGhConfig(c); }
}

/* ===== THE MERGE (merge.js, G4) =====
   GitHub moved since this device last exchanged with it, and this device holds the copy it last exchanged (the base, kept
   with the SHA it was exchanged at): the two are merged rather than one replacing the other. Without a base for the SHA
   this device remembers (the first sync after this build, an import, another target) there is nothing to merge from, and
   null says so: the old questions are asked. */
async function ghMergeRemote(cfg, remote) {
  if (typeof mrgMerge !== 'function' || !cfg.sha || bookStandIn()) return null;
  var base = await mrgBaseGet();
  if (!base || !base.state || base.sha !== cfg.sha) return null;
  var env = remote && remote.envelope;
  if (!env || env.app !== 'sep-invoicing' || !env.state || !env.state.company || !env.state.clients || env.schema > GH_SCHEMA) return null;
  var from = (env._device && env._device.name) || env.device || 'GitHub';
  var res = mrgMerge(base.state, S, env.state, { baseAt: base.at, from: from, prefer: mrgPrefer() });
  mrgAdopt(res, from);
  var landed = await saveState();
  if (typeof tabRedrawActive === 'function') { try { tabRedrawActive(); } catch (e) { /* drawn at the next move */ } }
  return { res: res, landed: landed, from: from };
}
function ghMergeText(m) {
  return 'Merged with ' + m.from + ': ' + m.res.taken + ' change' + (m.res.taken === 1 ? '' : 's') + ' taken' +
    (m.res.held.length ? ', ' + m.res.held.length + ' held for the owner' : '') + '.';
}

/* ===== PUSH ===== */
async function ghPush(opts) {
  var silent = opts && opts.silent;
  var cfg = getGhConfig();
  // The guard on and this device not registered (or removed): nothing goes up, and the reason is said (devices.js).
  var held = typeof devSyncBlocked === 'function' ? devSyncBlocked() : '';
  if (held) {
    ghSetStatus(held);
    if (!silent) showToast(held, 'error');
    return false;
  }
  if (!ghIsConfigured()) {
    if (!silent) showToast('Set the GitHub repo and token in Settings first', 'error');
    return false;
  }
  // A stand-in (the stored book would not read, or is gone: bookStandIn) is never pushed unasked. The SHA guard below
  // cannot see it, since GitHub's copy has not moved: auto-push sent the default book over the only other copy of the
  // real one (the QA audit of 30 Sep 2026). By hand it asks, naming both sides.
  var standIn = bookStandIn();
  if (standIn && silent) {
    ghSetStatus('Not pushed: ' + bookStandInWords() + '. Import a backup or pull from GitHub first.');
    return false;
  }

  ghSetBusy(true, 'Pushing');
  var mergedNote = '', pushedStr = null;
  try {
    // The stand-in's question names GitHub's copy, so it is read whole; otherwise the SHA is enough.
    var remote = await ghGetRemote(cfg, standIn ? null : { body: false });

    if (standIn) {
      var go = await uiConfirm({ title: 'Push a stand-in to GitHub?', body: 'This window holds a stand-in, not this device\'s book: ' +
        bookStandInWords() + '. The stand-in holds ' + ghCountsText() + '.\n\nGitHub holds ' +
        (remote ? ghDescribeEnvelope(remote.envelope) : 'no copy yet') + '.\n\nPushing replaces GitHub\'s copy with the stand-in. Continue?',
        okLabel: 'Push the stand-in', danger: true });
      if (!go) { ghSetBusy(false); ghSetStatus('Push cancelled.'); return false; }
    }
    // The SHA moved since this device last exchanged: someone else wrote.
    // Never resolve that quietly — the operator is the only one who knows
    // which copy is the real one.
    else if (remote && remote.sha && remote.sha !== cfg.sha) {
      // Only now is the other copy worth downloading: to merge it, or to say whose it is.
      if (!remote.envelope) remote = await ghGetRemote(cfg) || remote;
      var merged = await ghMergeRemote(cfg, remote);
      if (merged && !merged.landed) {
        ghSetBusy(false);
        ghSetStatus('Merged, but NOT saved on this device: ' + saveFailText() + '. Not pushed.');
        if (!silent) showToast('Merged, but not saved: not pushed', 'error');
        return false;
      }
      if (merged) {
        mergedNote = ghMergeText(merged);
        if (merged.res.held.length) showToast(mergedNote, 'warning');
      }
      else if (silent) {
        ghSetBusy(false);
        ghSetStatus('Auto-push paused: GitHub has a newer copy (' + ghDescribeEnvelope(remote.envelope) + '). Push or pull by hand.');
        return false;
      }
      if (!merged) { var ok = await uiConfirm({ title: 'GitHub has a copy this device has not seen', body: 'GitHub already holds a copy this device has not seen — ' +
        ghDescribeEnvelope(remote.envelope) + '.\n\nPushing replaces it with this device\'s data. Continue?', okLabel: 'Push and replace', danger: true });
      if (!ok) { ghSetBusy(false); ghSetStatus('Push cancelled.'); return false; } }
    }

    var envelope = ghBuildEnvelope(cfg);
    // A registered device's copy carries `_device` beside the book and a message naming the device and the user
    // (devices.js); with the guard off there is none, and the copy and the message are as they always were.
    var dp = typeof devPushPrep === 'function' ? devPushPrep(envelope, opts) : null;
    var pushedRev = _diskRev;
    var body;
    try {
      body = {
        message: dp ? dp.message : 'SEP Invoicing backup — ' + envelope.counts.invoices + ' invoices, ' +
          envelope.counts.challans + ' challans (' + envelope.device + ')',
        content: ghEncode(JSON.stringify(envelope, null, 2)),
        branch: cfg.branch
      };
      // What went up is the base the next merge reads from (merge.js).
      pushedStr = JSON.stringify(envelope.state);
    } finally { if (dp) dp.restore(); }
    if (remote && remote.sha) body.sha = remote.sha;

    var result = await ghRequest(ghContentsUrl(cfg), { method: 'PUT', body: body });
    var pushedAt = Date.now();
    // The remembered SHA says GitHub holds what this device holds. Not for a stand-in, and not for a book whose last save
    // did not reach this device's disk: after a reload the device holds an older book than the one sent, and auto-push
    // would send it over GitHub's unasked. Without the SHA the next push asks. A stand-in pushed is no backup either.
    var ours = !standIn && _storageHealth.lastSaveOk !== false;
    if (ours) {
      var newSha = result && result.content ? result.content.sha : null;
      ghRecord(cfg, { sha: newSha, lastPushAt: pushedAt });
      if (typeof mrgBasePut === 'function' && newSha && pushedStr) await mrgBasePut(pushedStr, newSha);
    }
    else if (!standIn) ghRecord(cfg, { lastPushAt: pushedAt });
    if (pushedRev && ours) bookPost({ type: 'pushed', rev: pushedRev });
    // The device's row keeps the push it carried (devices.js), saved quietly so it arms no push of its own.
    if (dp) dp.done();
    ghSetBusy(false);
    ghSetStatus(standIn ? 'Pushed the stand-in ' + formatTimestamp(pushedAt) + '.'
      : (mergedNote ? mergedNote + ' ' : '') + 'Pushed ' + formatTimestamp(pushedAt) + '.' + (ours ? '' : ' This device\'s last save did not land, so the next push asks first.'));
    ghRenderCard();
    if (!silent) showToast(standIn ? 'Pushed the stand-in to GitHub' : 'Pushed to GitHub');
    return true;
  } catch (err) {
    ghSetBusy(false);
    ghSetStatus(err.message);
    if (!silent) showToast(err.message, 'error');
    return false;
  }
}

/* ===== PULL ===== */
async function ghPull(opts) {
  var replace = !!(opts && opts.replace);
  var cfg = getGhConfig();
  // The guard on and this device not registered (or removed): it views the data by importing a backup (devices.js).
  var held = typeof devSyncBlocked === 'function' ? devSyncBlocked() : '';
  if (held) { ghSetStatus(held); showToast(held, 'error'); return false; }
  if (!ghIsConfigured()) { showToast('Set the GitHub repo and token in Settings first', 'error'); return false; }
  // Where nothing can be written (a stored copy that cannot be set aside), a pull would only replace the stand-in in memory.
  var blocked = bookStandInBlocker();
  if (blocked) { ghSetStatus('Not pulled: ' + blocked + '.'); showToast('Not pulled: ' + blocked, 'error'); return false; }

  ghSetBusy(true, 'Pulling');
  try {
    var remote = await ghGetRemote(cfg);
    if (!remote) {
      ghSetBusy(false);
      ghSetStatus('No backup file at that path yet — push once to create it.');
      showToast('Nothing to pull yet', 'warning');
      return false;
    }
    var env = remote.envelope;
    if (!env || env.app !== 'sep-invoicing' || !env.state || !env.state.company || !env.state.clients) {
      ghSetBusy(false);
      var why = remote.path + ' is not a SEP Invoicing backup: ' + remote.got + ' (' + remote.size + ' bytes).';
      ghSetStatus(why);
      showToast('That file is not a SEP Invoicing backup — ' + remote.got, 'error');
      return false;
    }
    if (env.schema > GH_SCHEMA) {
      ghSetBusy(false);
      ghSetStatus('That backup was written by a newer version of the app.');
      showToast('Backup is from a newer app version', 'error');
      return false;
    }
    // Merged into this device's book where it can be (merge.js): nothing of this device's is lost, so it is not the owner's
    // alone. GitHub's copy becomes the base the next merge reads from; the merged book goes up with the next push.
    if (!replace) {
      var merged = await ghMergeRemote(cfg, remote);
      if (merged) {
        if (merged.landed) {
          ghRecord(cfg, { sha: remote.sha, lastPullAt: Date.now() });
          await mrgBasePut(JSON.stringify(env.state), remote.sha);
        }
        ghSetBusy(false);
        var note = ghMergeText(merged);
        ghSetStatus(merged.landed ? note : 'Merged, but NOT saved on this device: ' + saveFailText() + '.');
        showToast(merged.landed ? note : 'Merged, but not saved', merged.landed ? (merged.res.held.length ? 'warning' : 'success') : 'error');
        return merged.landed;
      }
    }
    // Replacing the book: the owner's alone (guard.js grdBookAsk), since it takes the book's IDs with it.
    ghSetBusy(false);
    if (!grdOk('users') && !(await grdBookAsk('pull from GitHub'))) return false;
    ghSetBusy(true, 'Pulling');

    if (!(await uiConfirm({ title: 'Replace all data on this device?', body: 'Replace ALL data on this device with ' + ghDescribeEnvelope(env) + '?\n\n' +
        (bookStandIn() ? bookStandInReplaceText() : 'This device currently holds ' + ghCountsText() + '. That is discarded.'), okLabel: 'Replace', danger: true }))) {
      ghSetBusy(false);
      ghSetStatus('Pull cancelled.');
      return false;
    }
    // This book's IDs stay unless the owner says to take GitHub's copy's (guard.js), where the two differ.
    await grdBookUsersAsk(env.state);

    // The same two passes the loader runs, in the same order: fill the shape a
    // backup might predate, then migrate the records inside it. The second was
    // missing, so a pull from a device that had never run the area realignment
    // kept its retired `pickling` / `colour` ids — which areaStats drops
    // silently, under-counting heads and inflating every shortfall until the
    // next reload. A copy that arrives over the wire is exactly as old as one
    // read off disk, and gets exactly the same treatment.
    try {
      adoptState(env.state);
    } catch (e) {
      ghSetBusy(false);
      ghSetStatus('That backup could not be read: ' + e.message);
      showToast('Backup could not be read', 'error');
      return false;
    }
    bookReleaseStandIn();
    // The SHA is this device's only once the pulled book is on its disk. Recorded after a save that did not land, the
    // device went back to its older book on the next start, still "in step" with GitHub, and auto-push sent that older
    // book over the one just pulled (the QA audit of 30 Sep 2026).
    var landed = await saveState();

    var pulledAt = Date.now();
    if (landed) {
      ghRecord(cfg, { sha: remote.sha, lastPullAt: pulledAt });
      if (typeof mrgBasePut === 'function') await mrgBasePut(JSON.stringify(env.state), remote.sha);
    }

    ghSetBusy(false);
    ghSetStatus(landed ? 'Pulled ' + formatTimestamp(pulledAt) + '.' : 'Pulled, but NOT saved on this device: ' + saveFailText() + '.');
    bookReplacedShow();
    if (landed) showToast('Pulled from GitHub');
    else showToast('NOT saved: ' + saveFailText() + '. The pulled book is in this window only and will be lost on reload.', 'error');
    // The book pulled may say this device was removed: it forgets its token and says why (devices.js). The pulled
    // copy's `_device` was beside the book, never in it: adoptState took env.state alone.
    if (typeof devAfterLoad === 'function') devAfterLoad('pull');
    return landed;
  } catch (err) {
    ghSetBusy(false);
    ghSetStatus(err.message);
    showToast(err.message, 'error');
    return false;
  }
}

/* ===== AUTO-PUSH =====
   Opt-in, debounced, and never during a burst of edits. saveState() fires on
   every keystroke-driven recalculation, so pushing per save would be both
   useless and rate-limited. */
var _ghPushTimer = null;
var _ghAutoBackoff = false;
const GH_AUTOPUSH_DELAY = 45000;

function ghNotifyChange() {
  // The save that turns the guard on offers to register a device that already syncs (devices.js).
  if (typeof devOnSave === 'function') devOnSave();
  // A stand-in is not the book: saves of it are refused, and it is never pushed unasked (ghPush).
  if (bookStandIn()) return;
  // The guard on and this device not registered: auto-push never arms, and one armed before is dropped.
  if (typeof devSyncBlocked === 'function' && devSyncBlocked()) { ghCancelPending(); return; }
  var cfg = getGhConfig();
  if (!cfg.autoPush || !ghIsConfigured() || _ghAutoBackoff) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  clearTimeout(_ghPushTimer);
  _ghPushTimer = setTimeout(function() {
    ghPushLocked({ silent: true }).then(function(ok) {
      // One failure stops the timer re-arming forever in the background;
      // a manual push clears it.
      if (!ok) _ghAutoBackoff = true;
    });
  }, GH_AUTOPUSH_DELAY);
}

/* Two windows of the app must never push against each other: each would read the file's SHA, the second PUT would
   meet the first's, and auto-push would pause itself on a copy its own device wrote. So every push holds one lock
   across the origin's windows (Web Locks), reads the config fresh inside it, and a window that pushed tells the others
   which revision went up, so a push still pending in another window for that same book is dropped. */
function ghPushLocked(opts) {
  if (typeof navigator !== 'undefined' && navigator.locks && navigator.locks.request) {
    return navigator.locks.request('sep-invoicing-gh-push', function() { return ghPush(opts); });
  }
  return ghPush(opts);
}
function ghCancelPending() { clearTimeout(_ghPushTimer); _ghPushTimer = null; }

/* ===== STATUS SURFACE ===== */
/* What a merge held for the owner (merge.js), under the sync buttons; redrawn with the status. */
function ghHeldHtml() {
  var n = typeof mrgHeldOpen === 'function' ? mrgHeldOpen().length : 0;
  return n ? '<div class="inv-callout inv-callout-warning inv-mt-8" data-mrg-count>' + todoPlural(n, 'change') + ' held for the owner from a merge. ' +
    '<button type="button" class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invMrgOpen">Held for you</button></div>' : '';
}
function ghHeldSync() { document.querySelectorAll('[data-mrg-host]').forEach(function(h) { h.innerHTML = ghHeldHtml(); }); }
var _ghStatusText = '';
var _ghBusy = false;

function ghSetStatus(text) {
  _ghStatusText = text || '';
  var el = document.getElementById('ghSyncStatus');
  if (el) el.textContent = _ghStatusText;
  ghHeldSync();
  ghRenderCard();
}

function ghSetBusy(busy, label) {
  _ghBusy = busy;
  if (busy) _ghAutoBackoff = false;
  var el = document.getElementById('ghSyncStatus');
  if (el && busy) el.textContent = (label || 'Working') + '…';
  // A device the guard keeps from syncing keeps its buttons off (devices.js).
  var blocked = typeof devSyncBlocked === 'function' && !!devSyncBlocked();
  ['ghPushBtn', 'ghPullBtn', 'ghReplaceBtn'].forEach(function(id) {
    var b = document.getElementById(id);
    if (b) b.disabled = busy || blocked;
  });
}

function ghRelTime(ts) {
  if (!ts) return 'never';
  var mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + ' min ago';
  var hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + ' h ago';
  var days = Math.floor(hrs / 24);
  return days + ' day' + (days > 1 ? 's' : '') + ' ago';
}

/* Home card. A backup whose state you cannot see is a backup you will not
   trust, so the last sync time sits on the first screen rather than three
   taps into Settings. */
function ghRenderCard() {
  var host = document.getElementById('homeSyncCard');
  if (!host) return;
  // The guard keeps this device from syncing (devices.js): the card says so, and offers to register it unless it was
  // removed. A removed device's token is gone, and the card stays to say why.
  var blockedShort = typeof devSyncBlockedShort === 'function' ? devSyncBlockedShort() : '';
  if (blockedShort) {
    var bc = getGhConfig();
    if (!bc.owner || !bc.repo) { host.innerHTML = ''; return; }
    var removed = typeof devRemovedRow === 'function' && !!devRemovedRow();
    // Removed: the whole sentence, who and when and why. Not registered: the few words, with the way to fix it beside.
    var why = removed ? devSyncBlocked() : blockedShort.charAt(0).toUpperCase() + blockedShort.slice(1);
    host.innerHTML = '<div class="inv-panel inv-panel-flush" data-card="sync"><div class="inv-row inv-row-2">' +
      '<span class="inv-row-main"><span class="inv-row-title">GitHub backup</span>' +
        '<span class="inv-row-meta">' + uiDot(removed ? 'danger' : 'warning', escHtml(why)) + '</span></span>' +
      (removed ? '' : '<span class="inv-row-end"><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invDevGo" data-sec="devices">Register</button></span>') +
      '</div></div>';
    return;
  }
  if (!ghIsConfigured()) { host.innerHTML = ''; return; }

  var cfg = getGhConfig();
  var last = ghLastSyncAt();
  // Anything past a working day without a push is worth flagging on a device
  // whose only other copy is the localStorage it is sitting in.
  var stale = !last || (Date.now() - last) > 86400000;

  // The status leads the meta line: it ellipsizes at its end, and a long repo
  // name must not push the stale warning out of sight on a phone.
  var when = 'Last synced ' + escHtml(ghRelTime(last));
  host.innerHTML = '<div class="inv-panel inv-panel-flush" data-card="sync"><div class="inv-row inv-row-2">' +
    '<span class="inv-row-main"><span class="inv-row-title">GitHub backup</span>' +
      '<span class="inv-row-meta">' + (stale ? '<span class="inv-dot inv-dot-warning">' + when + '</span>' : when) +
      ' · <span class="inv-id">' + escHtml(cfg.owner + '/' + cfg.repo) + '</span></span></span>' +
    '<span class="inv-row-end"><button class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invGhPush"' + (_ghBusy ? ' disabled' : '') + '>' +
      (_ghBusy ? 'Syncing…' : 'Back up now') + '</button></span></div></div>';
}

/* ===== SETTINGS SECTION ===== */
/* The GitHub sync section of Settings: the fields only; Settings draws the frame. */
function renderGhSyncFields() {
  var cfg = getGhConfig();
  var last = ghLastSyncAt();
  function field(id, label, value, placeholder, cls, hint) {
    return '<div class="inv-field"><label class="inv-field-label" for="' + id + '">' + label + '</label>' +
      '<input class="inv-input' + cls + '" id="' + id + '" value="' + escHtml(value) + '" placeholder="' + placeholder + '" autocomplete="off">' +
      (hint ? '<div class="inv-field-hint">' + hint + '</div>' : '') + '</div>';
  }
  // The guard keeps this device from syncing (devices.js): said first, with the way to register it, and Push and Pull
  // are off with the reason. With the guard on, the device is named in Access → Devices, where it is registered.
  var blocked = typeof devSyncBlocked === 'function' ? devSyncBlocked() : '';
  var removed = !!blocked && typeof devRemovedRow === 'function' && !!devRemovedRow();
  var guarded = typeof devGuardOn === 'function' && devGuardOn();
  var off = blocked ? ' disabled title="' + escHtml(blocked) + '"' : '';
  return (blocked ? '<div class="inv-callout inv-callout-' + (removed ? 'danger' : 'warning') + ' inv-mb-8" data-sync-blocked>' + escHtml(blocked) +
      (removed ? '' : '<div class="inv-toolbar inv-toolbar-flush"><button type="button" class="inv-btn inv-btn-secondary inv-btn-sm" data-action="invDevGo" data-sec="devices">Register this device</button></div>') +
      '</div>' : '') +
    '<div class="inv-fields">' + field('setGhOwner', 'Owner', cfg.owner, 'rishabh1804', ' inv-id') +
      field('setGhRepo', 'Repo', cfg.repo, 'sep-invoicing-data', ' inv-id') + '</div>' +
    '<div class="inv-fields">' + field('setGhBranch', 'Branch', cfg.branch, 'main', ' inv-id') +
      field('setGhPath', 'File path', cfg.path, 'sep-invoicing-data.json', ' inv-id') + '</div>' +
    (guarded ? '<div class="inv-field"><span class="inv-field-label">This device</span><div>' + escHtml(devName()) + '</div>' +
        '<div class="inv-field-hint">Named in Access &rarr; Devices, and in the commit message of each backup it sends.</div></div>'
      : field('setGhDevice', 'This device', cfg.deviceName, 'Office desktop', '', 'Named in the commit message, so the history says which device wrote each backup.')) +

    '<div class="inv-field"><label class="inv-field-label" for="setGhToken">Personal access token</label>' +
    _sKey('setGhToken', getGhToken(), 'github_pat_...', 'invToggleGhToken', 'token') +
    '<div class="inv-field-hint">Make one fine-grained token per device, for this repository only, with <strong>Contents: Read and write</strong>, so a lost phone is cut off on GitHub by deleting its token: a token kept on a device can be used by anyone who can open this app on it. It is stored locked to this device and is never written into the book or an export.</div>' +
    (typeof devTokenStateHtml === 'function' ? '<div class="inv-field-hint" data-token-state>' + devTokenStateHtml() + '</div>' : '') + '</div>' +

    '<div class="inv-field"><label class="inv-field-check" for="setGhAuto">' +
    '<input type="checkbox" id="setGhAuto" class="inv-check"' + (cfg.autoPush ? ' checked' : '') + '>' +
    '<span>Back up automatically after changes</span></label>' +
    '<div class="inv-field-hint">Pushes about a minute after the last edit. Paused automatically if GitHub holds a copy this device has not seen.</div></div>' +

    '<div class="inv-toolbar inv-toolbar-flush">' +
      '<button class="inv-btn inv-btn-secondary" id="ghPushBtn" data-action="invGhPush"' + off + '>Push to GitHub</button>' +
      '<button class="inv-btn inv-btn-secondary" id="ghPullBtn" data-action="invGhPull"' + off + '>Pull from GitHub</button>' +
      (grdIsOwner() || !grdOn() ? '<button class="inv-btn inv-btn-secondary" id="ghReplaceBtn" data-action="invGhReplace"' + off + '>Replace from GitHub</button>' : '') +
    '</div>' +
    '<div class="inv-field-hint">A push or a pull merges: what each device changed since the last copy both saw is kept, and where two changed one thing it is held for the owner. Replace takes GitHub\'s copy whole.</div>' +
    '<div data-mrg-host>' + ghHeldHtml() + '</div>' +
    '<div class="inv-callout inv-callout-neutral inv-mt-8" id="ghSyncStatus">' +
      escHtml(_ghStatusText || (last ? 'Last synced ' + ghRelTime(last) + '.' : 'Not synced yet.')) +
    '</div>';
}

/* Called when the GitHub sync section is saved — the config has to land before a push is
   attempted, or the first push after setup goes to the previous repo. Resolves once the token is stored (locked to the
   device, devices.js). */
function saveGhSyncSettings() {
  var cfg = getGhConfig();
  var owner = document.getElementById('setGhOwner');
  var repo = document.getElementById('setGhRepo');
  var branch = document.getElementById('setGhBranch');
  var path = document.getElementById('setGhPath');
  var device = document.getElementById('setGhDevice');
  var token = document.getElementById('setGhToken');
  var auto = document.getElementById('setGhAuto');
  if (!owner) return Promise.resolve(true);

  var nextOwner = owner.value.trim();
  var nextRepo = repo ? repo.value.trim() : cfg.repo;
  var nextPath = path ? path.value.trim() : cfg.path;
  var nextBranch = branch ? branch.value.trim() : cfg.branch;

  // Pointing at a different file makes the remembered SHA meaningless, and a
  // stale SHA would let the next push overwrite a file it never read.
  if (nextOwner !== cfg.owner || nextRepo !== cfg.repo || nextPath !== cfg.path || nextBranch !== cfg.branch) {
    cfg.sha = null;
  }

  cfg.owner = nextOwner;
  cfg.repo = nextRepo;
  cfg.path = nextPath || 'sep-invoicing-data.json';
  cfg.branch = nextBranch || 'main';
  if (device) cfg.deviceName = device.value.trim();
  if (auto) cfg.autoPush = !!auto.checked;
  setGhConfig(cfg);
  _ghAutoBackoff = false;
  // Only a token changed here is written. The field is drawn from the token in memory, which is empty while the token
  // locked to the device has not been read yet (a slow start, a key that would not open): saving the device name or
  // auto-push then must not write that empty field over the stored token.
  return token && token.value.trim() !== token.defaultValue.trim() ? setGhToken(token.value.trim()) : Promise.resolve(true);
}
