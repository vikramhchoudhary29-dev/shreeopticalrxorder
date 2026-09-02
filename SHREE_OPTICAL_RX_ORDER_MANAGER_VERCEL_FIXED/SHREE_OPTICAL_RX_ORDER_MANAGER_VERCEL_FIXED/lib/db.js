import { neon } from '@neondatabase/serverless';

let initialized = false;

function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured. Add it in Vercel Project Settings → Environment Variables.');
  }
  return neon(process.env.DATABASE_URL);
}

export async function db() {
  const sql = getSql();
  if (!initialized) {
    await sql`CREATE TABLE IF NOT EXISTS products (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      brand TEXT DEFAULT '',
      category TEXT DEFAULT '',
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS orders (
      id BIGSERIAL PRIMARY KEY,
      order_type TEXT NOT NULL CHECK (order_type IN ('lens','glass')),
      customer_name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      product_name TEXT DEFAULT '',
      right_sph TEXT DEFAULT '',
      right_cyl TEXT DEFAULT '',
      right_axis TEXT DEFAULT '',
      left_sph TEXT DEFAULT '',
      left_cyl TEXT DEFAULT '',
      left_axis TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','received')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    initialized = true;
  }
  return sql;
}

export function serialize(row) {
  if (!row) return row;
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === 'bigint' ? value.toString() : value]));
}
