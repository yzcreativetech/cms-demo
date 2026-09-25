import { defaultContent } from "./editor-defaults.js";

export const colorPattern = /^#[0-9a-f]{6}$/i;
const fonts = new Set(["system-default", "poppins", "montserrat", "inter", "roboto", "open-sans", "lato", "merriweather"]);

export function validateImage(file) {
  if (!file) return null;
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return "Choose a PNG, JPEG, or WebP image.";
  if (!file.size || file.size > 5 * 1024 * 1024) return "Choose a non-empty image no larger than 5 MB.";
  return null;
}

export function validateEditorState(state) {
  const errors = [];
  for (const [field, value] of Object.entries(defaultContent)) {
    if (typeof value === "string" && typeof state[field] !== "string") {
      errors.push({ field, message: `${field.replaceAll("_", " ")} must be text.` });
    }
  }
  if (!Array.isArray(state.announcements) || state.announcements.some(row => !row || typeof row !== "object") ||
      !state.media || ["site_logo_url", "hero_image_url", "about_image_url"].some(field =>
        !state.media[field] || typeof state.media[field] !== "object" ||
        (state.media[field].file !== null && !(state.media[field].file instanceof File)))) {
    errors.push({ message: "Invalid editor data. Reload saved content." });
  }
  if (errors.length) return errors;
  const required = (field, value, label, clientId) => {
    if (typeof value !== "string" || !value.trim()) errors.push({ field, clientId, message: `${label} is required.` });
  };
  for (const [field, label] of Object.entries({ hero_title: "Hero title", about_title: "Our Movement heading", footer_text: "Footer text" })) {
    required(field, state[field], label);
  }
  for (const field of ["theme_primary_color", "theme_secondary_color", "theme_background_color", "theme_text_color"]) {
    if (!colorPattern.test(state[field])) errors.push({ field, message: `${field.replaceAll("_", " ")} must use six-digit hex, such as #233B82.` });
  }
  for (const field of ["theme_heading_font", "theme_body_font"]) {
    if (!fonts.has(state[field])) errors.push({ field, message: "Choose a supported font." });
  }
  if (state.hero_button_text.trim() || state.hero_button_link.trim()) {
    required("hero_button_text", state.hero_button_text, "Button text");
    required("hero_button_link", state.hero_button_link, "Button link");
  }
  if (state.hero_button_link.trim()) {
    try {
      const url = new URL(state.hero_button_link.trim(), "https://example.invalid/");
      if (!['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol)) throw new Error();
    } catch { errors.push({ field: "hero_button_link", message: "Use a page path, #anchor, HTTP(S), mailto, or tel link." }); }
  }
  state.announcements.forEach(row => {
    required("announcement_title", row.announcement_title, "Announcement title", row.clientId);
    for (const field of ["announcement_date", "announcement_description"]) {
      if (typeof row[field] !== "string") errors.push({ field, clientId: row.clientId, message: "Announcement fields must be text." });
    }
    if (!Number.isInteger(row.sort_order) || row.sort_order < 1 || row.sort_order > 2147483647) {
      errors.push({ clientId: row.clientId, message: "Invalid announcement order." });
    }
  });
  for (const field of ["site_logo_url", "hero_image_url", "about_image_url"]) {
    const selection = state.media[field];
    const message = validateImage(selection.file);
    if (message) errors.push({ field, message });
  }
  return errors;
}

export function validateForSave(state) {
  const errors = validateEditorState(state);
  if (errors.length) return errors;
  if (state.id !== 1) errors.push({ message: "The homepage must use record 1." });
  for (const field of ["site_logo_url", "hero_image_url", "about_image_url"]) {
    try {
      const url = new URL(state[field], "https://example.invalid/");
      if (!["https:", "http:"].includes(url.protocol)) throw new Error();
    } catch { errors.push({ field, message: "Use a valid HTTP(S) image URL or site path." }); }
  }
  const ids = new Set();
  const clients = new Set();
  for (const row of state.announcements || []) {
    if (!row.clientId || clients.has(row.clientId) || row.homepage_id !== 1 ||
        (row.id != null && (!Number.isSafeInteger(row.id) || row.id < 1 || ids.has(row.id)))) {
      errors.push({ message: "Invalid announcement identity. Reload saved content." });
    }
    clients.add(row.clientId);
    if (row.id != null) ids.add(row.id);
  }
  return errors;
}
