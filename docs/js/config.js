// Fill these two values from Supabase → Project Settings → API.
// Both are safe to be public (security is enforced by the database rules).
export const SUPABASE_URL = "https://fnropmievaezmflbrftw.supabase.co";
export const SUPABASE_KEY = "sb_publishable_eYskwBWxr9qm2zb_GGRDAg_7r2wsmjE";

// Students log in with a username; behind the scenes it becomes username@this-domain.
// No emails are ever sent to it. Must match STUDENT_EMAIL_DOMAIN in the Netlify function.
export const EMAIL_DOMAIN = "students.homework-hub.app";

export const MAX_RECORDING_SECONDS = 180;
