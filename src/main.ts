import { startServer } from "./server.ts";

function parsePort(argv: readonly string[]): number | undefined {
  const index = argv.indexOf("--port");
  if (index < 0) return undefined;
  const raw = argv[index + 1];
  if (!raw) return undefined;
  const port = Number(raw);
  return Number.isInteger(port) && port > 0 ? port : undefined;
}

export function main(): void {
  try {
    startServer({ port: parsePort(process.argv.slice(2)) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("html-editor: failed to start server:", message);
    process.exit(1);
  }
}

if (import.meta.main) main();
