import fs from 'node:fs/promises';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { db, ensureSchema, json, failure } from '@/lib/db';

export const runtime = 'nodejs';

const key = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const findValue = (row, names) => {
  const wanted = new Set(names.map(key));
  const column = Object.keys(row).find((name) => wanted.has(key(name)));
  return column ? row[column] : '';
};
const cleanName = (value) => String(value ?? '').trim();
const cleanMobile = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length >= 10 ? digits.slice(-10) : '';
};

export async function POST() {
  try {
    await ensureSchema();

    const filePath = path.join(process.cwd(), 'data', 'SHREE_OPTICAL_CUSTOMERS.xlsx');
    const file = await fs.readFile(filePath);
    const workbook = XLSX.read(file, { type: 'buffer', cellDates: false });
    const rows = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const sheetRows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
      for (const row of sheetRows) {
        const name = cleanName(findValue(row, ['Name', 'Account Name', 'Customer Name', 'Retailer Name', 'Retailer', 'Customer']));
        const mobile = cleanMobile(findValue(row, ['Mobile', 'Mobile No', 'Mobile Number', 'Phone', 'Phone No', 'Contact', 'Contact Number']));
        if (name) rows.push({ name, mobile });
      }
    }

    const unique = new Map();
    for (const row of rows) unique.set(`${row.name.toLowerCase()}|${row.mobile}`, row);

    const sql = db();
    let imported = 0;
    let withMobile = 0;

    for (const { name, mobile } of unique.values()) {
      await sql`
        INSERT INTO customers(name, mobile)
        VALUES(${name}, ${mobile})
        ON CONFLICT(lower(name), mobile)
        DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()`;
      imported++;
      if (mobile) withMobile++;
    }

    const countRows = await sql`SELECT COUNT(*)::int AS count FROM customers`;
    const mobileRows = await sql`SELECT COUNT(*)::int AS count FROM customers WHERE mobile <> ''`;

    return json({
      imported,
      withMobile,
      withoutMobile: imported - withMobile,
      totalInFile: rows.length,
      totalInDatabase: Number(countRows[0]?.count || 0),
      databaseWithMobile: Number(mobileRows[0]?.count || 0),
    });
  } catch (error) {
    console.error('Customer seed failed:', error);
    return failure(error.message || 'Customer seed failed', 500);
  }
}
