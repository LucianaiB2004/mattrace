function normalizedName(document, requestedName) {
  const trimmed = String(requestedName ?? "").trim();
  if (!trimmed) throw new Error("文档名称不能为空");
  const extension = document.type ? `.${String(document.type).toLowerCase()}` : "";
  if (!extension || trimmed.toLowerCase().endsWith(extension)) return trimmed;
  return `${trimmed.replace(/\.[^.]+$/, "")}${extension}`;
}

export function renameDocument(state, documentId, requestedName) {
  const document = state.documents.find((item) => item.id === documentId);
  if (!document) throw new Error("要重命名的文档不存在");
  const name = normalizedName(document, requestedName);
  if (state.documents.some((item) => item.id !== documentId && item.name.toLowerCase() === name.toLowerCase())) {
    throw new Error(`已存在同名文档：${name}`);
  }
  const oldName = document.name;
  return {
    documents: state.documents.map((item) => item.id === documentId ? { ...item, name } : item),
    report: state.report ? {
      ...state.report,
      records: state.report.records.map((record) => record.sourceDocument === oldName ? { ...record, sourceDocument: name } : record),
    } : state.report,
  };
}

export function stripSessionDocumentFields(document) {
  const persistent = { ...document };
  delete persistent.binary;
  if (persistent.previewUrl?.startsWith("blob:")) delete persistent.previewUrl;
  return persistent;
}
