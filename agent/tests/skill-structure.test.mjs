import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const skillRoot = new URL("../../skills/", import.meta.url);

test("contains one valid material evidence skill", async () => {
  const entries = await readdir(skillRoot, { withFileTypes: true });
  const directories = entries.filter((entry) => entry.isDirectory());
  assert.deepEqual(
    directories.map((entry) => entry.name),
    ["material-evidence-extractor"],
  );

  const skill = (await readFile(
    new URL("material-evidence-extractor/SKILL.md", skillRoot),
    "utf8",
  )).replace(/\r\n/g, "\n");
  assert.match(skill, /^---\nname: material-evidence-extractor\n/m);
  assert.match(skill, /description: .{20,1024}\n---/s);
  assert.match(skill, /证据链/);
  assert.match(skill, /缺失条件/);
  assert.match(skill, /冲突/);
  assert.match(skill, /1-20/);
  assert.match(skill, /3-10/);
  assert.match(skill, /Evidence Coverage & Comparability Auditor/);
  assert.match(skill, /专利/);
  assert.match(skill, /TDS/);
  assert.match(skill, /JSON\/CSV/);
  const required = [
    "agents/openai.yaml", "references/output-schema.md", "examples/records.jsonl",
    "examples/comparison.csv", "examples/evidence-report.md", "examples/missing-and-conflicts.md",
    "examples/review-queue.csv", "scripts/extract-evidence.mjs", "scripts/normalize-record.mjs",
    "scripts/build-deliverables.mjs",
    "references/coverage-and-comparability.md", "examples/coverage-matrix.csv",
    "examples/comparability-passports.jsonl",
    "examples/document-outcomes.jsonl", "references/evaluation-protocol.md",
    "references/failure-cases.md", "references/input-schema.json", "references/output-schema.json",
    "scripts/score-uplift.mjs",
    "scripts/verify-skill.mjs",
  ];
  for (const path of required) assert.ok((await readFile(new URL(`material-evidence-extractor/${path}`, skillRoot), "utf8")).trim(), `${path} must exist`);
});
