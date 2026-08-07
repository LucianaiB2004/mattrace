# 确定性单位规范化

规范化的目标是让同一物理量跨来源可比，并为客观评分（`normalized_value`、`normalized_unit`）提供确定值。规范化是机械换算，不改变测量语义；范围、上限、下限和近似值必须保留在 `value_raw` 中，`value_status` 标记为 `reported`，不得压成单值后变成精确结论。

## 规则

1. 先把单位字符串去掉空白并转小写再匹配。
2. 只有下表列出的单位才生成 `normalized_value` 与 `normalized_unit`；未列出或量纲不明时两者都填 `null`，并在 `confidence_reasons` 写明“数值单位无法规范化比较”。
3. 同一记录同时保留 `value_raw`/`unit_raw`（原文）和规范化结果，并在 `conversion_formula` 记录换算。
4. 单位换算后值发生变化（不只是单位写法不同）时 `value_status` 为 `converted`；仅写法归一（如 `W/mK` → `W m-1 K-1`）时为 `reported`；任何由模型补全或推断的值为 `inferred`。

## 规范化表

| 原单位（去空白小写） | 规范化单位 | 数值换算 | 适用性能 |
|---|---|---|---|
| `s/cm` | `S/cm` | ×1 | 离子电导率 |
| `ms/cm` | `S/cm` | ÷1000 | 离子电导率 |
| `µs/cm`、`μs/cm` | `S/cm` | ÷1000000 | 离子电导率 |
| `gpa` | `MPa` | ×1000 | 强度、模量、硬度 |
| `mpa` | `MPa` | ×1 | 强度、模量、硬度 |
| `wm-1k-1`、`w/mk` | `W m-1 K-1` | ×1 | 热导率 |
| `mah/g`、`mahg-1` | `mAh/g` | ×1 | 比容量 |
| `%` | `%` | ×1 | 孔隙率、保持率等 |

## 科学计数法

原文以 `a × 10^b`、`aEb`、`a ´ 10 b` 等形式给出的数值，`value_raw` 保留原文写法，`normalized_value` 填展开后的浮点数。例如 `2.085 × 10^-4 S/cm` → `normalized_value: 0.0002085`，`normalized_unit: "S/cm"`。

## 冲突判定中的作用

跨来源比较前必须先完成规范化。冲突阈值（默认 30% 相对差异，分母为两数绝对值较小者）只在以下条件全部相同时计算：材料规范名、性能名、`normalized_unit`、以及该性能的关键测试条件（见 [coverage-and-comparability.md](coverage-and-comparability.md)）。单位不同且无法归一时不得比较，也不得判定为冲突。
