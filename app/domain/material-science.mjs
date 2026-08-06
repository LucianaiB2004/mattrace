function conditionValue(conditions, field) {
  const missingMarkers = new Set(["not_reported", "not_applicable", "unclear", "未说明"]);
  const aliases = {
    method: ["method", "test_method"],
    frequency_range: ["frequency_range", "frequency"],
    density_or_porosity: ["relative_density", "density", "porosity"],
    loading_rate: ["loading_rate", "strain_rate"],
  }[field] ?? [field];
  return aliases.some((key) => {
    const value = conditions?.[key];
    const normalized = value == null ? "" : String(value).trim().toLowerCase();
    return Boolean(normalized) && !missingMarkers.has(normalized);
  });
}

export function requiredConditions(property) {
  const name = String(property ?? "").toLowerCase();
  if (/ionic conduct|离子电导/.test(name)) return ["temperature", "method", "frequency_range"];
  if (/thermal conduct|热导/.test(name)) return ["temperature", "method", "orientation", "density_or_porosity"];
  if (/strength|modulus|硬度|强度|模量/.test(name)) return ["temperature", "loading_rate", "orientation", "sample_form"];
  return ["temperature", "method"];
}

export function missingRequiredConditions(property, conditions) {
  return requiredConditions(property).filter((field) => !conditionValue(conditions, field));
}
