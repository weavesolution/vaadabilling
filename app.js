'use strict';
/* Vaada & Associates – Billing PWA v1 · Built by Weave Solutions (weavesolution.com) */

const KEY = 'vaada_billing_v1';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r2 = n => Math.round((+n || 0) * 100) / 100;
const money = n => r2(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rs = n => '₹' + money(n);
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const fmtDate = iso => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${+d}-${MON[m - 1]}-${y}`; };
const fyOf = iso => { const [y, m] = iso.split('-').map(Number); const s = m >= 4 ? y : y - 1; return `${s}-${String((s + 1) % 100).padStart(2, '0')}`; };
const drcr = n => `${money(Math.abs(n))} ${n < 0 ? 'Cr' : 'Dr'}`;
const initials = s => (s || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

const DEF_SETTINGS = {
  firm: 'Vaada and Associates', tagline: 'Chartered Accountants',
  address: "Teacher's Colony, Kota, Raipur, C.G. 492001",
  email: '', phone: '', pan: '', gstin: '',
  gstDefault: false, gstRate: 18,
  bank: '', acno: '', ifsc: '', jurisdiction: 'Raipur', prefix: 'VA'
};
const DEF_SERVICES = [
  { name: 'Income Tax Return Filing', desc: 'ITR filing for the assessment year', sac: '998231', rate: 2000 },
  { name: 'GST Return Filing', desc: 'GSTR-1 & GSTR-3B', sac: '998231', rate: 1500 },
  { name: 'Audit Fees', desc: 'Tax / statutory audit', sac: '998221', rate: 10000 },
  { name: 'Accounting & Bookkeeping', desc: 'Monthly accounting', sac: '998222', rate: 3000 },
  { name: 'TDS Return Filing', desc: 'Quarterly TDS return', sac: '998231', rate: 1500 },
  { name: 'ROC / Company Compliance', desc: 'Annual filings with MCA', sac: '998221', rate: 5000 },
  { name: 'Professional Consultation', desc: '', sac: '998231', rate: 1000 }
];

/* ---------- Storage ---------- */
let db = load();
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d) return { settings: { ...DEF_SETTINGS, ...d.settings }, services: d.services || [], customers: d.customers || [], invoices: d.invoices || [], payments: d.payments || [] };
  } catch (e) {}
  return { settings: { ...DEF_SETTINGS }, services: DEF_SERVICES.map(s => ({ id: uid(), ...s })), customers: [], invoices: [], payments: [] };
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { toast('Could not save – phone storage may be full'); }
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

/* ---------- UI helpers ---------- */
const V = $('#view');
let toastT;
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400); }
function openModal(html, bind) {
  $('#sheet').innerHTML = html; $('#modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  $$('[data-close]', $('#sheet')).forEach(b => b.onclick = closeModal);
  bind && bind($('#sheet'));
}
function closeModal() { $('#modal').classList.add('hidden'); $('#sheet').innerHTML = ''; document.body.style.overflow = ''; }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
const sheetHead = t => `<div class="sheet-h"><h3>${t}</h3><button class="icon-btn" data-close aria-label="Close">✕</button></div>`;
const weave = () => `<a class="weave" href="https://weavesolution.com/" target="_blank" rel="noopener" title="Weave Solutions">
  <span>Built by</span><img src="assets/weave-logo.png" alt="Weave Solutions" onerror="this.outerHTML='<span class=wv>✦ Weave Solutions</span>'"></a>`;

/* ---------- Business logic ---------- */
function nextNo(date) {
  const fy = fyOf(date);
  const seq = db.invoices.filter(i => i.fy === fy).reduce((m, i) => Math.max(m, i.seq), 0) + 1;
  return { fy, seq, no: `${db.settings.prefix || 'INV'}/${fy}/${seq}` };
}
function custBalance(cid) {
  const c = db.customers.find(x => x.id === cid); let b = +(c?.opening || 0);
  db.invoices.forEach(i => { if (i.customerId === cid) b += i.total; });
  db.payments.forEach(p => { if (p.customerId === cid) b -= p.amount; });
  return r2(b);
}
function calc(items, tax, rate) {
  const sub = r2(items.reduce((a, i) => a + (+i.amount || 0), 0));
  let cgst = 0, sgst = 0, igst = 0;
  if (tax === 'intra') { cgst = r2(sub * rate / 200); sgst = cgst; }
  else if (tax === 'inter') igst = r2(sub * rate / 100);
  return { sub, cgst, sgst, igst, total: r2(sub + cgst + sgst + igst) };
}
function autoTax(gstin) {
  if (!db.settings.gstDefault) return 'none';
  const home = (db.settings.gstin || '22').slice(0, 2);
  return gstin && gstin.length >= 2 && gstin.slice(0, 2) !== home ? 'inter' : 'intra';
}
function inWords(n) {
  const A = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const B = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = x => x < 20 ? A[x] : B[Math.floor(x / 10)] + (x % 10 ? ' ' + A[x % 10] : '');
  const three = x => x >= 100 ? A[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' + two(x % 100) : '') : two(x);
  const w = x => {
    if (!x) return 'Zero';
    let s = ''; const cr = Math.floor(x / 1e7); x %= 1e7; const l = Math.floor(x / 1e5); x %= 1e5; const t = Math.floor(x / 1000); x %= 1000;
    if (cr) s += w(cr) + ' Crore '; if (l) s += two(l) + ' Lakh '; if (t) s += two(t) + ' Thousand '; if (x) s += three(x);
    return s.trim();
  };
  n = r2(Math.abs(n)); const r = Math.floor(n), p = Math.round((n - r) * 100);
  return 'INR ' + w(r) + (p ? ' and ' + two(p) + ' Paise' : '') + ' Only';
}
const CF = ['name', 'address', 'city', 'pincode', 'phone', 'email', 'pan', 'gstin'];
const cleanCust = c => Object.fromEntries(CF.map(k => [k, String(c[k] || '').trim()]));

/* ---------- Navigation ---------- */
const TITLES = { bill: 'New Bill', invoices: 'Invoices', customers: 'Customers', services: 'Services', settings: 'Settings' };
let current = 'bill';
function go(v) {
  current = v; $('#pageTitle').textContent = TITLES[v];
  $$('.bottom button').forEach(b => b.classList.toggle('on', b.dataset.go === v));
  window.scrollTo(0, 0);
  ({ bill: viewBill, invoices: viewInvoices, customers: viewCustomers, services: viewServices, settings: viewSettings })[v]();
}
$$('.bottom button').forEach(b => b.onclick = () => go(b.dataset.go));
$('#btnSettings').onclick = () => go('settings');

/* ================= BILL ================= */
let draft = null;
function newDraft(cust) {
  const c = cust ? cleanCust(cust) : cleanCust({});
  draft = { date: todayISO(), customerId: cust?.id || null, cust: c, items: {}, tax: autoTax(c.gstin), taxManual: false };
}
function selItems() {
  return db.services.filter(s => draft.items[s.id]?.on).map(s => ({
    serviceId: s.id, name: s.name, sac: s.sac || '', desc: (draft.items[s.id].desc || '').trim(), amount: r2(draft.items[s.id].amount)
  }));
}
function viewBill() {
  if (!draft) newDraft();
  const d = draft, c = d.cust;
  V.innerHTML = `
  <section class="card">
    <div class="row2">
      <label>Invoice date<input type="date" id="bDate" value="${d.date}"></label>
      <label>Invoice no.<input id="bNo" readonly value="${esc(nextNo(d.date).no)}"></label>
    </div>
  </section>
  <section class="card">
    <h3>Customer <button class="link" id="pickCust">Choose saved</button></h3>
    <div id="custBadge"></div>
    <label>Name / Firm *<input id="c_name" list="custList" autocomplete="off" value="${esc(c.name)}" placeholder="e.g. Alpha Automation Pvt. Ltd."></label>
    <datalist id="custList">${db.customers.map(x => `<option value="${esc(x.name)}">${esc(x.phone || x.city || '')}</option>`).join('')}</datalist>
    <label>Address<textarea id="c_address" rows="2">${esc(c.address)}</textarea></label>
    <div class="row2">
      <label>City<input id="c_city" value="${esc(c.city)}"></label>
      <label>Pincode<input id="c_pincode" inputmode="numeric" maxlength="6" value="${esc(c.pincode)}"></label>
    </div>
    <div class="row2">
      <label>Mobile<input id="c_phone" inputmode="tel" value="${esc(c.phone)}"></label>
      <label>PAN<input id="c_pan" maxlength="10" style="text-transform:uppercase" value="${esc(c.pan)}"></label>
    </div>
    <label style="margin:0">GSTIN <span class="muted">(optional)</span><input id="c_gstin" maxlength="15" style="text-transform:uppercase" value="${esc(c.gstin)}"></label>
  </section>
  <section class="card">
    <h3>Services <button class="link" data-goto="services">Manage</button></h3>
    <div id="svcPick">${db.services.length ? db.services.map(svcRow).join('') : `<div class="muted">No services yet. Add some in the Services tab.</div>`}</div>
  </section>
  <section class="card">
    <h3>GST</h3>
    <div class="seg" id="taxSeg">
      <button data-t="none">No GST</button><button data-t="intra">CGST + SGST</button><button data-t="inter">IGST</button>
    </div>
  </section>
  <section class="card sum" id="sum"></section>
  <button class="btn primary block" id="btnSave">
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7"/></svg>
    Save &amp; Print</button>
  <div style="text-align:center;margin-top:10px"><button class="link" id="btnClear">Clear form</button></div>
  ${weave()}`;

  $('#bDate').onchange = e => { d.date = e.target.value || todayISO(); $('#bNo').value = nextNo(d.date).no; };
  CF.forEach(k => { const el = $('#c_' + k); if (el) el.oninput = () => { c[k] = (k === 'pan' || k === 'gstin') ? el.value.toUpperCase() : el.value; if (k === 'name') matchCust(); if (k === 'gstin' && !d.taxManual) { d.tax = autoTax(c.gstin); paintTax(); } }; });
  $('#pickCust').onclick = chooseCustomer;
  $('[data-goto]', V).onclick = () => go('services');
  $$('.svc', V).forEach(row => {
    const id = row.dataset.id, s = db.services.find(x => x.id === id);
    const cb = $('input[type=checkbox]', row), amt = $('.amt', row), ds = $('.desc', row);
    cb.onchange = () => {
      const it = d.items[id] || (d.items[id] = { amount: s.rate, desc: s.desc || '' });
      it.on = cb.checked; row.classList.toggle('on', cb.checked); amt.value = it.amount; ds.value = it.desc; recalc();
    };
    amt.oninput = () => { d.items[id].amount = amt.value; recalc(); };
    ds.oninput = () => { d.items[id].desc = ds.value; };
  });
  $$('#taxSeg button').forEach(b => b.onclick = () => { d.tax = b.dataset.t; d.taxManual = true; paintTax(); });
  $('#btnSave').onclick = saveBill;
  $('#btnClear').onclick = () => { if (confirm('Clear this bill?')) { draft = null; viewBill(); } };
  paintTax(); paintBadge();
}
function svcRow(s) {
  const it = draft.items[s.id];
  return `<div class="svc ${it?.on ? 'on' : ''}" data-id="${s.id}">
    <label class="chk"><input type="checkbox" ${it?.on ? 'checked' : ''}>
      <span><b>${esc(s.name)}</b>${s.desc ? `<small>${esc(s.desc)}</small>` : ''}</span>
      <span class="rate">${rs(s.rate)}</span></label>
    <div class="more"><input class="desc" placeholder="Details (e.g. for FY 2025-26)" value="${esc(it?.desc ?? s.desc ?? '')}">
      <input class="amt" type="number" inputmode="decimal" min="0" step="0.01" value="${it?.amount ?? s.rate}"></div></div>`;
}
function paintTax() { $$('#taxSeg button').forEach(b => b.classList.toggle('on', b.dataset.t === draft.tax)); recalc(); }
function recalc() {
  const t = calc(selItems(), draft.tax, +db.settings.gstRate || 18);
  const prev = draft.customerId ? custBalance(draft.customerId) : 0, rate = +db.settings.gstRate || 18;
  $('#sum').innerHTML = `
    <div><span>Services total</span><span>${rs(t.sub)}</span></div>
    ${t.cgst ? `<div><span>CGST @ ${rate / 2}%</span><span>${rs(t.cgst)}</span></div><div><span>SGST @ ${rate / 2}%</span><span>${rs(t.sgst)}</span></div>` : ''}
    ${t.igst ? `<div><span>IGST @ ${rate}%</span><span>${rs(t.igst)}</span></div>` : ''}
    <div class="total"><span>Bill amount</span><span>${rs(t.total)}</span></div>
    <div><span>Previous balance</span><span>${drcr(prev)}</span></div>
    <div class="net"><span>Net balance</span><span>${drcr(prev + t.total)}</span></div>`;
}
function matchCust() {
  const n = draft.cust.name.trim().toLowerCase();
  const m = n && db.customers.find(x => x.name.trim().toLowerCase() === n);
  if (m && m.id !== draft.customerId) { fillCust(m); }
  else if (!m && draft.customerId) { draft.customerId = null; paintBadge(); recalc(); }
}
function fillCust(m) {
  draft.customerId = m.id; draft.cust = cleanCust(m);
  CF.forEach(k => { const el = $('#c_' + k); if (el && k !== 'name') el.value = draft.cust[k]; });
  $('#c_name').value = m.name;
  if (!draft.taxManual) draft.tax = autoTax(draft.cust.gstin);
  paintTax(); paintBadge();
}
function paintBadge() {
  const b = $('#custBadge'); if (!b) return;
  b.innerHTML = draft.customerId ? `<span class="badge">Saved customer · Balance ${drcr(custBalance(draft.customerId))}</span>` : (draft.cust.name.trim() ? `<span class="badge">New customer – will be saved</span>` : '');
}
function chooseCustomer() {
  const list = [...db.customers].sort((a, b) => a.name.localeCompare(b.name));
  openModal(sheetHead('Choose customer') + `<input class="search" id="cq" placeholder="Search name or mobile">
    <div id="cl"></div>`, sh => {
    const paint = q => {
      q = q.toLowerCase();
      const f = list.filter(c => !q || c.name.toLowerCase().includes(q) || (c.phone || '').includes(q));
      $('#cl', sh).innerHTML = f.length ? f.map(c => `<div class="item" data-id="${c.id}"><div class="avatar">${esc(initials(c.name))}</div><div class="grow"><div class="t">${esc(c.name)}</div><div class="s">${esc([c.phone, c.city].filter(Boolean).join(' · '))}</div></div></div>`).join('') : `<div class="empty">No customers found</div>`;
      $$('.item', sh).forEach(el => el.onclick = () => { closeModal(); fillCust(db.customers.find(x => x.id === el.dataset.id)); });
    };
    $('#cq', sh).oninput = e => paint(e.target.value); paint('');
  });
}
function saveBill() {
  const c = cleanCust(draft.cust);
  if (!c.name) return toast('Enter customer name');
  const items = selItems();
  if (!items.length) return toast('Select at least one service');
  if (items.some(i => !(i.amount > 0))) return toast('Enter amount for every selected service');
  let cust = draft.customerId && db.customers.find(x => x.id === draft.customerId);
  if (cust) Object.assign(cust, c);
  else { cust = { id: uid(), opening: 0, createdAt: Date.now(), ...c }; db.customers.push(cust); }
  const n = nextNo(draft.date), rate = +db.settings.gstRate || 18, t = calc(items, draft.tax, rate);
  const prev = custBalance(cust.id);
  const s = db.settings;
  const inv = {
    id: uid(), no: n.no, seq: n.seq, fy: n.fy, date: draft.date, createdAt: Date.now(),
    customerId: cust.id, cust: c, items, tax: draft.tax, rate, ...t,
    prevBalance: prev, netBalance: r2(prev + t.total),
    firm: { firm: s.firm, tagline: s.tagline, address: s.address, email: s.email, phone: s.phone, pan: s.pan, gstin: s.gstin, bank: s.bank, acno: s.acno, ifsc: s.ifsc, jurisdiction: s.jurisdiction }
  };
  db.invoices.push(inv); save();
  draft = null; viewBill();
  toast(`Invoice ${inv.no} saved`);
  printInvoice(inv);
}

/* ================= INVOICE RENDER / PRINT ================= */
function invoiceHTML(inv) {
  const f = inv.firm || db.settings, c = inv.cust;
  let n = 0;
  const rows = inv.items.map(i => `<tr><td class="c1">${++n}</td><td><b>${esc(i.name)}</b>${i.desc ? `<span class="sub">${esc(i.desc)}</span>` : ''}${i.sac && inv.tax !== 'none' ? `<span class="sub">SAC: ${esc(i.sac)}</span>` : ''}</td><td class="c3">${money(i.amount)}</td></tr>`);
  if (inv.cgst) { rows.push(`<tr><td class="c1">${++n}</td><td><b>CGST @ ${inv.rate / 2}%</b></td><td class="c3">${money(inv.cgst)}</td></tr>`, `<tr><td class="c1">${++n}</td><td><b>SGST @ ${inv.rate / 2}%</b></td><td class="c3">${money(inv.sgst)}</td></tr>`); }
  if (inv.igst) rows.push(`<tr><td class="c1">${++n}</td><td><b>IGST @ ${inv.rate}%</b></td><td class="c3">${money(inv.igst)}</td></tr>`);
  const filler = Math.max(40, 420 - n * 34);
  const cityLine = [esc(c.city), c.pincode && 'Pincode : ' + esc(c.pincode)].filter(Boolean).join(' &nbsp; ');
  return `<div class="invoice"><div class="box">
    <div class="ih"><img src="assets/logo.png" alt="">
      <div class="t"><h1>${esc(f.firm)}</h1><div class="tag">${esc((f.tagline || '').toUpperCase())}</div>
      <div>${esc(f.address)}</div>${f.email || f.phone ? `<div>${[f.email && 'E-Mail : ' + esc(f.email), f.phone && 'Ph : ' + esc(f.phone)].filter(Boolean).join(' &nbsp;|&nbsp; ')}</div>` : ''}</div></div>
    <div class="ttl">${inv.tax !== 'none' || f.gstin ? 'TAX INVOICE' : 'INVOICE'}</div>
    <div class="g2"><div>To,<br><b>${esc(c.name)}</b>${c.address ? '<br>' + esc(c.address).replace(/\n/g, '<br>') : ''}${cityLine ? '<br>' + cityLine : ''}
      ${c.phone ? '<br>Mobile : ' + esc(c.phone) : ''}${c.pan ? '<br>PAN No. : ' + esc(c.pan) : ''}${c.gstin ? '<br>GSTIN : ' + esc(c.gstin) : ''}</div>
      <div><table class="meta"><tr><td>Invoice No.</td><td>: <b>${esc(inv.no)}</b></td></tr><tr><td>Invoice Date</td><td>: <b>${fmtDate(inv.date)}</b></td></tr></table></div></div>
    <div class="fees">Fees for Professional Services rendered as under :-</div>
    <table class="it"><thead><tr><th class="c1">No.</th><th>Particulars</th><th class="c3">Amount (Rs.)</th></tr></thead>
      <tbody>${rows.join('')}<tr><td class="c1" style="height:${filler}px"></td><td></td><td></td></tr></tbody>
      <tfoot><tr><td></td><td style="text-align:right">Total</td><td class="c3">₹ ${money(inv.total)}</td></tr></tfoot></table>
    <div class="g2" style="border-top:1.2px solid #222"><div>Amount in Words (INR)<br><b>${inWords(inv.total)}</b></div>
      <div><table class="bal"><tr><td>Prev Balance</td><td><b>${drcr(inv.prevBalance)}</b></td></tr><tr><td>Bill Amount</td><td class="u"><b>${drcr(inv.total)}</b></td></tr><tr><td>Net Balance</td><td class="u"><b>${drcr(inv.netBalance)}</b></td></tr></table></div></div>
    ${f.pan || f.gstin || f.bank || f.acno ? `<div class="g2"><div>${f.pan ? `PAN No. &nbsp;: <b>${esc(f.pan)}</b><br>` : ''}${f.gstin ? `GSTIN &nbsp;&nbsp;&nbsp;: <b>${esc(f.gstin)}</b>` : ''}</div>
      <div>${f.bank || f.acno ? `Bank Details :<br><b>${esc(f.bank)}</b><br><b>A/c No. ${esc(f.acno)}</b>${f.ifsc ? `<br><b>IFSC Code: ${esc(f.ifsc)}</b>` : ''}` : ''}</div></div>` : ''}
    <div class="g2 sign"><div>(1) Subject to ${esc(f.jurisdiction || 'Raipur')} Jurisdiction.</div>
      <div class="r"><b>For ${esc(f.firm)}</b><span>Authorised Signatory</span></div></div>
  </div><div class="foot">This is a computer generated invoice.</div></div>`;
}
function printInvoice(inv) {
  const p = $('#print'); p.innerHTML = invoiceHTML(inv);
  const oldTitle = document.title; document.title = `Invoice ${inv.no.replace(/\//g, '-')} ${inv.cust.name}`;
  const img = $('img', p);
  const go = () => setTimeout(() => { window.print(); setTimeout(() => { document.title = oldTitle; }, 500); }, 150);
  img && !img.complete ? (img.onload = img.onerror = go) : go();
}
function fitPreview(sh) {
  const box = $('.preview', sh), inv = $('.invoice', box);
  if (box && inv) inv.style.zoom = (box.clientWidth / 794).toFixed(3);
}

/* ================= INVOICES ================= */
function viewInvoices() {
  const fy = fyOf(todayISO());
  const thisFY = db.invoices.filter(i => i.fy === fy);
  V.innerHTML = `
    <div class="stats"><div class="stat"><small>Invoices FY ${fy}</small><b>${thisFY.length}</b></div>
      <div class="stat"><small>Billed FY ${fy}</small><b>${rs(thisFY.reduce((a, i) => a + i.total, 0))}</b></div></div>
    <input class="search" id="iq" placeholder="Search invoice no. or customer">
    <div id="il"></div>`;
  const paint = q => {
    q = q.toLowerCase();
    const list = [...db.invoices].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
      .filter(i => !q || i.no.toLowerCase().includes(q) || i.cust.name.toLowerCase().includes(q));
    $('#il').innerHTML = list.length ? list.map(i => `<div class="item" data-id="${i.id}"><div class="grow"><div class="t">${esc(i.cust.name)}</div>
      <div class="s">${esc(i.no)} · ${fmtDate(i.date)}</div></div><div class="amt">${rs(i.total)}<small>${i.items.length} service${i.items.length > 1 ? 's' : ''}</small></div></div>`).join('')
      : `<div class="empty">${db.invoices.length ? 'No matching invoices' : 'No invoices yet.<br>Make your first bill from the Bill tab.'}</div>`;
    $$('#il .item').forEach(el => el.onclick = () => openInvoice(el.dataset.id));
  };
  $('#iq').oninput = e => paint(e.target.value); paint('');
}
function openInvoice(id) {
  const inv = db.invoices.find(i => i.id === id); if (!inv) return;
  openModal(sheetHead(esc(inv.no)) + `<div class="preview">${invoiceHTML(inv)}</div>
    <div class="actions"><button class="btn primary" data-a="print">Print / PDF</button><button class="btn" data-a="share">Share</button><button class="btn danger" data-a="del">Delete</button></div>`, sh => {
    fitPreview(sh);
    $('[data-a=print]', sh).onclick = () => printInvoice(inv);
    $('[data-a=share]', sh).onclick = () => shareInvoice(inv);
    $('[data-a=del]', sh).onclick = () => {
      if (!confirm(`Delete invoice ${inv.no}? This cannot be undone.`)) return;
      db.invoices = db.invoices.filter(i => i.id !== id); save(); closeModal(); toast('Invoice deleted');
      current === 'customers' ? viewCustomers() : viewInvoices();
    };
  });
}
function shareInvoice(inv) {
  const text = `Dear ${inv.cust.name},\nInvoice ${inv.no} dated ${fmtDate(inv.date)}\nBill amount: ${rs(inv.total)}\nNet balance: ${rs(inv.netBalance)}\n\nRegards,\n${(inv.firm || db.settings).firm}`;
  const ph = (inv.cust.phone || '').replace(/\D/g, '').slice(-10);
  if (ph.length === 10) window.open(`https://wa.me/91${ph}?text=${encodeURIComponent(text)}`, '_blank');
  else if (navigator.share) navigator.share({ text }).catch(() => {});
  else { navigator.clipboard?.writeText(text); toast('Copied to clipboard'); }
}

/* ================= CUSTOMERS ================= */
function viewCustomers() {
  V.innerHTML = `<input class="search" id="cq" placeholder="Search name, mobile or city"><div id="cl"></div>
    <button class="fab" id="addCust">+ Customer</button>`;
  const paint = q => {
    q = q.toLowerCase();
    const list = [...db.customers].sort((a, b) => a.name.localeCompare(b.name))
      .filter(c => !q || [c.name, c.phone, c.city].some(v => (v || '').toLowerCase().includes(q)));
    $('#cl').innerHTML = list.length ? list.map(c => { const b = custBalance(c.id); return `<div class="item" data-id="${c.id}"><div class="avatar">${esc(initials(c.name))}</div>
      <div class="grow"><div class="t">${esc(c.name)}</div><div class="s">${esc([c.phone, c.city].filter(Boolean).join(' · ') || '—')}</div></div>
      <div class="amt ${b > 0 ? 'dr' : b < 0 ? 'cr' : ''}">${money(Math.abs(b))}<small>${b > 0 ? 'Due' : b < 0 ? 'Advance' : 'Settled'}</small></div></div>`; }).join('')
      : `<div class="empty">${db.customers.length ? 'No matching customers' : 'No customers yet.<br>They are saved automatically when you make a bill.'}</div>`;
    $$('#cl .item').forEach(el => el.onclick = () => openCustomer(el.dataset.id));
  };
  $('#cq').oninput = e => paint(e.target.value); paint('');
  $('#addCust').onclick = () => openCustomer(null);
}
function custForm(c) {
  const f = (k, l, extra = '') => `<label>${l}<input id="f_${k}" value="${esc(c[k] ?? '')}" ${extra}></label>`;
  return `<section class="card">
    ${f('name', 'Name / Firm *')}
    <label>Address<textarea id="f_address" rows="2">${esc(c.address || '')}</textarea></label>
    <div class="row2">${f('city', 'City')}${f('pincode', 'Pincode', 'inputmode="numeric" maxlength="6"')}</div>
    <div class="row2">${f('phone', 'Mobile', 'inputmode="tel"')}${f('email', 'Email', 'type="email"')}</div>
    <div class="row2">${f('pan', 'PAN', 'maxlength="10" style="text-transform:uppercase"')}${f('gstin', 'GSTIN', 'maxlength="15" style="text-transform:uppercase"')}</div>
    <label style="margin:0">Opening balance (₹ due before using app)<input id="f_opening" type="number" inputmode="decimal" step="0.01" value="${+c.opening || 0}"></label>
  </section>`;
}
function readCustForm(sh) {
  const o = {}; CF.forEach(k => o[k] = $('#f_' + k, sh).value.trim()); o.pan = o.pan.toUpperCase(); o.gstin = o.gstin.toUpperCase();
  o.opening = r2($('#f_opening', sh).value); return o;
}
function openCustomer(id) {
  const c = id ? db.customers.find(x => x.id === id) : {};
  if (!id) {
    return openModal(sheetHead('New customer') + custForm(c) + `<button class="btn primary block" id="sv">Save customer</button>`, sh => {
      $('#sv', sh).onclick = () => { const o = readCustForm(sh); if (!o.name) return toast('Enter name'); db.customers.push({ id: uid(), createdAt: Date.now(), ...o }); save(); closeModal(); viewCustomers(); toast('Customer saved'); };
    });
  }
  const invs = db.invoices.filter(i => i.customerId === id), pays = db.payments.filter(p => p.customerId === id);
  const tx = [...invs.map(i => ({ d: i.date, t: i.createdAt, html: `<div class="tx" data-inv="${i.id}" style="cursor:pointer"><span>${fmtDate(i.date)} · <b>${esc(i.no)}</b></span><span class="dr">+ ${money(i.total)}</span></div>` })),
    ...pays.map(p => ({ d: p.date, t: p.createdAt, html: `<div class="tx"><span>${fmtDate(p.date)} · Received${p.note ? ' – ' + esc(p.note) : ''} <button class="link danger" data-delpay="${p.id}">✕</button></span><span class="cr">− ${money(p.amount)}</span></div>` }))]
    .sort((a, b) => b.d.localeCompare(a.d) || b.t - a.t);
  const bal = custBalance(id);
  openModal(sheetHead(esc(c.name)) + `
    <div class="stats"><div class="stat"><small>Balance</small><b class="${bal > 0 ? 'dr' : bal < 0 ? 'cr' : ''}">${drcr(bal)}</b></div>
      <div class="stat"><small>Total billed</small><b>${rs(invs.reduce((a, i) => a + i.total, 0))}</b></div></div>
    <div class="actions" style="margin-bottom:12px"><button class="btn primary" id="nb">New bill</button><button class="btn" id="rp">Receive payment</button></div>
    <section class="card"><h3>Ledger</h3>${tx.length ? tx.map(x => x.html).join('') : '<div class="muted">No transactions yet</div>'}
      ${+c.opening ? `<div class="tx"><span>Opening balance</span><span>${drcr(+c.opening)}</span></div>` : ''}</section>
    <h3 style="font-size:13px;color:var(--taupe);text-transform:uppercase;letter-spacing:.7px;margin:16px 2px 8px">Details</h3>
    ${custForm(c)}
    <div class="actions"><button class="btn primary" id="sv">Save changes</button><button class="btn danger" id="del">Delete</button></div>`, sh => {
    $('#nb', sh).onclick = () => { closeModal(); newDraft(c); go('bill'); };
    $('#rp', sh).onclick = () => receivePayment(c);
    $$('[data-inv]', sh).forEach(el => el.onclick = () => openInvoice(el.dataset.inv));
    $$('[data-delpay]', sh).forEach(b => b.onclick = e => { e.stopPropagation(); if (!confirm('Delete this payment entry?')) return; db.payments = db.payments.filter(p => p.id !== b.dataset.delpay); save(); openCustomer(id); viewCustomers(); });
    $('#sv', sh).onclick = () => { const o = readCustForm(sh); if (!o.name) return toast('Enter name'); Object.assign(c, o); save(); closeModal(); viewCustomers(); toast('Saved'); };
    $('#del', sh).onclick = () => {
      if (invs.length || pays.length) return toast('This customer has invoices/payments – delete those first');
      if (!confirm('Delete ' + c.name + '?')) return;
      db.customers = db.customers.filter(x => x.id !== id); save(); closeModal(); viewCustomers(); toast('Customer deleted');
    };
  });
}
function receivePayment(c) {
  openModal(sheetHead('Receive payment – ' + esc(c.name)) + `<section class="card">
    <div class="row2"><label>Date<input type="date" id="pd" value="${todayISO()}"></label><label>Amount (₹)<input type="number" inputmode="decimal" id="pa" step="0.01"></label></div>
    <label style="margin:0">Note<input id="pn" placeholder="e.g. UPI / Cheque no."></label></section>
    <button class="btn primary block" id="ps">Save payment</button>`, sh => {
    $('#pa', sh).focus();
    $('#ps', sh).onclick = () => {
      const amt = r2($('#pa', sh).value); if (!(amt > 0)) return toast('Enter amount');
      db.payments.push({ id: uid(), customerId: c.id, date: $('#pd', sh).value || todayISO(), amount: amt, note: $('#pn', sh).value.trim(), createdAt: Date.now() });
      save(); toast('Payment recorded'); openCustomer(c.id); viewCustomers();
    };
  });
}

/* ================= SERVICES ================= */
function viewServices() {
  V.innerHTML = `${db.services.length ? db.services.map(s => `<div class="item" data-id="${s.id}"><div class="grow"><div class="t">${esc(s.name)}</div>
    <div class="s">${esc([s.desc, s.sac && 'SAC ' + s.sac].filter(Boolean).join(' · ') || '—')}</div></div><div class="amt">${rs(s.rate)}<small>tap to edit</small></div></div>`).join('')
    : `<div class="empty">No services yet.</div>`}
    <button class="fab" id="addSvc">+ Service</button>`;
  $$('.item', V).forEach(el => el.onclick = () => editService(el.dataset.id));
  $('#addSvc').onclick = () => editService(null);
}
function editService(id) {
  const s = id ? db.services.find(x => x.id === id) : { name: '', desc: '', sac: '', rate: '' };
  openModal(sheetHead(id ? 'Edit service' : 'New service') + `<section class="card">
    <label>Service name *<input id="sn" value="${esc(s.name)}"></label>
    <label>Default details <span class="muted">(printed under name)</span><input id="sd" value="${esc(s.desc)}"></label>
    <div class="row2"><label style="margin:0">Default fee (₹)<input id="sr" type="number" inputmode="decimal" step="0.01" value="${s.rate}"></label>
    <label style="margin:0">SAC code<input id="ss" inputmode="numeric" value="${esc(s.sac)}"></label></div></section>
    <div class="actions"><button class="btn primary" id="sv">Save</button>${id ? '<button class="btn danger" id="del">Delete</button>' : ''}</div>`, sh => {
    $('#sn', sh).focus();
    $('#sv', sh).onclick = () => {
      const o = { name: $('#sn', sh).value.trim(), desc: $('#sd', sh).value.trim(), rate: r2($('#sr', sh).value), sac: $('#ss', sh).value.trim() };
      if (!o.name) return toast('Enter service name');
      id ? Object.assign(s, o) : db.services.push({ id: uid(), ...o });
      save(); closeModal(); viewServices(); toast('Service saved');
    };
    if (id) $('#del', sh).onclick = () => {
      if (!confirm(`Delete "${s.name}"? Past invoices are not affected.`)) return;
      db.services = db.services.filter(x => x.id !== id); if (draft) delete draft.items[id];
      save(); closeModal(); viewServices(); toast('Service deleted');
    };
  });
}

/* ================= SETTINGS ================= */
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (current === 'settings') viewSettings(); });
function viewSettings() {
  const s = db.settings;
  const f = (k, l, extra = '') => `<label>${l}<input id="s_${k}" value="${esc(s[k] ?? '')}" ${extra}></label>`;
  V.innerHTML = `
    ${installEvt ? `<button class="btn primary block" id="inst" style="margin-bottom:12px">Install app on this phone</button>` : ''}
    <section class="card"><h3>Firm details (printed on invoice)</h3>
      ${f('firm', 'Firm name')}${f('tagline', 'Tagline')}
      <label>Address<textarea id="s_address" rows="2">${esc(s.address)}</textarea></label>
      <div class="row2">${f('email', 'Email', 'type="email"')}${f('phone', 'Phone', 'inputmode="tel"')}</div>
      <div class="row2">${f('pan', 'PAN', 'maxlength="10" style="text-transform:uppercase"')}${f('gstin', 'GSTIN', 'maxlength="15" style="text-transform:uppercase"')}</div>
      ${f('jurisdiction', 'Jurisdiction city', 'style="margin-bottom:0"')}</section>
    <section class="card"><h3>Bank details</h3>
      ${f('bank', 'Bank & branch')}<div class="row2">${f('acno', 'A/c No.', 'inputmode="numeric"')}${f('ifsc', 'IFSC', 'style="text-transform:uppercase"')}</div></section>
    <section class="card"><h3>Billing</h3>
      <div class="row2">${f('prefix', 'Invoice prefix')}${f('gstRate', 'GST rate %', 'type="number" inputmode="decimal"')}</div>
      <label class="chk" style="display:flex;gap:10px;align-items:center;margin:0;color:var(--ink)"><input type="checkbox" id="s_gstDefault" ${s.gstDefault ? 'checked' : ''} style="width:20px;height:20px;margin:0;accent-color:var(--ink)"> Apply GST by default on new bills</label></section>
    <button class="btn primary block" id="ss">Save settings</button>
    <section class="card" style="margin-top:14px"><h3>Backup</h3>
      <p class="muted" style="margin-top:0">Data is stored on this phone only. Take a backup regularly and keep it safe (Drive / WhatsApp to self).</p>
      <div class="actions"><button class="btn" id="exp">Download backup</button><button class="btn" id="imp">Restore backup</button></div>
      <input type="file" id="impf" accept="application/json,.json" hidden></section>
    <p class="muted" style="text-align:center">${db.invoices.length} invoices · ${db.customers.length} customers · v1.0</p>
    ${weave()}`;
  $('#ss').onclick = () => {
    Object.keys(DEF_SETTINGS).forEach(k => { const el = $('#s_' + k); if (!el) return; s[k] = el.type === 'checkbox' ? el.checked : el.value.trim(); });
    s.pan = s.pan.toUpperCase(); s.gstin = s.gstin.toUpperCase(); s.ifsc = s.ifsc.toUpperCase(); s.gstRate = +s.gstRate || 18;
    save(); draft = null; toast('Settings saved');
  };
  $('#inst') && ($('#inst').onclick = () => { installEvt.prompt(); installEvt = null; });
  $('#exp').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(db, null, 1)], { type: 'application/json' }));
    a.download = `vaada-backup-${todayISO()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  $('#imp').onclick = () => $('#impf').click();
  $('#impf').onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const d = JSON.parse(rd.result);
        if (!Array.isArray(d.invoices) || !Array.isArray(d.customers)) throw 0;
        if (!confirm(`Restore backup with ${d.invoices.length} invoices? Current data on this phone will be replaced.`)) return;
        localStorage.setItem(KEY, JSON.stringify(d)); db = load(); draft = null; toast('Backup restored'); viewSettings();
      } catch (_) { toast('Not a valid backup file'); }
    };
    rd.readAsText(file);
  };
}

/* ---------- Start ---------- */
go('bill');
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
