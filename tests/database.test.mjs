import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { normalizeGift } from "../shared/gift.js";
const enabled = process.env.FLORES_TEST_DB === "1";
test(
  "PostgreSQL preserves gift customization and supports legacy rows",
  { skip: !enabled },
  async () => {
    const { pool, prepararEsquema, guardarRegalo, leerRegalo } = await import(
      "../server/db.js"
    );
    const ids = ["test-" + randomUUID(), "test-" + randomUUID()];
    try {
      await prepararEsquema();
      await prepararEsquema();
      const gift = normalizeGift({
        para: "Lucía",
        mensaje: "Un abrazo\n💛",
        de: "José & Ana",
        flores: 24,
        cinta: "lavanda",
        papel: "rosa",
        ambiente: "noche",
        ocasion: "aniversario",
        recuerdos: ["Tu risa", "Tu abrazo"],
        semilla: 0.763,
      });
      await guardarRegalo({ ...gift, id: ids[0] });
      const received = await leerRegalo(ids[0]);
      assert.deepEqual(normalizeGift(received), gift);
      await pool.query(
        "INSERT INTO regalos(id, para, mensaje, de, flores) VALUES($1,$2,$3,$4,$5)",
        [ids[1], "Sol", "Un regalo antiguo", "Luna", 6],
      );
      const old = await leerRegalo(ids[1]);
      assert.equal(old.para, "Sol");
      assert.equal(old.cinta, "rosa");
      assert.equal(old.flores, 6);
    } finally {
      await pool.query("DELETE FROM regalos WHERE id = ANY($1)", [ids]);
      await pool.end();
    }
  },
);
