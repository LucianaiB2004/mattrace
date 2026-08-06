export function extractEvidence(document) {
  const propertyTerms = /conductivity|strength|capacity|modulus|diffusivity|density|thermal|电导率|强度|容量|模量|扩散|密度|热导率/i;
  const unitTerms = /S\s*\/\s*cm|mS\s*\/\s*cm|MPa|GPa|mAh|W\s*m|%/i;
  return document.pages.flatMap(({ page, text }) => {
    const normalized = String(text ?? "").replace(/\r/g, "");
    const candidates = normalized.split(/(?<=[.!?。！？])\s*|\n+/).map((part) => part.trim()).filter(Boolean);
    const direct = candidates.filter((part) => /\d/.test(part) && propertyTerms.test(part));
    const lines = normalized.split("\n").map((line) => line.trim()).filter(Boolean);
    const header = lines.find((line) => propertyTerms.test(line) && !/\d/.test(line));
    const tableRows = header ? lines.filter((line) => line !== header && /\d/.test(line) && unitTerms.test(line) && /[|,\t]/.test(line)).map((line) => `${header}\n${line}`) : [];
    return [...direct, ...tableRows].map((evidenceText) => ({ documentId: document.id, sourceDocument: document.name, page, evidenceText: evidenceText.slice(0, 219) }));
  });
}
