import test from "node:test";
import assert from "node:assert/strict";

import { buildEvidenceAudit } from "../app/domain/evidence-audit.mjs";

const record = {
  id: "record-1", material: "LLZO", process: "固相烧结", property: "离子电导率",
  value: 1.2, unit: "mS/cm", normalizedValue: 0.0012, normalizedUnit: "S/cm",
  conditions: { temperature: "25°C" }, conditionText: "25°C", sourceDocument: "a.pdf",
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

test("audit gives incomplete evidence a lower, explainable score", () => {
  const audit = buildEvidenceAudit([{ documentId: "a", documentName: "a.pdf", pageCount: 1, checkedPages: [1], status: "extracted", records: [{ ...record, process: "未说明", page: "未定位", evidence: "", conditions: {}, conditionText: "未说明" }], missingConditions: [] }]);
  const passport = audit.comparabilityPassports[0];
  assert.ok(passport.scores.total < 60);
  assert.equal(passport.comparable, false);
  assert.ok(passport.reasons.length > 0);
});
