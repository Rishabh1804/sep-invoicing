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
function getGhToken() { try { return localStorage.getItem(GH_TOKEN_KEY) || ''; } catch (e) { return ''; } }
function setGhToken(t) { try { localStorage.setItem(GH_TOKEN_KEY, t); } catch (e) {} }

function getGhConfig() {
  var c = loadJSON(GH_SYNC_KEY, null) || {};
  if (!c.deviceId) {
    c.deviceId = 'dev-' + Math.random().toString(36).slice(2, 8);
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
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
  } catch (err) {
    // fetch only rejects on a transport failure, which offline is.
    throw new Error('No connection to GitHub. The data is safe on this device — sync when you are back online.');
  }
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
   the ordinary first-push case and not an error. */
async function ghGetRemote(cfg) {
  var url = ghContentsUrl(cfg) + '?ref=' + encodeURIComponent(cfg.branch);
  try {
    var data = await ghRequest(url);
    var envelope = null;
    if (data && data.content) {
      try { envelope = JSON.parse(ghDecode(data.content)); } catch (e) { envelope = null; }
    }
    return { sha: data ? data.sha : null, envelope: envelope };
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
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

/* ===== PUSH ===== */
async function ghPush(opts) {
  var silent = opts && opts.silent;
  var cfg = getGhConfig();
  if (!ghIsConfigured()) {
    if (!silent) showToast('Set the GitHub repo and token in Settings first', 'error');
    return false;
  }

  ghSetBusy(true, 'Pushing');
  try {
    var remote = await ghGetRemote(cfg);

    // The SHA moved since this device last exchanged: someone else wrote.
    // Never resolve that quietly — the operator is the only one who knows
    // which copy is the real one.
    if (remote && remote.sha && remote.sha !== cfg.sha) {
      if (silent) {
        ghSetBusy(false);
        ghSetStatus('Auto-push paused: GitHub has a newer copy (' + ghDescribeEnvelope(remote.envelope) + '). Push or pull by hand.');
        return false;
      }
      var ok = confirm('GitHub already holds a copy this device has not seen — ' +
        ghDescribeEnvelope(remote.envelope) + '.\n\nPushing replaces it with this device\'s data. Continue?');
      if (!ok) { ghSetBusy(false); ghSetStatus('Push cancelled.'); return false; }
    }

    var envelope = ghBuildEnvelope(cfg);
    var body = {
      message: 'SEP Invoicing backup — ' + envelope.counts.invoices + ' invoices, ' +
        envelope.counts.challans + ' challans (' + envelope.device + ')',
      content: ghEncode(JSON.stringify(envelope, null, 2)),
      branch: cfg.branch
    };
    if (remote && remote.sha) body.sha = remote.sha;

    var result = await ghRequest(ghContentsUrl(cfg), { method: 'PUT', body: body });
    cfg.sha = result && result.content ? result.content.sha : null;
    cfg.lastPushAt = Date.now();
    setGhConfig(cfg);
    ghSetBusy(false);
    ghSetStatus('Pushed ' + formatTimestamp(cfg.lastPushAt) + '.');
    ghRenderCard();
    if (!silent) showToast('Pushed to GitHub');
    return true;
  } catch (err) {
    ghSetBusy(false);
    ghSetStatus(err.message);
    if (!silent) showToast(err.message, 'error');
    return false;
  }
}

/* ===== PULL ===== */
async function ghPull() {
  var cfg = getGhConfig();
  if (!ghIsConfigured()) { showToast('Set the GitHub repo and token in Settings first', 'error'); return false; }

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
      ghSetStatus('That file is not a SEP Invoicing backup.');
      showToast('That file is not a SEP Invoicing backup', 'error');
      return false;
    }
    if (env.schema > GH_SCHEMA) {
      ghSetBusy(false);
      ghSetStatus('That backup was written by a newer version of the app.');
      showToast('Backup is from a newer app version', 'error');
      return false;
    }

    var mine = (S.invoices || []).length + ' invoices, ' + (S.incomingMaterial || []).length + ' challans';
    if (!confirm('Replace ALL data on this device with ' + ghDescribeEnvelope(env) + '?\n\n' +
        'This device currently holds ' + mine + '. That is discarded.')) {
      ghSetBusy(false);
      ghSetStatus('Pull cancelled.');
      return false;
    }

    S = env.state;
    // Same repairs the loader applies, so a backup written before a field
    // existed cannot land the app in a broken state.
    if (!S.invoices) S.invoices = [];
    if (!S.incomingMaterial) S.incomingMaterial = [];
    if (!S.partWeights) S.partWeights = {};
    if (!S.voidedNumbers) S.voidedNumbers = [];
    saveState();

    cfg.sha = remote.sha;
    cfg.lastPullAt = Date.now();
    setGhConfig(cfg);

    ghSetBusy(false);
    ghSetStatus('Pulled ' + formatTimestamp(cfg.lastPullAt) + '.');
    closeOverlay();
    _tabDirty.home = true;
    _tabDirty.register = true;
    _regToolbarRendered = false;
    _imToolbarRendered = false;
    switchTab('pageHome');
    showToast('Pulled from GitHub');
    return true;
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
  var cfg = getGhConfig();
  if (!cfg.autoPush || !ghIsConfigured() || _ghAutoBackoff) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  clearTimeout(_ghPushTimer);
  _ghPushTimer = setTimeout(function() {
    ghPush({ silent: true }).then(function(ok) {
      // One failure stops the timer re-arming forever in the background;
      // a manual push clears it.
      if (!ok) _ghAutoBackoff = true;
    });
  }, GH_AUTOPUSH_DELAY);
}

/* ===== STATUS SURFACE ===== */
var _ghStatusText = '';
var _ghBusy = false;

function ghSetStatus(text) {
  _ghStatusText = text || '';
  var el = document.getElementById('ghSyncStatus');
  if (el) el.textContent = _ghStatusText;
  ghRenderCard();
}

function ghSetBusy(busy, label) {
  _ghBusy = busy;
  if (busy) _ghAutoBackoff = false;
  var el = document.getElementById('ghSyncStatus');
  if (el && busy) el.textContent = (label || 'Working') + '…';
  ['ghPushBtn', 'ghPullBtn'].forEach(function(id) {
    var b = document.getElementById(id);
    if (b) b.disabled = busy;
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
  if (!ghIsConfigured()) { host.innerHTML = ''; return; }

  var cfg = getGhConfig();
  var last = ghLastSyncAt();
  // Anything past a working day without a push is worth flagging on a device
  // whose only other copy is the localStorage it is sitting in.
  var stale = !last || (Date.now() - last) > 86400000;

  host.innerHTML = '<div class="inv-card inv-sync-card">' +
    '<div class="inv-flex-between">' +
      '<div class="inv-sync-meta">' +
        '<div class="inv-sync-label">GitHub backup' +
          (stale ? '<span class="inv-sync-stale">stale</span>' : '') + '</div>' +
        '<div class="inv-sync-repo inv-mono">' + escHtml(cfg.owner + '/' + cfg.repo) + '</div>' +
        '<div class="inv-sync-time">Last synced ' + escHtml(ghRelTime(last)) + '</div>' +
      '</div>' +
      '<button class="inv-btn inv-btn-ghost inv-btn-sm" data-action="invGhPush"' + (_ghBusy ? ' disabled' : '') + '>' +
        (_ghBusy ? 'Syncing…' : 'Back up now') + '</button>' +
    '</div></div>';
}

/* ===== SETTINGS SECTION ===== */
function renderGhSyncSettings() {
  var cfg = getGhConfig();
  var last = ghLastSyncAt();
  return '<div class="inv-settings-section"><div class="inv-settings-title">GitHub Sync</div>' +
    '<div class="inv-form-row">' +
      '<div class="inv-form-group"><label class="inv-form-label" for="setGhOwner">Owner</label>' +
      '<input class="inv-form-input inv-mono" id="setGhOwner" value="' + escHtml(cfg.owner) + '" placeholder="rishabh1804" autocomplete="off"></div>' +
      '<div class="inv-form-group"><label class="inv-form-label" for="setGhRepo">Repo</label>' +
      '<input class="inv-form-input inv-mono" id="setGhRepo" value="' + escHtml(cfg.repo) + '" placeholder="sep-invoicing-data" autocomplete="off"></div>' +
    '</div>' +
    '<div class="inv-form-row">' +
      '<div class="inv-form-group"><label class="inv-form-label" for="setGhBranch">Branch</label>' +
      '<input class="inv-form-input inv-mono" id="setGhBranch" value="' + escHtml(cfg.branch) + '" placeholder="main" autocomplete="off"></div>' +
      '<div class="inv-form-group"><label class="inv-form-label" for="setGhPath">File path</label>' +
      '<input class="inv-form-input inv-mono" id="setGhPath" value="' + escHtml(cfg.path) + '" placeholder="sep-invoicing-data.json" autocomplete="off"></div>' +
    '</div>' +
    '<div class="inv-form-group"><label class="inv-form-label" for="setGhDevice">This device</label>' +
    '<input class="inv-form-input" id="setGhDevice" value="' + escHtml(cfg.deviceName) + '" placeholder="Office desktop" autocomplete="off">' +
    '<div class="inv-text-muted inv-storage-text">Named in the commit message, so the history says which device wrote each backup.</div></div>' +

    '<div class="inv-form-group"><label class="inv-form-label" for="setGhToken">Personal access token</label>' +
    '<div class="inv-api-key-wrap"><input class="inv-form-input inv-mono" id="setGhToken" type="password" value="' + escHtml(getGhToken()) + '" placeholder="github_pat_..." autocomplete="off">' +
    '<button class="inv-api-key-toggle" data-action="invToggleGhToken" type="button" aria-label="Show token">' +
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></div>' +
    '<div class="inv-text-muted inv-storage-text">A fine-grained token with <strong>Contents: Read and write</strong> on one private repo is enough — nothing wider. It stays on this device and is never written into a JSON export. Anyone with access to this device can read it, so use a private repo and revoke the token if the device is lost.</div></div>' +

    '<label class="inv-check-row" for="setGhAuto">' +
    '<input type="checkbox" id="setGhAuto" class="inv-check"' + (cfg.autoPush ? ' checked' : '') + '>' +
    '<span>Back up automatically after changes</span></label>' +
    '<div class="inv-text-muted inv-storage-text inv-mb-8">Pushes about a minute after the last edit. Paused automatically if GitHub holds a copy this device has not seen.</div>' +

    '<div class="inv-form-row">' +
      '<button class="inv-btn inv-btn-ghost inv-btn-block" id="ghPushBtn" data-action="invGhPush">Push to GitHub</button>' +
      '<button class="inv-btn inv-btn-ghost inv-btn-block" id="ghPullBtn" data-action="invGhPull">Pull from GitHub</button>' +
    '</div>' +
    '<div class="inv-sync-status" id="ghSyncStatus">' +
      escHtml(_ghStatusText || (last ? 'Last synced ' + ghRelTime(last) + '.' : 'Not synced yet.')) +
    '</div></div>';
}

/* Called from saveSettings() — the config has to land before a push is
   attempted, or the first push after setup goes to the previous repo. */
function saveGhSyncSettings() {
  var cfg = getGhConfig();
  var owner = document.getElementById('setGhOwner');
  var repo = document.getElementById('setGhRepo');
  var branch = document.getElementById('setGhBranch');
  var path = document.getElementById('setGhPath');
  var device = document.getElementById('setGhDevice');
  var token = document.getElementById('setGhToken');
  var auto = document.getElementById('setGhAuto');
  if (!owner) return;

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
  if (token) setGhToken(token.value.trim());
  _ghAutoBackoff = false;
}
