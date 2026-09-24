import { colorPattern } from "./editor-validation.js";

export const fieldMap = Object.fromEntries([
  "hero-eyebrow", "hero-title", "hero-description", "hero-button-text", "hero-button-link",
  "about-label", "about-title", "about-description", "footer-text",
  "theme_primary_color", "theme_secondary_color", "theme_background_color", "theme_text_color",
  "theme_heading_font", "theme_body_font",
].map(id => [id, id.replaceAll("-", "_")]));
export const imageMap = { "site-logo": "site_logo_url", "hero-image": "hero_image_url", "about-image": "about_image_url" };

export function createEditorView(form) {
  const template = form.querySelector(".announcement-entry").cloneNode(true);
  const container = document.createElement("div");
  form.querySelector(".announcement-entry").replaceWith(container);
  const previews = new Map();
  const status = document.getElementById("editor-status");

  function showStatus(message, kind) {
    status.className = `editor-status is-${kind}`;
    status.textContent = message;
  }

  function renderAnnouncements(rows) {
    const fragment = document.createDocumentFragment();
    rows.forEach((row, index) => {
      const entry = template.cloneNode(true);
      entry.dataset.clientId = row.clientId;
      // Rewrite every ID and its accessibility references, including the heading/delete button.
      const ids = new Map();
      entry.querySelectorAll("[id]").forEach(element => {
        const oldId = element.id;
        element.id = `${oldId}-${row.clientId}`;
        ids.set(oldId, element.id);
      });
      [entry, ...entry.querySelectorAll("*")].forEach(element => {
        for (const attribute of ["for", "aria-labelledby", "aria-describedby"]) {
          if (element.hasAttribute(attribute)) element.setAttribute(attribute,
            element.getAttribute(attribute).split(" ").map(id => ids.get(id) || id).join(" "));
        }
      });
      entry.querySelector("h3").textContent = `Announcement / Event ${index + 1}`;
      entry.querySelector("button").dataset.deleteAnnouncement = "";
      entry.querySelectorAll("input, textarea").forEach(input => {
        input.dataset.field = input.name.replaceAll("-", "_");
        input.value = row[input.dataset.field];
      });
      fragment.append(entry);
    });
    container.replaceChildren(fragment);
  }

  function renderImages(state) {
    for (const [prefix, field] of Object.entries(imageMap)) {
      const file = state.media[field].file;
      let preview = previews.get(field);
      // History retains immutable Files, never these URLs. Recreate a URL when
      // restoring a File; only the currently displayed preview needs a live URL.
      if (preview?.file !== file) {
        if (preview) URL.revokeObjectURL(preview.url);
        preview = file ? { file, url: URL.createObjectURL(file) } : null;
        previews.set(field, preview);
      }
      const img = document.getElementById(`${prefix}-preview`);
      // Static seed paths are relative to the public homepage, not /admin/.
      const url = new URL(state[field], new URL("../", document.baseURI));
      if (preview) img.src = preview.url;
      else if (["http:", "https:"].includes(url.protocol)) img.src = url.href;
      else img.removeAttribute("src");
      img.alt = file ? `Selected image: ${file.name}` : `Current ${prefix.replaceAll("-", " ")} preview`;
    }
  }

  function render(state) {
    for (const [id, field] of Object.entries(fieldMap)) {
      document.getElementById(id).value = state[field];
      syncColor(id, state[field]);
    }
    form.querySelectorAll('input[type="file"]').forEach(input => { input.value = ""; });
    renderAnnouncements(state.announcements);
    renderImages(state);
  }

  function syncColor(id, value) {
    const picker = document.getElementById(`${id}_picker`);
    if (picker && colorPattern.test(value)) picker.value = value;
  }

  function feedback(errors, dirty) {
    form.querySelectorAll("[aria-invalid]").forEach(input => {
      input.removeAttribute("aria-invalid");
      input.removeAttribute("aria-describedby");
    });
    errors.forEach(error => {
      let input;
      if (error.clientId) {
        const entry = [...container.children].find(element => element.dataset.clientId === error.clientId);
        input = entry?.querySelector(`[data-field="${error.field}"]`);
      } else {
        const id = Object.keys(fieldMap).find(key => fieldMap[key] === error.field);
        const prefix = Object.keys(imageMap).find(key => imageMap[key] === error.field);
        input = document.getElementById(id || `${prefix}-input`);
      }
      if (input) {
        input.setAttribute("aria-invalid", "true");
        input.setAttribute("aria-describedby", "editor-status");
      }
    });
    if (errors.length) showStatus(`Validation problem${dirty ? " — unsaved changes" : ""}: ${errors.map(error => error.message).join(" ")}`, "error");
    else showStatus(dirty ? "Unsaved changes. Saving is not available yet; changes stay in this tab." : "Loaded / ready. Saving is not available yet.", dirty ? "warning" : "ready");
  }

  function dispose() {
    previews.forEach(preview => { if (preview) URL.revokeObjectURL(preview.url); });
    previews.clear();
  }
  return { render, renderAnnouncements, renderImages, syncColor, feedback, showStatus, dispose };
}
