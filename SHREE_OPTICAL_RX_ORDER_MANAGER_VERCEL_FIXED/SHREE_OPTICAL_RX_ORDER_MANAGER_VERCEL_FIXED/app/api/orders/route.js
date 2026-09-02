import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

function clean(value) { return value == null ? '' : String(value).trim(); }

export async function GET() {
  try {
    const sql = await db();
    const rows = await sql`SELECT * FROM orders ORDER BY created_at DESC`;
    return NextResponse.json(rows.map(r => ({ ...r, id: String(r.id) })));
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Unable to load orders.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const order_type = clean(body.order_type);
    const customer_name = clean(body.customer_name);
    const phone = clean(body.phone);
    const product_name = clean(body.product_name);
    const right_sph = clean(body.right_sph);
    const right_cyl = clean(body.right_cyl);
    const right_axis = clean(body.right_axis);
    const left_sph = clean(body.left_sph);
    const left_cyl = clean(body.left_cyl);
    const left_axis = clean(body.left_axis);
    const notes = clean(body.notes);
    const status = clean(body.status) || 'pending';

    if (!customer_name) return NextResponse.json({ error: 'Customer name is required.' }, { status: 400 });
    if (!['lens', 'glass'].includes(order_type)) return NextResponse.json({ error: 'Invalid order type.' }, { status: 400 });
    if (!['pending', 'received'].includes(status)) return NextResponse.json({ error: 'Invalid order status.' }, { status: 400 });

    const sql = await db();
    const rows = await sql`
      INSERT INTO orders (
        order_type, customer_name, phone, product_name,
        right_sph, right_cyl, right_axis,
        left_sph, left_cyl, left_axis,
        notes, status
      ) VALUES (
        ${order_type}, ${customer_name}, ${phone}, ${product_name},
        ${right_sph}, ${right_cyl}, ${right_axis},
        ${left_sph}, ${left_cyl}, ${left_axis},
        ${notes}, ${status}
      ) RETURNING *
    `;
    return NextResponse.json({ ...rows[0], id: String(rows[0].id) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Unable to save order.' }, { status: 500 });
  }
}
