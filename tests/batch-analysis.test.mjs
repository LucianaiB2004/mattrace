import test from "node:test";
import assert from "node:assert/strict";

import { analyzeDocumentBatch } from "../app/services/batch-analysis.mjs";

const documents = Array.from({ length: 5 }, (_, index) => ({
  id: `doc-${index + 1}`,
  name: `paper-${index + 1}.pdf`,
  pageCount: index + 1,
}));

test("batch analysis preserves every document and limits concurrency", async () => {
  let active = 0;
  let maximum = 0;
  const outcomes = await analyzeDocumentBatch({}, documents, {
    concurrency: 2,
    analyze: async (_config, document) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return { status: "extracted", records: [{ sourceDocument: document.name }], checkedPages: [1] };
    },
  });
  assert.equal(maximum, 2);
  assert.deepEqual(outcomes.map((item) => item.documentId), documents.map((item) => item.id));
  assert.equal(outcomes.length, documents.length);
});

test("batch analysis retains no-evidence and failed documents", async () => {
  const outcomes = await analyzeDocumentBatch({}, documents.slice(0, 3), {
    analyze: async (_config, document) => {
      if (document.id === "doc-2") return { status: "no_evidence", records: [], checkedPages: [1, 2], reason: "未发现定量性能" };
      if (document.id === "doc-3") throw new Error("gateway timeout");
      return { status: "extracted", records: [{}], checkedPages: [1] };
    },
  });
  assert.deepEqual(outcomes.map((item) => item.status), ["extracted", "no_evidence", "failed"]);
  assert.match(outcomes[2].reason, /gateway timeout/);
});

test("batch analysis retries one transient failure without omitting the document", async () => {
  let calls = 0;
  const outcomes = await analyzeDocumentBatch({}, documents.slice(0, 1), {
    retryDelayMs: 0,
    analyze: async () => {
      calls += 1;
      if (calls === 1) throw new Error("socket hang up");
      return { status: "extracted", records: [{}], checkedPages: [1] };
    },
  });
  assert.equal(calls, 2);
  assert.equal(outcomes[0].status, "extracted");
});

test("batch cancellation marks work that did not complete", async () => {
  const controller = new AbortController();
  const outcomes = await analyzeDocumentBatch({}, documents, {
    concurrency: 1,
    signal: controller.signal,
    analyze: async (_config, document) => {
      if (document.id === "doc-1") controller.abort();
      return { status: "extracted", records: [], checkedPages: [1] };
    },
  });
  assert.equal(outcomes[0].status, "extracted");
  assert.deepEqual(outcomes.slice(1).map((item) => item.status), ["cancelled", "cancelled", "cancelled", "cancelled"]);
});
