import { normalizeAnalysisResult } from "./analysis.mjs";

export const EXAMPLE_DOCUMENTS = Object.freeze([
  { id: "example-1", name: "Solid Electrolytes 2021.pdf", type: "pdf", size: 938_759, pageCount: 14, text: "Solid-state electrolyte thermal conductivity evidence", pages: [{ page: 1, text: "Good Solid-State Electrolytes Have Low, Glass-like Thermal Conductivity. arXiv:2103.08718." }], status: "ready", previewUrl: "./literature/2103.08718.pdf", example: true },
  { id: "example-2", name: "Superionic Discovery 2022.pdf", type: "pdf", size: 840_807, pageCount: 10, text: "Machine-learning aided solid electrolyte discovery evidence", pages: [{ page: 1, text: "Machine Learning-Aided Discovery of Superionic Solid-State Electrolyte for Li-Ion Batteries. arXiv:2202.06763." }], status: "ready", previewUrl: "./literature/2202.06763.pdf", example: true },
  { id: "example-3", name: "Lattice Dynamics 2024.pdf", type: "pdf", size: 712_474, pageCount: 16, text: "Lattice dynamics prediction evidence", pages: [{ page: 1, text: "Machine Learning Prediction Models for Solid Electrolytes based on Lattice Dynamics Properties. arXiv:2404.13858." }], status: "ready", previewUrl: "./literature/2404.13858.pdf", example: true },
]);

export function createExampleReport() {
  return normalizeAnalysisResult({
    summary: "已载入 3 篇公开 PDF，并生成可追溯材料性能数据。",
    records: [
      { material: "Li₆.₄La₃Zr₁.₄Ta₀.₆O₁₂", process: "TDTR 测量", property: "热导率", value: 1.4, unit: "W m⁻¹ K⁻¹", conditions: { temperature: "室温", range: "150–350 K" }, sourceDocument: "Solid Electrolytes 2021.pdf", page: 2, evidence: "Thermal conductivities of Li6.4La3Zr1.4Ta0.6O12 and Li1.5Al0.5Ge1.5(PO4)3 are 1.4 W m-1 K-1 and 2.2 W m-1 K-1, respectively.", confidence: "high" },
      { material: "Li₁.₅Al₀.₅Ge₁.₅(PO₄)₃", process: "TDTR 测量", property: "热导率", value: 2.2, unit: "W m⁻¹ K⁻¹", conditions: { temperature: "室温", range: "150–350 K" }, sourceDocument: "Solid Electrolytes 2021.pdf", page: 2, evidence: "Thermal conductivities of Li6.4La3Zr1.4Ta0.6O12 and Li1.5Al0.5Ge1.5(PO4)3 are 1.4 W m-1 K-1 and 2.2 W m-1 K-1, respectively.", confidence: "high" },
      { material: "Cs₂LiNd(BO₃)₂", process: "AIMD 计算", property: "离子电导率", value: 0.000503, unit: "S/cm", conditions: { temperature: "室温", method: "AIMD" }, sourceDocument: "Superionic Discovery 2022.pdf", page: 21, evidence: "Cs2LiNd(BO3)2 0.000503 S/cm at RT.", confidence: "high" },
      { material: "Li₃P", process: "机器学习数据集核验", property: "离子电导率", value: 0.001, unit: "S/cm", conditions: { temperature: "室温" }, sourceDocument: "Lattice Dynamics 2024.pdf", page: 10, evidence: "Li3P (σ = 1.0 × 10-3 S/cm) and β-Li3N (σ = 2.085 × 10-4 S/cm) are representative examples.", confidence: "medium" },
    ],
    missingConditions: [
      { recordIndex: 0, field: "relativeDensity", message: "LLZTO 样品相对密度未说明" },
      { recordIndex: 1, field: "relativeDensity", message: "LAGP 样品相对密度未说明" },
      { recordIndex: 3, field: "method", message: "Li₃P 实验测试方法未说明" },
    ],
  });
}
