import { emptyState, noSeedIM, type SepState } from './fixtures';

/* Two clients (one inactive) and three items, for the Clients / Items specs (P68). */
export function clientsState(): SepState {
  const s = emptyState();
  s.clients = [
    { id: 1, name: 'ALPHA WORKS', billingMode: 'weight', gstType: 'intra', gstin: '20AAACA1234B1Z5', address: '' },
    { id: 2, name: 'BETA PRESSINGS', billingMode: 'piece', gstType: 'intra', gstin: '', address: '' },
  ];
  (s.clients[0] as any).rates = [{ ratePerKg: 13, ratePerPiece: null, effectiveFrom: '2026-04-01' }];
  (s.clients[0] as any).isActive = true;
  (s.clients[1] as any).isActive = false;
  s.items = [
    { id: 1, partNumber: 'AAA PART', desc: 'first', hsn: '998873', unit: 'KG', rate: 2, stdWeightKg: 0.5 },
    { id: 2, partNumber: 'BBB PART', desc: 'second', hsn: '998873', unit: 'NOS', rate: 9, stdWeightKg: null },
    { id: 3, partNumber: 'CCC PART', desc: 'third', hsn: '998873', unit: 'KG', rate: 5, stdWeightKg: null },
  ];
  s.incomingMaterial = noSeedIM();
  return s;
}
