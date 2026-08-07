import test from "node:test";
import assert from "node:assert/strict";

import { parseDocument } from "../app/services/document-parser.mjs";

test("TXT and Markdown documents decode into normalized parsed documents", async () => {
  const source = new File(["材料：LLZO\r\n电导率：1.2 mS/cm"], "实验记录.txt", {
    type: "text/plain",
  });
  const progress = [];
  const parsed = await parseDocument(source, (value) => progress.push(value));
  assert.equal(parsed.name, "实验记录.txt");
  assert.equal(parsed.type, "txt");
  assert.equal(parsed.text, "材料：LLZO\n电导率：1.2 mS/cm");
  assert.deepEqual(parsed.pages, [{ page: 1, text: "材料：LLZO\n电导率：1.2 mS/cm" }]);
  assert.deepEqual(progress, [0, 100]);
});

test("document parser rejects empty text instead of producing an empty analysis input", async () => {
  const source = new File(["   \n"], "empty.md", { type: "text/markdown" });
  await assert.rejects(() => parseDocument(source), /没有可提取的文本/);
});

test("document parser rejects an unsupported extension", async () => {
  const source = new File(["data"], "data.csv", { type: "text/csv" });
  await assert.rejects(() => parseDocument(source), /不支持的文档类型/);
});
