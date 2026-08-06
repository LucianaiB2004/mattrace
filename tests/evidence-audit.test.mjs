import test from "node:test";
import assert from "node:assert/strict";

import { buildEvidenceAudit } from "../app/domain/evidence-audit.mjs";

const record = {
  id: "record-1", material: "LLZO", process: "固相烧结", property: "离子电导率",
  value: 1.2, unit: "mS/cm", normalizedValue: 0.0012, normalizedUnit: "S/cm",
  conditions: { temperature: "25°C", method: "EIS", frequency_range: "1 Hz-1 MHz" }, conditionText: "25°C，EIS，1 Hz-1 MHz", sourceDocument: "a.pdf",
  page: 2, evidence: "Conductivity was 1.2 mS/cm at 25°C.", confidence: "high",
};

test("evidence audit builds document coverage and deterministic passports", () => {
  const audit = buildEvidenceAudit([
    { documentId: "a", documentName: "a.pdf", pageCount: 3, checkedPages: [1, 2, 3], status: "extracted", records: [record], missingConditions: [] },
    { documentId: "b", documentName: "b.pdf", pageCount: 2, checkedPages: [1, 2], status: "no_evidence", records: [], reason: "未发现定量性能" },
  ]);
  assert.equal(audit.coverageMatrix.length, 2);
  assert.deepEqual(audit.coverageMatrix.map((row) => row.status), ["extracted", "no_evidence"]);
  assert.equal(audit.records[0].id, "record-1");
  assert.equal(audit.comparabilityPassports[0].scores.total, 100);
  assert.equal(audit.comparabilityPassports[0].comparable, true);
  assert.match(audit.summary, /2 篇文档/);
});

test("audit retains distinct evidence rows from every selected document", () => {
  const audit = buildEvidenceAudit([
    { documentId: "a", documentName: "a.pdf", status: "extracted", checkedPages: [2], records: [{ ...record, id: "record-1", material: "LLZO", sourceDocument: "wrong.pdf" }], missingConditions: [] },
    { documentId: "b", documentName: "b.pdf", status: "extracted", checkedPages: [7], records: [{ ...record, id: "record-1", material: "LATP", value: 2.4, valueRaw: "2.4", evidence: "Conductivity was 2.4 mS/cm at 25°C.", sourceDocument: "wrong.pdf" }], missingConditions: [] },
  ]);
  assert.deepEqual(audit.records.map((item) => item.id), ["record-1", "record-2"]);
  assert.deepEqual(audit.records.map((item) => item.material), ["LLZO", "LATP"]);
  assert.deepEqual(audit.records.map((item) => item.sourceDocument), ["a.pdf", "b.pdf"]);
});

test("audit gives incomplete evidence a lower, explainable score", () => {
  const audit = buildEvidenceAudit([{ documentId: "a", documentName: "a.pdf", pageCount: 1, checkedPages: [1], status: "extracted", records: [{ ...record, process: "未说明", page: "未定位", evidence: "", conditions: {}, conditionText: "未说明" }], missingConditions: [] }]);
  const passport = audit.comparabilityPassports[0];
  assert.ok(passport.scores.total < 60);
  assert.equal(passport.comparable, false);
  assert.ok(passport.reasons.length > 0);
});

test("audit refuses comparability when property-specific conditions are missing", () => {
  const audit = buildEvidenceAudit([{ documentId: "a", documentName: "a.pdf", pageCount: 1, checkedPages: [1], status: "extracted", records: [{ ...record, conditions: { temperature: "25°C" }, conditionText: "25°C" }] }]);
  const passport = audit.comparabilityPassports[0];
  assert.equal(passport.comparable, false);
  assert.ok(passport.reasons.some((reason) => /method|frequency_range/.test(reason)));
});

test("audit requires the evidence quote to contain the reported value and unit", () => {
  const audit = buildEvidenceAudit([{ documentId: "a", documentName: "a.pdf", pageCount: 1, checkedPages: [1], status: "extracted", records: [{ ...record, evidence: "LLZO was characterized at room temperature." }] }]);
  assert.equal(audit.comparabilityPassports[0].comparable, false);
  assert.match(audit.comparabilityPassports[0].reasons.join(" "), /数值与单位/);
});

test("audit refuses comparability when the quote is not bound to submitted source text", () => {
  const audit = buildEvidenceAudit([{ documentId: "a", documentName: "a.pdf", status: "extracted", checkedPages: [1], records: [{ ...record, evidenceSourceBound: false }] }]);
  assert.equal(audit.comparabilityPassports[0].comparable, false);
  assert.match(audit.comparabilityPassports[0].reasons.join(" "), /实际提交片段/);
});

test("audit merges each selected document's model alerts and derived condition gaps", () => {
  const audit = buildEvidenceAudit([{
    documentId: "a", documentName: "a.pdf", pageCount: 2, checkedPages: [1, 2], status: "extracted",
    records: [{ ...record, conditions: { temperature: "25°C" }, conditionText: "25°C" }],
    missingConditions: [{ recordId: "record-1", field: "relative_density", message: "来源未报告相对密度" }],
  }]);
  assert.ok(audit.missingConditions.some((item) => item.recordId === "record-1" && item.field === "relative_density"));
  assert.ok(audit.missingConditions.some((item) => item.recordId === "record-1" && item.field === "method"));
  assert.ok(audit.missingConditions.some((item) => item.recordId === "record-1" && item.field === "frequency_range"));
});
