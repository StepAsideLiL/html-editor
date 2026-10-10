import type { ElementNode, FileInfo } from "./types.ts";
import { ROOT_ID } from "./constants.ts";

export type ChangeReason = "select" | "structure" | "content" | "canvas" | "files" | "title";

export interface AppState {
  root: ElementNode;
  headRaw: string;
  selectedId: string | null;
  currentFile: string | null;
  dirty: boolean;
  files: FileInfo[];
}

export function emptyRoot(): ElementNode {
  return { id: ROOT_ID, tag: "body", attrs: {}, styles: {}, children: [] };
}

export const state: AppState = {
  root: emptyRoot(),
  headRaw: "",
  selectedId: null,
  currentFile: null,
  dirty: false,
  files: [],
};

type Listener = (reason: ChangeReason) => void;
const listeners = new Set<Listener>();

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emit(reason: ChangeReason): void {
  for (const listener of listeners) listener(reason);
}
