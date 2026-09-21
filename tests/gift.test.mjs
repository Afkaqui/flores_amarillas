import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeGift } from "../shared/gift.js";
import { bouquetSVG } from "../shared/bouquet.js";
import { crearEnlace, enlaceConHash, leerRegalo } from "../js/share.js";

test("old gifts receive compatible defaults and retain Unicode", () => {
  const gift = normalizeGift({
    p: " Lucía 💛 ",
    m: "Flores\npara ti",
    d: "José",
    n: 18,
  });
  assert.equal(gift.para, "Lucía 💛");
  assert.equal(gift.mensaje, "Flores\npara ti");
  assert.equal(gift.flores, 18);
  assert.equal(gift.cinta, "rosa");
  assert.equal(gift.ambiente, "noche");
  assert.equal(normalizeGift({ ambiente: "atardecer" }).ambiente, "noche");
});
test("untrusted customizations are bounded before reaching markup and geometry", () => {
  const gift = normalizeGift({
    para: "💛".repeat(50),
    flores: 9000,
    cinta: '"><script>',
    papel: "constructor",
    ambiente: "bad",
    ocasion: "__proto__",
    recuerdos: ["a".repeat(100), "", "c", "d"],
    semilla: Infinity,
  });
  assert.equal(Array.from(gift.para).length, 28);
  assert.equal(gift.flores, 24);
  assert.equal(gift.cinta, "rosa");
  assert.equal(gift.papel, "marfil");
  assert.equal(gift.ocasion, "primavera");
  assert.deepEqual(gift.recuerdos, ["a".repeat(60), "c"]);
  assert.equal(gift.semilla, 0.421);
  assert.equal(normalizeGift(null).flores, 12);
  const svg = bouquetSVG(gift);
  assert.ok(!svg.includes("<script"));
  assert.equal(svg, bouquetSVG(gift));
});
test("personalized gifts round-trip in hash and server-injected links", () => {
  const gift = normalizeGift({
    para: "Ana & Luis",
    de: "José",
    mensaje: "Te quiero 💛\nSiempre.",
    flores: 24,
    cinta: "lavanda",
    papel: "rosa",
    ambiente: "noche",
    ocasion: "aniversario",
    recuerdos: ["Tu risa", "Tu abrazo"],
    semilla: 0.843,
  });
  globalThis.location = { origin: "https://example.test", pathname: "/r/old" };
  globalThis.window = {};
  const url = enlaceConHash(gift);
  assert.ok(url.startsWith("https://example.test/#r="));
  location.hash = new URL(url).hash;
  assert.deepEqual(leerRegalo(), { ...gift, id: null });
  window.__REGALO__ = { ...gift, id: "test123" };
  location.hash = "";
  assert.deepEqual(leerRegalo(), { ...gift, id: "test123" });
  window.__REGALO__ = undefined;
  location.hash = "#r=bad";
  assert.equal(leerRegalo(), null);
});
test("API failure and timeout preserve the complete gift using fallback", async () => {
  const original = globalThis.fetch;
  const gift = {
    para: "Sol",
    mensaje: "Hola 💛",
    cinta: "miel",
    recuerdos: ["Gracias"],
  };
  globalThis.location = { origin: "https://example.test", pathname: "/" };
  try {
    globalThis.fetch = async () => ({ ok: false });
    assert.equal(await crearEnlace(gift), enlaceConHash(gift));
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ url: "javascript:alert(1)" }),
    });
    assert.equal(await crearEnlace(gift), enlaceConHash(gift));
    globalThis.fetch = (_url, options) =>
      new Promise((_resolve, reject) =>
        options.signal.addEventListener("abort", () =>
          reject(new Error("aborted")),
        ),
      );
    assert.equal(await crearEnlace(gift), enlaceConHash(gift));
  } finally {
    globalThis.fetch = original;
  }
});
