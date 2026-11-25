// Rich feedback: short comment + full corrected version + error table.
// Stored inside submissions.teacher_comment as JSON {v:2, comment, corrected, errors:[[mistakeHtml, fixHtml], ...]}
// so no database change is needed. Old plain-text comments still work.
import { esc } from "./db.js?v=202611251455";

/* ---------- storage ---------- */
export function unpack(raw) {
  if (raw && raw.startsWith('{"v":2')) { try { return JSON.parse(raw); } catch {} }
  return { v: 2, comment: raw || "", corrected: "", errors: [] };
}
export function pack(fb) {
  const empty = !fb.comment && !stripTags(fb.corrected) && !fb.errors.length;
  if (empty) return null;
  if (!stripTags(fb.corrected) && !fb.errors.length) return fb.comment; // plain comment stays plain
  return JSON.stringify({ v: 2, comment: fb.comment, corrected: fb.corrected, errors: fb.errors });
}
export const stripTags = (h) => { const d = document.createElement("div"); d.innerHTML = h || ""; return d.textContent.trim(); };
export function plainText(raw) {
  const fb = unpack(raw);
  return [fb.comment, stripTags(fb.corrected), ...fb.errors.map(([a, b]) => `${stripTags(a)} → ${stripTags(b)}`)].filter(Boolean).join("\n");
}

/* ---------- sanitizer (keeps colours, bold, strike, lists, tables) ---------- */
const KEEP = new Set(["P", "BR", "B", "STRONG", "I", "EM", "U", "S", "STRIKE", "DEL", "SPAN", "UL", "OL", "LI", "TABLE", "THEAD", "TBODY", "TR", "TD", "TH", "DIV", "MARK", "SUB", "SUP", "H3", "H4"]);
const DROP = new Set(["SCRIPT", "STYLE", "META", "LINK", "TITLE", "IFRAME", "OBJECT", "IMG", "SVG", "HEAD"]);
function cleanStyle(el) {
  const s = el.style, out = [];
  const color = s.color, bg = s.backgroundColor, fw = s.fontWeight, fs = s.fontStyle, td = s.textDecorationLine || s.textDecoration;
  const isBlack = (c) => /^(rgb\(0, 0, 0\)|#000000|#000|black)$/i.test(c);
  const isWhite = (c) => /^(rgb\(255, 255, 255\)|#ffffff|#fff|white|transparent|rgba\(0, 0, 0, 0\))$/i.test(c);
  if (color && !isBlack(color)) out.push(`color:${color}`);
  if (bg && !isWhite(bg)) out.push(`background-color:${bg}`);
  if (fw && (fw === "bold" || +fw >= 600)) out.push("font-weight:700");
  if (fs === "italic") out.push("font-style:italic");
  if (td && /line-through/.test(td)) out.push("text-decoration:line-through");
  else if (td && /underline/.test(td)) out.push("text-decoration:underline");
  return out.join(";");
}
export function sanitize(html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html || "";
  const walk = (node) => {
    [...node.childNodes].forEach((ch) => {
      if (ch.nodeType === 8) return ch.remove();           // comments
      if (ch.nodeType !== 1) return;
      if (DROP.has(ch.tagName)) return ch.remove();
      walk(ch);
      // Google Docs wraps everything in <b style="font-weight:normal">
      if ((ch.tagName === "B" || ch.tagName === "STRONG") && /normal|400/.test(ch.style.fontWeight)) { ch.replaceWith(...ch.childNodes); return; }
      if (!KEEP.has(ch.tagName)) { ch.replaceWith(...ch.childNodes); return; }
      const style = cleanStyle(ch);
      const span = ch.tagName === "TD" || ch.tagName === "TH" ? [ch.getAttribute("colspan"), ch.getAttribute("rowspan")] : null;
      [...ch.attributes].forEach((a) => ch.removeAttribute(a.name));
      if (style) ch.setAttribute("style", style);
      if (span) { if (span[0]) ch.setAttribute("colspan", span[0]); if (span[1]) ch.setAttribute("rowspan", span[1]); }
      if (ch.tagName === "SPAN" && !style) ch.replaceWith(...ch.childNodes);
    });
  };
  walk(tpl.content);
  const d = document.createElement("div");
  d.appendChild(tpl.content);
  return d.innerHTML.replace(/(<br>\s*){3,}/g, "<br><br>").trim();
}

/* ---------- editing ---------- */
const TOOLS = [
  ["bold", "<b>B</b>", "Bold"], ["italic", "<i>I</i>", "Italic"], ["underline", "<u>U</u>", "Underline"], ["strikeThrough", "<s>S</s>", "Strikethrough"],
  ["red", '<span style="color:#dc2626;font-weight:700">A</span>', "Red text"], ["blue", '<span style="color:#2563eb;font-weight:700">A</span>', "Blue text"],
  ["green", '<span style="color:#15803d;font-weight:700">A</span>', "Green text"], ["hl", '<span style="background:#fde047;padding:0 3px">ab</span>', "Yellow highlight"],
  ["insertUnorderedList", "• List", "Bullet list"], ["removeFormat", "⌫ Clear", "Clear formatting"],
];
export function toolbar() {
  const bar = document.createElement("div");
  bar.className = "rt-bar";
  bar.innerHTML = TOOLS.map(([c, l, t]) => `<button type="button" data-cmd="${c}" title="${t}">${l}</button>`).join("");
  bar.addEventListener("mousedown", (e) => e.preventDefault()); // keep selection in editor
  bar.addEventListener("click", (e) => {
    const cmd = e.target.closest("[data-cmd]")?.dataset.cmd; if (!cmd) return;
    document.execCommand("styleWithCSS", false, true);
    if (cmd === "red") document.execCommand("foreColor", false, "#dc2626");
    else if (cmd === "blue") document.execCommand("foreColor", false, "#2563eb");
    else if (cmd === "green") document.execCommand("foreColor", false, "#15803d");
    else if (cmd === "hl") document.execCommand("hiliteColor", false, "#fde047");
    else if (cmd === "removeFormat") { document.execCommand("removeFormat"); document.execCommand("unlink"); }
    else document.execCommand(cmd);
  });
  return bar;
}

function pasteClean(e, onTable) {
  const html = e.clipboardData.getData("text/html");
  if (!html) return; // plain text: let the browser handle it
  e.preventDefault();
  if (onTable && /<table/i.test(html) && onTable(html)) return;
  document.execCommand("insertHTML", false, sanitize(html));
}

export function richBox(html, placeholder) {
  const box = document.createElement("div");
  box.className = "rt-box";
  box.contentEditable = "true";
  box.dataset.ph = placeholder || "";
  box.innerHTML = sanitize(html);
  box.addEventListener("paste", (e) => pasteClean(e));
  return box;
}

/** Table editor: rows of [mistake, fix]. Pasting a Docs table anywhere in it fills the rows. */
export function errorTable(rows) {
  const wrap = document.createElement("div");
  wrap.innerHTML = `<table class="fb-table edit"><thead><tr><th>Lỗi sai</th><th>Sửa (và notes)</th><th></th></tr></thead><tbody></tbody></table>
    <div class="submitbar" style="margin-top:8px"><button type="button" class="ghost sm" data-add>+ Add row</button><span class="small muted">Tip: copy a table from Google Docs and paste it into any cell to fill all rows.</span></div>`;
  const tbody = wrap.querySelector("tbody");
  const addRow = (a = "", b = "") => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td></td><td></td><td class="x"><button type="button" class="danger sm" title="Delete row">✕</button></td>`;
    [a, b].forEach((h, i) => {
      const cell = richBox(h, i ? "Correction + notes" : "Mistake");
      cell.addEventListener("paste", (e) => pasteClean(e, fromTable), true);
      tr.children[i].appendChild(cell);
    });
    tr.querySelector(".x button").onclick = () => tr.remove();
    tbody.appendChild(tr);
    return tr;
  };
  function fromTable(html) {
    const t = document.createElement("template"); t.innerHTML = html;
    const trs = [...t.content.querySelectorAll("tr")].map((tr) => [...tr.querySelectorAll("td,th")].map((c) => c.innerHTML));
    const data = trs.filter((r) => r.length >= 2);
    if (!data.length) return false;
    if (/lỗi sai|mistake/i.test(stripTags(data[0][0]))) data.shift(); // skip header row
    [...tbody.querySelectorAll("tr")].forEach((tr) => { if (!stripTags(tr.children[0].firstChild.innerHTML) && !stripTags(tr.children[1].firstChild.innerHTML)) tr.remove(); });
    data.forEach((r) => addRow(r[0], r.slice(1).join("<br>")));
    return true;
  }
  wrap.querySelector("[data-add]").onclick = () => addRow().querySelector(".rt-box").focus();
  (rows.length ? rows : [["", ""]]).forEach(([a, b]) => addRow(a, b));
  wrap.getRows = () => [...tbody.querySelectorAll("tr")].map((tr) => [sanitize(tr.children[0].firstChild.innerHTML), sanitize(tr.children[1].firstChild.innerHTML)]).filter(([a, b]) => stripTags(a) || stripTags(b));
  return wrap;
}

/** Builds the whole editor; returns {el, value()} */
export function feedbackEditor(raw) {
  const fb = unpack(raw);
  const el = document.createElement("div");
  el.innerHTML = `<label class="field">Comment</label><textarea data-c placeholder="Overall comment: what went well, what to work on…"></textarea>
    <div class="fb-label">Bản sửa đầy đủ:</div><div data-corr></div>
    <div class="fb-label">Bảng lỗi sai:</div><div data-tbl></div>`;
  el.querySelector("[data-c]").value = fb.comment || "";
  const bar = toolbar();
  const corr = richBox(fb.corrected, "Write or paste the full corrected version here. Use the red button to mark corrections.");
  el.querySelector("[data-corr]").append(bar, corr);
  const tbl = errorTable(fb.errors || []);
  const bar2 = toolbar();
  el.querySelector("[data-tbl]").append(bar2, tbl);
  return { el, value: () => pack({ comment: el.querySelector("[data-c]").value.trim(), corrected: sanitize(corr.innerHTML), errors: tbl.getRows() }) };
}

/** Read-only view for students (and teacher preview). */
export function feedbackView(raw) {
  const fb = unpack(raw);
  let h = "";
  if (fb.comment) h += `<p style="white-space:pre-wrap;margin:6px 0 0">${esc(fb.comment)}</p>`;
  if (stripTags(fb.corrected)) h += `<div class="fb-label">Bản sửa đầy đủ:</div><div class="fb-corrected">${sanitize(fb.corrected)}</div>`;
  if (fb.errors?.length) h += `<div class="fb-label">Bảng lỗi sai:</div><div class="grid-wrap"><table class="fb-table"><thead><tr><th>Lỗi sai</th><th>Sửa (và notes)</th></tr></thead><tbody>${fb.errors.map(([a, b]) => `<tr><td>${sanitize(a)}</td><td>${sanitize(b)}</td></tr>`).join("")}</tbody></table></div>`;
  return h || `<p class="muted">(no comment)</p>`;
}
