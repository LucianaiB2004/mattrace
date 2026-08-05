import test from "node:test";
import assert from "node:assert/strict";
import { EXAMPLE_DOCUMENTS, createExampleReport } from "../app/domain/example-data.mjs";

test("bundled evidence records point to the real bundled PDF literature", () => {
  const documents = new Set(EXAMPLE_DOCUMENTS.map((document) => document.name));
  const report = createExampleReport();
  assert.equal(report.records.length, 4);
  for (const record of report.records) {
    assert.equal(documents.has(record.sourceDocument), true, `${record.sourceDocument} is not a bundled PDF`);
    assert.equal(Number.isInteger(record.page), true);
    assert.ok(record.evidence.length > 30, `evidence is too short for ${record.material}`);
  }
  assert.deepEqual(report.records.map((record) => record.material), [
    "Li₆.₄La₃Zr₁.₄Ta₀.₆O₁₂",
    "Li₁.₅Al₀.₅Ge₁.₅(PO₄)₃",
    "Cs₂LiNd(BO₃)₂",
    "Li₃P",
  ]);
});
