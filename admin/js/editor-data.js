import { getSupabaseClient } from "./supabase-client.js";
import { cloneState } from "./editor-state.js";
import { validateForSave } from "./editor-validation.js";

// Explicit schema allowlists exclude Files, client IDs, and server timestamps.
export const homepageFields = [
  "site_logo_url", "theme_primary_color", "theme_secondary_color", "theme_background_color",
  "theme_text_color", "theme_heading_font", "theme_body_font", "hero_eyebrow", "hero_title",
  "hero_description", "hero_image_url", "hero_button_text", "hero_button_link", "about_label",
  "about_title", "about_description", "about_image_url", "footer_text",
];
export function mapHomepageRow(state) {
  return Object.fromEntries(homepageFields.map(field => [field, state[field]]));
}
export function mapAnnouncementRow(row, index) {
  return { homepage_id: 1, announcement_date: row.announcement_date,
    announcement_title: row.announcement_title, announcement_description: row.announcement_description,
    sort_order: index + 1 };
}
function resultData(result) {
  if (result.error) throw result.error;
  return result.data;
}
async function loadAnnouncements(client) {
  return resultData(await client.from("homepage_announcements").select("*")
    .eq("homepage_id", 1).order("sort_order").order("id"));
}
export async function loadEditorContent() {
  const client = await getSupabaseClient();
  const [homepage, announcements] = await Promise.all([
    client.from("homepage_content").select("*").eq("id", 1).single(),
    loadAnnouncements(client),
  ]);
  return { ...resultData(homepage), announcements };
}

export class EditorSaveError extends Error {}

// One journal per editor session, separate from content/history. It tracks only
// confirmed write identities so retries cannot duplicate acknowledged inserts.
export function createEditorPersistence() {
  const inserted = new Map();
  const deleted = new Set();
  const deleting = new Set();
  let uncertainInsert;
  let pending = false;
  let busy = false;
  return {
    get hasPendingWrites() { return pending; },
    acknowledge() { inserted.clear(); deleted.clear(); deleting.clear(); pending = false; },
    async save(current, saved) {
      if (busy) throw new Error("A Save is already running.");
      const errors = validateForSave(current);
      if (errors.length) throw new Error("Invalid editor content.");
      busy = true;
      try {
        const client = await getSupabaseClient();
        const { data, error } = await client.auth.getUser();
        if (error || !data.user) throw new Error("Sign in before saving.");
        const live = await loadAnnouncements(client);
        for (const id of deleting) {
          if (!live.some(row => row.id === id)) deleted.add(id);
        }
        deleting.clear();
        if (uncertainInsert) {
          // A lost response is not permission to blindly repeat an INSERT.
          const { clientId, payload, priorIds } = uncertainInsert;
          const matches = live.filter(row => !priorIds.has(row.id) &&
            Object.entries(payload).every(([key, value]) => row[key] === value));
          if (matches.length !== 1) {
            throw new Error("The result of an announcement insert is uncertain. Retry after checking the saved announcements; automatic reinsertion is paused to avoid duplicates.");
          }
          inserted.set(clientId, matches[0].id);
          uncertainInsert = undefined;
        }
        const output = cloneState(current);
        // UPDATE only: .single() also catches zero-row/RLS-filtered updates.
        pending = true;
        Object.assign(output, resultData(await client.from("homepage_content")
          .update(mapHomepageRow(current)).eq("id", 1).select("*").single()));
        const rows = [];
        for (const [index, row] of current.announcements.entries()) {
          const payload = mapAnnouncementRow(row, index);
          let id = inserted.get(row.clientId) ?? row.id;
          if (deleted.has(id)) id = undefined;
          let record;
          if (id != null) {
            record = resultData(await client.from("homepage_announcements").update(payload)
              .eq("homepage_id", 1).eq("id", id).select("*").single());
          } else {
            uncertainInsert = { clientId: row.clientId, payload,
              priorIds: new Set([...live.map(item => item.id), ...inserted.values()]) };
            const result = await client.from("homepage_announcements").insert(payload).select("*").single();
            // SQL/PostgREST rejections confirm failure. Transport/5xx failures
            // can hide a committed insert, so retain the reconciliation record.
            if (result.error && result.status >= 400 && result.status < 500) uncertainInsert = undefined;
            record = resultData(result);
            inserted.set(row.clientId, record.id);
            uncertainInsert = undefined;
          }
          rows.push({ ...record, clientId: row.clientId });
        }
        const keep = new Set(rows.map(row => row.id));
        const remove = new Set([...saved.announcements.map(row => row.id), ...inserted.values()]);
        for (const id of remove) {
          if (id == null || keep.has(id) || deleted.has(id)) continue;
          deleting.add(id);
          const removed = resultData(await client.from("homepage_announcements").delete()
            .eq("homepage_id", 1).eq("id", id).select("id"));
          if (!removed.length) {
            // A repeated DELETE may already have succeeded before a lost response.
            const remaining = resultData(await client.from("homepage_announcements").select("id")
              .eq("homepage_id", 1).eq("id", id));
            if (remaining.length) throw new Error("An announcement could not be deleted.");
          }
          deleted.add(id);
          deleting.delete(id);
        }
        output.announcements = rows;
        return output;
      } catch {
        throw new EditorSaveError(uncertainInsert
          ? "An announcement Save could not be confirmed. Your edits are still here. Retry to check its result; automatic reinsertion is paused if the result remains uncertain."
          : pending
            ? "Save did not finish. Some changes may already be stored. Your edits and history are still here. Retry Save to finish; Cancel only restores this tab and cannot roll back database writes."
            : "We couldn't save your changes. Your edits are still here. Check your connection and sign-in, then try again.");
      } finally { busy = false; }
    },
  };
}
