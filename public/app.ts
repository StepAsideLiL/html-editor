interface TextNode {
  id: string;
  text: string;
}

interface ElementNode {
  id: string;
  tag: string;
  attrs: Record<string, string>;
  styles: Record<string, string>;
  children: ModelNode[];
}

type ModelNode = TextNode | ElementNode;
type DropPosition = "before" | "after" | "inside";

interface FileInfo {
  name: string;
  size: number;
  mtime: number;
}

interface FilesResponse {
  cwd: string;
  files: FileInfo[];
}

interface CreateFileResponse {
  name?: string;
  error?: string;
}

function isTextNode(node: ModelNode): node is TextNode {
  return (node as TextNode).text !== undefined;
}

function $<T extends Element = HTMLElement>(selector: string, parent: ParentNode = document): T | null {
  return parent.querySelector<T>(selector);
}

function $$<T extends Element = HTMLElement>(selector: string, parent: ParentNode = document): T[] {
  return Array.from(parent.querySelectorAll<T>(selector));
}

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

const VOID_TAGS = new Set<string>([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

const ALL_TAGS: string[] = [
  "div", "section", "article", "header", "footer", "main", "nav", "aside",
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "a", "strong", "em",
  "small", "mark", "blockquote", "pre", "code", "ul", "ol", "li", "dl",
  "dt", "dd", "table", "thead", "tbody", "tfoot", "tr", "th", "td",
  "caption", "figure", "figcaption", "img", "picture", "video", "audio",
  "source", "iframe", "canvas", "form", "label", "input", "textarea",
  "select", "option", "button", "fieldset", "legend", "hr", "br",
  "address", "time", "details", "summary", "dialog",
];

interface PaletteGroup {
  group: string;
  tags: string[];
}

const PALETTE: PaletteGroup[] = [
  { group: "Layout", tags: ["div", "section", "header", "footer", "main", "nav", "aside", "article"] },
  { group: "Text", tags: ["h1", "h2", "h3", "p", "span", "a", "blockquote", "pre", "code"] },
  { group: "Lists", tags: ["ul", "ol", "li"] },
  { group: "Media", tags: ["img", "figure", "video", "audio"] },
  { group: "Forms", tags: ["form", "input", "textarea", "select", "button", "label"] },
  { group: "Table", tags: ["table", "tr", "th", "td"] },
  { group: "Other", tags: ["hr", "br", "iframe"] },
];

const DEFAULTS: Record<string, Record<string, string>> = {
  a: { href: "#" },
  img: { src: "https://placehold.co/320x180", alt: "image" },
  input: { type: "text", placeholder: "" },
  textarea: { rows: "3" },
  button: { type: "button" },
  iframe: { src: "about:blank", width: "100%", height: "200" },
  video: { controls: "" },
  audio: { controls: "" },
  form: { method: "get" },
  ol: {},
  ul: {},
};

const DEFAULT_TEXT: Record<string, string> = {
  h1: "Heading 1", h2: "Heading 2", h3: "Heading 3",
  h4: "Heading 4", h5: "Heading 5", h6: "Heading 6",
  p: "Paragraph text.", a: "Link", button: "Button",
  li: "List item", span: "Text", strong: "Bold", em: "Italic",
  blockquote: "Quote", label: "Label", td: "Cell", th: "Header",
  option: "Option", summary: "Summary", figcaption: "Caption",
  title: "Title", legend: "Legend", caption: "Caption",
};

const CSS_PROPS: string[] = [
  "display", "position", "top", "right", "bottom", "left", "width", "height",
  "min-width", "max-width", "min-height", "max-height", "margin", "margin-top",
  "margin-right", "margin-bottom", "margin-left", "padding", "padding-top",
  "padding-right", "padding-bottom", "padding-left", "background",
  "background-color", "background-image", "background-size", "background-position",
  "color", "font-family", "font-size", "font-weight", "font-style", "line-height",
  "text-align", "text-decoration", "letter-spacing", "border", "border-radius",
  "border-color", "border-width", "border-style", "box-shadow", "opacity",
  "overflow", "z-index", "flex", "flex-direction", "justify-content",
  "align-items", "gap", "grid-template-columns", "grid-template-rows",
  "cursor", "transition", "transform",
];

let root: ElementNode = { id: "root", tag: "body", attrs: {}, styles: {}, children: [] };
let headRaw = "";
let selectedId: string | null = null;
let currentFile: string | null = null;
let dirty = false;
let dragId: string | null = null;
let dropTarget: { id: string; pos: DropPosition } | null = null;

const canvas = $<HTMLElement>("#canvas")!;
let files: FileInfo[] = [];

function elem(
  tag: string,
  children: ModelNode[] = [],
  attrs: Record<string, string> = {},
  styles: Record<string, string> = {},
): ElementNode {
  return { id: uid(), tag, attrs: { ...attrs }, styles: { ...styles }, children };
}

function makeElement(tag: string): ElementNode {
  const attrs = { ...(DEFAULTS[tag] ?? {}) };
  const children: ModelNode[] = [];
  const text = DEFAULT_TEXT[tag];
  if (text !== undefined) children.push({ id: uid(), text });
  return elem(tag, children, attrs);
}

function findNode(id: string, node: ModelNode = root): ModelNode | null {
  if (node.id === id) return node;
  if (isTextNode(node)) return null;
  for (const c of node.children) {
    const r = findNode(id, c);
    if (r) return r;
  }
  return null;
}

function findParent(id: string, node: ElementNode = root): ElementNode | null {
  for (const c of node.children) {
    if (c.id === id) return node;
    if (!isTextNode(c)) {
      const r = findParent(id, c);
      if (r) return r;
    }
  }
  return null;
}

function containsNode(ancestor: ModelNode, id: string): boolean {
  return findNode(id, ancestor) !== null;
}

function removeNode(id: string): ModelNode | null {
  const parent = findParent(id);
  if (!parent) return null;
  const i = parent.children.findIndex((c) => c.id === id);
  if (i < 0) return null;
  return parent.children.splice(i, 1)[0] ?? null;
}

function cloneNode(node: ModelNode): ModelNode {
  if (isTextNode(node)) return { id: uid(), text: node.text };
  return {
    id: uid(),
    tag: node.tag,
    attrs: { ...node.attrs },
    styles: { ...node.styles },
    children: node.children.map(cloneNode),
  };
}

function buildModel(node: Node): ModelNode | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const t = node.nodeValue;
    if (!t || t.trim() === "") return null;
    return { id: uid(), text: t.replace(/\s+/g, " ") };
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const el = node as Element;
  const attrs: Record<string, string> = {};
  const styles: Record<string, string> = {};
  for (const a of el.attributes) {
    if (a.name.toLowerCase() === "style") {
      for (const decl of a.value.split(";")) {
        const i = decl.indexOf(":");
        if (i > 0) {
          const k = decl.slice(0, i).trim();
          const v = decl.slice(i + 1).trim();
          if (k) styles[k] = v;
        }
      }
    } else {
      attrs[a.name] = a.value;
    }
  }
  const children: ModelNode[] = [];
  for (const c of el.childNodes) {
    const m = buildModel(c);
    if (m) children.push(m);
  }
  return { id: uid(), tag: el.tagName.toLowerCase(), attrs, styles, children };
}

function escHtml(s: unknown): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escAttr(s: unknown): string {
  return escHtml(s).replace(/"/g, "&quot;");
}

function serializeAttrs(node: ElementNode): string {
  let s = "";
  for (const [k, v] of Object.entries(node.attrs)) {
    if (!k) continue;
    s += ` ${k}="${escAttr(v)}"`;
  }
  const st = Object.entries(node.styles)
    .filter(([k, v]) => k && v)
    .map(([k, v]) => `${k}: ${v}`)
    .join("; ");
  if (st) s += ` style="${escAttr(st)}"`;
  return s;
}

function serializeNode(node: ModelNode, indent: number): string {
  if (isTextNode(node)) return escHtml(node.text);
  const pad = "  ".repeat(indent);
  let s = `<${node.tag}${serializeAttrs(node)}`;
  if (VOID_TAGS.has(node.tag)) return s + ">";
  s += ">";
  if (node.children.length === 0) return s + `</${node.tag}>`;
  const hasElements = node.children.some((c) => !isTextNode(c));
  if (!hasElements) {
    return s + node.children.map((c) => (isTextNode(c) ? escHtml(c.text) : "")).join("") + `</${node.tag}>`;
  }
  let inner = "";
  for (const c of node.children) inner += "\n" + "  ".repeat(indent + 1) + serializeNode(c, indent + 1);
  return s + inner + "\n" + pad + `</${node.tag}>`;
}

function serializeDoc(): string {
  let body = "";
  for (const c of root.children) body += "\n  " + serializeNode(c, 1);
  const head = headRaw.trim()
    ? headRaw.trim().replace(/\n\s*/g, "\n  ")
    : '<meta charset="UTF-8">';
  return `<!DOCTYPE html>\n<html>\n<head>\n  ${head}\n</head>\n<body${serializeAttrs(root)}>${body}\n</body>\n</html>\n`;
}

function buildEl(node: ModelNode): Node {
  if (isTextNode(node)) return document.createTextNode(node.text);
  const el = document.createElement(node.tag);
  el.dataset.eid = node.id;
  for (const [k, v] of Object.entries(node.attrs)) {
    try {
      el.setAttribute(k, v);
    } catch {}
  }
  for (const [k, v] of Object.entries(node.styles)) {
    if (k && v) el.style.setProperty(k, v);
  }
  for (const c of node.children) el.appendChild(buildEl(c));
  return el;
}

function refreshCanvas(): void {
  canvas.innerHTML = "";
  if (root.children.length === 0) {
    const d = document.createElement("div");
    d.className = "empty-canvas";
    d.textContent = "Add elements from the toolbar below to start building.";
    canvas.appendChild(d);
  } else {
    for (const c of root.children) canvas.appendChild(buildEl(c));
  }
  applySelection();
}

function applySelection(): void {
  $$("[data-eid]", canvas).forEach((e) => e.classList.remove("sel"));
  canvas.classList.toggle("body-sel", selectedId === "root");
  if (selectedId && selectedId !== "root") {
    const el = canvas.querySelector(`[data-eid="${selectedId}"]`);
    if (el) el.classList.add("sel");
  }
}

function markDirty(): void {
  dirty = true;
  updateTitle();
}

function updateTitle(): void {
  const fn = $<HTMLElement>("#fileName")!;
  fn.textContent = currentFile || "no file open";
  fn.classList.toggle("dirty", dirty);
  document.title = `${dirty ? "• " : ""}${currentFile || "html-editor"} — html-editor`;
  $<HTMLButtonElement>("#btnSave")!.disabled = !currentFile || !dirty;
}

function select(id: string | null): void {
  selectedId = id;
  applySelection();
  renderTree();
  renderProps();
}

function getElementText(node: ElementNode): string {
  return node.children.filter(isTextNode).map((c) => c.text).join("");
}

function hasElementChildren(node: ElementNode): boolean {
  return node.children.some((c) => !isTextNode(c));
}

function setElementText(node: ElementNode, value: string): void {
  node.children = node.children.filter((c) => !isTextNode(c));
  if (value) node.children.unshift({ id: uid(), text: value });
}

function addElement(tag: string): void {
  let parent: ElementNode = root;
  if (selectedId) {
    const sel = findNode(selectedId);
    if (sel) parent = isTextNode(sel) ? findParent(sel.id) ?? root : sel;
  }
  if (parent !== root && VOID_TAGS.has(parent.tag)) parent = findParent(parent.id) ?? root;
  const node = makeElement(tag);
  parent.children.push(node);
  select(node.id);
  refreshCanvas();
  markDirty();
}

async function loadFiles(): Promise<void> {
  const res = (await fetch("/api/files").then((r) => r.json())) as FilesResponse;
  files = res.files ?? [];
  renderFileList();
}

function renderFileList(): void {
  const box = $<HTMLElement>("#fileList")!;
  box.innerHTML = "";
  if (!files.length) {
    box.innerHTML = '<div class="empty-canvas" style="padding:20px 6px">No .html files found.</div>';
  }
  for (const f of files) {
    const item = document.createElement("div");
    item.className = "file-item" + (f.name === currentFile ? " active" : "");
    item.innerHTML = `<span class="name"></span><button class="del" title="Delete">×</button>`;
    item.querySelector<HTMLSpanElement>(".name")!.textContent = f.name;
    item.addEventListener("click", () => {
      openFile(f.name);
    });
    item.querySelector<HTMLButtonElement>(".del")!.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm(`Delete ${f.name}?`)) return;
      await fetch("/api/files/" + encodeURIComponent(f.name), { method: "DELETE" });
      if (currentFile === f.name) {
        currentFile = null;
        root = { id: "root", tag: "body", attrs: {}, styles: {}, children: [] };
        headRaw = "";
        selectedId = null;
        refreshCanvas();
        renderTree();
        renderProps();
        updateTitle();
      }
      loadFiles();
    });
    box.appendChild(item);
  }
}

async function openFile(name: string): Promise<void> {
  if (dirty && currentFile && !confirm("Discard unsaved changes?")) return;
  const html = await fetch("/api/files/" + encodeURIComponent(name)).then((r) => r.text());
  currentFile = name;
  dirty = false;
  loadHtml(html);
  refreshCanvas();
  renderTree();
  renderProps();
  updateTitle();
  renderFileList();
}

function loadHtml(html: string): void {
  const doc = new DOMParser().parseFromString(html, "text/html");
  headRaw = doc.head ? doc.head.innerHTML : "";
  root = { id: "root", tag: "body", attrs: {}, styles: {}, children: [] };
  const body = doc.body;
  for (const a of body.attributes) {
    if (a.name.toLowerCase() === "style") {
      for (const decl of a.value.split(";")) {
        const i = decl.indexOf(":");
        if (i > 0) root.styles[decl.slice(0, i).trim()] = decl.slice(i + 1).trim();
      }
    } else {
      root.attrs[a.name] = a.value;
    }
  }
  for (const c of body.childNodes) {
    const m = buildModel(c);
    if (m) root.children.push(m);
  }
  selectedId = null;
}

async function newFile(): Promise<void> {
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
  await loadFiles();
  if (data.name) await openFile(data.name);
}

async function saveFile(): Promise<void> {
  if (!currentFile) return;
  await fetch("/api/files/" + encodeURIComponent(currentFile), {
    method: "PUT",
    headers: { "content-type": "text/plain" },
    body: serializeDoc(),
  });
  dirty = false;
  updateTitle();
}

function preview(): void {
  const blob = new Blob([serializeDoc()], { type: "text/html" });
  window.open(URL.createObjectURL(blob), "_blank");
}

function renderTree(): void {
  const box = $<HTMLElement>("#treeBox");
  if (!box) return;
  box.innerHTML = "";
  box.appendChild(treeRow(root, 0));
  const kids = document.createElement("div");
  for (const c of root.children) kids.appendChild(treeRow(c, 1));
  box.appendChild(kids);
}

function treeRow(node: ModelNode, depth: number): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "tree-row" + (node.id === selectedId ? " sel" : "");
  row.dataset.id = node.id;
  row.style.paddingLeft = 8 + depth * 14 + "px";
  row.draggable = node.id !== "root";
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
    let pos: DropPosition = y < rect.height * 0.3 ? "before" : y > rect.height * 0.7 ? "after" : "inside";
    if (isTextNode(node) && pos === "inside") pos = "after";
    dropTarget = { id: node.id, pos };
    clearDropVisuals();
    row.classList.add("drop-" + pos);
  });
  row.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    performDrop();
  });
  row.addEventListener("dragend", () => {
    dragId = null;
    dropTarget = null;
    clearDropVisuals();
  });
  return row;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function clearDropVisuals(): void {
  $$(".tree-row").forEach((r) => r.classList.remove("drop-before", "drop-after", "drop-inside"));
}

function performDrop(): void {
  if (!dragId || !dropTarget || dragId === dropTarget.id) return;
  const dragged = findNode(dragId);
  if (!dragged) return;
  const { id, pos } = dropTarget;

  if (pos === "inside") {
    const target = findNode(id);
    if (!target || isTextNode(target)) return;
    if (containsNode(dragged, id)) return;
  } else if (containsNode(dragged, id)) {
    return;
  }

  const oldParent = findParent(dragId);
  const oldIndex = oldParent ? oldParent.children.findIndex((c) => c.id === dragId) : -1;
  removeNode(dragId);

  if (pos === "inside") {
    const target = findNode(id);
    if (target && !isTextNode(target)) target.children.push(dragged);
  } else {
    const parent = findParent(id) ?? root;
    let idx = parent.children.findIndex((c) => c.id === id);
    if (idx < 0) idx = parent.children.length;
    if (parent === oldParent && oldIndex >= 0 && oldIndex < idx) idx--;
    if (pos === "after") idx++;
    parent.children.splice(idx, 0, dragged);
  }

  dragId = null;
  dropTarget = null;
  clearDropVisuals();
  select(dragged.id);
  refreshCanvas();
  markDirty();
}

function renderProps(): void {
  const panel = $<HTMLElement>("#props")!;
  if (!selectedId) {
    panel.innerHTML = '<div class="empty">Select an element in the canvas, the tree, or add a new one to edit it.</div>';
    return;
  }
  const node = findNode(selectedId);
  if (!node) {
    selectedId = null;
    renderProps();
    return;
  }

  if (isTextNode(node)) {
    panel.innerHTML = `
      <div class="prop-head"><span class="badge">text</span></div>
      <label class="field"><span>Text</span><textarea id="pText" rows="4"></textarea></label>
      ${actionsHtml()}`;
    const ta = $<HTMLTextAreaElement>("#pText")!;
    ta.value = node.text;
    ta.addEventListener("input", () => {
      node.text = ta.value;
      refreshCanvas();
      renderTree();
      markDirty();
    });
    wireActions(node);
    return;
  }

  const tagOptions = ALL_TAGS.includes(node.tag) ? ALL_TAGS : [node.tag, ...ALL_TAGS];
  panel.innerHTML = `
    <div class="prop-head"><span class="badge">${escHtml(node.tag)}</span></div>
    <label class="field"><span>Tag</span><select id="pTag">
      ${tagOptions.map((t) => `<option ${t === node.tag ? "selected" : ""}>${t}</option>`).join("")}
    </select></label>
    ${!hasElementChildren(node) ? `<label class="field"><span>Text content</span><textarea id="pText" rows="3"></textarea></label>` : ""}
    <div class="section-title">Attributes <button class="mini" id="addAttr">+</button></div>
    <div id="attrList"></div>
    <div class="section-title">Styles <button class="mini" id="addStyle">+</button></div>
    <div id="styleList"></div>
    <datalist id="cssList">${CSS_PROPS.map((p) => `<option value="${p}">`).join("")}</datalist>
    ${actionsHtml()}`;

  const textarea = $<HTMLTextAreaElement>("#pText");
  if (textarea) {
    textarea.value = getElementText(node);
    textarea.addEventListener("input", () => {
      setElementText(node, textarea.value);
      refreshCanvas();
      renderTree();
      markDirty();
    });
  }

  $<HTMLSelectElement>("#pTag")!.addEventListener("change", (e) => {
    const newTag = (e.target as HTMLSelectElement).value;
    if (VOID_TAGS.has(newTag)) node.children = node.children.filter((c) => isTextNode(c));
    node.tag = newTag;
    refreshCanvas();
    renderTree();
    markDirty();
    renderProps();
  });

  $<HTMLButtonElement>("#addAttr")!.addEventListener("click", () => {
    let n = "class";
    let i = 1;
    while (n in node.attrs) n = "attr" + i++;
    node.attrs[n] = "";
    renderAttrs(node);
    refreshCanvas();
    markDirty();
  });
  $<HTMLButtonElement>("#addStyle")!.addEventListener("click", () => {
    let n = "color";
    let i = 1;
    while (n in node.styles) n = "prop" + i++;
    node.styles[n] = "";
    renderStyles(node);
    refreshCanvas();
    markDirty();
  });

  renderAttrs(node);
  renderStyles(node);
  wireActions(node);
}

function renderAttrs(node: ElementNode): void {
  const list = $<HTMLElement>("#attrList")!;
  list.innerHTML = "";
  for (const [key, val] of Object.entries(node.attrs)) {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `<input class="k" placeholder="name"><input class="v" placeholder="value"><button class="x" title="Remove">×</button>`;
    const k = row.querySelector<HTMLInputElement>(".k")!;
    const v = row.querySelector<HTMLInputElement>(".v")!;
    k.value = key;
    v.value = val;
    k.addEventListener("change", () => {
      const nk = k.value.trim();
      if (!nk) return;
      if (nk !== key) {
        delete node.attrs[key];
        node.attrs[nk] = v.value;
      }
      refreshCanvas();
      renderAttrs(node);
      markDirty();
    });
    v.addEventListener("input", () => {
      node.attrs[key] = v.value;
      refreshCanvas();
      markDirty();
    });
    v.addEventListener("change", () => {
      node.attrs[key] = v.value;
      refreshCanvas();
      renderAttrs(node);
      markDirty();
    });
    row.querySelector<HTMLButtonElement>(".x")!.addEventListener("click", () => {
      delete node.attrs[key];
      renderAttrs(node);
      refreshCanvas();
      markDirty();
    });
    list.appendChild(row);
  }
  if (!Object.keys(node.attrs).length)
    list.innerHTML = '<div class="empty" style="padding:4px 0">No attributes.</div>';
}

function renderStyles(node: ElementNode): void {
  const list = $<HTMLElement>("#styleList")!;
  list.innerHTML = "";
  for (const [prop, val] of Object.entries(node.styles)) {
    const row = document.createElement("div");
    row.className = "row style-row";
    row.innerHTML = `<input class="k" list="cssList" placeholder="property"><input class="v" placeholder="value"><button class="x" title="Remove">×</button>`;
    const k = row.querySelector<HTMLInputElement>(".k")!;
    const v = row.querySelector<HTMLInputElement>(".v")!;
    k.value = prop;
    v.value = val;
    k.addEventListener("change", () => {
      const np = k.value.trim();
      if (!np) return;
      if (np !== prop) {
        delete node.styles[prop];
        node.styles[np] = v.value;
      }
      refreshCanvas();
      renderStyles(node);
      markDirty();
    });
    v.addEventListener("input", () => {
      node.styles[prop] = v.value;
      refreshCanvas();
      markDirty();
    });
    v.addEventListener("change", () => {
      node.styles[prop] = v.value;
      refreshCanvas();
      renderStyles(node);
      markDirty();
    });
    row.querySelector<HTMLButtonElement>(".x")!.addEventListener("click", () => {
      delete node.styles[prop];
      renderStyles(node);
      refreshCanvas();
      markDirty();
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
  $$<HTMLElement>("[data-act]", $<HTMLElement>("#props")!).forEach((btn) => {
    btn.addEventListener("click", () => {
      const act = btn.dataset.act;
      if (act === "del") {
        const parent = findParent(node.id);
        removeNode(node.id);
        select(parent ? parent.id : "root");
      } else if (act === "dup") {
        const parent = findParent(node.id);
        if (!parent) return;
        const copy = cloneNode(node);
        const i = parent.children.findIndex((c) => c.id === node.id);
        parent.children.splice(i + 1, 0, copy);
        select(copy.id);
      } else if (act === "up" || act === "down") {
        const parent = findParent(node.id);
        if (!parent) return;
        const i = parent.children.findIndex((c) => c.id === node.id);
        const j = act === "up" ? i - 1 : i + 1;
        if (j < 0 || j >= parent.children.length) return;
        const a = parent.children[i];
        const b = parent.children[j];
        if (a === undefined || b === undefined) return;
        parent.children[i] = b;
        parent.children[j] = a;
        select(node.id);
      } else if (act === "wrap") {
        addElement("div");
        return;
      }
      refreshCanvas();
      renderTree();
      renderProps();
      markDirty();
    });
  });
}

function renderPalette(): void {
  const bar = $<HTMLElement>("#palette")!;
  bar.innerHTML = "";
  for (const g of PALETTE) {
    const box = document.createElement("div");
    box.className = "palette-group";
    const lbl = document.createElement("span");
    lbl.className = "glabel";
    lbl.textContent = g.group;
    box.appendChild(lbl);
    for (const tag of g.tags) {
      const chip = document.createElement("button");
      chip.className = "chip";
      chip.textContent = tag;
      chip.title = `Add <${tag}>`;
      chip.addEventListener("click", () => addElement(tag));
      box.appendChild(chip);
    }
    bar.appendChild(box);
  }
}

canvas.addEventListener("click", (e) => {
  const target = e.target as Element;
  if (target.closest("a")) e.preventDefault();
  const el = target.closest<HTMLElement>("[data-eid]");
  if (!el) {
    if (selectedId !== "root") select("root");
    return;
  }
  e.stopPropagation();
  const id = el.dataset.eid;
  if (id) select(id);
});

canvas.addEventListener("mouseover", (e) => {
  $$("[data-eid]", canvas).forEach((n) => n.classList.remove("hover"));
  const el = (e.target as Element).closest<HTMLElement>("[data-eid]");
  if (el) el.classList.add("hover");
});

canvas.addEventListener("mouseleave", () => {
  $$("[data-eid]", canvas).forEach((n) => n.classList.remove("hover"));
});

canvas.addEventListener("submit", (e) => e.preventDefault());
canvas.addEventListener("click", (e) => {
  if ((e.target as Element).closest("button")) e.preventDefault();
});

$<HTMLButtonElement>("#btnNew")!.addEventListener("click", newFile);
$<HTMLButtonElement>("#btnSave")!.addEventListener("click", saveFile);
$<HTMLButtonElement>("#btnPreview")!.addEventListener("click", preview);
$<HTMLButtonElement>("#btnRefresh")!.addEventListener("click", loadFiles);

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    saveFile();
  }
});

window.addEventListener("beforeunload", (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});

renderPalette();
refreshCanvas();
renderProps();
updateTitle();
loadFiles();

export {};
