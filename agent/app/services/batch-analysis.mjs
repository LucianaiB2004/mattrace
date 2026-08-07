import { analyzeDocument } from "./ai-client.mjs";

function cancelled(document) {
  return {
    documentId: document.id,
    documentName: document.name,
    pageCount: document.pageCount ?? document.pages?.length ?? 0,
    status: "cancelled",
    records: [],
    checkedPages: [],
    reason: "分析已取消",
  };
}

export async function analyzeDocumentBatch(config, documents, options = {}) {
  if (!Array.isArray(documents) || documents.length === 0) throw new Error("请至少选择 1 篇文档");
  const concurrency = Math.max(1, Math.min(Number(options.concurrency) || 2, documents.length));
  const run = options.analyze ?? analyzeDocument;
  const outcomes = new Array(documents.length);
  let cursor = 0;

  async function worker() {
    while (cursor < documents.length) {
      const index = cursor;
      cursor += 1;
      const document = documents[index];
      if (options.signal?.aborted) {
        outcomes[index] = cancelled(document);
        continue;
      }
      options.onProgress?.({ index, document, status: "analyzing" });
      try {
        const result = await run(config, document, options.fetchImpl, options.signal);
        outcomes[index] = {
          documentId: document.id,
          documentName: document.name,
          pageCount: document.pageCount ?? document.pages?.length ?? 0,
          ...result,
        };
      } catch (error) {
        outcomes[index] = error?.name === "AbortError"
          ? cancelled(document)
          : {
              documentId: document.id,
              documentName: document.name,
              pageCount: document.pageCount ?? document.pages?.length ?? 0,
              status: "failed",
              records: [],
              checkedPages: [],
              reason: String(error?.message || "分析失败"),
            };
      }
      options.onProgress?.({ index, document, status: outcomes[index].status });
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  for (let index = 0; index < outcomes.length; index += 1) {
    if (outcomes[index]?.status !== "failed" || options.signal?.aborted) continue;
    const document = documents[index];
    const delay = options.retryDelayMs ?? 500;
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    options.onProgress?.({ index, document, status: "retrying" });
    try {
      const result = await run(config, document, options.fetchImpl, options.signal);
      outcomes[index] = { documentId: document.id, documentName: document.name, pageCount: document.pageCount ?? document.pages?.length ?? 0, ...result };
    } catch (error) {
      if (error?.name === "AbortError") outcomes[index] = cancelled(document);
      else outcomes[index].reason = String(error?.message || "分析失败");
    }
    options.onProgress?.({ index, document, status: outcomes[index].status });
  }
  return outcomes;
}
