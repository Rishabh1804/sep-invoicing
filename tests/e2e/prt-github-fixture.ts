import type { Page, Route } from '@playwright/test';

/*
 * A fake of the parts of GitHub remote printing uses (P217, P246), at the route layer, for testowner/testrepo:
 * - the Contents API on two branches: `main` (the sync branch: the print queue) and `print-status` (the station's check-in);
 *   list a folder, read raw or as JSON, put (a sha must match an existing file), delete (by sha);
 * - git refs: read a branch's head, make a branch (POST git/refs), move one (PATCH, `force`; moving print-status clears its files,
 *   as moving it back onto main does: the status file is not on main).
 * Every write is logged with its method, path, message and branch.
 */

export type File = { sha: string; text: string };
export type LogRow = { method: string; path: string; message?: string; branch?: string; body?: any };
export type GitFake = { main: Map<string, File>; status: Map<string, File>; log: LogRow[]; branches: Set<string>; heads: Record<string, string> };

let shaN = 0;

export async function fakeGitHubRepo(page: Page, opts: Partial<GitFake> = {}): Promise<GitFake> {
  const g: GitFake = {
    main: opts.main || new Map(), status: opts.status || new Map(), log: opts.log || [],
    branches: opts.branches || new Set(['main']), heads: opts.heads || { main: 'main-head-1' },
  };
  if (g.status.size) g.branches.add('print-status');
  await page.route('https://api.github.com/repos/testowner/testrepo/**', async (route: Route) => {
    const req = route.request(), url = new URL(req.url()), m = req.method();
    const rest = decodeURIComponent(url.pathname.replace(/^\/repos\/testowner\/testrepo\//, ''));
    const body = m === 'GET' ? {} : JSON.parse(req.postData() || '{}');
    const json = (status: number, b: unknown) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    if (rest.startsWith('git/')) {
      if (m !== 'GET') g.log.push({ method: m, path: rest, body });
      const head = /^git\/ref\/heads\/(.+)$/.exec(rest);
      if (m === 'GET' && head) {
        return g.branches.has(head[1]) ? json(200, { ref: 'refs/heads/' + head[1], object: { sha: g.heads[head[1]] || 'head-' + head[1] } }) : json(404, { message: 'Not Found' });
      }
      if (m === 'POST' && rest === 'git/refs') {
        const b = String(body.ref).replace(/^refs\/heads\//, '');
        if (g.branches.has(b)) return json(422, { message: 'Reference already exists' });
        g.branches.add(b); g.heads[b] = body.sha;
        return json(201, { ref: body.ref, object: { sha: body.sha } });
      }
      const patch = /^git\/refs\/heads\/(.+)$/.exec(rest);
      if (m === 'PATCH' && patch) {
        if (!g.branches.has(patch[1])) return json(422, { message: 'Reference does not exist' });
        g.heads[patch[1]] = body.sha;
        if (patch[1] === 'print-status') g.status.clear();
        return json(200, { ref: 'refs/heads/' + patch[1], object: { sha: body.sha } });
      }
      return json(405, { message: 'not faked' });
    }
    if (!rest.startsWith('contents/')) return json(404, { message: 'Not Found' });
    const path = rest.slice('contents/'.length);
    const branch = m === 'GET' ? (url.searchParams.get('ref') || 'main') : (body.branch || 'main');
    if (!g.branches.has(branch)) return json(404, { message: 'No commit found for the ref ' + branch });
    const files = branch === 'print-status' ? g.status : g.main;
    if (m === 'GET') {
      const f = files.get(path);
      if (f) {
        if ((req.headers()['accept'] || '').includes('raw')) return route.fulfill({ status: 200, contentType: 'text/plain', body: f.text });
        return json(200, { type: 'file', name: path.split('/').pop(), sha: f.sha, content: Buffer.from(f.text).toString('base64') });
      }
      const rows = [...files.keys()].filter(k => k.startsWith(path + '/')).map(k => ({ type: 'file', name: k.slice(path.length + 1), path: k, sha: files.get(k)!.sha }));
      return rows.length ? json(200, rows) : json(404, { message: 'Not Found' });
    }
    g.log.push({ method: m, path, message: body.message, branch, body: { sha: body.sha } });
    if (m === 'PUT') {
      const cur = files.get(path);
      if (cur && body.sha !== cur.sha) return json(409, { message: 'is at ' + cur.sha + ' but expected ' + body.sha });
      const sha = 'sha' + (++shaN);
      files.set(path, { sha, text: Buffer.from(body.content, 'base64').toString('utf8') });
      return json(cur ? 200 : 201, { content: { sha } });
    }
    if (m === 'DELETE') {
      const f = files.get(path);
      if (!f) return json(404, { message: 'Not Found' });
      if (f.sha !== body.sha) return json(409, { message: 'sha' });
      files.delete(path);
      return json(200, { commit: {} });
    }
    return json(405, { message: 'not faked' });
  });
  return g;
}

/** The station's check-in as the station writes it, at `at` (ms). */
export function statusText(at: number, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ kind: 'sep-print-status', v: 1, at, build: '', device: 'Office desk', lastPrinted: null, month: new Date(at).toISOString().slice(0, 7), ...extra });
}
/** A queued job's name for a time (UTC, as prtSend names it). */
export function jobName(at: number, tail = 'aaaaa'): string {
  return 'print-queue/' + new Date(at).toISOString().replace(/[-:.TZ]/g, '').slice(0, 14) + '-' + tail + '.json';
}
export function jobText(title: string, html = '<div class="inv-print-invoice">' + title + '</div>', sentBy = 'Owner · Phone'): string {
  return JSON.stringify({ kind: 'sep-print', v: 1, title, html, sentAt: Date.now(), sentBy });
}

const SYNC_KEY = 'sep_inv_github_sync', TOKEN_KEY = 'sep_inv_github_token';
/** GitHub sync set up on the device (testowner/testrepo, main, the book at the root), and any other device keys given. */
export async function seedPrtSync(page: Page, extra: Record<string, unknown> = {}): Promise<void> {
  await page.addInitScript(([syncKey, tokenKey, cfgJson, extraJson]) => {
    localStorage.setItem(syncKey as string, cfgJson as string);
    localStorage.setItem(tokenKey as string, 'github_pat_TESTTOKEN');
    const x = JSON.parse(extraJson as string);
    Object.keys(x).forEach(k => localStorage.setItem(k, JSON.stringify(x[k])));
  }, [SYNC_KEY, TOKEN_KEY, JSON.stringify({ owner: 'testowner', repo: 'testrepo', branch: 'main', path: 'sep-invoicing-data.json', deviceId: 'dev-test', deviceName: 'Office desk' }), JSON.stringify(extra)] as const);
}
