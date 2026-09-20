import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeDrawing,
  templateFlower,
  templateDrawing,
  drawingSVG,
  INKS,
} from "../shared/drawing.js";
import { normalizeGift } from "../shared/gift.js";
import { islandSVG } from "../shared/island.js";
import { validateProposal, propose } from "../server/assistant.js";
import sharp from "../server/node_modules/sharp/lib/index.js";

test("drawings bound input, discard invalid points and escape through numeric rendering", () => {
  const d = normalizeDrawing({
    note: "x".repeat(100),
    strokes: [
      {
        color: '\"><script>',
        width: 99,
        points: [
          [Infinity, 1],
          [-5, 500],
          [20, 30],
          [NaN, 0],
        ],
      },
    ],
  });
  assert.deepEqual(d.strokes[0].points, [
    [0, 300],
    [20, 30],
  ]);
  assert.equal(d.strokes[0].color, INKS[0]);
  assert.equal(d.note.length, 80);
  assert.ok(!drawingSVG(d).includes("<script"));
  assert.equal(normalizeDrawing({ strokes: [{ points: [[10, 10]] }] }), null);
  assert.equal(
    normalizeGift({ dibujos: Array(9).fill(templateFlower()) }).dibujos.length,
    6,
  );
});
test("garden survives normalization and renders to a standalone image", async () => {
  const gift = normalizeGift({
    para: "Ana",
    dibujos: [{ ...templateFlower(), note: "Sólo para ti" }],
    composicion: "sencillo",
  });
  assert.deepEqual(normalizeGift(JSON.parse(JSON.stringify(gift))), gift);
  const svg = islandSVG(gift.dibujos);
  assert.equal(svg, islandSVG(gift.dibujos));
  assert.ok(!svg.includes("Sólo para ti"));
  const { info } = await sharp(Buffer.from(svg))
    .png()
    .toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 840);
});
test("agent proposals cannot change drawings, media, permissions or arbitrary code", () => {
  assert.deepEqual(
    validateProposal({
      patch: {
        mensaje: "Hola",
        flores: 1000,
        cinta: "__proto__",
        voz: "/secret",
        permitirRespuesta: true,
        dibujos: [],
        script: "evil",
      },
    }).patch,
    { mensaje: "Hola" },
  );
  assert.throws(() => validateProposal({ patch: { cinta: "invalid" } }));
});
test("agent calls Go with a stable session, minimal private context and validates output", async () => {
  let calls = 0;
  const r = await propose({
    key: "test-placeholder",
    sessionId: "test-session",
    message: "Más breve",
    gift: {
      para: "Ana",
      dibujos: [templateFlower()],
      voz: "/media/" + "a".repeat(48) + ".ogg",
    },
    fetcher: async (url, options) => {
      calls++;
      assert.equal(url, "https://opencode.ai/zen/go/v1/chat/completions");
      assert.equal(options.headers["x-opencode-session"], "test-session");
      const body = JSON.parse(options.body);
      assert.equal(body.model, "glm-5.3-flash");
      assert.ok(!body.messages.at(-1).content.includes("/media/"));
      assert.ok(!body.messages.at(-1).content.includes("strokes"));
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  calls === 1
                    ? '```json\n{"explanation":"Una idea","patch":{"mensaje":"Gracias por estar."}}\n```'
                    : '{"allowed":true}',
              },
            },
          ],
          usage: { total_tokens: 12 },
        }),
        { status: 200 },
      );
    },
  });
  assert.equal(calls, 2);
  assert.equal(r.patch.mensaje, "Gracias por estar.");
  assert.equal(r.usage, 24);
});
test("provider errors and malformed responses never become a proposal", async () => {
  for (const mock of [
    new Response("{}", { status: 429 }),
    new Response(
      JSON.stringify({ choices: [{ message: { content: "not-json" } }] }),
    ),
  ]) {
    await assert.rejects(
      propose({
        key: "test",
        sessionId: "test",
        message: "Hola",
        gift: {},
        fetcher: async () => mock,
      }),
    );
  }
});

test("provider authentication failures expose a safe message and diagnostic code", async () => {
  for (const status of [401, 403, 429, 500]) {
    await assert.rejects(propose({
      key: "private-test-key",
      message: "Private letter content",
      gift: {},
      fetcher: async () => new Response("Sensitive provider response", { status }),
    }), (error) => {
      assert.equal(error.providerStatus, status);
      assert.equal(error.status, status === 429 ? 429 : 502);
      assert.equal(error.code, [401, 403].includes(status) ? "provider_auth"
        : status === 429 ? "provider_limit" : "provider_error");
      assert.doesNotMatch(error.message, /Sensitive|private-test-key|Private letter/);
      assert.match(error.message, /asistente|cómplice/);
      return true;
    });
  }
});

test("contextual choices validate every patch and bound follow-up actions", () => {
  const result = validateProposal({
    options: [
      {
        label: "Cerca de ti",
        patch: { mensaje: "Te extraño", fotos: ["secret"] },
      },
      {
        label: "Con una sonrisa",
        patch: { mensaje: "Gracias", cinta: "lavanda" },
      },
      { label: "Sin vueltas", patch: { mensaje: "Te quiero" } },
      { label: "Discard", patch: { mensaje: "Extra" } },
    ],
    followups: [
      { label: "Más cómplice", prompt: "Usa un tono más cómplice" },
      { label: "invalid" },
    ],
  });
  assert.equal(result.options.length, 3);
  assert.deepEqual(result.options[0].patch, { mensaje: "Te extraño" });
  assert.equal(result.followups.length, 1);
  assert.throws(() =>
    validateProposal({
      options: [{ patch: { mensaje: "ok" } }, { patch: { voz: "unsafe" } }],
    }),
  );
  assert.throws(() => validateProposal({ options: [] }));
});

test("followups distinguish a detail to complete from an immediate refinement", () => {
  const result = validateProposal({
    options: [{ patch: { mensaje: "Gracias por estar." } }],
    followups: [
      { label: "Un gesto suyo", prompt: "Me hace sonreír cuando: ", needsDetail: true },
      { label: "Más breve", prompt: "Hazla más breve", needsDetail: false },
      { label: "Otra idea", prompt: "Otra idea", needsDetail: "true" },
    ],
  });
  assert.deepEqual(result.followups.map((item) => item.needsDetail), [true, false, false]);
  assert.equal(result.followups[0].prompt, "Me hace sonreír cuando:");
});

test("photo memories keep captions attached to permitted files and survive round-trip", () => {
  const first = "/media/" + "a".repeat(48) + ".webp",
    second = "/media/" + "b".repeat(48) + ".webp";
  const gift = normalizeGift({
    fotos: [first, second, "https://evil.invalid/photo"],
    momentos: [
      { foto: second, texto: "El día que nos conocimos" },
      { foto: first, texto: "♡".repeat(150) },
      { foto: "https://evil.invalid/photo", texto: "discard" },
    ],
  });
  assert.deepEqual(
    gift.momentos.map((m) => m.foto),
    [first, second],
  );
  assert.equal(Array.from(gift.momentos[0].texto).length, 120);
  assert.equal(gift.momentos[1].texto, "El día que nos conocimos");
  assert.deepEqual(normalizeGift(JSON.parse(JSON.stringify(gift))), gift);
  assert.deepEqual(normalizeGift({ fotos: [first] }).momentos, [
    { foto: first, texto: "" },
  ]);
});

test("drawing starters retain their colors and survive save and SVG export", async () => {
  for (const kind of ["flower", "heart", "sparkle"]) {
    const drawing = templateDrawing(kind, INKS[3]);
    assert.ok(drawing.strokes.some((s) => s.color === INKS[3]));
    const saved = normalizeGift({
      dibujos: [{ ...drawing, note: "Un abrazo para ti" }],
    });
    assert.deepEqual(normalizeGift(JSON.parse(JSON.stringify(saved))), saved);
    const svg = drawingSVG(saved.dibujos[0]);
    assert.match(svg, /<path d="M /);
    const { data, info } = await sharp(Buffer.from(svg))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    assert.equal(info.width, 300);
    let painted = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i]) painted++;
    assert.ok(painted > 500, kind + " renders visible ink");
  }
});
