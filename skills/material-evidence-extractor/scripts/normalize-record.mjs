export function normalizeRecord(record) {
  const missingConditions = Array.isArray(record.missing_conditions)
    ? record.missing_conditions
    : Object.entries(record.conditions ?? {}).filter(([, value]) => !value).map(([field]) => field);
  const traceable = Boolean(record.page && record.evidence_text && record.unit_raw && record.value_raw);
  const confidenceReasons = [];
  if (!traceable) confidenceReasons.push("数值、单位、页码或证据原文不完整");
  if (missingConditions.length) confidenceReasons.push(`关键测试条件缺失: ${missingConditions.join(", ")}`);
  if (record.value_status === "inferred") confidenceReasons.push("包含推断值");
  const confidence = !traceable ? "low" : confidenceReasons.length ? "medium" : "high";
  return {
    ...record,
    missing_conditions: missingConditions,
    confidence,
    confidence_reasons: confidenceReasons,
    review_required: confidence !== "high",
  };
}
