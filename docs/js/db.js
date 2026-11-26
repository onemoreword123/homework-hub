import { SUPABASE_URL, SUPABASE_KEY, EMAIL_DOMAIN } from "./config.js?v=202611262247";

let client;
export async function sb() {
  if (client) return client;
  if (window.__mockSupabase) return (client = window.__mockSupabase);
  // bundled locally (one file from our own site, cached by the browser) instead of many small files from a CDN
  const { createClient } = await import("./vendor/supabase.min.js");
  client = createClient(SUPABASE_URL, SUPABASE_KEY);
  return client;
}

export const toEmail = (u) => (u.includes("@") ? u.trim() : `${u.trim().toLowerCase()}@${EMAIL_DOMAIN}`);

export async function signIn(username, password) {
  const c = await sb();
  const { data, error } = await c.auth.signInWithPassword({ email: toEmail(username), password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const c = await sb();
  await c.auth.signOut();
  location.href = "index.html";
}

/** Returns {user, profile} or redirects to login. */
export async function requireUser(role) {
  const c = await sb();
  const { data } = await c.auth.getSession();
  const user = data.session?.user;
  if (!user) { location.href = "index.html"; throw new Error("not signed in"); }
  // Use the profile saved on this device straight away (saves a round trip to the database),
  // then refresh it in the background. The database's own rules still protect all data.
  const PK = "hh.profile." + user.id;
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(PK) || "null"); } catch (e) {}
  const fresh = Promise.resolve(c.from("profiles").select("*").eq("id", user.id).maybeSingle()).then(({ data: p }) => {
    try { p ? localStorage.setItem(PK, JSON.stringify(p)) : localStorage.removeItem(PK); } catch (e) {}
    if (cached && (!p || p.role !== cached.role || p.class_id !== cached.class_id)) location.reload();
    return p;
  });
  const profile = cached || (await fresh);
  if (!profile) {
    document.body.innerHTML = `<div class="wrap"><div class="card"><h2>Account not set up</h2><p>Your login works, but it has no profile yet. Ask your teacher to check your account.</p><button onclick="history.back()">Back</button></div></div>`;
    throw new Error("no profile");
  }
  if (role && profile.role !== role) {
    location.href = profile.role === "teacher" ? "teacher.html" : "student.html";
    throw new Error("wrong role");
  }
  return { user, profile, session: data.session };
}

const topicCache = {};
export async function loadTopicIndex() {
  const r = await fetch("topics/index.json", { cache: "no-cache" });
  return r.json();
}
export async function loadTopic(id) {
  if (!topicCache[id]) topicCache[id] = fetch(`topics/${id}.json`, { cache: "no-cache" }).then((r) => {
    if (!r.ok) throw new Error("Topic not found");
    return r.json();
  });
  return topicCache[id];
}

export function toast(msg, ms = 2600) {
  const t = document.createElement("div");
  t.className = "toast"; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export async function signedUrl(path) {
  if (!path) return null;
  const c = await sb();
  const { data, error } = await c.storage.from("recordings").createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}
