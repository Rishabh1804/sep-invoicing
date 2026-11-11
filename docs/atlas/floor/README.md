# Atlas: floor

Production, the plant, stock, power, shifts, the entry faces and the planner.

Route: `CLAUDE.md` → `docs/atlas/INDEX.md` → this file → a topic → the code, spec and tests it names.

| Topic | Covers | Its modules | KB |
|---|---|---|---:|
| [Production](production.md) | Production | `production.js`, `prodview.js` | 23.1 |
| [Production readers: slots as text, the barrel list, the night block](production-readers.md) | Production typed as text, a slot a line; The barrel list by batch; The night block's production | `prodparse.js` | 4.1 |
| [A day's plating whole, and what a line earned](day-plating.md) | A day's plating, whole; What a line earned, against its cost and its usual day | — | 15.6 |
| [Workers and the plant](workers-and-plant.md) | Workers and the plant | `checkin.js`, `idcard.js`, `people.js`, `plant.js`, `qr.js` | 9.3 |
| [The planner](planner.md) | The planner | `planner.js`, `planview.js` | 7.2 |
| [Power](power.md) | Power | `power.js`, `powercause.js` | 11.3 |
| [Stock](stock.md) | Stock | `cost.js`, `stock.js` | 8.1 |
| [Entry faces](entry-faces.md) | Entry faces | `faces.js`, `facesheet.js`, `flow.js` | 23.7 |
| [Stock: on paper, entries checked, messages, by line, reorder](stock-more.md) | Stock on paper; Stock entries checked before believed; Stock messages of October 2026; Stock by line; Stock reorder list | `stocksheet.js` | 8.7 |
| [Shifts by line: the night shift](shifts.md) | Shifts by line: the night shift | `shifts.js` | 6.6 |
