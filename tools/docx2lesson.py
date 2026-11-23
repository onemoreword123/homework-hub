#!/usr/bin/env python3
"""Convert a lesson Word file (teacher's template) into the "lesson" part of a topic JSON.
usage: docx2lesson.py input.docx topic_id out_dir_for_site
Writes: <site>/img/<topic_id>.jpg (banner) and prints lesson JSON to stdout.
"""
import sys, re, json, io
from docx import Document
from docx.oxml.ns import qn
from PIL import Image

src, tid, site = sys.argv[1], sys.argv[2], sys.argv[3]
doc = Document(src)
body = doc.element.body

def run_md(runs):
    out, cur, fmt = [], "", None
    def flush():
        nonlocal cur
        if not cur: return
        b, i = fmt
        lead = len(cur) - len(cur.lstrip()); trail = len(cur) - len(cur.rstrip())
        core = cur.strip()
        if core and (b or i):
            mk = "***" if b and i else "**" if b else "*"
            out.append(cur[:lead] + mk + core + mk + (cur[len(cur)-trail:] if trail else ""))
        else:
            out.append(cur)
        cur = ""
    for r in runs:
        t = r.text
        if not t: continue
        f = (bool(r.bold), bool(r.italic))
        if not t.strip(): f = fmt or f
        if f != fmt: flush(); fmt = f
        cur += t
    flush()
    s = "".join(out)
    s = re.sub(r"(?<![\w*])(\w)\*\*(?=\w)", r"**\1", s)  # bold that starts mid-word
    return s.replace(" ", " ").strip()

def para_md(p): return run_md(p.runs)
def is_list(p): return p._p.pPr is not None and p._p.pPr.numPr is not None
def highlighted(p): return any(r.font.highlight_color is not None for r in p.runs if r.text.strip())
def has_image(p): return bool(p._p.findall(".//" + qn("a:blip")))
def cell_shade(cell):
    tcPr = cell._tc.tcPr
    if tcPr is None: return None
    shd = tcPr.find(qn("w:shd"))
    if shd is None: return None
    fill = shd.get(qn("w:fill"))
    return "#" + fill if fill and fill.lower() not in ("auto", "ffffff") else None
def vmerge(cell):
    tcPr = cell._tc.tcPr
    if tcPr is None: return None
    v = tcPr.find(qn("w:vMerge"))
    return None if v is None else (v.get(qn("w:val")) or "continue")

blocks, label, state, cur_dialogue, n_dialogue = [], None, None, None, 0
from docx.table import Table
from docx.text.paragraph import Paragraph

def take_label():
    global label
    l, label = label, None
    return l
title_pending = None
def take_title():
    global title_pending
    t, title_pending = title_pending, None
    return t

for el in body.iterchildren():
    if el.tag == qn("w:tbl"):
        t = Table(el, doc)
        rows = t.rows
        head = [c.text.strip() for c in rows[0].cells]
        if len(head) >= 2 and head[0].lower().startswith("word"):
            vrows = []
            for r in rows[1:]:
                c0 = r.cells[0].text.replace(" ", " ").strip(); c1 = r.cells[1].text.strip()
                m = re.search(r"(/[^/\s][^/]*/(?:\s*/[^/\s][^/]*/)*)\s*$", c0)
                vrows.append([c0[:m.start()].strip() if m else c0, m.group(1).strip() if m else "", c1])
            blocks.append({"type": "vocab", "label": take_label(), "title": take_title() or "Vocabulary", "rows": vrows})
            continue
        if len(head) >= 3 and head[0].lower().startswith("structure"):
            grows = []
            for r in rows[1:]:
                cs = r.cells
                grows.append({"structure": " / ".join(para_md(p).replace("**", "") for p in cs[0].paragraphs if p.text.strip()),
                              "examples": [para_md(p) for p in cs[1].paragraphs if p.text.strip()],
                              "note": cs[2].text.strip()})
            blocks.append({"type": "grammar", "label": take_label(), "title": take_title() or "", "rows": grows})
            continue
        if not ("Mục" in head[0]) and len(head) >= 2:
            # generic table: keep every cell (paragraphs joined, bullets kept)
            def cell_md(c):
                parts = []
                for p in c.paragraphs:
                    if not p.text.strip(): continue
                    parts.append(("• " if is_list(p) else "") + para_md(p))
                return "\n".join(parts)
            body_rows = []
            for r in rows[1:]:
                seen, cells = set(), []
                for c in r.cells:
                    if id(c._tc) in seen: continue
                    seen.add(id(c._tc)); cells.append(cell_md(c))
                body_rows.append(cells)
            hseen, hcells = set(), []
            for c in rows[0].cells:
                if id(c._tc) in hseen: continue
                hseen.add(id(c._tc)); hcells.append(c.text.strip())
            blocks.append({"type": "table", "label": take_label(), "title": take_title() or "", "head": hcells, "rows": body_rows})
            continue
        if len(head) >= 3 and "Mục" in head[0]:
            groups = []
            for r in rows[1:]:
                cells = r.cells
                purpose = cells[0].text.strip()
                vm = vmerge(cells[0])
                if groups and (vm == "continue" or not purpose or purpose == groups[-1]["_plain"]):
                    g = groups[-1]
                else:
                    g = {"purpose": purpose, "color": cell_shade(cells[0]) or "#eef2f7", "items": [], "_plain": purpose}
                    groups.append(g)
                sps = [para_md(p) for p in cells[1].paragraphs if p.text.strip()]
                eps = [para_md(p) for p in cells[2].paragraphs if p.text.strip()]
                for i, sp in enumerate(sps):
                    ex = eps[i] if i < len(eps) else ""
                    if i == len(sps) - 1 and len(eps) > len(sps): ex = " ".join(eps[i:])
                    g["items"].append([sp.replace("**", ""), ex])
            for g in groups: g.pop("_plain", None)
            blocks.append({"type": "grammar2", "label": take_label(), "groups": groups})
        continue
    if el.tag != qn("w:p"): continue
    p = Paragraph(el, doc)
    text = p.text.strip()
    if has_image(p) and not blocks:
        blip = el.findall(".//" + qn("a:blip"))[0]
        rid = blip.get(qn("r:embed"))
        data = doc.part.related_parts[rid].blob
        im = Image.open(io.BytesIO(data)).convert("RGB"); im.thumbnail((1100, 1100))
        im.save(f"{site}/img/{tid}.jpg", quality=60, optimize=True, progressive=True)
        blocks.append({"type": "banner", "src": f"img/{tid}.jpg"})
        continue
    if not text: continue
    style = (p.style.name or "").lower()
    if "heading" in style:
        if "homework" in text.lower(): break
        blocks.append({"type": "heading", "text": re.sub(r"^([^\w\s]+)\s*(?=\w)", r"\1 ", text.strip())})
        state = None; continue
    if text.startswith("Từ vựng"):
        state = "vocab"; continue
    if highlighted(p) and not is_list(p):
        label = re.sub(r"^([^\w\s]+)\s*(?=\w)", r"\1 ", text.strip())
        state = "questions" if "Brainstorm" in text else None
        continue
    if is_list(p):
        plain = p.text.replace(" ", " ").strip()
        m = re.search(r"\s(/[^/\s][^()]*?/)\s*(?:\(([^)]*)\)?)?\s*:?\s*(.*)$", plain)
        m2 = re.search(r"^(.*?)\s*\(([^)]*)\)\s*:?\s*(.*)$", plain)
        if state == "vocab" and cur_dialogue is not None and not m and m2:
            mdtxt = para_md(p)
            cut = mdtxt.rfind("(")
            cur_dialogue["vocab"].append([mdtxt[:cut].strip() if cut > 0 else m2.group(1), "", m2.group(2).strip(), m2.group(3).strip()])
            continue
        if state == "vocab" and cur_dialogue is not None and m:
            mdtxt = para_md(p)
            if m:
                ipa_start = m.start(1)
                term_plain = plain[:ipa_start].strip()
                # term with bold markup: cut md at the IPA slash
                cut = mdtxt.find(m.group(1)[:3])
                term = mdtxt[:cut].strip() if cut > 0 else term_plain
                cur_dialogue["vocab"].append([term, m.group(1).strip(), (m.group(2) or "").strip(), m.group(3).strip()])
            continue
        if state == "questions":
            blocks[-1]["items"].append(para_md(p)) if blocks and blocks[-1]["type"] == "questions" and blocks[-1].get("_open") else blocks.append({"type": "questions", "label": take_label(), "items": [para_md(p)], "_open": True})
            continue
        # numbered dialogue title
        n_dialogue += 1
        cur_dialogue = {"type": "dialogue", "label": take_label(), "title": f"{n_dialogue}. {text}", "context": "", "lines": [], "vocab": []}
        blocks.append(cur_dialogue); state = "dialogue"; continue
    if text.lower().startswith("context") and cur_dialogue is not None:
        md = para_md(p)
        cur_dialogue["context"] = md if md.startswith("*") else f"*{md}*"
        continue
    m = re.match(r"^([^\W\d_][^\W\d_]{0,20}(?: [^\W\d_]{1,20})?):\s*(.*)$", text)
    if m and not m.group(1)[0].isupper(): m = None
    if m and cur_dialogue is not None and state == "dialogue":
        md = para_md(p)
        md = re.sub(r"^\*\*" + re.escape(m.group(1)) + r":\*\*\s*", "", md)
        md = re.sub(r"^\*\*" + re.escape(m.group(1)) + r":\s*", "**", md)
        cur_dialogue["lines"].append([m.group(1), md.strip()]); continue
    if not blocks or len(blocks) == 1:  # title line after banner
        continue
    # a bold stand-alone line (e.g. "Types of homes") becomes the title of the next table
    if all((r.bold or not r.text.strip()) for r in p.runs):
        title_pending = text

for b in blocks:
    b.pop("_open", None)
    if b.get("label") is None: b.pop("label", None)
print(json.dumps(blocks, ensure_ascii=False, indent=1))
