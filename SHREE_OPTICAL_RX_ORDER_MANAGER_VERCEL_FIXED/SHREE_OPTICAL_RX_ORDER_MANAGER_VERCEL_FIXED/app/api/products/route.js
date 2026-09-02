import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sql = await db();
    const rows = await sql`SELECT * FROM products WHERE active = TRUE ORDER BY name ASC, created_at DESC`;
    return NextResponse.json(rows.map(r => ({ ...r, id: String(r.id) })));
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Unable to load products.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const name = String(body.name || '').trim();
    const brand = String(body.brand || '').trim();
    const category = String(body.category || '').trim();
    if (!name) return NextResponse.json({ error: 'Product name is required.' }, { status: 400 });
    const sql = await db();
    const rows = await sql`INSERT INTO products (name, brand, category) VALUES (${name}, ${brand}, ${category}) RETURNING *`;
    return NextResponse.json({ ...rows[0], id: String(rows[0].id) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Unable to add product.' }, { status: 500 });
  }
}
