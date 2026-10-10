import type { ModelNode } from "../types.ts";
import { uid } from "../utils.ts";

export function buildModel(node: Node): ModelNode | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.nodeValue;
    if (!text || text.trim() === "") return null;
    return { id: uid(), text: text.replace(/\s+/g, " ") };
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const el = node as Element;
  const attrs: Record<string, string> = {};
  const styles: Record<string, string> = {};

  for (const attr of el.attributes) {
    if (attr.name.toLowerCase() === "style") {
      for (const decl of attr.value.split(";")) {
        const i = decl.indexOf(":");
        if (i > 0) {
          const key = decl.slice(0, i).trim();
          const value = decl.slice(i + 1).trim();
          if (key) styles[key] = value;
        }
      }
    } else {
      attrs[attr.name] = attr.value;
    }
  }

  const children: ModelNode[] = [];
  for (const child of el.childNodes) {
    const model = buildModel(child);
    if (model) children.push(model);
  }

  return { id: uid(), tag: el.tagName.toLowerCase(), attrs, styles, children };
}
