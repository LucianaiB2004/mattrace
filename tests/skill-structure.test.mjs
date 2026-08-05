import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const skillRoot = new URL("../skills/", import.meta.url);

test("contains one valid material evidence skill", async () => {
  const entries = await readdir(skillRoot, { withFileTypes: true });
  const directories = entries.filter((entry) => entry.isDirectory());
  assert.deepEqual(
    directories.map((entry) => entry.name),
    ["material-evidence-extractor"],
  );

  const skill = await readFile(
    new URL("material-evidence-extractor/SKILL.md", skillRoot),
    "utf8",
  );
  assert.match(skill, /^---\nname: material-evidence-extractor\n/m);
  assert.match(skill, /description: .{20,1024}\n---/s);
  assert.match(skill, /证据链/);
  assert.match(skill, /缺失条件/);
  assert.match(skill, /冲突/);
});

