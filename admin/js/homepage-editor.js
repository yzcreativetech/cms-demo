import { loadEditorContent } from "./editor-data.js";
import { createEditorState } from "./editor-state.js";
import { createEditorView, fieldMap, imageMap } from "./editor-view.js";
import { validateEditorState, validateImage } from "./editor-validation.js";

const form = document.getElementById("homepage-editor-form");
const view = createEditorView(form);
let editor;
const selectionErrors = new Map();
const deferredControls = ["save-button"];
const historyControls = ["undo-button", "redo-button", "cancel-button", "restore-default-button"];
historyControls.forEach(id => { document.getElementById(id).disabled = true; });
deferredControls.forEach(id => {
  const button = document.getElementById(id);
  button.disabled = true;
  button.title = "Available in a later CMS milestone.";
});

function feedback() {
  document.getElementById("undo-button").disabled = !editor.canUndo;
  document.getElementById("redo-button").disabled = !editor.canRedo;
  document.getElementById("cancel-button").disabled = !editor.isDirty();
  document.getElementById("restore-default-button").disabled = editor.isDefault();
  view.feedback([...validateEditorState(editor.currentState), ...selectionErrors.values()], editor.isDirty());
}

function restoreEditor(action) {
  if (!editor) return;
  try {
    action(view.render);
    selectionErrors.clear();
    feedback();
  } catch {
    // Do not log state, selected files, or backend/auth details.
    console.error("Editor history rendering failed; the previous state and history were retained.");
    try { view.render(editor.currentState); feedback(); } catch {
      console.error("Editor view recovery failed; reload to recover the saved version.");
    }
    view.showStatus("Unable to restore the editor view. Your previous editor state is retained. Try again or reload to recover the saved version.", "error");
  }
}

document.getElementById("undo-button").addEventListener("click", () => restoreEditor(render => editor.undo(render)));
document.getElementById("redo-button").addEventListener("click", () => restoreEditor(render => editor.redo(render)));
document.getElementById("cancel-button").addEventListener("click", () => {
  if (!editor?.isDirty()) return;
  if (window.confirm("Discard all unsaved changes and return to the last saved version?")) {
    restoreEditor(render => editor.cancel(render));
  }
});
document.getElementById("restore-default-button").addEventListener("click", () => {
  if (!editor || editor.isDefault()) return;
  if (window.confirm("Restore the editor to the default homepage content?\n\nThis will replace your current unsaved edits, but nothing will be saved until you click Save.")) {
    restoreEditor(render => editor.restoreDefaults(render));
  }
});

function handleEdit(event) {
  if (!editor) return;
  const input = event.target;
  if (input.type === "file") {
    if (event.type !== "change") return;
    const field = imageMap[input.id.replace(/-input$/, "")];
    const file = input.files[0];
    if (!field || !file) return; // Closing the chooser does not remove the previous selection.
    const message = validateImage(file);
    if (message) {
      selectionErrors.set(field, { field, message });
      input.value = "";
    } else {
      selectionErrors.delete(field);
      editor.setImage(field, file);
      view.renderImages(editor.currentState);
    }
  } else if (input.dataset.field) {
    editor.setAnnouncement(input.closest(".announcement-entry").dataset.clientId, input.dataset.field, input.value);
  } else {
    const id = input.id.replace(/_picker$/, "");
    const field = fieldMap[id];
    if (!field) return;
    editor.setField(field, input.value);
    if (id !== input.id) document.getElementById(id).value = input.value;
    view.syncColor(id, input.value);
  }
  feedback();
}

form.addEventListener("input", handleEdit);
form.addEventListener("change", handleEdit);
form.addEventListener("submit", event => {
  event.preventDefault();
  if (editor) feedback();
});
form.addEventListener("click", event => {
  if (!editor) return;
  const button = event.target.closest("button");
  if (!button) return;
  let addedId;
  if (button.id === "add-announcement-button") addedId = editor.addAnnouncement();
  else if (button.hasAttribute("data-delete-announcement")) {
    editor.deleteAnnouncement(button.closest(".announcement-entry").dataset.clientId);
  } else return;
  view.renderAnnouncements(editor.currentState.announcements);
  feedback();
  if (addedId) document.getElementById(`announcement-title-${addedId}`).focus();
  else document.getElementById("add-announcement-button").focus();
});

async function initialize() {
  const controls = [...form.querySelectorAll("input, textarea, select, button")];
  controls.forEach(control => { control.disabled = true; });
  view.showStatus("Loading saved homepage content…", "loading");
  try {
    editor = createEditorState(await loadEditorContent());
    view.render(editor.currentState);
    form.querySelectorAll("input, textarea, select, button").forEach(control => {
      control.disabled = deferredControls.includes(control.id);
    });
    feedback();
  } catch {
    editor = undefined;
    view.showStatus("Unable to load saved homepage content. Reload the page to retry. Editing is unavailable until the saved content loads.", "error");
  }
}

window.addEventListener("pagehide", event => { if (!event.persisted) view.dispose(); });
void initialize();
