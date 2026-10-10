import type { ModelNode } from "../types.ts";
import { isTextNode } from "../types.ts";
import { state } from "../store.ts";
import { select } from "../controller.ts";
import { $, $$ } from "../utils.ts";

const canvas = $<HTMLElement>("#canvas")!;

export function buildEl(node: ModelNode): Node {
  if (isTextNode(node)) return document.createTextNode(node.text);
  const el = document.createElement(node.tag);
  el.dataset.eid = node.id;
  for (const [key, value] of Object.entries(node.attrs)) {
    try {
      el.setAttribute(key, value);
    } catch {}
  }
  for (const [prop, value] of Object.entries(node.styles)) {
    if (prop && value) el.style.setProperty(prop, value);
  }
  for (const child of node.children) el.appendChild(buildEl(child));
  return el;
}

export function refreshCanvas(): void {
  canvas.innerHTML = "";
  if (state.root.children.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-canvas";
    empty.textContent = "Add elements from the toolbar below to start building.";
    canvas.appendChild(empty);
  } else {
    for (const child of state.root.children) canvas.appendChild(buildEl(child));
  }
  applySelection();
}

export function applySelection(): void {
  $$("[data-eid]", canvas).forEach((el) => el.classList.remove("sel"));
  canvas.classList.toggle("body-sel", state.selectedId === state.root.id);
  const { selectedId } = state;
  if (selectedId && selectedId !== state.root.id) {
    const el = canvas.querySelector(`[data-eid="${selectedId}"]`);
    if (el) el.classList.add("sel");
  }
}

export function initCanvas(): void {
  canvas.addEventListener("click", (e) => {
    const target = e.target as Element;
    if (target.closest("a")) e.preventDefault();
    const el = target.closest<HTMLElement>("[data-eid]");
    if (!el) {
      if (state.selectedId !== state.root.id) select(state.root.id);
      return;
    }
    e.stopPropagation();
    const id = el.dataset.eid;
    if (id) select(id);
  });

  canvas.addEventListener("click", (e) => {
    if ((e.target as Element).closest("button")) e.preventDefault();
  });

  canvas.addEventListener("mouseover", (e) => {
    $$("[data-eid]", canvas).forEach((el) => el.classList.remove("hover"));
    const el = (e.target as Element).closest<HTMLElement>("[data-eid]");
    if (el) el.classList.add("hover");
  });

  canvas.addEventListener("mouseleave", () => {
    $$("[data-eid]", canvas).forEach((el) => el.classList.remove("hover"));
  });

  canvas.addEventListener("submit", (e) => e.preventDefault());
}
