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
  await page.screenshot({ path: "test-results/mattrace-complete-preview.png", fullPage: true });
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

test("PDF and DOCX parsers expose extracted text in document previews", async ({ page }) => {
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
  await expect(page.getByRole("dialog", { name: "conductivity.pdf" })).toContainText("LLZO ionic conductivity");
  await page.getByRole("dialog", { name: "conductivity.pdf" }).getByRole("button", { name: "关闭详情" }).click();
  await docxButton.click();
  await expect(page.getByRole("dialog", { name: "capacity.docx" })).toContainText("MXene capacity is 312 mAh/g");
  await page.getByRole("dialog", { name: "capacity.docx" }).getByRole("button", { name: "移除此文档" }).click();
  await expect(docxButton).toBeHidden();
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

test("settings, issue drawers, all exports, and project lifecycle controls work", async ({ page, context }) => {
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
  await expect(page.getByRole("dialog", { name: "冲突检测" })).toContainText("差异 42%");
  await page.keyboard.press("Escape");

  for (const name of ["JSON", "CSV", "Markdown"]) {
    await page.getByRole("button", { name: new RegExp(`${name}$`) }).first().click();
    await expect(page.getByRole("dialog", { name: "导出预览" })).toBeVisible();
    await page.getByRole("button", { name: "复制内容" }).click();
    await expect(page.getByText("报告内容已复制").last()).toBeVisible();
    await page.keyboard.press("Escape");
  }

  await page.getByRole("button", { name: "保存当前项目" }).click();
  await expect(page.getByText("当前项目已安全保存，不包含 API Key")).toBeVisible();
  await page.getByRole("button", { name: "清空" }).click();
  await expect(page.getByText("已添加 0/10")).toBeVisible();
  await page.getByRole("button", { name: "恢复项目" }).click();
  await expect(page.getByText("项目已恢复，API Key 仍为空")).toBeVisible();
  await expect(page.getByText("已添加 3/10")).toBeVisible();
  await page.getByRole("button", { name: "删除存档" }).click();
  await expect(page.getByText("已保存项目已删除")).toBeVisible();
  await page.getByRole("button", { name: "恢复项目" }).click();
  await expect(page.getByText("没有找到已保存的项目")).toBeVisible();
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
  expect(await fontSize(".section-heading p")).toBeGreaterThanOrEqual(13);
  expect(await fontSize("tbody td")).toBeGreaterThanOrEqual(12);
  expect(await fontSize(".evidence-card blockquote")).toBeGreaterThanOrEqual(13);
  expect(await fontSize(".mode-banner p")).toBeGreaterThanOrEqual(11);
  expect(await fontSize(".session-card p")).toBeGreaterThanOrEqual(11);

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

  await page.getByRole("button", { name: "编辑 Skill" }).click();
  const editor = page.getByRole("textbox", { name: "Skill Markdown 编辑器" });
  await editor.fill(`${await editor.inputValue()}\n\n## 团队规则\n进入人工复核。`);
  await page.getByRole("button", { name: "保存到浏览器" }).click();
  await page.reload();
  await waitForHydration(page);
  await navigation.getByRole("button", { name: /^Skill 管理/ }).click();
  await page.getByRole("button", { name: "编辑 Skill" }).click();
  await expect(page.getByRole("textbox", { name: "Skill Markdown 编辑器" })).toHaveValue(/团队规则/);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 SKILL.md" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("SKILL.md");
  await page.getByRole("button", { name: "恢复默认" }).click();
  await expect(page.getByRole("textbox", { name: "Skill Markdown 编辑器" })).not.toHaveValue(/团队规则/);
});
