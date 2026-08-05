import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve, sep } from "node:path";

const port = Number(process.argv[2] || 3200);
const root = resolve(process.argv[3] || "dist/client");
const mimes = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".json": "application/json" };

createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const file = resolve(join(root, relative));
  if (file !== root && !file.startsWith(`${root}${sep}`)) { response.writeHead(403).end("Forbidden"); return; }
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error("Not a file");
    response.writeHead(200, { "Content-Type": `${mimes[extname(file)] || "application/octet-stream"};charset=utf-8` });
    createReadStream(file).pipe(response);
  } catch { response.writeHead(404).end("Not found"); }
}).listen(port, "127.0.0.1", () => process.stdout.write(`Static server listening on ${port}\n`));
