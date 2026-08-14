#!/usr/bin/env python3
"""
Generates per-part Test Certificate (ZN Plating) HTML files for SOMA Electro Products.

SUPERSEDED — the app generates these itself now (split/quality-cert.js, Register →
Quality Cert). Kept as the provenance of the format: the JSON here and the rendered
PDFs are what the app's QC_SHOP_DATA was transcribed from, and they are the evidence
that the text matches the TML-approved 04/02/26 reference. Do not resume issuing
certificates from this script — it has no access to the invoice register, so nothing
it prints is tied to a document the customer holds.

Source of truth (so the SEP Invoicing app can consume the same data later):
- cert-shop-data.json  : immutable shop-level data (company, processes, chemicals,
                         specs). Field values transcribed verbatim from the
                         TML-approved 04/02/26 reference cert; original-document
                         typos are preserved (Tata Motors QA approval is bound to
                         exact text).
- cert-issues.json     : per-issue / per-batch data (date, customer, invoice,
                         challan, parts list). Append a new entry here when a new
                         batch is dispatched.

Output: one print-ready A4 HTML file per part per issue, plus PDFs rendered via
headless Chromium when invoked with --pdf.

Usage:
    python3 generate.py            # HTML only
    python3 generate.py --pdf      # HTML + PDF
"""

import json
import os
import re
import subprocess
import sys

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
SHOP_DATA_PATH = os.path.join(OUT_DIR, "cert-shop-data.json")
ISSUES_PATH = os.path.join(OUT_DIR, "cert-issues.json")

CSS = """
@page { size: A4; margin: 5mm 8mm; }
* { box-sizing: border-box; }
body {
  font-family: 'Helvetica Neue', Arial, sans-serif;
  font-size: 8pt; color: #000; margin: 0; padding: 0;
  background: #fff; line-height: 1.25;
}
.tc-header { display: flex; align-items: center; gap: 5mm; padding-bottom: 1mm; }
.tc-logo {
  font-family: 'Georgia', 'Times New Roman', serif;
  font-size: 24pt; font-weight: 700; color: #2e7d4f;
  letter-spacing: 1px; line-height: 1; flex: 0 0 auto;
  padding: 2mm 4mm; border: 2pt solid #2e7d4f; border-radius: 50%;
}
.tc-letterhead { flex: 1; text-align: center; line-height: 1.25; }
.tc-company { font-family: 'Georgia', serif; font-size: 13pt; font-weight: 700; font-style: italic; }
.tc-addr, .tc-contact { font-size: 7.5pt; }
.tc-title {
  text-align: center; font-weight: 700; font-size: 10pt;
  border-top: 1pt solid #000; border-bottom: 1pt solid #000;
  padding: 1mm 0; margin: 1.5mm 0; letter-spacing: 0.5px;
}
.tc-meta-row {
  display: flex; justify-content: space-between;
  font-size: 8pt; padding: 0 1mm 0.8mm 1mm;
}
table.tc-grid { width: 100%; border-collapse: collapse; }
table.tc-grid th, table.tc-grid td {
  border: 0.5pt solid #000; padding: 0.6mm 1.2mm;
  vertical-align: top; font-size: 7.6pt; line-height: 1.2;
}
table.tc-grid th {
  background: #ececec; text-align: left; font-weight: 700;
}
table.tc-grid th .supplier-sub { font-weight: 700; display: block; font-size: 7.6pt; }
.tc-customer td { font-size: 7.8pt; }
.tc-customer .label { font-weight: 700; width: 14%; }
.tc-customer .value { width: 36%; }
.tc-section {
  background: #ececec; font-weight: 700; font-size: 8pt;
  padding: 0.8mm 2mm; border: 0.5pt solid #000;
  margin-top: 1.5mm;
}
.tc-section .tc-sub-rule { font-weight: 400; font-size: 7pt; }
table.tc-grid.tc-no-top { border-top: 0; }
.tc-cell-c { text-align: center; }
.tc-sub { font-size: 7pt; font-style: italic; color: #333; }
.tc-notes { margin: 1.5mm 0 1mm 0; font-size: 7.5pt; line-height: 1.3; padding: 0 1mm; }
.tc-notes div { margin-bottom: 0.4mm; }
.tc-disclaimer {
  margin-top: 1mm; font-size: 7.5pt; font-style: italic; padding: 0 1mm;
}
.tc-footer {
  display: flex; justify-content: space-between; align-items: flex-end;
  margin-top: 2.5mm; padding-top: 1.5mm; border-top: 0.5pt solid #000;
  font-size: 7.5pt; page-break-inside: avoid;
}
.tc-footer .tc-addr-block { line-height: 1.3; }
.tc-footer .tc-sig {
  text-align: right; font-weight: 700; padding-bottom: 0.5mm;
}
.tc-footer .tc-sig .tc-attribution { font-weight: 400; font-style: italic; display: block; margin-bottom: 6mm; }
"""


def render_section1_rows(rows):
    out = []
    for r in rows:
        out.append(
            "    <tr>"
            f"<td class=\"tc-cell-c\">{r['sl']}</td>"
            f"<td>{r['process']}</td>"
            f"<td>{r['supplierAChemicals']}</td>"
            f"<td class=\"tc-cell-c\">{r['supplierAObs']}</td>"
            f"<td>{r['supplierBChemicals']}</td>"
            f"<td class=\"tc-cell-c\">{r['supplierBObs']}</td>"
            "</tr>"
        )
    return "\n".join(out)


def render_section2_rows(rows):
    out = []
    for r in rows:
        out.append(
            "    <tr>"
            f"<td class=\"tc-cell-c\">{r['sl']}</td>"
            f"<td>{r['criticalParameter']}</td>"
            f"<td class=\"tc-cell-c\">{r['observation']}</td>"
            f"<td class=\"tc-cell-c\">{r['specification']}</td>"
            f"<td>{r['equipment']}</td>"
            "</tr>"
        )
    return "\n".join(out)


def render_section3_rows(rows):
    out = []
    for r in rows:
        out.append(
            "    <tr>"
            f"<td class=\"tc-cell-c\">{r['sl']}</td>"
            f"<td>{r['criticalParameter']}</td>"
            f"<td class=\"tc-cell-c\">{r['observation']}</td>"
            f"<td>{r['specification']}</td>"
            f"<td class=\"tc-cell-c\">{r['percentDefective']}</td>"
            f"<td>{r['equipment']}</td>"
            "</tr>"
        )
    return "\n".join(out)


def render_sampling_rows(rows):
    out = []
    for row in rows:
        cells = "".join(f"<td class=\"tc-cell-c\">{c}</td>" for c in row)
        out.append(f"    <tr>{cells}</tr>")
    return "\n".join(out)


def render_notes(notes):
    return "\n".join(f"  <div>{n}</div>" for n in notes)


def render_cert(shop, issue, part):
    company = shop["company"]
    fixed = shop["fixed"]
    s1 = shop["section1"]
    s2 = shop["section2"]
    s3 = shop["section3"]

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Test Certificate &mdash; {part['partNo']}</title>
<style>{CSS}</style>
</head>
<body>

<div class="tc-header">
  <div class="tc-logo">soma</div>
  <div class="tc-letterhead">
    <div class="tc-company">{company['name']}</div>
    <div class="tc-addr">{company['headerAddress']}</div>
    <div class="tc-contact">Phone : {company['phone']} &nbsp; Mobile : {company['mobile']} &nbsp; E-Mail : {company['email']}</div>
  </div>
</div>

<div class="tc-title">{shop['title']}</div>

<div class="tc-meta-row">
  <span>Sr. No.: ____________</span>
  <span>Date: {issue['issueDate']}</span>
</div>

<table class="tc-grid tc-customer">
  <tr>
    <td class="label">Customer Name</td>
    <td class="value">{issue['customer']['name']}</td>
    <td class="label">Invoice No.</td>
    <td class="value">{issue['invoiceNo']}</td>
  </tr>
  <tr>
    <td class="label">Address</td>
    <td class="value">{issue['customer']['address']}</td>
    <td class="label">Purchase Order Ref :</td>
    <td class="value">{issue.get('purchaseOrderRef') or '&ndash;'}</td>
  </tr>
  <tr>
    <td class="label">Job Description</td>
    <td class="value">{fixed['jobDescription']}</td>
    <td class="label">Challan No. Ref.</td>
    <td class="value">{issue['challanNo']}</td>
  </tr>
  <tr>
    <td class="label">Process Reg.</td>
    <td class="value">{fixed['processReg']}</td>
    <td class="label">Challan Date</td>
    <td class="value">{issue['challanDate']}</td>
  </tr>
  <tr>
    <td class="label">Process Qualified by TML</td>
    <td class="value">{fixed['qualifiedByTML']}</td>
    <td class="label">Quantity</td>
    <td class="value">{part['qty']}</td>
  </tr>
  <tr>
    <td class="label">Process Qualified By Tata Steel Ltd.</td>
    <td class="value">{fixed['qualifiedByTataSteelLtd']}</td>
    <td class="label">Part No.</td>
    <td class="value"><strong>{part['partNo']}</strong></td>
  </tr>
  <tr>
    <td class="label">Net Wt.</td>
    <td class="value">{fixed['netWt']}</td>
    <td class="label">Category</td>
    <td class="value">{fixed['category']}</td>
  </tr>
</table>

<div class="tc-section">
  {s1['heading']}
  <span class="tc-sub-rule">{s1['subHeading']}</span>
</div>
<table class="tc-grid tc-no-top">
  <thead>
    <tr>
      <th style="width:5%">Sl. No.</th>
      <th style="width:21%">Process Sequence</th>
      <th style="width:30%">Chemical Name<span class="supplier-sub">{s1['supplierA']}</span></th>
      <th style="width:7%" class="tc-cell-c">Observation</th>
      <th style="width:30%">Chemical Name<span class="supplier-sub">{s1['supplierB']}</span></th>
      <th style="width:7%" class="tc-cell-c">Observation</th>
    </tr>
  </thead>
  <tbody>
{render_section1_rows(s1['rows'])}
  </tbody>
</table>

<div class="tc-section">{s2['heading']}</div>
<table class="tc-grid tc-no-top">
  <thead>
    <tr>
      <th style="width:5%">Sl. No.</th>
      <th style="width:30%">Critical Parameters</th>
      <th style="width:18%" class="tc-cell-c">Observation (Min &amp; Max)</th>
      <th style="width:18%" class="tc-cell-c">Specification</th>
      <th style="width:29%">Equipment / Gauge Used</th>
    </tr>
  </thead>
  <tbody>
{render_section2_rows(s2['rows'])}
  </tbody>
</table>

<div class="tc-section">{s3['heading']}</div>
<table class="tc-grid tc-no-top">
  <thead>
    <tr>
      <th style="width:5%">Sl. No.</th>
      <th style="width:22%">Critical Parameter</th>
      <th style="width:8%" class="tc-cell-c">Observation</th>
      <th style="width:36%">Specification</th>
      <th style="width:8%" class="tc-cell-c">% Defective</th>
      <th style="width:21%">Equipment / Gauge Used</th>
    </tr>
  </thead>
  <tbody>
{render_section3_rows(s3['rows'])}
  </tbody>
</table>

<div class="tc-notes">
{render_notes(shop['notes'])}
</div>

<table class="tc-grid">
  <thead>
    <tr>
      <th class="tc-cell-c">LOT SIZE</th><th class="tc-cell-c">SAMPLE SIZE</th>
      <th class="tc-cell-c">LOT SIZE</th><th class="tc-cell-c">SAMPLE SIZE</th>
      <th class="tc-cell-c">LOT SIZE</th><th class="tc-cell-c">SAMPLE SIZE</th>
    </tr>
  </thead>
  <tbody>
{render_sampling_rows(shop['samplingTable'])}
  </tbody>
</table>

<div class="tc-disclaimer">{shop['disclaimer']}</div>

<div class="tc-footer">
  <div class="tc-addr-block">
    <strong>{company['name']}</strong><br>
    {company['footerAddress']}<br>
    GSTIN : {company['gstin']}
  </div>
  <div class="tc-sig">
    <span class="tc-attribution">{company['footerAttribution']}</span>
    Authorised Signatory
  </div>
</div>

</body>
</html>
"""


def safe_filename(part_no):
    return re.sub(r"\s+", "-", part_no.strip())


def issue_date_to_iso(s):
    # "15/04/26" → "2026-04-15"
    parts = s.split("/")
    if len(parts) == 3:
        dd, mm, yy = parts
        yyyy = "20" + yy if len(yy) == 2 else yy
        return f"{yyyy}-{mm}-{dd}"
    return s


def main():
    with open(SHOP_DATA_PATH) as f:
        shop = json.load(f)
    with open(ISSUES_PATH) as f:
        issues = json.load(f)

    written_html = []
    for issue in issues:
        iso = issue_date_to_iso(issue["issueDate"])
        for part in issue["parts"]:
            fname = f"{iso}_{safe_filename(part['partNo'])}.html"
            out_path = os.path.join(OUT_DIR, fname)
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(render_cert(shop, issue, part))
            written_html.append(out_path)
            print(out_path)

    if "--pdf" in sys.argv:
        # Render PDFs via headless Chromium (uses Playwright if available; falls
        # back to Chromium directly).
        node_script = """
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
(async () => {
  const inputs = process.argv.slice(2);
  const browser = await chromium.launch();
  for (const html of inputs) {
    const page = await browser.newPage();
    await page.goto('file://' + html, { waitUntil: 'networkidle' });
    await page.pdf({
      path: html.replace(/\\.html$/, '.pdf'),
      format: 'A4', printBackground: true,
      margin: { top: '5mm', right: '8mm', bottom: '5mm', left: '8mm' },
    });
    await page.close();
  }
  await browser.close();
})();
"""
        # Resolve playwright module from the repo's node_modules.
        repo_root = os.path.abspath(os.path.join(OUT_DIR, "..", ".."))
        env = os.environ.copy()
        env["NODE_PATH"] = os.path.join(repo_root, "node_modules")
        subprocess.run(
            ["node", "-e", node_script, *written_html],
            check=True, env=env, cwd=repo_root,
        )
        for h in written_html:
            print(h.replace(".html", ".pdf"))


if __name__ == "__main__":
    main()
