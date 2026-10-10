import type { CreateFileResponse, FilesResponse } from "./types.ts";
import { emit, state } from "./store.ts";
import { loadDocument, resetDocument } from "./controller.ts";
import { serializeDocument } from "./model/serialize.ts";

export async function listFiles(): Promise<void> {
  const res = (await fetch("/api/files").then((r) => r.json())) as FilesResponse;
  state.files = res.files ?? [];
  emit("files");
}

export async function openFile(name: string): Promise<void> {
  if (state.dirty && state.currentFile && !confirm("Discard unsaved changes?")) return;
  const html = await fetch("/api/files/" + encodeURIComponent(name)).then((r) => r.text());
  state.currentFile = name;
  state.dirty = false;
  loadDocument(html);
  emit("files");
  emit("title");
}

export async function createFile(): Promise<void> {
  const name = prompt("New file name", "page.html");
  if (!name) return;
  const res = await fetch("/api/files", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const data = (await res.json()) as CreateFileResponse;
  if (!res.ok) {
    alert(data.error || "could not create file");
    return;
  }
  await listFiles();
  if (data.name) await openFile(data.name);
}

export async function saveFile(): Promise<void> {
  if (!state.currentFile) return;
  await fetch("/api/files/" + encodeURIComponent(state.currentFile), {
    method: "PUT",
    headers: { "content-type": "text/plain" },
    body: serializeDocument(state.root, state.headRaw),
  });
  state.dirty = false;
  emit("title");
}

export async function deleteFile(name: string): Promise<void> {
  await fetch("/api/files/" + encodeURIComponent(name), { method: "DELETE" });
  if (state.currentFile === name) {
    state.currentFile = null;
    resetDocument();
    emit("title");
  }
  await listFiles();
}

export function preview(): void {
  const blob = new Blob([serializeDocument(state.root, state.headRaw)], { type: "text/html" });
  window.open(URL.createObjectURL(blob), "_blank");
}
