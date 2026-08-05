import test from "node:test";
import assert from "node:assert/strict";
import {
  SKILL_FILES,
  DEFAULT_SKILL_CONTENT,
  buildSkillZip,
  loadSkillWorkspace,
  saveSkillFile,
  buildSkillDownload,
  loadSkill,
  resetSkill,
  saveSkill,
} from "../app/domain/skill-workspace.mjs";
import JSZip from "jszip";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test("Skill workspace loads the competition Skill and persists an edited version", () => {
  const storage = memoryStorage();
  assert.match(loadSkill(storage), /name: material-evidence-extractor/);
  const edited = `${DEFAULT_SKILL_CONTENT}\n\n## 团队规则\n所有冲突进入人工复核。`;
  saveSkill(storage, edited);
  assert.equal(loadSkill(storage), edited);
});

test("complete workspace exposes editable contracts, examples, and core code", () => {
  const workspace = loadSkillWorkspace(memoryStorage());
  assert.equal(workspace.files.length, 14);
  assert.deepEqual(workspace.files.filter((file) => file.editable).map((file) => file.path), ["SKILL.md", "agents/openai.yaml", "references/output-schema.md", "references/coverage-and-comparability.md"]);
  assert.ok(SKILL_FILES.some((file) => file.path === "examples/records.jsonl"));
  assert.ok(SKILL_FILES.some((file) => file.path === "scripts/extract-evidence.mjs"));
  assert.ok(SKILL_FILES.some((file) => file.path === "examples/coverage-matrix.csv"));
  assert.ok(SKILL_FILES.some((file) => file.path === "examples/comparability-passports.jsonl"));
});

test("workspace persists editable files and rejects read-only or secret content", () => {
  const storage = memoryStorage();
  saveSkillFile(storage, "agents/openai.yaml", "interface:\n  display_name: MatTrace");
  assert.match(loadSkillWorkspace(storage).files.find((file) => file.path === "agents/openai.yaml").content, /MatTrace/);
  assert.throws(() => saveSkillFile(storage, "examples/records.jsonl", "changed"), /只读/);
  assert.throws(() => saveSkillFile(storage, "SKILL.md", "API Key: sk-secretvalue1234567890"), /敏感凭证/);
});

test("complete ZIP contains the canonical root folder and every file", async () => {
  const blob = await buildSkillZip(loadSkillWorkspace(memoryStorage()));
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  for (const file of SKILL_FILES) assert.ok(zip.file(`material-evidence-extractor/${file.path}`), file.path);
});

test("Skill workspace rejects empty content and credential-like secrets", () => {
  const storage = memoryStorage();
  assert.throws(() => saveSkill(storage, "  "), /不能为空/);
  assert.throws(() => saveSkill(storage, `${DEFAULT_SKILL_CONTENT}\nAPI Key: sk-secretvalue1234567890`), /敏感凭证/);
});

test("Skill workspace restores default content and builds a Markdown download", () => {
  const storage = memoryStorage();
  saveSkill(storage, `${DEFAULT_SKILL_CONTENT}\nchanged`);
  assert.equal(resetSkill(storage), DEFAULT_SKILL_CONTENT);
  assert.equal(loadSkill(storage), DEFAULT_SKILL_CONTENT);
  assert.deepEqual(buildSkillDownload(DEFAULT_SKILL_CONTENT), {
    filename: "SKILL.md",
    content: DEFAULT_SKILL_CONTENT,
    mime: "text/markdown",
  });
});
