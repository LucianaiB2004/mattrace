export async function parseDocx(file, onProgress = () => {}) {
  const mammothModule = await import("mammoth");
  const mammoth = mammothModule.default ?? mammothModule;
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  onProgress(100);
  return [{ page: 1, text: result.value.replace(/\r\n?/g, "\n").trim() }];
}
