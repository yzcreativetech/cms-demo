import { loadPublicHomepage } from "./public-data.js";

const textFields = ["hero_eyebrow", "hero_title", "hero_description", "about_label", "about_title", "about_description", "footer_text"];
const imageFields = { site_logo_url: "site-logo", hero_image_url: "hero-image", about_image_url: "about-image" };
const colors = { theme_primary_color: "--vca-blue", theme_secondary_color: "--vca-sky", theme_background_color: "--background", theme_text_color: "--text" };
const systemFont = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const fonts = Object.freeze({
  "system-default": systemFont,
  poppins: `"Poppins", ${systemFont}`, montserrat: `"Montserrat", ${systemFont}`,
  inter: `"Inter", ${systemFont}`, roboto: `"Roboto", ${systemFont}`,
  "open-sans": `"Open Sans", ${systemFont}`, lato: `"Lato", ${systemFont}`,
  merriweather: `"Merriweather", ${systemFont}`,
});

function safeURL(value, protocols) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value, document.baseURI);
    return protocols.includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

// Preparation resolves every target and builds detached nodes before any visible
// content changes. A failed read or malformed response retains the authored page.
export function prepareHydration({ homepage: home, announcements }) {
  const copyFields = [...textFields, "hero_button_text", "hero_button_link"];
  if (!home || home.id !== 1 || copyFields.some(field => typeof home[field] !== "string") ||
      !Array.isArray(announcements) || announcements.some(row => !row || row.homepage_id !== 1 ||
        !Number.isSafeInteger(row.id) || !Number.isInteger(row.sort_order) ||
        ["announcement_date", "announcement_title", "announcement_description"].some(field => typeof row[field] !== "string"))) {
    throw new Error("Invalid public content.");
  }
  const target = name => {
    const element = document.querySelector(`[data-cms="${name}"]`);
    if (!element) throw new Error("Missing public content target.");
    return element;
  };
  const text = textFields.map(field => [target(field.replaceAll("_", "-")), home[field]]);
  const images = Object.entries(imageFields).map(([field, name]) => [target(name), safeURL(home[field], ["http:", "https:"])]);
  const button = target("hero-button");
  const buttonURL = safeURL(home.hero_button_link, ["http:", "https:", "mailto:", "tel:"]);
  const hideButton = !home.hero_button_text.trim() && !home.hero_button_link.trim();
  const properties = Object.entries(colors).filter(([field]) => /^#[0-9a-f]{6}$/i.test(home[field]))
    .map(([field, property]) => [property, home[field]]);
  for (const [field, property] of [["theme_heading_font", "--heading-font"], ["theme_body_font", "--body-font"]]) {
    if (Object.hasOwn(fonts, home[field])) properties.push([property, fonts[home[field]]]);
  }
  const list = target("announcements");
  const fragment = document.createDocumentFragment();
  for (const row of announcements) {
    const card = document.createElement("article");
    card.className = "announcement-card";
    for (const [field, tag] of [["announcement_date", "p"], ["announcement_title", "h2"], ["announcement_description", "p"]]) {
      const element = document.createElement(tag);
      element.dataset.cms = field.replaceAll("_", "-");
      if (field === "announcement_date") element.className = "announcement-date";
      element.textContent = row[field];
      card.append(element);
    }
    fragment.append(card);
  }
  return () => {
    text.forEach(([element, value]) => { element.textContent = value; });
    images.forEach(([element, url]) => { if (url) element.src = url; });
    if (hideButton) button.hidden = true;
    else if (buttonURL && home.hero_button_text.trim()) {
      button.textContent = home.hero_button_text;
      button.href = buttonURL;
      button.hidden = false;
    }
    properties.forEach(([property, value]) => document.documentElement.style.setProperty(property, value));
    list.replaceChildren(fragment);
  };
}

export async function hydrateHomepage() {
  try {
    const apply = prepareHydration(await loadPublicHomepage());
    apply();
    return true;
  } catch {
    console.warn("Saved homepage content could not be loaded; static content remains in use.");
    return false;
  }
}

export const hydrationComplete = hydrateHomepage();
