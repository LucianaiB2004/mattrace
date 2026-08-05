import test from "node:test";
import assert from "node:assert/strict";

import { buildDocumentAnalysisMessages, selectEvidenceExcerpts } from "../app/domain/prompt.mjs";

test("analysis prompt applies the Skill contract to one document", () => {
  const messages = buildDocumentAnalysisMessages({
    name: "paper.pdf",
    pages: [{ page: 1, text: "LLZO conductivity is 1.2 mS/cm at 25°C." }],
  });
  assert.equal(messages.length, 2);
  assert.match(messages[0].content, /材料组成/);
  assert.match(messages[0].content, /缺失字段/);
  assert.match(messages[0].content, /来源页码/);
  assert.match(messages[0].content, /全部可追溯的定量性能记录/);
  assert.doesNotMatch(messages[0].content, /最有代表性的 1 条/);
  assert.match(messages[1].content, /paper\.pdf/);
});

test("evidence selection finds quantitative sentences beyond a paper cover page", () => {
  const excerpt = selectEvidenceExcerpts({ pages: [
    { page: 1, text: "A very long title and author list without results." },
    { page: 8, text: "The thermal conductivity of LLZO was 1.4 W m-1 K-1 at room temperature. More prose." },
  ] });
  assert.match(excerpt, /第 8 页/);
  assert.match(excerpt, /1\.4 W m-1 K-1/);
  assert.doesNotMatch(excerpt, /author list/);
});

test("evidence selection keeps quantitative content from punctuation-poor PDF pages", () => {
  const excerpt = selectEvidenceExcerpts({ pages: [{ page: 2, text: `${"Methods text ".repeat(100)} thermal conductivity was 1.4 W m-1 K-1 at 300 K` }] });
  assert.match(excerpt, /第 2 页/);
  assert.match(excerpt, /thermal conductivity/);
});
