import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

// ── Helpers ─────────────────────────────────────────────────────────────────

function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmt(n) {
  return 'Rs ' + Number(n || 0).toLocaleString('en-IN');
}

function fmtDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(day)} ${months[Number(m) - 1]}`;
}

function fmtDateFull(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(day)} ${months[Number(m) - 1]} ${y}`;
}

function weekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

const UNITS = ['pcs', 'kg', 'g', 'ltr', 'ml', 'doz', 'pkt', 'bag', 'box', 'btle'];

// ── Shared UI ────────────────────────────────────────────────────────────────

function Card({ children, style }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '16px', boxShadow: '0 1px 8px rgba(0,0,0,0.08)', marginBottom: 12, ...style }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>{children}</div>;
}

function Toast({ msg, onClose }) {
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, [msg, onClose]);
  if (!msg) return null;
  return (
    <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', background: '#1f2937', color: '#fff', borderRadius: 12, padding: '10px 20px', fontSize: 14, fontWeight: 600, zIndex: 1000, maxWidth: 320, textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
      {msg}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter();
  const today = localDate();
  const [tab, setTab] = useState('sale');
  const [shopName, setShopName] = useState('Grocer POS');
  const [toast, setToast] = useState('');

  function showToast(msg) { setToast(msg); }
  const clearToast = useCallback(() => setToast(''), []);

  useEffect(() => {
    fetch('/api/settings').then(r => {
      if (r.status === 401) { router.push('/'); return null; }
      return r.json();
    }).then(d => d && d.shop_name && setShopName(d.shop_name));
  }, [router]);

  // ── SALE TAB STATE ──────────────────────────────────────────────────────────
  const [entries, setEntries] = useState([]);
  const [itemName, setItemName] = useState('');
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState('pcs');
  const [sp, setSp] = useState('');
  const [saleAdding, setSaleAdding] = useState(false);
  const [recentItems, setRecentItems] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [todayTotal, setTodayTotal] = useState(0);
  const [editId, setEditId] = useState(null);
  const [editQty, setEditQty] = useState('');
  const [editSp, setEditSp] = useState('');
  const itemNameRef = useRef(null);

  const loadSaleEntries = useCallback(async () => {
    const r = await fetch(`/api/sales?date=${today}`);
    if (r.status === 401) { router.push('/'); return; }
    const data = await r.json();
    setEntries(data);
    setTodayTotal(data.reduce((s, e) => s + Number(e.qty) * Number(e.sp), 0));
  }, [today, router]);

  const loadRecentItems = useCallback(async () => {
    const r = await fetch('/api/items');
    if (r.ok) setRecentItems(await r.json());
  }, []);

  useEffect(() => {
    if (tab === 'sale') { loadSaleEntries(); loadRecentItems(); }
  }, [tab, loadSaleEntries, loadRecentItems]);

  const filteredSuggestions = itemName.trim().length > 0
    ? recentItems.filter(i => i.item_name.toLowerCase().includes(itemName.toLowerCase()))
    : recentItems.slice(0, 8);

  async function addEntry(e) {
    e.preventDefault();
    if (!itemName.trim() || !sp || Number(sp) <= 0) return;
    setSaleAdding(true);
    const r = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: today, item_name: itemName.trim(), qty: Number(qty) || 1, unit, sp: Number(sp) }),
    });
    if (r.ok) {
      const { entry } = await r.json();
      setEntries(prev => [entry, ...prev]);
      setTodayTotal(prev => prev + Number(entry.qty) * Number(entry.sp));
      setItemName('');
      setQty('1');
      setSp('');
      setShowSuggestions(false);
      itemNameRef.current?.focus();
    }
    setSaleAdding(false);
  }

  async function deleteEntry(id, total) {
    if (!confirm('Delete this entry?')) return;
    const r = await fetch(`/api/sales/${id}`, { method: 'DELETE' });
    if (r.ok) {
      setEntries(prev => prev.filter(e => e.id !== id));
      setTodayTotal(prev => Math.max(0, prev - total));
      showToast('Entry deleted');
    }
  }

  async function saveEdit(id) {
    const r = await fetch(`/api/sales/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qty: Number(editQty), sp: Number(editSp) }),
    });
    if (r.ok) {
      const { entry } = await r.json();
      setEntries(prev => prev.map(e => e.id === id ? entry : e));
      setTodayTotal(entries.reduce((s, e) => {
        const cur = e.id === id ? entry : e;
        return s + Number(cur.qty) * Number(cur.sp);
      }, 0));
      setEditId(null);
      showToast('Entry updated');
    }
  }

  // ── EOD TAB STATE ───────────────────────────────────────────────────────────
  const [eodDate, setEodDate] = useState(today);
  const [eodGroups, setEodGroups] = useState([]);
  const [eodSaving, setEodSaving] = useState(false);
  const [eodLoading, setEodLoading] = useState(false);

  const loadEOD = useCallback(async (date) => {
    setEodLoading(true);
    const r = await fetch(`/api/eod?date=${date}`);
    if (r.status === 401) { router.push('/'); return; }
    const data = await r.json();
    setEodGroups(data.map(g => ({ ...g, cpInput: g.cp != null ? String(g.cp) : '' })));
    setEodLoading(false);
  }, [router]);

  useEffect(() => {
    if (tab === 'eod') loadEOD(eodDate);
  }, [tab, eodDate, loadEOD]);

  function setEodCp(item_name, val) {
    setEodGroups(prev => prev.map(g => g.item_name === item_name ? { ...g, cpInput: val } : g));
  }

  async function saveEOD() {
    const items = eodGroups.map(g => ({ item_name: g.item_name, cp: g.cpInput !== '' ? Number(g.cpInput) : null }))
      .filter(i => i.cp !== null);
    if (!items.length) { showToast('Enter at least one cost price'); return; }
    setEodSaving(true);
    const r = await fetch('/api/eod', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: eodDate, items }),
    });
    if (r.ok) {
      showToast('Cost prices saved ✓');
      loadEOD(eodDate);
    }
    setEodSaving(false);
  }

  const eodRevenue = eodGroups.reduce((s, g) => s + Number(g.total_sp), 0);
  const eodCost = eodGroups.reduce((s, g) => g.cpInput !== '' ? s + Number(g.total_qty) * Number(g.cpInput) : s, 0);
  const eodAllFilled = eodGroups.length > 0 && eodGroups.every(g => g.cpInput !== '');

  // ── CASH TAB STATE ──────────────────────────────────────────────────────────
  const [cashData, setCashData] = useState(null);
  const [openingInput, setOpeningInput] = useState('');
  const [cashSaving, setCashSaving] = useState(false);
  const [editOpening, setEditOpening] = useState(false);

  const loadCash = useCallback(async () => {
    const r = await fetch(`/api/cash?date=${today}`);
    if (r.status === 401) { router.push('/'); return; }
    const data = await r.json();
    setCashData(data);
    if (data.opening === null && data.suggested_opening !== null) {
      setOpeningInput(String(Math.round(data.suggested_opening)));
    } else if (data.opening !== null) {
      setOpeningInput(String(data.opening));
    }
  }, [today, router]);

  useEffect(() => {
    if (tab === 'cash') loadCash();
  }, [tab, loadCash]);

  async function setOpening() {
    if (openingInput === '' || Number(openingInput) < 0) { showToast('Enter a valid opening balance'); return; }
    setCashSaving(true);
    const r = await fetch('/api/cash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: today, opening: Number(openingInput) }),
    });
    if (r.ok) {
      showToast('Opening balance saved ✓');
      setEditOpening(false);
      loadCash();
    }
    setCashSaving(false);
  }

  // ── EXPENSES TAB STATE ──────────────────────────────────────────────────────
  const [expenses, setExpenses] = useState([]);
  const [expType, setExpType] = useState('general');
  const [expAmount, setExpAmount] = useState('');
  const [expNote, setExpNote] = useState('');
  const [expAdding, setExpAdding] = useState(false);
  const [expDate, setExpDate] = useState(today);

  const loadExpenses = useCallback(async () => {
    const r = await fetch(`/api/expenses?date=${expDate}`);
    if (r.status === 401) { router.push('/'); return; }
    setExpenses(await r.json());
  }, [expDate, router]);

  useEffect(() => {
    if (tab === 'expenses') loadExpenses();
  }, [tab, expDate, loadExpenses]);

  async function addExpense(e) {
    e.preventDefault();
    if (!expAmount || Number(expAmount) <= 0) return;
    setExpAdding(true);
    const r = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: expDate, type: expType, amount: Number(expAmount), note: expNote || undefined }),
    });
    if (r.ok) {
      const { expense } = await r.json();
      if (expense.expense_date === expDate) setExpenses(prev => [expense, ...prev]);
      setExpAmount('');
      setExpNote('');
      showToast('Expense added ✓');
    }
    setExpAdding(false);
  }

  async function deleteExpense(id) {
    if (!confirm('Delete this expense?')) return;
    const r = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
    if (r.ok) {
      setExpenses(prev => prev.filter(e => e.id !== id));
      showToast('Expense deleted');
    }
  }

  // ── REPORTS TAB STATE ───────────────────────────────────────────────────────
  const [period, setPeriod] = useState('today');
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [showEntries, setShowEntries] = useState(false);

  const loadReport = useCallback(async (p) => {
    setReportLoading(true);
    const t = localDate();
    const start = p === 'today' ? t : p === 'week' ? weekStart() : monthStart();
    const r = await fetch(`/api/reports?start=${start}&end=${t}`);
    if (r.status === 401) { router.push('/'); return; }
    setReport(await r.json());
    setReportLoading(false);
  }, [router]);

  useEffect(() => {
    if (tab === 'reports') loadReport(period);
  }, [tab, period, loadReport]);

  // ── SETTINGS STATE ──────────────────────────────────────────────────────────
  const [showSettings, setShowSettings] = useState(false);
  const [settingShopName, setSettingShopName] = useState('');
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [settingSaving, setSettingSaving] = useState(false);

  async function saveShopName() {
    if (!settingShopName.trim()) return;
    setSettingSaving(true);
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'shop_name', value: settingShopName.trim() }),
    });
    setShopName(settingShopName.trim());
    setSettingSaving(false);
    showToast('Shop name saved ✓');
  }

  async function changePassword(e) {
    e.preventDefault();
    setPwMsg('');
    const r = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current: pwCurrent, newPassword: pwNew }),
    });
    const d = await r.json();
    if (r.ok) { setPwMsg('✓ Password changed'); setPwCurrent(''); setPwNew(''); }
    else setPwMsg('✗ ' + (d.error || 'Failed'));
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  // ── RENDER ──────────────────────────────────────────────────────────────────

  const NAV = [
    { key: 'sale', icon: '🛒', label: 'Sale' },
    { key: 'eod', icon: '📋', label: 'Cost' },
    { key: 'cash', icon: '💵', label: 'Cash' },
    { key: 'expenses', icon: '💸', label: 'Expenses' },
    { key: 'reports', icon: '📊', label: 'Reports' },
  ];

  return (
    <>
      <Head>
        <title>{shopName}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>

      <Toast msg={toast} onClose={clearToast} />

      <div style={{ maxWidth: 520, margin: '0 auto', minHeight: '100vh', background: '#f1f5f9', paddingBottom: 72 }}>

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #1d6e3c 100%)', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 50 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>🛒 {shopName}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{fmtDateFull(today)}</div>
          </div>
          <button onClick={() => { setShowSettings(true); setSettingShopName(shopName); }}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 8, padding: '7px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            ⚙️
          </button>
        </div>

        {/* ── SALE TAB ────────────────────────────────────────────────── */}
        {tab === 'sale' && (
          <div style={{ padding: '14px' }}>
            {/* Today's total banner */}
            <div style={{ background: 'linear-gradient(135deg, #1d6e3c, #16a34a)', borderRadius: 16, padding: '14px 18px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600 }}>TODAY'S SALES TOTAL</div>
                <div style={{ color: '#fff', fontSize: 26, fontWeight: 800, marginTop: 2 }}>{fmt(todayTotal)}</div>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{entries.length} item{entries.length !== 1 ? 's' : ''}</div>
            </div>

            {/* Add entry form */}
            <Card>
              <SectionTitle>Add Sale Entry</SectionTitle>
              <form onSubmit={addEntry}>
                {/* Item name with suggestions */}
                <div style={{ position: 'relative', marginBottom: 10 }}>
                  <input
                    ref={itemNameRef}
                    type="text"
                    placeholder="Item name (e.g. Rice, Sugar, Oil)"
                    value={itemName}
                    onChange={e => { setItemName(e.target.value); setShowSuggestions(true); }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    autoComplete="off"
                    style={{ width: '100%', padding: '13px 14px', border: '2px solid #e5e7eb', borderRadius: 10, fontSize: 16, outline: 'none' }}
                  />
                  {showSuggestions && filteredSuggestions.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', zIndex: 100, maxHeight: 200, overflowY: 'auto' }}>
                      {filteredSuggestions.map((item, i) => (
                        <div key={i}
                          onMouseDown={() => { setItemName(item.item_name); setUnit(item.unit || 'pcs'); setShowSuggestions(false); setTimeout(() => document.querySelector('input[placeholder="Qty"]')?.focus(), 50); }}
                          style={{ padding: '11px 14px', fontSize: 15, cursor: 'pointer', borderBottom: i < filteredSuggestions.length - 1 ? '1px solid #f3f4f6' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>{item.item_name}</span>
                          <span style={{ fontSize: 12, color: '#9ca3af' }}>{item.unit}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <input
                    type="number"
                    placeholder="Qty"
                    value={qty}
                    onChange={e => setQty(e.target.value)}
                    onFocus={e => e.target.select()}
                    min="0.01"
                    step="any"
                    style={{ flex: 1, padding: '13px 10px', border: '2px solid #e5e7eb', borderRadius: 10, fontSize: 16, outline: 'none', textAlign: 'center' }}
                  />
                  <select value={unit} onChange={e => setUnit(e.target.value)}
                    style={{ flex: 1, padding: '13px 8px', border: '2px solid #e5e7eb', borderRadius: 10, fontSize: 15, background: '#fff' }}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <input
                    type="number"
                    placeholder="Price (Rs)"
                    value={sp}
                    onChange={e => setSp(e.target.value)}
                    onFocus={e => e.target.select()}
                    min="0"
                    step="any"
                    style={{ flex: 2, padding: '13px 10px', border: '2px solid #e5e7eb', borderRadius: 10, fontSize: 16, outline: 'none' }}
                  />
                </div>

                {itemName && sp && (
                  <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 14, color: '#16a34a', fontWeight: 600 }}>
                    Total: {fmt((Number(qty) || 1) * Number(sp))}
                  </div>
                )}

                <button type="submit" disabled={saleAdding || !itemName.trim() || !sp}
                  style={{ width: '100%', padding: '14px', background: saleAdding || !itemName.trim() || !sp ? '#d1fae5' : '#16a34a', color: '#fff', border: 'none', borderRadius: 10, fontSize: 17, fontWeight: 700, cursor: 'pointer' }}>
                  {saleAdding ? 'Adding...' : '✓ Add Entry'}
                </button>
              </form>
            </Card>

            {/* Today's entries */}
            {entries.length > 0 && (
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6' }}>
                  <SectionTitle>Today's Sales ({entries.length})</SectionTitle>
                </div>
                {entries.map((e, i) => (
                  <div key={e.id}>
                    {editId === e.id ? (
                      <div style={{ padding: '12px 14px', background: '#f0fdf4', display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input type="number" value={editQty} onChange={x => setEditQty(x.target.value)} onFocus={x => x.target.select()}
                          placeholder="Qty" step="any"
                          style={{ flex: 1, padding: '8px', border: '2px solid #16a34a', borderRadius: 8, fontSize: 15, outline: 'none', textAlign: 'center' }} />
                        <input type="number" value={editSp} onChange={x => setEditSp(x.target.value)} onFocus={x => x.target.select()}
                          placeholder="Price"  step="any"
                          style={{ flex: 2, padding: '8px', border: '2px solid #16a34a', borderRadius: 8, fontSize: 15, outline: 'none' }} />
                        <button onClick={() => saveEdit(e.id)} style={{ padding: '8px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Save</button>
                        <button onClick={() => setEditId(null)} style={{ padding: '8px 10px', background: '#f3f4f6', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>✕</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: i < entries.length - 1 ? '1px solid #f9fafb' : 'none' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{e.item_name}</div>
                          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{Number(e.qty)} {e.unit} × {fmt(e.sp)}</div>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: '#1d6e3c', marginRight: 10 }}>{fmt(Number(e.qty) * Number(e.sp))}</div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => { setEditId(e.id); setEditQty(String(e.qty)); setEditSp(String(e.sp)); }}
                            style={{ padding: '6px 10px', background: '#eff6ff', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer', color: '#2563eb' }}>✏️</button>
                          <button onClick={() => deleteEntry(e.id, Number(e.qty) * Number(e.sp))}
                            style={{ padding: '6px 10px', background: '#fef2f2', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer', color: '#dc2626' }}>🗑️</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <div style={{ padding: '12px 16px', borderTop: '2px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', background: '#fafafa' }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#374151' }}>Total</span>
                  <span style={{ fontSize: 17, fontWeight: 800, color: '#1d6e3c' }}>{fmt(todayTotal)}</span>
                </div>
              </Card>
            )}

            {entries.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#9ca3af' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
                <div style={{ fontSize: 16 }}>No sales yet today</div>
                <div style={{ fontSize: 14, marginTop: 6 }}>Add your first item above</div>
              </div>
            )}
          </div>
        )}

        {/* ── EOD (COST) TAB ──────────────────────────────────────────── */}
        {tab === 'eod' && (
          <div style={{ padding: '14px' }}>
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <SectionTitle>End-of-Day Cost Entry</SectionTitle>
                <input type="date" value={eodDate} onChange={e => setEodDate(e.target.value)}
                  style={{ border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '6px 10px', fontSize: 14, outline: 'none' }} />
              </div>
              <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 14, lineHeight: 1.5 }}>
                Enter the <strong>cost price per unit</strong> for each item sold today to calculate your profit.
              </p>

              {eodLoading && <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>Loading...</div>}

              {!eodLoading && eodGroups.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
                  No sales found for {fmtDateFull(eodDate)}
                </div>
              )}

              {!eodLoading && eodGroups.length > 0 && (
                <>
                  {eodGroups.map(g => {
                    const profit = g.cpInput !== '' ? Number(g.total_qty) * (Number(g.total_sp) / Number(g.total_qty) - Number(g.cpInput)) : null;
                    return (
                      <div key={g.item_name} style={{ background: '#f9fafb', borderRadius: 12, padding: '12px 14px', marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{g.item_name}</div>
                            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Sold: {Number(g.total_qty)} {g.unit} · Revenue: {fmt(g.total_sp)}</div>
                          </div>
                          {profit !== null && (
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 11, color: '#6b7280' }}>Profit</div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: profit >= 0 ? '#16a34a' : '#dc2626' }}>{fmt(profit)}</div>
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, color: '#6b7280', flexShrink: 0 }}>Cost/unit:</span>
                          <input
                            type="number"
                            placeholder="Rs 0.00"
                            value={g.cpInput}
                            onChange={e => setEodCp(g.item_name, e.target.value)}
                            onFocus={e => e.target.select()}
                            min="0"
                            step="any"
                            style={{ flex: 1, padding: '10px 12px', border: `2px solid ${g.cpInput !== '' ? '#16a34a' : '#e5e7eb'}`, borderRadius: 8, fontSize: 16, outline: 'none' }}
                          />
                        </div>
                      </div>
                    );
                  })}

                  {/* Profit summary */}
                  {eodAllFilled && (
                    <div style={{ background: 'linear-gradient(135deg, #1d6e3c, #16a34a)', borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
                      <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 6 }}>ESTIMATED PROFIT FOR {fmtDateFull(eodDate)}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>Revenue</div>
                          <div style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>{fmt(eodRevenue)}</div>
                        </div>
                        <div>
                          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>Cost</div>
                          <div style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>{fmt(eodCost)}</div>
                        </div>
                        <div>
                          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>Gross Profit</div>
                          <div style={{ color: '#fff', fontSize: 18, fontWeight: 800 }}>{fmt(eodRevenue - eodCost)}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  <button onClick={saveEOD} disabled={eodSaving}
                    style={{ width: '100%', padding: '14px', background: eodSaving ? '#9ca3af' : '#1e3a5f', color: '#fff', border: 'none', borderRadius: 10, fontSize: 17, fontWeight: 700, cursor: 'pointer' }}>
                    {eodSaving ? 'Saving...' : '✓ Save Cost Prices'}
                  </button>
                </>
              )}
            </Card>
          </div>
        )}

        {/* ── CASH TAB ────────────────────────────────────────────────── */}
        {tab === 'cash' && (
          <div style={{ padding: '14px' }}>
            {cashData ? (
              <>
                {/* Opening balance */}
                <Card>
                  <SectionTitle>Opening Balance — {fmtDateFull(today)}</SectionTitle>

                  {cashData.opening === null && cashData.suggested_opening !== null && !editOpening && (
                    <div style={{ background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#92400e', marginBottom: 6 }}>
                        ⚡ Yesterday's closing: {fmt(cashData.suggested_opening)}
                      </div>
                      <div style={{ fontSize: 13, color: '#78350f', marginBottom: 10 }}>Set this as today's opening balance?</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => { setOpeningInput(String(Math.round(cashData.suggested_opening))); setEditOpening(true); }}
                          style={{ flex: 1, padding: '10px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                          Change Amount
                        </button>
                        <button onClick={setOpening}
                          style={{ flex: 2, padding: '10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                          ✓ Confirm {fmt(cashData.suggested_opening)}
                        </button>
                      </div>
                    </div>
                  )}

                  {(cashData.opening === null && cashData.suggested_opening === null && !editOpening) && (
                    <div style={{ marginBottom: 14 }}>
                      <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 10 }}>Enter today's opening cash balance:</p>
                      <button onClick={() => setEditOpening(true)}
                        style={{ width: '100%', padding: '12px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                        + Set Opening Balance
                      </button>
                    </div>
                  )}

                  {(editOpening || (cashData.opening !== null && !editOpening)) && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {editOpening ? (
                        <>
                          <input type="number" value={openingInput} onChange={e => setOpeningInput(e.target.value)} onFocus={e => e.target.select()}
                            placeholder="Rs 0" min="0" step="1" autoFocus
                            style={{ flex: 1, padding: '12px 14px', border: '2px solid #1e3a5f', borderRadius: 10, fontSize: 17, outline: 'none' }} />
                          <button onClick={setOpening} disabled={cashSaving}
                            style={{ padding: '12px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                            Save
                          </button>
                          <button onClick={() => setEditOpening(false)}
                            style={{ padding: '12px 14px', background: '#f3f4f6', border: 'none', borderRadius: 10, fontSize: 15, cursor: 'pointer' }}>
                            ✕
                          </button>
                        </>
                      ) : (
                        <>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, color: '#6b7280' }}>Opening Balance</div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: '#1e3a5f' }}>{fmt(cashData.opening)}</div>
                          </div>
                          <button onClick={() => setEditOpening(true)}
                            style={{ padding: '8px 14px', background: '#eff6ff', border: 'none', borderRadius: 8, fontSize: 13, color: '#2563eb', fontWeight: 600, cursor: 'pointer' }}>
                            Edit
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </Card>

                {/* Summary */}
                {cashData.opening !== null && (
                  <Card>
                    <SectionTitle>Today's Summary</SectionTitle>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[
                        { label: 'Opening Balance', value: cashData.opening, color: '#1e3a5f' },
                        { label: 'Sales Revenue', value: cashData.revenue, color: '#16a34a', prefix: '+ ' },
                        { label: 'General Expenses', value: cashData.gen_expenses, color: '#dc2626', prefix: '- ' },
                      ].map(row => (
                        <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                          <span style={{ fontSize: 14, color: '#374151' }}>{row.label}</span>
                          <span style={{ fontSize: 15, fontWeight: 700, color: row.color }}>{row.prefix || ''}{fmt(row.value)}</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', marginTop: 2 }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>Closing Balance</span>
                        <span style={{ fontSize: 22, fontWeight: 800, color: '#1d6e3c' }}>{fmt(cashData.closing)}</span>
                      </div>
                    </div>
                  </Card>
                )}

                {cashData.opening !== null && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '12px 14px', fontSize: 13, color: '#166534' }}>
                    ℹ️ This closing balance will automatically carry over as tomorrow's opening balance.
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>Loading...</div>
            )}
          </div>
        )}

        {/* ── EXPENSES TAB ─────────────────────────────────────────────── */}
        {tab === 'expenses' && (
          <div style={{ padding: '14px' }}>
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <SectionTitle>Add Expense</SectionTitle>
                <input type="date" value={expDate} onChange={e => { setExpDate(e.target.value); }}
                  style={{ border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '6px 10px', fontSize: 14, outline: 'none' }} />
              </div>

              {/* Type toggle */}
              <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 10, padding: 4, marginBottom: 14, gap: 4 }}>
                {[['general', '💸 General'], ['cogs', '📦 COGS']].map(([val, label]) => (
                  <button key={val} onClick={() => setExpType(val)}
                    style={{ flex: 1, padding: '9px', background: expType === val ? '#fff' : 'transparent', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: expType === val ? 700 : 500, color: expType === val ? '#111827' : '#6b7280', boxShadow: expType === val ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer' }}>
                    {label}
                  </button>
                ))}
              </div>

              {expType === 'cogs' && (
                <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#92400e' }}>
                  ℹ️ COGS expenses are for reference only and do not affect profit (profit is calculated from cost prices entered in EOD).
                </div>
              )}

              <form onSubmit={addExpense}>
                <input type="number" placeholder="Amount (Rs)" value={expAmount}
                  onChange={e => setExpAmount(e.target.value)} onFocus={e => e.target.select()}
                  min="1" step="any" required
                  style={{ width: '100%', padding: '13px 14px', border: '2px solid #e5e7eb', borderRadius: 10, fontSize: 17, outline: 'none', marginBottom: 10 }} />
                <input type="text" placeholder="Note (e.g. electricity bill)" value={expNote}
                  onChange={e => setExpNote(e.target.value)}
                  style={{ width: '100%', padding: '12px 14px', border: '2px solid #e5e7eb', borderRadius: 10, fontSize: 15, outline: 'none', marginBottom: 12 }} />
                <button type="submit" disabled={expAdding || !expAmount}
                  style={{ width: '100%', padding: '14px', background: expAdding || !expAmount ? '#9ca3af' : '#dc2626', color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
                  {expAdding ? 'Adding...' : '+ Add Expense'}
                </button>
              </form>
            </Card>

            {/* Expense list */}
            {expenses.length > 0 && (
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6' }}>
                  <SectionTitle>Expenses on {fmtDateFull(expDate)}</SectionTitle>
                </div>
                {expenses.map((e, i) => (
                  <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: i < expenses.length - 1 ? '1px solid #f9fafb' : 'none' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
                        {e.note || (e.type === 'cogs' ? 'COGS Expense' : 'General Expense')}
                        <span style={{ marginLeft: 6, fontSize: 11, background: e.type === 'cogs' ? '#fffbeb' : '#fef2f2', color: e.type === 'cogs' ? '#92400e' : '#dc2626', borderRadius: 6, padding: '2px 7px', fontWeight: 600 }}>
                          {e.type.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#dc2626' }}>{fmt(e.amount)}</span>
                      <button onClick={() => deleteExpense(e.id)}
                        style={{ padding: '6px 10px', background: '#fef2f2', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer', color: '#dc2626' }}>🗑️</button>
                    </div>
                  </div>
                ))}
                <div style={{ padding: '10px 16px', borderTop: '2px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', background: '#fafafa' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>Total Expenses</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#dc2626' }}>{fmt(expenses.reduce((s, e) => s + Number(e.amount), 0))}</span>
                </div>
              </Card>
            )}

            {expenses.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af', fontSize: 14 }}>No expenses recorded for this date</div>
            )}
          </div>
        )}

        {/* ── REPORTS TAB ──────────────────────────────────────────────── */}
        {tab === 'reports' && (
          <div style={{ padding: '14px' }}>
            {/* Period selector */}
            <div style={{ display: 'flex', background: '#fff', borderRadius: 12, padding: 4, marginBottom: 14, gap: 4, boxShadow: '0 1px 8px rgba(0,0,0,0.08)' }}>
              {[['today', 'Today'], ['week', 'This Week'], ['month', 'This Month']].map(([val, label]) => (
                <button key={val} onClick={() => { setPeriod(val); loadReport(val); setShowEntries(false); }}
                  style={{ flex: 1, padding: '10px 4px', background: period === val ? '#1e3a5f' : 'transparent', color: period === val ? '#fff' : '#6b7280', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: period === val ? 700 : 500, cursor: 'pointer' }}>
                  {label}
                </button>
              ))}
            </div>

            {reportLoading && <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>Loading...</div>}

            {!reportLoading && report && (
              <>
                {/* CP incomplete warning */}
                {!report.summary.cp_complete && report.summary.total_items > 0 && (
                  <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 12, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#92400e' }}>
                    ⚠️ <strong>Profit data incomplete</strong> — cost prices not entered for all items.
                    Go to the <strong>Cost</strong> tab to complete EOD entry.
                  </div>
                )}

                {/* Summary cards */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                  <div style={{ background: '#fff', borderRadius: 14, padding: '14px', boxShadow: '0 1px 8px rgba(0,0,0,0.08)', borderTop: '3px solid #2563eb' }}>
                    <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Revenue</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#2563eb' }}>{fmt(report.summary.revenue)}</div>
                  </div>
                  <div style={{ background: '#fff', borderRadius: 14, padding: '14px', boxShadow: '0 1px 8px rgba(0,0,0,0.08)', borderTop: `3px solid ${report.summary.cp_complete ? '#16a34a' : '#9ca3af'}` }}>
                    <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Gross Profit</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: report.summary.cp_complete ? (report.summary.gross_profit >= 0 ? '#16a34a' : '#dc2626') : '#9ca3af' }}>
                      {report.summary.cp_complete ? fmt(report.summary.gross_profit) : 'Pending'}
                    </div>
                  </div>
                  <div style={{ background: '#fff', borderRadius: 14, padding: '14px', boxShadow: '0 1px 8px rgba(0,0,0,0.08)', borderTop: '3px solid #dc2626' }}>
                    <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Gen. Expenses</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#dc2626' }}>{fmt(report.summary.gen_expenses)}</div>
                  </div>
                  <div style={{ background: '#fff', borderRadius: 14, padding: '14px', boxShadow: '0 1px 8px rgba(0,0,0,0.08)', borderTop: `3px solid ${report.summary.cp_complete ? '#1d6e3c' : '#9ca3af'}` }}>
                    <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Net Profit</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: report.summary.cp_complete ? (report.summary.net_profit >= 0 ? '#1d6e3c' : '#dc2626') : '#9ca3af' }}>
                      {report.summary.cp_complete ? fmt(report.summary.net_profit) : 'Pending'}
                    </div>
                  </div>
                </div>

                {/* Top items */}
                {report.topItems.length > 0 && (
                  <Card style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6' }}>
                      <SectionTitle>Top Items by Revenue</SectionTitle>
                    </div>
                    {report.topItems.map((item, i) => {
                      const pct = report.summary.revenue > 0 ? (Number(item.total_revenue) / report.summary.revenue) * 100 : 0;
                      return (
                        <div key={i} style={{ padding: '10px 14px', borderBottom: i < report.topItems.length - 1 ? '1px solid #f9fafb' : 'none' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{item.item_name}</span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f' }}>{fmt(item.total_revenue)}</span>
                          </div>
                          <div style={{ background: '#f3f4f6', borderRadius: 4, height: 4 }}>
                            <div style={{ background: '#2563eb', height: '100%', borderRadius: 4, width: `${Math.min(pct, 100)}%` }} />
                          </div>
                          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Qty: {Number(item.total_qty)} {item.unit}</div>
                        </div>
                      );
                    })}
                  </Card>
                )}

                {/* Daily breakdown (week/month) */}
                {period !== 'today' && report.daily.length > 0 && (
                  <Card style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6' }}>
                      <SectionTitle>Daily Breakdown</SectionTitle>
                    </div>
                    {report.daily.map((day, i) => {
                      const dayExp = report.dailyExp.filter(e => e.date === day.date && e.type === 'general').reduce((s, e) => s + Number(e.total), 0);
                      const hasAllCp = Number(day.items_with_cp) === Number(day.items);
                      const profit = hasAllCp ? Number(day.revenue) - Number(day.cost) - dayExp : null;
                      return (
                        <div key={day.date} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: i < report.daily.length - 1 ? '1px solid #f9fafb' : 'none' }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{fmtDateFull(day.date)}</div>
                            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{Number(day.items)} items</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f' }}>{fmt(day.revenue)}</div>
                            <div style={{ fontSize: 12, color: profit !== null ? (profit >= 0 ? '#16a34a' : '#dc2626') : '#9ca3af', marginTop: 2 }}>
                              {profit !== null ? `Profit: ${fmt(profit)}` : '— Cost pending'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </Card>
                )}

                {/* COGS expenses info */}
                {report.summary.cogs_expenses > 0 && (
                  <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#6b7280' }}>
                    📦 COGS expenses recorded: {fmt(report.summary.cogs_expenses)} (not deducted from profit)
                  </div>
                )}

                {/* View all entries toggle */}
                {report.entries.length > 0 && (
                  <button onClick={() => setShowEntries(p => !p)}
                    style={{ width: '100%', padding: '12px', background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#374151', cursor: 'pointer', marginBottom: 10 }}>
                    {showEntries ? '▲ Hide Sale Entries' : `▼ Show All Sale Entries (${report.entries.length})`}
                  </button>
                )}

                {showEntries && (
                  <Card style={{ padding: 0, overflow: 'hidden' }}>
                    {report.entries.map((e, i) => (
                      <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: i < report.entries.length - 1 ? '1px solid #f9fafb' : 'none' }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{e.item_name}</div>
                          <div style={{ fontSize: 12, color: '#9ca3af' }}>{fmtDate(e.entry_date)} · {Number(e.qty)} {e.unit} × {fmt(e.sp)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f' }}>{fmt(Number(e.qty) * Number(e.sp))}</div>
                          {e.cp != null && <div style={{ fontSize: 11, color: '#16a34a' }}>Profit: {fmt(Number(e.qty) * (Number(e.sp) - Number(e.cp)))}</div>}
                        </div>
                      </div>
                    ))}
                  </Card>
                )}

                {report.entries.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af', fontSize: 14 }}>No sales data for this period</div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── BOTTOM NAV ───────────────────────────────────────────────── */}
        <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 520, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(12px)', borderTop: '1px solid #e5e7eb', display: 'flex', zIndex: 50 }}>
          {NAV.map(n => (
            <button key={n.key} onClick={() => setTab(n.key)}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '9px 0 10px', background: 'none', border: 'none', cursor: 'pointer', position: 'relative' }}>
              {tab === n.key && <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 24, height: 2.5, background: '#1e3a5f', borderRadius: '0 0 3px 3px' }} />}
              <span style={{ fontSize: 20 }}>{n.icon}</span>
              <span style={{ fontSize: 10, marginTop: 2, fontWeight: tab === n.key ? 700 : 500, color: tab === n.key ? '#1e3a5f' : '#9ca3af', letterSpacing: '0.2px' }}>{n.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── SETTINGS MODAL ───────────────────────────────────────────── */}
      {showSettings && (
        <>
          <div onClick={() => setShowSettings(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200 }} />
          <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 520, background: '#fff', borderRadius: '20px 20px 0 0', padding: '24px 20px 36px', zIndex: 201, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>⚙️ Settings</h2>
              <button onClick={() => setShowSettings(false)}
                style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 14, cursor: 'pointer' }}>Done</button>
            </div>

            {/* Shop name */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Shop Name</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="text" value={settingShopName} onChange={e => setSettingShopName(e.target.value)}
                  style={{ flex: 1, padding: '12px 14px', border: '2px solid #e5e7eb', borderRadius: 10, fontSize: 16, outline: 'none' }} />
                <button onClick={saveShopName} disabled={settingSaving}
                  style={{ padding: '12px 18px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  Save
                </button>
              </div>
            </div>

            {/* Change password */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Change Password</label>
              <form onSubmit={changePassword}>
                <input type="password" placeholder="Current password" value={pwCurrent} onChange={e => setPwCurrent(e.target.value)} required
                  style={{ width: '100%', padding: '12px 14px', border: '2px solid #e5e7eb', borderRadius: 10, fontSize: 16, outline: 'none', marginBottom: 8 }} />
                <input type="password" placeholder="New password (min 4 chars)" value={pwNew} onChange={e => setPwNew(e.target.value)} required minLength={4}
                  style={{ width: '100%', padding: '12px 14px', border: '2px solid #e5e7eb', borderRadius: 10, fontSize: 16, outline: 'none', marginBottom: 10 }} />
                {pwMsg && <div style={{ padding: '8px 12px', borderRadius: 8, background: pwMsg.startsWith('✓') ? '#f0fdf4' : '#fef2f2', color: pwMsg.startsWith('✓') ? '#16a34a' : '#dc2626', fontSize: 14, marginBottom: 8 }}>{pwMsg}</div>}
                <button type="submit" style={{ width: '100%', padding: '12px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                  Update Password
                </button>
              </form>
            </div>

            {/* Logout */}
            <button onClick={logout}
              style={{ width: '100%', padding: '14px', background: '#fef2f2', color: '#dc2626', border: '1.5px solid #fecaca', borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
              Logout
            </button>
          </div>
        </>
      )}
    </>
  );
}
