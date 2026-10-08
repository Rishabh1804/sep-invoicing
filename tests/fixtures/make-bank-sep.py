"""Two FAKE bank statements for P179, every name and figure invented (the owner's statements are never committed).

  bank-sep-2page.xls  Bank of Baroda's export layout (OpTransactionHistoryUX5.xls), newest first, ending in the page foot
                      the bank prints on a statement of two pages: the time it was made under TRAN DATE (a date and time,
                      as a number) and "Page 2 of" "2" under BALANCE, then the "computer-generated" note.
  bank-sep.xlsx       The same eight rows saved from Excel as .xlsx: a table from A1, deflated parts, shared strings, most
                      cells text as the export writes them, one date and one amount typed as numbers.

Run from this folder: python3 make-bank-sep.py (needs xlwt). The files are committed; this says how they were made.
"""
import datetime
import xlwt

OPENING = 100000.00
ROWS = [  # oldest first: date, narration, cheque, withdrawal, deposit
    ('02/09/2026', 'NEFT-AXISN00000000001-ALPHA FORGINGS PVT LTD', '', 0, 59000.00),
    ('02/09/2026', 'TO SELF', '000201', 40000.00, 0),
    ('03/09/2026', 'BY INST 600101 - MICR CLG (CTS)', '', 0, 23600.00),
    ('03/09/2026', 'Charges for PORD Customer Payment', '', 5.60, 0),
    ('04/09/2026', 'NEFT-BARBT00000000002-RAMU KUMAR', '', 12500.00, 0),
    ('04/09/2026', 'ACME CHEMICALS-MICR INWARD CLG', '000202', 18880.00, 0),
    ('05/09/2026', 'SMS Charges for AUG 26', '', 4.72, 0),
    ('05/09/2026', 'NEFT-HDFCH00000000003-BETA AUTO', '', 0, 35400.00),
]


def inr(v):
    """1,46,609.68: the Indian grouping the bank writes."""
    whole, frac = ('%.2f' % v).split('.')
    head, tail = whole[:-3], whole[-3:]
    groups = []
    while len(head) > 2:
        groups.insert(0, head[-2:])
        head = head[:-2]
    if head:
        groups.insert(0, head)
    return ','.join(groups + [tail]) + '.' + frac


bal, lines = OPENING, []
for d, n, chq, dr, cr in ROWS:
    bal = round(bal - dr + cr, 2)
    lines.append((d, n, chq, dr, cr, bal))
lines.reverse()  # the bank writes newest first

# --- the .xls, in the export's own columns (B date, D value date, G narration, J cheque, M withdrawal, T deposit, AA balance)
wb = xlwt.Workbook()
ws = wb.add_sheet('OpTransactionHistoryUX5')
ws.write(1, 2, 'Main Account  Holder Name :  ')
ws.write(5, 1, 'Customer Id:')
ws.write(5, 5, '000000000')
ws.write(5, 16, 'Account No:')
ws.write(5, 22, '001XXXXXXXX777')
ws.write(8, 1, 'Your Account Statement as on')
ws.write(8, 11, 'Statement Period from 01/09/2026 to 06/09/2026')
ws.write(11, 1, 'TEST WORKS')
for c, label in [(1, 'TRAN DATE'), (3, 'VALUE DATE'), (6, 'NARRATION'), (9, 'CHQ.NO.'), (12, 'WITHDRAWAL(DR)'), (19, 'DEPOSIT(CR)'), (26, 'BALANCE(INR)')]:
    ws.write(12, c, label)
r = 13
for d, n, chq, dr, cr, b in lines:
    ws.write(r, 1, d)
    ws.write(r, 3, d)
    ws.write(r, 6, n)
    if chq:
        ws.write(r, 9, chq)
    if dr:
        ws.write(r, 12, inr(dr))
    if cr:
        ws.write(r, 19, inr(cr))
    ws.write(r, 26, ' ' + inr(b) + 'Cr')
    r += 1
r += 2
stamp = xlwt.easyxf(num_format_str='dd/mm/yyyy hh:mm')
ws.write(r, 1, datetime.datetime(2026, 9, 6, 11, 21), stamp)
ws.write(r, 26, 'Page 2 of')
ws.write(r, 28, ' 2')
ws.write(r + 1, 7, '*This is computer-generated statement and does not require any signature.')
wb.save('bank-sep-2page.xls')

# --- the .xlsx, as Excel saves the same rows copied into a table: deflated parts, a shared string table (one item in
#     rich-text runs with a phonetic reading, which is not its text), one date and one amount typed as numbers.
#     Written part by part, since openpyxl writes its strings inline where Excel shares them.
import zipfile
from xml.sax.saxutils import escape

sst, sst_at = [], {}


def si(text):
    if text not in sst_at:
        sst_at[text] = len(sst)
        sst.append(text)
    return sst_at[text]


def col(i):
    return 'ABCDEFG'[i]


head = ['TRAN DATE', 'VALUE DATE', 'NARRATION', 'CHQ.NO.', 'WITHDRAWAL(DR)', 'DEPOSIT(CR)', 'BALANCE(INR)']
cells = ['<row r="1" spans="1:7">' + ''.join('<c r="%s1" t="s"><v>%d</v></c>' % (col(i), si(h)) for i, h in enumerate(head)) + '</row>']
serial = (datetime.date(2026, 9, 5) - datetime.date(1899, 12, 30)).days
for k, (d, n, chq, dr, cr, b) in enumerate(lines):
    r = k + 2
    vals = [d, d, n, chq or None, inr(dr) if dr else None, inr(cr) if cr else None, ' ' + inr(b) + 'Cr']
    out = []
    for i, v in enumerate(vals):
        ref = '%s%d' % (col(i), r)
        if k == 0 and i == 0:
            out.append('<c r="%s" s="1"><v>%d</v></c>' % (ref, serial))       # a real date: a day number, styled as one
        elif k == 0 and i == 5:
            out.append('<c r="%s" s="2"><v>%s</v></c>' % (ref, repr(cr)))    # an amount typed as a number
        elif v is not None:
            out.append('<c r="%s" t="s"><v>%d</v></c>' % (ref, si(v)))
    cells.append('<row r="%d" spans="1:7">%s</row>' % (r, ''.join(out)))
last = len(lines) + 1
NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
sheet = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<worksheet %s><dimension ref="A1:G%d"/><sheetViews><sheetView workbookViewId="0"/></sheetViews>'
         '<sheetFormatPr defaultRowHeight="15"/><sheetData>%s</sheetData><tableParts count="1"><tablePart r:id="rId1"/></tableParts></worksheet>') % (NS, last, ''.join(cells))
items = []
for t in sst:
    if t == 'TO SELF':   # rich text: two runs, and a phonetic reading that is not the text
        items.append('<si><r><t>TO </t></r><r><rPr><b/></rPr><t>SELF</t></r><rPh sb="0" eb="2"><t>XX</t></rPh></si>')
    else:
        items.append('<si><t xml:space="preserve">%s</t></si>' % escape(t))
shared = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="%d" uniqueCount="%d">%s</sst>'
          % (len(sst), len(sst), ''.join(items)))
parts = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>'
        '<Override PartName="/xl/tables/table1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<workbook %s><sheets><sheet name="Sheet3" sheetId="3" r:id="rId3"/></sheets></workbook>' % NS,
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>'
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'xl/styles.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>'
        '<fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
        '<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>',
    'xl/sharedStrings.xml': shared,
    'xl/worksheets/sheet1.xml': sheet,
    'xl/worksheets/_rels/sheet1.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table1.xml"/></Relationships>',
    'xl/tables/table1.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="2" name="Table2" displayName="Table2" ref="A1:G%d" totalsRowShown="0">'
        '<autoFilter ref="A1:G%d"/><tableColumns count="7">%s</tableColumns><tableStyleInfo name="TableStyleMedium2" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/></table>'
        % (last, last, ''.join('<tableColumn id="%d" name="%s"/>' % (i + 1, escape(h)) for i, h in enumerate(head))),
}
with zipfile.ZipFile('bank-sep.xlsx', 'w', zipfile.ZIP_DEFLATED) as z:
    for name in ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/worksheets/sheet1.xml', 'xl/styles.xml',
                 'xl/sharedStrings.xml', 'xl/worksheets/_rels/sheet1.xml.rels', 'xl/tables/table1.xml']:
        info = zipfile.ZipInfo(name, date_time=(2026, 9, 6, 11, 21, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, parts[name])
print('wrote bank-sep-2page.xls and bank-sep.xlsx;', len(lines), 'rows, closing', inr(lines[0][5]))
