import test from "node:test";
import assert from "node:assert/strict";

import {
  detectConflicts,
  extractJsonObject,
  formatMeasurement,
  normalizeAnalysisResult,
} from "../app/domain/analysis.mjs";

const baseRecord = {
  material: "LLZO",
  process: "固相烧结",
  property: "离子电导率",
  value: 1.2,
  unit: "mS/cm",
  conditions: { temperature: "25°C", method: "阻抗法", frequency_range: "1 Hz-1 MHz" },
  sourceDocument: "paper-a.pdf",
  page: 12,
  evidence: "The ionic conductivity was 1.2 mS/cm at 25°C.",
  confidence: "high",
};

test("extractJsonObject accepts plain and fenced model JSON", () => {
  assert.deepEqual(extractJsonObject('{"records":[]}'), { records: [] });
  assert.deepEqual(
    extractJsonObject('回答如下：\n```json\n{"records":[],"missingConditions":[]}\n```'),
    { records: [], missingConditions: [] },
  );
});

test("extractJsonObject rejects prose without a JSON object", () => {
  assert.throws(() => extractJsonObject("模型暂时无法完成"), /未返回可解析的 JSON/);
});

test("extractJsonObject recovers complete records from a truncated stream", () => {
  const truncated = '```json\n{"status":"extracted","records":[{"material":"LLZO"},{"material":"LAG';
  const recovered = extractJsonObject(truncated);
  assert.deepEqual(recovered.records, [{ material: "LLZO" }, { material: "LAG" }]);
  const cutString = '{"records":[{"evidence":"unterminated';
  assert.deepEqual(extractJsonObject(cutString).records, [{ evidence: "unterminated" }]);
});

test("normalizeAnalysisResult creates evidence-rich records and linked alerts", () => {
  const result = normalizeAnalysisResult({
    records: [baseRecord],
    missingConditions: [{ recordIndex: 0, field: "relativeDensity", message: "缺少相对密度" }],
    conflicts: [],
    summary: "提取完成",
  });

  assert.equal(result.records[0].id, "record-1");
  assert.equal(result.records[0].normalizedValue, 0.0012);
  assert.equal(result.records[0].normalizedUnit, "S/cm");
  assert.equal(result.records[0].confidence, "high");
  assert.equal(result.records[0].reviewRequired, false);
  assert.equal(result.missingConditions[0].recordId, "record-1");
  assert.equal(result.summary, "提取完成");
});

test("normalizeAnalysisResult binds units despite punctuation or exponent differences", () => {
  const result = normalizeAnalysisResult({ records: [
    { ...baseRecord, property: "热导率", value: 1.4, unit: "W m^-1 K^-1", evidence: "The thermal conductivity was 1.4 W m−1 K−1 at 25°C.", conditions: { temperature: "25°C", method: "laser flash", orientation: "in-plane", density_or_porosity: "95%" } },
  ]});
  assert.equal(result.records[0].confidence, "high");
});

test("normalizeAnalysisResult ignores orphaned model alerts without discarding valid records", () => {
  const result = normalizeAnalysisResult({
    records: [{
      material: "LLZO", process: "固相烧结", property: "离子电导率", value: 1.2,
      unit: "mS/cm", conditions: {}, sourceDocument: "paper.pdf", page: 1,
      evidence: "LLZO reached 1.2 mS/cm.", confidence: "high",
    }],
    missingConditions: [{ recordIndex: 9, field: "temperature", message: "温度缺失" }],
  });
  assert.equal(result.records.length, 1);
  assert.deepEqual(result.missingConditions, []);
});

test("normalizeAnalysisResult rejects records without traceable evidence", () => {
  assert.throws(
    () => normalizeAnalysisResult({ records: [{ ...baseRecord, evidence: "" }] }),
    /第 1 条记录缺少证据原文/,
  );
});

test("normalizeAnalysisResult preserves ranges without inventing an exact value", () => {
  const result = normalizeAnalysisResult({ records: [{
    ...baseRecord,
    value: null,
    valueRaw: "1.0-1.4",
    valueKind: "range",
    evidence: "The ionic conductivity ranged from 1.0 to 1.4 mS/cm at 25°C.",
  }] });
  assert.equal(result.records[0].value, null);
  assert.equal(result.records[0].valueRaw, "1.0-1.4");
  assert.equal(result.records[0].valueKind, "range");
  assert.equal(result.records[0].normalizedValue, null);
  assert.equal(formatMeasurement(result.records[0]), "1.0-1.4 mS/cm");
});

test("normalizeAnalysisResult derives confidence from evidence instead of trusting the model", () => {
  const result = normalizeAnalysisResult({ records: [{ ...baseRecord, evidence: "LLZO was characterized.", confidence: "high" }] });
  assert.equal(result.records[0].confidence, "low");
  assert.equal(result.records[0].reviewRequired, true);
  assert.match(result.records[0].confidenceReasons.join(" "), /未定位到当前数值/);
});

test("normalizeAnalysisResult does not treat an unknown unit as normalized", () => {
  const result = normalizeAnalysisResult({ records: [{ ...baseRecord, value: 7, valueRaw: "7", unit: "arb. unit", evidence: "The response was 7 arb. unit at 25°C." }] });
  assert.equal(result.records[0].normalizedValue, null);
  assert.equal(result.records[0].normalizedUnit, null);
});

test("property-specific missing conditions cap confidence at medium", () => {
  const result = normalizeAnalysisResult({ records: [{ ...baseRecord, property: "热导率", conditions: { temperature: "25°C" }, evidence: "热导率为 1.2 mS/cm at 25°C." }] });
  assert.equal(result.records[0].confidence, "medium");
  assert.equal(result.records[0].reviewRequired, true);
  assert.match(result.records[0].confidenceReasons.join(" "), /method|orientation|density_or_porosity/);
});

test("condition status markers remain missing and prevent comparison", () => {
  const records = normalizeAnalysisResult({ records: [
    { ...baseRecord, conditions: { temperature: "not_reported", method: "unclear", frequency_range: "not_applicable" } },
    { ...baseRecord, value: 1.8, sourceDocument: "paper-b.pdf", conditions: { temperature: "not_reported", method: "unclear", frequency_range: "not_applicable" } },
  ] }).records;
  assert.equal(records[0].confidence, "medium");
  assert.deepEqual(detectConflicts(records), []);
});

test("normalizeAnalysisResult preserves raw and normalized material names", () => {
  const result = normalizeAnalysisResult({ records: [{
    ...baseRecord,
    material_name_raw: "Li6.4La3Zr1.4Ta0.6O12",
    material_name_normalized: "LLZTO",
  }] });
  assert.equal(result.records[0].materialRaw, "Li6.4La3Zr1.4Ta0.6O12");
  assert.equal(result.records[0].material, "LLZTO");
});

test("detectConflicts links compatible records whose values differ by more than 30 percent", () => {
  const records = normalizeAnalysisResult({
    records: [
      baseRecord,
      { ...baseRecord, value: 1.8, sourceDocument: "paper-b.pdf", page: 8 },
      { ...baseRecord, value: 1.4, property: "电子电导率", sourceDocument: "paper-c.pdf" },
    ],
  }).records;

  const conflicts = detectConflicts(records, 0.3);
  assert.equal(conflicts.length, 1);
  assert.deepEqual(conflicts[0].recordIds, ["record-1", "record-2"]);
  assert.equal(conflicts[0].differencePercent, 50);
});

test("detectConflicts does not compare records measured under different conditions", () => {
  const records = normalizeAnalysisResult({ records: [
    baseRecord,
    { ...baseRecord, value: 1.8, conditions: { temperature: "80°C", method: "阻抗法" }, sourceDocument: "paper-b.pdf" },
  ] }).records;
  assert.deepEqual(detectConflicts(records, 0.3), []);
});

test("detectConflicts does not compare two records that both omit critical conditions", () => {
  const records = normalizeAnalysisResult({ records: [
    { ...baseRecord, conditions: {}, value: 1.2 },
    { ...baseRecord, conditions: {}, value: 1.8, sourceDocument: "paper-b.pdf" },
  ] }).records;
  assert.deepEqual(detectConflicts(records, 0.3), []);
});
