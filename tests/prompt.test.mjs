import test from "node:test";
import assert from "node:assert/strict";

import { buildAnalysisMessages, selectEvidenceExcerpts } from "../app/domain/prompt.mjs";

test("analysis prompt bounds large real-paper batches for browser gateways", () => {
  const documents = Array.from({ length: 3 }, (_, index) => ({
    name: `paper-${index + 1}.pdf`,
    pages: [{ page: 1, text: "x".repeat(40_000) }],
  }));
  const messages = buildAnalysisMessages(documents);
  assert.equal(messages.length, 2);
  assert.ok(messages[1].content.length < 1_500);
  assert.match(messages[1].content, /paper-1\.pdf/);
  assert.match(messages[1].content, /paper-3\.pdf/);
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
