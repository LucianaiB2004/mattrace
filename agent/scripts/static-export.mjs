import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function decodeOptimizedImage(match, encodedPath) {
  return `./${decodeURIComponent(encodedPath)}`;
}

export function makeStaticHtml(source) {
  return String(source)
    .replace(/\/_next\/image\?url=%2F([^&" ]+)(?:&amp;|&)[^" ]*/g, decodeOptimizedImage)
    .replace(/http:\/\/localhost:3000\//g, "./")
    .replace(/\b(href|src|content|imageSrcSet)="\/(?!\/)/g, '$1="./')
    // The inlined RSC payload references chunks and CSS as root-absolute
    // strings (e.g. \"/_next/static/...\" or :HL["/_next/..."]). Rewrite any
    // remaining bare /_next/static/ to a relative path so hydration does not
    // 404 when the site is served from a GitHub Pages project subpath. The
    // negative lookbehind leaves already-correct ./_next/static/ untouched.
    .replace(/(?<!\.)\/_next\/static\//g, "./_next/static/")
    // RSC payload also encodes public-asset URLs (favicon, og:image) as
    // root-absolute strings (e.g. \"/favicon.svg\"). Rewrite only escaped
    // string values that point at static assets, so they resolve under the
    // project subpath without touching route refs like [\"/page\"].
    .replace(/\\"\/([a-zA-Z0-9._-]+\.(?:svg|png|ico|webp|jpg|jpeg|gif|woff2?|ttf|css|js))/g, '\\"./$1');
}

export function makeStaticCss(source) {
  return String(source).replaceAll("url(/_next/static/", "url(../");
}

export function makeStaticJavaScript(source) {
  return String(source)
    .replaceAll("/_next/static/media/", "../media/")
    // Vite's modulepreload polyfill prepends "/" to dep filenames
    // (e.g. "_next/static/chunks/x.js" -> "/_next/static/chunks/x.js"), which
    // resolves against the origin root and breaks under a project subpath.
    // Make it prepend "./" so deps resolve relative to the document base.
    .replace(/(`modulepreload`,[A-Za-z_$][\w$]*=function\([a-z]\)\{return)([`'"])\/\2/g, '$1$2./$2');
}

async function filesWithExtension(directory, extension) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesWithExtension(path, extension));
    else if (extname(entry.name) === extension) files.push(path);
  }
  return files;
}

export async function exportStaticSite(root = resolve(dirname(fileURLToPath(import.meta.url)), "..")) {
  const workerPath = join(root, "dist", "server", "index.js");
  const clientPath = join(root, "dist", "client");
  const { default: worker } = await import(`${pathToFileURL(workerPath).href}?static=${Date.now()}`);
  const response = await worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  if (!response.ok) throw new Error(`静态首页渲染失败：HTTP ${response.status}`);
  await mkdir(clientPath, { recursive: true });
  await writeFile(join(clientPath, "index.html"), makeStaticHtml(await response.text()), "utf8");
  await writeFile(join(clientPath, ".nojekyll"), "", "utf8");
  for (const cssPath of await filesWithExtension(join(clientPath, "_next", "static", "css"), ".css")) {
    await writeFile(cssPath, makeStaticCss(await readFile(cssPath, "utf8")), "utf8");
  }
  for (const scriptPath of await filesWithExtension(join(clientPath, "_next", "static", "chunks"), ".js")) {
    await writeFile(scriptPath, makeStaticJavaScript(await readFile(scriptPath, "utf8")), "utf8");
  }
  return join(clientPath, "index.html");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const output = await exportStaticSite();
  process.stdout.write(`Static MatTrace site written to ${output}\n`);
}
