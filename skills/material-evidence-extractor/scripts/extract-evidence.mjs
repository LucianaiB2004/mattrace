export function extractEvidence(document) {
  return document.pages.flatMap(({ page, text }) => text.split(/(?<=[.!?])\s+/).filter((sentence) => /\d/.test(sentence) && /conductivity|strength|capacity|modulus/i.test(sentence)).map((evidenceText) => ({ documentId: document.id, sourceDocument: document.name, page, evidenceText })));
}
