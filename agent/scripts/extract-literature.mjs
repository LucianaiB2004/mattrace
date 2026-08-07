import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const directory = join(root, "public", "literature");
const ids = ["2103.08718", "2202.06763", "2404.13858"];

await mkdir(directory, { recursive: true });
for (const id of ids) {
  const data = new Uint8Array(await readFile(join(directory, `${id}.pdf`)));
  const document = await pdfjs.getDocument({ data, disableWorker: true }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item) => "str" in item ? item.str : "").join(" ").replace(/\s+/g, " ").trim();
    pages.push({ page: pageNumber, text });
  }
  await writeFile(join(directory, `${id}.json`), `${JSON.stringify({ source: `${id}.pdf`, pages })}\n`, "utf8");
  process.stdout.write(`${id}: ${pages.length} pages\n`);
}
