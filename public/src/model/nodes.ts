import type { ElementNode, ModelNode } from "../types.ts";
import { isTextNode } from "../types.ts";
import { DEFAULTS, DEFAULT_TEXT } from "../constants.ts";
import { uid } from "../utils.ts";
import { state } from "../store.ts";

export function elem(
  tag: string,
  children: ModelNode[] = [],
  attrs: Record<string, string> = {},
  styles: Record<string, string> = {},
): ElementNode {
  return { id: uid(), tag, attrs: { ...attrs }, styles: { ...styles }, children };
}

export function makeElement(tag: string): ElementNode {
  const attrs = { ...(DEFAULTS[tag] ?? {}) };
  const children: ModelNode[] = [];
  const text = DEFAULT_TEXT[tag];
  if (text !== undefined) children.push({ id: uid(), text });
  return elem(tag, children, attrs);
}

export function findNode(id: string, node: ModelNode = state.root): ModelNode | null {
  if (node.id === id) return node;
  if (isTextNode(node)) return null;
  for (const child of node.children) {
    const found = findNode(id, child);
    if (found) return found;
  }
  return null;
}

export function findParent(id: string, node: ElementNode = state.root): ElementNode | null {
  for (const child of node.children) {
    if (child.id === id) return node;
    if (!isTextNode(child)) {
      const found = findParent(id, child);
      if (found) return found;
    }
  }
  return null;
}

export function containsNode(ancestor: ModelNode, id: string): boolean {
  return findNode(id, ancestor) !== null;
}

export function removeNode(id: string): ModelNode | null {
  const parent = findParent(id);
  if (!parent) return null;
  const index = parent.children.findIndex((child) => child.id === id);
  if (index < 0) return null;
  return parent.children.splice(index, 1)[0] ?? null;
}

export function cloneNode(node: ModelNode): ModelNode {
  if (isTextNode(node)) return { id: uid(), text: node.text };
  return {
    id: uid(),
    tag: node.tag,
    attrs: { ...node.attrs },
    styles: { ...node.styles },
    children: node.children.map(cloneNode),
  };
}

export function getElementText(node: ElementNode): string {
  return node.children
    .filter(isTextNode)
    .map((child) => child.text)
    .join("");
}

export function hasElementChildren(node: ElementNode): boolean {
  return node.children.some((child) => !isTextNode(child));
}

export function setElementText(node: ElementNode, value: string): void {
  node.children = node.children.filter((child) => !isTextNode(child));
  if (value) node.children.unshift({ id: uid(), text: value });
}
