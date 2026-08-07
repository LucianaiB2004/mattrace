import test from "node:test";
import assert from "node:assert/strict";

import { makeStaticHtml, makeStaticJavaScript } from "../scripts/static-export.mjs";

test("static export rewrites root assets for a GitHub Pages project path", () => {
  const source = '<link href="/_next/a.css"><script src="/_next/a.js"></script><img src="/robot.png"><meta content="http://localhost:3000/og.png">';
  const html = makeStaticHtml(source);
  assert.match(html, /href="\.\/_next\/a\.css"/);
  assert.match(html, /src="\.\/_next\/a\.js"/);
  assert.match(html, /src="\.\/robot\.png"/);
  assert.match(html, /content="\.\/og\.png"/);
  assert.doesNotMatch(html, /localhost:3000/);
});

test("static export removes browser-hostile server-only bootstrap URLs", () => {
  const html = makeStaticHtml('<img src="/_next/image?url=%2Frobot.png&w=1080&q=75">');
  assert.doesNotMatch(html, /_next\/image\?/);
  assert.match(html, /src="\.\/robot\.png"/);
});

test("static JavaScript resolves generated worker media from the chunk directory", () => {
  const source = 'var worker=`/_next/static/media/pdf.worker.hash.mjs`;';
  assert.equal(
    makeStaticJavaScript(source),
    'var worker=`../media/pdf.worker.hash.mjs`;',
  );
});

test("static export rewrites root-absolute paths inside the inlined RSC payload", () => {
  // CSS/chunk refs appear as escaped JSON strings and :HL["..."] directives
  // in the RSC payload; public assets like favicon appear as escaped hrefs.
  const source = [
    String.raw`rsc.push("0:{\"css:/_next/static/css/index.css\"}")`,
    String.raw`:HL["/_next/static/chunks/x.js","script"]`,
    String.raw`,\"href\":\"/favicon.svg\"}]`,
    String.raw`[\"/page\",\"children\"]`,
  ].join("");
  const html = makeStaticHtml(source);
  assert.match(html, /css:\.\/_next\/static\/css\/index\.css/);
  assert.match(html, /:HL\["\.\/_next\/static\/chunks\/x\.js/);
  assert.match(html, /\\"href\\":\\"\.\/favicon\.svg\\"/);
  // Route references must not be rewritten.
  assert.match(html, /\[\\"\/page\\",/);
  assert.doesNotMatch(html, /(?<!\.)\/_next\/static\//);
});

test("static JavaScript makes Vite's modulepreload base subpath-safe", () => {
  const source = "var Vc=`modulepreload`,Hc=function(e){return`/`+e},Uc={}";
  const result = makeStaticJavaScript(source);
  assert.match(result, /return`\.\/`\+e/);
  assert.doesNotMatch(result, /return`\/`\+e/);
});
