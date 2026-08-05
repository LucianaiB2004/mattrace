import test from "node:test";
import assert from "node:assert/strict";

import {
  assertSnapshotHasNoSecret,
  createProjectSnapshot,
} from "../app/domain/project-snapshot.mjs";

test("project snapshot keeps documents, report, and public provider configuration", () => {
  const snapshot = createProjectSnapshot({
    documents: [{ id: "doc-1", name: "a.pdf", text: "content", size: 7, type: "pdf", pages: [], previewUrl: "blob:session-secret", binary: new Uint8Array([1, 2]) }],
    report: { records: [{ id: "record-1" }], missingConditions: [], conflicts: [] },
    gateway: "https://ai.chipcloud.cc",
    model: "qwen3.8-max",
    apiKey: "must-not-survive",
    selectedRecordId: "record-1",
  }, "2026-08-05T00:00:00.000Z");

  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.documents[0].name, "a.pdf");
  assert.equal("previewUrl" in snapshot.documents[0], false);
  assert.equal("binary" in snapshot.documents[0], false);
  assert.equal(snapshot.provider.model, "qwen3.8-max");
  assert.equal(snapshot.selectedRecordId, "record-1");
  assert.equal(JSON.stringify(snapshot).includes("must-not-survive"), false);
});

test("secret audit recursively rejects credential-like fields", () => {
  assert.equal(assertSnapshotHasNoSecret({ provider: { gateway: "https://example.com" } }), true);
  assert.throws(
    () => assertSnapshotHasNoSecret({ nested: { authorization: "Bearer secret" } }),
    /项目快照包含敏感字段/,
  );
  assert.throws(
    () => assertSnapshotHasNoSecret({ api_key: "secret" }),
    /项目快照包含敏感字段/,
  );
});
