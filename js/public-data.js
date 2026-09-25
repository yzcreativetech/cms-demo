import { getSupabaseClient } from "../admin/js/supabase-client.js";

export async function loadPublicHomepage() {
  const client = await getSupabaseClient();
  const [homepage, announcements] = await Promise.all([
    client.from("homepage_content").select("*").eq("id", 1).single(),
    client.from("homepage_announcements").select("*").eq("homepage_id", 1)
      .order("sort_order", { ascending: true }).order("id", { ascending: true }),
  ]);
  if (homepage.error || announcements.error) throw new Error("Public content unavailable.");
  return { homepage: homepage.data, announcements: announcements.data };
}
