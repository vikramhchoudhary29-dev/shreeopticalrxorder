import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';

export const runtime = 'edge';

export async function GET() {
  try {
    const sql = await db();
    await sql`SELECT 1 AS ok`;
    return NextResponse.json({ ok: true, message: 'Database connected successfully' });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
