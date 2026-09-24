import { defaultContent } from "./editor-defaults.js";

export const mediaFields = ["site_logo_url", "hero_image_url", "about_image_url"];
// File objects are immutable; preserve them rather than JSON-serializing their contents away.
export function cloneState(value) {
  if (value === null || typeof value !== "object" || value instanceof Blob) return value;
  if (Array.isArray(value)) return value.map(cloneState);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneState(item)]));
}

function freeze(value) {
  if (value && typeof value === "object" && !(value instanceof Blob)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function prepare(content) {
  const state = cloneState(content);
  state.announcements = state.announcements.map(row => ({
    ...row, clientId: row.clientId || crypto.randomUUID(),
  }));
  state.media = Object.fromEntries(mediaFields.map(field => [field, { file: null }]));
  return state;
}

// Recursive comparison includes row metadata/order and selected File identity.
// Preview object URLs live in the view, so rendering cannot make content dirty.
export function statesEqual(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (a instanceof Blob || b instanceof Blob) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key =>
    Object.hasOwn(b, key) && statesEqual(a[key], b[key]));
}

export function createEditorState(content) {
  const defaultState = freeze(prepare(defaultContent));
  const savedState = freeze(prepare(content));
  let currentState = cloneState(savedState);
  return {
    get defaultState() { return defaultState; },
    get savedState() { return savedState; },
    // Snapshots prevent callers from mutating state outside the update methods.
    get currentState() { return cloneState(currentState); },
    isDirty: () => !statesEqual(currentState, savedState),
    setField(field, value) { currentState[field] = value; },
    setImage(field, file) { currentState.media[field] = { file }; },
    setAnnouncement(clientId, field, value) {
      const row = currentState.announcements.find(item => item.clientId === clientId);
      if (row) row[field] = value;
    },
    addAnnouncement() {
      const row = {
        clientId: crypto.randomUUID(), homepage_id: currentState.id,
        announcement_date: "", announcement_title: "", announcement_description: "",
        sort_order: Math.max(0, ...currentState.announcements.map(item => item.sort_order)) + 1,
      };
      currentState.announcements.push(row);
      return row.clientId;
    },
    deleteAnnouncement(clientId) {
      currentState.announcements = currentState.announcements.filter(item => item.clientId !== clientId);
    },
  };
}
