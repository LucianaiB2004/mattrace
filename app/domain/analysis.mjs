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
  if (compact === "ms/cm") return { value: value / 1000, unit: "S/cm" };
  if (compact === "µs/cm" || compact === "μs/cm") {
    return { value: value / 1_000_000, unit: "S/cm" };
  }
  if (compact === "gpa") return { value: value * 1000, unit: "MPa" };
  return { value, unit };
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
    const value = finiteNumber(raw?.value, `第 ${position} 条记录的数值无效`);
    const unit = requiredText(raw?.unit, `第 ${position} 条记录缺少单位`);
    const normalized = normalizeMeasurement(value, unit);
    const conditions = raw?.conditions && typeof raw.conditions === "object" ? raw.conditions : {};
    return {
      id: `record-${position}`,
      material: requiredText(raw?.material, `第 ${position} 条记录缺少材料体系`),
      process: requiredText(raw?.process, `第 ${position} 条记录缺少制备工艺`),
      property: requiredText(raw?.property, `第 ${position} 条记录缺少性能指标`),
      value,
      unit,
      normalizedValue: normalized.value,
      normalizedUnit: normalized.unit,
      conditions,
      conditionText: Object.values(conditions).filter(Boolean).join("，") || "未说明",
      sourceDocument: requiredText(raw?.sourceDocument, `第 ${position} 条记录缺少来源文档`),
      page: raw?.page ?? "未定位",
      evidence: requiredText(raw?.evidence, `第 ${position} 条记录缺少证据原文`),
      confidence: ["high", "medium", "low"].includes(raw?.confidence)
        ? raw.confidence
        : "medium",
    };
  });

  const missingConditions = Array.isArray(input.missingConditions)
    ? input.missingConditions.map((item, index) => {
        const recordIndex = Number(item?.recordIndex);
        if (!Number.isInteger(recordIndex) || !records[recordIndex]) {
          throw new Error(`第 ${index + 1} 条缺失条件未关联有效记录`);
        }
        return {
          id: `missing-${index + 1}`,
          recordId: records[recordIndex].id,
          field: requiredText(item?.field, `第 ${index + 1} 条缺失条件缺少字段`),
          message: requiredText(item?.message, `第 ${index + 1} 条缺失条件缺少说明`),
        };
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

export function detectConflicts(records, threshold = 0.3) {
  const conflicts = [];
  for (let left = 0; left < records.length; left += 1) {
    for (let right = left + 1; right < records.length; right += 1) {
      const a = records[left];
      const b = records[right];
      if (
        a.material.toLowerCase() !== b.material.toLowerCase() ||
        a.property.toLowerCase() !== b.property.toLowerCase() ||
        a.normalizedUnit !== b.normalizedUnit
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
