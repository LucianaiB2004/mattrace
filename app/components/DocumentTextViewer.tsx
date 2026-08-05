"use client";

import { useMemo, useState } from "react";

type PageText = { page: number; text: string };

export default function DocumentTextViewer({ pages }: { pages: PageText[] }) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized ? pages.filter((page) => page.text.toLowerCase().includes(normalized)) : [];
  }, [pages, query]);
  function jump(page: number) { document.getElementById(`parsed-page-${page}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }
  return <div className="document-text-viewer">
    <div className="document-text-tools"><label><span>全文搜索</span><input type="search" aria-label="搜索解析文本" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索材料、数值或测试条件" /></label><p>{query ? `找到 ${matches.length} 个页面` : `共 ${pages.length} 页解析文本`}</p></div>
    {!!matches.length && <div className="document-search-results">{matches.map((page) => <button type="button" key={page.page} aria-label={`跳转到第 ${page.page} 页`} onClick={() => jump(page.page)}>P.{page.page}<span>{page.text.slice(0, 74)}</span></button>)}</div>}
    <div className="document-text-preview">{pages.map((page) => <section id={`parsed-page-${page.page}`} key={page.page}><strong>第 {page.page} 页</strong><p>{page.text || "本页没有可提取文本"}</p></section>)}</div>
  </div>;
}
