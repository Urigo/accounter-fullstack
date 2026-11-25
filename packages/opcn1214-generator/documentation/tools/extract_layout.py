#!/usr/bin/env python3
"""Extract the record layouts from a SHAAM "1214 OPCN" specification PDF and diff them
against the curated layout CSVs in documentation/layout/<year>/.

This is a maintenance tool for yearly spec updates, not part of the package build.
Requires: Python 3.10+, pdfplumber (pip install pdfplumber).

  python3 extract_layout.py extract <spec.pdf> <raw.json>
  python3 extract_layout.py diff <raw.json> <layout-dir>

`extract` writes every header field (position, length, type, required, Hebrew name/notes, page)
and every code-amount entry per record type. `diff` compares that raw extraction with
fields.csv / codes.csv and prints every difference, so a new year's PDF can be reconciled
field by field. Semantic columns (key, kind, values) are curated by hand in the CSVs.

How the extraction works: pdfplumber returns Hebrew in visual (reversed) order, so each cell
line is reversed and LTR runs (digits, Latin) are re-reversed. Cells are assigned to columns by
horizontal overlap with the header row; continuation tables without a header row are mapped
right-to-left (name, length, type, required, position, notes). Records are segmented by the
"record type" row (סוג רשומה) that opens each record's section.
"""
import csv
import json
import re
import sys
from pathlib import Path

LTR = re.compile(r"[A-Za-z0-9](?:[A-Za-z0-9./,%:+_\-׳’']*[A-Za-z0-9%])?")
TYPES = {'נומרי': 'numeric', 'אלפאנומרי': 'alphanumeric', 'אלפא נומרי': 'alphanumeric'}
LABELS = [('שם שדה', 'name'), ('אורך', 'length'), ('סוג', 'type'), ('מפוזיציה', 'position'), ('הערות', 'notes'),
          ('פירוט', 'perCountry'), ('שינוי', 'changes'), ('חובה', 'required'), ('שדה', 'required')]
PREFIX_POSITIONS = {1, 5, 9}  # form type, record type, 128-zero filler: identical in every record


def logical(cell):
    if not cell:
        return ''
    lines = []
    for line in cell.split('\n'):
        line = line[::-1]
        lines.append(LTR.sub(lambda m: m.group(0)[::-1], line).strip())
    return re.sub(r'\s+', ' ', ' '.join(lines)).strip()


def label_of(text):
    for needle, label in LABELS:
        if needle in text:
            return label
    return None


def overlap(a, b):
    return max(0.0, min(a[1], b[1]) - max(a[0], b[0]))


def table_rows(page):
    """Yield dict rows (column label -> logical text) for every table on the page."""
    for tbl in page.find_tables():
        texts, rows = tbl.extract(), tbl.rows
        header_idx, columns = None, []
        for i, row in enumerate(texts[:3]):
            joined = ' '.join(logical(c) for c in row if c)
            if 'שם שדה' in joined or ('אורך' in joined and 'מפוזיציה' in joined):
                header_idx = i
                break
        if header_idx is not None:
            for bbox, txt in zip(rows[header_idx].cells, texts[header_idx]):
                label = label_of(logical(txt)) if bbox and txt else None
                if label:
                    columns.append((label, (bbox[0], bbox[2])))
        for i, (row, txt_row) in enumerate(zip(rows, texts)):
            if header_idx is not None and i <= header_idx:
                continue
            cells = [(bbox, logical(t)) for bbox, t in zip(row.cells, txt_row) if bbox and t and logical(t)]
            if not cells:
                continue
            if columns:
                out = {}
                for bbox, value in cells:
                    best = max(columns, key=lambda c: overlap(c[1], (bbox[0], bbox[2])))
                    label = best[0] if overlap(best[1], (bbox[0], bbox[2])) > 0 else 'unmapped'
                    out[label] = f"{out[label]} | {value}" if label in out else value
                yield out
            else:
                yield right_to_left(cells)


def right_to_left(cells):
    values = [v for _, v in sorted(cells, key=lambda c: -c[0][0])]
    if len(values) < 2 or not values[1].isdigit():
        return {}
    out, rest = {'name': values[0], 'length': values[1]}, values[2:]
    if rest and rest[0] in TYPES:
        out['type'] = rest.pop(0)
        if rest and not rest[0].isdigit():
            out['required'] = rest.pop(0)
        if rest and rest[0].isdigit():
            out['position'] = rest.pop(0)
        if rest:
            out['notes'] = ' | '.join(rest)
        return out
    for v in rest:
        if v in ('כן', 'לא') or v.startswith('חובה'):
            out['required'] = v
        else:
            out['notes'] = f"{out['notes']} | {v}" if 'notes' in out else v
    return out


def extract(pdf_path, out_path):
    import pdfplumber
    records, current = {}, None
    with pdfplumber.open(pdf_path) as pdf:
        for page_no, page in enumerate(pdf.pages, start=1):
            for row in table_rows(page):
                name, length = row.get('name', ''), row.get('length', '')
                if name.startswith('סוג רשומה'):
                    m = re.search(r'\b(\d{4})\b', row.get('notes', '') + ' ' + name)
                    if m and m.group(1) not in ('2024', '2025', '2026'):
                        current = m.group(1)
                        records.setdefault(current, {'header': [], 'codes': [], 'other': []})
                    continue
                if current is None or not length.isdigit():
                    continue
                entry = {'name': name, 'length': int(length), 'type': TYPES.get(row.get('type', ''), row.get('type', '')),
                         'required': row.get('required', ''), 'perCountry': row.get('perCountry', ''),
                         'notes': row.get('notes', ''), 'changes': row.get('changes', ''), 'page': page_no}
                position = row.get('position', '')
                if position.isdigit():
                    if int(position) not in PREFIX_POSITIONS:
                        records[current]['header'].append(dict(entry, position=int(position)))
                elif re.fullmatch(r'\d{2,3}', name):
                    records[current]['codes'].append(dict(entry, code=name.zfill(3)))
                elif re.search(r'שומרים קוד (\d{3})', name):  # 3077: "code 50 - improvement N (stored as code 50N)"
                    code = re.search(r'שומרים קוד (\d{3})', name).group(1)
                    records[current]['codes'].append(dict(entry, code=code))
                else:
                    records[current]['other'].append(entry)
    Path(out_path).write_text(json.dumps(records, ensure_ascii=False, indent=1), encoding='utf-8')
    for rt, rec in records.items():
        print(f"{rt}: {len(rec['header'])} header fields, {len(rec['codes'])} codes, {len(rec['other'])} other rows")


def required_of(text):
    text = (text or '').strip()
    return 'yes' if text == 'כן' else ('no' if text in ('', 'לא') else 'conditional')


def diff(raw_path, layout_dir):
    raw = json.loads(Path(raw_path).read_text(encoding='utf-8'))
    layout = Path(layout_dir)
    fields = list(csv.DictReader(open(layout / 'fields.csv', encoding='utf-8')))
    codes = list(csv.DictReader(open(layout / 'codes.csv', encoding='utf-8')))
    problems = []
    for rt in sorted(set(raw) | {f['record'] for f in fields}):
        pdf_fields = {f['position']: f for f in raw.get(rt, {}).get('header', [])}
        csv_fields = {int(f['position']): f for f in fields if f['record'] == rt}
        for pos in sorted(set(pdf_fields) | set(csv_fields)):
            p, c = pdf_fields.get(pos), csv_fields.get(pos)
            if not p:
                note = f" (known: {c['extractionNote']})" if c and c.get('extractionNote') else ''
                problems.append(f"{rt}@{pos} {c['key']}: in CSV, not found in PDF extraction{note}")
            elif not c:
                problems.append(f"{rt}@{pos} '{p['name']}' len {p['length']}: in PDF, missing from CSV")
            else:
                for col, pv, cv in [('length', p['length'], int(c['length'])), ('type', p['type'], c['type']),
                                    ('required', required_of(p['required']), c['required'])]:
                    if pv != cv:
                        problems.append(f"{rt}@{pos} {c['key']}: {col} PDF={pv} CSV={cv}")
        pdf_codes = {c['code']: c for c in raw.get(rt, {}).get('codes', [])}
        csv_codes = {c['code']: c for c in codes if c['record'] == rt}
        for code in sorted(set(pdf_codes) | set(csv_codes)):
            p, c = pdf_codes.get(code), csv_codes.get(code)
            if not p:
                problems.append(f"{rt} code {code}: in CSV, not found in PDF extraction")
            elif not c:
                problems.append(f"{rt} code {code}: in PDF (len {p['length']}), missing from CSV")
            else:
                for col, pv, cv in [('length', p['length'], int(c['length'])),
                                    ('required', required_of(p['required']), c['required']),
                                    ('perCountryBreakdown', 'yes' if p['perCountry'] else 'no',
                                     c['perCountryBreakdown'])]:
                    if pv != cv:
                        problems.append(f"{rt} code {code}: {col} PDF={pv} CSV={cv}")
    print('\n'.join(problems) if problems else 'No differences.')
    return 1 if problems else 0


if __name__ == '__main__':
    if len(sys.argv) == 4 and sys.argv[1] == 'extract':
        extract(sys.argv[2], sys.argv[3])
    elif len(sys.argv) == 4 and sys.argv[1] == 'diff':
        sys.exit(diff(sys.argv[2], sys.argv[3]))
    else:
        print(__doc__)
        sys.exit(2)
