// Paste only the Project URL and public anon/publishable key here.
const SUPABASE_URL = "https://heuuvmgrfpcqwsccjzee.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhldXV2bWdyZnBjcXdzY2NqemVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5Njc5MzEsImV4cCI6MjEwNTU0MzkzMX0.iudE6Iwe-lTxXXKZBWoyNitaH5iQpkpCPFONT0qkCHs";

let clientPromise;

function validateConfiguration() {
  let url;
  let publicKey = /^sb_publishable_[A-Za-z0-9_-]+$/.test(SUPABASE_ANON_KEY);
  try {
    url = new URL(SUPABASE_URL);
    if (!publicKey) {
      const payload = SUPABASE_ANON_KEY.split(".")[1];
      const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
      publicKey = JSON.parse(atob(normalized)).role === "anon";
    }
  } catch {
    publicKey = false;
  }
  if (!url || url.protocol !== "https:" || url.username || url.password || !publicKey) {
    const error = new Error(
      "Configure SUPABASE_URL and SUPABASE_ANON_KEY in admin/js/supabase-client.js with the Project URL and public frontend key."
    );
    error.code = "AUTH_CONFIGURATION";
    throw error;
  }
}

// Lazy loading lets the UI handle configuration/CDN errors without an unhandled import.
// Every caller shares this one client, including concurrent callers.
export async function getSupabaseClient() {
  validateConfiguration();
  if (!clientPromise) {
    clientPromise = import("https://esm.sh/@supabase/supabase-js@2.57.4")
      .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      }))
      .catch((error) => {
        clientPromise = undefined;
        throw error;
      });
  }
  return clientPromise;
}
