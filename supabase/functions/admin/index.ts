// Homework Hub · teacher-only account management (Supabase Edge Function "admin").
// Paste this whole file into Supabase → Edge Functions → Deploy a new function → Via Editor,
// (deployed in this project as "clever-handler")
// Supabase provides SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY automatically. Nothing else to set.
import { createClient } from "jsr:@supabase/supabase-js@2";

const STUDENT_EMAIL_DOMAIN = "students.homework-hub.app"; // must match EMAIL_DOMAIN in js/config.js

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
// Always answer 200 so the website can read the error message.
const reply = (body: unknown) => new Response(JSON.stringify(body), { headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "POST only" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  // Who is calling? Must be a signed-in teacher.
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: caller, error: authErr } = await db.auth.getUser(token);
  if (authErr || !caller?.user) return reply({ error: "Please log in again." });
  const { data: me } = await db.from("profiles").select("role").eq("id", caller.user.id).maybeSingle();
  if (me?.role !== "teacher") return reply({ error: "Teachers only." });

  let body: any;
  try { body = await req.json(); } catch { return reply({ error: "Bad request" }); }

  try {
    if (body.action === "create_student") {
      const username = String(body.username || "").trim().toLowerCase();
      const full_name = String(body.full_name || "").trim();
      if (!/^[a-z0-9._-]{3,30}$/.test(username)) return reply({ error: "Username: 3–30 characters, only letters, numbers, dots, dashes." });
      if (!full_name) return reply({ error: "Full name is required." });
      if (String(body.password || "").length < 6) return reply({ error: "Password must be at least 6 characters." });
      const { data: taken } = await db.from("profiles").select("id").eq("username", username).maybeSingle();
      if (taken) return reply({ error: `The username “${username}” is already used. Try another.` });
      const { data, error } = await db.auth.admin.createUser({ email: `${username}@${STUDENT_EMAIL_DOMAIN}`, password: body.password, email_confirm: true, user_metadata: { full_name } });
      if (error) return reply({ error: error.message });
      const { error: pErr } = await db.from("profiles").insert({ id: data.user.id, username, full_name, role: "student", class_id: body.class_id || null });
      if (pErr) { await db.auth.admin.deleteUser(data.user.id); return reply({ error: pErr.message }); }
      return reply({ ok: true, id: data.user.id });
    }

    if (body.action === "reset_password") {
      if (String(body.password || "").length < 6) return reply({ error: "Password must be at least 6 characters." });
      const { data: target } = await db.from("profiles").select("role").eq("id", body.user_id).maybeSingle();
      if (target?.role !== "student") return reply({ error: "Can only reset student passwords here." });
      const { error } = await db.auth.admin.updateUserById(body.user_id, { password: body.password });
      if (error) return reply({ error: error.message });
      return reply({ ok: true });
    }

    if (body.action === "delete_student") {
      const { data: target } = await db.from("profiles").select("role").eq("id", body.user_id).maybeSingle();
      if (target?.role !== "student") return reply({ error: "Can only remove students." });
      const { data: files } = await db.storage.from("recordings").list(body.user_id, { limit: 1000 });
      if (files?.length) await db.storage.from("recordings").remove(files.map((f) => `${body.user_id}/${f.name}`));
      const { error } = await db.auth.admin.deleteUser(body.user_id);
      if (error) return reply({ error: error.message });
      return reply({ ok: true });
    }

    return reply({ error: "Unknown action" });
  } catch (e) {
    return reply({ error: (e as Error).message || String(e) });
  }
});
