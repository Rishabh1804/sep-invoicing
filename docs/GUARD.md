# The guard: who is using the app, what they see, what they may change

**Asked by the owner, 1 Oct 2026**, while Direction B was being built:

> *"Let's add a security feature that asks for the ID and PIN on reopening, all already open sessions refresh their
> state on the next update, data updates are saved where they can be and any loss is explained. Once the app is open,
> don't ask for PIN again until P1 items or settings are changed and log every change in history. ID and PIN will
> stored as an encrypted file on the local device which can be read by the app, so we can have the remember user feature
> and tag the user appropriately. The admin ID is the only one whose data survives and all other changes made by any
> other ID merges data into it but doesn't overwrite and gives a log of changes. Once the device is registered to be able
> to push, that setup requires the presence of the admin to register a device to be able to push and pull from GitHub,
> the only way they can view data is by importing if the device is not registered."*

> *"Having an ID and password helps me to get the information of who is actually watching the app … we can have the
> owner watching the app, so we show those figures and that information which is pertinent to an owner. If a floor
> employee is using the app with his ID, then we can show the pertinent information. If the production supervisor is
> opening the app and looking at it and making changes to it, then we can have that as well. But to have all that first,
> we need a guard."*

## What the guard is for

Three gaps: nobody can tell who changed what; anyone holding a device can change a money figure; any device holding the
GitHub token can overwrite the book. And one purpose beyond them: **who is using the app decides what it shows**. Direction
B's workspaces are where that lands: a role is a set of workspaces and views, and whether it sees money.

## Decisions (defaults the owner can change in Settings → Users & access)

- **No users, no lock.** Until the owner creates their ID the app works as it does today; the guard is switched on by
  creating it. Every existing device and every spec keeps working.
- **Roles** (the owner's three people, and the billing desk): **Owner** (everything; the admin), **Office** (Today, Office,
  Add for challans and invoices; no wages, bank or margins), **Supervisor** (Today, Floor, Add for the floor's inputs; no
  money), **Floor** (Today, Floor → Day and the entries they make; no money). Each role's workspaces, views, whether it sees
  money, and what it may change are switches the owner sets. Seeing money opens Finance, Stats, Reports and the Planner (the
  Planner shows clients' ₹/kg, labour and lenders); its registers and assumptions are saved under the Settings permission.
- **A PIN or password, 4 characters or more**, checked against a salted, slow hash (PBKDF2); never stored as itself, never
  in a file the app can read without it. Five wrong tries lock that ID for 30 seconds, doubling to 15 minutes; the others
  still unlock (counted per ID since the QA chain of 2 Oct 2026: one count for the device was cleared by any ID's right PIN).
  **Remember user** remembers the ID, never the PIN. Fingerprint and face (a passkey) come after, as the faster way in.
- **When it asks**: when the app is opened fresh, and after 15 minutes in the background (a setting). **Lock now** locks
  every window on the device.
- **Asked again before a P1 change or Settings**, then not again for 5 minutes (a setting). **P1** (the owner can amend):
  issuing, editing, cancelling or deleting an invoice or a credit note, and moving an invoice's state; rates and the client
  master; voiding any record; payments, wages and wage rates, and Finance's edits; the floor's imports; Settings; users and
  devices. A role that may not make a change is told so, never asked for a PIN. **Replacing the book** (a backup imported, a
  pull from GitHub) takes its IDs with it, so it is the owner's alone, and where the incoming IDs differ the owner is asked
  whether to take them. Nothing a role decides is drawn while nobody is signed in.
- **A recovery code**, shown once when the owner's ID is created, resets a forgotten owner PIN. Without it a forgotten owner
  PIN would lock the books: one's own PIN is changed only with the PIN it has, never reset from a signed-in window, and a new
  recovery code asks the owner's PIN whatever the re-ask window.
- **Every change is logged with who made it**: worked out at each save, record by record (what was added, changed, removed,
  each changed field from → to), and shown in History. The merge (G4) reads it to say whose change stands.

## The steps

**Built** (1 Oct 2026): G1 (the gate, the change log), G2 (devices) and G3 (role views on the workspace shell). **G4, the merge, built
7 Oct 2026** (owner: *"start with 3 and 4"*; `merge.js`, P175).

1. **G1 · The gate** (P140): users and roles, the lock screen, sessions and the background lock, the recovery code, the
   P1 re-ask, Settings → Users & access, and what each role may open (the pages it may not are refused with a word).
2. **G1 · The change log** (P141): every save diffed record by record, tagged with the user and the device, in History.
3. **G2 · Devices** (P142): a device is registered when its GitHub details and its own details are entered and the owner's
   ID and PIN are checked; then a copy goes to GitHub with the device's metadata. An unregistered device does not push or
   pull; it can only import. The token is stored locked to the device, one token per device advised, so a lost phone is
   cut off on GitHub without touching the others. A device removed from the list stops syncing and forgets its token.
4. **G3 · Role views** on Direction B's shell: each role's workspaces and views, and money hidden where it may not see it.
5. **G4 · The merge** (P175): a push that finds GitHub moved, and a pull, merge the two books against the copy both last saw
   (kept on the device with its SHA) rather than one replacing the other. A change on one side is taken; where both changed
   one thing the owner's change stands (read off each side's change log), else the later one, and the other is held for the
   owner (Settings → GitHub sync → *Held for you*, To-do `mergeHeld`), who keeps it or uses the one held. A record removed
   on one side and changed on the other is kept, the removal held; two records carrying one number are held; a series takes
   the higher next number. Without a base (the first sync after the build) the old questions are asked. A merge is anyone's,
   since nothing is lost; **Replace from GitHub** stays the owner's. Built as a three-way merge of the book, not a replay of
   the change log: the log is trimmed, and the book is what both devices hold.

## What it cannot do

A web app cannot hide the book from someone holding an unlocked device with the browser's developer tools: the book is
on the device. The lock hides it from the screen and ties every change to a person. Encrypting the book itself on the
device is possible with a passkey, at the price that losing every way in and the recovery code loses the book; it is not
in these steps. The Windows widget keeps showing tasks while the app is locked.
