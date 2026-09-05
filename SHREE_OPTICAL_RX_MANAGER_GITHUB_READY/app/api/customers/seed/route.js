import fs from 'node:fs/promises';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { db, ensureSchema, json, failure } from '@/lib/db';

export const runtime = 'nodejs';

const cleanName = (value) => String(value ?? '').trim();
const cleanMobile = (value) => String(value ?? '').replace(/\D/g, '').slice(-10);

export async function POST() {
  try {
    await ensureSchema();
    const file = await fs.readFile(path.join(process.cwd(), 'data', 'SHREE_OPTICAL_CUSTOMERS.xlsx'));
    const workbook = XLSX.read(file, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
    const sql = db();
    let imported = 0;
    let withMobile = 0;

    for (const row of rows) {
      const name = cleanName(row.Name);
      if (!name) continue;
      const mobile = cleanMobile(row.Mobile);
      await sql`
        INSERT INTO customers(name,mobile)
        VALUES(${name},${mobile})
        ON CONFLICT(lower(name),mobile) DO UPDATE SET updated_at=NOW()`;
      imported++;
      if (mobile) withMobile++;
    }

    return json({ imported, withMobile, withoutMobile: imported - withMobile, total: rows.length });
  } catch (error) {
    console.error(error);
    return failure(error.message || 'Customer seed failed', 500);
  }
}
