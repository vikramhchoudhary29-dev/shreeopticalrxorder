'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  formatDate,
  formatDateTime,
  glassProducts,
  normalizeIndianMobile,
  prescription,
  statuses,
  templateFor,
} from '@/lib/orders';

const api = async (path, options = {}) => {
  const response = await fetch(`/api/${path}`, options);
  const payload = await response.json().catch(() => ({
    success: false,
    message: `Server returned ${response.status}`,
  }));
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || 'Request failed');
  }
  return payload.data;
};

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const blankEye = { sph: '', cyl: '', axis: '', add: '' };

function Field({ label, value, set, type = 'text', required = false, placeholder = '' }) {
  return (
    <label>
      {label}
      <input
        type={type}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => set(e.target.value)}
        required={required}
      />
    </label>
  );
}

function Badge({ value }) {
  return <span className={`badge ${String(value).toLowerCase()}`}>{value}</span>;
}

function Stat({ title, data }) {
  const counts = Object.fromEntries((data || []).map((row) => [row.status, row.count]));
  const total = (data || []).reduce((sum, row) => sum + Number(row.count || 0), 0);
  return (
    <article className="stat">
      <div className="stat-top"><p>{title}</p><span>LIVE</span></div>
      <strong>{total}</strong>
      <div className="stat-status">
        <span>Pending <b>{counts.Pending || 0}</b></span>
        <span>Dispatched <b>{counts.Dispatched || 0}</b></span>
        <span>Received <b>{counts.Received || 0}</b></span>
      </div>
    </article>
  );
}

export default function App() {
  const [page, setPage] = useState('Dashboard');
  const [dash, setDash] = useState({ sizal: [], glass: [], recent: [] });
  const [orders, setOrders] = useState({ sizal: [], glass: [] });
  const [settings, setSettings] = useState({});
  const [products, setProducts] = useState([]);
  const [rules, setRules] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [popup, setPopup] = useState(null);
  const [view, setView] = useState(null);

  const load = async () => {
    try {
      const [d, s, g, st, p, r, c] = await Promise.all([
        api('dashboard'),
        api('sizal-orders'),
        api('glass-rx-orders'),
        api('settings'),
        api('products'),
        api('pricing-rules'),
        api('customers'),
      ]);
      setDash(d);
      setOrders({ sizal: s, glass: g });
      setSettings(st);
      setProducts(p);
      setRules(r);
      setCustomers(c);
    } catch (error) {
      setNotice(error.message);
    }
  };

  useEffect(() => { load(); }, []);

  const go = (nextPage) => {
    setPage(nextPage);
    if (typeof window !== 'undefined' && window.innerWidth < 801) {
      document.querySelector('nav')?.classList.remove('open');
    }
  };

  const save = async (fn, success, after) => {
    setBusy(true);
    try {
      const data = await fn();
      setNotice(success);
      await load();
      after?.(data);
      return data;
    } catch (error) {
      setNotice(error.message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const createOrder = async (type, data) => {
    setBusy(true);
    try {
      const created = await api(type === 'sizal' ? 'sizal-orders' : 'glass-rx-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      await load();
      setPopup({ type, order: created });
      return created;
    } catch (error) {
      setNotice(error.message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const nav = [
    'Dashboard',
    'Create SIZAL RX Order',
    'Create Glass RX Order',
    'All Orders',
    'Products / Import Products',
    'Pricing Rules',
    'Settings',
  ];

  return (
    <main>
      <header>
        <div className="brand">
          <img src="/shree-optical-logo.png" alt="Shree Optical" />
          <div>
            <h1>Shree Optical <span>RX Order Manager</span></h1>
            <small>By Vikram Choudhary · <a href="https://arvikdigital.in" target="_blank" rel="noreferrer">arvikdigital.in</a></small>
          </div>
        </div>
        <button className="mobile-nav" onClick={() => document.querySelector('nav')?.classList.toggle('open')} aria-label="Open navigation">☰</button>
      </header>

      <div className="shell">
        <nav>
          {nav.map((item, index) => (
            <button key={item} className={page === item ? 'active' : ''} onClick={() => go(item)}>
              <span className="nav-icon">{['⌂', '＋', '＋', '▤', '▦', '₹', '⚙'][index]}</span>
              {item}
            </button>
          ))}
        </nav>

        <section className="content">
          {notice && <div className="notice">{notice}<button onClick={() => setNotice('')} aria-label="Close notification">×</button></div>}
          {busy && <div className="saving">Saving…</div>}

          {page === 'Dashboard' && <Dashboard data={dash} go={go} />}
          {page === 'Create SIZAL RX Order' && <Sizal products={products} customers={customers} create={createOrder} />}
          {page === 'Create Glass RX Order' && <Glass customers={customers} create={createOrder} />}
          {page === 'All Orders' && (
            <Orders
              data={orders}
              settings={settings}
              update={(type, id, status) => save(
                () => api(`${type === 'sizal' ? 'sizal-orders' : 'glass-rx-orders'}/${id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status }),
                }),
                'Order status updated.'
              )}
              remove={(type, id) => {
                if (window.confirm('Delete this order? This cannot be undone.')) {
                  save(() => api(`${type === 'sizal' ? 'sizal-orders' : 'glass-rx-orders'}/${id}`, { method: 'DELETE' }), 'Order deleted.');
                }
              }}
              view={setView}
            />
          )}
          {page === 'Products / Import Products' && <ProductManager items={products} save={save} />}
          {page === 'Pricing Rules' && <RuleManager items={rules} save={save} />}
          {page === 'Settings' && <Settings initial={settings} save={save} />}
        </section>
      </div>

      {popup && <SharePopup data={popup} settings={settings} close={() => setPopup(null)} />}
      {view && <OrderModal type={view.type} order={view.order} close={() => setView(null)} settings={settings} />}
    </main>
  );
}

function Dashboard({ data, go }) {
  return (
    <>
      <div className="title hero-title">
        <div>
          <div className="eyebrow">SHREE OPTICAL · CONTROL CENTER</div>
          <h2>Good business starts with clean orders.</h2>
          <p>Track SIZAL and Glass RX workflow from one shared Neon database.</p>
        </div>
        <div className="quick-actions">
          <button onClick={() => go('Create SIZAL RX Order')}>+ SIZAL RX</button>
          <button onClick={() => go('Create Glass RX Order')}>+ Glass RX</button>
        </div>
      </div>

      <div className="stats">
        <Stat title="SIZAL / Lens RX Orders" data={data.sizal} />
        <Stat title="Glass RX Orders" data={data.glass} />
      </div>

      <div className="panel">
        <div className="panel-head">
          <div><h3>Recent orders</h3><p>Latest activity across both order systems.</p></div>
          <button className="text-btn" onClick={() => go('All Orders')}>View all →</button>
        </div>
        {data.recent?.length ? (
          <table>
            <thead><tr><th>Order</th><th>Date</th><th>Ref. Name</th><th>Lens Type</th><th>Status</th></tr></thead>
            <tbody>
              {data.recent.map((order) => (
                <tr key={`${order.type}-${order.order_number}`}>
                  <td><b>{order.order_number}</b><small>{order.type === 'sizal' ? 'SIZAL / Lens' : 'Glass RX'}</small></td>
                  <td>{formatDate(order.order_date)}</td>
                  <td>{order.ref_name || '-'}</td>
                  <td>{order.lens_type || '-'}</td>
                  <td><Badge value={order.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <Empty text="No orders yet. Create your first RX order." />}
      </div>
    </>
  );
}

function CustomerPicker({ customers, value, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [remote, setRemote] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const selected = customers.find((customer) => String(customer.id) === String(value?.id)) ||
    remote.find((customer) => String(customer.id) === String(value?.id));

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) {
      setRemote([]);
      setSearchError('');
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError('');
      try {
        const result = await api(`customers?search=${encodeURIComponent(q)}`);
        if (!cancelled) setRemote(Array.isArray(result) ? result : []);
      } catch (error) {
        if (!cancelled) {
          setRemote([]);
          setSearchError(error.message || 'Unable to search customers');
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 120);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, open]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const source = q ? remote : customers;
    return source
      .filter((customer) => !q || `${customer.name || ''} ${customer.mobile || ''}`.toLowerCase().includes(q))
      .slice(0, 20);
  }, [customers, remote, query]);

  return (
    <label className="picker">
      Ref. Name
      <div className="picker-wrap">
        <input
          required
          value={selected?.name || query}
          placeholder="Search retailer / customer…"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            onChange(null);
            setOpen(true);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 220)}
        />
        {open && (
          <div className="picker-menu">
            {searching ? <div className="picker-empty">Searching customers…</div> : searchError ? <div className="picker-empty">{searchError}</div> : list.length ? list.map((customer) => (
              <button
                type="button"
                key={customer.id}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(customer);
                  setQuery('');
                  setRemote([]);
                  setOpen(false);
                }}
              >
                <b>{customer.name}</b>
                <span>{customer.mobile || 'No mobile'}</span>
              </button>
            )) : <div className="picker-empty">No customer found</div>}
          </div>
        )}
      </div>
      {selected && <small>WhatsApp: {selected.mobile || 'No mobile number'}</small>}
    </label>
  );
}

function EyeFields({ value, onChange }) {
  return (
    <div className="eye-grid">
      {['sph', 'cyl', 'axis', 'add'].map((key) => (
        <label key={key}>
          {key.toUpperCase()}
          <input
            inputMode={key === 'axis' ? 'numeric' : 'decimal'}
            value={value?.[key] || ''}
            onChange={(event) => onChange({ ...value, [key]: event.target.value })}
          />
        </label>
      ))}
    </div>
  );
}

function Eyes({ form, setForm }) {
  return (
    <div className="eyes">
      <div className="eye-card">
        <div className="eye-title"><span>R</span><h3>Right Eye</h3></div>
        <EyeFields value={form.right_eye} onChange={(right_eye) => setForm({ ...form, right_eye })} />
      </div>
      <div className="eye-card">
        <div className="eye-title"><span>L</span><h3>Left Eye</h3></div>
        <EyeFields value={form.left_eye} onChange={(left_eye) => setForm({ ...form, left_eye })} />
      </div>
    </div>
  );
}

function Sizal({ products, customers, create }) {
  const [form, setForm] = useState({
    order_date: today(), customer_name: '', optical_name: '', ref_id: '', ref_name: '', ref_mobile: '',
    it_code: '', coating: '', dia: '', right_eye: { ...blankEye }, left_eye: { ...blankEye },
  });

  const product = products.find((item) => String(item.it_code).toLowerCase() === form.it_code.trim().toLowerCase());
  const coatings = product?.coatings || [];
  const selectedCoating = coatings.find((item) => String(typeof item === 'string' ? item : item.name) === form.coating);
  const displayedPrice = product
    ? Number(typeof selectedCoating === 'object' ? selectedCoating.price : 0) || Number(product.base_price || 0)
    : 0;

  const submit = (event) => {
    event.preventDefault();
    if (!product) return;
    create('sizal', { ...form, right_eye: prescription(form.right_eye), left_eye: prescription(form.left_eye) });
  };

  return (
    <form className="form" onSubmit={submit}>
      <div className="title"><div className="eyebrow">NEW ORDER</div><h2>Create SIZAL RX Order</h2><p>Select the retailer in Ref. Name to enable customer sharing after creation.</p></div>

      <div className="form-grid four">
        <Field label="Order Date" type="date" value={form.order_date} set={(v) => setForm({ ...form, order_date: v })} required />
        <CustomerPicker customers={customers} value={form.ref_id ? { id: form.ref_id } : null} onChange={(customer) => setForm({ ...form, ref_id: customer?.id || '', ref_name: customer?.name || '', ref_mobile: customer?.mobile || '' })} />
        <Field label="Customer Name" value={form.customer_name} set={(v) => setForm({ ...form, customer_name: v })} required />
        <Field label="Optical Name" value={form.optical_name} set={(v) => setForm({ ...form, optical_name: v })} required />
      </div>

      <div className="form-grid four">
        <Field label="IT Code" value={form.it_code} set={(v) => setForm({ ...form, it_code: v })} required placeholder="e.g. SRED01" />
        <Field label="DIA" value={form.dia} set={(v) => setForm({ ...form, dia: v })} placeholder="Enter DIA if required" />
        <div className="info-field"><span>Lens Type</span><b>{product?.lens_type || '—'}</b></div>
        <div className="info-field"><span>Index / Power Range</span><b>{product ? `${product.lens_index || '-'} · ${product.power_range || '-'}` : '—'}</b></div>
      </div>

      {form.it_code && (
        <div className={product ? 'product-found' : 'product-missing'}>
          {product ? <><b>Product found</b><span>{product.it_code} · {product.lens_type} · Index {product.lens_index || '-'} · Power {product.power_range || '-'}</span></> : 'IT Code not found. Import the product file before creating this order.'}
        </div>
      )}

      {product && (
        <>
          <div className="form-grid two">
            <label>
              Coating
              <select required value={form.coating} onChange={(event) => setForm({ ...form, coating: event.target.value })}>
                <option value="">Select coating</option>
                {coatings.map((item) => {
                  const coating = typeof item === 'string' ? { name: item, price: 0 } : item;
                  return <option key={coating.name} value={coating.name}>{coating.name}{coating.price ? ` — ₹${Number(coating.price).toLocaleString('en-IN')}` : ''}</option>;
                })}
              </select>
            </label>
            <div className="price"><span>Calculated Price</span><strong>₹{displayedPrice.toLocaleString('en-IN')}</strong></div>
          </div>
          <Eyes form={form} setForm={setForm} />
          <button className="primary large">Create SIZAL Order</button>
        </>
      )}
    </form>
  );
}

function Glass({ customers, create }) {
  const [form, setForm] = useState({ order_date: today(), lens_type: glassProducts[0], dia: '', right_eye: { ...blankEye }, left_eye: { ...blankEye }, ref_id: '', ref_name: '', ref_mobile: '', it_code: '' });

  const submit = (event) => {
    event.preventDefault();
    create('glass', { ...form, right_eye: prescription(form.right_eye), left_eye: prescription(form.left_eye) });
  };

  return (
    <form className="form" onSubmit={submit}>
      <div className="title"><div className="eyebrow">NEW ORDER</div><h2>Create Glass RX Order</h2><p>Choose the retailer in Ref. Name. Customer and optical names are intentionally not collected.</p></div>
      <div className="form-grid three">
        <Field label="Order Date" type="date" value={form.order_date} set={(v) => setForm({ ...form, order_date: v })} required />
        <CustomerPicker customers={customers} value={form.ref_id ? { id: form.ref_id } : null} onChange={(customer) => setForm({ ...form, ref_id: customer?.id || '', ref_name: customer?.name || '', ref_mobile: customer?.mobile || '' })} />
        <label>Lens Type<select value={form.lens_type} onChange={(event) => setForm({ ...form, lens_type: event.target.value, it_code: event.target.value.replace(' KT', '') })}>{glassProducts.map((item) => <option key={item}>{item}</option>)}</select></label>
      </div>
      <div className="form-grid one"><Field label="DIA" value={form.dia} set={(v) => setForm({ ...form, dia: v })} /></div>
      <Eyes form={form} setForm={setForm} />
      <button className="primary large">Create Glass RX Order</button>
    </form>
  );
}

function Orders({ data, settings, update, remove, view }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const matches = (order) => {
    const needle = search.trim().toLowerCase();
    return (!needle || JSON.stringify(order).toLowerCase().includes(needle)) && (filter === 'All' || order.status === filter);
  };

  const List = ({ items, type }) => {
    const filtered = items.filter(matches);
    return (
      <div className="panel orders">
        <div className="panel-head"><div><h3>{type === 'sizal' ? 'SIZAL / Lens RX Orders' : 'Glass RX Orders'}</h3><p>{filtered.length} matching orders</p></div></div>
        {filtered.length ? (
          <table>
            <thead><tr><th>Order</th><th>Order Date</th><th>Ref. Name</th><th>{type === 'sizal' ? 'Customer / Optical' : 'Lens Type'}</th><th>Updated</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map((order) => (
                <tr key={order.id}>
                  <td><b>{order.order_number}</b><small>{type === 'sizal' ? 'SIZAL' : 'Glass RX'}</small></td>
                  <td>{formatDate(order.order_date)}</td>
                  <td><b>{order.ref_name || '-'}</b><small>{order.ref_mobile || 'No mobile'}</small></td>
                  <td>{type === 'sizal' ? <>{order.customer_name}<small>{order.optical_name}</small></> : order.lens_type}</td>
                  <td>{formatDateTime(order.updated_at)}</td>
                  <td><select className="status-select" value={order.status} onChange={(event) => update(type, order.id, event.target.value)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></td>
                  <td className="actions">
                    <button onClick={() => view({ type, order })}>View Order</button>
                    <button onClick={() => shareOrder(type, order, settings, false)}>Mumbai Office</button>
                    <button onClick={() => printOrder(type, order)}>Print</button>
                    <button className="danger" onClick={() => remove(type, order.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <Empty text="No matching orders." />}
      </div>
    );
  };

  return (
    <>
      <div className="title split">
        <div><div className="eyebrow">ORDER HISTORY</div><h2>All Orders</h2><p>One history with separate SIZAL and Glass RX sections.</p></div>
        <div className="filters"><input placeholder="Search order, ref. name, customer, IT code…" value={search} onChange={(e) => setSearch(e.target.value)} /><select value={filter} onChange={(e) => setFilter(e.target.value)}><option>All</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select></div>
      </div>
      <List items={data.sizal} type="sizal" />
      <List items={data.glass} type="glass" />
    </>
  );
}

function SharePopup({ data, settings, close }) {
  const { type, order } = data;
  const template = settings[type === 'sizal' ? 'whatsapp_sizal_template' : 'whatsapp_glass_template'];
  const message = templateFor(type, order, template);
  const customerNumber = normalizeIndianMobile(order.ref_mobile);
  const officeNumber = normalizeIndianMobile(settings.whatsapp_number);

  return (
    <div className="modal-backdrop">
      <div className="share-card">
        <div className="success-icon">✓</div>
        <h2>{order.order_number} created</h2>
        <p>{order.ref_name ? `Ref. Name: ${order.ref_name}` : 'Order saved successfully.'}</p>
        <div className="share-buttons">
          <button className="share-customer" disabled={!customerNumber} onClick={() => openWhatsApp(customerNumber, message)}>
            Share to Customer
            <small>{customerNumber ? order.ref_name : 'No mobile number for this retailer'}</small>
          </button>
          <button disabled={!officeNumber} onClick={() => openWhatsApp(officeNumber, message)}>
            Mumbai Office
            <small>{settings.whatsapp_number || 'Set the office number in Settings'}</small>
          </button>
          <button className="close-btn" onClick={close}>Close</button>
        </div>
      </div>
    </div>
  );
}

function OrderModal({ type, order, close, settings }) {
  const right = order.right_eye || {};
  const left = order.left_eye || {};
  return (
    <div className="modal-backdrop">
      <div className="view-card">
        <div className="modal-head"><div><div className="eyebrow">ORDER DETAILS</div><h2>{order.order_number}</h2></div><button onClick={close}>×</button></div>
        <div className="detail-grid">
          <Detail label="Order Date" value={formatDate(order.order_date)} />
          <Detail label="Ref. Name" value={order.ref_name ? `${order.ref_name}${order.ref_mobile ? ` · ${order.ref_mobile}` : ''}` : '-'} />
          {type === 'sizal' && <><Detail label="Customer" value={order.customer_name} /><Detail label="Optical" value={order.optical_name} /><Detail label="IT Code" value={order.it_code} /><Detail label="Index" value={order.lens_index} /><Detail label="Power Range" value={order.power_range} /><Detail label="Coating" value={order.coating} /><Detail label="Price" value={`₹${Number(order.price || 0).toLocaleString('en-IN')}`} /></>}
          <Detail label="Lens Type" value={order.lens_type} />
          <Detail label="DIA" value={order.dia || '-'} />
          <Detail label="Status" value={order.status} />
          <Detail label="Last Updated" value={formatDateTime(order.updated_at)} />
          <Detail label="Created" value={formatDateTime(order.created_at)} />
        </div>
        <div className="prescription-view"><EyeRead title="Right Eye" data={right} /><EyeRead title="Left Eye" data={left} /></div>
        <div className="modal-actions">
          <button className="primary" onClick={() => shareOrder(type, order, settings, false)}>Share to Mumbai Office</button>
          <button onClick={() => printOrder(type, order)}>Print A5</button>
          <button onClick={close}>Close</button>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }) {
  return <div><span>{label}</span><b>{value || '-'}</b></div>;
}

function EyeRead({ title, data }) {
  return <div><h3>{title}</h3><p><b>SPH</b> {data.sph || '-'} <b>CYL</b> {data.cyl || '-'} <b>AXIS</b> {data.axis || '-'} <b>ADD</b> {data.add || '-'}</p></div>;
}

function ProductManager({ items, save }) {
  const [file, setFile] = useState(null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const filtered = items.filter((item) => `${item.it_code} ${item.lens_type} ${item.power_range}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <div className="title"><div className="eyebrow">CATALOG</div><h2>Products / Import Products</h2><p>Import your supplied product workbook. Coating columns are stored as coating prices in Neon.</p></div>
      <div className="import-grid">
        <form className="upload panel" onSubmit={(event) => { event.preventDefault(); if (!file) return; save(async () => { const form = new FormData(); form.append('file', file); return api('products/import', { method: 'POST', body: form }); }, 'Product import completed.'); }}>
          <h3>Import Excel</h3><p>Supports .xlsx and .xls product workbooks.</p><input type="file" accept=".xlsx,.xls" onChange={(event) => setFile(event.target.files[0])} /><button className="primary">Import selected Excel</button>
        </form>
        <div className="upload panel"><h3>Load supplied product file</h3><p>The latest supplied RX WEP product workbook is bundled with this version.</p><button className="primary" onClick={() => save(() => api('products/seed', { method: 'POST' }), 'Supplied product file loaded into Neon.')}>Load supplied file into Neon</button></div>
      </div>
      <div className="panel">
        <div className="panel-head"><div><h3>Products</h3><p>{items.length} products currently saved in the shared database.</p></div><input style={{ maxWidth: 320 }} placeholder="Search IT code or lens type…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        {filtered.length ? <table><thead><tr><th>IT Code</th><th>Lens Type</th><th>Index</th><th>Power Range</th><th>Coatings</th><th></th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><b>{item.it_code}</b></td><td>{item.lens_type}</td><td>{item.lens_index || '-'}</td><td>{item.power_range || '-'}</td><td>{(item.coatings || []).map((coating) => typeof coating === 'string' ? coating : coating.name).join(' · ') || '-'}</td><td><button onClick={() => setEditing(item)}>Edit</button></td></tr>)}</tbody></table> : <Empty text="No products found." />}
      </div>
      {editing && <ProductEdit product={editing} close={() => setEditing(null)} save={save} />}
    </>
  );
}

function ProductEdit({ product, close, save }) {
  const [form, setForm] = useState(product);
  return (
    <div className="modal-backdrop"><div className="view-card"><div className="modal-head"><div><div className="eyebrow">PRODUCT</div><h2>Edit {product.it_code}</h2></div><button onClick={close}>×</button></div>
      <div className="form-grid two"><Field label="Lens Type" value={form.lens_type} set={(v) => setForm({ ...form, lens_type: v })} /><Field label="Index" value={form.lens_index} set={(v) => setForm({ ...form, lens_index: v })} /><Field label="DIA" value={form.dia} set={(v) => setForm({ ...form, dia: v })} /><Field label="Power Range" value={form.power_range} set={(v) => setForm({ ...form, power_range: v })} /></div>
      <div className="modal-actions"><button className="primary" onClick={() => save(() => api(`products/${product.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }), 'Product updated.', close)}>Save changes</button><button onClick={close}>Cancel</button></div>
    </div></div>
  );
}

function RuleManager({ items, save }) {
  const blank = { rule_name: '', category: '', condition: '', value: '', enabled: true };
  const [editing, setEditing] = useState(null);
  const form = editing || blank;
  const set = (key, value) => setEditing({ ...form, [key]: value });

  return (
    <>
      <div className="title"><div className="eyebrow">PRICING ENGINE</div><h2>Pricing Rules</h2><p>Manage special charges and validation rules shared across devices.</p></div>
      <div className="panel rule-form"><h3>{editing ? 'Edit rule' : 'Add rule'}</h3><div className="form-grid four"><Field label="Rule Name" value={form.rule_name} set={(v) => set('rule_name', v)} required /><Field label="Category" value={form.category} set={(v) => set('category', v)} /><Field label="Condition" value={form.condition} set={(v) => set('condition', v)} /><Field label="Value" value={form.value} set={(v) => set('value', v)} /></div><div className="row-actions"><label className="toggle"><input type="checkbox" checked={form.enabled !== false} onChange={(e) => set('enabled', e.target.checked)} /> Enabled</label><button className="primary" onClick={() => save(() => api(editing?.id ? `pricing-rules/${editing.id}` : 'pricing-rules', { method: editing?.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }), 'Pricing rule saved.', () => setEditing(null))}>{editing ? 'Save changes' : 'Add pricing rule'}</button>{editing && <button onClick={() => setEditing(null)}>Cancel</button>}</div></div>
      <div className="panel"><h3>Saved rules ({items.length})</h3>{items.length ? <table><thead><tr><th>Rule</th><th>Category</th><th>Condition</th><th>Value</th><th>Enabled</th><th></th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><b>{item.rule_name}</b></td><td>{item.category}</td><td>{item.condition}</td><td>₹{Number(item.value || 0).toLocaleString('en-IN')}</td><td><Badge value={item.enabled === false ? 'Disabled' : 'Enabled'} /></td><td><button onClick={() => setEditing(item)}>Edit</button></td></tr>)}</tbody></table> : <Empty text="No pricing rules imported yet." />}</div>
    </>
  );
}

function Settings({ initial, save }) {
  const [form, setForm] = useState(initial);
  const [customerFile, setCustomerFile] = useState(null);
  const [customerImportResult, setCustomerImportResult] = useState(null);
  useEffect(() => setForm(initial), [initial]);
  const tokens = '{{order_number}}, {{order_date}}, {{ref_name}}, {{ref_mobile}}, {{customer_name}}, {{optical_name}}, {{it_code}}, {{lens_type}}, {{lens_index}}, {{dia}}, {{power_range}}, {{coating}}, {{right_sph}}, {{right_cyl}}, {{right_axis}}, {{right_add}}, {{left_sph}}, {{left_cyl}}, {{left_axis}}, {{left_add}}, {{price}}';

  const saveSettings = () => save(() => api('settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }), 'Settings saved successfully.');

  return (
    <>
      <div className="title"><div className="eyebrow">SYSTEM SETTINGS</div><h2>Settings</h2><p>WhatsApp numbers and message templates are shared through Neon and apply on every device.</p></div>
      <div className="panel settings">
        <div className="settings-section"><h3>WhatsApp numbers</h3><Field label="Mumbai office / Admin WhatsApp number" value={form.whatsapp_number || ''} set={(v) => setForm({ ...form, whatsapp_number: v })} placeholder="919876543210" /><small>Use a 10-digit Indian mobile number or include the country code.</small></div>
        <div className="settings-section"><h3>SIZAL WhatsApp template</h3><p className="hint">Edit this message anytime. The template controls exactly what is sent to the retailer and Mumbai office.</p><textarea value={form.whatsapp_sizal_template || ''} onChange={(e) => setForm({ ...form, whatsapp_sizal_template: e.target.value })} /></div>
        <div className="settings-section"><h3>Glass RX WhatsApp template</h3><p className="hint">Edit this message independently from the SIZAL template.</p><textarea value={form.whatsapp_glass_template || ''} onChange={(e) => setForm({ ...form, whatsapp_glass_template: e.target.value })} /></div>
        <div className="token-box"><b>Available placeholders</b><p>{tokens}</p></div>
        <button className="primary large" onClick={saveSettings}>Save Settings</button>
      </div>

      <div className="panel">
        <div className="panel-head"><div><h3>Retailer / Ref. Name Customers</h3><p>Only customer name and mobile number are imported. All other Excel columns are ignored.</p></div></div>
        <div className="import-grid">
          <form className="upload" onSubmit={(event) => { event.preventDefault(); if (!customerFile) return; save(async () => { const data = new FormData(); data.append('file', customerFile); return api('customers/import', { method: 'POST', body: data }); }, 'Customer import completed.'); }}><h4>Import customer Excel</h4><input type="file" accept=".xlsx,.xls" onChange={(event) => setCustomerFile(event.target.files[0])} /><button className="primary">Import Customers</button></form>
          <div className="upload"><h4>Load supplied customer master</h4><p>The bundled master imports only Name + Mobile and ignores every other Excel column.</p><button className="primary" onClick={() => save(() => api('customers/seed', { method: 'POST' }), 'Customer master loaded successfully. Check the import count in the notification.')}>Load supplied customers</button></div>
        </div>
        <small>Stored fields: Name + Mobile only.</small>{customerImportResult && <div className="import-result"><b>{customerImportResult.imported} supplied customers loaded</b><span>{customerImportResult.withMobile} with mobile · {customerImportResult.withoutMobile} without mobile · {customerImportResult.totalInDatabase} total in Neon</span></div>}
      </div>
    </>
  );
}

function Empty({ text }) { return <p className="empty">{text}</p>; }

function openWhatsApp(number, message) {
  const normalized = normalizeIndianMobile(number);
  if (!normalized) {
    window.alert('No valid WhatsApp number is configured for this destination.');
    return;
  }
  const url = `https://wa.me/${normalized}?text=${encodeURIComponent(message || '')}`;
  const popup = window.open(url, '_blank', 'noopener,noreferrer');
  if (!popup) window.location.href = url;
}

function shareOrder(type, order, settings, customer) {
  const number = customer ? order.ref_mobile : settings.whatsapp_number;
  const template = settings[type === 'sizal' ? 'whatsapp_sizal_template' : 'whatsapp_glass_template'];
  openWhatsApp(number, templateFor(type, order, template));
}

function printOrder(type, order) {
  const right = order.right_eye || {};
  const left = order.left_eye || {};
  const rows = [
    ['Order No', order.order_number],
    ['Order Date', formatDate(order.order_date)],
    ['Ref. Name', order.ref_name || '-'],
    ...(type === 'sizal'
      ? [
          ['Customer', order.customer_name],
          ['Optical', order.optical_name],
          ['IT Code', order.it_code],
          ['Lens Type', order.lens_type],
          ['Index', order.lens_index || '-'],
          ['DIA', order.dia || '-'],
          ['Power Range', order.power_range || '-'],
          ['Coating', order.coating || '-'],
          ['Price', `₹${Number(order.price || 0).toLocaleString('en-IN')}`],
        ]
      : [
          ['Lens Type', order.lens_type],
          ['DIA', order.dia || '-'],
        ]),
    ['Status', order.status],
  ];
  const escapeHtml = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const eye = (title, values) => `<div class="eye"><h3>${escapeHtml(title)}</h3><p><b>SPH</b> ${escapeHtml(values.sph || '-')} &nbsp; <b>CYL</b> ${escapeHtml(values.cyl || '-')} &nbsp; <b>AXIS</b> ${escapeHtml(values.axis || '-')} &nbsp; <b>ADD</b> ${escapeHtml(values.add || '-')}</p></div>`;
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.write(`<html><head><title>${escapeHtml(order.order_number)}</title><style>@page{size:A5;margin:12mm}body{font-family:Arial,sans-serif;color:#172033;font-size:12px}.head{border-bottom:2px solid #172033;padding-bottom:8px;margin-bottom:14px}h1{font-size:18px;margin:0 0 4px}h2{font-size:15px;margin:15px 0 8px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:7px}.meta div{border-bottom:1px solid #ddd;padding:5px}.meta span{display:block;color:#777;font-size:9px;text-transform:uppercase}.meta b{font-size:11px}.eyes{display:grid;grid-template-columns:1fr 1fr;gap:12px}.eye{border:1px solid #ccc;padding:9px}.eye h3{margin:0 0 8px}.foot{margin-top:16px;color:#777;font-size:9px}</style></head><body><div class="head"><h1>Shree Optical RX Order Manager</h1><div>${escapeHtml(order.order_number)} · ${type === 'sizal' ? 'SIZAL / Lens RX' : 'Glass RX'}</div></div><div class="meta">${rows.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`).join('')}</div><h2>Prescription</h2><div class="eyes">${eye('Right Eye', right)}${eye('Left Eye', left)}</div><div class="foot">Printed ${escapeHtml(formatDateTime(new Date().toISOString()))}</div></body></html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}
