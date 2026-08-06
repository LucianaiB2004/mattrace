import assert from "node:assert/strict";
import test from "node:test";

import { competitionMode } from "../app/domain/competition-mode.mjs";

test("competition mode distinguishes the official 3-10 range from demo runs", () => {
  assert.deepEqual(competitionMode(0), { strict: false, label: "未选择文档" });
  assert.deepEqual(competitionMode(1), { strict: false, label: "演示模式 · 比赛要求 3–10 篇" });
  assert.deepEqual(competitionMode(3), { strict: true, label: "比赛严格模式 · 3–10 篇" });
  assert.deepEqual(competitionMode(10), { strict: true, label: "比赛严格模式 · 3–10 篇" });
  assert.deepEqual(competitionMode(11), { strict: false, label: "演示模式 · 比赛要求 3–10 篇" });
});
