import test from "node:test";
import assert from "node:assert/strict";

import { createProjectStore } from "../app/services/project-store.mjs";

function memoryAdapter() {
  let value = null;
  return {
    async put(next) { value = structuredClone(next); },
    async get() { return value ? structuredClone(value) : null; },
    async delete() { value = null; },
  };
}

const safeSnapshot = {
  version: 1,
  savedAt: "2026-08-05T00:00:00.000Z",
  provider: { gateway: "https://ai.chipcloud.cc", model: "qwen3.8-max" },
  documents: [{ id: "doc-1", name: "paper.txt", text: "LLZO", pages: [] }],
  report: { records: [], missingConditions: [], conflicts: [] },
  selectedRecordId: null,
};

test("project store saves, restores, and deletes a versioned snapshot", async () => {
  const store = createProjectStore(memoryAdapter());
  await store.saveProject(safeSnapshot);
  assert.deepEqual(await store.loadProject(), safeSnapshot);
  await store.deleteProject();
  assert.equal(await store.loadProject(), null);
});

test("project store rejects snapshots with credentials before touching storage", async () => {
  const store = createProjectStore(memoryAdapter());
  await assert.rejects(
    () => store.saveProject({ ...safeSnapshot, apiKey: "secret" }),
    /项目快照包含敏感字段/,
  );
  assert.equal(await store.loadProject(), null);
});

test("project store ignores snapshots from an unsupported future version", async () => {
  const adapter = memoryAdapter();
  await adapter.put({ ...safeSnapshot, version: 99 });
  const store = createProjectStore(adapter);
  assert.equal(await store.loadProject(), null);
});
