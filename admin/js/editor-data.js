import { getSupabaseClient } from "./supabase-client.js";

// Step 7 bootstrap only. All persistence belongs to the later Save milestone.
export async function loadEditorContent() {
  const client = await getSupabaseClient();
  const [homepage, announcements] = await Promise.all([
    client.from("homepage_content").select("*").eq("id", 1).single(),
    client.from("homepage_announcements").select("*").eq("homepage_id", 1)
      .order("sort_order").order("id"),
  ]);
  if (homepage.error) throw homepage.error;
  if (announcements.error) throw announcements.error;
  return { ...homepage.data, announcements: announcements.data };
}
