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
