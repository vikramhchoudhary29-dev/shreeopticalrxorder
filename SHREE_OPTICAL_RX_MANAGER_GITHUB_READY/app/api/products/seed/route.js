import fs from 'node:fs/promises';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { db, ensureSchema, json, failure } from '@/lib/db';

export const runtime = 'nodejs';

const key = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const find = (row, names) => {
  const column = Object.keys(row).find((name) => names.includes(key(name)));
  return column ? row[column] : '';
};

export async function POST() {
  try {
    await ensureSchema();
    const file = await fs.readFile(path.join(process.cwd(), 'data', 'RX_WEP_ACTUAL_PRODUCT_IMPORT.xlsx'));
    const workbook = XLSX.read(file, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
    const sql = db();
    let imported = 0;
    let skipped = 0;

    for (const row of rows) {
      const code = String(find(row, ['itcode'])).trim();
      const lens = String(find(row, ['lenstype'])).trim();
      if (!code || !lens) { skipped++; continue; }

      const fixed = ['productcategory', 'itcode', 'lenstype', 'index', 'lensindex', 'dia', 'diameter', 'powerrange', 'power', 'price', 'baseprice', 'rate', 'coatings', 'coating'];
      const coatings = Object.entries(row)
        .filter(([column, value]) => !fixed.includes(key(column)) && value !== '' && !Number.isNaN(Number(value)))
        .map(([name, price]) => ({ name: String(name).trim(), price: Number(price) }));

      await sql`
        INSERT INTO products(it_code,lens_type,lens_index,dia,power_range,base_price,coatings,extra_data)
        VALUES(${code},${lens},${String(find(row, ['index', 'lensindex']))},${String(find(row, ['dia', 'diameter']))},${String(find(row, ['powerrange', 'power']))},${Number(find(row, ['price', 'baseprice', 'rate'])) || 0},${JSON.stringify(coatings)},${JSON.stringify(row)})
        ON CONFLICT(it_code) DO UPDATE SET
          lens_type=EXCLUDED.lens_type,
          lens_index=EXCLUDED.lens_index,
          dia=EXCLUDED.dia,
          power_range=EXCLUDED.power_range,
          base_price=EXCLUDED.base_price,
          coatings=EXCLUDED.coatings,
          extra_data=EXCLUDED.extra_data,
          updated_at=NOW()`;
      imported++;
    }

    return json({ imported, skipped, total: rows.length });
  } catch (error) {
    console.error(error);
    return failure(error.message || 'Product seed failed', 500);
  }
}
