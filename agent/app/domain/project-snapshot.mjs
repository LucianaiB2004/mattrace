import { stripSessionDocumentFields } from "./document-workspace.mjs";

const SECRET_FIELD = /(api.?key|authorization|access.?token|secret|credential|password)/i;

export function assertSnapshotHasNoSecret(value, path = "root") {
  if (!value || typeof value !== "object") return true;
  for (const [key, child] of Object.entries(value)) {
    if (SECRET_FIELD.test(key)) throw new Error(`项目快照包含敏感字段：${path}.${key}`);
    assertSnapshotHasNoSecret(child, `${path}.${key}`);
  }
  return true;
}

export function createProjectSnapshot(state, savedAt = new Date().toISOString()) {
  const snapshot = {
    version: 1,
    savedAt,
    provider: {
      gateway: String(state.gateway ?? ""),
      model: String(state.model ?? ""),
      protocol: String(state.protocol ?? "openai-chat"),
    },
    documents: structuredClone(Array.isArray(state.documents) ? state.documents.map(stripSessionDocumentFields) : []),
    report: state.report ? structuredClone(state.report) : null,
    selectedRecordId: state.selectedRecordId ?? null,
  };
  assertSnapshotHasNoSecret(snapshot);
  return snapshot;
}
