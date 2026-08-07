![MatTrace 封面](封面.png)

> 学长跟我说：「AI 写的，别挂我名。」
>
> 那我就做一个让 AI 提取的每一条材料数据，**都能被追溯、被质疑、敢挂名**的工具。

# MatTrace —— 材料科研的文献证据抽取 Skill

MatTrace 的核心是一个可复用的材料证据抽取 Skill（[`skills/material-evidence-extractor/`](skills/material-evidence-extractor/)），它把论文、专利、技术数据表（TDS）转换为带**原文证据、页码定位、测试条件与可信度**的结构化数据，并自动完成单位规范化、缺失条件检测和跨文献数值冲突核验——让 AI 读完的每一篇文献，都有据可查。

- **Skill 本体**：[`skills/material-evidence-extractor/`](skills/material-evidence-extractor/)（opencode 标准格式，被评审主体）
- **配套网页 Agent**：[`agent/`](agent/)（可视化演示，可独立运行）
- **演示视频（B 站）**：<https://www.bilibili.com/video/BV1qPuK6TEMp/>
- **在线演示**：<https://lucianaib2004.github.io/mattrace/>

## 背景

AI 读文献很快，但科研里真正要命的是这三个问题：

1. AI 提取出的数值，你敢直接写进论文吗？
2. 它说「这个材料电导率是 1.2 mS/cm」——你知道出自**哪一页**吗？
3. 两篇文献数据差了 50%，你确定它们的**测试条件一样、真的能比**吗？

大多数 AI 文献工具三个问题都答不上来。MatTrace 把「让 AI 输出可信」拆成两层：先想清楚**该信什么**，再用确定性脚本**把这件事做出来**。演示中所有数据均来自三篇真实 arXiv 论文，没有一条是编造的。

## 方法

### 一、证据优先，而非模型自信

核心原则是**不信任模型的自报置信度，只信任可复查的证据**。一条材料数据要被采纳，必须同时回答五个问题：什么材料、如何制备、测了什么性能、在什么条件下测的、原文在哪里。缺失的内容就标记为缺失，绝不用常识或模型推断补全。

由此推导出三条确定性规则（全部由代码计算，不交给模型主观判断）：

- **证据绑定**：数值、单位必须能在原文证据句（或同页表头）中定位，且必须带来源文档与页码。
- **可比性门槛**：先按材料、性能、单位、温度、方法、方向等关键条件分组，**条件不兼容的记录绝不放在一起比较**；证据质量再高也不能单独授权「可比较」。
- **冲突检测**：仅对条件兼容的记录，按相对差异 > 30%（分母为两值绝对值中较小者）标记冲突，发现冲突后保留两个值并上报，绝不静默覆盖。

可信度分为**高 / 中 / 低**三档，每一档都给出具体扣分原因（数值未定位、单位在表头、缺哪项测试条件等）。

### 二、覆盖与可比性审计

不是只输出「找到了什么」，还必须说明每篇文档「检查了什么、是否找到、为什么没有或为什么失败」。每篇文档独立处理，状态只能是 `extracted`、`no_evidence`、`failed`、`cancelled`，不得静默遗漏。每条记录生成「可比性护照」，按证据定位 35 分、字段完整性 25 分、测试条件 20 分、单位可比性 20 分给出确定性评分与扣分原因。

## Skill 使用方法

正式、可复用的能力封装在 [`skills/material-evidence-extractor/`](skills/material-evidence-extractor/) 中，遵循 opencode / Agent Skill 标准格式，不依赖任何供应商专有工具调用，任何遵守同一输入/输出 Schema 的模型都能使用。

### 目录结构

```
skills/material-evidence-extractor/
├── SKILL.md                       # 能力说明、工作流与置信度合同
├── agents/openai.yaml             # Agent 接口声明
├── references/                    # 机器可读 Schema 与规则
│   ├── input-schema.json
│   ├── output-schema.json
│   ├── unit-normalization.md      # 确定性单位换算表
│   ├── coverage-and-comparability.md  # 四维评分规则
│   ├── failure-cases.md
│   ├── evaluation-protocol.md
│   └── output-example.md
├── examples/                      # 真实论文的样例输入/输出与七类交付物
└── scripts/                       # 纯 Node 标准库，无第三方依赖
    ├── extract-evidence.mjs       # 证据候选抽取
    ├── normalize-record.mjs       # 单位规范化
    ├── build-deliverables.mjs     # 生成七类交付物
    ├── score-uplift.mjs           # 客观评分 / uplift 计算
    └── verify-skill.mjs           # 最小复现自检
```

### 使用步骤

1. **准备输入**：按 [`references/input-schema.json`](skills/material-evidence-extractor/references/input-schema.json) 组织文档，每篇含 `document_id`、名称、类型、页数和分页文本。可参考 [`examples/sample-input.json`](skills/material-evidence-extractor/examples/sample-input.json)（三篇真实论文全文）。
2. **让模型执行 Skill**：读取 `SKILL.md`，把 `references/` 下的输出字段规范、单位换算表、评分规则和失败案例作为上下文，要求模型**只返回 JSON**。
3. **确定性后处理**：用 `scripts/normalize-record.mjs` 对模型输出做机械换算与字段校验，再用 `scripts/build-deliverables.mjs` 生成交付物。
4. **生成七类交付物**：`records.jsonl`、`comparison.csv`、`evidence-report.md`、`missing-and-conflicts.md`、`review-queue.csv`、`coverage-matrix.csv`、`comparability-passports.jsonl`。
5. **评分（可选）**：用金标准对单次输出打分：

   ```bash
   node skills/material-evidence-extractor/scripts/score-uplift.mjs \
     --gold examples/sample-gold.jsonl \
     --pred examples/sample-output.json
   ```

### 最小复现自检

```bash
node skills/material-evidence-extractor/scripts/verify-skill.mjs
```

它校验 Schema、样例文档数量、七类交付物，并验证样例输出对金标准的自评分为 1.0：

```json
{"ok":true,"schema_validated":true,"example_records":1,"document_outcomes":4,"deliverables":7,"sample_records":5,"sample_self_score":1}
```

## 配套网页 Agent

需要可视化演示、在浏览器里直接上传 PDF 跑通整条流水线时，使用 [`agent/`](agent/) 子项目，详见 [agent/README.md](agent/README.md)。它在浏览器本地解析 PDF/DOCX，支持多种模型预设，API Key 仅存本地，并把六阶段进度、证据链、缺失条件、冲突和导出报告完整呈现。

## 致谢

感谢三篇真实 arXiv 论文的作者提供公开数据，作为本项目演示与评测的事实基础；也感谢每一位愿意让 AI 输出「有据可查」的研究者。

Let's trace every data.

## 开源协议

本项目采用 [MIT License](LICENSE)。允许使用、修改、分发和再许可，但需保留版权与许可声明。
