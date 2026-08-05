# MatTrace

MatTrace 是一个面向材料科研的文献数据提取与核验 Agent。用户上传论文、专利或实验文档后，Agent 会演示文献解析、结构化提取、单位规范化、条件核验、冲突检测和报告生成的完整流程，并保留可回溯的证据来源。

## 当前原型

- 材料文献上传与 Demo 工作流
- 证据链预览、缺失条件提醒与跨文献冲突提示
- JSON、CSV、Markdown 三种导出格式
- 可配置 OpenAI-compatible API 网关、模型和用户自己的 API Key
- 内置 `material-evidence-extractor` Skill 规范

API Key 只保存在当前页面内存中，不写入仓库、浏览器存储或服务端日志。

## 本地运行

要求 Node.js 22.13 或更高版本。

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

## 验证

```bash
npm test
```

该命令会先执行生产构建，再运行核心逻辑、页面结构和 Skill 结构测试。

## 主要目录

- `app/`：页面、交互与演示数据
- `skills/material-evidence-extractor/`：材料证据提取 Skill
- `tests/`：自动化验收测试
- `docs/superpowers/`：产品设计与实现计划

## 安全说明

请勿把真实 API Key 提交到 Git。首次演示时在“模型配置”弹窗中临时输入；页面刷新后会自动清除。
