import test from "node:test";
import assert from "node:assert/strict";
import { renameDocument } from "../app/domain/document-workspace.mjs";

const documents = [
  { id: "doc-a", name: "alpha.pdf", type: "pdf", pages: [{ page: 2, text: "evidence" }], previewUrl: "blob:a" },
  { id: "doc-b", name: "beta.pdf", type: "pdf", pages: [{ page: 1, text: "other" }], previewUrl: "./beta.pdf" },
];
const report = {
  records: [{ id: "r1", sourceDocument: "alpha.pdf", page: 2 }, { id: "r2", sourceDocument: "beta.pdf", page: 1 }],
  missingConditions: [], conflicts: [],
};

test("renaming a PDF preserves identity and cascades provenance", () => {
  const result = renameDocument({ documents, report }, "doc-a", "renamed paper");
  assert.equal(result.documents[0].name, "renamed paper.pdf");
  assert.equal(result.documents[0].id, "doc-a");
  assert.equal(result.documents[0].previewUrl, "blob:a");
  assert.deepEqual(result.documents[0].pages, [{ page: 2, text: "evidence" }]);
  assert.deepEqual(result.report.records.map((record) => record.sourceDocument), ["renamed paper.pdf", "beta.pdf"]);
  assert.equal(documents[0].name, "alpha.pdf");
});

test("rename rejects empty and duplicate names without changing state", () => {
  assert.throws(() => renameDocument({ documents, report }, "doc-a", "  "), /不能为空/);
  assert.throws(() => renameDocument({ documents, report }, "doc-a", "BETA.PDF"), /已存在/);
  assert.throws(() => renameDocument({ documents, report }, "missing", "new.pdf"), /不存在/);
});
