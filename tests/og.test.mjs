import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "../server/node_modules/sharp/lib/index.js";
import { svgDelRegalo, pngDelRegalo } from "../server/og.js";
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
