const UNIT_TABLE = [
  { units: ["s/cm"], normalizedUnit: "S/cm", factor: 1 },
  { units: ["ms/cm"], normalizedUnit: "S/cm", factor: 1 / 1000 },
  { units: ["µs/cm", "μs/cm"], normalizedUnit: "S/cm", factor: 1 / 1_000_000 },
  { units: ["gpa"], normalizedUnit: "MPa", factor: 1000 },
  { units: ["mpa"], normalizedUnit: "MPa", factor: 1 },
  { units: ["wm-1k-1", "w/mk"], normalizedUnit: "W m-1 K-1", factor: 1 },
  { units: ["mah/g", "mahg-1"], normalizedUnit: "mAh/g", factor: 1 },
  { units: ["%"], normalizedUnit: "%", factor: 1 },
];

function normalizeMeasurement(value, unitRaw) {
  if (typeof value !== "number" || !Number.isFinite(value)) return { value: null, unit: null, converted: false };
  const compact = String(unitRaw ?? "").replaceAll(" ", "").toLowerCase();
  const row = UNIT_TABLE.find((item) => item.units.includes(compact));
  if (!row) return { value: null, unit: null, converted: false };
  return { value: value * row.factor, unit: row.normalizedUnit, converted: row.factor !== 1 };
}

export function normalizeRecord(record) {
  const missingConditions = Array.isArray(record.missing_conditions)
    ? record.missing_conditions
    : Object.entries(record.conditions ?? {}).filter(([, value]) => !value).map(([field]) => field);
  const traceable = Boolean(record.page && record.evidence_text && record.unit_raw && record.value_raw);
  const suppliedValue = record.normalized_value ?? record.value;
  const measurement = normalizeMeasurement(typeof suppliedValue === "string" ? Number(suppliedValue) : suppliedValue, record.unit_raw);
  const normalizedValue = record.normalized_value ?? measurement.value;
  const normalizedUnit = record.normalized_unit ?? measurement.unit;
  const valueStatus = record.value_status ?? (measurement.converted ? "converted" : "reported");
  const confidenceReasons = Array.isArray(record.confidence_reasons) ? [...record.confidence_reasons] : [];
  const addReason = (reason) => { if (!confidenceReasons.includes(reason)) confidenceReasons.push(reason); };
  if (!traceable) addReason("数值、单位、页码或证据原文不完整");
  if (missingConditions.length) addReason(`关键测试条件缺失: ${missingConditions.join(", ")}`);
  if (valueStatus === "inferred") addReason("包含推断值");
  if (normalizedValue == null || !normalizedUnit) addReason("数值单位无法规范化比较");
  const confidence = !traceable ? "low" : confidenceReasons.length ? "medium" : "high";
  return {
    ...record,
    value_status: valueStatus,
    normalized_value: normalizedValue,
    normalized_unit: normalizedUnit,
    missing_conditions: missingConditions,
    confidence,
    confidence_reasons: confidenceReasons,
    review_required: confidence !== "high",
  };
}
