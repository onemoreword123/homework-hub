import json, glob, re, sys, os
sys.path.insert(0, "/home/claude/scripts")
from meanings_vi import VI
site = os.environ.get("SITE", "/home/claude/homework-hub/docs")
def norm(s): return re.sub(r"\s+", " ", s.replace("*", "").replace("’", "'").replace("‘", "'").replace("...", "…")).strip()
VIN = {norm(k): v for k, v in VI.items()}
PLACE = r"\b(sth|sb|sb's|somebody|something)\b|\+\s*[\w/ -]+|\([^)]*\)|…|\?|\.|,"
def core(term):
    t = norm(term)
    t = t.split(" / ")[0]
    t = re.sub(PLACE, " ", t)
    return re.sub(r"\s+", " ", t).strip().lower()
def sentences(md):
    return re.split(r"(?<=[.!?])\s+(?=[A-Z“\"*])", md)
missing, noex, done = [], [], 0
for f in sorted(glob.glob(f"{site}/topics/*.json")):
    if f.endswith("index.json"): continue
    t = json.load(open(f)); changed = False
    for b in t["lesson"]:
        if b.get("type") != "dialogue": continue
        lines = [l[1] for l in b["lines"]]
        for v in b["vocab"]:
            while len(v) < 5: v.append("")
            key = norm(v[0])
            m = VIN.get(key)
            if m: v[3] = m; done += 1
            elif not v[3]: missing.append((t["id"], key))
            c = core(v[0]); words = [w for w in c.split() if len(w) > 2]
            ex = ""
            for ln in lines:
                for s in sentences(ln):
                    plain = norm(s).lower()
                    if c and c in plain: ex = s; break
                if ex: break
            if not ex and words:
                STOP = {"the","and","your","you","with","for","have","has","had","not","get","enough","money"}
                IRR = {"take":["took","taken","takes","taking"],"give":["gave","given","gives","giving"],"spend":["spent","spends","spending"],
                       "move":["moved","moving","moves"],"hold":["held","holding","holds"],"try":["tried","tries","trying"],"go":["went","goes","gone"],
                       "feel":["felt","feeling","feels"],"lose":["lost","losing"],"struggle":["struggling","struggled","struggles"],"keep":["kept","keeping","keeps"],
                       "problem":["problems"],"line":["lines"],"funniest":["funniest"],"plate":["plate"],"display":["display"]}
                cw = [w for w in words if w not in STOP] or words
                def has(plain, w):
                    forms = [w] + IRR.get(w, [])
                    return any(re.search(r"\b" + re.escape(x), plain) for x in forms)
                for ln in lines:
                    for s in sentences(ln):
                        plain = norm(s).lower()
                        if all(has(plain, w) for w in cw[:2]): ex = s; break
                    if ex: break
            if not ex and words:
                for ln in lines:
                    for s in sentences(ln):
                        plain = norm(s).lower()
                        if all(w in plain for w in words[:2]): ex = s; break
                    if ex: break
            MANUAL = {"not have enough money to + V": "they don't have enough money to pay the tax", "go up by + number": "Our engagement has gone up by about 30%"}
            if not ex and norm(v[0]) in MANUAL:
                for ln in lines:
                    if MANUAL[norm(v[0])].lower() in norm(ln).lower():
                        for s2 in sentences(ln):
                            if MANUAL[norm(v[0])].lower()[:20] in norm(s2).lower(): ex = s2
            if ex:
                ex = ex.strip()
                if ex.count("**") % 2: ex = ex + "**" if ex.startswith("**") or ex.find("**") < len(ex) / 2 else "**" + ex
                v[5:] = [ex]
            else:
                v[5:] = [""]; noex.append((t["id"], key))
            changed = True
    if changed: json.dump(t, open(f, "w"), ensure_ascii=False, indent=1)
print("meanings set:", done, "| missing meaning:", missing)
print("no example:", len(noex), noex)
