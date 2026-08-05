function extensionOf(name) {
  return String(name).split(".").pop()?.toLowerCase() ?? "";
}

function normalizeText(text) {
  return text.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
}

function makeId(file) {
  const seed = `${file.name}-${file.size}-${file.lastModified ?? 0}`;
  let hash = 2166136261;
  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `doc-${(hash >>> 0).toString(36)}`;
}

export async function parseDocument(file, onProgress = () => {}) {
  const type = extensionOf(file.name);
  onProgress(0);
  let pages;
  if (type === "txt" || type === "md") {
    const text = normalizeText(await file.text());
    pages = [{ page: 1, text }];
    onProgress(100);
  } else if (type === "pdf") {
    const { parsePdf } = await import("./pdf-parser.mjs");
    pages = await parsePdf(file, onProgress);
  } else if (type === "docx") {
    const { parseDocx } = await import("./docx-parser.mjs");
    pages = await parseDocx(file, onProgress);
  } else {
    throw new Error(`不支持的文档类型：.${type || "unknown"}`);
  }

  const text = normalizeText(pages.map((page) => page.text).filter(Boolean).join("\n\n"));
  if (!text) throw new Error(`${file.name} 没有可提取的文本`);
  return {
    id: makeId(file),
    name: file.name,
    type,
    size: file.size,
    pageCount: pages.length,
    text,
    pages,
    status: "ready",
  };
}
