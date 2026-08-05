import { detectConflicts } from "./analysis.mjs";

function scoreRecord(record) {
  const traceable = Boolean(String(record.evidence ?? "").trim()) && record.page !== "未定位" && record.page != null;
  const completeFields = [record.material, record.process, record.property, record.value, record.unit]
    .filter((value) => value !== "" && value != null && value !== "未说明").length;
  const hasConditions = Boolean(record.conditionText && record.conditionText !== "未说明");
  const normalized = Number.isFinite(record.normalizedValue) && Boolean(record.normalizedUnit);
  const scores = {
    evidence: traceable ? 35 : 0,
    completeness: Math.round((completeFields / 5) * 25),
    conditions: hasConditions ? 20 : 0,
    comparability: normalized && hasConditions ? 20 : normalized ? 10 : 0,
  };
  scores.total = scores.evidence + scores.completeness + scores.conditions + scores.comparability;
  const reasons = [];
  if (!traceable) reasons.push("缺少可复查的页码或证据原文");
  if (completeFields < 5) reasons.push("核心材料或性能字段不完整");
  if (!hasConditions) reasons.push("测试条件未说明");
  if (!normalized) reasons.push("数值单位无法规范化比较");
  return { scores, reasons, comparable: scores.total >= 70 && traceable && hasConditions && normalized };
}

export function buildEvidenceAudit(outcomes) {
  const records = [];
  const missingConditions = [];
  for (const outcome of outcomes) {
    for (const raw of outcome.records ?? []) {
      const id = `record-${records.length + 1}`;
      records.push({ ...raw, id, documentId: outcome.documentId, sourceDocument: raw.sourceDocument || outcome.documentName });
    }
  }
  for (const record of records) {
    if (!record.conditionText || record.conditionText === "未说明") {
      missingConditions.push({ id: `missing-${missingConditions.length + 1}`, recordId: record.id, field: "test_conditions", message: `${record.sourceDocument} 的测试条件未说明` });
    }
  }
  const coverageMatrix = outcomes.map((outcome) => ({
    documentId: outcome.documentId,
    documentName: outcome.documentName,
    status: outcome.status,
    pageCount: outcome.pageCount,
    checkedPages: outcome.checkedPages ?? [],
    recordCount: outcome.records?.length ?? 0,
    reason: outcome.reason ?? "",
  }));
  const comparabilityPassports = records.map((record) => ({
    recordId: record.id,
    material: record.material,
    property: record.property,
    sourceDocument: record.sourceDocument,
    ...scoreRecord(record),
  }));
  return {
    records,
    missingConditions,
    conflicts: detectConflicts(records),
    outcomes,
    coverageMatrix,
    comparabilityPassports,
    summary: `已审计 ${outcomes.length} 篇文档：${coverageMatrix.filter((row) => row.status === "extracted").length} 篇提取到证据，${records.length} 条记录进入可比性审计。`,
    generatedAt: new Date().toISOString(),
  };
}
