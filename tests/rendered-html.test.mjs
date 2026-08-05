import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the MatTrace dashboard landmarks", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>MatTrace/);
  assert.match(html, /材料文献数据提取与核验 Agent/);
  assert.match(html, /文档工作区/);
  assert.match(html, /Agent 工作进度/);
  assert.match(html, /分析结果与证据/);
  assert.match(html, /证据链预览/);
  assert.match(html, /https:\/\/ai\.chipcloud\.cc/);
  assert.match(html, /qwen3\.8-max/);
  assert.match(html, /使用示例运行/);
  assert.match(html, /开始真实分析/);
  assert.match(html, /保存当前项目/);
  assert.match(html, /恢复项目/);
  assert.match(html, /文档工作区/);
  assert.match(html, /分析结果与证据/);
  assert.match(html, /导出预览/);
  assert.match(html, /隐私与数据流/);
  assert.match(html, /aria-live="polite"/);
});

test("removes starter preview metadata and dependencies", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(page, /codex-preview|SkeletonPreview/);
  assert.doesNotMatch(layout, /Starter Project/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
