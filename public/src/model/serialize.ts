import type { ElementNode, ModelNode } from "../types.ts";
import { isTextNode } from "../types.ts";
import { VOID_TAGS } from "../constants.ts";
import { escAttr, escHtml } from "../utils.ts";

export function serializeAttrs(node: ElementNode): string {
  let out = "";
  for (const [key, value] of Object.entries(node.attrs)) {
    if (!key) continue;
    out += ` ${key}="${escAttr(value)}"`;
  }
  const style = Object.entries(node.styles)
    .filter(([key, value]) => key && value)
    .map(([key, value]) => `${key}: ${value}`)
    .join("; ");
  if (style) out += ` style="${escAttr(style)}"`;
  return out;
}

export function serializeNode(node: ModelNode, indent: number): string {
  if (isTextNode(node)) return escHtml(node.text);

  const pad = "  ".repeat(indent);
  let out = `<${node.tag}${serializeAttrs(node)}`;
  if (VOID_TAGS.has(node.tag)) return out + ">";
  out += ">";

  if (node.children.length === 0) return out + `</${node.tag}>`;

  const hasElements = node.children.some((child) => !isTextNode(child));
  if (!hasElements) {
    const inner = node.children
      .map((child) => (isTextNode(child) ? escHtml(child.text) : ""))
      .join("");
    return out + inner + `</${node.tag}>`;
  }

  let inner = "";
  for (const child of node.children) {
    inner += "\n" + "  ".repeat(indent + 1) + serializeNode(child, indent + 1);
  }
  return out + inner + "\n" + pad + `</${node.tag}>`;
}

export function serializeDocument(root: ElementNode, headRaw: string): string {
  let body = "";
  for (const child of root.children) body += "\n  " + serializeNode(child, 1);
  const head = headRaw.trim() ? headRaw.trim().replace(/\n\s*/g, "\n  ") : '<meta charset="UTF-8">';
  return `<!DOCTYPE html>\n<html>\n<head>\n  ${head}\n</head>\n<body${serializeAttrs(root)}>${body}\n</body>\n</html>\n`;
}
