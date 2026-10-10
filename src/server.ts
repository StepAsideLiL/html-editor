import { join, resolve, dirname, basename } from "node:path";
import { readdir, stat, readFile, writeFile, unlink } from "node:fs/promises";

type Server = ReturnType<typeof Bun.serve>;

interface FileInfo {
  name: string;
  size: number;
  mtime: number;
}

interface CreateFileBody {
  name?: string;
  content?: string;
}

interface CreateFileResult {
  ok: true;
  name: string;
}

interface SaveResult {
  ok: true;
  name: string;
}

interface ApiError {
  error: string;
}

interface FilesResponse {
  cwd: string;
  files: FileInfo[];
}

const PUBLIC_DIR = join(import.meta.dir, "..", "public");

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
};

const HTML_RE = /\.html?$/i;

const appTranspiler = new Bun.Transpiler({ loader: "ts" });

function json<T extends object>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function template(name: string): string {
  const title = name.replace(HTML_RE, "") || "Page";
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body>
  <h1>${title}</h1>
  <p>Start building your page.</p>
</body>
</html>
`;
}

function resolveFile(cwd: string, name: string): string {
  const base = basename(String(name || "").trim());
  if (!base || !HTML_RE.test(base)) throw new Error("only .html / .htm files are allowed");
  const fp = resolve(cwd, base);
  if (dirname(fp) !== resolve(cwd)) throw new Error("invalid path");
  return fp;
}

async function listFiles(cwd: string): Promise<FileInfo[]> {
  const entries = await readdir(cwd, { withFileTypes: true });
  const out: FileInfo[] = [];
  for (const e of entries) {
    if (!e.isFile() || !HTML_RE.test(e.name)) continue;
    const s = await stat(join(cwd, e.name));
    out.push({ name: e.name, size: s.size, mtime: s.mtimeMs });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

async function handleApi(req: Request, url: URL, cwd: string): Promise<Response> {
  const route = url.pathname.slice("/api/".length);

  if (route === "files") {
    if (req.method === "GET") {
      return json<FilesResponse>({ cwd, files: await listFiles(cwd) });
    }
    if (req.method === "POST") {
      const body = (await req.json().catch(() => ({}))) as CreateFileBody;
      let name = String(body.name || "page.html").trim();
      if (!HTML_RE.test(name)) name += ".html";
      const fp = resolveFile(cwd, name);
      if (await Bun.file(fp).exists()) return json<ApiError>({ error: "file already exists" }, 409);
      await writeFile(fp, body.content ?? template(name), "utf8");
      return json<CreateFileResult>({ ok: true, name: basename(fp) }, 201);
    }
  }

  if (route.startsWith("files/")) {
    const name = decodeURIComponent(route.slice("files/".length));
    const fp = resolveFile(cwd, name);
    if (req.method === "GET") {
      if (!(await Bun.file(fp).exists())) return json<ApiError>({ error: "not found" }, 404);
      const content = await readFile(fp, "utf8");
      return new Response(content, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
    if (req.method === "PUT") {
      const content = await req.text();
      await writeFile(fp, content, "utf8");
      return json<SaveResult>({ ok: true, name });
    }
    if (req.method === "DELETE") {
      if (!(await Bun.file(fp).exists())) return json<ApiError>({ error: "not found" }, 404);
      await unlink(fp);
      return json({ ok: true });
    }
  }

  return json<ApiError>({ error: "unknown route" }, 404);
}

async function serveStatic(pathname: string): Promise<Response> {
  const path = pathname === "/" ? "/index.html" : pathname;

  if (path === "/app.js") {
    const src = await readFile(join(PUBLIC_DIR, "app.ts"), "utf8");
    return new Response(appTranspiler.transformSync(src), {
      headers: { "content-type": "text/javascript; charset=utf-8" },
    });
  }

  const file = resolve(PUBLIC_DIR, "." + path);
  const sep = process.platform === "win32" ? "\\" : "/";
  if (file !== PUBLIC_DIR && !file.startsWith(PUBLIC_DIR + sep)) {
    return new Response("forbidden", { status: 403 });
  }
  const f = Bun.file(file);
  if (!(await f.exists())) return new Response("not found", { status: 404 });
  const ext = file.slice(file.lastIndexOf(".")).toLowerCase();
  return new Response(f, {
    headers: { "content-type": CONTENT_TYPES[ext] ?? "application/octet-stream" },
  });
}

function makeHandler(cwd: string): (req: Request) => Promise<Response> {
  return async (req) => {
    const url = new URL(req.url);
    try {
      if (url.pathname.startsWith("/api/")) return await handleApi(req, url, cwd);
      return await serveStatic(url.pathname);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return json<ApiError>({ error: message }, 400);
    }
  };
}

function openBrowser(url: string): void {
  if (process.env.OPEN === "0") return;
  const cmd: string[] =
    process.platform === "win32"
      ? ["cmd", "/c", "start", "", url]
      : process.platform === "darwin"
        ? ["open", url]
        : ["xdg-open", url];
  try {
    Bun.spawn(cmd, { stdout: "ignore", stderr: "ignore" });
  } catch {}
}

export function startServer(): Server {
  const cwd = process.cwd();
  let port = Number(process.env.PORT) || 5173;
  let server: Server | undefined;
  for (let i = 0; i < 25; i++) {
    try {
      server = Bun.serve({ port, hostname: "127.0.0.1", fetch: makeHandler(cwd) });
      break;
    } catch {
      port++;
    }
  }
  if (!server) throw new Error("could not find a free port");
  const url = `http://localhost:${server.port}`;
  console.log(`\n  html-editor`);
  console.log(`  serving: ${cwd}`);
  console.log(`  url:     ${url}\n`);
  openBrowser(url);
  return server;
}

if (import.meta.main) startServer();
