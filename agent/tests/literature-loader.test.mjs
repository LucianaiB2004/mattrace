import test from "node:test";
import assert from "node:assert/strict";
import { loadLiteraturePages } from "../app/services/literature-loader.mjs";

test("bundled literature hydrates every normalized page from its companion asset", async () => {
  const document = { id: "paper-1", name: "renamed.pdf", type: "pdf", textUrl: "./paper.json", pages: [{ page: 1, text: "short" }], text: "short", pageCount: 1 };
  const fetchImpl = async (url) => {
    assert.equal(url, "./paper.json");
    return new Response(JSON.stringify({ pages: [{ page: 1, text: " first  page " }, { page: 2, text: "second\r\npage" }] }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const hydrated = await loadLiteraturePages(document, fetchImpl);
  assert.deepEqual(hydrated.pages, [{ page: 1, text: "first page" }, { page: 2, text: "second\npage" }]);
  assert.equal(hydrated.text, "first page\n\nsecond\npage");
  assert.equal(hydrated.pageCount, 2);
  assert.equal(hydrated.name, "renamed.pdf");
});

test("ordinary uploaded documents do not perform a companion fetch", async () => {
  const document = { id: "upload", name: "upload.pdf", pages: [{ page: 1, text: "complete" }], text: "complete", pageCount: 1 };
  const hydrated = await loadLiteraturePages(document, () => { throw new Error("must not fetch"); });
  assert.equal(hydrated, document);
});

test("literature hydration reports an actionable fetch failure", async () => {
  const document = { id: "paper", name: "paper.pdf", textUrl: "./missing.json" };
  await assert.rejects(() => loadLiteraturePages(document, async () => new Response("missing", { status: 404 })), /paper\.pdf.*HTTP 404/);
});
