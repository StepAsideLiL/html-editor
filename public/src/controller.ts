import type { DropPosition, ElementNode, ModelNode } from "./types.ts";
import { isTextNode } from "./types.ts";
import { emptyRoot, emit, state } from "./store.ts";
import { VOID_TAGS } from "./constants.ts";
import {
  cloneNode,
  containsNode,
  findNode,
  findParent,
  makeElement,
  removeNode,
  setElementText,
} from "./model/nodes.ts";
import { buildModel } from "./model/parse.ts";

export function markDirty(): void {
  state.dirty = true;
  emit("title");
}

export function select(id: string | null): void {
  state.selectedId = id;
  emit("select");
}

export function resetDocument(): void {
  state.root = emptyRoot();
  state.headRaw = "";
  state.selectedId = null;
  emit("structure");
}

export function loadDocument(html: string): void {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const root = emptyRoot();
  state.headRaw = doc.head ? doc.head.innerHTML : "";

  for (const attr of doc.body.attributes) {
    if (attr.name.toLowerCase() === "style") {
      for (const decl of attr.value.split(";")) {
        const i = decl.indexOf(":");
        if (i > 0) root.styles[decl.slice(0, i).trim()] = decl.slice(i + 1).trim();
      }
    } else {
      root.attrs[attr.name] = attr.value;
    }
  }

  for (const child of doc.body.childNodes) {
    const model = buildModel(child);
    if (model) root.children.push(model);
  }

  state.root = root;
  state.selectedId = null;
  emit("structure");
}

function resolveInsertionParent(): ElementNode {
  if (!state.selectedId) return state.root;
  const selected = findNode(state.selectedId);
  if (!selected) return state.root;
  let parent = isTextNode(selected) ? (findParent(selected.id) ?? state.root) : selected;
  if (parent !== state.root && VOID_TAGS.has(parent.tag)) {
    parent = findParent(parent.id) ?? state.root;
  }
  return parent;
}

export function addElement(tag: string): void {
  const parent = resolveInsertionParent();
  const node = makeElement(tag);
  parent.children.push(node);
  state.selectedId = node.id;
  markDirty();
  emit("structure");
}

export function deleteNode(id: string): void {
  if (id === state.root.id) return;
  const parent = findParent(id);
  removeNode(id);
  state.selectedId = parent ? parent.id : state.root.id;
  markDirty();
  emit("structure");
}

export function duplicateNode(id: string): void {
  const node = findNode(id);
  const parent = findParent(id);
  if (!node || !parent) return;
  const copy = cloneNode(node);
  const index = parent.children.findIndex((child) => child.id === id);
  parent.children.splice(index + 1, 0, copy);
  state.selectedId = copy.id;
  markDirty();
  emit("structure");
}

export function moveNode(id: string, direction: "up" | "down"): void {
  const parent = findParent(id);
  if (!parent) return;
  const index = parent.children.findIndex((child) => child.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= parent.children.length) return;
  const a = parent.children[index];
  const b = parent.children[target];
  if (a === undefined || b === undefined) return;
  parent.children[index] = b;
  parent.children[target] = a;
  markDirty();
  emit("structure");
}

export function dropNode(dragId: string, targetId: string, pos: DropPosition): void {
  if (dragId === targetId) return;
  const dragged = findNode(dragId);
  if (!dragged) return;

  if (pos === "inside") {
    const target = findNode(targetId);
    if (!target || isTextNode(target)) return;
  }
  if (containsNode(dragged, targetId)) return;

  const oldParent = findParent(dragId);
  const oldIndex = oldParent ? oldParent.children.findIndex((child) => child.id === dragId) : -1;
  removeNode(dragId);

  if (pos === "inside") {
    const target = findNode(targetId);
    if (target && !isTextNode(target)) target.children.push(dragged);
  } else {
    const parent = findParent(targetId) ?? state.root;
    let index = parent.children.findIndex((child) => child.id === targetId);
    if (index < 0) index = parent.children.length;
    if (parent === oldParent && oldIndex >= 0 && oldIndex < index) index--;
    if (pos === "after") index++;
    parent.children.splice(index, 0, dragged);
  }

  state.selectedId = dragged.id;
  markDirty();
  emit("structure");
}

export function setTag(node: ElementNode, tag: string): void {
  if (VOID_TAGS.has(tag)) node.children = node.children.filter((child) => isTextNode(child));
  node.tag = tag;
  markDirty();
  emit("structure");
}

export function setTextContent(node: ModelNode, value: string): void {
  if (isTextNode(node)) node.text = value;
  else setElementText(node, value);
  markDirty();
  emit("content");
}

export function setAttribute(node: ElementNode, key: string, value: string): void {
  node.attrs[key] = value;
  markDirty();
  emit("canvas");
}

export function renameAttribute(
  node: ElementNode,
  oldKey: string,
  newKey: string,
  value: string,
): void {
  delete node.attrs[oldKey];
  node.attrs[newKey] = value;
  markDirty();
  emit("canvas");
}

export function removeAttribute(node: ElementNode, key: string): void {
  delete node.attrs[key];
  markDirty();
  emit("canvas");
}

export function setStyle(node: ElementNode, prop: string, value: string): void {
  node.styles[prop] = value;
  markDirty();
  emit("canvas");
}

export function renameStyle(
  node: ElementNode,
  oldProp: string,
  newProp: string,
  value: string,
): void {
  delete node.styles[oldProp];
  node.styles[newProp] = value;
  markDirty();
  emit("canvas");
}

export function removeStyle(node: ElementNode, prop: string): void {
  delete node.styles[prop];
  markDirty();
  emit("canvas");
}
