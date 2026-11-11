---
paths:
  - "split/bank.js"
  - "split/bills.js"
  - "split/finance.js"
  - "split/finintel.js"
  - "split/finlinks.js"
  - "split/statement.js"
  - "split/suppliers.js"
  - "split/xls.js"
  - "split/xlsx.js"
---

# Atlas route: money

Before changing one of these files, read its topics: the owner first, then the others that hold rules for it.
If your change alters behaviour a topic describes, update that topic and its `updated` line in the same PR. If you had to search for something the atlas should have routed, add the pointer (`docs/atlas/README.md`).

- `split/bank.js`: `docs/atlas/money/bank.md`
- `split/bills.js`: `docs/atlas/money/finance-and-bills.md`
- `split/finance.js`: `docs/atlas/money/finance-and-bills.md`
- `split/finintel.js`: `docs/atlas/money/bank-intelligence.md`
- `split/finlinks.js`: `docs/atlas/money/bank-intelligence.md`
- `split/statement.js`: `docs/atlas/money/bank-intelligence.md`
- `split/suppliers.js`: `docs/atlas/money/suppliers.md`
- `split/xls.js`: `docs/atlas/money/bank.md`
- `split/xlsx.js`: `docs/atlas/money/bank.md`
