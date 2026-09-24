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
  let savedState = freeze(prepare(content));
  let currentState = cloneState(savedState);
  const undoStack = [];
  const redoStack = [];

  function resetHistory() {
    undoStack.length = 0;
    redoStack.length = 0;
  }

  function change(edit, render) {
    const next = cloneState(currentState);
    edit(next);
    if (statesEqual(next, currentState)) return false;
    // Render before committing: a failed render must leave state/history intact.
    render?.(cloneState(next));
    undoStack.push(cloneState(currentState));
    currentState = next;
    redoStack.length = 0;
    return true;
  }

  function travel(source, destination, render) {
    if (!source.length) return false;
    const next = cloneState(source[source.length - 1]);
    render?.(cloneState(next));
    destination.push(cloneState(currentState));
    source.pop();
    currentState = next;
    return true;
  }

  return {
    get canUndo() { return undoStack.length > 0; },
    get canRedo() { return redoStack.length > 0; },
    isDefault: () => statesEqual(currentState, defaultState),
    undo: render => travel(undoStack, redoStack, render),
    redo: render => travel(redoStack, undoStack, render),
    cancel(render) {
      const next = cloneState(savedState);
      render?.(cloneState(next));
      currentState = next;
      resetHistory();
    },
    restoreDefaults(render) {
      return change(next => {
        Object.keys(next).forEach(key => delete next[key]);
        Object.assign(next, cloneState(defaultState));
      }, render);
    },
    // Step 9 must call this ONLY after persistence succeeds, with the persisted
    // snapshot (including returned row metadata and uploaded image URLs).
    // Failure must never call this method. Save must lock edits while pending.
    acceptSavedState(persistedState = currentState, render) {
      const next = cloneState(persistedState);
      render?.(cloneState(next));
      savedState = freeze(cloneState(next));
      currentState = next;
      resetHistory();
    },
    get defaultState() { return defaultState; },
    get savedState() { return savedState; },
    // Snapshots prevent callers from mutating state outside the update methods.
    get currentState() { return cloneState(currentState); },
    isDirty: () => !statesEqual(currentState, savedState),
    setField(field, value) { return change(next => { next[field] = value; }); },
    setImage(field, file) { return change(next => { next.media[field] = { file }; }); },
    setAnnouncement(clientId, field, value) {
      return change(next => {
        const row = next.announcements.find(item => item.clientId === clientId);
        if (row) row[field] = value;
      });
    },
    addAnnouncement() {
      const row = {
        clientId: crypto.randomUUID(), homepage_id: currentState.id,
        announcement_date: "", announcement_title: "", announcement_description: "",
        sort_order: Math.max(0, ...currentState.announcements.map(item => item.sort_order)) + 1,
      };
      change(next => { next.announcements.push(row); });
      return row.clientId;
    },
    deleteAnnouncement(clientId) {
      change(next => { next.announcements = next.announcements.filter(item => item.clientId !== clientId); });
    },
  };
}
