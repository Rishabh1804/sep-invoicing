import { type Page } from '@playwright/test';
import { emptyState, noSeedIM, switchTab, todayIso, type SepState } from './fixtures';

// P138's book (Floor → Day): a made-up day with marks on the four lines (VAT A1 short by one against the day's number),
// an EXTRA row on VAT A2, register runs on A1 and A2, the supervisor's barrel list, pickling loads and one power cut
// reported twice; two days back, attendance and nothing plated. Every name and part is made up; every date from today.

const pad = (n: number) => String(n).padStart(2, '0');
export const dayOff = (n: number) => { const d = new Date(todayIso() + 'T00:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
export const T = todayIso(), Y = dayOff(-1), D2 = dayOff(-2);
export const g = (p: Page, js: string) => p.evaluate(src => (0, eval)(src), js);

const NAMES = ['Alfa', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliet', 'Kilo', 'Lima', 'Mike', 'November', 'Oscar', 'Papa', 'Quebec'];
const HOME = ['vat-a1', 'vat-a1', 'vat-a1', 'vat-a2', 'vat-a2', 'vat-a2', 'vat-a2', 'barrel', 'barrel', 'barrel', 'pickling-barrel', 'pickling-barrel',
  'pickling-vat', 'pickling-vat', 'pickling-vat', 'office', 'vat-a1'];

export function floorBook(): SepState {
  const s: any = { ...emptyState(), incomingMaterial: noSeedIM() };
  const client = (id: number, name: string) => ({ id, name, billingMode: 'weight', gstType: 'intra', isActive: true, rates: [{ ratePerKg: 13, effectiveFrom: '2020-04-01' }], itemRates: [] });
  s.clients = [client(2, 'ALPHA TEST FORGINGS'), client(3, 'BETA TEST AUTO'), client(4, 'GAMMA TEST PRESS')];
  s.partWeights = { 'BRKT-1': 0.25, 'PLATE-7': 0.5, 'CLAMP 66X42 (30X6)': 0.12 };
  // VAT A1 is usually 3, but today needed 4 (Needed today): the card judges against the day's number, so A1 is short by one.
  s.areaTargets = { 'vat-a1': 3, 'vat-a2': 4, barrel: 3, 'pickling-barrel': 2, 'pickling-vat': 3 };
  s.shiftNeeds = { [T]: { 'vat-a1': 4 } };
  s.staff = NAMES.map((n, i) => ({ id: i + 1, name: n, comp: 'hourly', area: HOME[i], hourRate: 50, active: true, onFloor: HOME[i] !== 'office' }));
  const marks: any = {};
  NAMES.forEach((n, i) => { marks[i + 1] = i === 16 ? { st: 'A', area: 'flex', hours: 0, ot: 0 } : { st: 'P', area: HOME[i], hours: 8, ot: 0 }; });
  s.attendance = {
    [T]: { marks, extra: [{ kind: 'coverage', area: 'vat-a2', hours: 8 }], note: '' },
    // Two days back: attendance, and nothing plated.
    [D2]: { marks: { 1: { st: 'P', area: 'vat-a1', hours: 8 }, 2: { st: 'P', area: 'vat-a1', hours: 8 }, 8: { st: 'P', area: 'barrel', hours: 8 } }, extra: [], note: '' },
  };
  const run = (id: string, line: string, time: string, to: string, clientId: number, client: string, part: string, qty: number, rounds: number[], times: string[]) =>
    ({ id, kind: 'plated', date: T, line, lineSrc: 'written', slot: 'general', time, to, clientId, client, part, qty, unit: 'NOS', basis: 'register', src: 'photo',
      rounds: rounds.map((q, k) => ({ time: times[k], qty: q })), at: 1 });
  s.production = { pastes: [], photos: [], imports: [], learn: { clients: {}, parts: {} }, entries: [
    run('R1', 'vat-a1', '09:00', '12:30', 2, 'ALPHA', 'BRKT-1', 600, [150, 150, 150, 150], ['9:00', '10:10', '11:20', '12:30']),
    run('R2', 'vat-a1', '13:15', '14:45', 3, 'BETA', 'CLAMP 66X42 (30X6)', 270, [120, 150], ['1:15', '2:45']),
    run('R3', 'vat-a2', '10:00', '15:20', 4, 'GAMMA', 'PLATE-7', 168, [56, 56, 56], ['10:00', '12:40', '3:20']),
    // The supervisor's barrel list: the whole day, no time.
    { id: 'B1', kind: 'plated', date: T, line: 'barrel', lineSrc: 'written', slot: 'day', clientId: 3, client: 'BETA', part: 'CLAMP 66X42 (30X6)', qty: 900, unit: 'NOS', basis: 'relay', src: 'paste', at: 1 },
    { id: 'P1', kind: 'pickled', date: T, time: '09:00', clientId: 2, client: 'ALPHA', part: 'BRKT-1', qty: 400, unit: 'NOS', basis: 'pickling', src: 'paste', at: 1 },
    { id: 'P2', kind: 'pickled', date: T, time: '11:30', clientId: 3, client: 'BETA', part: 'CLAMP 66X42 (30X6)', qty: 300, unit: 'NOS', basis: 'pickling', src: 'paste', at: 1 },
    // One cut, reported by the register's power log and by the pickling hand: one cut, 11:05 to 11:17.
    { id: 'D1', kind: 'downtime', date: T, time: '11:05', to: '11:17', downtime: { cause: 'power' }, basis: 'register', src: 'photo', photoId: 'PH1', at: 1 },
    { id: 'D2', kind: 'downtime', date: T, time: '11:06', to: '11:16', downtime: { cause: 'power' }, basis: 'pickling', src: 'paste', pasteId: 'PS1', at: 1 },
  ] };
  return s as SepState;
}

/* Through its door: the Floor workspace once the shell has one, and until then as that door will open it (fixtures.ts). */
export async function openFloor(page: Page) {
  await switchTab(page, 'pageFloor');
}
export const card = (page: Page, line: string) => page.locator(`#flrLines > .inv-panel[data-line="${line}"]`);
export const tile = (page: Page, key: string) => page.locator(`#flrTiles [data-flr-tile="${key}"]`);
