// Renders a topic's lesson notes and homework from its JSON file.
import { esc } from "./db.js?v=202611251124";

const norm = (s) => String(s ?? "").toLowerCase().replace(/[’‘`]/g, "'").replace(/[“”]/g, '"')
  .replace(/[.,!?;:"]/g, "").replace(/-/g, " ").replace(/\s+/g, " ").trim();

const BLANK = /\{([^}]+)\}/g;

/* ---------------- Lesson ---------------- */
// **bold**, *italic* inside lesson text
export const md = (t) => esc(t).replace(/\*\*\*(.+?)\*\*\*/g, "<b><i>$1</i></b>").replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, "<i>$1</i>");

export function renderLesson(el, topic) {
  if (!topic.lesson?.length) { el.innerHTML = `<div class="card"><p class="muted">No lesson notes for this topic.</p></div>`; return; }
  el.innerHTML = topic.lesson.map((b) => {
    if (b.type === "banner") return `<img class="lesson-banner${b.fit === "contain" ? " contain" : ""}" src="${esc(b.src)}" alt="" loading="lazy"${b.bg ? ` style="background:${esc(b.bg)}"` : ""}>`;
    if (b.type === "heading") return `<h2 class="lesson-h">${md(b.text)}</h2>`;
    if (b.type === "questions") return `<section class="card">${b.label ? `<div class="hl-label">${md(b.label)}</div>` : `<h2>${md(b.title)}</h2>`}${b.note ? `<p class="muted small">${md(b.note)}</p>` : ""}<ul>${b.items.map((q) => `<li>${md(q)}</li>`).join("")}</ul></section>`;
    if (b.type === "vocab") return `<section class="card">${b.label ? `<div class="hl-label">${md(b.label)}</div>` : ""}<h2>${md(b.title)}</h2><table class="t"><tr><th>Word</th><th>Meaning</th></tr>${b.rows.map((r) => `<tr><td>${r[3] ? `<button type="button" class="say" data-say="${esc(r[3])}" aria-label="Listen">🔊</button>` : ""}<b>${md(r[0])}</b><br><span class="ipa">${esc(r[1])}</span></td><td>${md(r[2])}</td></tr>`).join("")}</table></section>`;
    if (b.type === "grammar") return `<section class="card">${b.label ? `<div class="hl-label">${md(b.label)}</div>` : ""}${b.title ? `<h2>${md(b.title)}</h2>` : ""}<table class="t"><tr><th>Structure</th><th>Example</th><th>Lưu ý</th></tr>${b.rows.map((r) => `<tr><td><b>${md(r.structure)}</b></td><td>${r.examples.map(md).join("<br>")}</td><td>${md(r.note)}</td></tr>`).join("")}</table></section>`;
    if (b.type === "table") {
      const cell = (t, au) => (au ? `<button type="button" class="say" data-say="${esc(au)}" aria-label="Listen">🔊</button>` : "") + md(t).replace(/\n/g, "<br>").replace(/(^|[\s(>])(\/[^\/\s<][^\/<]*\/)/g, '$1<span class="ipa">$2</span>');
      return `<section class="card">${b.label ? `<div class="hl-label">${md(b.label)}</div>` : ""}${b.title ? `<h2>${md(b.title)}</h2>` : ""}<div class="grid-wrap"><table class="t gen"><tr>${b.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr>${b.rows.map((r, ri) => `<tr>${r.map((c, ci) => `<td>${cell(c, b.say?.[ri]?.[ci])}</td>`).join("")}</tr>`).join("")}</table></div></section>`;
    }
    if (b.type === "grammar2") return `<section class="card">${b.label ? `<div class="hl-label">${md(b.label)}</div>` : ""}${b.title ? `<h2>${md(b.title)}</h2>` : ""}<div class="grid-wrap"><table class="g2"><tr><th>Mục đích</th><th>Structure</th><th>Example</th></tr>${b.groups.map((g) => g.items.map((it, i) => `<tr>${i === 0 ? `<td class="purpose" rowspan="${g.items.length}" style="background:${esc(g.color || "#eef")}">${md(g.purpose)}</td>` : ""}<td class="struct">${md(it[0])}</td><td class="ex">${md(it[1] || "")}</td></tr>`).join("")).join("")}</table></div></section>`;
    if (b.type === "dialogue") return `<section class="card">${b.label ? `<div class="hl-label">${md(b.label)}</div>` : ""}<h2 class="dlg-title">${md(b.title)}</h2><p class="context">${md(b.context)}</p><div class="dialogue">${b.lines.map(([w, t]) => `<p>${w ? `<b class="who">${esc(w)}:</b>` : ""}${md(t)}</p>`).join("")}</div>${b.vocab?.length ? `<h3>Từ vựng cần nhớ</h3><div class="vocab-list">${b.vocab.map(([w, ipa, pos, m, au]) => `<div>${au ? `<button type="button" class="say" data-say="${esc(au)}" aria-label="Listen">🔊</button>` : ""}${w.includes("**") ? md(w) : `<b>${esc(w)}</b>`} <span class="ipa">${esc(ipa)}</span> <span class="pos">(${esc(pos)})</span>${m ? `: ${md(m)}` : ""}</div>`).join("")}</div>` : ""}${b.image ? `<a href="${esc(b.image)}" target="_blank" rel="noopener"><img class="lesson-fig" src="${esc(b.image)}" alt="" loading="lazy"></a>` : ""}</section>`;
    return "";
  }).join("");
  // 🔊 pronunciation: one shared player, clips load only when tapped
  if (!el.dataset.sayBound) {
    el.dataset.sayBound = "1";
    el.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-say]"); if (!btn) return;
      const a = sayPlayer || (sayPlayer = new Audio());
      el.querySelectorAll(".say.on").forEach((x) => x.classList.remove("on"));
      a.src = btn.dataset.say; btn.classList.add("on");
      a.onended = a.onerror = () => btn.classList.remove("on");
      a.play().catch(() => btn.classList.remove("on"));
    });
  }
}
let sayPlayer;

/* ---------------- Homework ---------------- */
// opts: { answers, locked, showScript, onSubmit(answers, score, max) }
export function renderHomework(el, topic, opts = {}) {
  const answers = opts.answers || {};
  const graded = !!opts.locked;
  const sections = topic.homework.map((s, i) => ({ ...s, key: "s" + i }));
  const exercises = sections.filter((s) => ["gapselect", "gaptype", "mcq"].includes(s.type));

  el.innerHTML = "";
  for (const s of sections) {
    if (s.type === "recording") continue;
    const card = document.createElement("section");
    card.className = "card";
    card.dataset.key = s.key;
    card.innerHTML = `<h2>${esc(s.title)}</h2>${s.instructions ? `<p class="muted small">${esc(s.instructions)}</p>` : ""}`;
    if (s.type === "gapselect" || s.type === "gaptype") card.appendChild(gapBlock(s, answers[s.key], graded));
    if (s.type === "mcq") card.appendChild(mcqBlock(s, answers[s.key], graded));
    if (s.type === "listening") card.appendChild(listeningBlock(s, opts.showScript));
    el.appendChild(card);
  }

  const result = graded ? grade(topic, answers) : null;
  if (graded) {
    const bar = document.createElement("div");
    bar.className = "scorebar";
    bar.innerHTML = `<span class="big">${result.score} / ${result.max}</span><span>Corrections are shown in each part. Wrong answers show the correct one in green.</span>`;
    el.prepend(bar);
  } else if (opts.onSubmit && exercises.length) {
    const box = document.createElement("section");
    box.className = "card";
    box.innerHTML = `<h2>Submit your answers</h2><p class="muted small">You can submit <b>once</b>. After that you'll see your score, the corrections and the listening script.</p><div class="submitbar"><button class="accent" data-submit>Submit answers</button><span class="small muted" data-msg></span></div>`;
    el.appendChild(box);
    box.querySelector("[data-submit]").onclick = async (e) => {
      const ans = collect(el, topic);
      const blanks = countEmpty(topic, ans);
      const msg = blanks ? `You have ${blanks} unanswered question${blanks > 1 ? "s" : ""}. Submit anyway? You can't change your answers afterwards.` : "Submit your answers? You can't change them afterwards.";
      if (!confirm(msg)) return;
      e.target.disabled = true; e.target.textContent = "Submitting…";
      const g = grade(topic, ans);
      try { await opts.onSubmit(ans, g.score, g.max); }
      catch (err) { e.target.disabled = false; e.target.textContent = "Submit answers"; box.querySelector("[data-msg]").textContent = "Couldn't submit: " + (err.message || err); }
    };
  }
  return { recording: sections.find((s) => s.type === "recording"), result };
}

function gapBlock(s, saved = [], graded) {
  const wrap = document.createElement("div");
  let html = "";
  if (s.context) html += `<p class="context">${esc(s.context)}</p>`;
  if (s.bank) html += `<div class="bank">${s.bank.map((w) => `<span>${esc(w)}</span>`).join("")}</div>`;
  let n = 0;
  const lines = s.lines || [["", s.text]];
  const blank = (raw) => {
    const accepted = raw.split("|");
    const idx = n++;
    const val = saved[idx] ?? "";
    const ok = graded && accepted.some((a) => norm(a) === norm(val));
    const field = s.type === "gapselect"
      ? `<select aria-label="Blank ${idx + 1}" ${graded ? "disabled" : ""}><option value="">choose…</option>${s.bank.map((w) => `<option ${w === val ? "selected" : ""}>${esc(w)}</option>`).join("")}</select>`
      : `<input class="gap" aria-label="Blank ${idx + 1}" autocomplete="off" value="${esc(val)}" ${graded ? "disabled" : ""}>`;
    return `<span class="blank ${graded ? (ok ? "ok" : "bad") : ""}"><span class="num">${idx + 1}</span>${field}<span class="key">${esc(accepted[0])}</span></span>`;
  };
  html += `<div class="dialogue ${s.type === "gaptype" ? "summary" : ""}${s.flow ? " flow" : ""}">` + lines.map(([who, text]) => {
    // escape text but keep {…} markers
    const parts = text.split(BLANK);
    let out = "";
    parts.forEach((p, i) => { out += i % 2 ? blank(p) : esc(p).replace(/\n/g, "<br>"); });
    if (s.flow) {
      // one point per line: lines starting with "•" become a bullet list
      const rows = out.split("<br>").map((l) => l.trim()).filter(Boolean);
      const body = rows.map((l) => /^•/.test(l) ? `<li>${l.replace(/^•\s*/, "")}</li>` : `<p>${l}</p>`).join("")
        .replace(/(<li>.*?<\/li>)+/g, (m) => `<ul>${m}</ul>`);
      return `<div class="flow-step">${who ? `<div class="flow-head">${esc(who)}</div>` : ""}${body}</div>`;
    }
    return `<p>${who ? `<b class="who">${esc(who)}:</b>` : ""}${out}</p>`;
  }).join(s.flow ? `<div class="flow-arrow">▼</div>` : "") + `</div>`;
  wrap.innerHTML = html;
  return wrap;
}

function mcqBlock(s, saved = [], graded) {
  const ol = document.createElement("ol");
  ol.className = "mcq";
  ol.innerHTML = s.questions.map((q, i) => {
    const pick = saved[i];
    return `<li><div class="q">${i + 1}. ${esc(q.q)}</div>${q.options.map((o, j) => {
      const cls = graded ? (j === q.answer ? "right" : j === pick ? "wrong" : "") : "";
      return `<label class="${cls}"><input type="radio" name="${s.key}-q${i}" value="${j}" ${pick === j ? "checked" : ""} ${graded ? "disabled" : ""}><span><b>${"ABCD"[j]}.</b> ${esc(o)}</span></label>`;
    }).join("")}${graded ? `<div class="why">✔ ${"ABCD"[q.answer]}: ${esc(q.why || "")}</div>` : ""}</li>`;
  }).join("");
  return ol;
}

export function audioPlayer(src, title, onTime) {
  const box = document.createElement("div");
  box.innerHTML = `<div class="player">
    <button class="play" aria-label="Play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></button>
    <div class="track"><div class="title">${esc(title)}</div><div class="bar"><i></i></div><div class="time"><span class="cur">0:00</span> / <span class="dur">–:––</span></div></div>
    <div class="speeds"><button data-s="0.75">0.75×</button><button data-s="0.9">0.9×</button><button data-s="1" class="on">1×</button><button data-s="1.15">1.15×</button></div>
  </div><audio preload="metadata" src="${esc(src)}" class="hidden"></audio>`;
  const audio = box.querySelector("audio"), btn = box.querySelector(".play"), svg = btn.querySelector("svg");
  const fill = box.querySelector(".bar i"), cur = box.querySelector(".cur"), dur = box.querySelector(".dur"), bar = box.querySelector(".bar");
  const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
  btn.onclick = () => (audio.paused ? audio.play() : audio.pause());
  audio.onplay = () => (svg.innerHTML = '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>');
  audio.onpause = () => (svg.innerHTML = '<path d="M8 5v14l11-7z"/>');
  audio.onloadedmetadata = () => (dur.textContent = fmt(audio.duration));
  audio.ontimeupdate = () => { cur.textContent = fmt(audio.currentTime); fill.style.width = (audio.currentTime / audio.duration * 100 || 0) + "%"; onTime?.(audio.currentTime, audio.paused); };
  audio.onended = () => onTime?.(-1, true);
  bar.onclick = (e) => { const r = bar.getBoundingClientRect(); audio.currentTime = (e.clientX - r.left) / r.width * audio.duration; };
  box.querySelector(".speeds").onclick = (e) => { const s = e.target.dataset.s; if (!s) return; audio.playbackRate = +s; box.querySelectorAll(".speeds button").forEach((b) => b.classList.toggle("on", b === e.target)); };
  box.audio = audio;
  return box;
}

function listeningBlock(s, showScript) {
  const wrap = document.createElement("div");
  if (s.intro) wrap.insertAdjacentHTML("beforeend", `<p class="context">${esc(s.intro)}</p>`);
  let paras = [];
  const player = audioPlayer(s.audio, s.podcast || "Listening", (t, paused) => {
    let idx = -1; paras.forEach((p, i) => { if (t >= +p.dataset.t) idx = i; });
    paras.forEach((p, i) => p.classList.toggle("now", i === idx && !paused));
  });
  wrap.appendChild(player);
  if (!showScript) {
    wrap.insertAdjacentHTML("beforeend", `<div class="notice small">🔒 The script unlocks after you submit your answers.</div>`);
    return wrap;
  }
  const scr = document.createElement("div");
  scr.innerHTML = `<div class="submitbar"><button class="ghost sm" data-toggle>Show script</button><label class="small muted hidden" data-evw><input type="checkbox" checked data-ev> Highlight answer evidence</label></div>
    <div class="script hidden">${s.script.map((p) => `<p data-t="${p.t}">${p.who ? `<span class="spk">${esc(p.who)}:</span>` : ""}${esc(p.text).replace(/==(.+?)==/g, '<mark class="ev">$1</mark>')}</p>`).join("")}<div class="small muted">Tip: click a paragraph to play from there.</div></div>`;
  wrap.appendChild(scr);
  const box = scr.querySelector(".script"), tg = scr.querySelector("[data-toggle]"), evw = scr.querySelector("[data-evw]");
  tg.onclick = () => { const open = box.classList.toggle("hidden") === false; tg.textContent = open ? "Hide script" : "Show script"; evw.classList.toggle("hidden", !open); };
  scr.querySelector("[data-ev]").onchange = (e) => box.classList.toggle("no-ev", !e.target.checked);
  paras = [...box.querySelectorAll("p[data-t]")];
  paras.forEach((p) => (p.onclick = () => { player.audio.currentTime = +p.dataset.t; player.audio.play(); }));
  return wrap;
}

/* ---------------- Answers & scoring ---------------- */
export function collect(el, topic) {
  const out = {};
  topic.homework.forEach((s, i) => {
    const key = "s" + i;
    const card = el.querySelector(`[data-key="${key}"]`);
    if (!card) return;
    if (s.type === "gapselect" || s.type === "gaptype") out[key] = [...card.querySelectorAll(".blank select, .blank input")].map((f) => f.value.trim());
    if (s.type === "mcq") out[key] = s.questions.map((_, qi) => { const c = card.querySelector(`input[name="${key}-q${qi}"]:checked`); return c ? +c.value : null; });
  });
  return out;
}

export function answerKey(s) {
  if (s.type === "mcq") return s.questions.map((q) => [q.answer]);
  const text = (s.lines || [["", s.text]]).map((l) => l[1]).join(" ");
  return [...text.matchAll(BLANK)].map((m) => m[1].split("|"));
}

export function grade(topic, answers) {
  let score = 0, max = 0;
  topic.homework.forEach((s, i) => {
    if (!["gapselect", "gaptype", "mcq"].includes(s.type)) return;
    const key = answerKey(s), given = answers["s" + i] || [];
    key.forEach((acc, j) => {
      max++;
      if (s.type === "mcq" ? given[j] === acc[0] : acc.some((a) => norm(a) === norm(given[j]))) score++;
    });
  });
  return { score, max };
}

function countEmpty(topic, answers) {
  let n = 0;
  Object.values(answers).forEach((arr) => arr.forEach((v) => { if (v === null || v === "") n++; }));
  return n;
}
