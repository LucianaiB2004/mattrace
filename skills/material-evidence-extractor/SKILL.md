---
name: material-evidence-extractor
description: Use when extracting and auditing structured material evidence from 3-10 papers, patents, or technical data sheets, especially when every document needs an explicit coverage outcome, page-level provenance, uncertainty reasons, missing-condition detection, or condition-aware cross-source comparison.
---

# Material Evidence Extractor

## 任务描述

比赛严格模式输入 3-10 篇论文、专利或技术数据表（TDS），抽取材料组成、实验条件、性能指标、单位、测试条件、来源页码、缺失字段和可信度。输出 JSON/CSV 数据表、证据链、缺失条件报告、可信度评分和可复查引用。配套 MatTrace Agent 为交互演示允许 1-20 篇，但少于 3 篇或多于 10 篇时必须标记为“非比赛严格模式”。

## 独特能力：Evidence Coverage & Comparability Auditor

不是只输出“找到了什么”，还必须说明每篇文档“检查了什么、是否找到、为什么没有或为什么失败”。每篇文档独立处理，状态只能是 `extracted`、`no_evidence`、`failed` 或 `cancelled`，不得静默遗漏。为每条记录生成可比性护照，按证据定位 35 分、字段完整性 25 分、测试条件 20 分、单位可比性 20 分给出确定性评分及扣分原因。

## 核心原则

把每个性能值作为一条独立证据记录。记录必须同时回答：什么材料、如何制备、测了什么、在什么条件下测量、原文在哪里。缺失内容标记为缺失，不用常识补写。

处理前读取 [输出字段规范](references/output-schema.md) 和机器可校验的 [输入 Schema](references/input-schema.json)、[输出 Schema](references/output-schema.json)。执行覆盖与可比性审计时读取 [评分规则](references/coverage-and-comparability.md)；遇到异常、摘要、表格或不可换算单位时读取 [失败案例](references/failure-cases.md)。评测 Skill 时读取 [Uplift 协议](references/evaluation-protocol.md) 并使用 `scripts/score-uplift.mjs`。

## 工作流

1. **登记文档**：为每份输入分配稳定 `document_id`，记录标题、类型和页数。保留原始页码，不按抽取文本重新编号。
2. **识别材料实体**：分别保存原始名称、规范化名称、化学式、掺杂量、样品形态和别名。不能确定两种名称是否同一材料时保持分离。
3. **拆分证据记录**：每个材料、工艺、性能值和测试条件组合生成一条记录。表格中的每一行独立处理，不把脚注应用到无关行。
4. **绑定证据链**：记录文档、页码、章节及表/图编号，并摘录能支持数值与条件的最短证据片段。只有实际送入分析并完成处理的页面才能进入 `checked_pages`。摘要证据标记 `source_kind: abstract`，在正文或表图复核前不得作为精确最终值。找不到定位时设置 `review_required: true`。
5. **规范化单位**：同时保留原值与原单位。只有量纲明确时才生成规范化值；记录换算公式。范围、上限、下限和近似值不得改成精确单值。
6. **核验条件与缺失条件**：检查温度、压力、频率、应变速率、样品方向、样品密度、测试方法等与当前性能相关的条件。将未报告字段写入 `missing_conditions`。
7. **检测冲突与可比性**：先按材料组成、性能、单位、样品形态、测试方法、温度、方向和该性能的关键条件分组。仅将条件完全兼容的记录放入同一 `comparability_group`。未给阈值时使用 30% 相对差异；差异分母为两者绝对值中较小者。证据质量总分不能单独授权“可比较”。
8. **覆盖与可比性审计**：逐篇输出检查页、记录数、明确状态和原因；逐条输出四维评分、可比较结论和扣分原因。
9. **生成交付物**：输出 `records.jsonl`、`comparison.csv`、`evidence-report.md`、`missing-and-conflicts.md`、`review-queue.csv`、`coverage-matrix.csv` 和 `comparability-passports.jsonl`。

## 置信度合同

分别评估以下维度，再给出综合等级：

| 维度 | 高 | 中 | 低 |
|---|---|---|---|
| 来源定位 | 页码及表/图明确 | 仅页码或章节明确 | 无法稳定定位 |
| 数值证据 | 数值、单位、属性同处 | 需结合脚注或相邻文本 | 依赖推断 |
| 条件完整性 | 关键条件齐全 | 存在非关键缺失 | 存在关键缺失 |
| 跨来源一致性 | 无矛盾 | 存在可解释差异 | 存在未解释冲突 |

综合等级由确定性规则计算，不接受模型自报作为最终结果，且不得高于最低的关键维度。任何推断值必须标记 `value_status: inferred`，且进入人工复核队列。评分表示证据可追溯程度，不是材料结论为真的概率。

## 输出前检查

- 每个数值都有 `source_document` 和 `page`。
- 原始值、规范化值和换算说明相互一致。
- `not_reported`、`not_applicable` 与 `unclear` 不混用。
- 不同温度、压力、方向或测试方法的数据不直接排名。
- 缺失字段不由模型补全。
- 证据片段不包含与当前记录无关的长段原文。

## 常见错误

- 将摘要中的近似性能与正文精确结果合并为一条记录。
- 忽略表格脚注里的温度、样品方向或误差范围。
- 只换算单位，不保留原值和换算轨迹。
- 用模型自信程度代替可复查的证据质量。
- 发现冲突后静默覆盖其中一个值。
