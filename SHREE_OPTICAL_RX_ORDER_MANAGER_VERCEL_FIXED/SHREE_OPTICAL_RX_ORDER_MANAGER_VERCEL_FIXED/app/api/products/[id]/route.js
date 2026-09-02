import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/db';

export async function DELETE(_request, { params }) {
  try {
    const { id } = await params;
    const sql = await db();
    const rows = await sql`DELETE FROM products WHERE id = ${id} RETURNING id`;
    if (!rows.length) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Unable to delete product.' }, { status: 500 });
  }
}
