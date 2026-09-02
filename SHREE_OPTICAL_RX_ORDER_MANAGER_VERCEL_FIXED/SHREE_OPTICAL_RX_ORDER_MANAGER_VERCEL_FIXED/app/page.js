'use client';

import { useEffect, useMemo, useState } from 'react';

const emptyOrder = { customer_name:'', phone:'', product_name:'', right_sph:'', right_cyl:'', right_axis:'', left_sph:'', left_cyl:'', left_axis:'', notes:'', status:'pending' };

async function api(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { throw new Error(`Server returned an invalid response (${response.status}).`); }
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function Icon({ children }) { return <span className="icon">{children}</span>; }

export default function Home() {
  const [tab, setTab] = useState('dashboard');
  const [dashboard, setDashboard] = useState(null);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(emptyOrder);
  const [orderType, setOrderType] = useState('lens');
  const [productForm, setProductForm] = useState({ name:'', brand:'', category:'' });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const notify = (text, isError = false) => { setError(isError ? text : ''); setMessage(isError ? '' : text); setTimeout(() => { setMessage(''); setError(''); }, 4500); };

  async function loadAll() {
    try {
      setLoading(true);
      const [dash, orderRows, productRows, settingRows] = await Promise.all([
        api('/api/dashboard'), api('/api/orders'), api('/api/products'), api('/api/settings')
      ]);
      setDashboard(dash); setOrders(orderRows); setProducts(productRows); setSettings(settingRows);
    } catch (e) { notify(e.message, true); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadAll(); }, []);

  async function saveOrder(e) {
    e.preventDefault();
    try {
      await api('/api/orders', { method:'POST', body: JSON.stringify({ ...form, order_type: orderType }) });
      setForm(emptyOrder); notify('Order saved successfully.'); await loadAll(); setTab('orders');
    } catch (e) { notify(e.message, true); }
  }

  async function changeStatus(id, status) {
    try { await api(`/api/orders/${id}`, { method:'PATCH', body: JSON.stringify({ status }) }); notify('Order status updated.'); await loadAll(); }
    catch (e) { notify(e.message, true); }
  }

  async function deleteOrder(id) {
    if (!confirm('Delete this order permanently?')) return;
    try { await api(`/api/orders/${id}`, { method:'DELETE' }); notify('Order deleted.'); await loadAll(); }
    catch (e) { notify(e.message, true); }
  }

  async function addProduct(e) {
    e.preventDefault();
    try { await api('/api/products', { method:'POST', body: JSON.stringify(productForm) }); setProductForm({ name:'', brand:'', category:'' }); notify('Product added.'); await loadAll(); }
    catch (e) { notify(e.message, true); }
  }

  async function deleteProduct(id) {
    if (!confirm('Delete this product?')) return;
    try { await api(`/api/products/${id}`, { method:'DELETE' }); notify('Product deleted.'); await loadAll(); }
    catch (e) { notify(e.message, true); }
  }

  const lensOrders = useMemo(() => orders.filter(o => o.order_type === 'lens'), [orders]);
  const glassOrders = useMemo(() => orders.filter(o => o.order_type === 'glass'), [orders]);

  const nav = [
    ['dashboard','⌂','Dashboard'], ['lens','◉','Create Sizal / Lens RX'], ['glass','◈','Create Glass RX'], ['orders','☷','All Orders'], ['products','▦','Products'], ['settings','⚙','Settings']
  ];

  function OrderForm() {
    return <div className="page-card"><div className="page-heading"><div><span className="eyebrow">NEW ORDER</span><h1>Create {orderType === 'lens' ? 'Sizal / Lens RX' : 'Glass RX'} Order</h1><p>All orders are saved in the shared database and available on every device.</p></div><div className="type-pill">{orderType === 'lens' ? 'Sizal / Lens' : 'Glass RX'}</div></div>
      <form className="order-form" onSubmit={saveOrder}>
        <section><h3>Customer Details</h3><div className="form-grid"><Field label="Customer Name *" value={form.customer_name} onChange={v=>setForm({...form,customer_name:v})} required/><Field label="Phone" value={form.phone} onChange={v=>setForm({...form,phone:v})}/><div className="field"><label>Product</label><select value={form.product_name} onChange={e=>setForm({...form,product_name:e.target.value})}><option value="">Select product</option>{products.map(p=><option key={p.id} value={p.name}>{p.name}{p.brand ? ` — ${p.brand}` : ''}</option>)}</select></div></div></section>
        <section><h3>Prescription Details</h3><div className="rx-grid"><RxEye title="RIGHT EYE" prefix="right" form={form} setForm={setForm}/><RxEye title="LEFT EYE" prefix="left" form={form} setForm={setForm}/></div></section>
        <section><h3>Order Status</h3><div className="status-options"><label><input type="radio" checked={form.status==='pending'} onChange={()=>setForm({...form,status:'pending'})}/> Pending</label><label><input type="radio" checked={form.status==='received'} onChange={()=>setForm({...form,status:'received'})}/> Received</label></div></section>
        <section><h3>Notes</h3><textarea placeholder="Any additional details..." value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></section>
        <button className="primary large" type="submit">Save {orderType === 'lens' ? 'Lens' : 'Glass'} RX Order</button>
      </form></div>;
  }

  return <main>
    <header className="topbar"><div className="brand"><div className="logo-wrap"><img src="/logo.png" alt="Shree Optical logo"/></div><div><div className="brand-title">Shree Optical RX Order Manager</div><div className="brand-sub">By Vikram Choudhary · <a href="https://arvikdigital.in" target="_blank" rel="noreferrer">arvikdigital.in</a></div></div></div><nav>{nav.map(([key,icon,label])=><button key={key} className={tab===key?'active':''} onClick={()=>{setTab(key); if(key==='lens'||key==='glass') setOrderType(key);}}><Icon>{icon}</Icon>{label}</button>)}</nav></header>
    <div className="app-shell">
      {loading ? <div className="loading-card">Loading your shared data…</div> : <>
      {tab==='dashboard' && <Dashboard dashboard={dashboard} orders={orders} setTab={setTab}/>} 
      {(tab==='lens'||tab==='glass') && <OrderForm/>}
      {tab==='orders' && <OrdersPage lensOrders={lensOrders} glassOrders={glassOrders} changeStatus={changeStatus} deleteOrder={deleteOrder}/>} 
      {tab==='products' && <ProductsPage products={products} productForm={productForm} setProductForm={setProductForm} addProduct={addProduct} deleteProduct={deleteProduct}/>} 
      {tab==='settings' && <SettingsPage settings={settings} reload={loadAll}/>} 
      </>}
    </div>
    {(message||error) && <div className={`toast ${error?'error':''}`}>{error||message}</div>}
  </main>;
}

function Field({ label, value, onChange, required=false }) { return <div className="field"><label>{label}</label><input value={value} required={required} onChange={e=>onChange(e.target.value)}/></div>; }
function RxEye({ title, prefix, form, setForm }) { return <div className="eye-card"><h4>{title}</h4><div className="form-grid three"><Field label="SPH" value={form[`${prefix}_sph`]} onChange={v=>setForm({...form,[`${prefix}_sph`]:v})}/><Field label="CYL" value={form[`${prefix}_cyl`]} onChange={v=>setForm({...form,[`${prefix}_cyl`]:v})}/><Field label="AXIS" value={form[`${prefix}_axis`]} onChange={v=>setForm({...form,[`${prefix}_axis`]:v})}/></div></div>; }

function Dashboard({ dashboard, orders, setTab }) {
  const lens=dashboard?.lens||{}; const glass=dashboard?.glass||{};
  const cards=[['Total Sizal / Lens Orders',lens.total,'lens'],['Pending Lens Orders',lens.pending,'lens'],['Received Lens Orders',lens.received,'lens'],['Total Glass RX Orders',glass.total,'glass'],['Pending Glass RX',glass.pending,'glass'],['Received Glass RX',glass.received,'glass']];
  return <><div className="hero"><div><span className="eyebrow">SHARED WORKSPACE</span><h1>Dashboard</h1><p>Your RX orders are stored centrally and stay synchronized across devices.</p></div><button className="primary" onClick={()=>setTab('lens')}>+ Create New Order</button></div><div className="stats">{cards.map(([label,value,type])=><button className="stat-card" key={label} onClick={()=>setTab('orders')}><span>{label}</span><strong>{value||0}</strong><small>{type==='lens'?'Sizal / Lens':'Glass RX'}</small></button>)}</div><div className="panel recent"><div className="panel-head"><div><span className="eyebrow">LATEST ACTIVITY</span><h2>Recent Orders</h2></div><button className="text-btn" onClick={()=>setTab('orders')}>View all →</button></div>{orders.slice(0,6).length? <div className="recent-list">{orders.slice(0,6).map(o=><div className="recent-row" key={o.id}><div className="order-avatar">{o.customer_name?.slice(0,1).toUpperCase()}</div><div><b>{o.customer_name}</b><span>{o.order_type==='lens'?'Sizal / Lens RX':'Glass RX'} · {o.product_name||'No product selected'}</span></div><StatusBadge status={o.status}/></div>)}</div>:<div className="empty">No orders yet. Create your first RX order to get started.</div>}</div></>;
}

function OrdersPage({ lensOrders, glassOrders, changeStatus, deleteOrder }) { return <div className="page-card"><div className="page-heading"><div><span className="eyebrow">SHARED ORDER LIST</span><h1>All RX Orders</h1><p>Lens and Glass RX orders are organized in separate sections below.</p></div></div><OrderSection title="Sizal / Lens RX Orders" orders={lensOrders} changeStatus={changeStatus} deleteOrder={deleteOrder}/><OrderSection title="Glass RX Orders" orders={glassOrders} changeStatus={changeStatus} deleteOrder={deleteOrder}/></div>; }
function OrderSection({ title, orders, changeStatus, deleteOrder }) { return <section className="order-section"><div className="section-title"><h2>{title}</h2><span>{orders.length} orders</span></div>{orders.length?<div className="table-wrap"><table><thead><tr><th>Customer</th><th>Phone</th><th>Product</th><th>RX</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody>{orders.map(o=><tr key={o.id}><td><b>{o.customer_name}</b></td><td>{o.phone||'—'}</td><td>{o.product_name||'—'}</td><td className="rx-summary">R: {o.right_sph||'—'} / {o.right_cyl||'—'} · L: {o.left_sph||'—'} / {o.left_cyl||'—'}</td><td><StatusBadge status={o.status}/></td><td>{new Date(o.created_at).toLocaleDateString()}</td><td className="actions"><button onClick={()=>changeStatus(o.id,o.status==='pending'?'received':'pending')}>{o.status==='pending'?'Mark Received':'Mark Pending'}</button><button className="danger-link" onClick={()=>deleteOrder(o.id)}>Delete</button></td></tr>)}</tbody></table></div>:<div className="empty compact">No orders in this section yet.</div>}</section>; }
function StatusBadge({ status }) { return <span className={`badge ${status}`}>{status==='received'?'Received':'Pending'}</span>; }

function ProductsPage({ products, productForm, setProductForm, addProduct, deleteProduct }) { return <div className="page-card"><div className="page-heading"><div><span className="eyebrow">PRODUCT CATALOG</span><h1>Products</h1><p>Add products once and use them while creating RX orders on any device.</p></div></div><form className="product-form" onSubmit={addProduct}><Field label="Product Name *" value={productForm.name} required onChange={v=>setProductForm({...productForm,name:v})}/><Field label="Brand" value={productForm.brand} onChange={v=>setProductForm({...productForm,brand:v})}/><Field label="Category" value={productForm.category} onChange={v=>setProductForm({...productForm,category:v})}/><button className="primary" type="submit">Add Product</button></form><div className="product-grid">{products.length?products.map(p=><div className="product-card" key={p.id}><div className="product-icon">◈</div><div><h3>{p.name}</h3><p>{[p.brand,p.category].filter(Boolean).join(' · ')||'Product'}</p></div><button className="delete-mini" onClick={()=>deleteProduct(p.id)}>×</button></div>):<div className="empty">No products yet.</div>}</div></div>; }
function SettingsPage({ settings, reload }) { return <div className="page-card settings"><div className="page-heading"><div><span className="eyebrow">SYSTEM</span><h1>Settings</h1><p>Check your shared database connection and refresh application data.</p></div></div><div className="settings-grid"><div className="setting-card"><span>DATABASE STATUS</span><strong className={settings?.database==='connected'?'good':'bad'}>{settings?.database==='connected'?'Connected':'Connection Error'}</strong><p>{settings?.database==='connected'?'Neon database is connected and shared across devices.':settings?.error||'Unable to connect.'}</p></div><div className="setting-card"><span>SAVED PRODUCTS</span><strong>{settings?.products||0}</strong><p>Products available to all devices.</p></div><div className="setting-card"><span>SAVED ORDERS</span><strong>{settings?.orders||0}</strong><p>Total orders stored centrally.</p></div></div><button className="primary" onClick={reload}>↻ Refresh Data</button></div>; }
