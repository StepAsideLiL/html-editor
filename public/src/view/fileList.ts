import { state } from "../store.ts";
import { $ } from "../utils.ts";
import { deleteFile, openFile } from "../api.ts";

export function renderFileList(): void {
  const box = $<HTMLElement>("#fileList")!;
  box.innerHTML = "";

  if (!state.files.length) {
    box.innerHTML =
      '<div class="empty-canvas" style="padding:20px 6px">No .html files found.</div>';
    return;
  }

  for (const file of state.files) {
    const item = document.createElement("div");
    item.className = "file-item" + (file.name === state.currentFile ? " active" : "");
    item.innerHTML = `<span class="name"></span><button class="del" title="Delete">×</button>`;
    item.querySelector<HTMLSpanElement>(".name")!.textContent = file.name;

    item.addEventListener("click", () => {
      openFile(file.name);
    });
    item.querySelector<HTMLButtonElement>(".del")!.addEventListener("click", (e) => {
      e.stopPropagation();
      if (confirm(`Delete ${file.name}?`)) deleteFile(file.name);
    });

    box.appendChild(item);
  }
}
