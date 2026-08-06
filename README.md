# MatTrace

MatTrace 是一个面向材料科研的文献数据提取与核验 Agent。它把论文、专利或实验文档转换成带原文证据、页码定位、测试条件和可信度的结构化数据，并自动提醒条件缺失和跨文献数值冲突。

![MatTrace 完整工作台](docs/mattrace-complete-preview.png)

## 已实现功能

- 浏览器本地解析 PDF、DOCX、TXT、Markdown
- 文件选择与拖拽上传、格式/大小/重复/数量校验、预览、移除和清空
- 无需 API Key 的完整示例运行
- 通过 OpenAI-compatible `chat/completions` 接口执行真实分析
- 默认网关 `https://ai.chipcloud.cc`，默认模型 `qwen3.8-max`
- 六阶段 Agent 进度、取消、错误提示与保留文档重试
- 单位规范化、缺失条件关联和差异超过 30% 的冲突检测
- 数据表、证据原文、来源文档和页码联动查看
- JSON、带 UTF-8 BOM 的 CSV、完整 Markdown 报告预览/复制/下载
- IndexedDB 项目保存、恢复和删除
- 响应式桌面/移动界面与键盘 Escape 关闭
- 可独立使用的 `material-evidence-extractor` Skill
- GitHub Pages 静态导出和自动部署工作流

## 比赛交付定位

正式参赛交付物是 [`skills/material-evidence-extractor/`](skills/material-evidence-extractor/) 中完整、可复用的 Skill 文件夹。MatTrace Agent 是依据同一 Skill 合同构建的评委演示与复查界面，不用网页替代 Skill 本身。

比赛严格模式接收 3–10 篇论文、专利或 TDS。Agent 工作区为调试和演示允许选择 1–20 篇；不在 3–10 篇范围内的运行不作为比赛标准结果。Skill 额外提供机器可读输入/输出 Schema、失败案例合同、七类交付物构建脚本和 uplift 客观评分器。

## 隐私模型

用户应用模型配置后，API Key 保存在当前浏览器的 `localStorage`，因此同一浏览器刷新后无需重复输入。它不会写入：

- Git 仓库或构建产物
- 项目快照或 IndexedDB
- URL、日志、导出报告或项目快照

原始文件在浏览器本地解析。只有点击“开始真实分析”后，文档名、页码和解析后的文本才会发送到用户配置的 API 网关。清除 Key 会删除该浏览器中的凭证；请勿在共享或不可信设备上启用。Key 不进入 Skill、导出报告、GitHub 或项目快照。

## 支持的文档

| 类型 | 解析方式 | 当前限制 |
| --- | --- | --- |
| PDF | PDF.js 逐页提取文本 | 扫描件不含文本层时会提示失败，暂不包含 OCR |
| DOCX | Mammoth 提取正文 | 不保留复杂排版 |
| TXT | 浏览器 UTF-8 解码 | 空文件会被拒绝 |
| Markdown | 浏览器 UTF-8 解码 | 作为纯文本证据发送 |

比赛严格批次要求 3–10 篇；Agent 演示工作区允许 1–20 篇。每个文件不超过 50 MB。

## 评审模型兼容

- 首选模型：Qwen3.8-Max（项目默认标识 `qwen3.8-max`）。
- 多模态备用：Qwen3-vl-Plus，适用于表格图片、图注或扫描页面已经过 OCR/视觉转写的输入。
- 纯文本备用：GLM 5.2，必须遵守同一 JSON Schema，不降低证据和页码要求。
- 图像生成备用：Wan2.7-Image-Pro 不参与科学数据抽取，只能制作演示视觉，生成内容不得作为材料证据。

Skill 不依赖某个供应商专有工具调用；各模型均以相同输入/输出 Schema 和确定性后处理接受验证。模型返回截断、无效 JSON 或缺少文档状态时，该文档进入失败/重试流程，不能静默省略。

## 本地运行

要求 Node.js `>=22.13.0`。

```bash
npm install
npm run dev
```

若所用 OpenAI-compatible 网关的 POST 响应没有浏览器 CORS 头，可在另一个终端运行仅限 localhost 的固定上游代理：

```bash
npm run proxy:ai
```

页面保持填写真实网关 `https://ai.chipcloud.cc`；在 localhost 上，MatTrace 会自动把该网关请求路由到 `http://127.0.0.1:8788`。代理不记录 API Key 与文献正文，仅用于本机演示；GitHub Pages 仍要求所选网关原生支持浏览器 CORS。

打开 `http://localhost:3000`。无需 Key 可直接点击“使用示例运行”；真实分析需在“模型配置”中临时输入自己的 Key。

## 构建与验证

```bash
npm test
npm run lint
npm run test:e2e
npm run test:e2e:static
```

- `npm test`：生产构建以及领域、API、解析、导出、存储和 SSR 测试
- `npm run test:e2e`：开发服务完整浏览器交互验收
- `npm run test:e2e:static`：生成静态 HTML，并在纯静态服务器上重新执行完整浏览器验收

Skill 的 uplift 评测协议位于 [`references/evaluation-protocol.md`](skills/material-evidence-extractor/references/evaluation-protocol.md)。裸模型和挂 Skill 模型使用同一材料集各运行三次，客观字段评分分别取中位数，再计算 `uplift = Skill 中位数 - baseline 中位数`。仓库不预填或虚构实测 uplift；发布分数必须保留三次原始输出、模型参数和输入文档哈希。

仅验证独立 Skill 文件夹及最小复现实验：

```bash
node skills/material-evidence-extractor/scripts/verify-skill.mjs
```

单独生成 GitHub Pages 产物：

```bash
npm run build:static
```

输出目录为 `dist/client/`，其中包含 `index.html` 和 `.nojekyll`。

## GitHub Pages 发布

仓库包含 `.github/workflows/pages.yml`。推送到 `main` 后，在 GitHub 仓库的 **Settings → Pages → Build and deployment** 中选择 **GitHub Actions**，工作流会构建并发布 `dist/client/`。

静态资源使用相对路径，因此同时兼容用户主页和 `/repository-name/` 项目子路径。API 网关仍需允许浏览器跨域请求；当前默认网关的预检响应已验证允许浏览器 POST 与 Authorization 请求头。

## 目录

- `app/domain/`：分析结果、冲突、导出、工作流和安全快照
- `app/services/`：文档解析、AI API 和 IndexedDB
- `app/components/`：设置、详情抽屉和通知组件
- `skills/material-evidence-extractor/`：比赛 Skill 与输出协议
- `scripts/static-export.mjs`：GitHub Pages 静态导出
- `tests/`：单元、集成、SSR 和浏览器测试
- `docs/superpowers/`：设计规格与实施计划

## 安全提醒

不要把真实 API Key 提交到 Git。若 Key 曾出现在聊天、截图或公开日志中，应立即在服务提供方撤销并重新生成。

## 开源协议

本项目采用 [MIT License](LICENSE)。允许使用、修改、分发和再许可，但需保留版权与许可声明。
