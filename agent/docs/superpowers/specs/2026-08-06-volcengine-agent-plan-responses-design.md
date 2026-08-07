# MatTrace 火山方舟 Agent Plan Responses API 支持设计

## 目标

在保留现有 ChipCloud OpenAI Chat Completions 配置的同时，新增火山方舟 Agent Plan 供应商预设，通过 OpenAI-compatible Responses API 调用 `doubao-seed-evolving`。用户凭证仅保存在当前浏览器，不进入仓库、日志、导出、Skill 或项目快照。

## 已选方案

采用 OpenAI Responses API，不采用 Anthropic Messages，也不假设 Agent Plan 提供 Chat Completions。

- 供应商：火山方舟 Agent Plan
- 协议标识：`openai-responses`
- 可见网关：`https://ark.cn-beijing.volces.com/api/plan/v3`
- 请求端点：`https://ark.cn-beijing.volces.com/api/plan/v3/responses`
- 模型：`doubao-seed-evolving`
- 鉴权：`Authorization: Bearer <browser credential>`

## 模型配置界面

增加供应商预设选择，至少包含：

1. ChipCloud / OpenAI Chat Completions，保持现有网关和模型。
2. 火山方舟 Agent Plan / OpenAI Responses，自动填写官方网关、协议和 `doubao-seed-evolving`。
3. 自定义 OpenAI Chat Completions，保留手工修改网关与模型的能力。

配置对象新增 `protocol`。旧 localStorage 数据没有该字段时迁移为 `openai-chat`。切换预设不把任何 Key 写入源代码；用户输入的 Key 随当前活动配置保存在浏览器 localStorage。

## 客户端协议适配

把供应商差异封装在 AI 客户端边界：

- `openai-chat` 继续请求 `/chat/completions`，保持现有行为。
- `openai-responses` 请求 `/responses`。
- Responses 请求把 Skill 的 system/user 文本转换为 `input` 消息，使用低温度和足够的输出 token 上限。
- 连接测试对 Responses 端点发送最小 `Reply OK` 请求，不依赖 `/models`。
- 普通响应优先读取 `output_text`，并兼容 `output[].content[].text`。
- SSE 读取 `response.output_text.delta`，完成事件后合并文本。
- 模型输出仍进入现有 JSON、页码、证据原文、条件完整性和可信度确定性校验，协议不能绕过科学边界。

## 本地代理

本地代理使用固定上游白名单，不接受用户提供的任意转发目标：

- ChipCloud 路由仅转发到 `https://ai.chipcloud.cc`。
- Agent Plan 路由仅转发到 `https://ark.cn-beijing.volces.com/api/plan/v3`。
- 只允许 MatTrace 本地来源和已声明端点。
- 不记录 Authorization、文档正文或响应正文。

GitHub Pages 静态版本没有本地代理，直接请求用户配置的网关；若供应商不允许浏览器 CORS，README 明确说明需要部署同等的安全代理。

## 错误处理

- 未填写 Key：在发送请求前阻止。
- Responses 返回非 2xx：显示已脱敏的上游错误。
- 响应没有文本：显示“模型响应缺少输出文本”。
- SSE 事件无效或中断：保留文档并进入现有失败/重试流程。
- 切换供应商：旧分析结果失效，避免把旧模型结果展示成新供应商结果。
- 所有错误文本必须移除当前 Key。

## 测试与验收

1. 默认配置和旧 localStorage 向 `openai-chat` 迁移。
2. 火山方舟预设准确填入协议、网关和模型。
3. Responses 连接测试请求 `/responses`。
4. Responses 普通 JSON 和 SSE 文本均可解析。
5. 真实文档分析继续通过页码、证据句、可信度和审计校验。
6. 本地代理只接受两个固定上游及允许端点。
7. 浏览器完成供应商切换、Key 保存、重载恢复、连接测试和真实三文档分析。
8. 原有 Chat Completions 回归不受影响。
9. 单元测试、动态 E2E、静态 E2E、lint 和 build 全部通过。
10. 仓库密钥扫描为零。

## 非目标

- 不把用户提供的 Key 设为项目默认值。
- 不实现 Anthropic Messages 协议。
- 不在仓库预置真实模型响应或虚构 uplift 分数。
- 不改变正式比赛 Skill 的 3–10 篇输入合同。

