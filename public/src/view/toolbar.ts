import { state } from "../store.ts";
import { $ } from "../utils.ts";
import { createFile, listFiles, preview, saveFile } from "../api.ts";

export function updateTitle(): void {
  const name = $<HTMLElement>("#fileName")!;
  name.textContent = state.currentFile || "no file open";
  name.classList.toggle("dirty", state.dirty);
  document.title = `${state.dirty ? "• " : ""}${state.currentFile || "html-editor"} — html-editor`;
  $<HTMLButtonElement>("#btnSave")!.disabled = !state.currentFile || !state.dirty;
}

export function initToolbar(): void {
  $<HTMLButtonElement>("#btnNew")!.addEventListener("click", createFile);
  $<HTMLButtonElement>("#btnSave")!.addEventListener("click", saveFile);
  $<HTMLButtonElement>("#btnPreview")!.addEventListener("click", preview);
  $<HTMLButtonElement>("#btnRefresh")!.addEventListener("click", listFiles);
}
