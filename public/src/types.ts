export interface TextNode {
  id: string;
  text: string;
}

export interface ElementNode {
  id: string;
  tag: string;
  attrs: Record<string, string>;
  styles: Record<string, string>;
  children: ModelNode[];
}

export type ModelNode = TextNode | ElementNode;

export type DropPosition = "before" | "after" | "inside";

export interface FileInfo {
  name: string;
  size: number;
  mtime: number;
}

export interface FilesResponse {
  cwd: string;
  files: FileInfo[];
}

export interface CreateFileResponse {
  name?: string;
  error?: string;
}

export function isTextNode(node: ModelNode): node is TextNode {
  return (node as TextNode).text !== undefined;
}
