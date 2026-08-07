# 顶层输出结构与确定性评分

最终输出是一个符合 [output-schema.json](output-schema.json) 的 JSON 对象，顶层必须包含五个字段：`coverage_matrix`、`records`、`missing_conditions`、`conflicts`、`review_queue`。机器可校验的完整真实示例见 [`examples/sample-output.json`](../examples/sample-output.json)，由 [`examples/sample-gold.jsonl`](../examples/sample-gold.jsonl) 经 `scripts/normalize-record.mjs` 生成；对应输入为 [`examples/sample-input.json`](../examples/sample-input.json)（三篇公开 arXiv 论文的真实全文页文本）。

## 顶层结构

```json
{
  "coverage_matrix": [
    { "document_id": "doc-2103.08718", "status": "extracted", "checked_pages": ["2"], "record_count": 2, "reason": "在标注页找到并核验了 2 条带单位的性能证据" }
  ],
  "records": [
    {
      "record_id": "gold-llzto-kappa",
      "document_id": "doc-2103.08718",
      "material_name_raw": "Li6.4La3Zr1.4Ta0.6O12",
      "material_name_normalized": "Li6.4La3Zr1.4Ta0.6O12",
      "property_name": "thermal conductivity",
      "value_raw": "1.4",
      "unit_raw": "W m-1 K-1",
      "value_status": "reported",
      "normalized_value": 1.4,
      "normalized_unit": "W m-1 K-1",
      "source_document": "Good Solid-State Electrolytes Have Low, Glass-like Thermal Conductivity (arXiv:2103.08718)",
      "page": "2",
      "evidence_text": "thermal conductivities of Li 6.4 La 3 Zr 1.4 Ta 0.6 O 12 and Li 1.5 Al 0.5 Ge 1.5 (PO 4 ) 3 are 1.4 W m -1 K -1 and 2.2 W m -1 K -1 , respectively.",
      "missing_conditions": ["method", "orientation", "density_or_porosity"],
      "confidence": "medium",
      "confidence_reasons": ["证据来自摘要，需在正文或表图中复核", "关键测试条件缺失: method, orientation, density_or_porosity"],
      "review_required": true
    }
  ],
  "missing_conditions": [
    { "record_id": "gold-llzto-kappa", "field": "method", "message": "… 中 Li6.4La3Zr1.4Ta0.6O12 的关键测试条件 method 未在证据页说明" }
  ],
  "conflicts": [],
  "review_queue": [
    { "record_id": "gold-llzto-kappa", "reasons": ["证据来自摘要，需在正文或表图中复核", "关键测试条件缺失: method, orientation, density_or_porosity"] }
  ]
}
```

`records` 的全部必填字段与 `value_status`/`confidence` 枚举以 [output-schema.json](output-schema.json) 为准；字段语义见 [output-schema.md](output-schema.md)。

## 四维证据评分（确定性）

每条记录的可比性护照按下表打分，总分 100。评分只依据可复查的客观信号，不接受模型自报置信度作为最终结果。

| 维度 | 分值 | 判定（全部满足才给分） |
|---|---|---|
| 证据定位 evidence | 35 | 证据原文非空；`page` 存在且不是“未定位”；证据片段在去空白、转小写后同时包含该记录的数值与单位；来源可在实际送入分析的片段中定位 |
| 字段完整性 completeness | 25 | 材料、制备工艺、性能、数值、单位五个核心字段中非空且非“未说明”的比例，按 `round(完整字段数 / 5 × 25)` 计分 |
| 测试条件 conditions | 20 | 该性能的关键测试条件全部报告（无缺失），否则 0 分 |
| 单位可比性 comparability | 20 | 数值可按 [单位规范化表](unit-normalization.md) 归一且关键条件齐全 → 20；可归一但条件缺失 → 10；不可归一 → 0 |

参考实现见 MatTrace 应用中的 `app/domain/evidence-audit.mjs`。该评分衡量证据的可追溯与可比较程度，不是材料结论为真的概率。

## 可比较硬门槛

`comparable: true` 必须**同时**满足：总分 ≥ 70；证据可定位（evidence 维度满分）；关键测试条件齐全；数值已规范化。随后只能把材料规范名、性能名、`normalized_unit` 和关键条件（温度、方法、方向、样品形态等）全部兼容的记录放入同一可比组。任一硬门槛不满足时保持分离并写明原因。

## 冲突检测

对同一可比组内的任意两条记录 `a`、`b`，计算相对差异：

```
difference = |a.normalized_value - b.normalized_value| / min(|a.normalized_value|, |b.normalized_value|)
```

当 `difference > 0.30`（即超过 30%）时记为冲突。分母固定取两数绝对值中的较小者，避免用较大值稀释差异。任一记录存在缺失关键条件、或二者单位无法归一时，不参与冲突计算（先补条件或保持不可比）。
