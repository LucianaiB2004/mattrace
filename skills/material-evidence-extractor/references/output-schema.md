# 输出字段规范

每行 `records.jsonl` 表示一个材料样品在一组明确条件下的一项性能证据。

## 必填字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `record_id` | string | 稳定且唯一的记录标识 |
| `document_id` | string | 输入文档标识 |
| `material_name_raw` | string | 原文材料名称 |
| `material_name_normalized` | string | 规范化名称；无法确定时等于原名 |
| `property_name` | string | 性能名称 |
| `value_raw` | string | 原文数值、范围或限定符 |
| `unit_raw` | string | 原文单位 |
| `value_status` | string | `reported`、`converted` 或 `inferred` |
| `source_document` | string | 文档标题或文件名 |
| `page` | string | 原文页码 |
| `evidence_text` | string | 支持本条记录的最短原文片段 |
| `missing_conditions` | array | 未报告的关键测试条件 |
| `confidence` | string | `high`、`medium` 或 `low` |
| `confidence_reasons` | array | 确定性评分的加分、扣分或复核原因 |
| `review_required` | boolean | 是否需要人工复核 |

## 条件与溯源字段

按文档实际内容填写。规范化数值无法可靠生成时使用 `null`；来源未报告的文本条件使用下方状态枚举：

- `composition`
- `dopants`
- `sample_form`
- `processing_steps`
- `test_method`
- `temperature`
- `pressure`
- `frequency_range`
- `strain_rate`
- `orientation`
- `relative_density`
- `normalized_value`
- `normalized_unit`
- `conversion_formula`
- `section`
- `table_or_figure`
- `comparability_group`
- `conflict_ids`

## 状态枚举

缺失信息使用以下状态之一，禁止用空字符串表达多种含义：

- `not_reported`：来源未报告。
- `not_applicable`：该字段不适用于当前测试。
- `unclear`：来源存在相关表述，但无法可靠判断。

## 交付文件

1. `records.jsonl`：完整证据记录，一行一条。
2. `comparison.csv`：仅包含处于可比组中的核心字段。
3. `evidence-report.md`：按记录列出证据定位、片段和换算轨迹。
4. `missing-and-conflicts.md`：集中列出缺失条件、冲突及影响。
5. `review-queue.csv`：所有 `review_required: true` 的记录。
6. `coverage-matrix.csv`：每篇输入文档的明确处理状态与真实检查页。
7. `comparability-passports.jsonl`：证据质量评分、条件兼容结论和原因。
