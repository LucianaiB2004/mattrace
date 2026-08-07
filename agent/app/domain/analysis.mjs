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
  const body = (fenced?.[1] ?? input).trim();
  const start = body.indexOf("{");
  if (start < 0) throw new Error("模型未返回可解析的 JSON 对象");
  // Walk the braces so any prose before or after the object is ignored, but the
  // whole (possibly nested) object is captured even without a clean closing fence.
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < body.length; index += 1) {
    const char = body[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        const candidate = body.slice(start, index + 1);
        try { return JSON.parse(candidate); } catch { /* keep scanning if malformed */ }
      }
    }
  }
  // Last resort: repair a stream that was cut off mid-object. Close any open
  // string, then the innermost brackets/arrays that were left unclosed, so the
  // already-emitted records are not lost just because the final bytes were truncated.
  const repaired = repairTruncatedJson(body.slice(start));
  if (repaired) {
    try { return JSON.parse(repaired); } catch { /* give up */ }
  }
  throw new Error("模型未返回可解析的 JSON 对象");
}

// Returns a best-effort closed version of a truncated JSON object, or null when
// the prefix does not even look like a JSON object.
function repairTruncatedJson(prefix) {
  let inString = false;
  let escaped = false;
  const stack = [];
  // The index just after the last position where a complete array element or
  // object member closed cleanly — a safe point to truncate a partial tail.
  let lastSafe = -1;
  for (let index = 0; index < prefix.length; index += 1) {
    const char = prefix[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{" || char === "[") stack.push(char);
    else if (char === "}" || char === "]") {
      stack.pop();
      const after = prefix.slice(index + 1).match(/^\s*[,}\]]/);
      if (after) lastSafe = index + 1;
    }
  }
  if (!stack.length || stack[0] !== "{") return null;

  const close = (text, openStack) => {
    let result = text;
    for (let index = openStack.length - 1; index >= 0; index -= 1) {
      result += openStack[index] === "{" ? "}" : "]";
    }
    return result;
  };

  // First try closing the prefix as-is (covering a clean cut between elements).
  const attempt = close(inString ? `${prefix}"` : prefix, stack);
  try { JSON.parse(attempt); return attempt; } catch { /* truncate below */ }

  // Otherwise drop everything after the last safely-closed element and re-close.
  if (lastSafe < 0) return null;
  const head = prefix.slice(0, lastSafe).replace(/,\s*$/, "");
  // Recompute the open containers at the safe point.
  const headStack = [];
  let hString = false;
  let hEscaped = false;
  for (const char of head) {
    if (hString) {
      if (hEscaped) hEscaped = false;
      else if (char === "\\") hEscaped = true;
      else if (char === '"') hString = false;
      continue;
    }
    if (char === '"') hString = true;
    else if (char === "{" || char === "[") headStack.push(char);
    else if (char === "}" || char === "]") headStack.pop();
  }
  if (headStack[0] !== "{") return null;
  return close(head, headStack);
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

// Normalize text for loose binding: unify minus glyphs, drop punctuation and
// superscript markers so "S/cm", "S cm−1", "S cm^-1" all collapse to "scm1",
// and "1.0 × 10^-3" matches "1.0×10−3".
function compactForBinding(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[−–—]/g, "-")
    .replace(/[^\p{L}\p{N}.%]+/gu, "");
}

// The unit stem drops exponent digits so "kg m^-3" and "W m^-1 K^-1" compare as
// "kgm" and "wmk" against table text where the unit sits in a header.
function unitStem(unit) {
  return compactForBinding(unit).replace(/[-.]?\d+/g, "");
}

// Strip digits that are glued to a letter (unit exponents like "m-1", "kg3",
// "W m^-1 K^-1" -> "wmk") while leaving standalone measurement values intact,
// so a unit stem matches evidence regardless of how exponents are typeset.
function unitEvidenceKey(evidenceCompact) {
  return evidenceCompact.replace(/(\p{L})\d+/gu, "$1");
}

const DIMENSIONLESS_UNIT = /^(?:无单位|无量纲|dimensionless|none|n\/?a)$/i;
const UNREPORTED_UNIT = /^(?:未说明|未标注|未报告|unreported)$/i;

function unitInEvidence(unit, evidenceCompact) {
  const raw = String(unit ?? "").trim();
  if (!raw || UNREPORTED_UNIT.test(raw)) return { bound: false, unreported: true };
  if (DIMENSIONLESS_UNIT.test(raw)) return { bound: true, dimensionless: true };
  if (/^(?:arb\.?\s*units?|a\.?u\.?)$/i.test(raw)) return { bound: true, arbitrary: true };
  if (raw === "%" || /percent/i.test(raw)) {
    return { bound: evidenceCompact.includes("%") || evidenceCompact.includes("percent"), dimensionless: false };
  }
  const stem = unitStem(raw);
  if (!stem) return { bound: true, dimensionless: true };
  return { bound: unitEvidenceKey(evidenceCompact).includes(stem), dimensionless: false };
}

function significantNumbers(value) {
  // Keep decimals and integers of 2+ digits as anchors; a lone "1" or exponent
  // digit is too weak to bind on its own.
  return String(value ?? "").match(/\d+\.\d+|\d{2,}/g) ?? [];
}

function assessConfidence({ evidenceText, valueRaw, unit, page, conditions, valueKind, property }) {
  const evidenceCompact = compactForBinding(evidenceText);
  const anchors = significantNumbers(valueRaw);
  const matchedAnchors = anchors.filter((token) => evidenceCompact.includes(compactForBinding(token)));
  const valueBound = matchedAnchors.length > 0;
  const allValuesBound = anchors.length > 0 && matchedAnchors.length === anchors.length;
  const unitCheck = unitInEvidence(unit, evidenceCompact);
  const located = page != null && page !== "未定位";
  const missingConditions = missingRequiredConditions(property, conditions);
  const hasConditions = missingConditions.length === 0;

  const reasons = [];
  if (!valueBound) reasons.push("证据原文未定位到当前数值");
  else if (!allValuesBound) reasons.push("证据原文仅定位到部分数值，需核对范围/极限");
  if (unitCheck.unreported) reasons.push("单位未说明，无法核验量纲");
  else if (!unitCheck.bound) reasons.push("证据原文未定位到当前单位（可能在表头或被简写）");
  else if (unitCheck.arbitrary) reasons.push("单位为任意单位（arb. unit），不可跨研究比较");
  else if (unitCheck.dimensionless) reasons.push("单位为无量纲，已按无量纲处理");
  if (!located) reasons.push("来源页码未定位");
  if (!hasConditions) reasons.push(`关键测试条件缺失: ${missingConditions.join(", ")}`);
  if (valueKind !== "exact") reasons.push(`数值类型为 ${valueKind}，需保留原始语义`);

  const grounded = valueBound && unitCheck.bound && located;
  const cleanUnit = unitCheck.bound && !unitCheck.unreported && !unitCheck.arbitrary;
  const confidence = !grounded ? "low"
    : hasConditions && allValuesBound && valueKind === "exact" && cleanUnit ? "high"
    : "medium";
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
