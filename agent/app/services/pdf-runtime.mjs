let runtimePromise;

export async function openPdfSource(source) {
  if (!runtimePromise) {
    runtimePromise = Promise.all([
      import("pdfjs-dist/legacy/build/pdf.mjs"),
      import("pdfjs-dist/legacy/build/pdf.worker.mjs?raw"),
    ]).then(([pdfjs, worker]) => {
      if (!pdfjs.GlobalWorkerOptions.workerPort) {
        const workerUrl = URL.createObjectURL(new Blob([worker.default], { type: "text/javascript" }));
        pdfjs.GlobalWorkerOptions.workerPort = new Worker(workerUrl, { type: "module" });
      }
      return pdfjs;
    });
  }
  const pdfjs = await runtimePromise;
  return pdfjs.getDocument({ url: source }).promise;
}
