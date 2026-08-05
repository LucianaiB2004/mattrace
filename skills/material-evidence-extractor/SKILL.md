---
name: material-evidence-extractor
description: Use when extracting structured material composition, processing, property, test-condition, and provenance records from 3-10 papers, patents, or technical data sheets, especially when values require page-level evidence, unit normalization, missing-condition detection, confidence assessment, or cross-document conflict checks.
---

# Material Evidence Extractor

## 任务描述

输入 3-10 篇论文、专利或技术数据表（TDS），抽取材料组成、实验条件、性能指标、单位、测试条件、来源页码、缺失字段和可信度。输出 JSON/CSV 数据表、证据链、缺失条件报告、可信度评分和可复查引用。

## 核心原则

把每个性能值作为一条独立证据记录。记录必须同时回答：什么材料、如何制备、测了什么、在什么条件下测量、原文在哪里。缺失内容标记为缺失，不用常识补写。

处理前读取 [输出字段规范](references/output-schema.md)。

## 工作流

1. **登记文档**：为每份输入分配稳定 `document_id`，记录标题、类型和页数。保留原始页码，不按抽取文本重新编号。
2. **识别材料实体**：分别保存原始名称、规范化名称、化学式、掺杂量、样品形态和别名。不能确定两种名称是否同一材料时保持分离。
3. **拆分证据记录**：每个材料、工艺、性能值和测试条件组合生成一条记录。表格中的每一行独立处理，不把脚注应用到无关行。
4. **绑定证据链**：记录文档、页码、章节及表/图编号，并摘录能支持数值与条件的最短证据片段。找不到定位时设置 `review_required: true`。
5. **规范化单位**：同时保留原值与原单位。只有量纲明确时才生成规范化值；记录换算公式。范围、上限、下限和近似值不得改成精确单值。
6. **核验条件与缺失条件**：检查温度、压力、频率、应变速率、样品方向、样品密度、测试方法等与当前性能相关的条件。将未报告字段写入 `missing_conditions`。
7. **检测冲突与可比性**：按材料、性能、单位和关键测试条件分组。仅将条件兼容的记录放入同一 `comparability_group`。差异超过用户阈值时生成冲突记录，不自行选定“正确值”。
8. **生成交付物**：输出 `records.jsonl`、`comparison.csv`、`evidence-report.md`、`missing-and-conflicts.md` 和 `review-queue.csv`。

## 置信度合同

分别评估以下维度，再给出综合等级：

| 维度 | 高 | 中 | 低 |
|---|---|---|---|
| 来源定位 | 页码及表/图明确 | 仅页码或章节明确 | 无法稳定定位 |
| 数值证据 | 数值、单位、属性同处 | 需结合脚注或相邻文本 | 依赖推断 |
| 条件完整性 | 关键条件齐全 | 存在非关键缺失 | 存在关键缺失 |
| 跨来源一致性 | 无矛盾 | 存在可解释差异 | 存在未解释冲突 |

综合等级不得高于最低的关键维度。任何推断值必须标记 `value_status: inferred`，且进入人工复核队列。

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
