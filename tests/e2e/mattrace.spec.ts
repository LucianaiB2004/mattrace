import { expect, test, type Page } from "@playwright/test";

function monitorRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  return errors;
}

async function waitForHydration(page: Page) {
  await page.waitForFunction(() => {
    const element = document.querySelector(".drop-zone");
    return !!element && Object.keys(element).some((key) => key.startsWith("__reactProps"));
  });
}

test("example mode, evidence navigation, and exports work end to end", async ({ page }) => {
  const errors = monitorRuntimeErrors(page);
  await page.goto("/");
  await waitForHydration(page);
  await expect(page.getByRole("heading", { name: "文档工作区" })).toBeVisible();
  await page.getByRole("button", { name: "使用示例运行" }).click();
  await expect(page.getByText("6/6 已完成")).toBeVisible();
  await expect(page.getByText(/示例分析完成/)).toBeVisible();

  await page.getByRole("button", { name: /文献管理/ }).click();
  await expect(page.getByRole("dialog", { name: "文档管理" })).toBeVisible();
  await page.getByRole("dialog", { name: "文档管理" }).getByRole("button", { name: "关闭详情" }).click();

  await page.getByRole("button", { name: /查看 Li₇La₃Zr₂O₁₂ 的证据/ }).first().click();
  await page.getByRole("button", { name: "查看全部", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "证据链详情" })).toContainText("Adv. Mater. 2024.pdf");
  await page.getByRole("dialog", { name: "证据链详情" }).getByRole("button", { name: "关闭详情" }).click();

  await page.getByRole("button", { name: "Markdown" }).click();
  await expect(page.getByRole("dialog", { name: "导出预览" })).toContainText("# MatTrace 材料证据报告");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /下载 mattrace-report\.md/ }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("mattrace-report.md");
  await page.getByRole("dialog", { name: "导出预览" }).getByRole("button", { name: "关闭详情" }).click();
  await page.screenshot({ path: "docs/mattrace-complete-preview.png", fullPage: true });
  expect(errors).toEqual([]);
});

test("local text upload drives a mocked real model analysis without persisting the key", async ({ page }) => {
  const errors = monitorRuntimeErrors(page);
  await page.route("**/v1/chat/completions", async (route) => {
    const request = route.request();
    expect(request.headers().authorization).toBe("Bearer runtime-test-key");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ choices: [{ message: { content: JSON.stringify({
        summary: "真实测试提取完成",
        records: [{ material: "LLZO", process: "固相烧结", property: "离子电导率", value: 1.2, unit: "mS/cm", conditions: { temperature: "25°C", method: "阻抗法" }, sourceDocument: "paper-a.txt", page: 1, evidence: "LLZO conductivity is 1.2 mS/cm at 25°C.", confidence: "high" }],
        missingConditions: [], conflicts: [],
      }) } }] }),
    });
  });
  await page.goto("/");
  await waitForHydration(page);
  await page.locator('input[type="file"]').setInputFiles([
    { name: "paper-a.txt", mimeType: "text/plain", buffer: Buffer.from("LLZO conductivity is 1.2 mS/cm at 25°C.") },
    { name: "paper-b.txt", mimeType: "text/plain", buffer: Buffer.from("LLZO was solid-state sintered at 900 C.") },
    { name: "paper-c.md", mimeType: "text/markdown", buffer: Buffer.from("# Evidence\nImpedance spectroscopy was used.") },
  ]);
  await expect(page.getByRole("button", { name: /TXT paper-a/ })).toBeVisible();
  await expect(page.getByText("已添加 3/10")).toBeVisible();

  await page.getByRole("button", { name: "打开模型配置" }).click();
  const dialog = page.getByRole("dialog", { name: "模型配置" });
  await dialog.getByLabel("API Key").fill("runtime-test-key");
  await dialog.getByRole("button", { name: "应用配置" }).click();
  await page.getByRole("button", { name: "开始真实分析" }).click();
  await expect(page.getByText("真实分析完成，共提取 1 条数据")).toBeVisible();
  await expect(page.getByRole("cell", { name: "LLZO" })).toBeVisible();

  await page.getByRole("button", { name: "保存当前项目" }).click();
  await expect(page.getByText("当前项目已安全保存，不包含 API Key")).toBeVisible();
  const persisted = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("mattrace-projects", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const request = database.transaction("workspace").objectStore("workspace").get("current");
    return await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
  expect(JSON.stringify(persisted)).not.toContain("runtime-test-key");
  expect(errors).toEqual([]);
});

test("mobile layout stays within the viewport and keyboard Escape closes dialogs", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await waitForHydration(page);
  await page.getByRole("button", { name: "打开模型配置" }).click();
  await expect(page.getByRole("dialog", { name: "模型配置" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "模型配置" })).toBeHidden();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: "docs/mattrace-mobile-preview.png", fullPage: true });
});
