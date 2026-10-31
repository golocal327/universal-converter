import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const ROOT = path.resolve(__dirname, "../..");
const ADMIN_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/postgres";
const DB_NAME = "wire_sales_os_test";

export type Db = {
  pool: pg.Pool;
  /** Run as the database owner (bypasses RLS) — for fixtures only. */
  admin: <T extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, params?: unknown[]) => Promise<T[]>;
  /** Run inside a transaction as the `authenticated` role with the given user's JWT claims. */
  asUser: <T extends pg.QueryResultRow = pg.QueryResultRow>(userId: string, sql: string, params?: unknown[]) => Promise<T[]>;
  /** Run as the anonymous API role. */
  asAnon: <T extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, params?: unknown[]) => Promise<T[]>;
  createUser: (email: string, fullName?: string) => Promise<string>;
  close: () => Promise<void>;
};

export async function setupDatabase(): Promise<Db> {
  const bootstrap = new pg.Client({ connectionString: ADMIN_URL });
  await bootstrap.connect();
  await bootstrap.query(`drop database if exists ${DB_NAME} with (force)`);
  await bootstrap.query(`create database ${DB_NAME}`);
  await bootstrap.end();

  const url = new URL(ADMIN_URL);
  url.pathname = `/${DB_NAME}`;
  const pool = new pg.Pool({ connectionString: url.toString(), max: 4 });

  await pool.query(readFileSync(path.join(ROOT, "supabase/tests/supabase-shim.sql"), "utf8"));
  const migrationsDir = path.join(ROOT, "supabase/migrations");
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    await pool.query(readFileSync(path.join(migrationsDir, file), "utf8"));
  }

  const runAs = async <T extends pg.QueryResultRow>(role: string, claims: object | null, sql: string, params: unknown[] = []) => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(`set local role ${role}`);
      if (claims) await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
      const res = await client.query<T>(sql, params);
      await client.query("commit");
      return res.rows;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  };

  return {
    pool,
    admin: async (sql, params = []) => (await pool.query(sql, params)).rows,
    asUser: (userId, sql, params) => runAs("authenticated", { sub: userId, role: "authenticated" }, sql, params),
    asAnon: (sql, params) => runAs("anon", { role: "anon" }, sql, params),
    createUser: async (email, fullName) => {
      const rows = (
        await pool.query<{ id: string }>(
          "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
          [email, JSON.stringify(fullName ? { full_name: fullName } : {})],
        )
      ).rows;
      return rows[0].id;
    },
    close: () => pool.end(),
  };
}
