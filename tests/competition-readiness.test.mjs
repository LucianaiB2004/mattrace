import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("repository documents competition models, local credential storage, and MIT license", async () => {
  const [readme, license] = await Promise.all([
    readFile(new URL("../README.md", import.meta.url), "utf8"),
    readFile(new URL("../LICENSE", import.meta.url), "utf8"),
  ]);
  assert.match(readme, /Qwen3\.8-Max/i);
  assert.match(readme, /Qwen3-vl-Plus/);
  assert.match(readme, /GLM 5\.2/);
  assert.match(readme, /Wan2\.7-Image-Pro/);
  assert.match(readme, /doubao-seed-evolving/);
  assert.match(readme, /api\/plan\/v3\/responses/);
  assert.match(readme, /OpenAI Responses API/);
  assert.match(readme, /localStorage/);
  assert.match(readme, /MIT License/);
  assert.match(license, /MIT License/);
});

test("Skill ships machine-readable schemas", async () => {
  const root = new URL("../skills/material-evidence-extractor/references/", import.meta.url);
  const [input, output] = await Promise.all([
    readFile(new URL("input-schema.json", root), "utf8"),
    readFile(new URL("output-schema.json", root), "utf8"),
  ]);
  const inputSchema = JSON.parse(input);
  const outputSchema = JSON.parse(output);
  assert.equal(inputSchema.properties.documents.minItems, 3);
  assert.equal(inputSchema.properties.documents.maxItems, 10);
  assert.ok(outputSchema.required.includes("coverage_matrix"));
  assert.ok(outputSchema.required.includes("records"));
});
