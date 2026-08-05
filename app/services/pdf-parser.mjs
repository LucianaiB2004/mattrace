export async function parsePdf(file, onProgress = () => {}) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(await file.arrayBuffer());
  const document = await pdfjs.getDocument({ data, disableWorker: true }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item) => "str" in item ? item.str : "").join(" ").replace(/\s+/g, " ").trim();
    pages.push({ page: pageNumber, text });
    onProgress(Math.round((pageNumber / document.numPages) * 100));
  }
  return pages;
}
