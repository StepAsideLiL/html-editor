import type { ChangeReason } from "./src/store.ts";
import { state, subscribe } from "./src/store.ts";
import { initCanvas, applySelection, refreshCanvas } from "./src/view/canvas.ts";
import { renderTree } from "./src/view/tree.ts";
import { renderProps } from "./src/view/properties.ts";
import { renderPalette } from "./src/view/palette.ts";
import { renderFileList } from "./src/view/fileList.ts";
import { initToolbar, updateTitle } from "./src/view/toolbar.ts";
import { listFiles, saveFile } from "./src/api.ts";

function handleChange(reason: ChangeReason): void {
  switch (reason) {
    case "select":
      applySelection();
      renderTree();
      renderProps();
      break;
    case "structure":
      refreshCanvas();
      renderTree();
      renderProps();
      break;
    case "content":
      refreshCanvas();
      renderTree();
      break;
    case "canvas":
      refreshCanvas();
      break;
    case "files":
      renderFileList();
      updateTitle();
      break;
    case "title":
      updateTitle();
      break;
  }
}

subscribe(handleChange);

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    saveFile();
  }
});

window.addEventListener("beforeunload", (e) => {
  if (state.dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});

renderPalette();
initToolbar();
initCanvas();
refreshCanvas();
renderProps();
updateTitle();
listFiles();
