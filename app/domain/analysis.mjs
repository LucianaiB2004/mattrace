function requiredText(value, message) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(message);
  return text;
}

function finiteNumber(value, message) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) throw new Error(message);
  return number;
}

function normalizeMeasurement(value, unit) {
  const compact = unit.replaceAll(" ", "").toLowerCase();
  if (compact === "s/cm") return { value, unit: "S/cm" };
  if (compact === "ms/cm") return { value: value / 1000, unit: "S/cm" };
  if (compact === "µs/cm" || compact === "μs/cm") {
    return { value: value / 1_000_000, unit: "S/cm" };
  }
  if (compact === "gpa") return { value: value * 1000, unit: "MPa" };
  if (compact === "mpa") return { value, unit: "MPa" };
  if (["wm-1k-1", "w/mk"].includes(compact)) return { value, unit: "W m-1 K-1" };
  if (["mah/g", "mahg-1"].includes(compact)) return { value, unit: "mAh/g" };
  if (compact === "%") return { value, unit: "%" };
  return { value: null, unit: null };
}

export function formatMeasurement(record) {
  const value = record?.value == null ? record?.valueRaw : record.value;
  return `${value ?? "未说明"} ${record?.unit ?? ""}`.trim();
}

export function extractJsonObject(text) {
  const input = String(text ?? "").trim();
  const fenced = input.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? input.slice(input.indexOf("{"), input.lastIndexOf("}") + 1);
  if (!candidate || !candidate.trim().startsWith("{")) {
    throw new Error("模型未返回可解析的 JSON 对象");
  }
  try {
    return JSON.parse(candidate.trim());
  } catch {
    throw new Error("模型未返回可解析的 JSON 对象");
  }
}

export function normalizeAnalysisResult(input) {
  if (!input || typeof input !== "object" || !Array.isArray(input.records)) {
    throw new Error("分析结果缺少 records 数组");
  }

  const records = input.records.map((raw, index) => {
    const position = index + 1;
    const proposedValueKind = raw?.value_kind ?? raw?.valueKind;
    const valueKind = ["exact", "range", "limit", "approx"].includes(proposedValueKind) ? proposedValueKind : "exact";
    const valueRaw = requiredText(raw?.value_raw ?? raw?.valueRaw ?? String(raw?.value ?? ""), `第 ${position} 条记录缺少原始数值`);
    const value = valueKind === "exact" ? finiteNumber(raw?.value, `第 ${position} 条记录的数值无效`) : null;
    const unit = requiredText(raw?.unit_raw ?? raw?.unit, `第 ${position} 条记录缺少单位`);
    const normalized = value == null ? { value: null, unit: null } : normalizeMeasurement(value, unit);
    const conditionsSource = raw?.test_conditions ?? raw?.conditions;
    const conditions = conditionsSource && typeof conditionsSource === "object" ? conditionsSource : {};
    const evidenceText = requiredText(raw?.evidence_text ?? raw?.evidence, `第 ${position} 条记录缺少证据原文`);
    const property = requiredText(raw?.property_name ?? raw?.property, `第 ${position} 条记录缺少性能指标`);
    const materialRaw = requiredText(raw?.material_name_raw ?? raw?.material, `第 ${position} 条记录缺少材料体系`);
    const material = requiredText(raw?.material_name_normalized ?? materialRaw, `第 ${position} 条记录缺少材料体系`);
    const confidenceAssessment = assessConfidence({ evidenceText, valueRaw, unit, page: raw?.page, conditions, valueKind, property });
    return {
      id: `record-${position}`,
      materialRaw,
      material,
      process: requiredText(raw?.processing_steps ?? raw?.process, `第 ${position} 条记录缺少制备工艺`),
      property,
      value,
      valueRaw,
      valueKind,
      unit,
      normalizedValue: normalized.value,
      normalizedUnit: normalized.unit,
      conditions,
      conditionText: Object.values(conditions).filter(Boolean).join("，") || "未说明",
      sourceDocument: requiredText(raw?.source_document ?? raw?.sourceDocument, `第 ${position} 条记录缺少来源文档`),
      page: raw?.page ?? "未定位",
      evidence: evidenceText,
      confidence: confidenceAssessment.confidence,
      confidenceReasons: confidenceAssessment.reasons,
      reviewRequired: confidenceAssessment.confidence !== "high",
    };
  });

  const missingInput = input.missing_conditions ?? input.missingConditions;
  const missingConditions = Array.isArray(missingInput)
    ? missingInput.flatMap((item, index) => {
        const recordIndex = Number(item?.record_index ?? item?.recordIndex);
        if (!Number.isInteger(recordIndex) || !records[recordIndex]) {
          return [];
        }
        return [{
          id: `missing-${index + 1}`,
          recordId: records[recordIndex].id,
          field: requiredText(item?.field, `第 ${index + 1} 条缺失条件缺少字段`),
          message: requiredText(item?.message, `第 ${index + 1} 条缺失条件缺少说明`),
        }];
      })
    : [];

  const suppliedConflicts = Array.isArray(input.conflicts)
    ? input.conflicts.map((item, index) => ({
        id: `model-conflict-${index + 1}`,
        recordIds: Array.isArray(item?.recordIndexes)
          ? item.recordIndexes.map((recordIndex) => records[recordIndex]?.id).filter(Boolean)
          : [],
        message: String(item?.message ?? "模型识别到潜在冲突"),
        differencePercent: Number(item?.differencePercent) || null,
        source: "model",
      })).filter((item) => item.recordIds.length >= 2)
    : [];

  const detected = detectConflicts(records);
  return {
    records,
    missingConditions,
    conflicts: [...suppliedConflicts, ...detected],
    summary: typeof input.summary === "string" ? input.summary.trim() : "",
    generatedAt: new Date().toISOString(),
  };
}

function assessConfidence({ evidenceText, valueRaw, unit, page, conditions, valueKind, property }) {
  const compactEvidence = evidenceText.toLowerCase().replaceAll(" ", "");
  const bound = compactEvidence.includes(String(valueRaw).toLowerCase().replaceAll(" ", ""))
    && compactEvidence.includes(String(unit).toLowerCase().replaceAll(" ", ""));
  const located = page != null && page !== "未定位";
  const missingConditions = missingRequiredConditions(property, conditions);
  const hasConditions = missingConditions.length === 0;
  const reasons = [];
  if (!bound) reasons.push("证据原文未同时包含当前数值与单位");
  if (!located) reasons.push("来源页码未定位");
  if (!hasConditions) reasons.push(`关键测试条件缺失: ${missingConditions.join(", ")}`);
  if (valueKind !== "exact") reasons.push(`数值类型为 ${valueKind}，需保留原始语义`);
  const confidence = !bound || !located || !hasConditions ? "low" : valueKind === "exact" ? "high" : "medium";
  return { confidence, reasons };
}

export function detectConflicts(records, threshold = 0.3) {
  const conflicts = [];
  for (let left = 0; left < records.length; left += 1) {
    for (let right = left + 1; right < records.length; right += 1) {
      const a = records[left];
      const b = records[right];
      if (missingRequiredConditions(a.property, a.conditions).length || missingRequiredConditions(b.property, b.conditions).length) continue;
      if (
        a.material.toLowerCase() !== b.material.toLowerCase() ||
        a.property.toLowerCase() !== b.property.toLowerCase() ||
        a.normalizedUnit !== b.normalizedUnit ||
        comparableConditionKey(a) !== comparableConditionKey(b)
      ) continue;
      const denominator = Math.min(Math.abs(a.normalizedValue), Math.abs(b.normalizedValue));
      if (!denominator) continue;
      const difference = Math.abs(a.normalizedValue - b.normalizedValue) / denominator;
      if (difference > threshold) {
        conflicts.push({
          id: `conflict-${conflicts.length + 1}`,
          recordIds: [a.id, b.id],
          message: `${a.material} 的${a.property}在不同来源中差异超过 ${Math.round(threshold * 100)}%`,
          differencePercent: Math.round(difference * 100),
          source: "client",
        });
      }
    }
  }
  return conflicts;
}

function comparableConditionKey(record) {
  const conditions = record.conditions && typeof record.conditions === "object" ? record.conditions : {};
  return Object.entries(conditions)
    .filter(([, value]) => value != null && String(value).trim())
    .map(([key, value]) => [key.toLowerCase(), String(value).trim().toLowerCase()])
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${value}`)
    .join("|");
}
import { missingRequiredConditions } from "./material-science.mjs";
