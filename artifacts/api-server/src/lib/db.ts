import { pool } from "@workspace/db";

function toPgParams(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

export function getPKT(): string {
  const now = new Date();
  const pkt = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Karachi" }));
  const y = pkt.getFullYear();
  const m = String(pkt.getMonth() + 1).padStart(2, "0");
  const d = String(pkt.getDate()).padStart(2, "0");
  const h = String(pkt.getHours()).padStart(2, "0");
  const min = String(pkt.getMinutes()).padStart(2, "0");
  const s = String(pkt.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

export function getPKTDate(): string {
  const now = new Date();
  const pkt = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Karachi" }));
  const y = pkt.getFullYear();
  const m = String(pkt.getMonth() + 1).padStart(2, "0");
  const d = String(pkt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function queryGet<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const result = await pool.query(toPgParams(sql), params);
  return (result.rows[0] as T) ?? null;
}

export async function queryAll<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await pool.query(toPgParams(sql), params);
  return result.rows as T[];
}

export async function dbExec(
  sql: string,
  params: unknown[] = []
): Promise<{ rowCount: number }> {
  const result = await pool.query(toPgParams(sql), params);
  return { rowCount: result.rowCount ?? 0 };
}

export async function dbInsert(
  sql: string,
  params: unknown[] = []
): Promise<{ id: number }> {
  const pgSql = toPgParams(sql);
  const returningSQL = pgSql.replace(/;?\s*$/, "") + " RETURNING id";
  const result = await pool.query(returningSQL, params);
  return { id: result.rows[0]?.id as number };
}
