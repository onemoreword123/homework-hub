# Builds docs/topics/words.json: {topic_id: [[term, ipa, pos, vi, audio, example], ...]} for Word of the day
import json, glob, os
site = os.environ.get("SITE", "/home/claude/homework-hub/docs")
out = {}
for f in sorted(glob.glob(f"{site}/topics/*.json")):
    name = os.path.basename(f)
    if name in ("index.json", "words.json"): continue
    t = json.load(open(f)); words = []
    for b in t["lesson"]:
        if b.get("type") == "dialogue":
            for v in b["vocab"]:
                v = (v + [""] * 7)[:7]
                vi = v[6] or v[3]
                if vi: words.append([v[0], v[1], v[2], vi, v[4], v[5]])
    if words: out[t["id"]] = words
json.dump(out, open(f"{site}/topics/words.json", "w"), ensure_ascii=False, separators=(",", ":"))
print({k: len(v) for k, v in out.items()}, os.path.getsize(f"{site}/topics/words.json"), "bytes")
