import assert from "node:assert/strict";
import test from "node:test";

import { competitionMode } from "../app/domain/competition-mode.mjs";

test("analysis mode reports a neutral document-count label without competition wording", () => {
  assert.deepEqual(competitionMode(0), { strict: false, label: "未选择文档" });
  assert.deepEqual(competitionMode(1), { strict: true, label: "已选择 1 篇文档" });
  assert.deepEqual(competitionMode(3), { strict: true, label: "已选择 3 篇文档" });
  assert.deepEqual(competitionMode(10), { strict: true, label: "已选择 10 篇文档" });
  assert.deepEqual(competitionMode(20), { strict: true, label: "已选择 20 篇文档" });
  for (const count of [0, 1, 3, 10, 20]) {
    assert.doesNotMatch(competitionMode(count).label, /比赛|严格模式|演示模式/);
  }
});
