import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  throw new Error('Falta DATABASE_URL. En Railway se inyecta al vincular el servicio de Postgres.');
}

// Railway sirve Postgres tras un proxy con certificado propio; el cliente no
// puede validar la cadena, pero el tránsito sigue cifrado. En local sin TLS
// (postgres://localhost) pg ignora la opción.
const needsSsl = !/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: needsSsl ? { rejectUnauthorized: false } : false,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => {
  console.error('[db] error en cliente inactivo del pool:', err.message);
});

export async function initSchema() {
  const sql = await readFile(join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('[db] esquema verificado');
}

export function query(text, params) {
  return pool.query(text, params);
}
