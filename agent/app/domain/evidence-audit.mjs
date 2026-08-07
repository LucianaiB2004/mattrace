import { detectConflicts } from "./analysis.mjs";
import { missingRequiredConditions } from "./material-science.mjs";

function scoreRecord(record) {
  const evidence = String(record.evidence ?? "").trim().toLowerCase().replaceAll(" ", "");
  const locatorPresent = Boolean(evidence) && record.page !== "未定位" && record.page != null;
  const valueText = String(record.valueRaw ?? record.value ?? "").toLowerCase().replaceAll(" ", "");
  const unitText = String(record.unit ?? "").toLowerCase().replaceAll(" ", "");
  const valueAndUnitBound = Boolean(valueText && unitText && evidence.includes(valueText) && evidence.includes(unitText));
  const sourceBound = record.evidenceSourceBound !== false;
  const traceable = locatorPresent && valueAndUnitBound && sourceBound;
  const completeFields = [record.material, record.process, record.property, record.value, record.unit]
    .filter((value) => value !== "" && value != null && value !== "未说明").length;
  const missingConditions = missingRequiredConditions(record.property, record.conditions);
  const hasConditions = missingConditions.length === 0;
  const normalized = Number.isFinite(record.normalizedValue) && Boolean(record.normalizedUnit);
  const evidenceScore = traceable ? 35 : 0;
  const completenessScore = Math.round((completeFields / 5) * 25);
  const conditionsScore = hasConditions ? 20 : 0;
  const comparabilityScore = normalized && hasConditions ? 20 : normalized ? 10 : 0;
  const scores = {
    evidence: evidenceScore,
    completeness: completenessScore,
    conditions: conditionsScore,
    comparability: comparabilityScore,
    total: evidenceScore + completenessScore + conditionsScore + comparabilityScore,
  };
  const reasons = [];
  if (!locatorPresent) reasons.push("缺少可复查的页码或证据原文");
  if (locatorPresent && !valueAndUnitBound) reasons.push("证据原文未同时绑定当前数值与单位");
  if (!sourceBound) reasons.push("证据原文无法在实际提交片段中定位");
  if (completeFields < 5) reasons.push("核心材料或性能字段不完整");
  if (!hasConditions) reasons.push(`关键测试条件缺失: ${missingConditions.join(", ")}`);
  if (!normalized) reasons.push("数值单位无法规范化比较");
  return { scores, reasons, comparable: scores.total >= 70 && traceable && hasConditions && normalized };
}

export function buildEvidenceAudit(outcomes) {
  const records = [];
  const missingConditions = [];
  for (const outcome of outcomes) {
    const recordIds = new Map();
    for (const raw of outcome.records ?? []) {
      const id = `record-${records.length + 1}`;
      recordIds.set(raw.id, id);
      records.push({ ...raw, id, documentId: outcome.documentId, sourceDocument: outcome.documentName });
    }
    for (const alert of outcome.missingConditions ?? []) {
      const recordId = recordIds.get(alert.recordId);
      if (!recordId) continue;
      missingConditions.push({
        id: `missing-${missingConditions.length + 1}`,
        recordId,
        field: alert.field,
        message: alert.message,
      });
    }
  }
  for (const record of records) {
    for (const field of missingRequiredConditions(record.property, record.conditions)) {
      if (missingConditions.some((item) => item.recordId === record.id && item.field === field)) continue;
      missingConditions.push({ id: `missing-${missingConditions.length + 1}`, recordId: record.id, field, message: `${record.sourceDocument} 的关键测试条件 ${field} 未说明` });
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
