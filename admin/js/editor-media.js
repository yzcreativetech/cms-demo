import { getSupabaseClient } from "./supabase-client.js";
import { cloneState } from "./editor-state.js";
import { validateForSave } from "./editor-validation.js";

const bucketName = "cms-demo";
const images = {
  site_logo_url: { folder: "logos", label: "Logo" },
  hero_image_url: { folder: "hero", label: "Hero image" },
  about_image_url: { folder: "movement", label: "Our Movement image" },
};
const extensions = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export class EditorMediaError extends Error {}

// Memory only, independent of history. Weak keys preserve reuse across Undo/Redo
// without retaining discarded Files. No overwrite or cleanup permissions needed.
export function createMediaPersistence() {
  let journal = new WeakMap();
  let pending = false;
  return {
    get hasPendingUploads() { return pending; },
    acknowledge() { journal = new WeakMap(); pending = false; },
    async prepareForSave(current) {
      if (validateForSave(current).length) throw new EditorMediaError("Invalid editor content. Your changes are still here.");
      const output = cloneState(current);
      for (const [field, { folder, label }] of Object.entries(images)) {
        const file = current.media[field].file;
        if (!file) continue;
        try {
          const bucket = (await getSupabaseClient()).storage.from(bucketName);
          let uploads = journal.get(file);
          let entry = uploads?.get(field);
          if (!entry) {
            const path = `${folder}/${crypto.randomUUID()}.${extensions[file.type]}`;
            const { error } = await bucket.upload(path, file, { contentType: file.type, upsert: false });
            if (error) throw error;
            entry = { path, url: null };
            if (!uploads) { uploads = new Map(); journal.set(file, uploads); }
            uploads.set(field, entry);
            pending = true;
          }
          // Retain the successful path even if URL generation fails; retrying
          // that local operation must not upload the same File again.
          if (!entry.url) {
            const { data } = bucket.getPublicUrl(entry.path);
            const url = new URL(data?.publicUrl);
            if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error();
            entry.url = data.publicUrl;
          }
          output[field] = entry.url;
          output.media[field].file = null;
        } catch {
          throw new EditorMediaError(`${label} upload failed. Your changes are still here. Please try again.`);
        }
      }
      return output;
    },
  };
}
