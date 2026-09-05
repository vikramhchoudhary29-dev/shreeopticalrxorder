import { db, ensureSchema, json, failure } from '@/lib/db';
import { statuses, prescription } from '@/lib/orders';

export const runtime = 'nodejs';

const clean = (value) => String(value ?? '').trim();
const normalizeMobile = (value) => clean(value).replace(/\D/g, '').slice(-10);

function nextNumber(rows, prefix) {
  const number = Number(rows?.[0]?.current_value || 1);
  return `${prefix}${String(number).padStart(2, '0')}`;
}

function maxAbsCyl(order) {
  return Math.max(
    Math.abs(Number(order?.right_eye?.cyl) || 0),
    Math.abs(Number(order?.left_eye?.cyl) || 0)
  );
}

async function priceFor(product, coating, order) {
  const sql = db();
  const rules = await sql`SELECT * FROM pricing_rules WHERE enabled = TRUE ORDER BY rule_name`;
  const selected = (product.coatings || []).find(
    (item) => String(typeof item === 'string' ? item : item.name).toLowerCase() === clean(coating).toLowerCase()
  );

  let price = selected
    ? Number(typeof selected === 'object' ? selected.price : 0)
    : Number(product.base_price || 0);

  const cylRule = rules.find(
    (rule) => /cyl/i.test(rule.rule_name || '') && /above\s*4/i.test(rule.condition || '')
  );
  if (cylRule && maxAbsCyl(order) > 4) {
    price += Number(cylRule.value || 0);
  }

  return price;
}

export async function GET(request, { params }) {
  try {
    await ensureSchema();
    const { resource } = await params;
    const sql = db();
    const query = new URL(request.url).searchParams;

    if (resource === 'dashboard') {
      const [sizal, glass, recent] = await Promise.all([
        sql`SELECT status, COUNT(*)::int AS count FROM sizal_orders GROUP BY status`,
        sql`SELECT status, COUNT(*)::int AS count FROM glass_rx_orders GROUP BY status`,
        sql`SELECT order_number, order_date, lens_type, status, ref_name, 'sizal' AS type, created_at FROM sizal_orders
            UNION ALL
            SELECT order_number, order_date, lens_type, status, ref_name, 'glass' AS type, created_at FROM glass_rx_orders
            ORDER BY created_at DESC LIMIT 10`,
      ]);
      return json({ sizal, glass, recent });
    }

    if (resource === 'products') {
      const code = clean(query.get('itCode'));
      return json(code
        ? await sql`SELECT * FROM products WHERE UPPER(it_code) = UPPER(${code})`
        : await sql`SELECT * FROM products ORDER BY it_code`);
    }

    if (resource === 'pricing-rules') return json(await sql`SELECT * FROM pricing_rules ORDER BY rule_name`);

    if (resource === 'customers') {
      const search = clean(query.get('search'));
      const mobileSearch = String(search).replace(/\D/g, '');
      if (!search) return json(await sql`SELECT id, name, mobile FROM customers ORDER BY name LIMIT 500`);
      return json(await sql`
        SELECT id, name, mobile
        FROM customers
        WHERE name ILIKE ${`%${search}%`}
           OR (${mobileSearch} <> '' AND mobile ILIKE ${`%${mobileSearch.slice(-10)}%`})
        ORDER BY name
        LIMIT 100
      `);
    }

    if (resource === 'sizal-orders') return json(await sql`SELECT * FROM sizal_orders ORDER BY created_at DESC`);
    if (resource === 'glass-rx-orders') return json(await sql`SELECT * FROM glass_rx_orders ORDER BY created_at DESC`);

    if (resource === 'settings') {
      const rows = await sql`SELECT * FROM settings ORDER BY key`;
      return json(Object.fromEntries(rows.map((row) => [row.key, row.value])));
    }

    return failure('Route not found', 404);
  } catch (error) {
    console.error(error);
    return failure(error.message || 'Server error', 500);
  }
}

export async function POST(request, { params }) {
  try {
    await ensureSchema();
    const { resource } = await params;
    const body = await request.json();
    const sql = db();

    if (resource === 'products') {
      const itCode = clean(body.it_code);
      const lensType = clean(body.lens_type);
      if (!itCode || !lensType) return failure('IT Code and Lens Type are required');
      const rows = await sql`
        INSERT INTO products(it_code,lens_type,lens_index,dia,power_range,base_price,coatings,extra_data)
        VALUES(${itCode},${lensType},${clean(body.lens_index)},${clean(body.dia)},${clean(body.power_range)},${Number(body.base_price) || 0},${JSON.stringify(body.coatings || [])},${JSON.stringify(body.extra_data || {})})
        ON CONFLICT(it_code) DO UPDATE SET
          lens_type=EXCLUDED.lens_type,
          lens_index=EXCLUDED.lens_index,
          dia=EXCLUDED.dia,
          power_range=EXCLUDED.power_range,
          base_price=EXCLUDED.base_price,
          coatings=EXCLUDED.coatings,
          extra_data=EXCLUDED.extra_data,
          updated_at=NOW()
        RETURNING *`;
      return json(rows[0]);
    }

    if (resource === 'pricing-rules') {
      const ruleName = clean(body.rule_name);
      if (!ruleName) return failure('Rule name is required');
      const rows = await sql`
        INSERT INTO pricing_rules(rule_name,category,condition,value,enabled)
        VALUES(${ruleName},${clean(body.category)},${clean(body.condition)},${Number(body.value) || 0},${body.enabled !== false})
        ON CONFLICT(rule_name) DO UPDATE SET
          category=EXCLUDED.category,
          condition=EXCLUDED.condition,
          value=EXCLUDED.value,
          enabled=EXCLUDED.enabled,
          updated_at=NOW()
        RETURNING *`;
      return json(rows[0]);
    }

    if (resource === 'customers') {
      const name = clean(body.name);
      const mobile = normalizeMobile(body.mobile);
      if (!name) return failure('Customer name is required');
      const rows = await sql`
        INSERT INTO customers(name,mobile)
        VALUES(${name},${mobile})
        ON CONFLICT(lower(name),mobile) DO UPDATE SET updated_at=NOW()
        RETURNING *`;
      return json(rows[0]);
    }

    if (resource === 'settings') {
      const allowed = new Set(['whatsapp_number', 'whatsapp_sizal_template', 'whatsapp_glass_template']);
      for (const [key, value] of Object.entries(body || {})) {
        if (!allowed.has(key)) continue;
        await sql`
          INSERT INTO settings(key,value,updated_at)
          VALUES(${key},${String(value ?? '')},NOW())
          ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`;
      }
      return json(body);
    }

    if (resource === 'sizal-orders') {
      if (!clean(body.customer_name) || !clean(body.optical_name) || !clean(body.it_code) || !clean(body.ref_name)) {
        return failure('Customer, Optical, Ref. Name and IT Code are required');
      }
      const product = (await sql`SELECT * FROM products WHERE UPPER(it_code)=UPPER(${clean(body.it_code)})`)[0];
      if (!product) return failure('IT Code not found. Please import products first.');

      const counter = await sql`UPDATE order_counters SET current_value=current_value+1 WHERE kind='sizal' RETURNING current_value`;
      const orderNumber = nextNumber(counter, 'SIZAL RX');
      const price = await priceFor(product, body.coating, body);
      const orderDate = clean(body.order_date) || new Date().toISOString().slice(0, 10);

      const rows = await sql`
        INSERT INTO sizal_orders(order_number,order_date,customer_name,optical_name,ref_name,ref_mobile,it_code,lens_type,lens_index,dia,power_range,right_eye,left_eye,coating,price,status)
        VALUES(${orderNumber},${orderDate},${clean(body.customer_name)},${clean(body.optical_name)},${clean(body.ref_name)},${normalizeMobile(body.ref_mobile)},${product.it_code},${product.lens_type},${product.lens_index},${clean(body.dia) || product.dia},${product.power_range},${JSON.stringify(prescription(body.right_eye))},${JSON.stringify(prescription(body.left_eye))},${clean(body.coating)},${price},'Pending')
        RETURNING *`;
      return json(rows[0], { status: 201 });
    }

    if (resource === 'glass-rx-orders') {
      if (!clean(body.lens_type) || !clean(body.ref_name)) return failure('Lens Type and Ref. Name are required');
      const counter = await sql`UPDATE order_counters SET current_value=current_value+1 WHERE kind='glass' RETURNING current_value`;
      const orderNumber = nextNumber(counter, 'GL RX');
      const orderDate = clean(body.order_date) || new Date().toISOString().slice(0, 10);
      const rows = await sql`
        INSERT INTO glass_rx_orders(order_number,order_date,ref_name,ref_mobile,it_code,lens_type,dia,right_eye,left_eye,status)
        VALUES(${orderNumber},${orderDate},${clean(body.ref_name)},${normalizeMobile(body.ref_mobile)},${clean(body.it_code)},${clean(body.lens_type)},${clean(body.dia)},${JSON.stringify(prescription(body.right_eye))},${JSON.stringify(prescription(body.left_eye))},'Pending')
        RETURNING *`;
      return json(rows[0], { status: 201 });
    }

    return failure('Route not found', 404);
  } catch (error) {
    console.error(error);
    return failure(error.message || 'Server error', 500);
  }
}
