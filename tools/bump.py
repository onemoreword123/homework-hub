# Stamp every local .js/.css reference with ?v=<time> so browsers load the newest code after each push.
import re, glob, time
v = time.strftime("%Y%m%d%H%M")
for f in glob.glob("docs/*.html") + glob.glob("docs/js/*.js"):
    s = open(f, encoding="utf-8").read()
    n = re.sub(r'''((?:href|src)="(?:\./)?(?:css|js)/[\w.-]+\.(?:css|js)|from\s+"\./(?:js/)?[\w.-]+\.js|import\(\s*"\./(?:js/)?[\w.-]+\.js)(?:\?v=\d+)?"''', lambda m: f'{m.group(1)}?v={v}"', s)
    if n != s: open(f, "w", encoding="utf-8").write(n); print("stamped", f)
