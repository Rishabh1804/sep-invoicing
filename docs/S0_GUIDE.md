# S0: moving SEP Invoicing to app.somaelectro.co.in

**For the owner.** What you do, in order, to give the app its own address and move your three devices to it. The why, and how the
move works inside, are in `docs/SERVER.md` (§9, step 0) and `docs/atlas/core/new-address.md`. Nothing changes on any device until
you do step 2 on it.

**Why:** today the app, its book and its keys (the GitHub token that writes to your private codex, the Claude key, the metals.dev
key) live on `rishabh1804.github.io`, an address every GitHub Pages project of your account shares, and whose storage they share.
`app.somaelectro.co.in` is the app's alone.

Cloudflare's screens change their names now and then; where one reads differently, look for the same thing near it.

---

## 1. Create the Worker (once, on a PC, about 15 minutes)

Everything is in **your own Cloudflare account**, beside the website and the feeds Worker. The website is not touched.

1. Sign in to Cloudflare → **Workers & Pages** → **Create** → **Import a repository** (it may say *Connect to Git*). Choose GitHub
   and the repository **sep-invoicing**.
2. Fill in:

   | Field | Value |
   |---|---|
   | Project (Worker) name | **sep-app** (the name in `server/app/wrangler.toml`) |
   | Root directory (under *Advanced*) | **server/app** |
   | Build command | **bash ../../split/build.sh** |
   | Deploy command | leave it: **npx wrangler deploy** |
   | Non-production branch builds | leave on if offered: each pull request then gets a build check. Its preview address only redirects to the app, so no book is kept there |

   The import screen does not ask for a branch: it builds the repository's default branch, **main** (Settings → Build → *Branch
   control* shows it).
3. **Save and deploy.** The first build takes a few minutes. It builds the app into `dist/` and publishes only that folder: no
   `CLAUDE.md`, no `docs/`.
4. The Worker → **Settings** → **Domains & Routes** → **Add** → **Custom domain** → **app.somaelectro.co.in** → **Add domain**.
   Cloudflare makes the DNS record itself (the domain is already on your account). Allow a few minutes.
5. **Check**, in any browser:
   - `https://app.somaelectro.co.in` shows **Waiting for the book**. That is right: this browser has no book there yet.
   - `https://app.somaelectro.co.in/CLAUDE.md` and `https://app.somaelectro.co.in/docs/SERVER.md` say **404**.
   - The Worker's own address (Cloudflare shows it, `sep-app.<your-name>.workers.dev`) jumps to `app.somaelectro.co.in`.
6. **Sentry** (error reports): sentry.io → your project → **Settings** → **Security & Privacy** → **Allowed Domains**: keep
   `rishabh1804.github.io` and add **app.somaelectro.co.in** on its own line. Save.

From now on every merge to `main` deploys the new address by itself, as GitHub Pages keeps deploying the old one.

## 2. Move each device (your phone first)

Do it **in a browser tab, in the browser the app is installed in**: **Chrome on the phone, Edge on the two PCs**. Not in the
installed app's window: the move reads the old address's storage in that browser, and a browser tab keeps the two windows talking.
Before you start, make sure the device is **online** and its **GitHub sync works** (Pulse's sync card, or Settings → Connections →
GitHub sync → Push).

1. Open **rishabh1804.github.io/sep-invoicing** in a tab. If Settings → **Data & device** has no section called **The new address**,
   reload once (the newest build has it).
2. Settings → **Data & device** → **The new address**. Leave the box **Delete the keys from this address once the new one has them**
   ticked (see *The choice* below). Press **Move to the new address**, and give your PIN if asked.
3. It **pushes the book to GitHub first**. If the push fails, nothing is moved and it says why; fix the push and start again.
4. Press **Open the new address**. A second tab opens at `app.somaelectro.co.in`. If the browser says it blocked a pop-up, allow
   pop-ups for `rishabh1804.github.io` and press Move again.
5. Wait a few seconds with both tabs open. The new tab says *Receiving the book*, then opens the app. The old tab says **Moved**,
   with how many photos, settings and keys crossed. If it says **Nothing was moved**, nothing has changed on either side: read why,
   and try again or ask.
6. In the new tab: **sign in with your PIN** (a sign-in never crosses).
7. **Install the app from the new address**: Chrome on the phone → ⋮ → *Add to Home screen* / *Install app*; Edge on a PC → ⋯ →
   *Apps* → *Install this site as an app*. Then remove the old installed app (long-press its icon → *Uninstall*, or Edge → *Apps* →
   *Manage apps*). The old one would only forward to the new address now.

### On the office print station (Edge), also

- Move it as above, from an Edge tab.
- **Change its shortcut**: wherever the station opens the app at start-up (the Edge shortcut on the desktop or in the Startup
  folder: right-click → **Properties** → **Target**), replace `https://rishabh1804.github.io/sep-invoicing/` with
  **`https://app.somaelectro.co.in/`** and keep everything else on that line as it is.
- The station's mark crosses with the move: Settings at the new address still says it is the print station, and the old address
  stops being one at the same moment, so no job is printed twice. Send a test print from your phone afterwards.
- **The Windows widget** (To-do): remove it from the Widgets board and add it again from the app installed at the new address.

### The office QR sheet

Nothing to do. `checkin.html` stays on the old address, where each worker's phone keeps its card, and an office QR made at the
new address still points there. The printed sheet stays good.

## 3. Check, on each device after its move

- Home opens with your book: the same clients, challans and invoices.
- Settings → Connections → **GitHub sync**: the token says **Locked to this device**; **Push** works.
- Settings → Connections: the **Claude key** and the **metals.dev key** are there (a photo read and the zinc rate work).
- Settings → Access → **Devices**: this device is listed once, as before (it kept its id and registration).
- Knowledge: an article with a photo shows the photo.
- Pulse looks as you left it; the theme and colours are yours.
- Mine: a register page typed and not saved is still there.
- Opening `rishabh1804.github.io/sep-invoicing` on this device now lands on `app.somaelectro.co.in`.

## The choice: what is left on the old address

- **The keys** (the GitHub token, the Claude key, the metals.dev key) **are deleted from the old address as soon as the new one has
  read them back**, while the box is ticked. Getting them off the shared address is the point of S0, so this is recommended.
  Untick it only if you want a device to keep working at the old address too; then its keys stay exposed there as before.
- **The book stays on the old address** until you delete it, so you can go back. When the new address has worked for a week or so,
  on each device: open **rishabh1804.github.io/sep-invoicing/?stay=1** → Settings → Data & device → The new address →
  **Delete the copy left here**. Close the device's other tabs of the old address first. Your other GitHub Pages apps and the
  workers' check-in cards are not touched; the old address keeps forwarding.

## Rolling back

- **One device:** open **rishabh1804.github.io/sep-invoicing/?stay=1** → Settings → Data & device → The new address → **Undo the
  move**. The old address opens the copy left there again. If its keys were deleted, type them again (Settings → Connections), and
  **pull from GitHub** first so it has what the new address pushed since. Then stop using the new address on that device (Chrome or
  Edge → site settings for `app.somaelectro.co.in` → *Delete data*), so one device does not push from two places.
- **Everything:** in Cloudflare, remove the custom domain from the Worker (or delete the Worker), then undo the move on each device
  as above. Devices that were never moved are not affected at any point: the old address keeps working for them.

## Afterwards (optional, recommended)

The GitHub tokens sat on the shared address until today. Once all three devices are moved, consider replacing each: on GitHub,
make a new fine-grained token per device (Contents read and write, on the repository the app syncs to), type it at the new address
(Settings → Connections → GitHub sync), then delete the old token on GitHub. A token limited to one repository still reaches
everything in that repository, so the narrowest token is one on a repository that holds only the app's sync copy. Do the same for the Claude key (console.anthropic.com)
if you like.

## Cost

Cloudflare's free plan: the Worker serves a few files to three devices, far inside its 100,000 requests a day.
