import { test } from "node:test";
import assert from "node:assert/strict";
import { mensajeParaCompartir, enlaceWhatsApp, crearEnlace } from "../js/share.js";

test("the default WhatsApp greeting uses plain text and retains accents and line breaks", () => {
  const message = mensajeParaCompartir({ para: "Yarith" });
  assert.equal(message, "Yarith, te preparé unas flores.\nHay unas palabras esperando por ti. Abre tu regalo cuando tengas un ratito.");
  const url = new URL(enlaceWhatsApp(message, "https://example.test/r/abc1234"));
  assert.equal(url.searchParams.get("text"), message + "\n\nhttps://example.test/r/abc1234");
  assert.ok(!url.searchParams.get("text").includes("\uFFFD"));
});

test("WhatsApp encodes the edited message and complete gift URL without leaking the letter", () => {
  const gift = { para: "Lucía & José 💛", mensaje: "Una carta privada" };
  const message = mensajeParaCompartir(gift);
  assert.ok(message.startsWith("Lucía & José 💛, te"));
  assert.ok(!message.includes(gift.mensaje));
  const link = "https://example.test/r/abc1234?x=1&y=2#recuerdo";
  const result = new URL(enlaceWhatsApp(message + "\nMi detalle & el tuyo", link));
  assert.equal(result.origin, "https://wa.me");
  assert.deepEqual([...result.searchParams.keys()], ["text"]);
  assert.equal(result.searchParams.get("text"), message + "\nMi detalle & el tuyo\n\n" + link);
  assert.throws(() => enlaceWhatsApp(message, "javascript:alert(1)"));
});

test("reply-enabled gifts never fall back to a link without server persistence", async () => {
  const original = globalThis.fetch;
  const originalLocation = globalThis.location;
  globalThis.location = { origin: "https://example.test" };
  globalThis.fetch = async () => ({ ok: false });
  try {
    await assert.rejects(crearEnlace({ para: "Sol", permitirRespuesta: true }), /servidor/);
  } finally {
    globalThis.fetch = original;
    globalThis.location = originalLocation;
  }
});
