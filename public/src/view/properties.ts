import type { ElementNode, ModelNode } from "../types.ts";
import { isTextNode } from "../types.ts";
import { state } from "../store.ts";
import {
  addElement,
  deleteNode,
  duplicateNode,
  moveNode,
  removeAttribute,
  removeStyle,
  renameAttribute,
  renameStyle,
  setAttribute,
  setStyle,
  setTag,
  setTextContent,
} from "../controller.ts";
import { ALL_TAGS, CSS_PROPS } from "../constants.ts";
import { findNode, getElementText, hasElementChildren } from "../model/nodes.ts";
import { $, $$, escHtml } from "../utils.ts";

export function renderProps(): void {
  const panel = $<HTMLElement>("#props")!;
  const { selectedId } = state;

  if (!selectedId) {
    panel.innerHTML =
      '<div class="empty">Select an element in the canvas, the tree, or add a new one to edit it.</div>';
    return;
  }

  const node = findNode(selectedId);
  if (!node) {
    state.selectedId = null;
    renderProps();
    return;
  }

  if (isTextNode(node)) {
    renderTextNode(panel, node);
    return;
  }

  renderElementNode(panel, node);
}

function renderTextNode(panel: HTMLElement, node: ModelNode): void {
  panel.innerHTML = `
    <div class="prop-head"><span class="badge">text</span></div>
    <label class="field"><span>Text</span><textarea id="pText" rows="4"></textarea></label>
    ${actionsHtml()}`;

  const textarea = $<HTMLTextAreaElement>("#pText")!;
  if (isTextNode(node)) textarea.value = node.text;
  textarea.addEventListener("input", () => setTextContent(node, textarea.value));
  wireActions(node);
}

function renderElementNode(panel: HTMLElement, node: ElementNode): void {
  const tagOptions = ALL_TAGS.includes(node.tag) ? ALL_TAGS : [node.tag, ...ALL_TAGS];
  panel.innerHTML = `
    <div class="prop-head"><span class="badge">${escHtml(node.tag)}</span></div>
    <label class="field"><span>Tag</span><select id="pTag">
      ${tagOptions.map((tag) => `<option ${tag === node.tag ? "selected" : ""}>${tag}</option>`).join("")}
    </select></label>
    ${!hasElementChildren(node) ? `<label class="field"><span>Text content</span><textarea id="pText" rows="3"></textarea></label>` : ""}
    <div class="section-title">Attributes <button class="mini" id="addAttr">+</button></div>
    <div id="attrList"></div>
    <div class="section-title">Styles <button class="mini" id="addStyle">+</button></div>
    <div id="styleList"></div>
    <datalist id="cssList">${CSS_PROPS.map((prop) => `<option value="${prop}">`).join("")}</datalist>
    ${actionsHtml()}`;

  const textarea = $<HTMLTextAreaElement>("#pText");
  if (textarea) {
    textarea.value = getElementText(node);
    textarea.addEventListener("input", () => setTextContent(node, textarea.value));
  }

  $<HTMLSelectElement>("#pTag")!.addEventListener("change", (e) => {
    setTag(node, (e.target as HTMLSelectElement).value);
  });

  $<HTMLButtonElement>("#addAttr")!.addEventListener("click", () => {
    let name = "class";
    let i = 1;
    while (name in node.attrs) name = "attr" + i++;
    setAttribute(node, name, "");
    renderAttrs(node);
  });

  $<HTMLButtonElement>("#addStyle")!.addEventListener("click", () => {
    let prop = "color";
    let i = 1;
    while (prop in node.styles) prop = "prop" + i++;
    setStyle(node, prop, "");
    renderStyles(node);
  });

  renderAttrs(node);
  renderStyles(node);
  wireActions(node);
}

function renderAttrs(node: ElementNode): void {
  const list = $<HTMLElement>("#attrList")!;
  list.innerHTML = "";

  for (const [key, value] of Object.entries(node.attrs)) {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `<input class="k" placeholder="name"><input class="v" placeholder="value"><button class="x" title="Remove">×</button>`;
    const keyInput = row.querySelector<HTMLInputElement>(".k")!;
    const valueInput = row.querySelector<HTMLInputElement>(".v")!;
    keyInput.value = key;
    valueInput.value = value;

    keyInput.addEventListener("change", () => {
      const nextKey = keyInput.value.trim();
      if (!nextKey) return;
      if (nextKey !== key) renameAttribute(node, key, nextKey, valueInput.value);
      renderAttrs(node);
    });
    valueInput.addEventListener("input", () => setAttribute(node, key, valueInput.value));
    valueInput.addEventListener("change", () => {
      setAttribute(node, key, valueInput.value);
      renderAttrs(node);
    });
    row.querySelector<HTMLButtonElement>(".x")!.addEventListener("click", () => {
      removeAttribute(node, key);
      renderAttrs(node);
    });

    list.appendChild(row);
  }

  if (!Object.keys(node.attrs).length)
    list.innerHTML = '<div class="empty" style="padding:4px 0">No attributes.</div>';
}

function renderStyles(node: ElementNode): void {
  const list = $<HTMLElement>("#styleList")!;
  list.innerHTML = "";

  for (const [prop, value] of Object.entries(node.styles)) {
    const row = document.createElement("div");
    row.className = "row style-row";
    row.innerHTML = `<input class="k" list="cssList" placeholder="property"><input class="v" placeholder="value"><button class="x" title="Remove">×</button>`;
    const propInput = row.querySelector<HTMLInputElement>(".k")!;
    const valueInput = row.querySelector<HTMLInputElement>(".v")!;
    propInput.value = prop;
    valueInput.value = value;

    propInput.addEventListener("change", () => {
      const nextProp = propInput.value.trim();
      if (!nextProp) return;
      if (nextProp !== prop) renameStyle(node, prop, nextProp, valueInput.value);
      renderStyles(node);
    });
    valueInput.addEventListener("input", () => setStyle(node, prop, valueInput.value));
    valueInput.addEventListener("change", () => {
      setStyle(node, prop, valueInput.value);
      renderStyles(node);
    });
    row.querySelector<HTMLButtonElement>(".x")!.addEventListener("click", () => {
      removeStyle(node, prop);
      renderStyles(node);
    });

    list.appendChild(row);
  }

  if (!Object.keys(node.styles).length)
    list.innerHTML = '<div class="empty" style="padding:4px 0">No inline styles.</div>';
}

function actionsHtml(): string {
  return `
    <div class="actions">
      <button class="btn" data-act="dup">Duplicate</button>
      <button class="btn" data-act="up">Move up</button>
      <button class="btn" data-act="down">Move down</button>
      <button class="btn" data-act="wrap">Add child</button>
      <button class="btn danger" data-act="del">Delete</button>
    </div>`;
}

function wireActions(node: ModelNode): void {
  $$<HTMLElement>("[data-act]", $<HTMLElement>("#props")!).forEach((button) => {
    button.addEventListener("click", () => {
      switch (button.dataset.act) {
        case "del":
          deleteNode(node.id);
          break;
        case "dup":
          duplicateNode(node.id);
          break;
        case "up":
          moveNode(node.id, "up");
          break;
        case "down":
          moveNode(node.id, "down");
          break;
        case "wrap":
          addElement("div");
          break;
      }
    });
  });
}
