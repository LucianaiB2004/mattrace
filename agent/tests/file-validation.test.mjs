import test from "node:test";
import assert from "node:assert/strict";

import { validateFiles } from "../app/services/file-validation.mjs";

function file(name, size = 1024) {
  return { name, size };
}

test("file validation accepts supported unique documents", () => {
  const result = validateFiles(
    [file("a.pdf"), file("b.docx"), file("notes.txt"), file("readme.md")],
    [],
  );
  assert.equal(result.accepted.length, 4);
  assert.equal(result.rejected.length, 0);
});

test("file validation rejects unsupported, oversized, and duplicate files with reasons", () => {
  const result = validateFiles(
    [file("image.png"), file("huge.pdf", 50 * 1024 * 1024 + 1), file("same.pdf")],
    [{ name: "same.pdf", size: 1024 }],
  );
  assert.deepEqual(result.rejected.map((item) => item.code), [
    "unsupported-type",
    "too-large",
    "duplicate",
  ]);
});

test("file validation enforces the twenty-file workspace cap", () => {
  const existing = Array.from({ length: 19 }, (_, index) => file(`old-${index}.pdf`));
  const result = validateFiles([file("new-a.pdf"), file("new-b.pdf")], existing);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.rejected[0].code, "workspace-full");
  assert.match(result.rejected[0].message, /20/);
});
