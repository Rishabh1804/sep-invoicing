#!/usr/bin/env python3
"""
Generates per-part Test Certificate (ZN Plating) HTML files for SOMA Electro Products.

Format mirrors the TML-approved certificate PDF format used historically. Each output
is a standalone, print-ready A4 HTML document. Open in a browser and print/save-as-PDF.

Re-run after editing the PARTS list or shared metadata block to regenerate outputs.
"""

import os
import re
from datetime import date

# ---- per-batch metadata -----------------------------------------------------

CUSTOMER_NAME = "SSSMehta Industries Ltd."
CUSTOMER_ADDRESS_LINES = [
    "A-4, Road No. 2, Industrial Estate,",
    "ADITYAPUR, JAMSHEDPUR-832109",
]

INVOICE_NO = "137"
CHALLAN_NO = "94"
CHALLAN_DATE = "15-04-2026"   # dd-mm-yyyy as per template
CERT_DATE = "15/04/26"        # short form shown top-right
CATEGORY = "Sheet Metal / HR"
NET_WT = "0.000"

JOB_DESCRIPTION = "ZN : Plating with Fe/Zn8/KA / R8 / RC / RCBJY"
PROCESS_REG = "As Per JAQADJF8JZ of TATA MOTORS LTD"
PROCESS_QUALIFIED_TML = "Yes"
PROCESS_QUALIFIED_TATASTEEL = "Yes"

PARTS = [
    {"part_no": "5081 3240 4207N", "qty": "20.000"},
    {"part_no": "5069 3240 4202N", "qty": "20.000"},
    {"part_no": "2632 3240 4209N", "qty": "20.000"},
    {"part_no": "2082 3240 4202",  "qty": "40.000"},
]

OUT_DIR = os.path.dirname(os.path.abspath(__file__))

# ---- shared cert body (chemistry / inspection / sampling) -------------------

CHEMICAL_ROWS = [
    # (slno, process, obs_left, chem_left, obs_right, chem_right)
    ("01", "Soak Greasing",
     "OK", "Unisole NL / Super Soak",
     "OK", "Steeles K&nbsp;&ndash;&nbsp;20"),
    ("02", "Derusting",
     "OK", "i)&nbsp;HCL Commercial Grade or<br>ii)&nbsp;Sulphuric Acid Commercial Grade",
     "OK", "i)&nbsp;HCL Commercial Grade or<br>ii)&nbsp;Sulphuric Acid Commercial Grade"),
    ("03", "Anodic Electrolytic Cleaning",
     "OK", "Cleaner SE-11 / Unicleaner 266",
     "OK", "Ginhood R12"),
    ("04", "Cyanide / Acid Dip",
     "OK", "Sodium Cyanide / Hydrochloric Acid",
     "OK", "Sodium Cyanide / Hydrochloric Acid"),
    ("05", "Zinc Plating Bath&nbsp;I<br><span class=\"tc-sub\">Cyanide based Zinc Bath</span>",
     "&mdash;",
     "Zinc Metal (99.99% Pure)<br>Zintek Salt &ndash; S01<br>Bho () &ndash; 555 / Unicol &ndash; A Purifier",
     "&mdash;",
     "Zinc Metal (99.99% Pure)<br>Zintek Salt &ndash; 7T Salt /<br>Zintek Adddtv ZN&nbsp;21M /"),
    ("06", "Zinc Plating Bath&nbsp;II<br><span class=\"tc-sub\">Acid based Zinc / Chloride Bath and or Barrel</span>",
     "&mdash;",
     "Acid Zinc Salt No.&nbsp;1 (A)<br>Acid Zinc Salt No. (B)<br>Zylite MR Additive (M)<br>Zylite MB Brightener (B)",
     "&mdash;",
     "47 Brightener / Monocyl Purifier<br>Zinthe Brite NTX, Zinthe BNS<br>Zinthe Brite ZN&nbsp;21M / TMI, Zin Z1R/J1R"),
    ("07", "Neutralisation",
     "OK", "Nitric Acid Dip",
     "OK", "Nitric Acid Dip"),
    ("08", "Passivation",
     "OK", "Unimax OG 40 / Redgeprod (OGP)",
     "OK", "Ginzia Fix Olive 952 / 952&nbsp;M"),
]

SAMPLING_ROWS = [
    ("Up to 10", "100%", "21 to 50",   "20%", "100 &amp; Above", "5%"),
    ("11 to 20", "50%",  "51 to 100", "10%", "",                  ""),
]

# ---- template ---------------------------------------------------------------

CSS = """
@page { size: A4; margin: 8mm 10mm; }
* { box-sizing: border-box; }
body {
  font-family: 'Helvetica Neue', Arial, sans-serif;
  font-size: 9pt; color: #000; margin: 0; padding: 6mm 8mm;
  background: #fff;
}
.tc-header { display: flex; align-items: center; gap: 6mm; padding-bottom: 2mm; }
.tc-logo {
  font-family: 'Georgia', 'Times New Roman', serif;
  font-size: 30pt; font-weight: 700; color: #b34a2a;
  letter-spacing: 1px; line-height: 1; flex: 0 0 auto;
}
.tc-letterhead { flex: 1; text-align: center; line-height: 1.25; }
.tc-company { font-family: 'Georgia', serif; font-size: 14pt; font-weight: 700; }
.tc-addr { font-size: 8pt; }
.tc-contact { font-size: 8pt; }
.tc-title {
  text-align: center; font-weight: 700; font-size: 11pt;
  border-top: 1.2pt solid #000; border-bottom: 1.2pt solid #000;
  padding: 1.5mm 0; margin: 2mm 0 2mm 0; letter-spacing: 0.5px;
}
.tc-meta-row {
  display: flex; justify-content: space-between;
  font-size: 8.5pt; padding: 0 1mm 1mm 1mm;
}
table.tc-grid { width: 100%; border-collapse: collapse; }
table.tc-grid th, table.tc-grid td {
  border: 0.6pt solid #000; padding: 1mm 1.5mm;
  vertical-align: top; font-size: 8.5pt;
}
table.tc-grid th { background: #ececec; text-align: left; font-weight: 700; }
.tc-customer td { font-size: 8.5pt; }
.tc-customer .label { font-weight: 700; width: 14%; }
.tc-customer .value { width: 36%; }
.tc-section {
  background: #ececec; font-weight: 700; font-size: 9pt;
  padding: 1.2mm 2mm; border: 0.6pt solid #000;
  border-top: 0.6pt solid #000; margin-top: 2.5mm;
}
.tc-section span.tc-sub-rule { font-weight: 400; font-size: 7.5pt; }
table.tc-grid.tc-no-top { border-top: 0; }
.tc-cell-c { text-align: center; }
.tc-sub { font-size: 7.5pt; font-style: italic; color: #333; }
.tc-notes { margin: 2mm 0 1mm 0; font-size: 8pt; line-height: 1.4; padding: 0 1mm; }
.tc-notes ol { padding-left: 5mm; margin: 0; }
.tc-disclaimer {
  margin-top: 2mm; font-size: 8pt; font-style: italic; padding: 0 1mm;
}
.tc-footer {
  display: flex; justify-content: space-between; align-items: flex-end;
  margin-top: 4mm; padding-top: 2mm; border-top: 0.6pt solid #000;
  font-size: 8pt;
}
.tc-footer .tc-addr-block { line-height: 1.3; }
.tc-footer .tc-sig {
  text-align: right; font-weight: 700; padding-bottom: 1mm;
}
@media print {
  body { padding: 0; }
}
"""

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Test Certificate &mdash; {part_no_safe}</title>
<style>{css}</style>
</head>
<body>

<div class="tc-header">
  <div class="tc-logo">soma</div>
  <div class="tc-letterhead">
    <div class="tc-company">SOMA ELECTRO PRODUCTS</div>
    <div class="tc-addr">B-8, 1st Phase, Industrial Area, Adityapur, Jamshedpur &ndash; 832 109</div>
    <div class="tc-contact">Phone: 8210063228 &nbsp;&nbsp; Email: rkjain12@rediffmail.com</div>
  </div>
</div>

<div class="tc-title">TEST CERTIFICATE (ZN PLATING)</div>

<div class="tc-meta-row">
  <span>Sr. No.: ____________</span>
  <span>Date: {cert_date}</span>
</div>

<table class="tc-grid tc-customer">
  <tr>
    <td class="label">Customer Name</td>
    <td class="value">{customer_name}</td>
    <td class="label">Invoice No.</td>
    <td class="value">{invoice_no}</td>
  </tr>
  <tr>
    <td class="label">Address</td>
    <td class="value">{customer_address}</td>
    <td class="label">Purchase Order Ref.</td>
    <td class="value">&ndash;</td>
  </tr>
  <tr>
    <td class="label">Job Description</td>
    <td class="value">{job_description}</td>
    <td class="label">Challan No. Ref.</td>
    <td class="value">{challan_no}</td>
  </tr>
  <tr>
    <td class="label">Process Reg.</td>
    <td class="value">{process_reg}</td>
    <td class="label">Challan Date</td>
    <td class="value">{challan_date}</td>
  </tr>
  <tr>
    <td class="label">Part No.</td>
    <td class="value"><strong>{part_no}</strong></td>
    <td class="label">Qty</td>
    <td class="value">{qty}</td>
  </tr>
  <tr>
    <td class="label">Net Wt.</td>
    <td class="value">{net_wt}</td>
    <td class="label">Category</td>
    <td class="value">{category}</td>
  </tr>
  <tr>
    <td class="label">Process Qualified by TML</td>
    <td class="value">{q_tml}</td>
    <td class="label">Process Qualified by Tata Steel Ltd.</td>
    <td class="value">{q_tatasteel}</td>
  </tr>
</table>

<div class="tc-section">
  01.&nbsp;&nbsp;Inspection of the Chemicals Used
  <span class="tc-sub-rule">(Please tick the Appropriate Column &amp; Attach Relevant doc as per IS:&nbsp;277-2018)</span>
</div>
<table class="tc-grid tc-no-top">
  <thead>
    <tr>
      <th style="width:6%">Sl.&nbsp;No.</th>
      <th style="width:24%">Process Sequence</th>
      <th style="width:8%" class="tc-cell-c">Obs.</th>
      <th style="width:30%">Chemical Used (SOMA)</th>
      <th style="width:8%" class="tc-cell-c">Obs.</th>
      <th style="width:24%">Specification (Approved)</th>
    </tr>
  </thead>
  <tbody>
{chemical_rows}
  </tbody>
</table>

<div class="tc-section">02.&nbsp;&nbsp;Product Inspection</div>
<table class="tc-grid tc-no-top">
  <thead>
    <tr>
      <th style="width:6%">Sl.&nbsp;No.</th>
      <th style="width:32%">Critical Parameters</th>
      <th style="width:18%" class="tc-cell-c">Observation (Min &amp; Max)</th>
      <th style="width:18%" class="tc-cell-c">Specification</th>
      <th style="width:26%">Equipment / Gauge Used</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="tc-cell-c">01</td>
      <td>Plating Thickness <span class="tc-sub">(Check as per sampling plan given at the end)</span></td>
      <td class="tc-cell-c">10&ndash;12</td>
      <td class="tc-cell-c">TRIYELLOW</td>
      <td>DIGITAL ELCO METER</td>
    </tr>
  </tbody>
</table>

<div class="tc-section">03.&nbsp;&nbsp;FINAL COATING (100% Testing)</div>
<table class="tc-grid tc-no-top">
  <thead>
    <tr>
      <th style="width:6%">Sl.&nbsp;No.</th>
      <th style="width:24%">Critical Parameters</th>
      <th style="width:8%" class="tc-cell-c">Obs.</th>
      <th style="width:34%">Specification</th>
      <th style="width:8%" class="tc-cell-c">% Defective</th>
      <th style="width:20%">Equipment / Gauge Used</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="tc-cell-c">01</td>
      <td>Passivation Colour <span class="tc-sub">(Master Sample)</span></td>
      <td class="tc-cell-c">OK</td>
      <td>Dark Smooth Olive Green / Olive (Silver / Golden Yellow), Trivalent Yellow / Trivalent Black</td>
      <td class="tc-cell-c">NIL</td>
      <td>Digital Elcon Meter</td>
    </tr>
    <tr>
      <td class="tc-cell-c">02</td>
      <td>Visual Appearance <span class="tc-sub">(Master Sample)</span></td>
      <td class="tc-cell-c">OK</td>
      <td>OK without any surface defect &mdash; Burrs / Damage / Improper Coverage / Peel-off</td>
      <td class="tc-cell-c">NIL</td>
      <td>&mdash;</td>
    </tr>
  </tbody>
</table>

<div class="tc-notes">
  <ol>
    <li>The Critical Parameters stated in the Final Coating are checked 100% and only OK materials are despatched to the customer.</li>
    <li>All the information provided above is accepted unconditionally.</li>
    <li>Sampling Plan: List is defined at the bottom &mdash; components Zn-plated in one Bath-Rack / Barrel.</li>
  </ol>
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
{sampling_rows}
  </tbody>
</table>

<div class="tc-disclaimer">
  Note: No alterations are permissible in the format without written approval of QA &mdash; TML.
</div>

<div class="tc-footer">
  <div class="tc-addr-block">
    <strong>SOMA ELECTRO PRODUCTS</strong><br>
    B-8, (1st Phase) Industrial Area, Adityapur, Jamshedpur &ndash; 831001<br>
    GSTIN: 20AB DPJ 4731 B2ZD
  </div>
  <div class="tc-sig">Authorised Signatory</div>
</div>

</body>
</html>
"""


def render_chemical_rows():
    out = []
    for slno, proc, obs_l, chem_l, obs_r, chem_r in CHEMICAL_ROWS:
        out.append(
            "    <tr>"
            f"<td class=\"tc-cell-c\">{slno}</td>"
            f"<td>{proc}</td>"
            f"<td class=\"tc-cell-c\">{obs_l}</td>"
            f"<td>{chem_l}</td>"
            f"<td class=\"tc-cell-c\">{obs_r}</td>"
            f"<td>{chem_r}</td>"
            "</tr>"
        )
    return "\n".join(out)


def render_sampling_rows():
    out = []
    for a, b, c, d, e, f in SAMPLING_ROWS:
        out.append(
            "    <tr>"
            f"<td class=\"tc-cell-c\">{a}</td><td class=\"tc-cell-c\">{b}</td>"
            f"<td class=\"tc-cell-c\">{c}</td><td class=\"tc-cell-c\">{d}</td>"
            f"<td class=\"tc-cell-c\">{e}</td><td class=\"tc-cell-c\">{f}</td>"
            "</tr>"
        )
    return "\n".join(out)


def safe_filename(part_no: str) -> str:
    return re.sub(r"\s+", "-", part_no.strip())


def main():
    chem_html = render_chemical_rows()
    samp_html = render_sampling_rows()
    customer_addr_html = "<br>".join(CUSTOMER_ADDRESS_LINES)

    written = []
    for p in PARTS:
        fname = f"2026-04-15_{safe_filename(p['part_no'])}.html"
        out_path = os.path.join(OUT_DIR, fname)
        html = HTML_TEMPLATE.format(
            css=CSS,
            cert_date=CERT_DATE,
            customer_name=CUSTOMER_NAME,
            customer_address=customer_addr_html,
            invoice_no=INVOICE_NO,
            challan_no=CHALLAN_NO,
            challan_date=CHALLAN_DATE,
            job_description=JOB_DESCRIPTION,
            process_reg=PROCESS_REG,
            part_no=p["part_no"],
            part_no_safe=p["part_no"],
            qty=p["qty"],
            net_wt=NET_WT,
            category=CATEGORY,
            q_tml=PROCESS_QUALIFIED_TML,
            q_tatasteel=PROCESS_QUALIFIED_TATASTEEL,
            chemical_rows=chem_html,
            sampling_rows=samp_html,
        )
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(html)
        written.append(out_path)

    for p in written:
        print(p)


if __name__ == "__main__":
    main()
