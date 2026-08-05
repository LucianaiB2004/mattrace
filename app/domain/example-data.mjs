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
      { material: "Li₇La₃Zr₂O₁₂", process: "固相烧结（900°C）", property: "离子电导率", value: 1.2, unit: "mS/cm", conditions: { temperature: "25°C", method: "阻抗法" }, sourceDocument: "Adv. Mater. 2024.pdf", page: 12, evidence: "The ionic conductivity of LLZO sintered at 900°C was measured to be 1.2 mS/cm at 25°C by impedance spectroscopy.", confidence: "high" },
      { material: "CoCrFeNiMo₀.₅", process: "真空熔炼", property: "屈服强度", value: 685, unit: "MPa", conditions: { temperature: "室温", method: "拉伸测试", rate: "1e-3 s⁻¹" }, sourceDocument: "J. Alloys Compd. 2023.pdf", page: 8, evidence: "The alloy reached a yield strength of 685 MPa under room-temperature tensile testing at 1e-3 s-1.", confidence: "medium" },
      { material: "Ti₃AlC₂ MXene", process: "HF 刻蚀", property: "比容量", value: 312, unit: "mAh/g", conditions: { current: "1 A/g", setup: "三电极" }, sourceDocument: "Acta Mater. 2022.pdf", page: 6, evidence: "A specific capacity of 312 mAh/g was reported at 1 A/g in a three-electrode configuration.", confidence: "high" },
      { material: "Li₇La₃Zr₂O₁₂", process: "热压烧结（950°C）", property: "离子电导率", value: 1.7, unit: "mS/cm", conditions: { temperature: "25°C" }, sourceDocument: "Solid State Ionics 2023.pdf", page: 5, evidence: "Hot-pressed LLZO exhibited an ionic conductivity of 1.7 mS/cm at 25°C.", confidence: "medium" },
    ],
    missingConditions: [
      { recordIndex: 1, field: "relativeDensity", message: "样品相对密度未说明" },
      { recordIndex: 2, field: "temperature", message: "测试温度未说明" },
      { recordIndex: 3, field: "method", message: "测试方法未说明" },
    ],
  });
}
