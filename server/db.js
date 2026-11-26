import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';

export async function openDatabase({ url, dataDir = resolve('data/pgdata') } = {}) {
  if (url) {
    const pool = new pg.Pool({ connectionString: url });
    return {
      query: (sql, params) => pool.query(sql, params),
      exec: sql => pool.query(sql),
      async transaction(fn) {
        const client = await pool.connect();
        try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
        catch (error) { await client.query('ROLLBACK'); throw error; }
        finally { client.release(); }
      },
      close: () => pool.end()
    };
  }
  if (dataDir !== 'memory://') await mkdir(dataDir, { recursive: true });
  return PGlite.create(dataDir);
}

export async function migrate(db) {
  await db.exec(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
}
