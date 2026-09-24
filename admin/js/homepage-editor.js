import { loadEditorContent } from "./editor-data.js";
import { createEditorState } from "./editor-state.js";
import { createEditorView, fieldMap, imageMap } from "./editor-view.js";
import { validateEditorState, validateImage } from "./editor-validation.js";

const form = document.getElementById("homepage-editor-form");
const view = createEditorView(form);
let editor;
const selectionErrors = new Map();
const deferredControls = ["undo-button", "redo-button", "cancel-button", "restore-default-button", "save-button"];
deferredControls.forEach(id => {
  const button = document.getElementById(id);
  button.disabled = true;
  button.title = "Available in a later CMS milestone.";
});

function feedback() {
  view.feedback([...validateEditorState(editor.currentState), ...selectionErrors.values()], editor.isDirty());
}

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
