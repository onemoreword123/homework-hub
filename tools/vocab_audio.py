# Adds a 5th field (audio path) to every vocab entry in the given topic files and generates missing clips.
import sys, json, re, hashlib, os, subprocess, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
import os as _os
site = _os.environ.get("SITE", "/home/claude/homework-hub/docs")
k = Kokoro("/home/claude/tts/kokoro.onnx", "/home/claude/tts/voices.bin")
os.makedirs(f"{site}/audio/v", exist_ok=True)
def spoken(term):
    t = re.sub(r"[*]", "", term)
    t = re.sub(r"\bsth\b", "something", t); t = re.sub(r"\bsb's\b", "somebody's", t); t = re.sub(r"\bsb\b", "somebody", t)
    t = re.sub(r"\+\s*(V-ing|V \(past\)|V|N|clause|number|adj|time)\b", "", t)
    t = t.replace("(", "").replace(")", "").replace("…", "").replace("...", "").replace(" / ", ". ")
    t = re.sub(r"\s+", " ", t).strip(" ,")
    return t
made = 0
for f in sys.argv[1:]:
    p = f"{site}/topics/{f}.json"; topic = json.load(open(p))
    for b in topic["lesson"]:
        if b.get("type") == "table":
            b["say"] = [["" for _ in r] for r in b["rows"]]
            items = []
            for ri, r in enumerate(b["rows"]):
                for ci, c in enumerate(r):
                    if not re.search(r"(^|\s)/[^/\s][^/]*/", c): continue
                    bolds = re.findall(r"\*\*\*?([^*]+?)\*\*\*?", c)
                    word = ". ".join(x.strip() for x in bolds) if bolds else re.split(r"\s/", c)[0]
                    items.append(([word, ri, ci], "table"))
        elif b.get("type") == "vocab":
            items = [(r, 3) for r in b["rows"]]
        elif b.get("type") == "dialogue":
            items = [(v, 4) for v in b.get("vocab", [])]
        else: continue
        for v, slot in items:
            text = spoken(v[0])
            if slot == "table":
                if not text: continue
                h = hashlib.sha1(text.lower().encode()).hexdigest()[:10]; path = f"audio/v/{h}.mp3"
                if not os.path.exists(f"{site}/{path}"):
                    a, sr = k.create(text, voice="bf_emma", speed=0.88, lang="en-gb")
                    a = np.concatenate([np.zeros(int(sr*0.05), dtype=a.dtype), a, np.zeros(int(sr*0.15), dtype=a.dtype)])
                    sf.write("/tmp/v.wav", a, sr)
                    subprocess.run(["ffmpeg","-y","-loglevel","error","-i","/tmp/v.wav","-ac","1","-codec:a","libmp3lame","-b:a","56k",f"{site}/{path}"], check=True)
                    made += 1
                b["say"][v[1]][v[2]] = path
                continue
            if not text: continue
            h = hashlib.sha1(text.lower().encode()).hexdigest()[:10]
            path = f"audio/v/{h}.mp3"
            if not os.path.exists(f"{site}/{path}"):
                a, sr = k.create(text, voice="bf_emma", speed=0.88, lang="en-gb")
                a = np.concatenate([np.zeros(int(sr*0.05), dtype=a.dtype), a, np.zeros(int(sr*0.15), dtype=a.dtype)])
                sf.write("/tmp/v.wav", a, sr)
                subprocess.run(["ffmpeg","-y","-loglevel","error","-i","/tmp/v.wav","-ac","1","-codec:a","libmp3lame","-b:a","56k",f"{site}/{path}"], check=True)
                made += 1
            while len(v) <= slot: v.append("")
            v[slot] = path
    json.dump(topic, open(p, "w"), ensure_ascii=False, indent=1)
print("clips made:", made)
