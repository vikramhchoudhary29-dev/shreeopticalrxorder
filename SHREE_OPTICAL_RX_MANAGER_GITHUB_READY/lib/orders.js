export const statuses = ['Pending', 'Dispatched', 'Received'];

export const glassProducts = [
  'RX WT KT +2.00', 'RX WT KT +3.00', 'RX WT KT +4.00', 'RX WT KT +5.00', 'RX WT KT +6.00',
  'RX PG KT +2.00', 'RX PG KT +3.00', 'RX PG KT +4.00', 'RX PG KT +5.00', 'RX PG KT +6.00',
];

export const prescription = (value) => ({
  sph: String(value?.sph ?? '').trim(),
  cyl: String(value?.cyl ?? '').trim(),
  axis: String(value?.axis ?? '').trim(),
  add: String(value?.add ?? '').trim(),
});

export function normalizeIndianMobile(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  if (digits.length >= 12 && digits.startsWith('91')) return digits;
  return '';
}

export function formatDate(value) {
  if (!value) return '-';
  const text = String(value).slice(0, 10);
  const parts = text.split('-');
  if (parts.length === 3 && parts.every(Boolean)) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return String(value);
}

export function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(date);
}

export function templateFor(type, order, template) {
  const right = order?.right_eye || {};
  const left = order?.left_eye || {};
  const values = {
    order_number: order?.order_number || '',
    order_date: formatDate(order?.order_date),
    ref_name: order?.ref_name || '',
    ref_mobile: order?.ref_mobile || '',
    customer_name: order?.customer_name || '',
    optical_name: order?.optical_name || '',
    it_code: order?.it_code || '',
    lens_type: order?.lens_type || '',
    lens_index: order?.lens_index || '-',
    dia: order?.dia || '-',
    power_range: order?.power_range || '-',
    coating: order?.coating || '-',
    right_sph: right.sph || '-', right_cyl: right.cyl || '-', right_axis: right.axis || '-', right_add: right.add || '-',
    left_sph: left.sph || '-', left_cyl: left.cyl || '-', left_axis: left.axis || '-', left_add: left.add || '-',
    price: order?.price ?? '',
  };
  return String(template || '').replace(/{{\s*([a-z0-9_]+)\s*}}/gi, (_, key) => values[key] ?? '');
}
