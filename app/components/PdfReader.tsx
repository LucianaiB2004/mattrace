"use client";

import { useEffect, useRef, useState } from "react";
import { openPdfSource } from "../services/pdf-runtime.mjs";

type PdfReaderProps = { source: string; name: string };
type PdfDocument = { numPages: number; getPage: (page: number) => Promise<any>; destroy: () => Promise<void> };

function PdfThumbnail({ document, pageNumber, active, onSelect }: { document: PdfDocument; pageNumber: number; active: boolean; onSelect: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<unknown> } | null = null;
    void document.getPage(pageNumber).then((page) => {
      if (cancelled || !canvasRef.current) return;
      const initial = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: 78 / initial.width });
      const canvas = canvasRef.current;
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      task = page.render({ canvasContext: canvas.getContext("2d"), viewport });
      return task.promise;
    }).catch((error) => { if (error?.name !== "RenderingCancelledException") console.error(error); });
    return () => { cancelled = true; task?.cancel(); };
  }, [document, pageNumber]);
  return <button className={active ? "active" : ""} type="button" aria-label={`查看 PDF 第 ${pageNumber} 页`} onClick={onSelect}><canvas ref={canvasRef} /><span>{pageNumber}</span></button>;
}

export default function PdfReader({ source, name }: PdfReaderProps) {
  const [document, setDocument] = useState<PdfDocument | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const mainRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let active = true;
    let loaded: PdfDocument | null = null;
    setDocument(null); setError(""); setPageNumber(1); setZoom(1);
    void openPdfSource(source).then((next: PdfDocument) => { loaded = next; if (active) setDocument(next); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "PDF 加载失败"); });
    return () => { active = false; if (loaded) void loaded.destroy(); };
  }, [source, retry]);

  useEffect(() => {
    if (!document || !canvasRef.current || !mainRef.current) return;
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<unknown> } | null = null;
    void document.getPage(pageNumber).then((page) => {
      if (cancelled || !canvasRef.current || !mainRef.current) return;
      const initial = page.getViewport({ scale: 1 });
      const fitScale = Math.max(.2, (mainRef.current.clientWidth - 40) / initial.width);
      const viewport = page.getViewport({ scale: fitScale * zoom });
      const canvas = canvasRef.current;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.ceil(viewport.width * ratio);
      canvas.height = Math.ceil(viewport.height * ratio);
      canvas.style.width = `${Math.ceil(viewport.width)}px`;
      canvas.style.height = `${Math.ceil(viewport.height)}px`;
      const context = canvas.getContext("2d");
      if (context) context.setTransform(ratio, 0, 0, ratio, 0, 0);
      task = page.render({ canvasContext: context, viewport });
      return task.promise;
    }).catch((reason) => { if (reason?.name !== "RenderingCancelledException") setError("PDF 页面渲染失败"); });
    return () => { cancelled = true; task?.cancel(); };
  }, [document, pageNumber, zoom]);

  if (error) return <div className="pdf-reader-error"><p>{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)}>重试 PDF</button></div>;
  if (!document) return <div className="pdf-reader-loading">正在加载 {name}…</div>;
  return <section className="pdf-reader" aria-label={`${name} PDF 阅读器`}>
    <header className="pdf-reader-toolbar">
      <button type="button" aria-label="上一页" disabled={pageNumber === 1} onClick={() => setPageNumber((page) => Math.max(1, page - 1))}>←</button>
      <strong>{pageNumber} / {document.numPages}</strong>
      <button type="button" aria-label="下一页" disabled={pageNumber === document.numPages} onClick={() => setPageNumber((page) => Math.min(document.numPages, page + 1))}>→</button>
      <i />
      <button type="button" aria-label="缩小" onClick={() => setZoom((value) => Math.max(.6, Number((value - .1).toFixed(1))))}>−</button>
      <span className="pdf-zoom-status">{Math.round(zoom * 100)}%</span>
      <button type="button" aria-label="放大" onClick={() => setZoom((value) => Math.min(2, Number((value + .1).toFixed(1))))}>＋</button>
      <button type="button" onClick={() => setZoom(1)}>适合宽度</button>
    </header>
    <div className="pdf-reader-body">
      <nav className="pdf-thumbnails" aria-label="PDF 页面缩略图">{Array.from({ length: document.numPages }, (_, index) => <PdfThumbnail document={document} pageNumber={index + 1} active={pageNumber === index + 1} onSelect={() => setPageNumber(index + 1)} key={index + 1} />)}</nav>
      <div className="pdf-main-page" ref={mainRef}><canvas className="pdf-page-canvas" ref={canvasRef} /></div>
    </div>
  </section>;
}
