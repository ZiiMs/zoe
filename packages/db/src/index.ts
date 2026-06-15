import pg from "pg";

export interface DatabaseOptions {
  connectionString: string;
}

export function createPool(options: DatabaseOptions): pg.Pool {
  return new pg.Pool({
    connectionString: options.connectionString
  });
}

export async function checkDatabase(pool: pg.Pool): Promise<boolean> {
  const result = await pool.query<{ ok: number }>("select 1 as ok");
  return result.rows[0]?.ok === 1;
}
