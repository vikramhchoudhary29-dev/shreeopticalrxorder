import * as XLSX from 'xlsx';
import { db, ensureSchema, json, failure } from '@/lib/db';

export const runtime = 'nodejs';
const key = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const find = (row, names) => { const k = Object.keys(row).find(x => names.includes(key(x))); return k ? row[k] : ''; };
const cleanName = v => String(v ?? '').trim();
const normalize = v => { const n = String(v ?? '').replace(/\D/g, ''); return n.length >= 10 ? n.slice(-10) : ''; };

export async function POST(req) {
  try {
    await ensureSchema();
    const form = await req.formData();
    const file = form.get('file');
    if (!file) return failure('Select a customer Excel file');
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    if (!rows.length) return failure('No customer rows found');
    const sql = db();
    let imported = 0, skipped = 0, withMobile = 0;
    for (const row of rows) {
      const name = cleanName(find(row, ['name','customername','customer','retailer','retailername','accountname']));
      const mobile = normalize(find(row, ['mobile','mobilenumber','phone','phonenumber','contact','mobileno','phoneno']));
      if (!name) { skipped++; continue; }
      await sql`INSERT INTO customers(name,mobile) VALUES(${name},${mobile}) ON CONFLICT(lower(name),mobile) DO UPDATE SET updated_at=NOW()`;
      imported++;
      if (mobile) withMobile++;
    }
    return json({ imported, skipped, withMobile, withoutMobile: imported - withMobile, total: rows.length });
  } catch (e) { return failure(e.message, 500); }
}
