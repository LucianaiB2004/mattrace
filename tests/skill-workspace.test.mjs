import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SKILL_CONTENT,
  buildSkillDownload,
  loadSkill,
  resetSkill,
  saveSkill,
} from "../app/domain/skill-workspace.mjs";

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
