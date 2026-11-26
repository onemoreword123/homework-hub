// Small visual effects + Word of the day. No libraries; respects "reduce motion".
import { esc } from "./db.js?v=202611262238";
import { md } from "./topic.js?v=202611262238";

export const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* ---------- confetti ---------- */
export function confetti(ms = 2200) {
  if (reduceMotion()) return;
  const c = document.createElement("canvas");
  c.className = "fx-confetti";
  document.body.appendChild(c);
  const ctx = c.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const resize = () => { c.width = innerWidth * dpr; c.height = innerHeight * dpr; };
  resize();
  const colors = ["#2F3E2C", "#E9D8A6", "#c2410c", "#fde047", "#6b7f4f", "#8aa0b5", "#f97316"];
  const parts = Array.from({ length: 140 }, () => ({
    x: innerWidth * (0.2 + Math.random() * 0.6) * dpr, y: innerHeight * 0.35 * dpr,
    vx: (Math.random() - 0.5) * 14 * dpr, vy: (-6 - Math.random() * 10) * dpr,
    w: (6 + Math.random() * 6) * dpr, h: (8 + Math.random() * 8) * dpr,
    r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, col: colors[(Math.random() * colors.length) | 0],
  }));
  const start = performance.now();
  (function frame(now) {
    const t = now - start;
    ctx.clearRect(0, 0, c.width, c.height);
    parts.forEach((p) => {
      p.vy += 0.35 * dpr; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - t / ms); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.col; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
    });
    if (t < ms) requestAnimationFrame(frame); else c.remove();
  })(start);
}

/* ---------- celebration after submitting ---------- */
export function celebrate(score, max) {
  const perfect = score === max;
  confetti(perfect ? 3000 : 2000);
  const box = document.createElement("div");
  box.className = "fx-pop";
  box.innerHTML = perfect
    ? `<div class="fx-trophy">🏆</div><div class="fx-big">Perfect score!</div><div>${score} / ${max}. Amazing work 👏</div>`
    : `<div class="fx-trophy">🎉</div><div class="fx-big">Submitted!</div><div>Your score: ${score} / ${max}</div>`;
  document.body.appendChild(box);
  setTimeout(() => box.classList.add("out"), 2600);
  setTimeout(() => box.remove(), 3200);
  box.onclick = () => box.remove();
}

/* ---------- Word of the day ---------- */
const VN_DATE = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }); // YYYY-MM-DD
function hash(s) { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

/** Picks today's word for a class from the lessons it has open. */
export async function wordOfTheDay(classId, topicIds, index) {
  if (!topicIds.length) return null;
  let all;
  try { all = await (await fetch("topics/words.json", { cache: "no-cache" })).json(); } catch { return null; }
  const seen = new Set(), pool = [];
  topicIds.forEach((id) => (all[id] || []).forEach((w) => {
    const k = w[0].replace(/\*/g, "").toLowerCase();
    if (seen.has(k)) return; seen.add(k);
    pool.push({ w, topic: index.find((t) => t.id === id) });
  }));
  if (!pool.length) return null;
  const today = VN_DATE();
  return { ...pool[hash(today + "|" + classId) % pool.length], date: today };
}

export function wordCard(pick, { popup = false } = {}) {
  const [term, ipa, pos, vi, audio, example] = pick.w;
  return `<div class="wotd ${popup ? "pop" : ""}">
    <div class="wotd-head"><span class="sparkle">✨</span> Word of the day</div>
    <div class="wotd-term">${audio ? `<button type="button" class="say" data-say="${esc(audio)}" aria-label="Listen">🔊</button>` : ""}${md(term.includes("**") ? term : `**${term}**`)}</div>
    <div class="wotd-ipa">${esc(ipa)}${pos ? ` <span class="pos">(${esc(pos)})</span>` : ""}</div>
    <div class="wotd-vi">${esc(vi)}</div>
    ${example ? `<div class="wotd-ex">“${md(example)}”</div>` : ""}
    ${pick.topic ? `<div class="wotd-from">from <b>${esc(pick.topic.title)}</b></div>` : ""}
    ${popup ? `<button class="accent" data-close style="margin-top:14px;width:100%;justify-content:center">Got it! 👍</button>` : ""}
  </div>`;
}

/** Shows the pop-up once a day per student. */
export function maybeWordPopup(pick, userId) {
  const key = `hh.wotd.${userId}`;
  let last = null;
  try { last = localStorage.getItem(key); } catch {}
  if (last === pick.date) return;
  const ov = document.createElement("div");
  ov.className = "fx-overlay";
  ov.innerHTML = wordCard(pick, { popup: true });
  document.body.appendChild(ov);
  bindSay(ov);
  const close = () => { try { localStorage.setItem(key, pick.date); } catch {} ov.classList.add("out"); setTimeout(() => ov.remove(), 250); };
  ov.querySelector("[data-close]").onclick = close;
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  window.addEventListener("hashchange", close, { once: true }); // leaving the page closes it too
}

let player;
export function bindSay(root) {
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-say]"); if (!b) return;
    player = player || new Audio();
    player.src = b.dataset.say; b.classList.add("on");
    player.onended = player.onerror = () => b.classList.remove("on");
    player.play().catch(() => b.classList.remove("on"));
  });
}
