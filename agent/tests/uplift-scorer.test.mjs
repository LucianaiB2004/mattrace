import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { median, scoreRun, summarizeUplift } from "../../skills/material-evidence-extractor/scripts/score-uplift.mjs";

const execFileAsync = promisify(execFile);

const gold = [{ material_name_normalized: "LLZTO", property_name: "thermal conductivity", normalized_value: 1.4, normalized_unit: "W m-1 K-1", source_document: "paper.pdf", page: "2" }];

test("objective scorer uses numeric tolerance and field-level partial credit", () => {
  const exact = scoreRun(gold, [{ ...gold[0], normalized_value: 1.401 }], { relative_tolerance: 0.01 });
  const partial = scoreRun(gold, [{ ...gold[0], page: "3" }], { relative_tolerance: 0.01 });
  assert.equal(exact.score, 1);
  assert.ok(partial.score > 0 && partial.score < 1);
  assert.equal(partial.fields.page, 0);
});

test("objective scorer matches duplicate material properties by source and page", () => {
  const duplicateGold = [gold[0], { ...gold[0], source_document: "paper-b.pdf", page: "8", normalized_value: 2.2 }];
  const predicted = [duplicateGold[1], duplicateGold[0]];
  assert.equal(scoreRun(duplicateGold, predicted).score, 1);
});

test("uplift is the difference between three-run medians", () => {
  assert.equal(median([0.2, 0.4, 0.3]), 0.3);
  assert.deepEqual(summarizeUplift([0.2, 0.3, 0.9], [0.7, 0.8, 0.75]), {
    baseline_median: 0.3,
    skill_median: 0.75,
    uplift: 0.45,
    runs_per_arm: 3,
  });
  assert.throws(() => summarizeUplift([0.2], [0.8]), /恰好运行 3 次/);
});

test("uplift scorer provides a reproducible command-line summary", async () => {
  const script = fileURLToPath(new URL("../../skills/material-evidence-extractor/scripts/score-uplift.mjs", import.meta.url));
  const { stdout } = await execFileAsync(process.execPath, [script, "--baseline", "0.2,0.3,0.9", "--skill", "0.7,0.8,0.75"]);
  assert.deepEqual(JSON.parse(stdout), { baseline_median: 0.3, skill_median: 0.75, uplift: 0.45, runs_per_arm: 3 });
});
