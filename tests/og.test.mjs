import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "../server/node_modules/sharp/lib/index.js";
import { svgDelRegalo, pngDelRegalo, pngDePortada, svgDePortada } from "../server/og.js";
import { giftDocument } from "../server/seo.js";
import { readFile } from "node:fs/promises";
test("preview hides private text and escapes names exactly once", () => {
  const svg = svgDelRegalo({
    para: "Ana & Luis",
    de: "A & B",
    mensaje: "PRIVATE MESSAGE",
    recuerdos: ["PRIVATE MEMORY"],
  });
  assert.ok(svg.includes("Ana &amp; Luis"));
  assert.ok(svg.includes("A &amp; B"));
  assert.ok(!svg.includes("&amp;amp;"));
  assert.ok(!svg.includes("PRIVATE"));
  assert.ok(
    !svgDelRegalo({ para: "</text><script>alert(1)</script>" }).includes(
      "<script>",
    ),
  );
});
test("customized OpenGraph image renders as a 1200×630 PNG", async () => {
  const png = await pngDelRegalo({
    id: "test-og",
    para: "Lucía",
    cinta: "lavanda",
    papel: "rosa",
    flores: 24,
  });
  const metadata = await sharp(png).metadata();
  assert.equal(metadata.width, 1200);
  assert.equal(metadata.height, 630);
  assert.equal(metadata.format, "png");
});
test("homepage has its own branded 1200×630 social card", async () => {
  assert.match(svgDePortada(), /Flores para ti/);
  const metadata = await sharp(await pngDePortada()).metadata();
  assert.equal(metadata.width, 1200);
  assert.equal(metadata.height, 630);
});
test("gift metadata replaces homepage SEO without indexing private letters", async () => {
  const template = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const html = giftDocument(template, { id: "demo123", para: 'Ana & <Sol>', de: 'Lucas', mensaje: 'PRIVATE LETTER' }, "https://floresparati.site");
  const head = html.split("</head>")[0];
  assert.equal((head.match(/property="og:image"/g) || []).length, 1);
  assert.equal((head.match(/rel="canonical"/g) || []).length, 1);
  assert.equal((head.match(/name="description"/g) || []).length, 1);
  assert.match(head, /content="noindex, nofollow"/);
  assert.match(head, /href="https:\/\/floresparati.site\/r\/demo123"/);
  assert.match(head, /Ana &amp; &lt;Sol&gt;/);
  assert.doesNotMatch(head, /application\/ld\+json/);
  for (const tag of head.matchAll(/<meta[^>]*>/g)) assert.ok(!tag[0].includes('PRIVATE LETTER'));
});
