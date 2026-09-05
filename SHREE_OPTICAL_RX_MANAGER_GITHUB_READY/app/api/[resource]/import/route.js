import * as XLSX from 'xlsx';
import { db, ensureSchema, json, failure } from '@/lib/db';

export const runtime = 'nodejs';

const key = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const find = (row, names) => {
  const column = Object.keys(row).find((name) => names.includes(key(name)));
  return column ? row[column] : '';
};

export async function POST(request, { params }) {
  try {
    await ensureSchema();
    const { resource } = await params;
    if (!['products', 'pricing-rules'].includes(resource)) return failure('Route not found', 404);

    const form = await request.formData();
    const file = form.get('file');
    if (!file) return failure('Select an Excel file');

    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (!rows.length) return failure('No data rows found');

    const sql = db();
    let imported = 0;
    let skipped = 0;

    for (const row of rows) {
      if (resource === 'products') {
        const code = String(find(row, ['itcode'])).trim();
        const lens = String(find(row, ['lenstype', 'productname', 'description'])).trim();
        if (!code || !lens) { skipped++; continue; }

        const fixed = ['productcategory', 'itcode', 'lenstype', 'index', 'lensindex', 'dia', 'diameter', 'powerrange', 'power', 'price', 'baseprice', 'rate', 'coatings', 'coating'];
        const coatings = Object.entries(row)
          .filter(([column, value]) => !fixed.includes(key(column)) && value !== '' && !Number.isNaN(Number(value)))
          .map(([name, price]) => ({ name: String(name).trim(), price: Number(price) }));

        const explicitCoatings = String(find(row, ['coatings', 'coating']));
        if (!coatings.length && explicitCoatings) {
          coatings.push(...explicitCoatings.split(/[,|;]/).map((name) => name.trim()).filter(Boolean).map((name) => ({ name, price: 0 })));
        }

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
      } else {
        const ruleName = String(find(row, ['rulename', 'rule', 'name'])).trim();
        if (!ruleName) { skipped++; continue; }
        const enabledText = String(find(row, ['enabled', 'active'])).trim().toLowerCase();
        const enabled = enabledText ? !['no', 'false', '0', 'disabled'].includes(enabledText) : true;
        await sql`
          INSERT INTO pricing_rules(rule_name,category,condition,value,enabled)
          VALUES(${ruleName},${String(find(row, ['category']))},${String(find(row, ['condition']))},${Number(find(row, ['value', 'amount', 'price'])) || 0},${enabled})
          ON CONFLICT(rule_name) DO UPDATE SET
            category=EXCLUDED.category,
            condition=EXCLUDED.condition,
            value=EXCLUDED.value,
            enabled=EXCLUDED.enabled,
            updated_at=NOW()`;
        imported++;
      }
    }

    return json({ imported, skipped, total: rows.length });
  } catch (error) {
    console.error(error);
    return failure(error.message || 'Import failed', 500);
  }
}
