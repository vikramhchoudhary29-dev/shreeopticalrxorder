import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sql = await db();
    const rows = await sql`
      SELECT
        order_type,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'received')::int AS received
      FROM orders
      GROUP BY order_type
    `;
    const map = Object.fromEntries(rows.map(r => [r.order_type, r]));
    return NextResponse.json({
      lens: map.lens || { total: 0, pending: 0, received: 0 },
      glass: map.glass || { total: 0, pending: 0, received: 0 }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Unable to load dashboard.' }, { status: 500 });
  }
}
