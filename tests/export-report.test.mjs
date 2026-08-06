import test from "node:test";
import assert from "node:assert/strict";

import { buildAuditExport, buildExport } from "../app/domain/export-report.mjs";

const report = {
  summary: "共提取 1 条数据",
  generatedAt: "2026-08-05T00:00:00.000Z",
  records: [{
    id: "record-1",
    materialRaw: "Li7La3Zr2O12",
    material: "LLZO, Ta 掺杂",
    process: "固相烧结",
    property: "离子电导率",
    value: 1.2,
    unit: "mS/cm",
    normalizedValue: 0.0012,
    normalizedUnit: "S/cm",
    conditions: { temperature: "25°C", method: "阻抗法" },
    conditionText: "25°C，阻抗法",
    sourceDocument: "paper-a.pdf",
    page: 12,
    evidence: "The value was 1.2 mS/cm.",
    confidence: "high",
  }],
  missingConditions: [{ id: "missing-1", recordId: "record-1", field: "density", message: "缺少密度" }],
  conflicts: [{ id: "conflict-1", recordIds: ["record-1", "record-2"], message: "差异超过 30%", differencePercent: 50 }],
};

test("JSON export preserves evidence and provenance", () => {
  const output = buildExport("json", report);
  const parsed = JSON.parse(output.content);
  assert.equal(output.filename, "mattrace-report.json");
  assert.equal(parsed.records[0].evidence_text, "The value was 1.2 mS/cm.");
  assert.equal(parsed.records[0].source_document, "paper-a.pdf");
  assert.equal(parsed.records[0].material_name_raw, "Li7La3Zr2O12");
  assert.equal(parsed.records[0].material_name_normalized, "LLZO, Ta 掺杂");
  assert.equal(parsed.missing_conditions.length, 1);
  assert.ok(Array.isArray(parsed.coverage_matrix));
  assert.ok(Array.isArray(parsed.review_queue));
});

test("CSV export has a UTF-8 BOM and correctly quotes commas", () => {
  const output = buildExport("csv", report);
  assert.equal(output.content.charCodeAt(0), 0xfeff);
  assert.match(output.content, /"LLZO, Ta 掺杂"/);
  assert.match(output.content, /证据原文/);
});

test("Markdown export contains summary, evidence, missing conditions, and conflicts", () => {
  const output = buildExport("markdown", report);
  assert.match(output.content, /# MatTrace 材料证据报告/);
  assert.match(output.content, /The value was 1\.2 mS\/cm\./);
  assert.match(output.content, /## 缺失条件/);
  assert.match(output.content, /## 冲突检测/);
});

test("export rejects an empty report and unknown formats", () => {
  assert.throws(() => buildExport("json", { records: [] }), /暂无可导出的分析结果/);
  assert.throws(() => buildExport("xml", report), /不支持的导出格式/);
});

test("audit exports coverage matrix and comparability passports", () => {
  const audited = {
    ...report,
    coverageMatrix: [{ documentName: "a.pdf", status: "extracted", pageCount: 3, checkedPages: [1, 2, 3], recordCount: 1, reason: "" }],
    comparabilityPassports: [{ recordId: "record-1", material: "LLZO", property: "conductivity", sourceDocument: "a.pdf", comparable: true, scores: { evidence: 35, completeness: 25, conditions: 20, comparability: 20, total: 100 }, reasons: [] }],
  };
  const coverage = buildAuditExport("coverage", audited);
  const passports = buildAuditExport("passports", audited);
  assert.equal(coverage.filename, "coverage-matrix.csv");
  assert.match(coverage.content, /a\.pdf,extracted/);
  assert.equal(passports.filename, "comparability-passports.jsonl");
  assert.equal(JSON.parse(passports.content).scores.total, 100);
});
