import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sql = await db();
    const [productCount, orderCount] = await Promise.all([
      sql`SELECT COUNT(*)::int AS count FROM products`,
      sql`SELECT COUNT(*)::int AS count FROM orders`
    ]);
    return NextResponse.json({
      database: 'connected',
      products: productCount[0]?.count || 0,
      orders: orderCount[0]?.count || 0
    });
  } catch (error) {
    return NextResponse.json({ database: 'error', error: error.message || 'Unable to connect to database.' }, { status: 500 });
  }
}
