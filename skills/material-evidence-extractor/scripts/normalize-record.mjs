const confidenceOrder = ["low", "medium", "high"];

export function normalizeRecord(record) {
  const missingConditions = Object.entries(record.conditions ?? {}).filter(([, value]) => !value).map(([field]) => field);
  const evidenceConfidence = record.page && record.evidenceText && record.unit ? "high" : record.evidenceText ? "medium" : "low";
  const conditionConfidence = missingConditions.length ? "medium" : "high";
  const confidence = confidenceOrder[Math.min(confidenceOrder.indexOf(evidenceConfidence), confidenceOrder.indexOf(conditionConfidence))];
  return { ...record, missingConditions, confidence, reviewRequired: confidence !== "high" };
}
