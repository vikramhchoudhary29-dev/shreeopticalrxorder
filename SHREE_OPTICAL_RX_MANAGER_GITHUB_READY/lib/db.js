import { neon } from '@neondatabase/serverless';

let ready;
export function db() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured.');
  return neon(process.env.DATABASE_URL);
}

export async function ensureSchema() {
  if (!ready) ready = (async () => {
    const sql = db();
    const statements = [
      `CREATE TABLE IF NOT EXISTS products (id BIGSERIAL PRIMARY KEY, it_code TEXT UNIQUE NOT NULL, lens_type TEXT NOT NULL, lens_index TEXT, dia TEXT, power_range TEXT, base_price NUMERIC(12,2) DEFAULT 0, coatings JSONB DEFAULT '[]'::jsonb, extra_data JSONB DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
      `CREATE TABLE IF NOT EXISTS pricing_rules (id BIGSERIAL PRIMARY KEY, rule_name TEXT UNIQUE NOT NULL, category TEXT, condition TEXT, value NUMERIC(12,2) DEFAULT 0, enabled BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
      `CREATE TABLE IF NOT EXISTS order_counters (kind TEXT PRIMARY KEY, current_value INTEGER NOT NULL DEFAULT 0)`,
      `CREATE TABLE IF NOT EXISTS sizal_orders (id BIGSERIAL PRIMARY KEY, order_number TEXT UNIQUE NOT NULL, order_date DATE NOT NULL DEFAULT CURRENT_DATE, customer_name TEXT NOT NULL, optical_name TEXT NOT NULL, ref_name TEXT, ref_mobile TEXT, it_code TEXT NOT NULL, lens_type TEXT, lens_index TEXT, dia TEXT, power_range TEXT, right_eye JSONB DEFAULT '{}'::jsonb, left_eye JSONB DEFAULT '{}'::jsonb, coating TEXT, price NUMERIC(12,2) DEFAULT 0, status TEXT NOT NULL DEFAULT 'Pending', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
      `CREATE TABLE IF NOT EXISTS glass_rx_orders (id BIGSERIAL PRIMARY KEY, order_number TEXT UNIQUE NOT NULL, order_date DATE NOT NULL DEFAULT CURRENT_DATE, ref_name TEXT, ref_mobile TEXT, it_code TEXT, lens_type TEXT NOT NULL, dia TEXT, right_eye JSONB DEFAULT '{}'::jsonb, left_eye JSONB DEFAULT '{}'::jsonb, status TEXT NOT NULL DEFAULT 'Pending', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
      `CREATE TABLE IF NOT EXISTS customers (id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, mobile TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
      `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT, updated_at TIMESTAMPTZ DEFAULT NOW())`,
      `ALTER TABLE pricing_rules ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT TRUE`,
      `ALTER TABLE sizal_orders ADD COLUMN IF NOT EXISTS ref_name TEXT`,
      `ALTER TABLE sizal_orders ADD COLUMN IF NOT EXISTS ref_mobile TEXT`,
      `ALTER TABLE glass_rx_orders ADD COLUMN IF NOT EXISTS ref_name TEXT`,
      `ALTER TABLE glass_rx_orders ADD COLUMN IF NOT EXISTS ref_mobile TEXT`,
      `CREATE UNIQUE INDEX IF NOT EXISTS customers_name_mobile_key ON customers(lower(name), mobile)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS products_it_code_key_compatible ON products(it_code) WHERE it_code IS NOT NULL`,
      `CREATE UNIQUE INDEX IF NOT EXISTS pricing_rules_rule_name_key_compatible ON pricing_rules(rule_name) WHERE rule_name IS NOT NULL`,
      `CREATE UNIQUE INDEX IF NOT EXISTS sizal_orders_order_number_key_compatible ON sizal_orders(order_number) WHERE order_number IS NOT NULL`,
      `CREATE UNIQUE INDEX IF NOT EXISTS glass_orders_order_number_key_compatible ON glass_rx_orders(order_number) WHERE order_number IS NOT NULL`,
      `INSERT INTO order_counters(kind,current_value) VALUES ('sizal',0),('glass',0) ON CONFLICT (kind) DO NOTHING`,
      `INSERT INTO settings(key,value) VALUES ('whatsapp_number','919876543210') ON CONFLICT (key) DO NOTHING`,
      `INSERT INTO settings(key,value) VALUES ('whatsapp_sizal_template','*ORDER DETAILS*\n\n*Order No:* {{order_number}}\n*Order Date:* {{order_date}}\n*Customer:* {{customer_name}}\n*Optical:* {{optical_name}}\n\n━━━━━━━━━━━━━━\n\n*LENS DETAILS*\n\n*IT Code:* {{it_code}}\n*Lens Type:* {{lens_type}}\n*Index:* {{lens_index}}\n*DIA:* {{dia}}\n\n*RIGHT EYE*\nSPH: {{right_sph}} | CYL: {{right_cyl}} | AXIS: {{right_axis}} | ADD: {{right_add}}\n\n*LEFT EYE*\nSPH: {{left_sph}} | CYL: {{left_cyl}} | AXIS: {{left_axis}} | ADD: {{left_add}}\n\n*Coating:* {{coating}}') ON CONFLICT (key) DO NOTHING`,
      `INSERT INTO settings(key,value) VALUES ('whatsapp_glass_template','*GLASS RX ORDER*\n\n*Order No:* {{order_number}}\n*Order Date:* {{order_date}}\n\n━━━━━━━━━━━━━━\n\n*GLASS DETAILS*\n\n*Lens Type:* {{lens_type}}\n*DIA:* {{dia}}\n\n*RIGHT EYE*\nSPH: {{right_sph}} | CYL: {{right_cyl}} | AXIS: {{right_axis}} | ADD: {{right_add}}\n\n*LEFT EYE*\nSPH: {{left_sph}} | CYL: {{left_cyl}} | AXIS: {{left_axis}} | ADD: {{left_add}}') ON CONFLICT (key) DO NOTHING`
    ];
    for (const s of statements) await sql.query(s);
  })().catch(e => { ready = null; throw e; });
  return ready;
}
export const json = (data, init = {}) => Response.json({ success: true, data }, init);
export const failure = (message, status = 400) => Response.json({ success: false, message }, { status });
