function normalizeText(value) {
  return String(value ?? "").replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim();
}

export async function loadLiteraturePages(document, fetchImpl = fetch) {
  if (!document.textUrl) return document;
  const response = await fetchImpl(document.textUrl);
  if (!response.ok) throw new Error(`${document.name} 全文加载失败：HTTP ${response.status}`);
  const payload = await response.json();
  const pages = Array.isArray(payload.pages) ? payload.pages.map((page, index) => ({
    page: Number.isInteger(page.page) ? page.page : index + 1,
    text: normalizeText(page.text),
  })) : [];
  if (!pages.length) throw new Error(`${document.name} 全文数据不包含页面`);
  return { ...document, pages, text: pages.map((page) => page.text).filter(Boolean).join("\n\n"), pageCount: pages.length };
}
