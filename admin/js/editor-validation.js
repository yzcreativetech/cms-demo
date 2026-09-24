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
  });
  for (const [field, selection] of Object.entries(state.media)) {
    const message = validateImage(selection.file);
    if (message) errors.push({ field, message });
  }
  return errors;
}
