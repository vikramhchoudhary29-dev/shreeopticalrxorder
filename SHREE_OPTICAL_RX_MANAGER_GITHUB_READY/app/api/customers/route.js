import { db, ensureSchema, json, failure } from '@/lib/db';

export const runtime = 'nodejs';

const clean = (value) => String(value ?? '').trim();
const normalizeMobile = (value) => {
  const digits = clean(value).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  if (digits.length >= 12 && digits.startsWith('91')) return digits.slice(-10);
  return digits.length > 10 ? digits.slice(-10) : digits;
};

export async function GET(request) {
  try {
    await ensureSchema();
    const sql = db();
    const search = clean(new URL(request.url).searchParams.get('search'));
    const digits = search.replace(/\D/g, '').slice(-10);

    if (!search) {
      const rows = await sql`
        SELECT id, name, mobile
        FROM customers
        ORDER BY name ASC
        LIMIT 500
      `;
      return json(rows);
    }

    const rows = await sql`
      SELECT id, name, mobile
      FROM customers
      WHERE name ILIKE ${`%${search}%`}
         OR (${digits !== ''} AND mobile ILIKE ${`%${digits}%`})
      ORDER BY name ASC
      LIMIT 100
    `;
    return json(rows);
  } catch (error) {
    console.error('Customer search failed:', error);
    return failure(error.message || 'Customer search failed', 500);
  }
}

export async function POST(request) {
  try {
    await ensureSchema();
    const body = await request.json();
    const name = clean(body?.name);
    const mobile = normalizeMobile(body?.mobile);
    if (!name) return failure('Customer name is required');

    const sql = db();
    const rows = await sql`
      INSERT INTO customers(name, mobile)
      VALUES(${name}, ${mobile})
      ON CONFLICT(lower(name), mobile)
      DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
      RETURNING id, name, mobile
    `;
    return json(rows[0], { status: 201 });
  } catch (error) {
    console.error('Customer save failed:', error);
    return failure(error.message || 'Customer save failed', 500);
  }
}
