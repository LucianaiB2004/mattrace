import { expect, test, type Page } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import JSZip from "jszip";

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

async function pdfFixture() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([500, 700]);
  page.drawText("LLZO ionic conductivity: 1.2 mS/cm at 25 C.", { x: 40, y: 640, size: 14, font });
  return Buffer.from(await pdf.save());
}

async function docxFixture() {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file("_rels/.rels", '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file("word/document.xml", '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>MXene capacity is 312 mAh/g at 1 A/g.</w:t></w:r></w:p></w:body></w:document>');
  return Buffer.from(await zip.generateAsync({ type: "uint8array" }));
}

test("bundled literature mode, evidence navigation, and exports work end to end", async ({ page }) => {
  const errors = monitorRuntimeErrors(page);
  await page.goto("/");
  await waitForHydration(page);
  await expect(page.getByRole("heading", { name: "文档工作区" })).toBeVisible();
  await page.getByRole("button", { name: "载入公开论文" }).click();
  await expect(page.getByText("6/6 已完成")).toBeVisible();
  await expect(page.getByText(/公开论文分析完成/)).toBeVisible();

  await page.getByRole("button", { name: /文献管理/ }).click();
  await expect(page.getByRole("dialog", { name: "文档管理" })).toBeVisible();
  await page.getByRole("dialog", { name: "文档管理" }).getByRole("button", { name: "关闭详情" }).click();

  await page.getByRole("button", { name: /查看 Li₆.₄La₃Zr₁.₄Ta₀.₆O₁₂ 的证据/ }).first().click();
  await page.getByRole("button", { name: "查看全部", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "证据链详情" })).toContainText("Solid Electrolytes 2021.pdf");
  await page.getByRole("dialog", { name: "证据链详情" }).getByRole("button", { name: "关闭详情" }).click();

  await page.getByRole("button", { name: "Markdown" }).click();
  await expect(page.getByRole("dialog", { name: "导出预览" })).toContainText("# MatTrace 材料证据报告");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /下载 mattrace-report\.md/ }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("mattrace-report.md");
  await page.getByRole("dialog", { name: "导出预览" }).getByRole("button", { name: "关闭详情" }).click();
  await page.screenshot({ path: "test-results/mattrace-complete-preview.png", fullPage: true });
  expect(errors).toEqual([]);
});

test("local text analysis remembers the provider but keeps the key out of project snapshots", async ({ page }) => {
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
  await expect(page.getByText(/已添加 3\/20 · 已选择 3 篇/)).toBeVisible();

  await page.getByRole("button", { name: "打开模型配置" }).click();
  const dialog = page.getByRole("dialog", { name: "模型配置" });
  await dialog.getByLabel("API Key").fill("runtime-test-key");
  await dialog.getByRole("button", { name: "应用配置" }).click();
  await page.getByRole("button", { name: "开始真实分析" }).click();
  await expect(page.getByText(/真实分析完成：3 篇均有状态，共提取 3 条数据/)).toBeVisible();
  await expect(page.getByRole("cell", { name: "LLZO" }).first()).toBeVisible();

  await page.reload();
  await waitForHydration(page);
  await page.getByRole("button", { name: "打开模型配置" }).click();
  await expect(page.getByRole("dialog", { name: "模型配置" }).getByLabel("API Key")).toHaveValue("runtime-test-key");
  await page.getByRole("dialog", { name: "模型配置" }).getByRole("button", { name: "清除 Key" }).click();
  await page.reload();
  await waitForHydration(page);
  await page.getByRole("button", { name: "打开模型配置" }).click();
  await expect(page.getByRole("dialog", { name: "模型配置" }).getByLabel("API Key")).toHaveValue("");
  expect(errors).toEqual([]);
});

test("Agent Plan preset persists and analyzes through the Responses API", async ({ page }) => {
  const requests: Array<Record<string, unknown>> = [];
  await page.route("**/ark-plan/responses", async (route) => {
    const payload = route.request().postDataJSON();
    requests.push(payload);
    if (!payload.stream) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ output_text: "OK" }) });
      return;
    }
    const userText = payload.input.at(-1).content[0].text;
    const firstPage = Number(userText.match(/\[第\s*(\d+)\s*页\]/)?.[1] ?? 1);
    const output = JSON.stringify({ status: "no_evidence", checked_pages: [firstPage], summary: "Agent Plan 核查完成", reason: "当前片段没有可复核定量记录", records: [] });
    await route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream" },
      body: `data: ${JSON.stringify({ type: "response.output_text.delta", delta: output })}\n\ndata: ${JSON.stringify({ type: "response.completed" })}\n\n`,
    });
  });

  await page.goto("/");
  await waitForHydration(page);
  await page.getByRole("button", { name: "打开模型配置" }).click();
  let settings = page.getByRole("dialog", { name: "模型配置" });
  await settings.getByLabel("供应商预设").selectOption("volcengine-agent-plan");
  await expect(settings.getByLabel("接口协议")).toHaveValue("openai-responses");
  await expect(settings.getByLabel("API 网关")).toHaveValue("https://ark.cn-beijing.volces.com/api/plan/v3");
  await expect(settings.getByLabel("模型名称")).toHaveValue("doubao-seed-evolving");
  await settings.getByLabel("API Key").fill("agent-plan-runtime-key");
  await settings.getByRole("button", { name: "测试连接" }).click();
  await expect(settings.getByText("连接成功", { exact: true })).toBeVisible();
  await settings.getByRole("button", { name: "应用配置" }).click();

  await page.reload();
  await waitForHydration(page);
  await expect(page.getByRole("button", { name: "打开模型配置" })).toContainText("doubao-seed-evolving");
  await page.getByRole("button", { name: "开始真实分析" }).click();
  await expect(page.getByText(/真实分析完成：3 篇均有状态/)).toBeVisible({ timeout: 20_000 });
  expect(requests).toHaveLength(4);
  expect(requests.slice(1).every((request) => request.model === "doubao-seed-evolving" && Array.isArray(request.input))).toBe(true);

  await page.getByRole("button", { name: "打开模型配置" }).click();
  settings = page.getByRole("dialog", { name: "模型配置" });
  await expect(settings.getByLabel("供应商预设")).toHaveValue("volcengine-agent-plan");
  await expect(settings.getByLabel("API Key")).toHaveValue("agent-plan-runtime-key");
});

test("mobile layout stays within the viewport and keyboard Escape closes dialogs", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await waitForHydration(page);
  const settingsOpener = page.getByRole("button", { name: "打开模型配置" });
  await settingsOpener.click();
  await expect(page.getByRole("dialog", { name: "模型配置" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "模型配置" })).toBeHidden();
  await expect(settingsOpener).toBeFocused();
  await settingsOpener.click();
  await page.locator(".modal-dismiss").click({ position: { x: 2, y: 2 } });
  await expect(page.getByRole("dialog", { name: "模型配置" })).toBeHidden();
  await expect(settingsOpener).toBeFocused();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: "test-results/mattrace-mobile-preview.png", fullPage: true });
});

test("PDF opens a real document view while DOCX exposes extracted text", async ({ page }) => {
  await page.goto("/");
  await waitForHydration(page);
  await page.locator('input[type="file"]').setInputFiles([
    { name: "conductivity.pdf", mimeType: "application/pdf", buffer: await pdfFixture() },
    { name: "capacity.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: await docxFixture() },
  ]);
  const pdfButton = page.getByRole("button", { name: /PDF conductivity/ });
  const docxButton = page.getByRole("button", { name: /DOCX capacity/ });
  await expect(pdfButton).toBeVisible({ timeout: 15_000 });
  await expect(docxButton).toBeVisible({ timeout: 15_000 });
  await pdfButton.click();
  const pdfDialog = page.getByRole("dialog", { name: "conductivity.pdf" });
  await expect(pdfDialog.getByRole("button", { name: "PDF 原文" })).toBeVisible();
  await expect(pdfDialog.locator(".pdf-reader")).toBeVisible();
  await pdfDialog.getByRole("button", { name: "解析文本" }).click();
  await expect(pdfDialog).toContainText("LLZO ionic conductivity");
  await page.getByRole("dialog", { name: "conductivity.pdf" }).getByRole("button", { name: "关闭详情" }).click();
  await docxButton.click();
  await expect(page.getByRole("dialog", { name: "capacity.docx" })).toContainText("MXene capacity is 312 mAh/g");
  await page.getByRole("dialog", { name: "capacity.docx" }).getByRole("button", { name: "移除此文档" }).click();
  await expect(docxButton).toBeHidden();
});

test("bundled literature is presented as PDF rather than example documents", async ({ page }) => {
  await page.goto("/");
  await waitForHydration(page);
  await expect(page.locator(".file-tray")).not.toContainText("示例");
  await page.locator(".file-chip").first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "PDF 原文" })).toBeVisible();
  const reader = dialog.locator(".pdf-reader");
  await expect(reader).toBeVisible();
  await expect(reader.locator(".pdf-page-canvas")).toBeVisible({ timeout: 15_000 });
  expect(await reader.locator(".pdf-thumbnails").evaluate((element) => element.getBoundingClientRect().width)).toBeLessThanOrEqual(120);
  await expect(reader.getByText("1 / 28", { exact: true })).toBeVisible();
  await reader.getByRole("button", { name: "下一页" }).click();
  await expect(reader.getByText("2 / 28", { exact: true })).toBeVisible();
  const zoomBefore = await reader.locator(".pdf-zoom-status").textContent();
  await reader.getByRole("button", { name: "放大" }).click();
  await expect(reader.locator(".pdf-zoom-status")).not.toHaveText(zoomBefore ?? "");
});

test("bundled literature exposes complete parsed pages beyond the cover", async ({ page }) => {
  await page.goto("/");
  await waitForHydration(page);
  await page.locator(".file-chip").first().click();
  const dialog = page.getByRole("dialog", { name: "Solid Electrolytes 2021.pdf" });
  await dialog.getByRole("button", { name: "解析文本" }).click();
  await expect(dialog).toContainText("第 28 页");
  await expect(dialog).toContainText("Management of heat during charging and discharging", { timeout: 15_000 });
  await dialog.getByRole("searchbox", { name: "搜索解析文本" }).fill("phonon mean free paths");
  await expect(dialog.getByText(/找到 1 个页面/)).toBeVisible();
  await dialog.getByRole("button", { name: /跳转到第 21 页/ }).click();
  await expect(dialog.locator("#parsed-page-21")).toBeInViewport();
});

test("bundled PDFs hydrate before entering a real AI request", async ({ page }) => {
  const prompts: string[] = [];
  await page.route("**/v1/chat/completions", async (route) => {
    const payload = route.request().postDataJSON();
    prompts.push(payload.messages.map((message: { content: string }) => message.content).join("\n"));
    const firstPage = Number(payload.messages.at(-1).content.match(/\[第\s*(\d+)\s*页\]/)?.[1] ?? 1);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ choices: [{ message: { content: JSON.stringify({ status: "no_evidence", summary: "已完成真实核查", checked_pages: [firstPage], reason: "本片段未发现可复核记录", records: [] }) } }] }) });
  });
  await page.goto("/");
  await waitForHydration(page);
  await page.getByRole("button", { name: "打开模型配置" }).click();
  const settings = page.getByRole("dialog", { name: "模型配置" });
  await settings.getByLabel("API Key").fill("bundled-runtime-key");
  await settings.getByRole("button", { name: "应用配置" }).click();
  await page.getByRole("button", { name: "开始真实分析" }).click();
  await expect(page.getByText(/真实分析完成：3 篇均有状态，共提取 0 条数据/)).toBeVisible({ timeout: 20_000 });
  expect(prompts).toHaveLength(3);
  expect(prompts.join("\n")).toContain("Solid Electrolytes 2021.pdf");
  expect(prompts.join("\n")).toContain("Superionic Discovery 2022.pdf");
  expect(prompts.join("\n")).toContain("Lattice Dynamics 2024.pdf");
  expect(prompts.find((prompt) => prompt.includes("Solid Electrolytes 2021.pdf"))).toContain("1.4 W m -1 K -1");
});

test("document selection is independent from preview and scopes real analysis", async ({ page }) => {
  let prompt = "";
  await page.route("**/v1/chat/completions", async (route) => {
    prompt = route.request().postDataJSON().messages.map((message: { content: string }) => message.content).join("\n");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ choices: [{ message: { content: JSON.stringify({ summary: "单篇分析完成", records: [{ material: "LLZTO", process: "TDTR", property: "热导率", value: 1.4, unit: "W m-1 K-1", conditions: { temperature: "室温" }, sourceDocument: "Solid Electrolytes 2021.pdf", page: 2, evidence: "thermal conductivity was 1.4 W m-1 K-1", confidence: "high" }] }) } }] }) });
  });
  await page.goto("/");
  await waitForHydration(page);
  await expect(page.getByText("已添加 3/20 · 已选择 3 篇")).toBeVisible();
  const selectors = page.getByRole("checkbox", { name: /选择文档/ });
  await selectors.nth(1).uncheck();
  await selectors.nth(2).uncheck();
  await expect(page.getByText("已添加 3/20 · 已选择 1 篇")).toBeVisible();
  await page.locator(".file-chip").first().click();
  await expect(page.getByRole("dialog", { name: "Solid Electrolytes 2021.pdf" })).toBeVisible();
  await page.getByRole("button", { name: "关闭详情", exact: true }).click();
  await page.getByRole("button", { name: "打开模型配置" }).click();
  await page.getByRole("dialog", { name: "模型配置" }).getByLabel("API Key").fill("selection-key");
  await page.getByRole("dialog", { name: "模型配置" }).getByRole("button", { name: "应用配置" }).click();
  await page.getByRole("button", { name: "开始真实分析" }).click();
  await expect(page.getByText(/真实分析完成/)).toBeVisible();
  expect(prompt).toContain("Solid Electrolytes 2021.pdf");
  expect(prompt).not.toContain("Superionic Discovery 2022.pdf");
  expect(prompt).not.toContain("Lattice Dynamics 2024.pdf");
  await expect(page.getByText("LLZTO", { exact: true }).first()).toBeVisible();
  await selectors.nth(1).check();
  await expect(page.getByText("暂无结果，请载入公开论文或完成真实分析")).toBeVisible();
});

test("document title rename cascades through evidence, export, and project restore", async ({ page }) => {
  await page.goto("/");
  await waitForHydration(page);
  await page.locator(".file-chip").first().click();
  const dialog = page.getByRole("dialog", { name: "Solid Electrolytes 2021.pdf" });
  await dialog.getByRole("heading", { name: "Solid Electrolytes 2021.pdf" }).dblclick();
  const editor = page.getByRole("textbox", { name: "文档名称" });
  await editor.fill("Battery Thermal Evidence");
  await editor.press("Enter");
  await expect(page.getByRole("dialog", { name: "Battery Thermal Evidence.pdf" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".file-chip").first()).toContainText("Battery Thermal Evidence");
  await expect(page.locator(".citation")).toContainText("Battery Thermal Evidence.pdf");

  await page.getByRole("button", { name: "Markdown" }).click();
  await expect(page.getByRole("dialog", { name: "导出预览" })).toContainText("Battery Thermal Evidence.pdf");
  await page.keyboard.press("Escape");
  await page.locator(".file-chip").first().click();
  const renamedDialog = page.getByRole("dialog", { name: "Battery Thermal Evidence.pdf" });
  await renamedDialog.getByRole("heading", { name: "Battery Thermal Evidence.pdf" }).dblclick();
  const renamedEditor = page.getByRole("textbox", { name: "文档名称" });
  await renamedEditor.fill("Superionic Discovery 2022.pdf");
  await renamedEditor.press("Enter");
  await expect(page.getByText("已存在同名文档")).toBeVisible();
  await renamedEditor.fill("  ");
  await renamedEditor.press("Enter");
  await expect(page.getByText("文档名称不能为空")).toBeVisible();

  await renamedEditor.fill("Thermal Evidence Reviewed");
  await renamedEditor.press("Tab");
  const blurRenamedDialog = page.getByRole("dialog", { name: "Thermal Evidence Reviewed.pdf" });
  await expect(blurRenamedDialog).toBeVisible();
  await blurRenamedDialog.getByRole("heading", { name: "Thermal Evidence Reviewed.pdf" }).dblclick();
  const escapeEditor = page.getByRole("textbox", { name: "文档名称" });
  await escapeEditor.fill("Discard This Name");
  await escapeEditor.press("Escape");
  await expect(page.getByRole("dialog", { name: "Thermal Evidence Reviewed.pdf" })).toBeVisible();
});

test("drag and drop accepts text while invalid files show an actionable error", async ({ page }) => {
  await page.goto("/");
  await waitForHydration(page);
  await page.locator('input[type="file"]').setInputFiles({ name: "image.png", mimeType: "image/png", buffer: Buffer.from("not an image") });
  await expect(page.getByText("image.png：不支持 .png 文件")).toBeVisible();
  await page.locator(".drop-zone").evaluate((element) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(["Dragged LLZO evidence"], "dragged.txt", { type: "text/plain" }));
    element.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
  });
  await expect(page.getByRole("button", { name: /TXT dragged/ })).toBeVisible();
});

test("settings, issue drawers, and all exports work without project lifecycle controls", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.route("**/v1/models", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"data":[{"id":"qwen3.8-max"}]}' }));
  await page.goto("/");
  await waitForHydration(page);

  await page.getByRole("button", { name: "打开模型配置" }).click();
  const settings = page.getByRole("dialog", { name: "模型配置" });
  await settings.getByLabel("API Key").fill("connection-only-key");
  await settings.getByRole("button", { name: "测试连接" }).click();
  await expect(page.getByText("模型服务连接成功，Key 未被保存")).toBeVisible();
  await settings.getByRole("button", { name: "清除 Key" }).click();
  await settings.getByRole("button", { name: "关闭模型配置" }).click();

  const missingOpener = page.getByRole("button", { name: /缺失条件提醒/ });
  await missingOpener.click();
  await expect(page.getByRole("dialog", { name: "缺失条件" })).toContainText("样品相对密度未说明");
  await page.keyboard.press("Escape");
  await expect(missingOpener).toBeFocused();
  await page.getByRole("button", { name: /冲突检测提醒/ }).click();
  await expect(page.getByRole("dialog", { name: "冲突检测" })).toContainText("没有发现跨文献数值冲突");
  await page.keyboard.press("Escape");

  for (const name of ["JSON", "CSV", "Markdown"]) {
    await page.getByRole("button", { name: new RegExp(`${name}$`) }).first().click();
    await expect(page.getByRole("dialog", { name: "导出预览" })).toBeVisible();
    await page.getByRole("button", { name: "复制内容" }).click();
    await expect(page.getByText("报告内容已复制").last()).toBeVisible();
    await page.keyboard.press("Escape");
  }

  await expect(page.locator(".session-card")).toHaveCount(0);
});

test("real analysis can be cancelled and malformed model output remains recoverable", async ({ page }) => {
  let responseMode: "slow" | "malformed" = "slow";
  await page.route("**/v1/chat/completions", async (route) => {
    if (responseMode === "slow") {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ choices: [{ message: { content: responseMode === "malformed" ? "not-json" : "{}" } }] }),
    });
  });
  await page.goto("/");
  await waitForHydration(page);
  await page.locator('input[type="file"]').setInputFiles([
    { name: "a.txt", mimeType: "text/plain", buffer: Buffer.from("A evidence") },
    { name: "b.txt", mimeType: "text/plain", buffer: Buffer.from("B evidence") },
    { name: "c.txt", mimeType: "text/plain", buffer: Buffer.from("C evidence") },
  ]);
  await page.getByRole("button", { name: "打开模型配置" }).click();
  await page.getByRole("dialog", { name: "模型配置" }).getByLabel("API Key").fill("ephemeral-key");
  await page.getByRole("dialog", { name: "模型配置" }).getByRole("button", { name: "应用配置" }).click();
  await page.getByRole("button", { name: "开始真实分析" }).click();
  await page.getByRole("button", { name: "取消分析" }).click();
  await expect(page.getByText("分析已取消，可调整后重试")).toBeVisible();

  responseMode = "malformed";
  await page.getByRole("button", { name: "开始真实分析" }).click();
  await expect(page.getByText(/模型返回格式无效/).last()).toBeVisible();
  await expect(page.getByRole("button", { name: "开始真实分析" })).toBeEnabled();
});

test("every sidebar destination performs its intended navigation action", async ({ page }) => {
  await page.goto("/");
  await waitForHydration(page);
  const navigationRegion = page.locator(".nav-list");
  const destinations = [
    ["文献管理", "文档管理"],
    ["证据链", "证据链详情"],
    ["冲突检测", "冲突检测"],
    ["报告导出", "导出预览"],
  ] as const;
  for (const [navigation, dialog] of destinations) {
    const button = navigationRegion.getByRole("button", { name: new RegExp(`^${navigation}`) });
    await button.click();
    await expect(button).toHaveClass(/active/);
    await expect(page.getByRole("dialog", { name: dialog })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(button).toBeFocused();
  }
  const extraction = navigationRegion.getByRole("button", { name: /^数据提取/ });
  await extraction.click();
  await expect(extraction).toHaveClass(/active/);
  await expect(page.getByRole("heading", { name: "分析结果与证据" })).toBeVisible();
  const home = navigationRegion.getByRole("button", { name: /^首页/ });
  await home.click();
  await expect(home).toHaveClass(/active/);
  const settings = navigationRegion.getByRole("button", { name: /^设置/ });
  await settings.click();
  await expect(settings).toHaveClass(/active/);
  await expect(page.getByRole("dialog", { name: "模型配置" })).toBeVisible();
});

test("body typography is readable without breaking the mobile viewport", async ({ page }) => {
  await page.goto("/");
  await waitForHydration(page);
  const fontSize = (selector: string) => page.locator(selector).first().evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  const tokens = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    return ["--text-display", "--text-drawer", "--text-section", "--text-card", "--text-body", "--text-support", "--text-meta"].map((name) => styles.getPropertyValue(name).trim());
  });
  expect(tokens).toEqual(["32px", "28px", "18px", "15px", "13px", "12px", "11px"]);
  expect(await fontSize(".section-heading h2")).toBe(18);
  expect(await fontSize(".section-heading p")).toBeGreaterThanOrEqual(13);
  expect(await fontSize("tbody td")).toBeGreaterThanOrEqual(13);
  expect(await fontSize(".evidence-card blockquote")).toBeGreaterThanOrEqual(13);
  expect(await fontSize(".mode-banner p")).toBeGreaterThanOrEqual(11);
  expect(await fontSize(".file-chip i")).toBeGreaterThanOrEqual(11);

  await page.getByRole("button", { name: /^Skill 管理/ }).click();
  expect(await fontSize(".details-drawer h2")).toBe(28);
  expect(await fontSize(".skill-overview strong")).toBe(15);
  await page.keyboard.press("Escape");

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("mascot and sidebar motion create lively hover feedback", async ({ page }) => {
  await page.goto("/");
  await waitForHydration(page);
  const mascot = page.locator(".mascot-zone img");
  const mascotAnimation = await mascot.evaluate((element) => getComputedStyle(element).animationName);
  expect(mascotAnimation).not.toBe("none");
  const mascotFilterBefore = await mascot.evaluate((element) => getComputedStyle(element).filter);
  await page.locator(".mascot-zone").hover();
  const mascotFilterAfter = await mascot.evaluate((element) => getComputedStyle(element).filter);
  expect(mascotFilterAfter).not.toBe(mascotFilterBefore);

  const nav = page.locator(".nav-item").nth(1);
  const navBefore = await nav.evaluate((element) => ({ transform: getComputedStyle(element).transform, shadow: getComputedStyle(element).boxShadow }));
  await nav.hover();
  const navAfter = await nav.evaluate((element) => ({ transform: getComputedStyle(element).transform, shadow: getComputedStyle(element).boxShadow }));
  expect(navAfter.transform).not.toBe(navBefore.transform);
  expect(navAfter.shadow).not.toBe(navBefore.shadow);
});

test("workspace cards and data rows provide presentation-ready motion", async ({ page }) => {
  await page.goto("/");
  await waitForHydration(page);

  const uploadAnimation = await page.locator(".upload-art").evaluate((element) => getComputedStyle(element).animationName);
  expect(uploadAnimation).not.toBe("none");

  for (const selector of [".summary-card", ".alert-card"]) {
    const target = page.locator(selector).first();
    const before = await target.evaluate((element) => ({ transform: getComputedStyle(element).transform, shadow: getComputedStyle(element).boxShadow }));
    await target.hover();
    await page.waitForTimeout(300);
    const after = await target.evaluate((element) => ({ transform: getComputedStyle(element).transform, shadow: getComputedStyle(element).boxShadow }));
    expect(after.transform).not.toBe(before.transform);
    expect(after.shadow).not.toBe(before.shadow);
  }

  const row = page.locator("tbody tr").nth(1);
  const rowBefore = await row.evaluate((element) => getComputedStyle(element).transform);
  await row.hover();
  await page.waitForTimeout(220);
  expect(await row.evaluate((element) => getComputedStyle(element).transform)).not.toBe(rowBefore);
});

test("reduced motion disables decorative animations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await waitForHydration(page);

  for (const selector of [".mascot-zone img", ".mascot-zone::before", ".upload-art", ".nav-item.active::after", ".skill-pill span"]) {
    const [base, pseudo] = selector.split("::");
    const animationName = await page.locator(base).first().evaluate((element, pseudoElement) => getComputedStyle(element, pseudoElement ? `::${pseudoElement}` : null).animationName, pseudo ?? null);
    expect(animationName).toBe("none");
  }
});

test("Skill manager edits, persists, restores, and exports the competition Skill", async ({ page }) => {
  await page.goto("/");
  await waitForHydration(page);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await waitForHydration(page);

  const navigation = page.locator(".nav-list");
  const skillNavigation = navigation.getByRole("button", { name: /^Skill 管理/ });
  await expect(skillNavigation).toHaveCount(1);
  await expect(navigation.locator(".nav-item").nth(1)).toHaveText(/Skill 管理/);
  await skillNavigation.click();
  await expect(page.getByRole("dialog", { name: "Skill 管理" })).toBeVisible();
  await expect(page.getByText("material-evidence-extractor").last()).toBeVisible();
  await page.getByRole("button", { name: "完整文件" }).click();
  await expect(page.getByRole("button", { name: /examples\/records.jsonl/ })).toBeVisible();
  await page.getByRole("button", { name: /examples\/records.jsonl/ }).click();
  await expect(page.getByText(/rec-llzto-001/)).toBeVisible();
  await page.getByRole("button", { name: /scripts\/normalize-record.mjs/ }).click();
  await expect(page.getByText(/normalizeRecord/)).toBeVisible();
  await page.getByRole("button", { name: /^SKILL.md/ }).click();

  await page.getByRole("button", { name: "编辑当前文件" }).click();
  const editor = page.getByRole("textbox", { name: "Skill Markdown 编辑器" });
  await editor.fill(`${await editor.inputValue()}\n\n## 团队规则\n进入人工复核。`);
  await page.getByRole("button", { name: "保存当前文件" }).click();
  await page.reload();
  await waitForHydration(page);
  await navigation.getByRole("button", { name: /^Skill 管理/ }).click();
  await page.getByRole("button", { name: "完整文件" }).click();
  await page.getByRole("button", { name: /^SKILL.md/ }).click();
  await page.getByRole("button", { name: "编辑当前文件" }).click();
  await expect(page.getByRole("textbox", { name: "Skill Markdown 编辑器" })).toHaveValue(/团队规则/);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 SKILL.md" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("SKILL.md");
  const zipPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出完整 Skill ZIP" }).click();
  expect((await zipPromise).suggestedFilename()).toBe("material-evidence-extractor.zip");
  await page.getByRole("button", { name: "恢复默认" }).click();
  await expect(page.getByText(/团队规则/)).toBeHidden();
});
