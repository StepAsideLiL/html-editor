import type { DropPosition, ModelNode } from "../types.ts";
import { isTextNode } from "../types.ts";
import { state } from "../store.ts";
import { dropNode, select } from "../controller.ts";
import { $, $$, truncate } from "../utils.ts";

let dragId: string | null = null;
let dropTarget: { id: string; pos: DropPosition } | null = null;

export function renderTree(): void {
  const box = $<HTMLElement>("#treeBox");
  if (!box) return;
  box.innerHTML = "";
  box.appendChild(treeRow(state.root, 0));
  const kids = document.createElement("div");
  for (const child of state.root.children) kids.appendChild(treeRow(child, 1));
  box.appendChild(kids);
}

function treeRow(node: ModelNode, depth: number): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "tree-row" + (node.id === state.selectedId ? " sel" : "");
  row.dataset.id = node.id;
  row.style.paddingLeft = 8 + depth * 14 + "px";
  row.draggable = node.id !== state.root.id;

  const label = isTextNode(node) ? `“${truncate(node.text, 22)}”` : node.tag;
  const span = document.createElement("span");
  span.className = "tree-label" + (isTextNode(node) ? " txt" : "");
  span.textContent = label;
  row.appendChild(span);

  row.addEventListener("click", () => select(node.id));

  row.addEventListener("dragstart", (e) => {
    dragId = node.id;
    e.dataTransfer!.effectAllowed = "move";
    e.stopPropagation();
  });

  row.addEventListener("dragover", (e) => {
    if (!dragId || dragId === node.id) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = row.getBoundingClientRect();
    const y = e.clientY - rect.top;
    let pos: DropPosition =
      y < rect.height * 0.3 ? "before" : y > rect.height * 0.7 ? "after" : "inside";
    if (isTextNode(node) && pos === "inside") pos = "after";
    dropTarget = { id: node.id, pos };
    clearDropVisuals();
    row.classList.add("drop-" + pos);
  });

  row.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragId && dropTarget) dropNode(dragId, dropTarget.id, dropTarget.pos);
    dragId = null;
    dropTarget = null;
    clearDropVisuals();
  });

  row.addEventListener("dragend", () => {
    dragId = null;
    dropTarget = null;
    clearDropVisuals();
  });

  return row;
}

function clearDropVisuals(): void {
  $$(".tree-row").forEach((row) => row.classList.remove("drop-before", "drop-after", "drop-inside"));
}
