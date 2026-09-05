import fs from 'node:fs/promises';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { db, ensureSchema, json, failure } from '@/lib/db';

export const runtime = 'nodejs';

const normalizeHeader = (value) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const cleanName = (value) => String(value ?? '').trim();
const cleanMobile = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw || raw.toLowerCase() === 'nan') return '';
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  if (digits.length >= 12 && digits.startsWith('91')) return digits.slice(-10);
  return digits.length > 10 ? digits.slice(-10) : digits;
};

function pick(row, candidates) {
  const wanted = new Set(candidates.map(normalizeHeader));
  const key = Object.keys(row).find((name) => wanted.has(normalizeHeader(name)));
  return key ? row[key] : '';
}

export async function POST() {
  try {
    await ensureSchema();
    const filePath = path.join(process.cwd(), 'data', 'SHREE_OPTICAL_CUSTOMERS.xlsx');
    const file = await fs.readFile(filePath);
    const workbook = XLSX.read(file, { type: 'buffer', cellDates: false, raw: false });

    const rows = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const sheetRows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
      for (const row of sheetRows) {
        const name = cleanName(pick(row, ['Name', 'Account Name', 'Customer Name', 'Retailer Name', 'Retailer', 'Customer']));
        const mobile = cleanMobile(pick(row, ['Mobile', 'Mobile No', 'Mobile Number', 'Phone', 'Phone No', 'Contact', 'Contact Number']));
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
        DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
      `;
      imported += 1;
      if (mobile) withMobile += 1;
    }

    const totals = await sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE mobile <> '')::int AS with_mobile
      FROM customers
    `;

    return json({
      imported,
      withMobile,
      withoutMobile: imported - withMobile,
      rowsRead: rows.length,
      totalInDatabase: Number(totals[0]?.total || 0),
      databaseWithMobile: Number(totals[0]?.with_mobile || 0),
      message: `${imported} supplied customers loaded. ${withMobile} have mobile numbers.`
    });
  } catch (error) {
    console.error('Customer seed failed:', error);
    return failure(error.message || 'Customer seed failed', 500);
  }
}
