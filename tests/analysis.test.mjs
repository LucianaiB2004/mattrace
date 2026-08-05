import test from "node:test";
import assert from "node:assert/strict";

import {
  detectConflicts,
  extractJsonObject,
  normalizeAnalysisResult,
} from "../app/domain/analysis.mjs";

const baseRecord = {
  material: "LLZO",
  process: "固相烧结",
  property: "离子电导率",
  value: 1.2,
  unit: "mS/cm",
  conditions: { temperature: "25°C", method: "阻抗法" },
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
  assert.equal(result.missingConditions[0].recordId, "record-1");
  assert.equal(result.summary, "提取完成");
});

test("normalizeAnalysisResult rejects records without traceable evidence", () => {
  assert.throws(
    () => normalizeAnalysisResult({ records: [{ ...baseRecord, evidence: "" }] }),
    /第 1 条记录缺少证据原文/,
  );
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
