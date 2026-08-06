import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { buildDeliverables } from "../skills/material-evidence-extractor/scripts/build-deliverables.mjs";
import { extractEvidence } from "../skills/material-evidence-extractor/scripts/extract-evidence.mjs";
import { normalizeRecord } from "../skills/material-evidence-extractor/scripts/normalize-record.mjs";

const skillRoot = new URL("../skills/material-evidence-extractor/", import.meta.url);
const execFileAsync = promisify(execFile);

test("canonical snake_case records remain traceable through normalization", async () => {
  const [line] = (await readFile(new URL("examples/records.jsonl", skillRoot), "utf8")).trim().split(/\r?\n/);
  const normalized = normalizeRecord(JSON.parse(line));
  assert.equal(normalized.evidence_text.includes("1.4 W m-1 K-1"), true);
  assert.equal(normalized.unit_raw, "W m-1 K-1");
  assert.equal(normalized.confidence, "medium");
  assert.equal(normalized.review_required, true);
  assert.ok(normalized.confidence_reasons.includes("关键测试条件缺失: relative_density"));
});

test("deliverable builder emits every file promised by the Skill contract", async () => {
  const [line] = (await readFile(new URL("examples/records.jsonl", skillRoot), "utf8")).trim().split(/\r?\n/);
  const record = JSON.parse(line);
  const output = buildDeliverables(
    [record],
    [{ document_id: record.document_id, document_name: record.source_document, status: "extracted", page_count: 14, checked_pages: [2], record_count: 1, reason: "" }],
    [{ record_id: record.record_id, comparable: true, scores: { total: 85 }, reasons: [] }],
  );
  assert.deepEqual(Object.keys(output).sort(), [
    "comparability-passports.jsonl", "comparison.csv", "coverage-matrix.csv",
    "evidence-report.md", "missing-and-conflicts.md", "records.jsonl", "review-queue.csv",
  ]);
  assert.match(output["comparison.csv"], /LLZTO/);
  assert.match(output["evidence-report.md"], /Solid Electrolytes 2021\.pdf/);
  assert.match(output["review-queue.csv"], /relative_density/);
});

test("comparison output excludes non-comparable records and conflict report keeps conflicts", async () => {
  const [line] = (await readFile(new URL("examples/records.jsonl", skillRoot), "utf8")).trim().split(/\r?\n/);
  const record = JSON.parse(line);
  const output = buildDeliverables([record], [], [{ record_id: record.record_id, comparable: false, scores: { total: 65 }, reasons: [] }], [{ id: "conflict-1", message: "条件兼容记录差异超过 30%" }]);
  assert.doesNotMatch(output["comparison.csv"], /LLZTO/);
  assert.match(output["missing-and-conflicts.md"], /条件兼容记录差异超过 30%/);
});

test("bundled comparison example contains only records marked comparable", async () => {
  const [comparison, passportText] = await Promise.all([
    readFile(new URL("examples/comparison.csv", skillRoot), "utf8"),
    readFile(new URL("examples/comparability-passports.jsonl", skillRoot), "utf8"),
  ]);
  const comparableIds = passportText.trim().split(/\r?\n/).map(JSON.parse).filter((item) => item.comparable).map((item) => item.record_id);
  for (const id of comparableIds) assert.match(comparison, new RegExp(id));
  if (!comparableIds.length) assert.equal(comparison.trim().split(/\r?\n/).length, 1);
});

test("competition Skill declares strict 3-10 input and links evaluation and failure contracts", async () => {
  const skill = await readFile(new URL("SKILL.md", skillRoot), "utf8");
  assert.match(skill, /严格模式[^\n]*3-10/);
  assert.match(skill, /evaluation-protocol\.md/);
  assert.match(skill, /failure-cases\.md/);
  assert.match(skill, /score-uplift\.mjs/);
});

test("evidence candidate extractor handles bilingual prose and numeric table rows", () => {
  const candidates = extractEvidence({ id: "doc", name: "paper.pdf", pages: [
    { page: 2, text: "该样品在25°C下的离子电导率为1.2 mS/cm。The tensile strength was 685 MPa." },
    { page: 4, text: "Material | Thermal conductivity | Density\nLLZTO | 1.4 W m-1 K-1 | 96%" },
  ] });
  assert.equal(candidates.length, 3);
  assert.deepEqual([...new Set(candidates.map((item) => item.page))], [2, 4]);
  assert.ok(candidates.every((item) => item.evidenceText.length < 220));
});

test("standalone Skill folder passes its minimum reproducibility check", async () => {
  const script = fileURLToPath(new URL("scripts/verify-skill.mjs", skillRoot));
  const { stdout } = await execFileAsync(process.execPath, [script]);
  const result = JSON.parse(stdout);
  assert.equal(result.ok, true);
  assert.equal(result.example_records, 1);
  assert.equal(result.document_outcomes, 4);
  assert.equal(result.deliverables, 7);
  assert.equal(result.schema_validated, true);
});
