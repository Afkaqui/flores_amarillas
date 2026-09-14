import pg from "pg";
import { normalizeGift } from "../shared/gift.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
});

/** Crea la tabla si no existe. Se llama una vez al arrancar. */
export async function prepararEsquema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS regalos (
      id          text PRIMARY KEY,
      para        text NOT NULL,
      mensaje     text NOT NULL,
      de          text NOT NULL DEFAULT '',
      flores      smallint NOT NULL DEFAULT 12,
      creado      timestamptz NOT NULL DEFAULT now(),
      abierto     timestamptz,
      aperturas   integer NOT NULL DEFAULT 0,
      ip_creador  inet
    );
  `);
  await pool.query(
    `ALTER TABLE regalos ADD COLUMN IF NOT EXISTS detalles jsonb NOT NULL DEFAULT '{}'::jsonb;`,
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS regalos_creado_idx ON regalos (creado DESC);`,
  );
}

export async function guardarRegalo(r) {
  await pool.query(
    `INSERT INTO regalos (id, para, mensaje, de, flores, ip_creador, detalles)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [
      r.id,
      r.para,
      r.mensaje,
      r.de,
      r.flores,
      r.ip || null,
      JSON.stringify(normalizeGift(r)),
    ],
  );
}

export async function leerRegalo(id) {
  const { rows } = await pool.query(
    `SELECT id, para, mensaje, de, flores, creado, aperturas, detalles FROM regalos WHERE id = $1`,
    [id],
  );
  const row = rows[0];
  return row ? { ...row, ...normalizeGift({ ...row, ...row.detalles }) } : null;
}

/**
 * Marca que alguien lo abrió. No es una métrica fina: los rastreadores de
 * WhatsApp y compañía también piden la página, así que sólo cuenta cuando el
 * navegador pide los datos del ramo, no cuando se arma la vista previa.
 */
export async function marcarApertura(id) {
  await pool.query(
    `UPDATE regalos
        SET aperturas = aperturas + 1,
            abierto = COALESCE(abierto, now())
      WHERE id = $1`,
    [id],
  );
}

/** Cuántos regalos creó esta IP en la última hora (freno anti-spam) */
export async function regalosRecientes(ip) {
  if (!ip) return 0;
  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM regalos
      WHERE ip_creador = $1 AND creado > now() - interval '1 hour'`,
    [ip],
  );
  return rows[0]?.n ?? 0;
}
