import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/db';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const status = String(body.status || '').trim();
    if (!['pending', 'received'].includes(status)) return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
    const sql = await db();
    const rows = await sql`UPDATE orders SET status = ${status}, updated_at = NOW() WHERE id = ${id} RETURNING *`;
    if (!rows.length) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    return NextResponse.json({ ...rows[0], id: String(rows[0].id) });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Unable to update order.' }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id } = await params;
    const sql = await db();
    const rows = await sql`DELETE FROM orders WHERE id = ${id} RETURNING id`;
    if (!rows.length) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Unable to delete order.' }, { status: 500 });
  }
}
