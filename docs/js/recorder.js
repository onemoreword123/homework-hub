// Speaking task: pick an option, record in the browser (or upload a file), submit.
import { esc, fmtDate } from "./db.js?v=202611262138";
import { MAX_RECORDING_SECONDS } from "./config.js?v=202611262138";

const MIC = '<svg viewBox="0 0 24 24"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12z"/></svg>';
const STOP = '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';

function pickMime() {
  const types = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"];
  return types.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported?.(t)) || "";
}
const extFor = (mime) => (mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : mime.includes("mpeg") ? "mp3" : mime.includes("wav") ? "wav" : "webm");

/**
 * opts: { submission, currentUrl, locked, onSave(blob, ext, optionIndex) }
 */
export function renderRecording(el, section, opts) {
  const sub = opts.submission || {};
  const chosen = sub.recording_option != null && sub.recording_option !== "" ? +sub.recording_option : null;
  el.innerHTML = `<section class="card">
    <h2>${esc(section.title)}</h2>
    <p class="muted small">${esc(section.instructions || "")}</p>
    ${!opts.locked && section.options.length > 1 ? `<div class="step-label">Step 1 · Tap the option you will talk about</div>` : ""}
    <div class="options">${section.options.map((o, i) => `
      <label class="opt"><span class="ttl"><input type="radio" name="recopt" value="${i}" ${chosen === i || (section.options.length === 1 && chosen === null) ? "checked" : ""} ${opts.locked ? "disabled" : ""}>${section.options.length > 1 ? `Option ${i + 1}: ` : ""}${esc(o.title)}</span>
        ${o.choices?.length ? `<ul class="choices">${o.choices.map((q) => `<li>${esc(q)}</li>`).join("")}</ul>` : ""}
        ${o.questionsLabel ? `<div class="qlabel">${esc(o.questionsLabel)}</div>` : ""}
        <ul>${o.questions.map((q) => `<li>${esc(q)}</li>`).join("")}</ul>
        ${o.use ? `<div class="use"><b>Try to use:</b> ${esc(o.use)}</div>` : ""}</label>`).join("")}</div>
    <div data-current></div>
    ${!opts.locked ? `<div class="step-label">${section.options.length > 1 ? "Step 2 · " : ""}Record your answer</div>` : ""}
    <div data-rec></div>
  </section>`;

  const cur = el.querySelector("[data-current]");
  if (sub.recording_path) {
    cur.innerHTML = `<div class="notice ok">✅ Recording submitted ${fmtDate(sub.recording_submitted_at)}${chosen != null && section.options.length > 1 ? ` (Option ${chosen + 1})` : ""}.${opts.locked ? " Your teacher has reviewed it." : " You can record again to replace it until your teacher reviews it."}</div>${opts.currentUrl ? `<audio controls src="${esc(opts.currentUrl)}"></audio>` : ""}`;
  }
  if (opts.locked) return;

  const rec = el.querySelector("[data-rec]");
  rec.innerHTML = `<div class="recorder">
      <div class="rectime">0:00</div>
      <div class="small muted" data-hint>Press the red button to start recording (max ${Math.round(MAX_RECORDING_SECONDS / 60)} min).</div>
      <button class="recbtn" aria-label="Record">${MIC}</button>
      <div data-preview class="hidden">
        <audio controls></audio>
        <div class="submitbar" style="justify-content:center">
          <button class="accent" data-send>Submit recording</button>
          <button class="ghost" data-redo>Record again</button>
        </div>
      </div>
      <div class="small muted" style="margin-top:12px">Can't record here? <label style="text-decoration:underline;cursor:pointer;color:var(--navy)">upload an audio file<input type="file" accept="audio/*" class="hidden" data-file></label></div>
      <div class="small" data-msg></div>
    </div>`;

  const btn = rec.querySelector(".recbtn"), time = rec.querySelector(".rectime"), hint = rec.querySelector("[data-hint]");
  const preview = rec.querySelector("[data-preview]"), pAudio = preview.querySelector("audio"), msg = rec.querySelector("[data-msg]");
  let mr, chunks = [], timer, secs = 0, blob = null, ext = "webm", stream;

  const fmt = (t) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
  const option = () => { const c = el.querySelector('input[name="recopt"]:checked'); return c ? +c.value : null; };
  const showPreview = (b, e) => {
    blob = b; ext = e; pAudio.src = URL.createObjectURL(b); preview.classList.remove("hidden"); btn.classList.add("hidden");
    hint.textContent = option() === null ? "Listen back. Then tap an option above (Step 1) and submit." : "Listen back, then submit or record again.";
    pAudio.onloadedmetadata = () => { if (isFinite(pAudio.duration)) time.textContent = fmt(Math.round(pAudio.duration)); };
  };
  // picking an option clears the warning
  el.querySelectorAll('input[name="recopt"]').forEach((r) => r.addEventListener("change", () => {
    el.querySelector(".options").classList.remove("need"); msg.textContent = "";
    if (blob) hint.textContent = "Listen back, then submit or record again.";
  }));

  async function start() {
    msg.textContent = "";
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { msg.innerHTML = '<span style="color:var(--bad)">Microphone blocked. Allow microphone access in your browser settings, or upload a file instead.</span>'; return; }
    const mime = pickMime();
    mr = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 48000 } : undefined);
    chunks = []; secs = 0; time.textContent = "0:00";
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    mr.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const type = mr.mimeType || mime || "audio/webm";
      showPreview(new Blob(chunks, { type }), extFor(type));
    };
    mr.start(1000);
    btn.classList.add("on"); btn.innerHTML = STOP; hint.textContent = "Recording… press stop when you finish.";
    timer = setInterval(() => { secs++; time.textContent = fmt(secs); if (secs >= MAX_RECORDING_SECONDS) stop(); }, 1000);
  }
  function stop() { clearInterval(timer); btn.classList.remove("on"); btn.innerHTML = MIC; if (mr?.state === "recording") mr.stop(); }

  btn.onclick = () => (mr?.state === "recording" ? stop() : start());
  rec.querySelector("[data-redo]").onclick = () => { blob = null; preview.classList.add("hidden"); btn.classList.remove("hidden"); time.textContent = "0:00"; hint.textContent = "Press the red button to start recording."; };
  rec.querySelector("[data-file]").onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 15 * 1024 * 1024) { msg.innerHTML = '<span style="color:var(--bad)">That file is too big (max 15 MB).</span>'; return; }
    showPreview(f, extFor(f.type || f.name));
  };
  rec.querySelector("[data-send]").onclick = async (e) => {
    if (option() === null) {
      const box = el.querySelector(".options");
      msg.innerHTML = '<span style="color:var(--bad)">⬆️ Please tap the option you talked about (Option 1, 2 or 3), then press Submit again. Your recording is safe.</span>';
      box.classList.remove("need"); void box.offsetWidth; box.classList.add("need");
      box.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!blob) return;
    e.target.disabled = true; e.target.textContent = "Uploading…"; msg.textContent = "";
    try { await opts.onSave(blob, ext, option()); }
    catch (err) { msg.innerHTML = `<span style="color:var(--bad)">Upload failed: ${esc(err.message || err)}. Please try again.</span>`; e.target.disabled = false; e.target.textContent = "Submit recording"; }
  };
}
