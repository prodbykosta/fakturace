/* =====================================================================
   Fakturace — moderní lokální fakturační systém
   Data se ukládají do localStorage prohlížeče. Podporuje více firem (profilů).
   ===================================================================== */

let PROFILES = (() => {
  try {
    const p = localStorage.getItem("fakturace_profiles");
    return p ? JSON.parse(p) : [{ id: "fakturace_v1", name: "Hlavní firma" }];
  } catch (e) { return [{ id: "fakturace_v1", name: "Hlavní firma" }]; }
})();
function saveProfiles() { localStorage.setItem("fakturace_profiles", JSON.stringify(PROFILES)); }

let STORE_KEY = localStorage.getItem("fakturace_active_profile") || "fakturace_v1";

/* ---------------- Úložiště ---------------- */
function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.error("Chyba čtení dat:", e); }
  return { settings: defaultSettings(), clients: [], invoices: [] };
}
function saveStore() { localStorage.setItem(STORE_KEY, JSON.stringify(store)); }
function defaultSettings() {
  return {
    name: "", street: "", city: "", zip: "", ico: "", dic: "", vatPayer: false,
    bankAccount: "", iban: "", swift: "", web: "", phone: "", email: "",
    dueDays: 14, incomeBasis: "issued", footerNote: "", ollamaUrl: "http://localhost:11434", ollamaModel: "",
    smtpHost: "", smtpPort: 465, smtpUser: "", smtpPass: "", smtpFrom: "", smtpReplyTo: "",
    accentColor: "#d97706", invoiceTemplate: "classic", darkMode: false, logo: "", stamp: "",
    invoiceNumberFormat: ""
  };
}
let store = loadStore();
store.settings = { ...defaultSettings(), ...store.settings };
/* tmavý režim nasadit hned na startu skriptu, ať světlá barva neproblikne */
if (store.settings.darkMode) document.body.classList.add("dark");
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/* ---------------- Pomocné funkce ---------------- */
const CURRENCY_SYMBOLS = { CZK: ' Kč', EUR: ' €', USD: ' $', GBP: ' £' };
const fmtMoney = (n, cur = 'CZK') => n.toLocaleString("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (CURRENCY_SYMBOLS[cur] || ' ' + cur);
const fmtDate = iso => { const [y, m, d] = iso.split("-"); return `${d}. ${m}. ${y}`; };
/* lokální datum jako YYYY-MM-DD (toISOString by v ČR posouvalo den kvůli UTC) */
const toISODate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayISO = () => toISODate(new Date());
const addDaysISO = (iso, days) => {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + Number(days));
  return toISODate(d);
};
const stripDiacritics = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const escXml = s => String(s ?? "").replace(/[<>&'"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));
const escHtml = s => String(s ?? "").replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));

/* ---------------- SVG ikony (styl Feather — tah 2px) ---------------- */
const ICONS = {
  "file-text": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  ai: '<path d="M12 3l1.7 4.8L18.5 9.5l-4.8 1.7L12 16l-1.7-4.8L5.5 9.5l4.8-1.7z"/><path d="M19 14l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z"/>',
  convert: '<path d="M8 3L4 7l4 4"/><path d="M4 7h16"/><path d="M16 21l4-4-4-4"/><path d="M20 17H4"/>',
  printer: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  "arrow-left": '<path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  paperclip: '<path d="M21.4 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  repeat: '<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  sliders: '<path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M1 14h6"/><path d="M9 8h6"/><path d="M17 16h6"/>',
  mail: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  minus: '<line x1="5" y1="12" x2="19" y2="12"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>'
};
const icon = name => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;

/* Český IBAN z čísla účtu ve tvaru [prefix-]číslo/kód_banky */
function czIban(account) {
  const m = String(account).trim().match(/^(?:(\d{0,6})-)?(\d{2,10})\/(\d{4})$/);
  if (!m) return "";
  const prefix = (m[1] || "").padStart(6, "0");
  const number = m[2].padStart(10, "0");
  const bank = m[3];
  const bban = bank + prefix + number;
  // kontrolní číslice: mod 97 přes BBAN + "CZ00" (C=12, Z=35)
  const numeric = bban + "123500";
  let rem = 0;
  for (const ch of numeric) rem = (rem * 10 + Number(ch)) % 97;
  const check = String(98 - rem).padStart(2, "0");
  return "CZ" + check + bban;
}

/* QR Platba — SPAYD řetězec (standard České bankovní asociace) */
function spayd(inv, client, settings) {
  if ((inv.currency || 'CZK') !== 'CZK') return ""; /* SPAYD jen pro CZK */
  const iban = settings.iban || czIban(settings.bankAccount);
  if (!iban) return "";
  const msg = stripDiacritics(client ? client.name : "").toUpperCase().replace(/[^A-Z0-9 -]/g, "").slice(0, 60);
  const parts = [`SPD*1.0*ACC:${iban}`, `AM:${invoiceTotal(inv).total.toFixed(2)}`, "CC:CZK"];
  if (inv.vs) parts.push(`X-VS:${inv.vs}`);
  if (msg) parts.push(`MSG:${msg}`);
  return parts.join("*");
}
/* SEPA EPC QR pro EUR faktury */
function sepaEpcQr(inv, client, settings) {
  if ((inv.currency || 'CZK') !== 'EUR') return "";
  const iban = settings.ibanEur || '';
  const swift = settings.swiftEur || '';
  if (!iban) return "";
  const name = (settings.name || '').slice(0, 70);
  const amount = 'EUR' + invoiceTotal(inv).total.toFixed(2);
  return ['BCD','002','1','SCT', swift, name, iban, amount, '', '', inv.number || '', ''].join('\n');
}
function qrSvg(text) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
}

/* Součty faktury */
function invoiceTotal(inv) {
  let subtotal = 0, vatTotal = 0;
  const rc = !!inv.reverseCharge; /* přenesená DP: daň odvádí odběratel, na dokladu 0 */
  for (const l of inv.lines) {
    const base = Number(l.qty) * Number(l.unitPrice);
    subtotal += base;
    vatTotal += rc ? 0 : base * (Number(l.vatRate) || 0) / 100;
  }
  const beforeRounding = subtotal + vatTotal;
  const total = inv.rounding ? Math.round(beforeRounding) : beforeRounding;
  return { subtotal, vatTotal, total, roundingAdjustment: total - beforeRounding };
}

/* formát čísla faktury — vlastní číselná řada s tokeny {RRRR} {RR} {MM} {NN}…
   výchozí RRRR-MM-NN; token {N…} určuje šířku pořadového čísla */
const DEFAULT_NUMBER_FORMAT = "{RRRR}-{MM}-{NN}";
function invoiceNumberFormat() {
  const f = (store.settings.invoiceNumberFormat || "").trim();
  return /\{N+\}/.test(f) ? f : DEFAULT_NUMBER_FORMAT;
}
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/* rozdělí formát na část před pořadovým číslem a za ním, s dosazenými hodnotami data */
function numberParts(format, dateISO) {
  const now = dateISO ? new Date(dateISO + "T12:00:00") : new Date();
  const dateVals = {
    "{RRRR}": String(now.getFullYear()),
    "{RR}": String(now.getFullYear()).slice(2),
    "{MM}": String(now.getMonth() + 1).padStart(2, "0")
  };
  let tpl = format;
  for (const [k, v] of Object.entries(dateVals)) tpl = tpl.split(k).join(v);
  const m = tpl.match(/\{(N+)\}/);
  const width = m ? m[1].length : 2;
  const [before, after] = m ? tpl.split(m[0]) : [tpl, ""];
  return { before, after, width };
}
/* Další číslo faktury podle nastaveného formátu (pořadí v rámci stejné části před/za) */
function nextInvoiceNumber(forDateISO) {
  const { before, after, width } = numberParts(invoiceNumberFormat(), forDateISO);
  const rx = new RegExp("^" + reEsc(before) + "(\\d+)" + reEsc(after) + "$");
  let max = 0;
  for (const inv of store.invoices) {
    const mm = String(inv.number).match(rx);
    if (mm) { const n = parseInt(mm[1], 10); if (n > max) max = n; }
  }
  return before + String(max + 1).padStart(width, "0") + after;
}
/* zálohové faktury mají vlastní řadu ZF-RRRR-MM-NN */
function nextProformaNumber(forDateISO) {
  return "ZF-" + nextNumberInSeries("ZF-", forDateISO);
}
/* opravné daňové doklady: ODD-RRRR-MM-NN */
function nextCreditNoteNumber(forDateISO) {
  return "ODD-" + nextNumberInSeries("ODD-", forDateISO);
}
function nextNumberInSeries(seriesPrefix, forDateISO) {
  const now = forDateISO ? new Date(forDateISO + "T12:00:00") : new Date();
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-`;
  let max = 0;
  for (const inv of store.invoices) {
    if (inv.number.startsWith(seriesPrefix + prefix)) {
      const n = parseInt(inv.number.slice((seriesPrefix + prefix).length), 10);
      if (n > max) max = n;
    }
  }
  return prefix + String(max + 1).padStart(2, "0");
}

/* ---------- Klonování faktur: inkrementace měsíce v textu ---------- */
const CZ_MONTHS = ['leden','únor','březen','duben','květen','červen','červenec','srpen','září','říjen','listopad','prosinec'];
function incrementMonthInText(text) {
  /* MM/RRRR or M/RRRR */
  text = text.replace(/(\d{1,2})\/(\d{4})/g, (_, m, y) => {
    let mo = Number(m), yr = Number(y);
    mo++; if (mo > 12) { mo = 1; yr++; }
    return (m.length === 2 ? String(mo).padStart(2, '0') : String(mo)) + '/' + yr;
  });
  /* český název měsíce — jedním průchodem, jinak by se náhrady řetězily (březen→duben→…→leden);
     „červenec" musí být v alternaci před „červen", proto řazení podle délky */
  const monthsRe = new RegExp([...CZ_MONTHS].sort((a, b) => b.length - a.length).join("|"), "gi");
  text = text.replace(monthsRe, m => {
    const i = CZ_MONTHS.indexOf(m.toLowerCase());
    if (i === -1) return m;
    const next = CZ_MONTHS[(i + 1) % 12];
    return m[0] === m[0].toUpperCase() ? next[0].toUpperCase() + next.slice(1) : next;
  });
  return text;
}
function cloneInvoice(inv) {
  const issuedOn = todayISO();
  const isCN = inv.docType === 'creditNote';
  const isPf = isProforma(inv);
  const number = isCN ? nextCreditNoteNumber(issuedOn) : isPf ? nextProformaNumber(issuedOn) : nextInvoiceNumber(issuedOn);
  const dueDays = inv.dueDays || store.settings.dueDays || 14;
  const clone = {
    id: uid(), clientId: inv.clientId, docType: inv.docType,
    number, vs: vsFromNumber(number),
    issuedOn, dueDays, dueOn: addDaysISO(issuedOn, dueDays),
    paymentMethod: inv.paymentMethod, rounding: inv.rounding,
    currency: inv.currency || 'CZK',
    reverseCharge: !!inv.reverseCharge, tags: [...(inv.tags || [])],
    status: 'draft',
    lines: inv.lines.map(l => ({ ...l, name: incrementMonthInText(l.name) }))
  };
  store.invoices.push(clone);
  saveStore(); renderInvoices();
  openInvoiceModal(clone);
}

/* ---------- Dobropis (opravný daňový doklad) z existující faktury ---------- */
function createCreditNote(inv) {
  const issuedOn = todayISO();
  const number = nextCreditNoteNumber(issuedOn);
  const dueDays = inv.dueDays || store.settings.dueDays || 14;
  const cn = {
    id: uid(), clientId: inv.clientId, docType: 'creditNote',
    originalInvoiceId: inv.id, originalInvoiceNumber: inv.number,
    number, vs: vsFromNumber(number),
    issuedOn, dueDays, dueOn: addDaysISO(issuedOn, dueDays),
    paymentMethod: inv.paymentMethod, rounding: inv.rounding,
    currency: inv.currency || 'CZK',
    status: 'issued',
    lines: inv.lines.map(l => ({ ...l, qty: -Math.abs(l.qty) })),
    auditLog: [{ action: 'issued', at: new Date().toISOString() }]
  };
  store.invoices.push(cn);
  saveStore(); renderInvoices();
  showPreview(cn);
}
const vsFromNumber = num => num.replace(/\D/g, "");
const clientById = id => store.clients.find(c => c.id === id);

/* ---------------- Záložky a Menu ---------------- */
const topbarNav = document.getElementById("topbar-nav");
const burgerBtn = document.getElementById("burger-menu-btn");

if (burgerBtn) {
  burgerBtn.addEventListener("click", () => {
    topbarNav.classList.toggle("open");
  });
}

/* přepínač tmavého režimu v liště (slunce/měsíc) — přepne, uloží a nasadí hned */
const themeToggle = document.getElementById("theme-toggle");
if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    store.settings.darkMode = !store.settings.darkMode;
    saveStore();
    applyAppearance();
  });
}

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b === btn));
    document.querySelectorAll(".tab").forEach(t => t.hidden = t.id !== "tab-" + btn.dataset.tab);
    if (topbarNav.classList.contains("open")) {
      topbarNav.classList.remove("open");
    }
    closePreview();
  });
});

/* ---------------- Banka (Import a Párování) ---------------- */
if (!store.bankTxs) store.bankTxs = [];
function renderBank() {
  const list = document.getElementById("bank-list");
  const stats = document.getElementById("bank-stats");
  if (!store.bankTxs.length) {
    stats.innerHTML = "";
    list.innerHTML = `<div class="empty-state">Zatím nebyly nahrány žádné bankovní transakce.</div>`;
    return;
  }
  const unmatched = store.bankTxs.filter(t => !t.invoiceId && !t.ignored);
  const matched = store.bankTxs.filter(t => t.invoiceId);
  const ignored = store.bankTxs.filter(t => t.ignored);
  stats.innerHTML = `
    <div class="tile${unmatched.length ? ' t-critical' : ''}"><div class="tile-label">Nespárované</div><div class="tile-value">${unmatched.length}</div></div>
    <div class="tile"><div class="tile-label">Spárované</div><div class="tile-value">${matched.length}</div></div>
    <div class="tile"><div class="tile-label">Ignorované</div><div class="tile-value">${ignored.length}</div></div>
  `;
  const sorted = [...store.bankTxs].sort((a, b) => b.date.localeCompare(a.date));
  list.innerHTML = `<table class="list-table">
    <thead><tr><th>Datum</th><th>Protistrana</th><th>Částka</th><th>Měna</th><th>VS</th><th>Stav</th></tr></thead>
    <tbody>${sorted.map(t => {
      let state = t.ignored ? '<span class="badge" style="background:#ddd;color:#555">Ignorováno</span>' :
                  t.invoiceId ? `<span class="badge status-good">Spárováno (${store.invoices.find(i => i.id === t.invoiceId)?.number || '?'})</span>` :
                  `<span class="badge status-critical">Nespárováno</span>`;
      let action = t.ignored ? `<button class="btn-ghost btn-small" data-bank-unignore="${t.id}">Obnovit</button>` :
                   t.invoiceId ? `<button class="btn-ghost btn-small" data-bank-unmatch="${t.id}">Zrušit spárování</button>` :
                   `<button class="btn-primary btn-small" data-bank-match="${t.id}">Spárovat</button> <button class="btn-ghost btn-small" data-bank-ignore="${t.id}">Ignorovat</button>`;
      return `<tr>
        <td>${fmtDate(t.date)}</td>
        <td>${escHtml(t.party || '—')}</td>
        <td class="num" style="color:${t.amount > 0 ? 'var(--status-good)' : 'inherit'}">${fmtMoney(t.amount, t.currency || 'CZK')}</td>
        <td>${escHtml(t.currency || 'CZK')}</td>
        <td>${escHtml(t.vs || '—')}</td>
        <td>${state}<div style="margin-top:4px">${action}</div></td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
}

document.getElementById("bank-list").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  const tid = b.dataset.bankIgnore || b.dataset.bankUnignore || b.dataset.bankUnmatch || b.dataset.bankMatch;
  const tx = store.bankTxs.find(t => t.id === tid);
  if (!tx) return;
  if (b.dataset.bankIgnore) { tx.ignored = true; }
  if (b.dataset.bankUnignore) { delete tx.ignored; }
  if (b.dataset.bankUnmatch) {
    const inv = store.invoices.find(i => i.id === tx.invoiceId);
    if (inv && inv.status === 'paid') { inv.status = 'issued'; delete inv.paidOn; }
    delete tx.invoiceId;
  }
  if (b.dataset.bankMatch) {
    const cand = store.invoices.filter(i => isRealInvoice(i) && !['paid','cancelled'].includes(i.status));
    const exact = cand.find(i => i.vs === tx.vs && Math.abs(invoiceTotal(i).total - tx.amount) < 0.1);
    if (exact && confirm(`Automaticky spárovat s fakturou ${exact.number}?`)) {
      tx.invoiceId = exact.id; exact.status = 'paid'; exact.paidOn = tx.date;
    } else {
      const opts = cand.map(i => `${i.number} (${fmtMoney(invoiceTotal(i).total)})`).join('\n');
      const num = prompt(`Zadejte číslo faktury pro spárování s částkou ${fmtMoney(tx.amount)}\n\nDostupné nezaplacené faktury:\n${opts}`);
      if (num) {
        const inv = store.invoices.find(i => i.number === num.trim());
        if (inv) { tx.invoiceId = inv.id; inv.status = 'paid'; inv.paidOn = tx.date; }
        else alert("Faktura nenalezena.");
      }
    }
  }
  saveStore(); renderBank(); renderInvoices(); renderDashboard();
});

document.getElementById("bank-upload").addEventListener("click", () => document.getElementById("bank-file").click());
document.getElementById("bank-file").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  const txs = [];
  if (file.name.toLowerCase().endsWith(".gpc")) {
    text.split('\n').forEach(line => {
      if (!line.startsWith("075")) return;
      const amount = Number(line.substring(43, 55)) / 100;
      const sign = line[60] === '1' ? -1 : line[60] === '2' ? 1 : 0;
      const vs = line.substring(61, 71).replace(/^0+/, '');
      const dmy = line.substring(122, 128);
      const date = `20${dmy.substring(4, 6)}-${dmy.substring(2, 4)}-${dmy.substring(0, 2)}`;
      const party = line.substring(97, 117).trim();
      txs.push({ id: uid(), date, amount: amount * sign, vs, party, currency: 'CZK' });
    });
  } else {
    /* fallback CSV - např. Fio, KB... */
    text.split('\n').forEach(line => {
      const p = line.split(/[;,]/).map(s => s.replace(/^"|"$/g, ''));
      if (p.length < 5 || !p[0].match(/^\d/)) return;
      /* velmi hrubá heuristika, nutno přizpůsobit bance */
      const dateRaw = p[0].trim();
      const date = dateRaw.includes('.')
        ? dateRaw.split('.').map(x => x.trim()).reverse().map((x, i) => i === 0 ? x : x.padStart(2, '0')).join('-')
        : dateRaw;
      const amount = Number(p.find(x => x.match(/^-?\d+([.,]\d+)?$/))?.replace(',','.')) || 0;
      const vs = p.find(x => x.match(/^\d{4,10}$/)) || "";
      if (amount) txs.push({ id: uid(), date: date.substring(0, 10), amount, vs, party: p[p.length-1], currency: 'CZK' });
    });
  }
  if (!txs.length) { alert("Nepodařilo se najít žádné transakce."); return; }
  
  let newCount = 0, matchCount = 0, expMatchCount = 0;
  txs.forEach(t => {
    /* deduplikace */
    const exists = store.bankTxs.find(x => x.date === t.date && Math.abs(x.amount - t.amount) < 0.01 && x.vs === t.vs);
    if (!exists) {
      if (t.amount > 0) {
        /* příchozí platba → spárovat s vydanou fakturou */
        const inv = store.invoices.find(i => isRealInvoice(i) && !['paid','cancelled'].includes(i.status) && i.vs === t.vs && Math.abs(invoiceTotal(i).total - t.amount) < 0.1);
        if (inv) { t.invoiceId = inv.id; inv.status = 'paid'; inv.paidOn = t.date; matchCount++; }
      } else if (t.amount < 0) {
        /* odchozí platba → spárovat s nezaplaceným výdajem podle VS a částky */
        const exp = store.expenses.find(x => x.paid === false && Math.abs(x.amount - Math.abs(t.amount)) < 0.1 && (!t.vs || !x.vs || x.vs === t.vs));
        if (exp) { exp.paid = true; t.expenseId = exp.id; expMatchCount++; }
      }
      store.bankTxs.push(t);
      newCount++;
    }
  });
  saveStore(); renderBank(); renderInvoices(); renderExpenses(); renderDashboard();
  alert(`Importováno ${newCount} nových transakcí. Spárováno: ${matchCount} faktur, ${expMatchCount} výdajů.`);
  document.getElementById("bank-file").value = "";
});

/* ---------------- Nastavení ---------------- */
const settingsForm = document.getElementById("settings-form");

/* --- vzhled: barva, tmavý režim, náhledy loga/razítka --- */
function hexToRgb(h) { const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(h || ""); return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [217, 119, 6]; }
function mixHex(h, target, amt) { const [r, g, b] = hexToRgb(h); const t = target; const mix = c => Math.round(c + (t - c) * amt); return `#${[mix(r), mix(g), mix(b)].map(x => x.toString(16).padStart(2, "0")).join("")}`; }
function applyAppearance() {
  const s = store.settings;
  const root = document.documentElement;
  const accent = s.accentColor || "#d97706";
  root.style.setProperty("--accent", accent);
  root.style.setProperty("--accent-hover", mixHex(accent, 0, 0.2));   /* tmavší */
  root.style.setProperty("--accent-soft", mixHex(accent, 255, 0.85)); /* světlejší */
  document.body.classList.toggle("dark", !!s.darkMode);
}
function showImgPreview(kind) {
  const s = store.settings;
  const img = document.getElementById(kind + "-preview");
  const rm = document.getElementById(kind + "-remove");
  const data = s[kind];
  if (data) { img.src = data; img.hidden = false; rm.hidden = false; }
  else { img.hidden = true; rm.hidden = true; }
}

function fillSettingsForm() {
  const s = store.settings;
  for (const el of settingsForm.elements) {
    if (!el.name) continue;
    if (el.name === "useSubfolders" && s.useSubfolders === undefined) s.useSubfolders = true;
    if (el.type === "checkbox") el.checked = !!s[el.name];
    else if (el.type === "color") el.value = s[el.name] || "#d97706";
    else el.value = s[el.name] ?? "";
  }
  document.body.classList.toggle("vat-payer", !!s.vatPayer);
  showImgPreview("logo"); showImgPreview("stamp");
  applyAppearance();
}

/* nahrání loga / razítka jako data URL do nastavení */
function wireImageUpload(kind) {
  const pick = document.getElementById(kind + "-pick");
  const file = document.getElementById(kind + "-file");
  const rm = document.getElementById(kind + "-remove");
  if (!pick) return;
  pick.addEventListener("click", () => file.click());
  file.addEventListener("change", async e => {
    const f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    if (f.size > 1.5 * 1024 * 1024) { alert("Obrázek je moc velký (max 1,5 MB)."); return; }
    const reader = new FileReader();
    reader.onload = () => { store.settings[kind] = reader.result; saveStore(); showImgPreview(kind); };
    reader.readAsDataURL(f);
  });
  rm.addEventListener("click", () => { store.settings[kind] = ""; saveStore(); showImgPreview(kind); });
}
wireImageUpload("logo"); wireImageUpload("stamp");
settingsForm.addEventListener("submit", e => {
  e.preventDefault();
  const s = store.settings;
  for (const el of settingsForm.elements) {
    if (!el.name) continue;
    s[el.name] = el.type === "checkbox" ? el.checked : el.value.trim();
  }
  if (!s.iban && s.bankAccount) s.iban = czIban(s.bankAccount);
  s.dueDays = Number(s.dueDays) || 14;
  saveStore();
  
  /* Update profile name if changed */
  const prof = PROFILES.find(p => p.id === STORE_KEY);
  if (prof && prof.name !== (s.name || "Hlavní firma")) {
    prof.name = s.name || "Hlavní firma";
    saveProfiles();
    renderSupplierSelect();
  }
  
  fillSettingsForm();
  renderInvoices(); // příjmy/zisk se můžou změnit (základ příjmů, plátce DPH…)
  const msg = document.getElementById("settings-saved");
  msg.textContent = "✓ Uloženo";
  setTimeout(() => (msg.textContent = ""), 2500);
});
settingsForm.elements.bankAccount.addEventListener("change", () => {
  const ibanEl = settingsForm.elements.iban;
  const computed = czIban(settingsForm.elements.bankAccount.value.trim());
  if (computed) ibanEl.value = computed;
});

/* ---------------- Klienti ---------------- */
const clientModal = document.getElementById("client-modal");
const clientForm = document.getElementById("client-form");

function renderClients() {
  const wrap = document.getElementById("client-list");
  if (!store.clients.length) {
    wrap.innerHTML = `<div class="empty-note">Zatím žádní klienti. Přidej prvního tlačítkem „+ Nový klient“.</div>`;
    return;
  }
  wrap.innerHTML = `<table class="list-table">
    <thead><tr><th>Jméno</th><th>IČO</th><th>Město</th><th class="num">Faktur</th><th></th></tr></thead>
    <tbody>${store.clients.map(c => `
      <tr>
        <td><strong>${escHtml(c.name)}</strong></td>
        <td data-label="IČO">${escHtml(c.ico)}</td>
        <td data-label="Město">${escHtml(c.city)}</td>
        <td class="num" data-label="Faktur">${store.invoices.filter(i => i.clientId === c.id).length}</td>
        <td class="actions">
          <button class="btn-ghost btn-small" data-edit-client="${c.id}">Upravit</button>
          <button class="btn-ghost btn-small btn-danger" data-del-client="${c.id}">Smazat</button>
        </td>
      </tr>`).join("")}</tbody></table>`;
}

document.getElementById("new-client").addEventListener("click", () => openClientModal());
function openClientModal(client) {
  clientForm.reset();
  document.getElementById("client-modal-title").textContent = client ? "Upravit klienta" : "Nový klient";
  if (client) for (const el of clientForm.elements) { if (el.name) el.value = client[el.name] ?? ""; }
  clientModal.hidden = false;
}
/* načtení údajů z ARES podle IČO */
document.getElementById("ares-lookup").addEventListener("click", async () => {
  const btn = document.getElementById("ares-lookup");
  const ico = clientForm.elements.ico.value.replace(/\s/g, "");
  if (!/^\d{7,8}$/.test(ico)) { alert("Zadej IČO (8 číslic) a pak klikni na ARES."); return; }
  if (!serverMode) { alert("Načtení z ARES potřebuje server — spusť aplikaci přes start.command."); return; }
  btn.disabled = true; btn.textContent = "…";
  try {
    const d = await apiJson(`/api/ares/${ico}`);
    if (d.error) throw new Error(d.error);
    const f = clientForm.elements;
    f.name.value = d.name || f.name.value;
    f.ico.value = d.ico || ico;
    if (d.dic) f.dic.value = d.dic;
    f.street.value = d.street || f.street.value;
    f.city.value = d.city || f.city.value;
    f.zip.value = d.zip || f.zip.value;
  } catch (err) {
    alert("ARES: " + err.message);
  } finally {
    btn.disabled = false; btn.textContent = "ARES";
  }
});

/* ověření DIČ v evropské databázi VIES */
document.getElementById("vies-lookup").addEventListener("click", async () => {
  const btn = document.getElementById("vies-lookup");
  const out = document.getElementById("vies-result");
  let dic = clientForm.elements.dic.value.trim().toUpperCase().replace(/\s/g, "");
  if (/^\d+$/.test(dic)) dic = "CZ" + dic; /* jen číslice → doplnit CZ */
  if (!/^[A-Z]{2}\d+$/.test(dic)) { alert("Zadej DIČ včetně kódu státu, např. CZ12345678 nebo SK…"); return; }
  if (!serverMode) { alert("Ověření VIES potřebuje server — spusť aplikaci přes start.command."); return; }
  btn.disabled = true; btn.textContent = "…";
  out.hidden = false; out.className = "full"; out.textContent = "Ověřuji v databázi VIES…";
  try {
    const d = await apiJson(`/api/vies/${encodeURIComponent(dic)}`);
    if (d.error) throw new Error(d.error);
    if (d.valid) {
      out.className = "full vies-ok";
      out.innerHTML = `${icon("check")} DIČ <strong>${escHtml(d.dic)}</strong> je platné.${d.name ? ` Plátce: ${escHtml(d.name)}.` : ""}${d.address ? ` ${escHtml(d.address)}` : ""}`;
    } else {
      out.className = "full vies-bad";
      out.innerHTML = `${icon("alert")} DIČ <strong>${escHtml(d.dic)}</strong> není v databázi VIES platné (nebo není registrované k DPH v EU).`;
    }
  } catch (err) {
    out.className = "full vies-bad";
    out.textContent = "VIES: " + err.message;
  } finally {
    btn.disabled = false; btn.textContent = "VIES";
  }
});

/* ověření spolehlivosti plátce DPH v registru MF ČR */
document.getElementById("unreliable-lookup").addEventListener("click", async () => {
  const btn = document.getElementById("unreliable-lookup");
  const out = document.getElementById("vies-result");
  const dic = clientForm.elements.dic.value.trim().toUpperCase().replace(/\s/g, "").replace(/^CZ/, "");
  if (!/^\d{8,10}$/.test(dic)) { alert("Kontrola spolehlivosti je jen pro česká DIČ (8 číslic). Zadej DIČ bez CZ."); return; }
  if (!serverMode) { alert("Kontrola potřebuje server — spusť aplikaci přes start.command."); return; }
  btn.disabled = true; btn.textContent = "…";
  out.hidden = false; out.className = "full"; out.textContent = "Ověřuji v registru MF ČR…";
  try {
    const d = await apiJson(`/api/unreliable/${dic}`);
    if (d.error && !d.found) { out.className = "full vies-bad"; out.innerHTML = `${icon("alert")} ${escHtml(d.error)}`; return; }
    if (d.error) throw new Error(d.error);
    if (d.unreliable) {
      out.className = "full vies-bad";
      out.innerHTML = `${icon("alert")} <strong>NESPOLEHLIVÝ PLÁTCE DPH</strong> (CZ${dic}) — pozor při platbách, může vzniknout ručení za DPH.`;
    } else {
      out.className = "full vies-ok";
      out.innerHTML = `${icon("check")} Spolehlivý plátce DPH (CZ${dic}).${d.publishedAccounts && d.publishedAccounts.length ? ` Zveřejněné účty: ${d.publishedAccounts.slice(0, 3).map(escHtml).join(", ")}${d.publishedAccounts.length > 3 ? "…" : ""}` : ""}`;
    }
  } catch (err) {
    out.className = "full vies-bad";
    out.textContent = "Registr MF: " + err.message;
  } finally {
    btn.disabled = false; btn.textContent = "Plátce DPH";
  }
});

clientForm.addEventListener("submit", e => {
  e.preventDefault();
  const data = {};
  for (const el of clientForm.elements) { if (el.name) data[el.name] = el.value.trim(); }
  if (data.id) {
    Object.assign(store.clients.find(c => c.id === data.id), data);
  } else {
    data.id = uid();
    store.clients.push(data);
  }
  saveStore(); renderClients(); clientModal.hidden = true;
});

/* ---- hromadný export / import kontaktů (CSV) ---- */
const CLIENT_CSV_COLS = ["name", "ico", "dic", "street", "city", "zip", "email"];
const CLIENT_CSV_HEAD = { name: "Jméno / název", ico: "IČO", dic: "DIČ", street: "Ulice", city: "Město", zip: "PSČ", email: "E-mail" };
document.getElementById("clients-export").addEventListener("click", () => {
  if (!store.clients.length) { alert("Žádní klienti k exportu."); return; }
  const rows = [CLIENT_CSV_COLS.map(k => CLIENT_CSV_HEAD[k])];
  for (const c of store.clients) rows.push(CLIENT_CSV_COLS.map(k => c[k] || ""));
  downloadFile(`klienti-${todayISO()}.csv`, toCsv(rows), "text/csv;charset=utf-8");
});
document.getElementById("clients-import").addEventListener("click", () => document.getElementById("clients-import-file").click());
document.getElementById("clients-import-file").addEventListener("change", async e => {
  const file = e.target.files[0]; e.target.value = "";
  if (!file) return;
  try {
    const rows = parseCsv(await file.text());
    if (rows.length < 2) throw new Error("soubor je prázdný nebo bez dat");
    /* mapování sloupců podle hlavičky (název sloupce → klíč) */
    const norm = s => stripDiacritics(String(s || "").toLowerCase()).replace(/[^a-z]/g, "");
    const header = rows[0].map(norm);
    const idx = {};
    const aliases = { name: ["jmeno", "nazev", "jменоназев", "firma", "name"], ico: ["ico", "ic"], dic: ["dic"], street: ["ulice", "street", "adresa"], city: ["mesto", "city", "obec"], zip: ["psc", "zip"], email: ["email", "mail"] };
    for (const key of CLIENT_CSV_COLS) idx[key] = header.findIndex(h => (aliases[key] || [key]).includes(h));
    if (idx.name < 0) throw new Error("chybí sloupec se jménem/názvem (Jméno / název)");
    let added = 0, updated = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const get = k => idx[k] >= 0 ? String(r[idx[k]] || "").trim() : "";
      const name = get("name");
      if (!name) continue;
      const ico = get("ico");
      const existing = (ico && store.clients.find(c => (c.ico || "").replace(/\s/g, "") === ico.replace(/\s/g, "")))
        || store.clients.find(c => c.name.trim().toLowerCase() === name.toLowerCase());
      const fields = { name, ico, dic: get("dic"), street: get("street"), city: get("city"), zip: get("zip"), email: get("email") };
      if (existing) { Object.assign(existing, Object.fromEntries(Object.entries(fields).filter(([, v]) => v))); updated++; }
      else { store.clients.push({ id: uid(), ...fields }); added++; }
    }
    saveStore(); renderClients();
    alert(`Import hotový — přidáno ${added} nových, aktualizováno ${updated} klientů.`);
  } catch (err) { alert("Import CSV se nepovedl: " + err.message); }
});

/* ---------------- Faktury ---------------- */
const invoiceModal = document.getElementById("invoice-modal");
const invoiceForm = document.getElementById("invoice-form");
const linesBody = document.getElementById("lines-body");

function invoiceStatus(inv) {
  if (inv.status === "draft") return ["draft", "Koncept"];
  if (inv.status === "deleted") return ["cancelled", "Smazaná (Koš)"];
  if (inv.status === "cancelled") return ["cancelled", "Stornovaná"];
  if (inv.docType === 'creditNote') return ["credit-note", "Dobropis"];
  if (inv.status === "paid") return ["paid", "Zaplacena"];
  if (inv.dueOn < todayISO()) return ["overdue", "Po splatnosti"];
  return ["issued", "Vystavena"];
}
/* skutečné faktury = bez konceptů, stornovaných a zálohovek (nejsou daňový doklad) */
const isRealInvoice = inv => inv.status !== "draft" && inv.status !== "cancelled" && inv.status !== "deleted" && inv.docType !== "proforma";
const isProforma = inv => inv.docType === "proforma";
const isCreditNote = inv => inv.docType === 'creditNote';
/* datum, ke kterému se příjem počítá do přehledů a daní:
   1) volitelné „Započítat do období“ má vždy přednost
   2) jinak podle nastavení: datum vystavení (výchozí) nebo datum úhrady */
const incomeByPayment = () => (store.settings.incomeBasis || "issued") === "paid";
const invoiceIncomeDate = inv => inv.incomePeriod ? inv.incomePeriod + "-01"
  : incomeByPayment() ? (inv.paidOn || inv.issuedOn) : inv.issuedOn;
/* při počítání dle vystavení se faktura počítá do příjmů hned; dle úhrady až po zaplacení */
const countsAsIncome = inv => incomeByPayment() ? inv.status === "paid" : true;
/* skutečné datum úhrady (s případným přeřazením) — pro dlaždici „Zaplacené“ */
const paidPeriodDate = inv => inv.incomePeriod ? inv.incomePeriod + "-01" : (inv.paidOn || inv.issuedOn);
const incomePeriodDate = x => x.period ? x.period + "-01" : x.date;
const fmtPeriod = p => p.slice(5) + "/" + p.slice(0, 4);

let invoiceSort = "newest";
document.getElementById("invoice-sort").addEventListener("change", e => {
  invoiceSort = e.target.value;
  renderInvoices();
});

function last12ISO() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return toISODate(d);
}
function renderInvoiceStats() {
  const wrap = document.getElementById("invoice-stats");
  if (!store.invoices.length) { wrap.innerHTML = ""; return; }
  const today = todayISO(), from12 = last12ISO();
  const real = store.invoices.filter(isRealInvoice);
  const sum = arr => arr.reduce((a, i) => a + invoiceTotal(i).total, 0);
  const all12 = real.filter(i => i.issuedOn >= from12);
  const paid12 = real.filter(i => i.status === "paid" && paidPeriodDate(i) >= from12);
  const unpaid = real.filter(i => i.status !== "paid");
  const overdue = unpaid.filter(i => i.dueOn < today);
  const drafts = store.invoices.filter(i => i.status === "draft");
  const tile = (label, val, sub, cls = "") => `<div class="tile tile-mini${cls}"><div class="tile-label">${label}</div><div class="tile-value">${val}</div><div class="tile-sub">${sub}</div></div>`;
  wrap.innerHTML = `<div class="tiles tiles-mini-row">
    ${tile("Všechny faktury", fmtMoney(sum(all12)), `${all12.length} faktur · posl. 12 měs.`)}
    ${tile("Zaplacené", fmtMoney(sum(paid12)), `${paid12.length} faktur · posl. 12 měs.`)}
    ${tile("Nezaplacené", fmtMoney(sum(unpaid)), `${unpaid.length} faktur · vč. po splatnosti`)}
    ${tile("Po splatnosti", fmtMoney(sum(overdue)), `${overdue.length} faktur · za celou dobu`, overdue.length ? " t-critical" : "")}
    ${tile("Koncepty", String(drafts.length), drafts.length === 1 ? "rozdělaná faktura" : "rozdělané faktury")}
  </div>`;
}

function renderInvoices() {
  renderDashboard();
  renderInvoiceStats();
  const wrap = document.getElementById("invoice-list");
  
  const hasDeleted = store.invoices.some(i => i.status === "deleted");
  const filtered = store.invoices.filter(i => window.showDeletedInvoices ? i.status === "deleted" : i.status !== "deleted");

  if (!filtered.length) {
    if (window.showDeletedInvoices) {
      wrap.innerHTML = `<div class="toolbar" style="margin-bottom:15px;justify-content:flex-end;"><button class="btn-ghost btn-small" onclick="window.showDeletedInvoices=false;renderInvoices()">Zpět na aktivní faktury</button></div><div class="empty-note">Koš je prázdný.</div>`;
    } else {
      wrap.innerHTML = `<div class="toolbar" style="margin-bottom:15px;justify-content:flex-end;">${hasDeleted ? `<button class="btn-ghost btn-small" onclick="window.showDeletedInvoices=true;renderInvoices()">${icon('trash')} Koš</button>` : ''}</div><div class="empty-note">Zatím žádné faktury. ${store.clients.length ? "Vystav první tlačítkem „+ Nová faktura“." : "Nejdřív si v záložce Klienti přidej klienta."}</div>`;
    }
    return;
  }
  
  const sorted = filtered.sort((a, b) =>
    invoiceSort === "oldest" ? a.issuedOn.localeCompare(b.issuedOn) || a.number.localeCompare(b.number)
      : b.issuedOn.localeCompare(a.issuedOn) || b.number.localeCompare(a.number));
      
  let html = `<div class="toolbar" style="margin-bottom:15px;justify-content:flex-end;">
    ${window.showDeletedInvoices 
      ? `<button class="btn-ghost btn-small" onclick="window.showDeletedInvoices=false;renderInvoices()">Zpět na aktivní faktury</button>`
      : (hasDeleted ? `<button class="btn-ghost btn-small" onclick="window.showDeletedInvoices=true;renderInvoices()">${icon('trash')} Koš</button>` : '')
    }
  </div>`;
  
  const showChk = !window.showDeletedInvoices;
  if (showChk) html += `<div id="inv-bulk-bar" class="bulk-bar" hidden>
    <span id="inv-bulk-count">0 vybráno</span>
    <button class="btn-ghost btn-small" data-inv-bulk="paid">${icon("check")} Označit zaplaceno</button>
    <button class="btn-ghost btn-small" data-inv-bulk="tag">${icon("edit")} Přidat štítek</button>
    <button class="btn-ghost btn-small" data-inv-bulk="export">${icon("download")} Export XML</button>
    <button class="btn-ghost btn-small btn-danger" data-inv-bulk="trash">${icon("trash")} Do koše</button>
    <button class="btn-ghost btn-small" data-inv-bulk="clear">Zrušit výběr</button>
  </div>`;
  html += `<table class="list-table">
    <thead><tr>${showChk ? `<th class="chk-col"><input type="checkbox" id="inv-check-all" title="Vybrat vše"></th>` : ""}<th>Číslo</th><th>Klient</th><th>Vystaveno</th><th>Splatnost</th><th class="num">Částka</th><th>Stav</th><th></th></tr></thead>
    <tbody>${sorted.map(inv => {
      const c = clientById(inv.clientId);
      const [cls, label] = inv.status === "deleted" ? ["status-cancelled", "Smazaná (Koš)"] : invoiceStatus(inv);
      const cur = inv.currency || 'CZK';
      const paidNote = inv.status === "paid" && inv.paidOn
        ? ` <span class="paid-note">${fmtDate(inv.paidOn)}${inv.incomePeriod ? ` → ${fmtPeriod(inv.incomePeriod)}` : ""}</span>`
        : inv.incomePeriod ? ` <span class="paid-note">→ ${fmtPeriod(inv.incomePeriod)}</span>` : "";
      return `<tr class="${inv.status === "cancelled" || inv.status === "deleted" ? "row-cancelled" : ""}">
        ${showChk ? `<td data-nolabel><input type="checkbox" class="inv-check" value="${inv.id}"></td>` : ""}
        <td><strong>${escHtml(inv.number)}</strong>${isProforma(inv) ? ` <span class="badge proforma">Zálohová</span>` : ""}${cur !== 'CZK' ? ` <span class="currency-tag">${cur}</span>` : ""}${inv.reverseCharge ? ` <span class="currency-tag" title="Přenesená daňová povinnost">PDP</span>` : ""}${inv.imported ? ` <span class="import-mark" title="Importováno AI analýzou">${icon("ai")}</span>` : ""}${inv.recurringId ? ` <span class="import-mark" title="Vystaveno z pravidelné faktury">${icon("repeat")}</span>` : ""}${(inv.tags || []).length ? `<div class="inv-tags">${inv.tags.map(tg => `<span class="inv-tag">${escHtml(tg)}</span>`).join("")}</div>` : ""}</td>
        <td data-label="Klient">${escHtml(c ? c.name : "—")}</td>
        <td data-label="Vystaveno">${fmtDate(inv.issuedOn)}</td>
        <td data-label="Splatnost">${fmtDate(inv.dueOn)}</td>
        <td class="num" data-label="Částka">${fmtMoney(invoiceTotal(inv).total, cur)}</td>
        <td data-label="Stav"><span class="badge ${cls}">${label}</span>${inv.reminderCount ? ` <span class="badge" title="Počet upomínek">🔔 ${inv.reminderCount}×</span>` : ""}${paidNote}</td>
        <td class="actions">
          ${inv.status === "deleted" ? `
            <div class="action-stack">
              <button class="btn-ghost btn-small" data-undelete="${inv.id}">${icon("repeat")} Obnovit z koše</button>
              <button class="btn-ghost btn-small btn-danger" data-harddel="${inv.id}">${icon("trash")} Smazat trvale</button>
            </div>
          ` : `
            <div class="action-stack">
              <button class="btn-ghost btn-small" data-view="${inv.id}">${icon("search")} Náhled / PDF</button>
              <button class="btn-ghost btn-small" data-email="${inv.id}" title="Odeslat fakturu klientovi e-mailem">${icon("mail")} E-mail</button>
              ${!["paid", "draft", "cancelled"].includes(inv.status) && !isCreditNote(inv) ? `<button class="btn-ghost btn-small" data-paid="${inv.id}">${icon("check")} Zaplaceno</button>` : ""}
              ${inv.status !== 'paid' && inv.status !== 'draft' && inv.status !== 'cancelled' && !isCreditNote(inv) && inv.dueOn < todayISO() ? `<button class="btn-ghost btn-small" data-reminder="${inv.id}" title="Odeslat upomínku">${icon("alert")} Upomínka${inv.reminderCount ? ' (' + inv.reminderCount + '×)' : ''}</button>` : ""}
              ${isProforma(inv) && inv.status === "paid" && !inv.finalInvoiceId ? `<button class="btn-ghost btn-small" data-finalize="${inv.id}">${icon("convert")} Vystavit fakturu</button>` : ""}
              <button class="btn-ghost btn-small" data-clone="${inv.id}" title="Kopírovat fakturu">${icon("copy")} Kopie</button>
              ${['issued','paid'].includes(inv.status) && !isCreditNote(inv) && !isProforma(inv) ? `<button class="btn-ghost btn-small" data-creditnote="${inv.id}" title="Vystavit dobropis">${icon("minus")} Dobropis</button>` : ""}
              <button class="btn-ghost btn-small" data-edit="${inv.id}">${icon("edit")} ${inv.status === "draft" ? "Dokončit" : "Upravit"}</button>
              ${inv.status === "issued" ? `<button class="btn-ghost btn-small" data-cancel="${inv.id}" title="Stornovat fakturu">${icon("ban")} Storno</button>` : ""}
              ${inv.status === "cancelled" ? `<button class="btn-ghost btn-small" data-uncancel="${inv.id}">${icon("repeat")} Obnovit</button>` : ""}
              <button class="btn-ghost btn-small btn-danger" data-del="${inv.id}">${icon("trash")} Smazat</button>
            </div>
          `}
        </td>
      </tr>`;
    }).join("")}</tbody></table>`;

  wrap.innerHTML = html;
}

/* ---- hromadné akce nad fakturami ---- */
const selectedInvIds = () => [...document.querySelectorAll(".inv-check:checked")].map(c => c.value);
function updateInvBulkBar() {
  const bar = document.getElementById("inv-bulk-bar");
  if (!bar) return;
  const n = selectedInvIds().length;
  bar.hidden = n === 0;
  const cnt = document.getElementById("inv-bulk-count");
  if (cnt) cnt.textContent = `${n} vybráno`;
}
document.getElementById("invoice-list").addEventListener("change", e => {
  if (e.target.id === "inv-check-all") {
    document.querySelectorAll(".inv-check").forEach(ch => (ch.checked = e.target.checked));
    updateInvBulkBar();
  } else if (e.target.classList.contains("inv-check")) {
    updateInvBulkBar();
  }
});
document.getElementById("invoice-list").addEventListener("click", async e => {
  const b = e.target.closest("[data-inv-bulk]");
  if (!b) return;
  const action = b.dataset.invBulk;
  if (action === "clear") { document.querySelectorAll(".inv-check").forEach(ch => (ch.checked = false)); updateInvBulkBar(); return; }
  const ids = selectedInvIds();
  if (!ids.length) return;
  const invs = ids.map(id => store.invoices.find(i => i.id === id)).filter(Boolean);
  if (action === "paid") {
    const todo = invs.filter(i => !["paid", "draft", "cancelled"].includes(i.status) && !isCreditNote(i));
    if (!todo.length) { alert("Mezi vybranými není žádná faktura, kterou lze označit jako zaplacenou."); return; }
    if (!confirm(`Označit ${todo.length} faktur jako zaplacené k dnešnímu datu?`)) return;
    for (const i of todo) { i.status = "paid"; i.paidOn = todayISO(); autoSavePdf(i, 'invoice').then(r => { if (r && r.id) { i.fileId = r.id; saveStore(); } }); }
    saveStore(); renderInvoices();
  } else if (action === "trash") {
    if (!confirm(`Přesunout ${invs.length} faktur do koše?`)) return;
    for (const i of invs) i.status = "deleted";
    saveStore(); linkAndSyncInvoices(); renderInvoices();
  } else if (action === "tag") {
    const tag = prompt("Štítek, který se přidá k vybraným fakturám:");
    if (!tag || !tag.trim()) return;
    const t = tag.trim();
    for (const i of invs) { i.tags = i.tags || []; if (!i.tags.includes(t)) i.tags.push(t); }
    saveStore(); renderInvoices();
  } else if (action === "export") {
    const sorted = invs.sort((a, b) => a.issuedOn.localeCompare(b.issuedOn));
    downloadFile(`faktury-vyber-${todayISO()}.xml`, invoicesXml(sorted), "application/xml");
  }
});

document.getElementById("new-invoice").addEventListener("click", () => {
  if (!store.settings.name || !store.settings.bankAccount) {
    alert("Nejdřív si v záložce Nastavení vyplň svoje údaje (jméno a bankovní účet).");
    return;
  }
  if (!store.clients.length) {
    alert("Nejdřív si v záložce Klienti přidej aspoň jednoho klienta.");
    return;
  }
  openInvoiceModal();
});

function lineRow(l = { name: "", qty: 1, unit: "", unitPrice: "", vatRate: store.settings.vatPayer ? 21 : 0 }, onChange = updateFormTotal) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input name="l-name" required placeholder="Popis položky / práce" value="${escHtml(l.name)}"></td>
    <td><input name="l-qty" type="number" step="any" min="0" required value="${escHtml(l.qty)}"></td>
    <td><input name="l-unit" placeholder="ks / h" value="${escHtml(l.unit || "")}"></td>
    <td><input name="l-price" type="number" step="any" required value="${escHtml(l.unitPrice)}"></td>
    <td class="vat-only"><input name="l-vat" type="number" step="any" min="0" value="${escHtml(l.vatRate ?? 0)}"></td>
    <td class="line-sum">—</td>
    <td><button type="button" class="line-del" title="Odebrat položku">✕</button></td>`;
  tr.querySelector(".line-del").addEventListener("click", () => { tr.remove(); onChange(); });
  tr.querySelectorAll("input").forEach(i => i.addEventListener("input", onChange));
  return tr;
}
document.getElementById("add-line").addEventListener("click", () => { linesBody.appendChild(lineRow()); updateFormTotal(); });

function readLines(tbody = linesBody) {
  return [...tbody.querySelectorAll("tr")].map(tr => ({
    name: tr.querySelector('[name="l-name"]').value.trim(),
    qty: Number(tr.querySelector('[name="l-qty"]').value) || 0,
    unit: tr.querySelector('[name="l-unit"]').value.trim(),
    unitPrice: Number(tr.querySelector('[name="l-price"]').value) || 0,
    vatRate: Number(tr.querySelector('[name="l-vat"]').value) || 0
  }));
}
function updateLinesTotal(tbody, rounding, totalEl) {
  const fake = { lines: readLines(tbody), rounding };
  const t = invoiceTotal(fake);
  tbody.querySelectorAll("tr").forEach((tr, i) => {
    const l = fake.lines[i];
    tr.querySelector(".line-sum").textContent = fmtMoney(l.qty * l.unitPrice * (1 + l.vatRate / 100));
  });
  totalEl.textContent = "Celkem: " + fmtMoney(t.total);
}
function updateFormTotal() {
  updateLinesTotal(linesBody, invoiceForm.elements.rounding.checked, document.getElementById("form-total"));
}
invoiceForm.elements.rounding.addEventListener("change", updateFormTotal);

function openInvoiceModal(inv) {
  invoiceForm.reset();
  linesBody.innerHTML = "";
  document.getElementById("invoice-modal-title").textContent = inv ? "Upravit fakturu " + inv.number : "Nová faktura";
  const sel = invoiceForm.elements.clientId;
  sel.innerHTML = store.clients.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join("");
  if (inv) {
    invoiceForm.elements.id.value = inv.id;
    invoiceForm.elements.docType.value = isProforma(inv) ? "proforma" : isCreditNote(inv) ? "creditNote" : "invoice";
    sel.value = inv.clientId;
    invoiceForm.elements.number.value = inv.number;
    invoiceForm.elements.vs.value = inv.vs;
    invoiceForm.elements.issuedOn.value = inv.issuedOn;
    invoiceForm.elements.dueDays.value = inv.dueDays;
    invoiceForm.elements.paymentMethod.value = inv.paymentMethod;
    invoiceForm.elements.incomePeriod.value = inv.incomePeriod || "";
    invoiceForm.elements.rounding.checked = !!inv.rounding;
    invoiceForm.elements.currency.value = inv.currency || 'CZK';
    if (invoiceForm.elements.reverseCharge) invoiceForm.elements.reverseCharge.checked = !!inv.reverseCharge;
    if (invoiceForm.elements.tags) invoiceForm.elements.tags.value = (inv.tags || []).join(", ");
    if (invoiceForm.elements.rate) invoiceForm.elements.rate.value = inv.rate || "";
    if (invoiceForm.elements.rateInfo && inv.rate && (inv.currency || 'CZK') !== 'CZK') invoiceForm.elements.rateInfo.value = `1 ${inv.currency} = ${Number(inv.rate).toLocaleString("cs-CZ", { maximumFractionDigits: 3 })} Kč`;
    invoiceForm.elements.originalInvoiceId.value = inv.originalInvoiceId || '';
    inv.lines.forEach(l => linesBody.appendChild(lineRow(l)));
  } else {
    invoiceForm.elements.number.value = nextInvoiceNumber();
    invoiceForm.elements.vs.value = vsFromNumber(invoiceForm.elements.number.value);
    invoiceForm.elements.issuedOn.value = todayISO();
    invoiceForm.elements.dueDays.value = String(store.settings.dueDays || 14);
    invoiceForm.elements.rounding.checked = true;
    linesBody.appendChild(lineRow());
  }
  if (invoiceForm.elements.rateInfo) invoiceForm.elements.rateInfo.value = "";
  updateFormTotal();
  updateRateRow();
  invoiceModal.hidden = false;
}
invoiceForm.elements.number.addEventListener("input", () => {
  invoiceForm.elements.vs.value = vsFromNumber(invoiceForm.elements.number.value);
});
/* kurz ČNB — řádek s kurzem se ukazuje jen u cizí měny */
function updateRateRow() {
  const row = document.getElementById("rate-row");
  if (!row) return;
  const cur = invoiceForm.elements.currency.value || "CZK";
  row.hidden = cur === "CZK";
  if (cur === "CZK" && invoiceForm.elements.rateInfo) invoiceForm.elements.rateInfo.value = "";
}
invoiceForm.elements.currency.addEventListener("change", updateRateRow);
const loadRateBtn = document.getElementById("load-rate");
if (loadRateBtn) loadRateBtn.addEventListener("click", async () => {
  const cur = invoiceForm.elements.currency.value || "CZK";
  const date = invoiceForm.elements.issuedOn.value || todayISO();
  if (cur === "CZK") return;
  if (!serverMode) { alert("Načtení kurzu potřebuje server — spusť aplikaci přes start.command."); return; }
  loadRateBtn.disabled = true; loadRateBtn.textContent = "…";
  try {
    const d = await apiJson(`/api/rate/${cur}/${date}`);
    if (d.error) throw new Error(d.error);
    const per = d.perUnit || d.rate;
    invoiceForm.elements.rateInfo.value = `1 ${cur} = ${per.toLocaleString("cs-CZ", { maximumFractionDigits: 3 })} Kč (ČNB ${d.date || date})`;
    if (invoiceForm.elements.rate) invoiceForm.elements.rate.value = per; /* uloží se k faktuře pro přepočet */
  } catch (err) {
    alert("Kurz ČNB: " + err.message);
  } finally {
    loadRateBtn.disabled = false; loadRateBtn.textContent = "Načíst kurz";
  }
});
/* přepnutí typu dokladu u nové faktury přegeneruje číslo v příslušné řadě */
invoiceForm.elements.docType.addEventListener("change", () => {
  if (invoiceForm.elements.id.value) return; // u existující faktury číslo neměnit
  const dt = invoiceForm.elements.docType.value;
  const number = dt === 'proforma' ? nextProformaNumber()
    : dt === 'creditNote' ? nextCreditNoteNumber()
    : nextInvoiceNumber();
  invoiceForm.elements.number.value = number;
  invoiceForm.elements.vs.value = vsFromNumber(number);
});

let saveAsDraft = false;
document.getElementById("save-draft").addEventListener("click", () => { saveAsDraft = true; });
invoiceForm.addEventListener("submit", e => {
  e.preventDefault();
  const asDraft = saveAsDraft;
  saveAsDraft = false;
  const f = invoiceForm.elements;
  const lines = readLines().filter(l => l.name);
  if (!lines.length) { alert("Přidej aspoň jednu položku."); return; }
  const data = {
    clientId: f.clientId.value,
    docType: f.docType.value === "proforma" ? "proforma" : f.docType.value === "creditNote" ? "creditNote" : undefined,
    originalInvoiceId: f.originalInvoiceId.value || undefined,
    number: f.number.value.trim(),
    vs: f.vs.value.trim(),
    issuedOn: f.issuedOn.value,
    dueDays: Number(f.dueDays.value),
    dueOn: addDaysISO(f.issuedOn.value, f.dueDays.value),
    paymentMethod: f.paymentMethod.value,
    incomePeriod: f.incomePeriod.value || undefined,
    rounding: f.rounding.checked,
    currency: f.currency.value || 'CZK',
    rate: (f.currency.value && f.currency.value !== 'CZK' && Number(f.rate.value)) ? Number(f.rate.value) : undefined,
    reverseCharge: f.reverseCharge ? f.reverseCharge.checked : false,
    tags: f.tags ? f.tags.value.split(",").map(s => s.trim()).filter(Boolean) : [],
    lines
  };
  if (f.id.value) {
    const inv = store.invoices.find(i => i.id === f.id.value);
    Object.assign(inv, data);
    if (asDraft) inv.status = "draft";
    else if (inv.status === "draft") {
      inv.status = "issued";
      /* snapshot pro neměnnost */
      if (!inv.snapshot) {
        inv.snapshot = { supplier: { ...store.settings }, client: { ...(clientById(inv.clientId) || {}) }, lockedAt: new Date().toISOString() };
      }
      if (!inv.auditLog) inv.auditLog = [];
      inv.auditLog.push({ action: 'issued', at: new Date().toISOString() });
      autoSavePdf(inv, 'invoice').then(r => { if (r && r.id) { inv.fileId = r.id; saveStore(); } });
    }
  } else {
    if (store.invoices.some(i => i.number === data.number) &&
        !confirm(`Faktura s číslem ${data.number} už existuje. Opravdu uložit další se stejným číslem?`)) return;
    data.id = uid();
    data.status = asDraft ? "draft" : "issued";
    store.invoices.push(data);
    if (data.status === "issued") {
      autoSavePdf(data, 'invoice').then(r => { if (r && r.id) { data.fileId = r.id; saveStore(); } });
    }
  }
  saveStore(); renderInvoices(); invoiceModal.hidden = true;
});

/* z uhrazené zálohovky vytvořit ostrou fakturu (daňový doklad) */
function finalizeProforma(pf) {
  const issuedOn = pf.paidOn || todayISO();
  const number = nextInvoiceNumber(issuedOn);
  const inv = {
    id: uid(), clientId: pf.clientId, number, vs: vsFromNumber(number),
    issuedOn, dueDays: 0, dueOn: issuedOn,
    paymentMethod: pf.paymentMethod, rounding: pf.rounding,
    status: "paid", paidOn: issuedOn, proformaId: pf.id,
    lines: pf.lines.map(l => ({ ...l }))
  };
  store.invoices.push(inv);
  pf.finalInvoiceId = inv.id;
  autoSavePdf(inv, 'invoice').then(r => { if (r && r.id) { inv.fileId = r.id; saveStore(); } });
  autoSavePdf(pf, 'invoice').then(r => { if (r && r.id) { pf.fileId = r.id; saveStore(); } });
  saveStore(); renderInvoices();
  showPreview(inv);
}

/* Odeslání e-mailu */
async function sendInvoiceEmail(inv) {
  if (!serverMode) { alert("E-maily lze odesílat pouze při spuštění přes server (start.command)."); return; }
  const c = clientById(inv.clientId) || {};
  if (!c.email) { alert("Klient nemá vyplněný e-mail."); return; }
  
  const b = e => e.target.closest("button");
  const subject = `Faktura č. ${inv.number} - ${store.settings.name}`;
  const t = invoiceTotal(inv);
  const text = `Dobrý den,\n\nv příloze Vám zasíláme fakturu č. ${inv.number} na částku ${fmtMoney(t.total, inv.currency || 'CZK')}.\n\nDatum splatnosti: ${fmtDate(inv.dueOn)}\n\nS pozdravem,\n${store.settings.name}`;
  
  const originalHtml = invoicePaperHtml(inv);
  const pdfHtml = `<!DOCTYPE html><html lang="cs"><head><meta charset="utf-8"><style>${document.querySelector('link[href="style.css"]').sheet ? [...document.styleSheets[0].cssRules].map(r => r.cssText).join('') : ''}</style></head><body style="background:#fff"><div class="inv-paper">${originalHtml}</div></body></html>`;

  try {
    /* Ukaž loading stav pokud chceme... */
    const res = await apiJson("/api/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: c.email,
        subject,
        text,
        html: pdfHtml,
        pdfName: `Faktura_${inv.number}.pdf`,
        smtpHost: store.settings.smtpHost,
        smtpPort: store.settings.smtpPort,
        smtpUser: store.settings.smtpUser,
        smtpPass: store.settings.smtpPass,
        smtpFrom: store.settings.smtpFrom,
        smtpReplyTo: store.settings.smtpReplyTo
      })
    });
    if (res.error) throw new Error(res.error);
    
    if (!inv.emailLog) inv.emailLog = [];
    inv.emailLog.push({ at: new Date().toISOString(), to: c.email });
    if (!inv.auditLog) inv.auditLog = [];
    inv.auditLog.push({ action: "email-sent", at: new Date().toISOString(), note: c.email });
    saveStore(); renderInvoices();
    alert(`Faktura úspěšně odeslána na e-mail: ${c.email}`);
  } catch (err) {
    alert("Chyba při odesílání e-mailu: " + err.message);
  }
}

/* Delegované akce v seznamech */
document.addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.editClient) openClientModal(clientById(b.dataset.editClient));
  if (b.dataset.delClient) {
    const used = store.invoices.some(i => i.clientId === b.dataset.delClient);
    if (used) { alert("Tento klient má vystavené faktury, nejde smazat."); return; }
    if (confirm("Opravdu smazat klienta?")) {
      store.clients = store.clients.filter(c => c.id !== b.dataset.delClient);
      saveStore(); renderClients();
    }
  }
  if (b.dataset.edit) {
    const editInv = store.invoices.find(i => i.id === b.dataset.edit);
    if (editInv && ['issued','paid'].includes(editInv.status) && !editInv._forceEdit) {
      if (!confirm('Tato faktura je vystavená. Úpravy mohou mít právní důsledky. Pokračovat?')) return;
      if (!editInv.auditLog) editInv.auditLog = [];
      editInv.auditLog.push({ action: 'force-edit', at: new Date().toISOString() });
      saveStore();
    }
    openInvoiceModal(editInv);
  }
  if (b.dataset.clone) {
    const cloneInv = store.invoices.find(i => i.id === b.dataset.clone);
    if (cloneInv) cloneInvoice(cloneInv);
  }
  if (b.dataset.creditnote) {
    const cnInv = store.invoices.find(i => i.id === b.dataset.creditnote);
    if (cnInv && confirm(`Vystavit opravný daňový doklad (dobropis) k faktuře ${cnInv.number}?`)) createCreditNote(cnInv);
  }
  if (b.dataset.reminder) {
    const remInv = store.invoices.find(i => i.id === b.dataset.reminder);
    if (remInv) sendReminder(remInv);
  }
  if (b.dataset.email) {
    const emailInv = store.invoices.find(i => i.id === b.dataset.email);
    if (emailInv) sendInvoiceEmail(emailInv);
  }
  if (b.dataset.del && confirm("Opravdu přesunout fakturu do koše?")) {
    const inv = store.invoices.find(i => i.id === b.dataset.del);
    if (inv) {
      inv.status = "deleted";
      saveStore(); 
      linkAndSyncInvoices(); // To přesune i soubor do složky Koš
      renderInvoices();
    }
  }
  if (b.dataset.undelete) {
    const inv = store.invoices.find(i => i.id === b.dataset.undelete);
    if (inv) {
      if (inv.status === "deleted") {
        if (inv.paidOn) {
          inv.status = "paid"; // Vrátíme jako zaplacenou, protože má datum úhrady
        } else if (inv.docType === 'creditNote' || inv.dueOn) {
          inv.status = "issued"; // Jinak vrátíme jako vystavenou
        } else {
          inv.status = "draft";
        }
      }
      saveStore();
      linkAndSyncInvoices(); // Vrátí soubor do správné složky
      renderInvoices();
    }
  }
  if (b.dataset.harddel && confirm("Opravdu TRVALE smazat tuto fakturu? Akci nelze vzít zpět!")) {
    const inv = store.invoices.find(i => i.id === b.dataset.harddel);
    if (inv) {
      if (inv.fileId && serverMode) {
        // Pokusíme se trvale smazat i soubor
        FilesBackend.remove(inv.fileId).catch(console.error);
      }
      store.invoices = store.invoices.filter(i => i.id !== b.dataset.harddel);
      saveStore(); 
      renderInvoices();
    }
  }
  if (b.dataset.paid) {
    const inv = store.invoices.find(i => i.id === b.dataset.paid);
    inv.status = "paid"; inv.paidOn = todayISO();
    autoSavePdf(inv, 'invoice').then(r => { if (r && r.id) { inv.fileId = r.id; saveStore(); } });
    saveStore(); renderInvoices();
    if (isProforma(inv) && !inv.finalInvoiceId &&
        confirm("Zálohovka je uhrazená. Vystavit k ní teď ostrou fakturu (daňový doklad)?")) {
      finalizeProforma(inv);
    }
  }
  if (b.dataset.finalize) {
    const inv = store.invoices.find(i => i.id === b.dataset.finalize);
    if (inv && confirm(`Vystavit ostrou fakturu k zálohovce ${inv.number}?`)) finalizeProforma(inv);
  }
  if (b.dataset.cancel && confirm("Stornovat fakturu? Přestane se počítat do příjmů.")) {
    const inv = store.invoices.find(i => i.id === b.dataset.cancel);
    inv.status = "cancelled";
    autoSavePdf(inv, 'invoice').then(r => { if (r && r.id) { inv.fileId = r.id; saveStore(); } });
    saveStore(); renderInvoices();
  }
  if (b.dataset.uncancel) {
    const inv = store.invoices.find(i => i.id === b.dataset.uncancel);
    inv.status = "issued";
    autoSavePdf(inv, 'invoice').then(r => { if (r && r.id) { inv.fileId = r.id; saveStore(); } });
    saveStore(); renderInvoices();
  }
  if (b.dataset.view) showPreview(store.invoices.find(i => i.id === b.dataset.view));
  if (b.classList.contains("modal-close")) b.closest(".modal").hidden = true;
});
document.querySelectorAll(".modal").forEach(m => m.addEventListener("mousedown", e => { if (e.target === m) m.hidden = true; }));

/* ---------------- Náhled faktury / PDF ---------------- */
let previewInvoice = null;

function invoicePaperHtml(inv, showStamp = true) {
  /* použít snapshot dodavatele/klienta, pokud existuje (neměnnost) */
  const snap = inv.snapshot || null;
  const s = snap ? { ...store.settings, ...snap.supplier } : store.settings;
  const rawClient = clientById(inv.clientId) || {};
  const c = snap ? { ...rawClient, ...snap.client } : rawClient;
  const cur = inv.currency || 'CZK';
  const t = invoiceTotal(inv);
  const spaydStr = spayd(inv, c, s);
  const sepaStr = sepaEpcQr(inv, c, s);
  const qrStr = spaydStr || sepaStr;
  const vat = s.vatPayer;
  const isCN = inv.docType === 'creditNote';
  const docTitle = isCN ? 'Opravný daňový doklad' : isProforma(inv) ? 'Zálohová faktura' : 'Faktura';
  const bankLabel = cur === 'EUR' && s.bankAccountEur ? s.bankAccountEur : s.bankAccount;
  const accent = s.accentColor || '#d97706';
  const tpl = s.invoiceTemplate || 'classic';
  return `<div class="inv-tpl tpl-${tpl}" style="--accent:${accent}">
    <div class="inv-head">
      ${s.logo ? `<div class="inv-logo"><img src="${s.logo}" alt="Logo"></div>` : ""}
      <div class="inv-title-block"><div class="inv-title">${docTitle}<br><span class="inv-number">${escHtml(inv.number)}</span></div>${isProforma(inv) ? `<div class="inv-proforma-note">Není daňový doklad. Po úhradě bude vystavena faktura.</div>` : ""}${isCN && inv.originalInvoiceNumber ? `<div class="inv-credit-note-ref">Opravný doklad k faktuře č. ${escHtml(inv.originalInvoiceNumber)}</div>` : ""}</div>
    </div>
    <div class="inv-parties">
      <div class="party">
        <div class="party-label">Dodavatel</div>
        <div class="party-name">${escHtml(s.name)}</div>
        <address>${escHtml(s.street)}<br>${escHtml(s.zip)} ${escHtml(s.city)}</address>
        <div class="kv-block">
          <div class="kv"><span class="k">IČO</span><span class="v">${escHtml(s.ico)}</span></div>
          ${vat ? `<div class="kv"><span class="k">DIČ</span><span class="v">${escHtml(s.dic)}</span></div>` : `<div class="kv"><span class="k">Neplátce DPH</span><span class="v"></span></div>`}
        </div>
        <div class="kv-block">
          <div class="kv"><span class="k">Bankovní účet</span><span class="v">${escHtml(bankLabel)}</span></div>
          <div class="kv"><span class="k">Variabilní symbol</span><span class="v">${escHtml(inv.vs)}</span></div>
          <div class="kv"><span class="k">Způsob platby</span><span class="v">${escHtml(inv.paymentMethod)}</span></div>
          ${cur !== 'CZK' ? `<div class="kv"><span class="k">Měna</span><span class="v">${cur}</span></div>` : ''}
        </div>
      </div>
      <div class="party">
        <div class="party-label">Odběratel</div>
        <div class="party-name">${escHtml(c.name)}</div>
        <address>${escHtml(c.street)}<br>${escHtml(c.zip)} ${escHtml(c.city)}</address>
        <div class="kv-block">
          <div class="kv"><span class="k">IČO</span><span class="v">${escHtml(c.ico)}</span></div>
          ${c.dic ? `<div class="kv"><span class="k">DIČ</span><span class="v">${escHtml(c.dic)}</span></div>` : ""}
        </div>
        <div class="kv-block">
          <div class="kv"><span class="k">Datum vystavení</span><span class="v">${fmtDate(inv.issuedOn)}</span></div>
          <div class="kv"><span class="k">Datum splatnosti</span><span class="v">${fmtDate(inv.dueOn)}</span></div>
        </div>
      </div>
    </div>
    <table class="inv-lines">
      <thead><tr>
        <th class="desc"></th>
        ${anyQty(inv) ? "<th>Počet</th>" : ""}
        ${vat ? "<th>DPH</th>" : ""}
        <th>Cena</th>
      </tr></thead>
      <tbody>${inv.lines.map(l => `<tr>
        <td class="desc">${escHtml(l.name)}</td>
        ${anyQty(inv) ? `<td>${l.qty} ${escHtml(l.unit)}</td>` : ""}
        ${vat ? `<td>${l.vatRate} %</td>` : ""}
        <td>${fmtMoney(l.qty * l.unitPrice * (1 + (vat ? l.vatRate : 0) / 100), cur)}</td>
      </tr>`).join("")}</tbody>
    </table>
    <div class="inv-bottom">
      <div class="inv-qr">${(!inv.paidOn || !showStamp) && qrStr ? qrSvg(qrStr) : ""}${(!inv.paidOn || !showStamp) && qrStr ? `<div class="qr-label">${spaydStr ? 'QR Platba' : sepaStr ? 'SEPA QR' : ''}</div>` : ""}</div>
      <div class="inv-summary">
        ${vat ? `<div class="kv"><span class="k">Základ</span><span class="v">${fmtMoney(t.subtotal, cur)}</span></div>
                 <div class="kv"><span class="k">DPH</span><span class="v">${fmtMoney(t.vatTotal, cur)}</span></div>` : ""}
        ${Math.abs(t.roundingAdjustment) >= 0.005 ? `<div class="kv"><span class="k">Zaokrouhlení</span><span class="v">${fmtMoney(t.roundingAdjustment, cur)}</span></div>` : ""}
        ${inv.paidOn && showStamp ? `<div class="paid-stamp">NEPLAŤTE, JIŽ UHRAZENO</div>` : ""}
        <div class="inv-total">${fmtMoney(t.total, cur)}</div>
        ${cur !== 'CZK' && inv.rate ? `<div class="inv-czk-equiv">≈ ${fmtMoney(t.total * Number(inv.rate), 'CZK')} (kurz ČNB ${Number(inv.rate).toLocaleString("cs-CZ", { maximumFractionDigits: 3 })})</div>` : ""}
      </div>
    </div>
    ${inv.reverseCharge ? `<div class="inv-rc-note">Režim přenesení daňové povinnosti — daň odvede zákazník (§ 92a zákona o DPH).</div>` : ""}
    ${s.stamp ? `<div class="inv-stamp"><img src="${s.stamp}" alt="Razítko / podpis"></div>` : ""}
    <div class="inv-footer">${escHtml(s.footerNote)}</div>
  </div>`;
}

async function renderTemplateView(inv) {
  const paper = document.getElementById("invoice-paper");
  const showStamp = document.getElementById("preview-stamp-checkbox").checked;
  
  document.getElementById("preview-orig").classList.toggle("active", false);
  document.getElementById("preview-template").classList.toggle("active", true);

  // Zobrazit načítání, protože PDF se generuje
  paper.className = "paper paper-embed";
  paper.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--muted); font-weight: 500;">Generuji náhled šablony...</div>`;

  if (serverMode && !store.settings.disableAutoPdf) {
    try {
      let css = "";
      try { const resp = await fetch("/style.css"); css = await resp.text(); } catch(e) {}
      
      const bodyHtml = inv.docType === 'quote' ? quotePaperHtml(inv) : invoicePaperHtml(inv, showStamp);
      let statusClass = "";
      if (inv.status === 'cancelled') statusClass = " status-cancelled";
      else if (inv.paidOn) statusClass = " status-paid";
      else if (inv.docType === 'creditNote') statusClass = " status-credit";
      
      const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8">
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@600;700;800&display=swap" rel="stylesheet">
        <style>${css}</style>
        <style>body { background: white; margin: 0; padding: 0; font-family: 'Inter', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }</style>
        </head><body><div id="invoice-paper"><div class="paper${statusClass}">${bodyHtml}</div></div></body></html>`;

      const r = await apiJson("/api/htmlpdf", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: fullHtml, preview: true })
      });

      if (r && r.preview && r.base64) {
        const src = `data:application/pdf;base64,${r.base64}#toolbar=0&view=Fit&scrollbar=0&navpanes=0`;
        paper.innerHTML = `<iframe class="orig-frame" src="${src}" title="Náhled šablony"></iframe>`;
      } else {
        throw new Error("PDF generování selhalo");
      }
    } catch (e) {
      console.error(e);
      // Fallback na HTML pokud API selže
      paper.className = "paper";
      paper.innerHTML = inv.docType === 'quote' ? quotePaperHtml(inv) : invoicePaperHtml(inv, showStamp);
    }
  } else {
    // Fallback na HTML pokud není server
    paper.className = "paper";
    paper.innerHTML = inv.docType === 'quote' ? quotePaperHtml(inv) : invoicePaperHtml(inv, showStamp);
  }

  document.getElementById("preview-print").hidden = false;
  document.getElementById("preview-xml").hidden = false;
  document.getElementById("preview-download").hidden = true;
  document.getElementById("preview-stamp-toggle").hidden = !inv.paidOn;
  
  if (store.settings.disableAutoPdf) {
    document.getElementById("preview-print").innerHTML = `${icon('printer')} Uložit jako PDF / Tisk`;
    document.getElementById("preview-hint").textContent = "V tiskovém dialogu vyber „Uložit jako PDF“ a vypni záhlaví/zápatí.";
  } else {
    document.getElementById("preview-print").innerHTML = `${icon('download')} Stáhnout jako PDF`;
    document.getElementById("preview-hint").textContent = "PDF se uloží do aplikace (Soubory) a rovnou stáhne k vám.";
  }
}

async function renderOriginalView() {
  if (!previewOrigFile) return;
  const paper = document.getElementById("invoice-paper");
  const isImg = /^image\//.test(previewOrigFile.type || "") || /\.(png|jpe?g|webp|gif|tiff?)$/i.test(previewOrigFile.name);
  const src = `/api/files/${previewOrigFile.id}/content?inline=1`;
  paper.className = "paper paper-embed";
  
  if (isImg) {
    paper.innerHTML = `<img class="orig-img" src="${src}" alt="Originál faktury">`;
  } else {
    paper.innerHTML = `<iframe class="orig-frame" src="${src}#toolbar=0&view=Fit&scrollbar=0&navpanes=0" title="Originál faktury"></iframe>`;
    
    // Zjistíme skutečné rozměry PDF a nastavíme aspect-ratio
    if (serverMode) {
      try {
        const dim = await apiJson(`/api/files/${previewOrigFile.id}/dimensions`);
        if (dim && dim.width && dim.height) {
          const iframe = paper.querySelector(".orig-frame");
          if (iframe) {
            iframe.style.aspectRatio = `${dim.width} / ${dim.height}`;
          }
        }
      } catch (e) {
        console.error("Nepodařilo se načíst rozměry PDF:", e);
      }
    }
  }
  
  document.getElementById("preview-print").hidden = true; // tisk originálu řeš stažením
  document.getElementById("preview-stamp-toggle").hidden = true;
  document.getElementById("preview-xml").hidden = false;
  document.getElementById("preview-download").hidden = false;
  document.getElementById("preview-hint").textContent = "Zobrazen původní naskenovaný / importovaný doklad. Pro tisk ho stáhni.";
  document.getElementById("preview-orig").classList.toggle("active", true);
  document.getElementById("preview-template").classList.toggle("active", false);
}

let previewOrigFile = null;

async function showPreview(inv) {
  previewInvoice = inv;
  previewOrigFile = null;
  document.getElementById("preview-xml").hidden = false;
  /* pokladní doklad jen u faktur placených hotově/kartou, dodací list u všech reálných faktur */
  document.getElementById("preview-cashdoc").hidden = !(inv.paymentMethod && inv.paymentMethod !== "Převodem");
  document.getElementById("preview-delivery").hidden = isProforma(inv);
  document.querySelectorAll(".tab").forEach(t2 => (t2.hidden = true));
  document.querySelector(".topbar").style.display = "none";
  document.getElementById("preview-wrap").hidden = false;
  window.scrollTo(0, 0);
  document.title = "Faktura " + inv.number;

  const origBtn = document.getElementById("preview-orig");
  const tplBtn = document.getElementById("preview-template");
  if(origBtn) origBtn.hidden = true;
  if(tplBtn) tplBtn.hidden = true;

  if (serverMode && inv.fileId) {
    try {
      const all = await FilesBackend.list();
      previewOrigFile = all.find(f => f.id === inv.fileId) || null;
    } catch { previewOrigFile = null; }
  }
  
  if (previewOrigFile) {
    if(origBtn) origBtn.hidden = false;
    if(tplBtn) tplBtn.hidden = false;
    const isSystem = previewOrigFile.ai === "Automaticky uloženo systémem";
    if (isSystem) {
      renderTemplateView(inv);
    } else {
      renderOriginalView();
    }
  } else {
    renderTemplateView(inv);
  }
}

document.getElementById("preview-orig").addEventListener("click", renderOriginalView);
document.getElementById("preview-template").addEventListener("click", () => previewInvoice && renderTemplateView(previewInvoice));
document.getElementById("preview-download").addEventListener("click", () => {
  if (previewOrigFile) FilesBackend.download(previewOrigFile.id, previewOrigFile.name);
});

/* zobrazit sloupec Počet jen pokud je někde počet != 1 nebo jednotka */
const anyQty = inv => inv.lines.some(l => Number(l.qty) !== 1 || l.unit);

function closePreview() {
  document.getElementById("preview-wrap").hidden = true;
  document.querySelector(".topbar").style.display = "";
  const active = document.querySelector(".tab-btn.active").dataset.tab;
  document.getElementById("tab-" + active).hidden = false;
  document.title = "Fakturace";
  previewInvoice = null;
  convPreview = null;
  const paper = document.getElementById("invoice-paper");
  paper.style.fontSize = "";
  paper.className = "paper";
  paper.innerHTML = "";
  document.getElementById("preview-orig").hidden = true;
  document.getElementById("preview-template").hidden = true;
  document.getElementById("preview-stamp-toggle").hidden = true;
  document.getElementById("preview-download").hidden = true;
  document.getElementById("preview-cashdoc").hidden = true;
  document.getElementById("preview-delivery").hidden = true;
  document.getElementById("preview-print").hidden = false;
  document.getElementById("convert-toolbar").hidden = true;
  document.getElementById("preview-toolbar").hidden = false;
}
document.getElementById("preview-back").addEventListener("click", closePreview);
document.getElementById("preview-stamp-checkbox").addEventListener("change", () => {
  if (previewInvoice) renderTemplateView(previewInvoice);
});
document.getElementById("preview-print").addEventListener("click", async () => {
  if (!previewInvoice) return;
  if (store.settings.disableAutoPdf) {
    window.print();
    return;
  }
  
  const btn = document.getElementById("preview-print");
  const orig = btn.innerHTML;
  btn.textContent = "Ukládám a stahuji...";
  btn.disabled = true;
  try {
    const showStamp = document.getElementById("preview-stamp-checkbox").checked;
    const isQuote = previewInvoice.validDays !== undefined;
    const r = await autoSavePdf(previewInvoice, isQuote ? 'quote' : 'invoice', showStamp);
    if (r && r.id) {
      previewInvoice.fileId = r.id;
      saveStore();
      /* stáhnout přes API do stažených položek u uživatele */
      const a = document.createElement('a');
      a.href = `/api/files/${r.id}/content`;
      a.download = r.name;
      a.click();
    }
  } catch (err) {
    alert("Chyba při ukládání: " + err.message);
  } finally {
    btn.innerHTML = orig;
    btn.disabled = false;
  }
});
document.getElementById("preview-xml").addEventListener("click", () => {
  if (previewInvoice) downloadFile(`faktura-${previewInvoice.number}.xml`, invoicesXml([previewInvoice]), "application/xml");
});

/* ---- pokladní doklad a dodací list (tisknutelné) ---- */
function cashReceiptHtml(inv) {
  const s = store.settings;
  const c = clientById(inv.clientId) || {};
  const t = invoiceTotal(inv);
  const cur = inv.currency || 'CZK';
  return `<div class="doc-block">
    <div class="doc-parties">
      <div><div class="doc-lbl">Vydal (dodavatel)</div><strong>${escHtml(s.name)}</strong><br>${escHtml(s.street)}<br>${escHtml(s.zip)} ${escHtml(s.city)}<br>IČO: ${escHtml(s.ico)}${s.dic ? " · DIČ: " + escHtml(s.dic) : ""}</div>
      <div><div class="doc-lbl">Přijato od</div><strong>${escHtml(c.name || "—")}</strong>${c.street ? "<br>" + escHtml(c.street) : ""}${c.city ? "<br>" + escHtml(c.zip || "") + " " + escHtml(c.city) : ""}${c.ico ? "<br>IČO: " + escHtml(c.ico) : ""}</div>
    </div>
    <table class="doc-table"><tbody>
      <tr><td>Doklad k faktuře č.</td><td class="num"><strong>${escHtml(inv.number)}</strong></td></tr>
      <tr><td>Variabilní symbol</td><td class="num">${escHtml(inv.vs)}</td></tr>
      <tr><td>Datum</td><td class="num">${fmtDate(inv.paidOn || inv.issuedOn)}</td></tr>
      <tr><td>Způsob úhrady</td><td class="num">${escHtml(inv.paymentMethod || "Hotově")}</td></tr>
      <tr><td>Účel platby</td><td class="num">${escHtml(inv.lines.map(l => l.name).join(", ").slice(0, 120))}</td></tr>
    </tbody></table>
    <div class="doc-amount">Přijatá částka: <strong>${fmtMoney(t.total, cur)}</strong></div>
    <div class="doc-sign"><div>Podpis / razítko příjemce${s.stamp ? `<br><img src="${s.stamp}" style="max-height:90px;margin-top:6px">` : ""}</div></div>
  </div>`;
}
function deliveryNoteHtml(inv) {
  const s = store.settings;
  const c = clientById(inv.clientId) || {};
  return `<div class="doc-block">
    <div class="doc-parties">
      <div><div class="doc-lbl">Dodavatel</div><strong>${escHtml(s.name)}</strong><br>${escHtml(s.street)}<br>${escHtml(s.zip)} ${escHtml(s.city)}<br>IČO: ${escHtml(s.ico)}</div>
      <div><div class="doc-lbl">Odběratel</div><strong>${escHtml(c.name || "—")}</strong>${c.street ? "<br>" + escHtml(c.street) : ""}${c.city ? "<br>" + escHtml(c.zip || "") + " " + escHtml(c.city) : ""}${c.ico ? "<br>IČO: " + escHtml(c.ico) : ""}</div>
    </div>
    <table class="doc-table">
      <thead><tr><th>Položka</th><th class="num">Počet</th><th>Jednotka</th></tr></thead>
      <tbody>${inv.lines.map(l => `<tr><td>${escHtml(l.name)}</td><td class="num">${l.qty}</td><td>${escHtml(l.unit || "ks")}</td></tr>`).join("")}</tbody>
    </table>
    <div class="doc-meta">K faktuře č. ${escHtml(inv.number)} · Datum: ${fmtDate(inv.issuedOn)}</div>
    <div class="doc-sign"><div>Předal (dodavatel)</div><div>Převzal (odběratel)</div></div>
  </div>`;
}
document.getElementById("preview-cashdoc").addEventListener("click", () => {
  if (previewInvoice) printDocument("Příjmový pokladní doklad k faktuře " + previewInvoice.number, cashReceiptHtml(previewInvoice));
});
document.getElementById("preview-delivery").addEventListener("click", () => {
  if (previewInvoice) printDocument("Dodací list k faktuře " + previewInvoice.number, deliveryNoteHtml(previewInvoice));
});

/* ---------------- XML export ---------------- */
function invoiceXml(inv) {
  const s = store.settings;
  const c = clientById(inv.clientId) || {};
  const t = invoiceTotal(inv);
  const lines = inv.lines.map(l => `      <line>
        <name>${escXml(l.name)}</name>
        <quantity>${l.qty}</quantity>
        <unit_name>${escXml(l.unit)}</unit_name>
        <unit_price>${l.unitPrice}</unit_price>
        <vat_rate>${l.vatRate}</vat_rate>
        <unit_price_without_vat>${l.unitPrice}</unit_price_without_vat>
        <unit_price_with_vat>${(l.unitPrice * (1 + l.vatRate / 100)).toFixed(2)}</unit_price_with_vat>
      </line>`).join("\n");
  return `  <invoice>
    <number>${escXml(inv.number)}</number>
    <variable_symbol>${escXml(inv.vs)}</variable_symbol>
    <your_name>${escXml(s.name)}</your_name>
    <your_street>${escXml(s.street)}</your_street>
    <your_city>${escXml(s.city)}</your_city>
    <your_zip>${escXml(s.zip)}</your_zip>
    <your_country>CZ</your_country>
    <your_registration_no>${escXml(s.ico)}</your_registration_no>
    <your_vat_no>${escXml(s.dic)}</your_vat_no>
    <client_name>${escXml(c.name)}</client_name>
    <client_street>${escXml(c.street)}</client_street>
    <client_city>${escXml(c.city)}</client_city>
    <client_zip>${escXml(c.zip)}</client_zip>
    <client_country>CZ</client_country>
    <client_registration_no>${escXml(c.ico)}</client_registration_no>
    <client_vat_no>${escXml(c.dic)}</client_vat_no>
    <status>${inv.status === "paid" ? "paid" : "open"}</status>
    <issued_on>${inv.issuedOn}</issued_on>
    <taxable_fulfillment_due>${inv.issuedOn}</taxable_fulfillment_due>
    <due>${inv.dueDays}</due>
    <due_on>${inv.dueOn}</due_on>
    ${inv.paidOn ? `<paid_on>${inv.paidOn}</paid_on>` : "<paid_on/>"}
    <footer_note>${escXml(s.footerNote)}</footer_note>
    <bank_account>${escXml(s.bankAccount)}</bank_account>
    <iban>${escXml(s.iban || czIban(s.bankAccount))}</iban>
    <swift_bic>${escXml(s.swift)}</swift_bic>
    <payment_method>bank</payment_method>
    <currency>${escXml(inv.currency || 'CZK')}</currency>
    ${inv.docType === 'creditNote' ? '<document_type>credit_note</document_type>' : ''}
    ${inv.originalInvoiceNumber ? `<related_invoice_number>${escXml(inv.originalInvoiceNumber)}</related_invoice_number>` : ''}
    <language>cz</language>
    <subtotal>${t.subtotal.toFixed(2)}</subtotal>
    <total>${t.total.toFixed(2)}</total>
    <rounding_adjustment>${t.roundingAdjustment.toFixed(2)}</rounding_adjustment>
    <lines>
${lines}
    </lines>
  </invoice>`;
}
function invoicesXml(invoices) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<invoices>\n${invoices.map(invoiceXml).join("\n")}\n</invoices>\n`;
}
/* hromadný export XML je v exportním centru (exports.js) */

/* =====================================================================
   DASHBOARD — přehled příjmů, grafy
   ===================================================================== */
const MON_SHORT = ["led","úno","bře","dub","kvě","čvn","čvc","srp","zář","říj","lis","pro"];
const dashYearSel = document.getElementById("dash-year");
dashYearSel.addEventListener("change", renderDashboard);

const fmtShort = v => v >= 1000000 ? (v / 1000000).toLocaleString("cs-CZ", { maximumFractionDigits: 1 }) + " mil."
  : v >= 1000 ? (v / 1000).toLocaleString("cs-CZ", { maximumFractionDigits: 0 }) + " tis." : String(Math.round(v));
function niceMax(v) {
  const steps = [1000, 2000, 5000, 10000, 20000, 25000, 50000, 100000, 200000, 250000, 500000, 1000000, 2000000, 5000000, 10000000];
  return steps.find(s => s >= v) || Math.ceil(v / 1e7) * 1e7;
}
function roundedBar(x, y, w, h, fill) {
  const r = Math.min(4, h, w / 2);
  return `<path d="M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z" fill="${fill}"/>`;
}

function monthLabel(mo, withYear) {
  return withYear ? `${MON_SHORT[mo.m]} ${String(mo.y).slice(2)}` : MON_SHORT[mo.m];
}
function monthlyChart(mIssued, mPaid, mInc, months, incomeLabel = "Zaplaceno") {
  const W = 760, H = 250, padL = 56, padR = 8, padT = 12, padB = 28;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const hasInc = mInc.some(v => v > 0);
  const max = niceMax(Math.max(...mIssued, ...mPaid, ...mInc, 1));
  const y = v => padT + plotH - (v / max) * plotH;
  const multiYear = new Set(months.map(mo => mo.y)).size > 1;
  let out = "";
  for (let i = 0; i <= 4; i++) {
    const v = max * i / 4, yy = y(v);
    out += `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="var(--viz-grid)" stroke-width="1"/>
      <text x="${padL - 8}" y="${yy + 3.5}" text-anchor="end" font-size="10" fill="var(--viz-muted)">${fmtShort(v)}</text>`;
  }
  const series = [[mIssued, "var(--series-1)", "Fakturováno"], [mPaid, "var(--series-2)", incomeLabel]];
  if (hasInc) series.push([mInc, "var(--series-inc)", "Ostatní příjmy"]);
  const n = series.length;
  const slot = plotW / months.length, bw = Math.min(16, (slot - 12) / n);
  months.forEach((mo, m) => {
    const cx = padL + slot * m + slot / 2;
    out += `<text x="${cx}" y="${H - 9}" text-anchor="middle" font-size="9.5" fill="var(--viz-muted)">${monthLabel(mo, multiYear)}</text>`;
    series.forEach(([arr, color, label], i) => {
      const x = cx - (n * (bw + 2)) / 2 + i * (bw + 2) + 1;
      const v = arr[m];
      if (v > 0) {
        const h = Math.max(2, (v / max) * plotH);
        out += roundedBar(x, padT + plotH - h, bw, h, color);
      }
      out += `<rect x="${x}" y="${padT}" width="${bw}" height="${plotH}" fill="transparent"
        data-t1="${MON_SHORT[mo.m]} ${mo.y}" data-t2="${label}: ${fmtMoney(v)}"/>`;
    });
  });
  out += `<line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="var(--viz-baseline)" stroke-width="1"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Měsíční přehled příjmů a fakturace">${out}</svg>`;
}

function renderDashboard() {
  const wrap = document.getElementById("dashboard-content");
  const realInv = store.invoices.filter(isRealInvoice);
  const expenses = store.expenses || [];
  const years = [...new Set([
    ...realInv.flatMap(i => [i.issuedOn, i.paidOn, paidPeriodDate(i)]),
    ...expenses.map(x => x.date),
    ...(store.incomes || []).flatMap(x => [x.date, incomePeriodDate(x)])
  ].filter(Boolean).map(d => Number(d.slice(0, 4))))].sort((a, b) => b - a);
  
  const mode = dashYearSel.value || "12m";

  let optionsHtml = `<option value="12m"${mode === "12m" ? " selected" : ""}>posl. 12 měsíců</option>`;
  optionsHtml += `<option value="this_month"${mode === "this_month" ? " selected" : ""}>Tento měsíc</option>`;
  optionsHtml += `<option value="last_month"${mode === "last_month" ? " selected" : ""}>Minulý měsíc</option>`;
  optionsHtml += `<option value="this_week"${mode === "this_week" ? " selected" : ""}>Tento týden</option>`;
  optionsHtml += `<option value="last_30d"${mode === "last_30d" ? " selected" : ""}>Posledních 30 dní</option>`;
  years.forEach(y => {
    optionsHtml += `<option value="${y}"${String(y) === mode ? " selected" : ""}>Rok ${y}</option>`;
  });
  dashYearSel.innerHTML = optionsHtml;

  if (!realInv.length && !expenses.length) {
    wrap.innerHTML = `<div class="empty-note">Zatím žádná data — vystav první fakturu a dashboard ožije.</div>`;
    return;
  }

  const today = new Date();
  const todayStr = todayISO();
  let inWin;
  let periodLabel;
  let months = []; // Měsíce pro kontextový graf (vždy 12 měsíců)

  if (mode === "this_month") {
    periodLabel = "tento měsíc";
    const st = toISODate(new Date(today.getFullYear(), today.getMonth(), 1));
    const en = toISODate(new Date(today.getFullYear(), today.getMonth()+1, 0));
    inWin = d => d && d >= st && d <= en;
    for (let i = 11; i >= 0; i--) { const d = new Date(today.getFullYear(), today.getMonth() - i, 1); months.push({ y: d.getFullYear(), m: d.getMonth() }); }
  } else if (mode === "last_month") {
    periodLabel = "minulý měsíc";
    const st = toISODate(new Date(today.getFullYear(), today.getMonth()-1, 1));
    const en = toISODate(new Date(today.getFullYear(), today.getMonth(), 0));
    inWin = d => d && d >= st && d <= en;
    for (let i = 11; i >= 0; i--) { const d = new Date(today.getFullYear(), today.getMonth() - i, 1); months.push({ y: d.getFullYear(), m: d.getMonth() }); }
  } else if (mode === "this_week") {
    periodLabel = "tento týden";
    const stD = new Date(today); stD.setDate(today.getDate() - (today.getDay()||7) + 1);
    const enD = new Date(stD); enD.setDate(stD.getDate() + 6);
    const st = toISODate(stD); const en = toISODate(enD);
    inWin = d => d && d >= st && d <= en;
    for (let i = 11; i >= 0; i--) { const d = new Date(today.getFullYear(), today.getMonth() - i, 1); months.push({ y: d.getFullYear(), m: d.getMonth() }); }
  } else if (mode === "last_30d") {
    periodLabel = "posl. 30 dní";
    const stD = new Date(today); stD.setDate(today.getDate() - 30);
    const st = toISODate(stD); const en = todayStr;
    inWin = d => d && d >= st && d <= en;
    for (let i = 11; i >= 0; i--) { const d = new Date(today.getFullYear(), today.getMonth() - i, 1); months.push({ y: d.getFullYear(), m: d.getMonth() }); }
  } else if (mode === "12m") {
    periodLabel = "posl. 12 měs.";
    for (let i = 11; i >= 0; i--) { const d = new Date(today.getFullYear(), today.getMonth() - i, 1); months.push({ y: d.getFullYear(), m: d.getMonth() }); }
    const st = toISODate(new Date(months[0].y, months[0].m, 1));
    inWin = d => d && d >= st;
  } else {
    const yr = Number(mode);
    periodLabel = "v " + yr;
    months = Array.from({ length: 12 }, (_, m) => ({ y: yr, m }));
    inWin = d => d && d.startsWith(String(yr));
  }

  const idxOf = d => d ? months.findIndex(mo => mo.y === Number(d.slice(0, 4)) && mo.m === Number(d.slice(5, 7)) - 1) : -1;
  const inWinChart = d => idxOf(d) >= 0;

  const totalOf = inv => invoiceTotal(inv).total;

  const issuedY = realInv.filter(i => inWin(i.issuedOn));
  const incomeY = realInv.filter(i => countsAsIncome(i) && inWin(invoiceIncomeDate(i)));
  const unpaid = realInv.filter(i => i.status !== "paid");
  const overdue = unpaid.filter(i => i.dueOn < todayStr);
  const waiting = unpaid.filter(i => i.dueOn >= todayStr);
  const sum = arr => arr.reduce((a, i) => a + totalOf(i), 0);
  const byPayment = incomeByPayment();
  const incomeLabel = byPayment ? "Zaplaceno" : "Příjmy z faktur";

  /* Pro graf chceme vždy širší kontext 12 měsíců, bez ohledu na to jak úzké je zobrazené období nahoře */
  const issuedChart = realInv.filter(i => inWinChart(i.issuedOn));
  const incomeChart = realInv.filter(i => countsAsIncome(i) && inWinChart(invoiceIncomeDate(i)));
  
  const N = months.length;
  const mIssued = Array(N).fill(0), mPaid = Array(N).fill(0);
  for (const i of issuedChart) mIssued[idxOf(i.issuedOn)] += totalOf(i);
  for (const i of incomeChart) mPaid[idxOf(invoiceIncomeDate(i))] += totalOf(i);

  /* výdaje a ostatní příjmy */
  const expY = expenses.filter(x => inWin(x.date));
  const expSum = expY.reduce((a, x) => a + x.amount, 0);
  
  const expChart = expenses.filter(x => inWinChart(x.date));
  const mExp = Array(N).fill(0);
  for (const x of expChart) mExp[idxOf(x.date)] += x.amount;
  
  const incY = (store.incomes || []).filter(x => inWin(incomePeriodDate(x)));
  const incSum = incY.reduce((a, x) => a + x.amount, 0);
  
  const incChart = (store.incomes || []).filter(x => inWinChart(incomePeriodDate(x)));
  const mInc = Array(N).fill(0);
  for (const x of incChart) mInc[idxOf(incomePeriodDate(x))] += x.amount;
  
  const profit = sum(incomeY) + incSum - expSum;

  /* stav faktur vystavených v okně */
  const stateRows = [
    ["Zaplaceno", "check", "var(--status-good)", issuedY.filter(i => i.status === "paid")],
    ["Čeká na zaplacení", "clock", "var(--status-warning)", issuedY.filter(i => i.status !== "paid" && i.dueOn >= todayStr)],
    ["Po splatnosti", "alert", "var(--status-critical)", issuedY.filter(i => i.status !== "paid" && i.dueOn < todayStr)]
  ].map(([label, icon, color, arr]) => ({ label, icon, color, amount: sum(arr), count: arr.length }));
  const stateMax = Math.max(...stateRows.map(r => r.amount), 1);

  /* top klienti okna */
  const byClient = {};
  for (const i of issuedY) byClient[i.clientId] = (byClient[i.clientId] || 0) + totalOf(i);
  const top = Object.entries(byClient).map(([id, v]) => ({ name: (clientById(id) || { name: "—" }).name, v }))
    .sort((a, b) => b.v - a.v).slice(0, 6);
  const topMax = Math.max(...top.map(t => t.v), 1);

  wrap.innerHTML = `
    <div class="tiles tiles-6">
      <div class="tile"><div class="tile-label">Příjmy ${periodLabel}</div><div class="tile-value">${fmtMoney(sum(incomeY) + incSum)}</div><div class="tile-sub">${incSum ? `faktury ${fmtMoney(sum(incomeY))} · ostatní ${fmtMoney(incSum)}` : `${incomeY.length} ${byPayment ? "zaplacených" : "vystavených"} faktur`}</div></div>
      <div class="tile"><div class="tile-label">Fakturováno ${periodLabel}</div><div class="tile-value">${fmtMoney(sum(issuedY))}</div><div class="tile-sub">${issuedY.length} faktur</div></div>
      <div class="tile"><div class="tile-label">Čeká na zaplacení</div><div class="tile-value">${fmtMoney(sum(waiting))}</div><div class="tile-sub">${waiting.length} faktur</div></div>
      <div class="tile${overdue.length ? " t-critical" : ""}"><div class="tile-label">Po splatnosti</div><div class="tile-value">${fmtMoney(sum(overdue))}</div><div class="tile-sub">${overdue.length} faktur</div></div>
      <div class="tile"><div class="tile-label">Výdaje ${periodLabel}</div><div class="tile-value">${fmtMoney(expSum)}</div><div class="tile-sub">${expY.length} dokladů</div></div>
      <div class="tile${profit < 0 ? " t-critical" : ""}"><div class="tile-label">Zisk ${periodLabel}</div><div class="tile-value" ${profit >= 0 ? 'style="color:var(--accent-dark)"' : ""}>${fmtMoney(profit)}</div><div class="tile-sub">${incSum ? `vč. ostatních příjmů ${fmtMoney(incSum)}` : `${byPayment ? "zaplaceno" : "fakturováno"} − výdaje`}</div></div>
    </div>
    <div class="dash-grid">
      <div class="chart-card full">
        <h3>Příjmy a fakturace po měsících</h3>
        <div class="chart-sub">Fakturováno = podle data vystavení · ${byPayment ? "Zaplaceno = podle data úhrady" : "Příjmy z faktur = podle data vystavení (vč. přeřazených období)"} · Ostatní příjmy = výplaty mimo faktury</div>
        <div class="chart-legend">
          <span><span class="sw" style="background:var(--series-1)"></span>Fakturováno</span>
          <span><span class="sw" style="background:var(--series-2)"></span>${incomeLabel}</span>
          ${incSum ? `<span><span class="sw" style="background:var(--series-inc)"></span>Ostatní příjmy</span>` : ""}
        </div>
        ${monthlyChart(mIssued, mPaid, mInc, months, incomeLabel)}
      </div>
      <div class="chart-card">
        <h3>Stav faktur (${periodLabel})</h3>
        <div class="chart-sub">podle data vystavení</div>
        <div class="status-rows">
          ${stateRows.map(r => `<div class="status-row">
            <div class="status-head"><span><span class="st-ico" style="color:${r.color}">${icon(r.icon)}</span> ${r.label} (${r.count})</span><span class="amount">${fmtMoney(r.amount)}</span></div>
            <div class="bar-track"><div class="bar-fill" style="width:${(r.amount / stateMax * 100).toFixed(1)}%;background:${r.color}"></div></div>
          </div>`).join("")}
        </div>
      </div>
      <div class="chart-card">
        <h3>Top klienti (${periodLabel})</h3>
        <div class="chart-sub">podle fakturované částky</div>
        ${top.length ? top.map(t => `<div class="hbar-row">
          <span class="hbar-name" title="${escHtml(t.name)}">${escHtml(t.name)}</span>
          <div class="hbar-track"><div class="hbar-fill" style="width:${(t.v / topMax * 100).toFixed(1)}%"></div></div>
          <span class="hbar-val">${fmtShort(t.v)} Kč</span>
        </div>`).join("") : `<div class="dash-empty">Žádné faktury v tomto období.</div>`}
      </div>
      ${expY.length ? `<div class="chart-card full">
        <h3>Výdaje po měsících</h3>
        <div class="chart-sub">podle data dokladu · celkem ${fmtMoney(expSum)}</div>
        ${expenseChart(mExp, months)}
      </div>` : ""}
      ${agingCard(realInv, todayStr)}
      ${cashFlowCard(realInv, todayStr)}
      ${limitsCard(realInv, todayStr)}
      ${actionsCard(realInv, todayStr)}
    </div>` + taxEstimateCard(!isNaN(Number(mode)) && String(mode).length === 4 ? Number(mode) : today.getFullYear());
}

function expenseChart(mExp, months) {
  const W = 760, H = 190, padL = 56, padR = 8, padT = 10, padB = 26;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const max = niceMax(Math.max(...mExp, 1));
  const y = v => padT + plotH - (v / max) * plotH;
  const multiYear = new Set(months.map(mo => mo.y)).size > 1;
  let out = "";
  for (let i = 0; i <= 3; i++) {
    const v = max * i / 3, yy = y(v);
    out += `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="var(--viz-grid)" stroke-width="1"/>
      <text x="${padL - 8}" y="${yy + 3.5}" text-anchor="end" font-size="10" fill="var(--viz-muted)">${fmtShort(v)}</text>`;
  }
  const slot = plotW / months.length, bw = Math.min(26, slot - 14);
  months.forEach((mo, m) => {
    const cx = padL + slot * m + slot / 2;
    out += `<text x="${cx}" y="${H - 8}" text-anchor="middle" font-size="9.5" fill="var(--viz-muted)">${monthLabel(mo, multiYear)}</text>`;
    if (mExp[m] > 0) {
      const h = Math.max(2, (mExp[m] / max) * plotH);
      out += roundedBar(cx - bw / 2, padT + plotH - h, bw, h, "var(--series-exp)");
    }
    out += `<rect x="${cx - slot / 2 + 2}" y="${padT}" width="${slot - 4}" height="${plotH}" fill="transparent"
      data-t1="${MON_SHORT[mo.m]} ${mo.y}" data-t2="Výdaje: ${fmtMoney(mExp[m])}"/>`;
  });
  out += `<line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="var(--viz-baseline)" stroke-width="1"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Výdaje po měsících">${out}</svg>`;
}

/* ---------- CRM Dashboard: Aging pohledávek ---------- */
function agingCard(realInv, today) {
  const unpaid = realInv.filter(i => i.status !== 'paid' && i.status !== 'cancelled');
  if (!unpaid.length) return '';
  const daysDiff = (a, b) => Math.floor((new Date(a + 'T12:00:00') - new Date(b + 'T12:00:00')) / 86400000);
  const buckets = [
    { label: 'V termínu', min: -Infinity, max: 0, items: [], color: 'var(--status-good)' },
    { label: '1–30 dní', min: 1, max: 30, items: [], color: 'var(--status-warning)' },
    { label: '31–60 dní', min: 31, max: 60, items: [], color: '#e07020' },
    { label: '61–90 dní', min: 61, max: 90, items: [], color: 'var(--status-critical)' },
    { label: '90+ dní', min: 91, max: Infinity, items: [], color: '#8b1a1a' }
  ];
  for (const inv of unpaid) {
    const overdue = daysDiff(today, inv.dueOn);
    const bucket = buckets.find(b => overdue >= b.min && overdue <= b.max) || buckets[0];
    bucket.items.push(inv);
  }
  const totalOf = inv => invoiceTotal(inv).total;
  const allMax = Math.max(...buckets.map(b => b.items.reduce((a, i) => a + totalOf(i), 0)), 1);
  /* DSO = průměrná doba inkasa (posl. 12m zaplacených faktur) */
  const from12 = (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return toISODate(d); })();
  const paid12 = realInv.filter(i => i.status === 'paid' && i.paidOn && i.paidOn >= from12);
  const dso = paid12.length ? Math.round(paid12.reduce((a, i) => a + daysDiff(i.paidOn, i.issuedOn), 0) / paid12.length) : 0;
  return `<div class="chart-card">
    <h3>Aging pohledávek</h3>
    <div class="chart-sub">nezaplacené faktury podle doby po splatnosti${dso ? ` · DSO ${dso} dní` : ''}</div>
    <div class="status-rows">
      ${buckets.filter(b => b.items.length).map(b => {
        const sum = b.items.reduce((a, i) => a + totalOf(i), 0);
        return `<div class="status-row">
          <div class="status-head"><span><span class="st-ico" style="color:${b.color}">${icon('clock')}</span> ${b.label} (${b.items.length})</span><span class="amount">${fmtMoney(sum)}</span></div>
          <div class="bar-track"><div class="bar-fill" style="width:${(sum / allMax * 100).toFixed(1)}%;background:${b.color}"></div></div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

/* ---------- CRM Dashboard: Cash flow forecast (4 týdny dopředu) ---------- */
function cashFlowCard(realInv, today) {
  const unpaid = realInv.filter(i => i.status !== 'paid' && i.status !== 'cancelled');
  if (!unpaid.length) return '';
  const totalOf = inv => invoiceTotal(inv).total;
  const weeks = [];
  for (let w = 0; w < 4; w++) {
    const from = addDaysISO(today, w * 7);
    const to = addDaysISO(today, (w + 1) * 7 - 1);
    const inWeek = unpaid.filter(i => i.dueOn >= from && i.dueOn <= to);
    weeks.push({ label: w === 0 ? 'Tento týden' : `+${w + 1}. týden`, from, to, sum: inWeek.reduce((a, i) => a + totalOf(i), 0), count: inWeek.length });
  }
  const overdue = unpaid.filter(i => i.dueOn < today);
  const overdueSum = overdue.reduce((a, i) => a + totalOf(i), 0);
  const maxW = Math.max(...weeks.map(w => w.sum), overdueSum, 1);
  return `<div class="chart-card">
    <h3>Cash flow forecast</h3>
    <div class="chart-sub">očekávané příchozí platby dle splatnosti</div>
    ${overdueSum > 0 ? `<div class="hbar-row"><span class="hbar-name" style="color:var(--danger)">⚠ Po splatnosti (${overdue.length})</span><div class="hbar-track"><div class="hbar-fill" style="width:${(overdueSum / maxW * 100).toFixed(1)}%;background:var(--status-critical)"></div></div><span class="hbar-val">${fmtShort(overdueSum)} Kč</span></div>` : ''}
    ${weeks.map(w => `<div class="hbar-row">
      <span class="hbar-name">${w.label} (${w.count})</span>
      <div class="hbar-track"><div class="hbar-fill" style="width:${(w.sum / maxW * 100).toFixed(1)}%;background:var(--series-2)"></div></div>
      <span class="hbar-val">${fmtShort(w.sum)} Kč</span>
    </div>`).join('')}
  </div>`;
}

/* ---------- CRM Dashboard: Akce pro tebe (TODO) ---------- */
function actionsCard(realInv, today) {
  const items = [];
  /* faktury po splatnosti */
  const overdue = realInv.filter(i => i.status !== 'paid' && i.status !== 'cancelled' && i.dueOn < today);
  if (overdue.length) items.push(`<li style="color:var(--danger)"><strong>${overdue.length}× faktura po splatnosti</strong> — nejstarší ${fmtDate(overdue.sort((a, b) => a.dueOn.localeCompare(b.dueOn))[0].dueOn)}</li>`);
  /* splatnost v příštích 3 dnech */
  const soon = realInv.filter(i => i.status !== 'paid' && i.status !== 'cancelled' && i.dueOn >= today && i.dueOn <= addDaysISO(today, 3));
  if (soon.length) items.push(`<li>${soon.length}× faktura se splatností v příštích 3 dnech</li>`);
  /* pravidelné faktury k vystavení */
  const recDue = (store.recurring || []).filter(r => r.active && r.nextOn <= today);
  if (recDue.length) items.push(`<li>${recDue.length}× pravidelná faktura čeká na vystavení</li>`);
  /* koncepty */
  const drafts = store.invoices.filter(i => i.status === 'draft');
  if (drafts.length) items.push(`<li>${drafts.length}× koncept faktury — dokonči a vystav</li>`);
  /* nabídky čekající na odpověď > 14 dní */
  const staleQuotes = (store.quotes || []).filter(q => q.status === 'open' && q.issuedOn < addDaysISO(today, -14));
  if (staleQuotes.length) items.push(`<li>${staleQuotes.length}× nabídka odeslaná před 14+ dny bez odpovědi</li>`);
  if (!items.length) return '';
  return `<div class="chart-card full">
    <h3>📋 Akce pro tebe</h3>
    <div class="chart-sub">úkoly vyžadující pozornost</div>
    <ul style="margin:0;padding:0 0 0 20px;font-size:14px;line-height:1.8">${items.join('')}</ul>
  </div>`;
}

/* ---------- Hlídání obratu: DPH registrace a pásma paušální daně ---------- */
/* limity obratu za posledních 12 měsíců (orientační, editovatelné konstanty) */
const LIMITY = {
  dphRegistrace: 2000000,   /* povinná registrace k DPH při obratu nad 2 mil. Kč / 12 měs. */
  pausalP1: 1500000,        /* pásma paušální daně dle výše příjmů */
  pausalP2: 1000000,        /* (pozn.: pásma jsou dle příjmů za rok, ne klouzavý obrat) */
};
function limitsCard(realInv, today) {
  /* klouzavý obrat za 12 měsíců podle data vystavení */
  const from = addDaysISO(today, -365);
  const obrat12 = realInv.filter(i => i.issuedOn >= from && i.issuedOn <= today)
    .reduce((a, i) => a + invoiceTotal(i).total, 0);
  /* příjmy za aktuální kalendářní rok (pro pásma paušální daně) */
  const yr = today.slice(0, 4);
  const prijmyRok = realInv.filter(i => i.issuedOn.startsWith(yr)).reduce((a, i) => a + invoiceTotal(i).total, 0);
  const pctDph = obrat12 / LIMITY.dphRegistrace;
  /* kartu ukazuj až od 50 % limitu, ať nezavazí menším podnikatelům */
  if (pctDph < 0.5 && prijmyRok < LIMITY.pausalP2 * 0.7) return '';
  const bar = (val, max, color) => `<div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, val / max * 100).toFixed(1)}%;background:${color}"></div></div>`;
  const dphColor = pctDph >= 0.9 ? 'var(--status-critical)' : pctDph >= 0.75 ? 'var(--status-warning)' : 'var(--status-good)';
  let dphNote = '';
  if (!store.settings.vatPayer) {
    if (pctDph >= 1) dphNote = `<div class="limit-alert crit">⚠ Překročen obrat 2 mil. Kč — vzniká povinnost registrace k DPH.</div>`;
    else if (pctDph >= 0.9) dphNote = `<div class="limit-alert crit">⚠ Blížíš se hranici obratu pro DPH (${(pctDph * 100).toFixed(0)} %).</div>`;
    else if (pctDph >= 0.75) dphNote = `<div class="limit-alert warn">Pozor na obrat pro DPH — jsi na ${(pctDph * 100).toFixed(0)} % limitu.</div>`;
  }
  return `<div class="chart-card">
    <h3>Hlídání obratu a limitů</h3>
    <div class="chart-sub">klouzavý obrat za posledních 12 měsíců</div>
    <div class="limit-row">
      <div class="limit-head"><span>Obrat pro DPH (limit ${fmtShort(LIMITY.dphRegistrace)})</span><span class="amount">${fmtMoney(obrat12)}</span></div>
      ${bar(obrat12, LIMITY.dphRegistrace, dphColor)}
    </div>
    <div class="limit-row">
      <div class="limit-head"><span>Příjmy ${yr} (pásmo paušální daně)</span><span class="amount">${fmtMoney(prijmyRok)}</span></div>
      ${bar(prijmyRok, LIMITY.pausalP1, prijmyRok >= LIMITY.pausalP1 ? 'var(--status-critical)' : prijmyRok >= LIMITY.pausalP2 ? 'var(--status-warning)' : 'var(--status-good)')}
      <div class="limit-scale">1. pásmo do ${fmtShort(LIMITY.pausalP2)} · 2. do ${fmtShort(LIMITY.pausalP1)} · 3. do ${fmtShort(LIMITY.dphRegistrace)}</div>
    </div>
    ${dphNote}
  </div>`;
}

/* =====================================================================
   UPOMÍNKY PO SPLATNOSTI
   ===================================================================== */
function sendReminder(inv) {
  if (!inv.reminderCount) inv.reminderCount = 0;
  inv.reminderCount++;
  inv.lastReminder = new Date().toISOString();
  if (!inv.auditLog) inv.auditLog = [];
  inv.auditLog.push({ action: 'reminder-' + inv.reminderCount, at: inv.lastReminder });
  saveStore();
  const c = clientById(inv.clientId) || {};
  const t = invoiceTotal(inv);
  const daysDiff = Math.floor((new Date() - new Date(inv.dueOn + 'T12:00:00')) / 86400000);
  /* Pokus o odeslání přes server (email), fallback na zobrazení textu */
  const subject = `Upomínka č. ${inv.reminderCount} — faktura ${inv.number}`;
  const body = `Dobrý den,\n\ndovolujeme si Vás upozornit, že faktura č. ${inv.number} na částku ${fmtMoney(t.total, inv.currency || 'CZK')} se splatností ${fmtDate(inv.dueOn)} je ${daysDiff} dní po splatnosti.\n\nProsíme o úhradu na účet ${store.settings.bankAccount}, VS: ${inv.vs}.\n\nDěkujeme za pochopení.\n\nS pozdravem\n${store.settings.name}`;
  if (c.email) {
    /* Pokud má klient email a běží server, zkusíme odeslat */
    if (serverMode && store.settings.smtpHost) {
      apiJson('/api/email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: c.email, subject, text: body,
          smtpHost: store.settings.smtpHost,
          smtpPort: store.settings.smtpPort,
          smtpUser: store.settings.smtpUser,
          smtpPass: store.settings.smtpPass,
          smtpFrom: store.settings.smtpFrom,
          smtpReplyTo: store.settings.smtpReplyTo
        })
      }).then(r => {
        if (r.ok) alert(`Upomínka č. ${inv.reminderCount} odeslána na ${c.email}.`);
        else alert(`Upomínka uložena, ale e-mail se nepodařilo odeslat: ${r.error || 'neznámá chyba'}`);
      }).catch(() => alert(`Upomínka uložena (${inv.reminderCount}×), e-mail nebyl odeslán.`));
    } else {
      /* Otevřít mailto: odkaz */
      const mailtoUrl = `mailto:${encodeURIComponent(c.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(mailtoUrl, '_blank');
      alert(`Upomínka č. ${inv.reminderCount} zaznamenána. Otevřen e-mailový klient.`);
    }
  } else {
    /* Zkopírovat do schránky */
    navigator.clipboard.writeText(`Předmět: ${subject}\n\n${body}`).then(() => {
      alert(`Upomínka č. ${inv.reminderCount} zaznamenána.\nText zkopírován do schránky (klient nemá e-mail).`);
    }).catch(() => {
      alert(`Upomínka č. ${inv.reminderCount} zaznamenána.\n\n${body}`);
    });
  }
  renderInvoices();
}
/* =====================================================================
   ODHAD DANÍ A POJIŠTĚNÍ — plně nastavitelný (paušál, činnost po měsících)
   ===================================================================== */
function defaultTaxSettings() {
  return {
    pausal: 60,
    danSazba: 15, danSazba2: 23, danPrah: 1676052,
    slevaPoplatnik: 30840, zalohaDan: 0,
    socSazba: 29.2, socVymZakladPct: 55,
    socMinVZHlavni: 16295, socMinVZVedlejsi: 5122, socRozhodna: 111736, zalohaSoc: 0,
    socMinVZHlavniH2: "", socMinVZVedlejsiH2: "", zdravMinVZH2: "", /* od července (zlom uprostřed roku) */
    zdravSazba: 13.5, zdravVymZakladPct: 50, zdravMinVZ: 23278, zalohaZdrav: 0,
    months: {}, // { "2026": "HHHHHHVVVVNN" } — H hlavní, V vedlejší, N nepodnikám
    years: {}   // { "2026": {...sazby a minima za rok 2026} }
  };
}
/* výchozí hodnoty za konkrétní rok — minima a prahy se rok od roku mění.
   Orientační; uživatel si je může za každý rok upravit v modálu nastavení. */
const TAX_YEAR_DEFAULTS = {
  "2025": { danPrah: 1676052, slevaPoplatnik: 30840, socMinVZHlavni: 16295, socMinVZVedlejsi: 5122, socRozhodna: 111736, zdravMinVZ: 23278 },
  "2026": { danPrah: 1867728, slevaPoplatnik: 30840, socMinVZHlavni: 16295, socMinVZVedlejsi: 5122, socRozhodna: 116112, zdravMinVZ: 23278,
            /* od července 2026 klesají minimální odvody (min. záloha soc. 5 005 Kč → VZ ≈ 17 140) */
            socMinVZHlavniH2: 17140, socMinVZVedlejsiH2: 6856, zdravMinVZH2: 23278 }
};
const TAX_RATE_FIELDS = ["pausal","danSazba","danSazba2","danPrah","slevaPoplatnik","zalohaDan","socSazba","socVymZakladPct","socMinVZHlavni","socMinVZVedlejsi","socRozhodna","zalohaSoc","socMinVZHlavniH2","socMinVZVedlejsiH2","zdravMinVZH2","zdravSazba","zdravVymZakladPct","zdravMinVZ","zalohaZdrav"];

if (!store.taxSettings) store.taxSettings = defaultTaxSettings();
store.taxSettings = { ...defaultTaxSettings(), ...store.taxSettings };
if (!store.taxSettings.years) store.taxSettings.years = {};
/* migrace: starší uložené „ploché" sazby přenést do roku 2025 (odpovídaly mu), ať se neztratí úpravy */
if (!store.taxSettings._migratedYears) {
  const legacy = {};
  for (const k of TAX_RATE_FIELDS) if (store.taxSettings[k] !== undefined && store.taxSettings[k] !== "") legacy[k] = store.taxSettings[k];
  if (!store.taxSettings.years["2025"]) store.taxSettings.years["2025"] = legacy;
  store.taxSettings._migratedYears = true;
  saveStore();
}
/* sloučené daňové nastavení za rok: základ + výchozí hodnoty roku + uživatelské úpravy roku */
function taxSettingsFor(year) {
  const y = String(year);
  const base = { ...defaultTaxSettings() };
  delete base.months; delete base.years;
  for (const k of TAX_RATE_FIELDS) if (store.taxSettings[k] !== undefined) base[k] = store.taxSettings[k];
  const yearDef = TAX_YEAR_DEFAULTS[y] || TAX_YEAR_DEFAULTS["2026"] || {};
  const saved = store.taxSettings.years[y] || {};
  return { ...base, ...yearDef, ...saved };
}

function getTaxMonths(year) {
  const m = (store.taxSettings.months || {})[String(year)];
  return (m && /^[HVN]{12}$/.test(m)) ? m.split("") : Array(12).fill("H");
}

function computeTaxEstimate(year) {
  const ts = taxSettingsFor(year);
  const y = String(year);
  const months = getTaxMonths(year);
  const nH = months.filter(x => x === "H").length;
  const nV = months.filter(x => x === "V").length;
  const nAct = nH + nV;

  /* příjmy z faktur podle nastavení (datum vystavení / úhrady + přeřazená období),
     zaplacené zálohovky bez ostré faktury (aby se nepočítaly dvakrát) a ostatní příjmy */
  const paidReal = store.invoices.filter(i => isRealInvoice(i) && countsAsIncome(i) && invoiceIncomeDate(i).startsWith(y));
  const paidProforma = store.invoices.filter(i => isProforma(i) && i.status === "paid" && !i.finalInvoiceId && paidPeriodDate(i).startsWith(y));
  const otherInc = (store.incomes || []).filter(x => incomePeriodDate(x).startsWith(y));
  const prijmy = [...paidReal, ...paidProforma].reduce((a, i) => a + invoiceTotal(i).total, 0)
    + otherInc.reduce((a, x) => a + x.amount, 0);

  const vydaje = prijmy * ts.pausal / 100;
  const zaklad = Math.max(0, prijmy - vydaje);
  const zakladZaokr = Math.floor(zaklad / 100) * 100;

  /* daň z příjmů: základní sazba do prahu, zvýšená nad něj, minus sleva */
  const prah = Number(ts.danPrah) || Infinity;
  const danPredSlevou = zakladZaokr <= prah
    ? zakladZaokr * ts.danSazba / 100
    : prah * ts.danSazba / 100 + (zakladZaokr - prah) * (ts.danSazba2 || ts.danSazba) / 100;
  const dan = Math.max(0, Math.round(danPredSlevou) - Number(ts.slevaPoplatnik || 0));

  /* minima počítáme měsíc po měsíci — od července může platit jiná (nižší) hodnota */
  const num = (v, fb) => { const n = Number(v); return v === "" || v == null || isNaN(n) ? fb : n; };
  const socMinFor = (mi, typ) => typ === "H"
    ? (mi >= 6 ? num(ts.socMinVZHlavniH2, ts.socMinVZHlavni) : num(ts.socMinVZHlavni, 0))
    : (mi >= 6 ? num(ts.socMinVZVedlejsiH2, ts.socMinVZVedlejsi) : num(ts.socMinVZVedlejsi, 0));
  const zdravMinFor = mi => mi >= 6 ? num(ts.zdravMinVZH2, ts.zdravMinVZ) : num(ts.zdravMinVZ, 0);

  /* sociální: vedlejší činnost platí jen nad rozhodnou částkou (poměrně dle měsíců) */
  let soc = 0, socVZ = 0, vedlejsiPlati = false;
  if (nAct > 0) {
    const vedlejsiZisk = zaklad * nV / nAct;
    vedlejsiPlati = nV > 0 && vedlejsiZisk >= (Number(ts.socRozhodna) || 0) * nV / 12;
    const pocitaneMesice = nH + (vedlejsiPlati ? nV : 0);
    if (pocitaneMesice > 0) {
      const skutVZ = zaklad * ts.socVymZakladPct / 100 * pocitaneMesice / nAct;
      let minVZ = 0;
      months.forEach((typ, mi) => {
        if (typ === "H") minVZ += socMinFor(mi, "H");
        else if (typ === "V" && vedlejsiPlati) minVZ += socMinFor(mi, "V");
      });
      socVZ = Math.max(skutVZ, minVZ);
      soc = Math.ceil(socVZ * ts.socSazba / 100);
    }
  }

  /* zdravotní: minimum jen za měsíce hlavní činnosti, vedlejší platí ze zisku */
  let zdrav = 0, zdravVZ = 0;
  if (nAct > 0) {
    const skutVZ = zaklad * ts.zdravVymZakladPct / 100;
    let minVZ = 0;
    months.forEach((typ, mi) => { if (typ === "H") minVZ += zdravMinFor(mi); });
    zdravVZ = Math.max(skutVZ, minVZ);
    zdrav = Math.ceil(zdravVZ * ts.zdravSazba / 100);
  }

  const zalohyDan = Number(ts.zalohaDan || 0) * 12;
  const zalohySoc = Number(ts.zalohaSoc || 0) * nAct;
  const zalohyZdrav = Number(ts.zalohaZdrav || 0) * nAct;

  return {
    year, months, nH, nV, nAct, prijmy, vydaje, zaklad, zakladZaokr, dan, soc, zdrav,
    socVZ, zdravVZ, danSazba: ts.danSazba, danSazba2: ts.danSazba2, danPrah: Number(ts.danPrah) || 0,
    socSazba: ts.socSazba, zdravSazba: ts.zdravSazba, socVymZakladPct: ts.socVymZakladPct, zdravVymZakladPct: ts.zdravVymZakladPct,
    slevaPoplatnik: Number(ts.slevaPoplatnik || 0), pausal: ts.pausal,
    vedlejsiPlati, celkem: dan + soc + zdrav,
    cisty: prijmy - dan - soc - zdrav,
    doplatekDan: dan - zalohyDan, doplatekSoc: soc - zalohySoc, doplatekZdrav: zdrav - zalohyZdrav,
    zalohyDan, zalohySoc, zalohyZdrav
  };
}

const MONTH_LETTERS = { H: "hlavní", V: "vedlejší", N: "nepodniká" };
function taxEstimateCard(year) {
  const t = computeTaxEstimate(year);
  const ts = store.taxSettings;
  const doplatek = (label, odhad, zalohy, rozdil) => zalohy > 0
    ? `<div class="tax-sub">zálohy ${fmtMoney(zalohy)} → ${rozdil >= 0 ? "doplatek " + fmtMoney(rozdil) : "přeplatek " + fmtMoney(-rozdil)}</div>` : "";
  const cinnost = [
    t.nH ? `${t.nH}× hlavní` : "", t.nV ? `${t.nV}× vedlejší` : "",
    t.nAct < 12 ? `${12 - t.nAct}× nepodniká` : ""
  ].filter(Boolean).join(" · ");
  return `<div class="chart-card full tax-card">
    <div class="tax-head">
      <div>
        <h3>Odhad daní a pojištění za rok ${year}</h3>
        <div class="chart-sub">příjmy podle ${incomeByPayment() ? "data úhrady" : "data vystavení"} · paušální výdaje ${ts.pausal} % · činnost: ${cinnost || "—"}${t.nV && !t.vedlejsiPlati ? " · vedlejší pod rozhodnou částkou (soc. se neplatí)" : ""}</div>
      </div>
      <button class="btn-ghost btn-small" id="tax-settings-btn" data-tax-year="${year}">${icon("sliders")} Nastavení odhadu</button>
    </div>
    <div class="tax-grid">
      <div class="tax-block">
        <div class="tax-row"><span>Příjmy (zaplacené)</span><strong>${fmtMoney(t.prijmy)}</strong></div>
        <div class="tax-row"><span>Výdaje paušálem ${ts.pausal} %</span><strong>−${fmtMoney(t.vydaje)}</strong></div>
        <div class="tax-row tax-total"><span>Základ daně</span><strong>${fmtMoney(t.zaklad)}</strong></div>
      </div>
      <div class="tax-block">
        <div class="tax-row"><span>Daň z příjmů (po slevě ${fmtMoney(Number(ts.slevaPoplatnik) || 0)})</span><strong>${fmtMoney(t.dan)}</strong></div>
        ${doplatek("daň", t.dan, t.zalohyDan, t.doplatekDan)}
        <div class="tax-row"><span>Sociální pojištění</span><strong>${fmtMoney(t.soc)}</strong></div>
        ${doplatek("soc", t.soc, t.zalohySoc, t.doplatekSoc)}
        <div class="tax-row"><span>Zdravotní pojištění</span><strong>${fmtMoney(t.zdrav)}</strong></div>
        ${doplatek("zdrav", t.zdrav, t.zalohyZdrav, t.doplatekZdrav)}
        <div class="tax-row tax-total"><span>Odvody celkem</span><strong>${fmtMoney(t.celkem)}</strong></div>
      </div>
      <div class="tax-block tax-net">
        <div class="tax-label">Čistý příjem po odvodech</div>
        <div class="tax-value">${fmtMoney(t.cisty)}</div>
        <div class="tax-sub">orientační odhad — nezahrnuje jiné příjmy (zaměstnání…), odčitatelné položky ani další slevy</div>
      </div>
    </div>
  </div>`;
}

/* ---- modal nastavení odhadu ---- */
const taxModal = document.getElementById("tax-modal");
const taxForm = document.getElementById("tax-form");
let taxModalYear = new Date().getFullYear();
const TAX_FIELDS = ["pausal","danSazba","danSazba2","danPrah","slevaPoplatnik","zalohaDan","socSazba","socVymZakladPct","socMinVZHlavni","socMinVZVedlejsi","socRozhodna","zalohaSoc","zdravSazba","zdravVymZakladPct","zdravMinVZ","zalohaZdrav"];
/* pole, která smějí zůstat prázdná (zlom od července — bez hodnoty = žádný zlom) */
const TAX_FIELDS_OPTIONAL = ["socMinVZHlavniH2","socMinVZVedlejsiH2","zdravMinVZH2"];

function renderTaxMonths(states) {
  document.getElementById("tax-months").innerHTML = states.map((st, i) =>
    `<button type="button" class="tax-month tm-${st}" data-tm="${i}" title="${MONTH_LETTERS[st]}">
      <span class="tm-name">${MON_SHORT[i]}</span><span class="tm-state">${MONTH_LETTERS[st]}</span>
    </button>`).join("");
}
document.getElementById("tax-months").addEventListener("click", e => {
  const b = e.target.closest("[data-tm]");
  if (!b) return;
  const states = [...document.querySelectorAll("#tax-months .tax-month")].map(x => x.classList.contains("tm-H") ? "H" : x.classList.contains("tm-V") ? "V" : "N");
  const i = Number(b.dataset.tm);
  states[i] = states[i] === "H" ? "V" : states[i] === "V" ? "N" : "H";
  renderTaxMonths(states);
});

document.addEventListener("click", e => {
  const b = e.target.closest("#tax-settings-btn");
  if (!b) return;
  taxModalYear = Number(b.dataset.taxYear) || new Date().getFullYear();
  document.getElementById("tax-year-label").textContent = taxModalYear;
  const ts = taxSettingsFor(taxModalYear); /* sloučené hodnoty za daný rok */
  for (const k of [...TAX_FIELDS, ...TAX_FIELDS_OPTIONAL]) {
    if (taxForm.elements[k]) taxForm.elements[k].value = ts[k] ?? "";
  }
  renderTaxMonths(getTaxMonths(taxModalYear));
  taxModal.hidden = false;
});

taxForm.addEventListener("submit", e => {
  e.preventDefault();
  const y = String(taxModalYear);
  if (!store.taxSettings.years) store.taxSettings.years = {};
  const yr = store.taxSettings.years[y] = store.taxSettings.years[y] || {};
  for (const k of TAX_FIELDS) {
    const v = taxForm.elements[k].value.trim();
    yr[k] = v === "" ? 0 : Number(v);
  }
  /* volitelná pole (od července) — prázdné necháme prázdné = žádný zlom */
  for (const k of TAX_FIELDS_OPTIONAL) {
    if (!taxForm.elements[k]) continue;
    const v = taxForm.elements[k].value.trim();
    yr[k] = v === "" ? "" : Number(v);
  }
  if (!store.taxSettings.months) store.taxSettings.months = {};
  store.taxSettings.months[y] = [...document.querySelectorAll("#tax-months .tax-month")]
    .map(x => x.classList.contains("tm-H") ? "H" : x.classList.contains("tm-V") ? "V" : "N").join("");
  saveStore(); renderDashboard(); taxModal.hidden = true;
});

/* tooltip grafů */
const chartTip = document.getElementById("chart-tip");
document.getElementById("dashboard-content").addEventListener("mousemove", e => {
  const t = e.target.closest("[data-t1]");
  if (!t) { chartTip.hidden = true; return; }
  chartTip.innerHTML = `<div class="tip-title">${escHtml(t.dataset.t1)}</div>${escHtml(t.dataset.t2)}`;
  chartTip.hidden = false;
  const x = Math.min(e.clientX + 14, window.innerWidth - chartTip.offsetWidth - 8);
  chartTip.style.left = x + "px";
  chartTip.style.top = (e.clientY - chartTip.offsetHeight - 12) + "px";
});
document.getElementById("dashboard-content").addEventListener("mouseleave", () => { chartTip.hidden = true; });

/* =====================================================================
   SOUBORY — na disku přes lokální server (data/<Kategorie>/),
   fallback: IndexedDB, když aplikace běží bez serveru (file://)
   ===================================================================== */
const FILE_CATEGORIES = ["Nezařazené", "Faktury", "Hlášení", "Příjmy", "Smlouvy", "Podklady", "Ostatní"];
const fmtBytes = b => b >= 1048576 ? (b / 1048576).toFixed(1) + " MB" : b >= 1024 ? Math.round(b / 1024) + " kB" : b + " B";
let serverMode = false;
let filesDb = null;
const idbReq = req => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
const filesOs = mode => filesDb.transaction("files", mode).objectStore("files");
const apiJson = (url, opts) => fetch(url, opts).then(r => r.json());
const fileToB64 = f => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result.split(",")[1]);
  r.onerror = rej;
  r.readAsDataURL(f);
});

let filesReadyResolve;
const filesReady = new Promise(r => (filesReadyResolve = r));

const noStorage = () => { throw new Error("Úložiště souborů není dostupné — spusť aplikaci přes start.command."); };
const FilesBackend = {
  async list() {
    await filesReady;
    if (serverMode) return apiJson("/api/files");
    if (!filesDb) return [];
    return idbReq(filesOs("readonly").getAll());
  },
  async add(file, category) {
    await filesReady;
    if (serverMode) {
      return apiJson("/api/files", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, category, period: "", note: "", type: file.type, dataBase64: await fileToB64(file) })
      });
    }
    if (!filesDb) noStorage();
    return idbReq(filesOs("readwrite").put({
      id: uid(), name: file.name, size: file.size, type: file.type,
      category, period: "", note: "", addedAt: Date.now(), blob: file
    }));
  },
  async update(id, patch) {
    await filesReady;
    if (serverMode) return apiJson(`/api/files/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    const rec = await idbReq(filesOs("readonly").get(id));
    Object.assign(rec, patch);
    return idbReq(filesOs("readwrite").put(rec));
  },
  async remove(id) {
    await filesReady;
    if (serverMode) return apiJson(`/api/files/${id}`, { method: "DELETE" });
    return idbReq(filesOs("readwrite").delete(id));
  },
  async download(id, name) {
    await filesReady;
    if (serverMode) {
      const all = await apiJson("/api/files");
      if (!all.some(f => f.id === id)) { alert("Soubor už v úložišti není (byl smazán nebo nahrazen)."); return; }
      const a = document.createElement("a");
      a.href = `/api/files/${id}/content`;
      a.download = name || "";
      a.click();
      return;
    }
    const rec = await idbReq(filesOs("readonly").get(id));
    const url = URL.createObjectURL(rec.blob);
    const a = document.createElement("a");
    a.href = url; a.download = rec.name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
};

async function initFiles() {
  try {
    if (location.protocol.startsWith("http")) {
      try { serverMode = (await apiJson("/api/ping")).ok === true; } catch { serverMode = false; }
    }
    if (!serverMode) {
      const rq = indexedDB.open("fakturace_files", 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore("files", { keyPath: "id" });
      filesDb = await Promise.race([
        idbReq(rq),
        new Promise((_, rej) => setTimeout(() => rej(new Error("úložiště prohlížeče nedostupné")), 4000))
      ]);
    }
  } catch (e) {
    console.warn("Soubory: úložiště nedostupné —", e.message);
    filesDb = null;
  } finally {
    filesReadyResolve();
  }
  const hint = document.getElementById("files-hint");
  if (hint) hint.innerHTML = serverMode
    ? `Složky = skutečné podsložky <strong>app/data/</strong> na disku. Soubory sem přetáhni myší, zaškrtni je a klikni na <strong>Analyzovat vybrané</strong> — AI pozná vydané i přijaté faktury, naimportuje z nich data a soubory rovnou roztřídí.`
    : `⚠️ Aplikace běží bez serveru, soubory se ukládají jen do prohlížeče. Pro ukládání na disk a AI analýzu spusť <strong>start.command</strong> (poklepáním) a otevři <strong>http://localhost:4321</strong>.`;
  document.getElementById("file-search").addEventListener("input", renderFiles);
  document.getElementById("bulk-move-cat").innerHTML = FILE_CATEGORIES.map(c => `<option>${c}</option>`).join("");
  renderFiles();
}

let currentFolder = null; // null = kořen (přehled složek)

document.getElementById("upload-files").addEventListener("click", () => document.getElementById("files-input").click());
document.getElementById("files-input").addEventListener("change", async e => {
  const files = [...e.target.files];
  e.target.value = "";
  if (!files.length) return;
  for (const f of files) await FilesBackend.add(f, currentFolder || "Nezařazené");
  renderFiles();
});

const isAnalyzable = f => /\.(pdf|png|jpe?g|heic|webp|tiff?|csv)$/i.test(f.name);

function fileRow(f) {
  const bDate = fmtDate(toISODate(new Date(f.birthtime || f.addedAt)));
  const q = document.getElementById("file-search").value.trim();
  return `<tr draggable="true" ondragstart="event.dataTransfer.setData('text/plain', '${f.id}')" ondragend="this.style.opacity='1'" ondrag="this.style.opacity='0.5'">
    <td data-nolabel><label class="file-pick"><input type="checkbox" class="file-check" value="${f.id}"></label></td>
    <td><strong>${escHtml(f.name)}</strong><br><span style="font-size: 11px; color: var(--muted);">${icon("clock")} Vytvořeno: ${bDate}</span>${f.ai ? `<div class="file-ai">${icon("ai")} ${escHtml(f.ai)}</div>` : ""}</td>
    <td data-label="Složka">
      <div style="display:flex; gap:4px; align-items:center;">
        <select data-file-field="category" data-file-id="${f.id}">${[...new Set([...FILE_CATEGORIES, f.category])].map(c => `<option${c === f.category ? " selected" : ""}>${escHtml(c)}</option>`).join("")}</select>
        ${q ? `<button class="btn-ghost btn-small" data-file-goto="${escHtml(f.category)}" title="Přejít do složky" style="padding:4px 8px;">${icon("folder")}</button>` : ""}
      </div>
    </td>
    <td data-label="Období"><input type="month" value="${f.period}" data-file-field="period" data-file-id="${f.id}"></td>
    <td data-label="Poznámka"><input class="file-note" value="${escHtml(f.note)}" placeholder="—" data-file-field="note" data-file-id="${f.id}"></td>
    <td class="num" data-label="Velikost">${fmtBytes(f.size)}</td>
    <td class="actions">
      <div class="action-stack">
        ${serverMode && isAnalyzable(f) ? `<button class="btn-ghost btn-small" data-file-ai="${f.id}" title="Analyzovat AI">${icon("ai")} Analyzovat</button>` : ""}
        <button class="btn-ghost btn-small" data-file-conv="${f.id}" title="Převést do jiného formátu">${icon("convert")} Převést</button>
        <button class="btn-ghost btn-small" data-file-dl="${f.id}" title="Stáhnout">${icon("download")} Stáhnout</button>
        <button class="btn-ghost btn-small btn-danger" data-file-del="${f.id}" title="Smazat">${icon("trash")} Smazat</button>
      </div>
    </td>
  </tr>`;
}
function filesTable(list) {
  return `<table class="list-table files-table">
    <thead><tr><th></th><th>Název a Datum</th><th>Složka</th><th>Období</th><th>Poznámka</th><th class="num">Velikost</th><th></th></tr></thead>
    <tbody>${list.map(fileRow).join("")}</tbody></table>`;
}

async function renderFiles() {
  if (!serverMode && !filesDb) return;
  const wrap = document.getElementById("file-list");
  const crumb = document.getElementById("file-breadcrumb");
  const all = await FilesBackend.list();
  const q = document.getElementById("file-search").value.trim().toLowerCase();
  const totalSize = all.reduce((a, f) => a + f.size, 0);
  document.getElementById("file-usage").textContent =
    `${all.length} souborů · ${fmtBytes(totalSize)} · ${serverMode ? "na disku (app/data)" : "uloženo v prohlížeči"} · soubory sem můžeš přetáhnout myší`;

  /* drobečková navigace — v kořenu je zbytečná, schovat */
  crumb.hidden = !currentFolder && !q;
  crumb.innerHTML = `<button class="crumb" data-crumb-root>${icon("folder")} Soubory</button>` +
    (q ? `<span class="crumb-sep">›</span><span class="crumb active">${icon("search")} „${escHtml(q)}“</span>`
       : currentFolder ? `<span class="crumb-sep">›</span><span class="crumb active">${escHtml(currentFolder)}</span>` : "");

  if (q) {
    const tokens = q.split(/\s+/).filter(Boolean);
    const found = all.filter(f => {
      const bDateIso = toISODate(new Date(f.birthtime || f.addedAt));
      const bDate = fmtDate(bDateIso);
      
      let fullText = [
        f.name, f.note, f.category, f.ai || "", f.period || "", fmtBytes(f.size), bDate, bDateIso
      ];

      const inv = store.invoices.find(i => i.fileId === f.id);
      if (inv) {
        const c = clientById(inv.clientId) || {};
        fullText.push(
          "faktura", inv.number, c.name, c.ico, c.dic, inv.vs, 
          inv.issuedOn, inv.dueOn, inv.paidOn, 
          fmtDate(inv.issuedOn), fmtDate(inv.dueOn), inv.paidOn ? fmtDate(inv.paidOn) : "",
          fmtMoney(invoiceTotal(inv).total), 
          inv.status === 'paid' ? 'zaplaceno uhrazeno' : 'nezaplaceno ceka nezaplacena'
        );
        inv.lines.forEach(l => fullText.push(l.name, fmtMoney(l.unitPrice)));
        if (inv.tags) inv.tags.forEach(tg => fullText.push(tg));
        if (inv.reverseCharge) fullText.push("přenesená daňová povinnost", "reverse charge", "pdp");
      }
      
      const exp = store.expenses.find(x => x.fileId === f.id);
      if (exp) {
        fullText.push("vydaj", exp.supplier, exp.note, exp.category, exp.date, fmtDate(exp.date), fmtMoney(exp.amount));
      }

      const inc = store.incomes.find(x => x.fileId === f.id);
      if (inc) {
        fullText.push("prijem vyplata", inc.supplier, inc.note, inc.date, fmtDate(inc.date), fmtMoney(inc.amount));
      }

      const rawString = fullText.filter(Boolean).join(" ").toLowerCase();
      const strippedString = rawString.replace(/\s+/g, "");

      // Každý token (slovo z dotazu) musí být nalezen buď v čistém textu, nebo ve verzi bez mezer (např. 01.02.2026)
      return tokens.every(t => rawString.includes(t) || strippedString.includes(t.replace(/\s+/g, "")));
    }).sort((a, b) => b.addedAt - a.addedAt);
    wrap.innerHTML = found.length ? filesTable(found) : `<div class="empty-note">Nic nenalezeno.</div>`;
    return;
  }

  window.handleFileDrop = async (e, targetFolder) => {
    const fileId = e.dataTransfer.getData("text/plain");
    if (!fileId) return;
    await FilesBackend.update(fileId, { category: targetFolder || "Nezařazené" });
    renderFiles();
  };

  if (!currentFolder) {
    /* kořen: složky podle první části cesty */
    const allCats = [...new Set([...FILE_CATEGORIES, ...all.map(f => f.category)])];
    const rootCats = [...new Set(allCats.map(c => c.split('/')[0]))];
    
    wrap.innerHTML = `<div class="folder-grid">${rootCats.map(root => {
      const inCat = all.filter(f => f.category === root || f.category.startsWith(root + '/'));
      return `<button class="folder-tile" data-folder="${escHtml(root)}"
        ondragover="event.preventDefault(); this.style.borderColor='var(--primary)'"
        ondragleave="this.style.borderColor=''"
        ondrop="event.preventDefault(); this.style.borderColor=''; window.handleFileDrop(event, '${escHtml(root)}')">
        <span class="folder-icon">${icon("folder")}</span>
        <span class="folder-name">${escHtml(root)}</span>
        <span class="folder-meta">${inCat.length ? `${inCat.length} položek · ${fmtBytes(inCat.reduce((a, f) => a + f.size, 0))}` : "prázdná"}</span>
      </button>`;
    }).join("")}</div>`;
    return;
  }

  const prefix = currentFolder + '/';
  const allCats = [...new Set([...FILE_CATEGORIES, ...all.map(f => f.category)])];
  const subCats = [...new Set(allCats
    .filter(c => c.startsWith(prefix))
    .map(c => c.substring(prefix.length).split('/')[0])
  )].filter(Boolean);

  const inFolder = all.filter(f => f.category === currentFolder).sort((a, b) => b.addedAt - a.addedAt);
  
  let html = "";
  const parent = currentFolder.includes('/') ? currentFolder.substring(0, currentFolder.lastIndexOf('/')) : "";

  html += `<div class="folder-grid" style="margin-bottom: 24px;">`;
  html += `<button class="folder-tile" data-folder="${escHtml(parent)}"
      ondragover="event.preventDefault(); this.style.borderColor='var(--primary)'"
      ondragleave="this.style.borderColor=''"
      ondrop="event.preventDefault(); this.style.borderColor=''; window.handleFileDrop(event, '${escHtml(parent)}')">
      <span class="folder-icon" style="opacity:0.6">${icon("folder")}</span>
      <span class="folder-name">↖ Nadřazená složka</span>
      <span class="folder-meta">O úroveň výš</span>
    </button>`;

  if (subCats.length > 0) {
    html += subCats.map(sub => {
      const fullSubPath = prefix + sub;
      const inSub = all.filter(f => f.category === fullSubPath || f.category.startsWith(fullSubPath + '/'));
      return `<button class="folder-tile" data-folder="${escHtml(fullSubPath)}"
        ondragover="event.preventDefault(); this.style.borderColor='var(--primary)'"
        ondragleave="this.style.borderColor=''"
        ondrop="event.preventDefault(); this.style.borderColor=''; window.handleFileDrop(event, '${escHtml(fullSubPath)}')">
        <span class="folder-icon">${icon("folder")}</span>
        <span class="folder-name">${escHtml(sub)}</span>
        <span class="folder-meta">${inSub.length ? `${inSub.length} položek · ${fmtBytes(inSub.reduce((a, f) => a + f.size, 0))}` : "prázdná"}</span>
      </button>`;
    }).join("");
  }
  html += `</div>`;
  
  html += inFolder.length ? filesTable(inFolder) : `<div class="empty-note">${subCats.length ? "V této úrovni nejsou žádné soubory, jen podsložky." : "Složka je prázdná. Nahraj do ní soubory tlačítkem Nahrát, nebo je sem přetáhni."}</div>`;
  wrap.innerHTML = html;
}
/* po překreslení je výběr pryč — schovat lištu */
const _renderFilesOrig = renderFiles;
renderFiles = async function () {
  await _renderFilesOrig();
  if (document.getElementById("bulk-bar")) updateBulkBar();
};

document.getElementById("file-breadcrumb").addEventListener("click", e => {
  if (e.target.closest("[data-crumb-root]")) {
    currentFolder = null;
    document.getElementById("file-search").value = "";
    renderFiles();
  }
});
document.getElementById("file-list").addEventListener("click", async e => {
  const folder = e.target.closest("[data-folder]");
  if (folder) { currentFolder = folder.dataset.folder; renderFiles(); return; }
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.fileDl) FilesBackend.download(b.dataset.fileDl, b.closest("tr").querySelector("strong").textContent);
  if (b.dataset.fileDel && confirm("Opravdu smazat soubor?")) {
    await FilesBackend.remove(b.dataset.fileDel);
    renderFiles();
  }
  if (b.dataset.fileAi) analyzeFiles([b.dataset.fileAi]);
  if (b.dataset.fileConv) openConvertModal(b.dataset.fileConv);
  if (b.dataset.fileGoto) {
    currentFolder = b.dataset.fileGoto;
    document.getElementById("file-search").value = "";
    renderFiles();
  }
});
document.getElementById("file-list").addEventListener("change", async e => {
  const el = e.target.closest("[data-file-field]");
  if (!el) return;
  await FilesBackend.update(el.dataset.fileId, { [el.dataset.fileField]: el.value });
  if (el.dataset.fileField === "category") renderFiles();
});
document.getElementById("force-sync-folders").addEventListener("click", async function() {
  this.disabled = true;
  this.textContent = "Rozřazuji...";
  await linkAndSyncInvoices();
  this.disabled = false;
  this.innerHTML = `${icon("folder")} Rozřadit do podsložek`;
  alert("Soubory byly zkontrolovány a úspěšně rozřazeny do příslušných složek podle stavu faktury.");
});

/* ---- hromadné akce nad vybranými soubory ---- */
const selectedFileIds = () => [...document.querySelectorAll(".file-check:checked")].map(c => c.value);
function updateBulkBar() {
  const n = selectedFileIds().length;
  const bar = document.getElementById("bulk-bar");
  bar.hidden = n === 0;
  if (n) document.getElementById("bulk-count").textContent = `${n} vybráno`;
  document.getElementById("bulk-analyze").hidden = !serverMode;
  document.getElementById("bulk-convert").hidden = !serverMode;
}
document.getElementById("file-list").addEventListener("change", e => {
  if (e.target.classList.contains("file-check")) updateBulkBar();
});
document.getElementById("bulk-all").addEventListener("click", () => {
  const boxes = [...document.querySelectorAll(".file-check")];
  const allChecked = boxes.every(b => b.checked);
  boxes.forEach(b => (b.checked = !allChecked));
  updateBulkBar();
});
document.getElementById("bulk-clear").addEventListener("click", () => {
  document.querySelectorAll(".file-check:checked").forEach(b => (b.checked = false));
  updateBulkBar();
});
document.getElementById("bulk-analyze").addEventListener("click", async () => {
  const ids = selectedFileIds();
  const all = await FilesBackend.list();
  const ok = ids.filter(id => { const f = all.find(x => x.id === id); return f && isAnalyzable(f); });
  if (!ok.length) { alert("Mezi vybranými není žádné PDF ani obrázek k analýze."); return; }
  analyzeFiles(ok);
});
document.getElementById("bulk-convert").addEventListener("click", async () => {
  if (!serverMode) { alert("Hromadný převod potřebuje server — spusť aplikaci přes start.command."); return; }
  const ids = selectedFileIds();
  const all = await FilesBackend.list();
  const files = ids.map(id => all.find(f => f.id === id)).filter(f => f && pdfTargetFor(f));
  if (!files.length) { alert("Mezi vybranými není nic převoditelného do PDF (CSV, text, obrázky)."); return; }
  const skipped = ids.length - files.length;
  if (skipped && !confirm(`${files.length} souborů půjde převést, ${skipped} se přeskočí (už jsou PDF nebo nepodporovaný typ). Pokračovat?`)) return;
  try {
    openConvertPreview(files[0], await buildPdfBody(files[0], pdfTargetFor(files[0])), files);
  } catch (e) { alert("Náhled se nepovedl: " + e.message); }
});
document.getElementById("bulk-move").addEventListener("click", async () => {
  const ids = selectedFileIds();
  if (!ids.length) return;
  const cat = document.getElementById("bulk-move-cat").value;
  for (const id of ids) await FilesBackend.update(id, { category: cat });
  renderFiles(); updateBulkBar();
});
document.getElementById("bulk-delete").addEventListener("click", async () => {
  const ids = selectedFileIds();
  if (!ids.length || !confirm(`Opravdu smazat ${ids.length} souborů?`)) return;
  for (const id of ids) await FilesBackend.remove(id);
  renderFiles(); updateBulkBar();
});

document.getElementById("analyze-selected").addEventListener("click", async () => {
  if (!serverMode) { alert("AI analýza potřebuje server — spusť aplikaci přes start.command."); return; }
  let ids = [...document.querySelectorAll(".file-check:checked")].map(ch => ch.value);
  if (!ids.length) {
    const all = await FilesBackend.list();
    /* bez výběru: ve složce → celá složka; v kořenu → přednostně Nezařazené */
    let scope, scopeName;
    if (currentFolder) { scope = all.filter(f => f.category === currentFolder); scopeName = `ve složce ${currentFolder}`; }
    else if (all.some(f => f.category === "Nezařazené" && isAnalyzable(f))) { scope = all.filter(f => f.category === "Nezařazené"); scopeName = "ve složce Nezařazené"; }
    else { scope = all; scopeName = "ve všech složkách"; }
    const cands = scope.filter(isAnalyzable);
    if (!cands.length) { alert("Žádné analyzovatelné soubory (PDF/obrázky). Zaškrtni soubory, nebo nějaké nahraj."); return; }
    if (!confirm(`Nemáš nic zaškrtnuto — analyzovat ${cands.length} souborů ${scopeName}?`)) return;
    ids = cands.map(f => f.id);
  }
  analyzeFiles(ids);
});

/* ---- drag & drop nahrávání ---- */
const filesTabEl = document.getElementById("tab-files");
let dragDepth = 0;
filesTabEl.addEventListener("dragover", e => {
  e.preventDefault();
  const t = e.target.closest(".folder-tile");
  document.querySelectorAll(".folder-tile.drop-target").forEach(x => { if (x !== t) x.classList.remove("drop-target"); });
  if (t) t.classList.add("drop-target");
});
filesTabEl.addEventListener("dragenter", e => {
  e.preventDefault();
  dragDepth++;
  filesTabEl.classList.add("drag-over");
});
filesTabEl.addEventListener("dragleave", () => {
  if (--dragDepth <= 0) {
    dragDepth = 0;
    filesTabEl.classList.remove("drag-over");
    document.querySelectorAll(".folder-tile.drop-target").forEach(x => x.classList.remove("drop-target"));
  }
});
filesTabEl.addEventListener("drop", async e => {
  e.preventDefault();
  dragDepth = 0;
  filesTabEl.classList.remove("drag-over");
  const tile = e.target.closest(".folder-tile");
  document.querySelectorAll(".folder-tile.drop-target").forEach(x => x.classList.remove("drop-target"));
  const files = [...e.dataTransfer.files];
  if (!files.length) return;
  const cat = tile ? tile.dataset.folder : (currentFolder || "Nezařazené");
  for (const f of files) await FilesBackend.add(f, cat);
  renderFiles();
  /* upozornit na tlačítko Analyzovat */
  const btn = document.getElementById("analyze-selected");
  btn.classList.add("pulse");
  setTimeout(() => btn.classList.remove("pulse"), 4000);
});

/* =====================================================================
   KONVERTOR SOUBORŮ
   ===================================================================== */
let convertFile = null;
function convertTargets(f) {
  const ext = f.name.split(".").pop().toLowerCase();
  const t = [];
  if (ext === "csv") t.push(["pdf-table", icon("file-text") + " → PDF (tabulka pro tisk)"]);
  if (["txt", "md", "log", "json", "xml"].includes(ext)) t.push(["pdf-text", icon("file-text") + " → PDF (text pro tisk)"]);
  if (["png", "jpg", "jpeg", "webp", "heic", "heif", "tif", "tiff", "gif"].includes(ext)) {
    t.push(["pdf-image", icon("file-text") + " → PDF (obrázek na stránce)"]);
    if (serverMode) t.push(["png", icon("image") + " → PNG"]);
  }
  if (ext === "pdf" && serverMode) t.push(["png", icon("image") + " → PNG (první stránka)"]);
  return t;
}
async function fileTextContent(id) {
  await filesReady;
  if (serverMode) return (await fetch(`/api/files/${id}/content`)).text();
  const rec = await idbReq(filesOs("readonly").get(id));
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsText(rec.blob);
  });
}
function parseCsv(text) {
  const firstLine = text.slice(0, text.indexOf("\n") + 1 || text.length);
  const delim = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ";" : ",";
  const rows = [];
  let row = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
      else cell += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === delim) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some(c => c !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); if (row.some(c => c !== "")) rows.push(row); }
  return rows;
}
function printDocument(title, innerHtml) {
  const paper = document.getElementById("invoice-paper");
  paper.className = "paper paper-doc";
  paper.innerHTML = `<div class="doc-title">${escHtml(title)}</div>` + innerHtml;
  const cd = document.getElementById("preview-cashdoc"); if (cd) cd.hidden = true;
  const dl = document.getElementById("preview-delivery"); if (dl) dl.hidden = true;
  previewInvoice = null;
  document.getElementById("preview-xml").hidden = true;
  document.querySelectorAll(".tab").forEach(t => (t.hidden = true));
  document.querySelector(".topbar").style.display = "none";
  document.getElementById("preview-wrap").hidden = false;
  window.scrollTo(0, 0);
  document.title = title;
}
async function openConvertModal(id) {
  const all = await FilesBackend.list();
  convertFile = all.find(f => f.id === id);
  if (!convertFile) return;
  const opts = convertTargets(convertFile);
  document.getElementById("convert-file-name").textContent = convertFile.name;
  document.getElementById("convert-options").innerHTML = opts.length
    ? opts.map(([k, l]) => `<button class="btn-ghost convert-opt" data-conv="${k}">${l}</button>`).join("")
    : `<div class="empty-note">Pro tento typ souboru není k dispozici žádný převod${serverMode ? "" : " — spusť aplikaci přes start.command pro víc možností"}.</div>`;
  document.querySelector("#convert-modal .convert-hint").hidden = !serverMode;
  document.getElementById("convert-modal").hidden = false;
}
/* samostatný HTML dokument pro tisk do PDF (renderuje headless Chrome na serveru) */
function convHtmlDoc(title, body, fontPt) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  @page { margin: 12mm; }
  body { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #1a1a1a; font-size: ${fontPt}pt; line-height: 1.4; }
  h1 { font-size: 13pt; border-bottom: 2px solid #1a1a1a; padding-bottom: 6px; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: ${(fontPt * 0.85).toFixed(1)}pt; text-transform: uppercase; letter-spacing: .05em; color: #9b9b9b; border-bottom: 2px solid #1a1a1a; padding: 3px 6px 3px 0; }
  td { border-bottom: 1px solid #e3e3e3; padding: 3px 6px 3px 0; vertical-align: top; word-break: break-word; }
  pre { white-space: pre-wrap; word-break: break-word; font-family: Menlo, Consolas, monospace; }
  img { max-width: 100%; }
  </style></head><body><h1>${escHtml(title)}</h1>${body}</body></html>`;
}
/* automatický PDF cíl podle přípony (pro hromadný převod) */
function pdfTargetFor(f) {
  const ext = f.name.split(".").pop().toLowerCase();
  if (ext === "csv") return "pdf-table";
  if (["txt", "md", "log", "json", "xml"].includes(ext)) return "pdf-text";
  if (["png", "jpg", "jpeg", "webp", "heic", "heif", "tif", "tiff", "gif"].includes(ext)) return "pdf-image";
  return null;
}
/* postavit HTML obsah PDF pro daný soubor a cíl */
async function buildPdfBody(f, target) {
  if (target === "pdf-table") {
    const rows = parseCsv(await fileTextContent(f.id));
    if (!rows.length) throw new Error("soubor je prázdný");
    return `<table><thead><tr>${rows[0].map(c => `<th>${escHtml(c)}</th>`).join("")}</tr></thead>
      <tbody>${rows.slice(1).map(r => `<tr>${r.map(c => `<td>${escHtml(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }
  if (target === "pdf-text") return `<pre>${escHtml(await fileTextContent(f.id))}</pre>`;
  if (target === "pdf-image") {
    if (serverMode) {
      const p = await apiJson(`/api/files/${f.id}/png`);
      if (!p.base64) throw new Error(p.error || "převod obrázku selhal");
      return `<img src="data:image/png;base64,${p.base64}" alt="">`;
    }
    const rec = await idbReq(filesOs("readonly").get(f.id));
    return `<img class="doc-img" src="${URL.createObjectURL(rec.blob)}" alt="">`;
  }
  throw new Error("nepodporovaný typ");
}

async function runConvert(target) {
  const f = convertFile;
  document.getElementById("convert-modal").hidden = true;
  try {
    /* → PNG: server převede a rovnou uloží mezi soubory */
    if (target === "png") {
      const r = await apiJson(`/api/files/${f.id}/topng`, { method: "POST" });
      if (r.error) throw new Error(r.error);
      renderFiles();
      alert(`Hotovo — ${r.name} je uložený ve složce ${r.category}.`);
      return;
    }
    /* → PDF: náhled s nastavením velikosti */
    openConvertPreview(f, await buildPdfBody(f, target));
  } catch (err) {
    alert("Převod se nepovedl: " + err.message);
  }
}

/* ---- náhled převodu s velikostí v % (jako export v Apple Notes) ---- */
let convPreview = null;
function applyConvPreview() {
  if (!convPreview) return;
  const pct = Number(document.getElementById("conv-scale").value) || 100;
  const land = document.getElementById("conv-orient").value === "landscape";
  const paper = document.getElementById("invoice-paper");
  paper.className = "paper paper-doc" + (land ? " paper-land" : "");
  paper.style.fontSize = (10 * pct / 100) + "pt";
  paper.innerHTML = `<div class="doc-title">${escHtml(convPreview.file.name)}</div>` +
    convPreview.body.replace("<table>", '<table class="doc-table">').replace("<pre>", '<pre class="doc-pre">');
}
function openConvertPreview(file, body, batch) {
  convPreview = { file, body, batch: batch || null };
  previewInvoice = null;
  applyConvPreview();
  document.getElementById("preview-toolbar").hidden = true;
  document.getElementById("convert-toolbar").hidden = false;
  const saveBtn = document.getElementById("conv-save");
  saveBtn.hidden = !serverMode;
  saveBtn.innerHTML = icon("save") + (batch && batch.length > 1 ? ` Uložit všech ${batch.length} PDF` : " Uložit PDF do souborů");
  document.getElementById("conv-hint").textContent = !serverMode
    ? "Bez serveru ulož přes Cmd+P (Uložit jako PDF)."
    : batch && batch.length > 1
      ? `Náhled prvního souboru — velikost a orientace se použijí pro všech ${batch.length} souborů.`
      : "Náhled — velikost a orientaci uprav nahoře.";
  document.querySelectorAll(".tab").forEach(t => (t.hidden = true));
  document.querySelector(".topbar").style.display = "none";
  document.getElementById("preview-wrap").hidden = false;
  window.scrollTo(0, 0);
  document.title = "Převod: " + file.name;
}
document.getElementById("conv-scale").addEventListener("change", applyConvPreview);
document.getElementById("conv-orient").addEventListener("change", applyConvPreview);
document.getElementById("conv-back").addEventListener("click", () => closePreview());
async function savePdfConversion(f, body, pct, landscape) {
  const r = await apiJson("/api/htmlpdf", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      html: convHtmlDoc(f.name, body, 10 * pct / 100), landscape,
      name: f.name.replace(/\.[^.]+$/, "") + ".pdf", category: f.category,
      ai: `Převedeno z ${f.name} (${pct} %)`
    })
  });
  if (r.error) throw new Error(r.error);
  return r;
}
document.getElementById("conv-save").addEventListener("click", async () => {
  if (!convPreview) return;
  const pct = Number(document.getElementById("conv-scale").value) || 100;
  const landscape = document.getElementById("conv-orient").value === "landscape";
  const btn = document.getElementById("conv-save");
  const orig = btn.innerHTML;
  btn.disabled = true;
  try {
    const batch = convPreview.batch;
    if (batch && batch.length > 1) {
      /* hromadně: stejné nastavení pro všechny vybrané */
      let ok = 0;
      const failed = [];
      for (let i = 0; i < batch.length; i++) {
        const f = batch[i];
        btn.textContent = `Ukládám ${i + 1}/${batch.length}…`;
        try {
          const body = i === 0 ? convPreview.body : await buildPdfBody(f, pdfTargetFor(f));
          await savePdfConversion(f, body, pct, landscape);
          ok++;
        } catch (e) { failed.push(f.name); }
      }
      closePreview();
      renderFiles();
      alert(`Hotovo — uloženo ${ok} PDF (${pct} %, ${landscape ? "na šířku" : "na výšku"}).` +
        (failed.length ? ` Selhalo: ${failed.join(", ")}` : ""));
    } else {
      btn.textContent = "Ukládám…";
      const r = await savePdfConversion(convPreview.file, convPreview.body, pct, landscape);
      closePreview();
      renderFiles();
      alert(`Hotovo — ${r.name} je uložený ve složce ${r.category}.`);
    }
  } catch (e) {
    alert("Uložení selhalo: " + e.message);
  } finally {
    btn.disabled = false; btn.innerHTML = orig;
  }
});
document.getElementById("convert-options").addEventListener("click", e => {
  const b = e.target.closest("[data-conv]");
  if (b) runConvert(b.dataset.conv);
});

/* =====================================================================
   AI ANALÝZA FAKTUR — Ollama (přes server proxy)
   ===================================================================== */
const AI_PROMPT = `Jsi účetní asistent. Dostaneš dokument, nejspíš fakturu. Vytáhni z něj údaje a vrať POUZE platný JSON objekt s těmito klíči (pokud údaj nelze zjistit, dej null):
- "je_faktura": true pokud je dokument faktura, jinak false
- "dodavatel": název subjektu v sekci DODAVATEL (ten, kdo fakturu vystavil) — nikdy názvy z položek
- "dodavatel_ico": IČO dodavatele (8 číslic jako string)
- "dodavatel_dic": DIČ dodavatele včetně předpony CZ (string), null pokud není uvedeno
- "dodavatel_ulice": ulice a číslo popisné dodavatele (string)
- "dodavatel_mesto": město dodavatele (string)
- "dodavatel_psc": PSČ dodavatele (string, jen číslice)
- "odberatel": název subjektu v sekci ODBĚRATEL (ten, kdo má platit)
- "odberatel_ico": IČO odběratele (8 číslic jako string)
- "odberatel_dic": DIČ odběratele včetně předpony CZ (string), null pokud není uvedeno
- "odberatel_ulice": ulice a číslo popisné odběratele (string)
- "odberatel_mesto": město odběratele (string)
- "odberatel_psc": PSČ odběratele (string, jen číslice)
- "cislo_faktury": číslo faktury (string)
- "variabilni_symbol": variabilní symbol (string)
- "castka": celková částka k úhradě jako číslo (number, bez měny)
- "mena": kód měny, např. "CZK"
- "datum_vystaveni": datum vystavení YYYY-MM-DD
- "datum_splatnosti": datum splatnosti YYYY-MM-DD
- "kategorie_vydaje": jedna z "Software", "Hardware", "Služby", "Hosting", "Kancelář", "Doprava", "Ostatní"
- "popis": stručné shrnutí, co bylo fakturováno, max 10 slov
- "typ_dokumentu": "faktura" pokud jde o fakturu; "vyplata" pokud jde o výpis nebo report o vyplacené částce (např. Apple/Google/App Store payout, provize, bankovní avízo o platbě); jinak "jine"
- pro typ "vyplata" navíc vyplň: "prijem_castka" (finální VYPLACENÁ částka jako number — hledej "paid", "payout", "total paid"), "prijem_mena" (kód měny), "prijem_od" (NÁZEV SPOLEČNOSTI, která vyplácí, např. "Apple" — nikdy název souboru), "prijem_datum" (datum výplaty; když není uvedeno, použij poslední den období reportu, YYYY-MM-DD)
Adresy čti přesně z dokumentu (ulice, město i PSČ zvlášť).`;

async function ollamaChat(messages) {
  const s = store.settings;
  const resp = await apiJson("/api/ollama", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: s.ollamaUrl || "http://localhost:11434",
      path: "/api/chat",
      body: { model: s.ollamaModel, messages, stream: false, format: "json", options: { temperature: 0 } }
    })
  });
  if (resp.error) throw new Error(resp.error);
  return resp.message && resp.message.content;
}

/* ---- klasifikace: vydaná (můj IČO = dodavatel) / přijatá / příjem-výplata ---- */
function classifyDoc(d) {
  if (d.typ_dokumentu === "vyplata" || (d.je_faktura === false && d.prijem_castka)) return "prijem";
  if (d.je_faktura === false) return "file";
  const my = (store.settings.ico || "").replace(/\s/g, "");
  const dIco = String(d.dodavatel_ico || "").replace(/\s/g, "");
  const oIco = String(d.odberatel_ico || "").replace(/\s/g, "");
  if (my && dIco === my) return "vydana";
  if (my && oIco === my) return "prijata";
  const myName = (store.settings.name || "").toLowerCase();
  if (myName && String(d.dodavatel || "").toLowerCase().includes(myName)) return "vydana";
  return "prijata";
}
const validDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d || "") ? d : "";

const aiModal = document.getElementById("ai-modal");
const aiResultsEl = document.getElementById("ai-results");
const aiProgress = document.getElementById("ai-progress");
let aiRunning = false;

async function analyzeOne(file) {
  let messages;
  if (/\.(csv|txt)$/i.test(file.name)) {
    const text = await fileTextContent(file.id);
    messages = [{ role: "user", content: AI_PROMPT + "\n\nObsah dokumentu (" + file.name + "):\n" + text.slice(0, 8000) }];
  } else {
    const t = await apiJson(`/api/files/${file.id}/text`);
    if (t.text && t.text.trim().length > 40) {
      messages = [{ role: "user", content: AI_PROMPT + "\n\nText dokumentu:\n" + t.text.slice(0, 8000) }];
    } else {
      const p = await apiJson(`/api/files/${file.id}/png`);
      if (!p.base64) throw new Error("nejde získat text ani obrázek (" + (t.error || p.error || "?") + ")");
      messages = [{ role: "user", content: AI_PROMPT, images: [p.base64] }];
    }
  }
  const content = await ollamaChat(messages);
  try { return JSON.parse(content); }
  catch { throw new Error("model nevrátil platný JSON"); }
}

function aiCard(file, d, err) {
  if (err) return `<div class="ai-card ai-card-err" data-ai-file="${file.id}">
    <div class="ai-card-head"><strong>${escHtml(file.name)}</strong><span class="badge overdue">chyba</span></div>
    <div class="ai-err">${escHtml(err)}</div>
  </div>`;
  const typ = classifyDoc(d);
  const usedMena = typ === "prijem" ? (d.prijem_mena || d.mena) : d.mena;
  const isForeign = usedMena && usedMena !== "CZK";
  const initAmount = typ === "prijem" ? (d.prijem_castka ?? d.castka ?? "") : (d.castka ?? "");
  const initDate = typ === "prijem" ? (validDate(d.prijem_datum) || validDate(d.datum_vystaveni)) : validDate(d.datum_vystaveni);
  return `<div class="ai-card" data-ai-file="${file.id}" data-doc="${escHtml(JSON.stringify(d))}">
    <div class="ai-card-head">
      <label class="file-pick"><input type="checkbox" class="ai-inc" checked> <strong>${escHtml(file.name)}</strong></label>
      <select class="ai-typ">
        <option value="vydana"${typ === "vydana" ? " selected" : ""}>Vydaná faktura → příjem</option>
        <option value="prijata"${typ === "prijata" ? " selected" : ""}>Přijatá faktura → výdaj</option>
        <option value="prijem"${typ === "prijem" ? " selected" : ""}>Výplata / výpis → ostatní příjem</option>
        <option value="file"${typ === "file" ? " selected" : ""}>Jen zařadit soubor</option>
      </select>
    </div>
    ${isForeign ? `<div class="ai-err">${icon("alert")} Měna ${escHtml(usedMena)} — částku zkontroluj / přepočti na Kč.</div>` : ""}
    <div class="ai-addr"></div>
    <div class="ai-fields">
      <label class="ai-f-party">${typ === "vydana" ? "Odběratel (klient)" : typ === "prijem" ? "Zdroj příjmu" : "Dodavatel"}
        <input class="ai-party" value="${escHtml(typ === "vydana" ? (d.odberatel || "") : typ === "prijem" ? (d.prijem_od || d.dodavatel || "") : (d.dodavatel || ""))}"
          data-vydana="${escHtml(d.odberatel || "")}" data-prijata="${escHtml(d.dodavatel || "")}" data-prijem="${escHtml(d.prijem_od || d.dodavatel || "")}">
      </label>
      <label>Částka (Kč) <input class="ai-amount" type="number" step="any" value="${initAmount}"></label>
      <label>Datum <input class="ai-date" type="date" value="${initDate}"></label>
      <label class="ai-only-vydana">Splatnost <input class="ai-due" type="date" value="${validDate(d.datum_splatnosti)}"></label>
      <label class="ai-only-vydana">Číslo faktury <input class="ai-number" value="${escHtml(d.cislo_faktury || "")}"></label>
      <label class="ai-only-vydana checkbox-label"><input type="checkbox" class="ai-paid" checked> Už je zaplacená</label>
      <label class="ai-only-prijata">Kategorie výdaje
        <select class="ai-expcat">${EXPENSE_CATEGORIES.map(c => `<option${c === d.kategorie_vydaje ? " selected" : ""}>${c}</option>`).join("")}</select>
      </label>
      <label class="ai-only-file">Zařadit do složky
        <select class="ai-filecat">${FILE_CATEGORIES.map(c => `<option${c === file.category ? " selected" : ""}>${c}</option>`).join("")}</select>
      </label>
      <label class="full">Popis <input class="ai-note" value="${escHtml(d.popis || "")}"></label>
    </div>
    <input type="hidden" class="ai-vs" value="${escHtml(d.variabilni_symbol || "")}">
  </div>`;
}
function applyAiTyp(card) {
  const typ = card.querySelector(".ai-typ").value;
  card.classList.remove("typ-vydana", "typ-prijata", "typ-file");
  card.classList.add("typ-" + typ);
  const party = card.querySelector(".ai-party");
  if (party) {
    card.querySelector(".ai-f-party").firstChild.textContent =
      typ === "vydana" ? "Odběratel (klient)" : typ === "prijem" ? "Zdroj příjmu" : "Dodavatel";
    if (typ === "vydana" && party.dataset.vydana) party.value = party.dataset.vydana;
    if (typ === "prijata" && party.dataset.prijata) party.value = party.dataset.prijata;
    if (typ === "prijem" && party.dataset.prijem) party.value = party.dataset.prijem;
  }
  /* adresa a DIČ protistrany z analýzy */
  const addrEl = card.querySelector(".ai-addr");
  if (addrEl) {
    try {
      const dd = JSON.parse(card.dataset.doc || "{}");
      const p = typ === "vydana" ? "odberatel" : "dodavatel";
      const bits = [dd[p + "_ulice"], [dd[p + "_psc"], dd[p + "_mesto"]].filter(Boolean).join(" "), dd[p + "_ico"] ? "IČO " + dd[p + "_ico"] : "", dd[p + "_dic"] ? "DIČ " + dd[p + "_dic"] : ""].filter(Boolean);
      addrEl.textContent = bits.length ? bits.join(" · ") : "";
      addrEl.hidden = !bits.length || typ === "file";
    } catch { addrEl.hidden = true; }
  }
}
aiResultsEl.addEventListener("change", e => {
  if (e.target.classList.contains("ai-typ")) applyAiTyp(e.target.closest(".ai-card"));
});

async function analyzeFiles(ids) {
  if (aiRunning) return;
  if (!serverMode) { alert("AI analýza potřebuje server — spusť aplikaci přes start.command."); return; }
  if (!store.settings.ollamaModel) {
    alert("Nejdřív si v Nastavení vyber model Ollama (tlačítko Načíst → vyber model → Uložit nastavení).");
    return;
  }
  aiRunning = true;
  aiResultsEl.innerHTML = "";
  document.getElementById("ai-save").hidden = true;
  aiProgress.hidden = false;
  aiModal.hidden = false;
  const all = await FilesBackend.list();
  let done = 0;
  for (const id of ids) {
    const file = all.find(f => f.id === id);
    if (!file) continue;
    aiProgress.textContent = `Analyzuji ${done + 1}/${ids.length}: ${file.name}…`;
    try {
      const d = await analyzeOne(file);
      aiResultsEl.insertAdjacentHTML("beforeend", aiCard(file, d));
      applyAiTyp(aiResultsEl.lastElementChild);
    } catch (err) {
      aiResultsEl.insertAdjacentHTML("beforeend", aiCard(file, null, err.message));
    }
    done++;
  }
  aiProgress.textContent = `Hotovo — zkontroluj údaje níž, uprav co potřeba a ulož.`;
  document.getElementById("ai-save").hidden = !aiResultsEl.querySelector(".ai-inc");
  aiRunning = false;
}

document.getElementById("ai-save").addEventListener("click", async () => {
  const cards = [...aiResultsEl.querySelectorAll(".ai-card:not(.ai-card-err)")];
  let nInv = 0, nExp = 0, nSkip = 0, nFile = 0, nInc = 0;
  for (const card of cards) {
    if (!card.querySelector(".ai-inc").checked) continue;
    const fileId = card.dataset.aiFile;
    const typ = card.querySelector(".ai-typ").value;
    const party = card.querySelector(".ai-party").value.trim();
    const amount = Number(card.querySelector(".ai-amount").value) || 0;
    const date = card.querySelector(".ai-date").value || todayISO();
    const note = card.querySelector(".ai-note").value.trim();

    if (typ === "vydana") {
      const number = card.querySelector(".ai-number").value.trim() || "import-" + date;
      if (store.invoices.some(i => i.number === number)) { nSkip++; continue; }
      /* klient: nejdřív podle IČO, pak podle jména; jinak založit nového i s adresou a DIČ */
      let dd = {};
      try { dd = JSON.parse(card.dataset.doc || "{}"); } catch { /* bez detailů */ }
      const pico = String(dd.odberatel_ico || "").replace(/\s/g, "");
      let client = (pico && store.clients.find(c => (c.ico || "").replace(/\s/g, "") === pico))
        || store.clients.find(c => c.name.trim().toLowerCase() === party.toLowerCase());
      if (!client) {
        client = {
          id: uid(), name: party || "Neznámý klient", ico: pico,
          dic: dd.odberatel_dic || "", street: dd.odberatel_ulice || "",
          city: dd.odberatel_mesto || "", zip: dd.odberatel_psc || "", email: ""
        };
        store.clients.push(client);
      } else {
        /* doplnit chybějící údaje existujícímu klientovi */
        if (pico && !client.ico) client.ico = pico;
        if (dd.odberatel_dic && !client.dic) client.dic = dd.odberatel_dic;
        if (dd.odberatel_ulice && !client.street) client.street = dd.odberatel_ulice;
        if (dd.odberatel_mesto && !client.city) client.city = dd.odberatel_mesto;
        if (dd.odberatel_psc && !client.zip) client.zip = dd.odberatel_psc;
      }
      const dueOn = card.querySelector(".ai-due").value || date;
      const paid = card.querySelector(".ai-paid").checked;
      store.invoices.push({
        id: uid(), clientId: client.id, number,
        vs: card.querySelector(".ai-vs").value || vsFromNumber(number),
        issuedOn: date, dueDays: Math.max(0, Math.round((new Date(dueOn) - new Date(date)) / 86400000)),
        dueOn, paymentMethod: "Převodem", rounding: false,
        status: paid ? "paid" : "issued", paidOn: paid ? dueOn : undefined,
        imported: true, fileId,
        lines: [{ name: note || "Fakturované služby", qty: 1, unit: "", unitPrice: amount, vatRate: 0 }]
      });
      await FilesBackend.update(fileId, {
        category: "Faktury", period: date.slice(0, 7),
        ai: `Vydaná faktura ${number} · ${party} · ${fmtMoney(amount)} · ${fmtDate(date)}`
      });
      nInv++;
    } else if (typ === "prijata") {
      store.expenses.push({
        id: uid(), supplier: party || "Neznámý dodavatel", amount, date,
        category: card.querySelector(".ai-expcat").value, note, fileId, source: "ai"
      });
      await FilesBackend.update(fileId, {
        category: "Faktury", period: date.slice(0, 7),
        ai: `Přijatá faktura · ${party} · ${fmtMoney(amount)} · ${fmtDate(date)} · ${card.querySelector(".ai-expcat").value}`
      });
      nExp++;
    } else if (typ === "prijem") {
      store.incomes.push({
        id: uid(), supplier: party || "Neznámý zdroj", amount, date, note, fileId, source: "ai"
      });
      await FilesBackend.update(fileId, {
        category: "Příjmy", period: date.slice(0, 7),
        ai: `Příjem · ${party} · ${fmtMoney(amount)} · ${fmtDate(date)}`
      });
      nInc++;
    } else {
      await FilesBackend.update(fileId, {
        category: card.querySelector(".ai-filecat").value, period: date ? date.slice(0, 7) : "",
        ai: note ? `Dokument · ${note}` : "Dokument (není faktura)"
      });
      nFile++;
    }
  }
  saveStore();
  renderClients(); renderInvoices(); renderExpenses(); renderIncomes(); renderFiles();
  aiModal.hidden = true;
  const parts = [];
  if (nInv) parts.push(`${nInv} vydaných faktur`);
  if (nExp) parts.push(`${nExp} výdajů`);
  if (nInc) parts.push(`${nInc} ostatních příjmů`);
  if (nFile) parts.push(`${nFile} zařazených souborů`);
  alert(`Uloženo: ${parts.join(", ") || "nic"}.` + (nSkip ? ` Přeskočeno ${nSkip} duplicit (stejné číslo faktury).` : ""));
});

/* načtení modelů Ollama do nastavení */
document.getElementById("load-models").addEventListener("click", async () => {
  const sel = document.getElementById("ollama-model");
  sel.innerHTML = `<option value="">načítám…</option>`;
  try {
    const urlBase = settingsForm.elements.ollamaUrl.value.trim() || "http://localhost:11434";
    const resp = await apiJson("/api/ollama", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: urlBase, path: "/api/tags", method: "GET" })
    });
    if (!resp.models) throw new Error(resp.error || "žádné modely");
    sel.innerHTML = resp.models.map(m => `<option value="${escHtml(m.name)}">${escHtml(m.name)}</option>`).join("");
    if (store.settings.ollamaModel && resp.models.some(m => m.name === store.settings.ollamaModel)) sel.value = store.settings.ollamaModel;
  } catch (err) {
    sel.innerHTML = `<option value="">— načti modely —</option>`;
    alert("Modely se nepodařilo načíst: " + err.message + (serverMode ? "" : "\n(Aplikace musí běžet přes start.command)"));
  }
});

/* =====================================================================
   OSTATNÍ PŘÍJMY (mimo faktury — výplaty Apple, Google, provize…)
   ===================================================================== */
if (!store.incomes) store.incomes = [];
const incomeModal = document.getElementById("income-modal");
const incomeForm = document.getElementById("income-form");

document.getElementById("new-income").addEventListener("click", () => openIncomeModal());
function openIncomeModal(data) {
  incomeForm.reset();
  document.getElementById("income-modal-title").textContent = data && data.id ? "Upravit příjem" : "Nový příjem";
  const f = incomeForm.elements;
  f.date.value = todayISO();
  if (data) for (const k of ["id", "fileId", "source", "supplier", "amount", "date", "period", "note"]) {
    if (data[k] !== undefined && data[k] !== null) f[k].value = data[k];
  }
  incomeModal.hidden = false;
}
incomeForm.addEventListener("submit", e => {
  e.preventDefault();
  const f = incomeForm.elements;
  const data = {
    supplier: f.supplier.value.trim(), amount: Number(f.amount.value) || 0,
    date: f.date.value, period: f.period.value || undefined, note: f.note.value.trim(),
    fileId: f.fileId.value || null, source: f.source.value || "manual"
  };
  if (f.id.value) Object.assign(store.incomes.find(x => x.id === f.id.value), data);
  else { data.id = uid(); store.incomes.push(data); }
  saveStore(); renderIncomes(); renderDashboard(); incomeModal.hidden = true;
});

function renderIncomes() {
  const wrap = document.getElementById("income-list");
  if (!store.incomes.length) {
    wrap.innerHTML = `<div class="empty-note empty-slim">Zatím žádné ostatní příjmy. Přidej ručně, nebo nech AI přečíst výpis o výplatě (Apple, Google…) v Souborech.</div>`;
    return;
  }
  const sorted = [...store.incomes].sort((a, b) => b.date.localeCompare(a.date));
  const total = sorted.reduce((a, x) => a + x.amount, 0);
  wrap.innerHTML = `<table class="list-table">
    <thead><tr><th>Zdroj</th><th>Datum</th><th>Popis</th><th class="num">Částka</th><th style="white-space: nowrap;">Zdroj dat</th><th></th></tr></thead>
    <tbody>${sorted.map(x => `
      <tr>
        <td><strong>${escHtml(x.supplier)}</strong></td>
        <td data-label="Datum">${fmtDate(x.date)}${x.period ? ` <span class="paid-note">→ ${fmtPeriod(x.period)}</span>` : ""}</td>
        <td data-label="Popis">${escHtml(x.note)}</td>
        <td class="num" data-label="Částka">${fmtMoney(x.amount)}</td>
        <td data-label="Zdroj dat" style="white-space: nowrap;">${x.source === "ai" ? `<span class="badge ai">AI</span>` : `<span class="badge manual">ručně</span>`}</td>
        <td class="actions">
          <div class="action-stack">
            ${x.fileId && serverMode ? `<button class="btn-ghost btn-small" data-inc-file="${x.fileId}">${icon("download")} Doklad</button>` : ""}
            <button class="btn-ghost btn-small" data-inc-edit="${x.id}">${icon("edit")} Upravit</button>
            <button class="btn-ghost btn-small btn-danger" data-inc-del="${x.id}">${icon("trash")} Smazat</button>
          </div>
        </td>
      </tr>`).join("")}
      <tr><td><strong>Celkem</strong></td><td></td><td></td><td class="num" data-label="Celkem"><strong>${fmtMoney(total)}</strong></td><td></td><td></td></tr>
    </tbody></table>`;
}
document.getElementById("income-list").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.incEdit) openIncomeModal(store.incomes.find(x => x.id === b.dataset.incEdit));
  if (b.dataset.incDel && confirm("Opravdu smazat příjem?")) {
    store.incomes = store.incomes.filter(x => x.id !== b.dataset.incDel);
    saveStore(); renderIncomes(); renderDashboard();
  }
  if (b.dataset.incFile) FilesBackend.download(b.dataset.incFile);
});

/* =====================================================================
   VÝDAJE
   ===================================================================== */
if (!store.expenses) store.expenses = [];
const EXPENSE_CATEGORIES = ["Software", "Hardware", "Služby", "Hosting", "Kancelář", "Doprava", "Ostatní"];
const expenseModal = document.getElementById("expense-modal");
const expenseForm = document.getElementById("expense-form");

document.getElementById("new-expense").addEventListener("click", () => openExpenseModal());
function openExpenseModal(data, fromAi) {
  expenseForm.reset();
  document.getElementById("expense-modal-title").textContent = data && data.id ? "Upravit výdaj" : "Nový výdaj";
  document.getElementById("expense-ai-note").hidden = !fromAi;
  const f = expenseForm.elements;
  f.date.value = todayISO();
  if (data) for (const k of ["id", "fileId", "source", "supplier", "amount", "date", "category", "note", "account", "vs"]) {
    if (data[k] !== undefined && data[k] !== null && f[k]) f[k].value = data[k];
  }
  if (f.paid) f.paid.checked = data ? !!data.paid : false;
  expenseModal.hidden = false;
}
expenseForm.addEventListener("submit", e => {
  e.preventDefault();
  const f = expenseForm.elements;
  const data = {
    supplier: f.supplier.value.trim(), amount: Number(f.amount.value) || 0,
    date: f.date.value, category: f.category.value, note: f.note.value.trim(),
    account: f.account ? f.account.value.trim() : "", vs: f.vs ? f.vs.value.trim() : "",
    paid: f.paid ? f.paid.checked : true,
    fileId: f.fileId.value || null, source: f.source.value || "manual"
  };
  if (f.id.value) Object.assign(store.expenses.find(x => x.id === f.id.value), data);
  else { data.id = uid(); store.expenses.push(data); }
  saveStore(); renderExpenses(); renderDashboard(); expenseModal.hidden = true;
});

function renderExpenses() {
  const wrap = document.getElementById("expense-list");
  if (!store.expenses.length) {
    wrap.innerHTML = `<div class="empty-note">Zatím žádné výdaje. Přidej první ručně, nebo nech AI přečíst přijatou fakturu v záložce Soubory.</div>`;
    return;
  }
  const sorted = [...store.expenses].sort((a, b) => b.date.localeCompare(a.date));
  const total = sorted.reduce((a, x) => a + x.amount, 0);
  wrap.innerHTML = `<table class="list-table">
    <thead><tr><th>Dodavatel</th><th>Datum</th><th>Kategorie</th><th>Popis</th><th class="num">Částka</th><th style="white-space: nowrap;">Zdroj</th><th></th></tr></thead>
    <tbody>${sorted.map(x => `
      <tr>
        <td><strong>${escHtml(x.supplier)}</strong>${x.paid === false ? ` <span class="badge status-critical" title="Zbývá uhradit">K úhradě</span>` : ""}</td>
        <td data-label="Datum">${fmtDate(x.date)}</td>
        <td data-label="Kategorie"><span class="report-type-badge pdf">${escHtml(x.category)}</span></td>
        <td data-label="Popis">${escHtml(x.note)}${x.vs ? ` <span class="paid-note">VS ${escHtml(x.vs)}</span>` : ""}</td>
        <td class="num" data-label="Částka">${fmtMoney(x.amount)}</td>
        <td data-label="Zdroj" style="white-space: nowrap;">${x.source === "ai" ? `<span class="badge ai">AI</span>` : `<span class="badge manual">ručně</span>`}</td>
        <td class="actions">
          <div class="action-stack">
            ${x.paid === false ? `<button class="btn-ghost btn-small" data-exp-paid="${x.id}">${icon("check")} Zaplaceno</button>` : ""}
            ${x.fileId && serverMode ? `<button class="btn-ghost btn-small" data-exp-file="${x.fileId}">${icon("download")} Doklad</button>` : ""}
            <button class="btn-ghost btn-small" data-exp-edit="${x.id}">${icon("edit")} Upravit</button>
            <button class="btn-ghost btn-small btn-danger" data-exp-del="${x.id}">${icon("trash")} Smazat</button>
          </div>
        </td>
      </tr>`).join("")}
      <tr><td><strong>Celkem</strong></td><td></td><td></td><td></td><td class="num" data-label="Celkem"><strong>${fmtMoney(total)}</strong></td><td></td><td></td></tr>
    </tbody></table>`;
}
document.getElementById("expense-list").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.expEdit) openExpenseModal(store.expenses.find(x => x.id === b.dataset.expEdit));
  if (b.dataset.expPaid) {
    const x = store.expenses.find(x => x.id === b.dataset.expPaid);
    if (x) { x.paid = true; saveStore(); renderExpenses(); }
  }
  if (b.dataset.expDel && confirm("Opravdu smazat výdaj?")) {
    store.expenses = store.expenses.filter(x => x.id !== b.dataset.expDel);
    saveStore(); renderExpenses(); renderDashboard();
  }
  if (b.dataset.expFile) FilesBackend.download(b.dataset.expFile);
});

/* hromadný příkaz k úhradě — export nezaplacených výdajů s číslem účtu (CSV) */
document.getElementById("payment-order").addEventListener("click", () => {
  const toPay = store.expenses.filter(x => x.paid === false && x.account);
  if (!toPay.length) { alert("Žádné nezaplacené výdaje s vyplněným číslem účtu. Doplň účet u výdaje a odškrtni „Už zaplaceno“."); return; }
  const rows = [["Účet příjemce", "Částka", "Měna", "VS", "Zpráva pro příjemce", "Datum"]];
  for (const x of toPay) rows.push([x.account, csvNum(x.amount.toFixed(2)), "CZK", x.vs || "", (x.supplier + (x.note ? " - " + x.note : "")).slice(0, 140), x.date]);
  downloadFile(`prikaz-k-uhrade-${todayISO()}.csv`, toCsv(rows), "text/csv;charset=utf-8");
  alert(`Příkaz k úhradě: ${toPay.length} plateb za ${fmtMoney(toPay.reduce((a, x) => a + x.amount, 0))}. CSV naimportuj do internetového bankovnictví.`);
});

/* =====================================================================
   CSV EXPORTY (oddělovač ; pro český Excel, s BOM)
   ===================================================================== */
function toCsv(rows) {
  const esc = v => { v = String(v ?? ""); return /[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
  return "\ufeff" + rows.map(r => r.map(esc).join(";")).join("\r\n");
}
const csvNum = n => String(n).replace(".", ",");
/* CSV faktur je v exportním centru (exports.js) */
document.getElementById("export-expenses-csv").addEventListener("click", () => {
  if (!store.expenses.length) { alert("Žádné výdaje k exportu."); return; }
  const rows = [["Datum", "Dodavatel", "Kategorie", "Popis", "Zdroj", "Částka (Kč)"]];
  for (const x of [...store.expenses].sort((a, b) => a.date.localeCompare(b.date))) {
    rows.push([x.date, x.supplier, x.category, x.note, x.source === "ai" ? "AI" : "ručně", csvNum(x.amount.toFixed(2))]);
  }
  downloadFile(`vydaje-${todayISO()}.csv`, toCsv(rows), "text/csv;charset=utf-8");
});

/* =====================================================================
   HLÁŠENÍ — souhrnné hlášení (DPHSHV) a přiznání DPH (DPHDP3)
   XML ve formátu EPO pro portál MOJE daně (mojedane.cz)
   ===================================================================== */
if (!store.reports) store.reports = [];
if (!store.reportDefaults) store.reportDefaults = {};

const MONTH_NAMES = ["leden","únor","březen","duben","květen","červen","červenec","srpen","září","říjen","listopad","prosinec"];
const TAXPAYER_FIELDS = ["dic","jmeno","prijmeni","ulice","c_pop","c_orient","naz_obce","psc","email","c_ufo","c_pracufo"];
const DP3_VALUE_FIELDS = ["obrat23","dan23","obrat5","dan5","p_sl23_e","dan_psl23_e","p_sl5_e","dan_psl5_e","p_sl23_z","dan_psl23_z","p_sl5_z","dan_psl5_z","pln_sluzby","dan_zocelk","odp_zocelk","dano_da"];
const K_PLN_EU = { "0": "0 – dodání zboží", "1": "1 – přemístění majetku", "2": "2 – třístranný obchod", "3": "3 – poskytnutí služby" };

const shvModal = document.getElementById("shv-modal");
const shvForm = document.getElementById("shv-form");
const dp3Modal = document.getElementById("dp3-modal");
const dp3Form = document.getElementById("dp3-form");

/* měsíce do selectů */
for (const form of [shvForm, dp3Form]) {
  form.elements.mesic.innerHTML = MONTH_NAMES.map((n, i) => `<option value="${i + 1}">${i + 1} — ${n}</option>`).join("");
}

function attr(name, val) {
  const v = String(val ?? "").trim();
  return v ? ` ${name}="${escXml(v)}"` : "";
}
function taxpayerAttrs(d) {
  return attr("dic", (d.dic || "").replace(/^CZ/i, "")) + attr("typ_ds", "F") +
    attr("prijmeni", d.prijmeni) + attr("jmeno", d.jmeno) +
    attr("ulice", d.ulice) + attr("c_pop", d.c_pop) + attr("c_orient", d.c_orient) +
    attr("naz_obce", d.naz_obce) + attr("psc", (d.psc || "").replace(/\s/g, "")) +
    attr("stat", "ČESKÁ REPUBLIKA") + attr("c_ufo", d.c_ufo) + attr("c_pracufo", d.c_pracufo) +
    attr("email", d.email);
}

/* ---- XML: souhrnné hlášení ---- */
function shvXml(r) {
  const rows = r.rows.map((row, i) =>
    `<VetaR${attr("por_c_stran", "1")}${attr("c_rad", i + 1)}${attr("k_stat", row.stat.toUpperCase())}${attr("c_vat", row.vat)}${attr("k_pln_eu", row.kod)}${attr("pln_pocet", row.pocet)}${attr("pln_hodnota", Math.round(row.hodnota))}/>`
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<Pisemnost nazevSW="EPO MF ČR" verzeSW="41.24.2">
<DPHSHV verzePis="02.01">
<VetaD${attr("k_uladis", "DPH")}${attr("dokument", "SHV")}${attr("rok", r.rok)}${attr("mesic", r.mesic)}${attr("shvies_forma", r.forma)}${attr("d_poddp", r.d_poddp)}/>
<VetaP${taxpayerAttrs(r.taxpayer)}/>
${rows}
</DPHSHV>
</Pisemnost>
`;
}

/* ---- XML: přiznání k DPH ---- */
function dp3Xml(r) {
  const v = r.values;
  const num = x => (x === "" || x == null) ? "" : Math.round(Number(x));
  const veta1Attrs = ["obrat23","dan23","obrat5","dan5","p_sl23_e","dan_psl23_e","p_sl5_e","dan_psl5_e","p_sl23_z","dan_psl23_z","p_sl5_z","dan_psl5_z"]
    .map(k => attr(k, num(v[k]))).join("");
  const veta2Attrs = attr("pln_sluzby", num(v.pln_sluzby));
  const veta6Attrs = attr("dan_zocelk", num(v.dan_zocelk)) + attr("odp_zocelk", num(v.odp_zocelk)) + attr("dano_da", num(v.dano_da));
  return `<?xml version="1.0" encoding="UTF-8"?>
<Pisemnost nazevSW="EPO MF ČR" verzeSW="41.24.2">
<DPHDP3 verzePis="01.02">
<VetaD${attr("k_uladis", "DPH")}${attr("dokument", "DP3")}${attr("rok", r.rok)}${attr("mesic", r.mesic)}${attr("dapdph_forma", r.forma)}${attr("typ_platce", r.typ_platce)}${attr("d_poddp", r.d_poddp)}/>
<VetaP${taxpayerAttrs(r.taxpayer)}/>
${veta1Attrs ? `<Veta1${veta1Attrs}/>` : ""}
${veta2Attrs ? `<Veta2${veta2Attrs}/>` : ""}
${veta6Attrs ? `<Veta6${veta6Attrs}/>` : ""}
</DPHDP3>
</Pisemnost>
`.replace(/\n{2,}/g, "\n");
}

/* ---- řádky souhrnného hlášení ---- */
const shvLines = document.getElementById("shv-lines");
function shvLineRow(row = { stat: "", vat: "", kod: "3", pocet: 1, hodnota: "" }) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input name="r-stat" required maxlength="2" placeholder="DE" style="text-transform:uppercase" value="${escHtml(row.stat)}"></td>
    <td><input name="r-vat" required placeholder="123456789" value="${escHtml(row.vat)}"></td>
    <td><select name="r-kod">${Object.entries(K_PLN_EU).map(([k, l]) => `<option value="${k}"${k === String(row.kod) ? " selected" : ""}>${l}</option>`).join("")}</select></td>
    <td><input name="r-pocet" type="number" min="1" required value="${escHtml(row.pocet)}"></td>
    <td><input name="r-hodnota" type="number" step="any" min="0" required value="${escHtml(row.hodnota)}"></td>
    <td><button type="button" class="line-del" title="Odebrat řádek">✕</button></td>`;
  tr.querySelector(".line-del").addEventListener("click", () => tr.remove());
  return tr;
}
document.getElementById("shv-add-line").addEventListener("click", () => shvLines.appendChild(shvLineRow()));

/* ---- otevření modálů ---- */
function prevMonthPeriod() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return { mesic: d.getMonth() + 1, rok: d.getFullYear() };
}
function fillTaxpayer(form, saved) {
  const d = saved || store.reportDefaults;
  for (const f of TAXPAYER_FIELDS) form.elements[f].value = d[f] ?? "";
  if (!form.elements.email.value) form.elements.email.value = store.settings.email || "";
  if (!form.elements.dic.value && store.settings.dic) form.elements.dic.value = store.settings.dic.replace(/^CZ/i, "");
  if (!form.elements.jmeno.value && store.settings.name) {
    const parts = store.settings.name.trim().split(/\s+/);
    form.elements.jmeno.value = parts[0] || "";
    form.elements.prijmeni.value = parts.slice(1).join(" ");
  }
}
function readTaxpayer(form) {
  const d = {};
  for (const f of TAXPAYER_FIELDS) d[f] = form.elements[f].value.trim();
  store.reportDefaults = { ...d };
  return d;
}

document.getElementById("new-shv").addEventListener("click", () => openShvModal());
function openShvModal(r) {
  shvForm.reset();
  shvLines.innerHTML = "";
  document.getElementById("shv-modal-title").textContent = r ? `Souhrnné hlášení ${r.mesic}/${r.rok}` : "Souhrnné hlášení (DPHSHV)";
  const p = r || prevMonthPeriod();
  shvForm.elements.id.value = r ? r.id : "";
  shvForm.elements.mesic.value = p.mesic;
  shvForm.elements.rok.value = p.rok;
  shvForm.elements.forma.value = r ? r.forma : "R";
  shvForm.elements.d_poddp.value = r ? r.d_poddp : todayISO();
  (r ? r.rows : [undefined]).forEach(row => shvLines.appendChild(shvLineRow(row)));
  fillTaxpayer(shvForm, r && r.taxpayer);
  shvModal.hidden = false;
}
shvForm.addEventListener("submit", e => {
  e.preventDefault();
  const rows = [...shvLines.querySelectorAll("tr")].map(tr => ({
    stat: tr.querySelector('[name="r-stat"]').value.trim().toUpperCase(),
    vat: tr.querySelector('[name="r-vat"]').value.trim(),
    kod: tr.querySelector('[name="r-kod"]').value,
    pocet: Number(tr.querySelector('[name="r-pocet"]').value) || 1,
    hodnota: Number(tr.querySelector('[name="r-hodnota"]').value) || 0
  }));
  if (!rows.length) { alert("Přidej aspoň jeden řádek."); return; }
  const f = shvForm.elements;
  const data = {
    type: "shv", mesic: Number(f.mesic.value), rok: Number(f.rok.value),
    forma: f.forma.value, d_poddp: f.d_poddp.value, rows, taxpayer: readTaxpayer(shvForm)
  };
  if (f.id.value) Object.assign(store.reports.find(x => x.id === f.id.value), data);
  else { data.id = uid(); store.reports.push(data); }
  saveStore(); renderReports(); shvModal.hidden = true;
});

document.getElementById("new-dp3").addEventListener("click", () => openDp3Modal());
function openDp3Modal(r) {
  dp3Form.reset();
  document.getElementById("dp3-modal-title").textContent = r ? `Přiznání k DPH ${r.mesic}/${r.rok}` : "Přiznání k DPH (DPHDP3)";
  const p = r || prevMonthPeriod();
  dp3Form.elements.id.value = r ? r.id : "";
  dp3Form.elements.mesic.value = p.mesic;
  dp3Form.elements.rok.value = p.rok;
  dp3Form.elements.typ_platce.value = r ? r.typ_platce : "I";
  dp3Form.elements.forma.value = r ? r.forma : "B";
  dp3Form.elements.d_poddp.value = r ? r.d_poddp : todayISO();
  for (const k of DP3_VALUE_FIELDS) dp3Form.elements[k].value = r && r.values[k] != null ? r.values[k] : "";
  fillTaxpayer(dp3Form, r && r.taxpayer);
  dp3Modal.hidden = false;
}
/* automatický dopočet ř. 62 a 64 */
["dan23","dan5","dan_psl23_e","dan_psl5_e","dan_psl23_z","dan_psl5_z","odp_zocelk"].forEach(k => {
  dp3Form.elements[k].addEventListener("input", () => {
    const val = f => Number(dp3Form.elements[f].value) || 0;
    const danCelkem = Math.round(val("dan23") + val("dan5") + val("dan_psl23_e") + val("dan_psl5_e") + val("dan_psl23_z") + val("dan_psl5_z"));
    dp3Form.elements.dan_zocelk.value = danCelkem || "";
    const vlastni = danCelkem - Math.round(val("odp_zocelk"));
    dp3Form.elements.dano_da.value = vlastni > 0 ? vlastni : "";
  });
});
dp3Form.addEventListener("submit", e => {
  e.preventDefault();
  const f = dp3Form.elements;
  const values = {};
  for (const k of DP3_VALUE_FIELDS) values[k] = f[k].value.trim();
  const data = {
    type: "dp3", mesic: Number(f.mesic.value), rok: Number(f.rok.value),
    typ_platce: f.typ_platce.value, forma: f.forma.value, d_poddp: f.d_poddp.value,
    values, taxpayer: readTaxpayer(dp3Form)
  };
  if (f.id.value) Object.assign(store.reports.find(x => x.id === f.id.value), data);
  else { data.id = uid(); store.reports.push(data); }
  saveStore(); renderReports(); dp3Modal.hidden = true;
});

/* =====================================================================
   KONTROLNÍ HLÁŠENÍ DPH (DPHKH1)
   ===================================================================== */
const kh1Modal = document.getElementById("kh1-modal");
const kh1Form = document.getElementById("kh1-form");
const kh1ALines = document.getElementById("kh1-a-lines");
const kh1BLines = document.getElementById("kh1-b-lines");
/* měsíce do selectu */
kh1Form.elements.mesic.innerHTML = MONTH_NAMES.map((n, i) => `<option value="${i + 1}">${i + 1} — ${n}</option>`).join("");

function kh1LineRow(row = { dic: "", doklad: "", dppd: "", zaklad1: "", dph1: "", zaklad2: "", dph2: "" }) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input name="k-dic" placeholder="CZ12345678" value="${escHtml(row.dic)}" style="min-width:120px"></td>
    <td><input name="k-doklad" placeholder="2026-01-01" value="${escHtml(row.doklad)}" style="min-width:100px"></td>
    <td><input name="k-dppd" type="date" value="${escHtml(row.dppd)}" style="min-width:120px"></td>
    <td><input name="k-zaklad1" type="number" step="any" value="${escHtml(row.zaklad1)}" style="min-width:80px"></td>
    <td><input name="k-dph1" type="number" step="any" value="${escHtml(row.dph1)}" style="min-width:80px"></td>
    <td><input name="k-zaklad2" type="number" step="any" value="${escHtml(row.zaklad2)}" style="min-width:80px"></td>
    <td><input name="k-dph2" type="number" step="any" value="${escHtml(row.dph2)}" style="min-width:80px"></td>
    <td><button type="button" class="line-del" title="Odebrat">✕</button></td>`;
  tr.querySelector(".line-del").addEventListener("click", () => tr.remove());
  return tr;
}
function readKh1Lines(tbody) {
  return [...tbody.querySelectorAll("tr")].map(tr => ({
    dic: tr.querySelector('[name="k-dic"]').value.trim(),
    doklad: tr.querySelector('[name="k-doklad"]').value.trim(),
    dppd: tr.querySelector('[name="k-dppd"]').value,
    zaklad1: Number(tr.querySelector('[name="k-zaklad1"]').value) || 0,
    dph1: Number(tr.querySelector('[name="k-dph1"]').value) || 0,
    zaklad2: Number(tr.querySelector('[name="k-zaklad2"]').value) || 0,
    dph2: Number(tr.querySelector('[name="k-dph2"]').value) || 0
  }));
}

document.getElementById("kh1-add-a").addEventListener("click", () => kh1ALines.appendChild(kh1LineRow()));
document.getElementById("kh1-add-b").addEventListener("click", () => kh1BLines.appendChild(kh1LineRow()));

document.getElementById("new-kh1").addEventListener("click", () => openKh1Modal());
function openKh1Modal(r) {
  kh1Form.reset();
  kh1ALines.innerHTML = "";
  kh1BLines.innerHTML = "";
  document.getElementById("kh1-modal-title").textContent = r ? `Kontrolní hlášení ${r.mesic}/${r.rok}` : "Kontrolní hlášení DPH (DPHKH1)";
  const p = r || prevMonthPeriod();
  kh1Form.elements.id.value = r ? r.id : "";
  kh1Form.elements.mesic.value = p.mesic;
  kh1Form.elements.rok.value = p.rok;
  kh1Form.elements.forma.value = r ? r.forma : "R";
  kh1Form.elements.d_poddp.value = r ? r.d_poddp : todayISO();
  if (r) {
    (r.aRows || []).forEach(row => kh1ALines.appendChild(kh1LineRow(row)));
    (r.bRows || []).forEach(row => kh1BLines.appendChild(kh1LineRow(row)));
  }
  fillTaxpayer(kh1Form, r && r.taxpayer);
  kh1Modal.hidden = false;
}

/* auto-fill z vydaných faktur */
document.getElementById("kh1-autofill").addEventListener("click", () => {
  const mesic = Number(kh1Form.elements.mesic.value);
  const rok = Number(kh1Form.elements.rok.value);
  const prefix = `${rok}-${String(mesic).padStart(2, "0")}`;
  const vat = store.settings.vatPayer;
  const invoices = store.invoices.filter(inv =>
    isRealInvoice(inv) && inv.issuedOn.startsWith(prefix) && inv.status !== 'cancelled'
  );
  if (!invoices.length) { alert("Žádné faktury za zvolené období."); return; }
  kh1ALines.innerHTML = "";
  for (const inv of invoices) {
    const c = clientById(inv.clientId) || {};
    const t = invoiceTotal(inv);
    const zaklad = Math.round(t.subtotal);
    const dph = Math.round(t.vatTotal);
    kh1ALines.appendChild(kh1LineRow({
      dic: c.dic || "", doklad: inv.number, dppd: inv.issuedOn,
      zaklad1: zaklad, dph1: dph, zaklad2: 0, dph2: 0
    }));
  }
});

kh1Form.addEventListener("submit", e => {
  e.preventDefault();
  const f = kh1Form.elements;
  const aRows = readKh1Lines(kh1ALines);
  const bRows = readKh1Lines(kh1BLines);
  if (!aRows.length && !bRows.length) { alert("Přidej aspoň jeden řádek."); return; }
  const data = {
    type: "kh1", mesic: Number(f.mesic.value), rok: Number(f.rok.value),
    forma: f.forma.value, d_poddp: f.d_poddp.value,
    aRows, bRows, taxpayer: readTaxpayer(kh1Form)
  };
  if (f.id.value) Object.assign(store.reports.find(x => x.id === f.id.value), data);
  else { data.id = uid(); store.reports.push(data); }
  saveStore(); renderReports(); kh1Modal.hidden = true;
});

/* KH1 XML (formát EPO pro mojedane.cz) */
function kh1Xml(r) {
  const rowsA = (r.aRows || []).map((row, i) =>
    `<VetaA4${attr("c_radku", i + 1)}${attr("dic_odb", row.dic)}${attr("c_evid_dd", row.doklad)}${attr("dppd", row.dppd)}${attr("zakl_dane1", Math.round(row.zaklad1))}${attr("dan1", Math.round(row.dph1))}${attr("zakl_dane2", Math.round(row.zaklad2))}${attr("dan2", Math.round(row.dph2))}/>`
  ).join("\n");
  const rowsB = (r.bRows || []).map((row, i) =>
    `<VetaB2${attr("c_radku", i + 1)}${attr("dic_dod", row.dic)}${attr("c_evid_dd", row.doklad)}${attr("dppd", row.dppd)}${attr("zakl_dane1", Math.round(row.zaklad1))}${attr("dan1", Math.round(row.dph1))}${attr("zakl_dane2", Math.round(row.zaklad2))}${attr("dan2", Math.round(row.dph2))}/>`
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<Pisemnost nazevSW="EPO MF ČR" verzeSW="41.24.2">
<DPHKH1 verzePis="01.03">
<VetaD${attr("k_uladis", "DPH")}${attr("dokument", "KH1")}${attr("rok", r.rok)}${attr("mesic", r.mesic)}${attr("khdph_forma", r.forma)}${attr("d_poddp", r.d_poddp)}/>
<VetaP${taxpayerAttrs(r.taxpayer)}/>
${rowsA}
${rowsB}
</DPHKH1>
</Pisemnost>
`;
}

/* =====================================================================
   ROČNÍ DAŇOVÉ PŘIZNÁNÍ (DPFO) A PŘEHLEDY ČSSZ / ZP
   Navazuje na výpočet odhadu daní — doplní odpočty, slevy a zaplacené zálohy
   a spočítá skutečné doplatky/přeplatky za rok. Tiskne přehledný souhrn
   a generuje návrh XML přiznání k dani z příjmů (EPO pro MOJE daně).
   ===================================================================== */
if (!store.taxAnnual) store.taxAnnual = {}; /* { "2025": { penzijko, slevaManzel, ..., zalohyDan } } */

const DPFO_DEDUCTIONS = ["penzijko", "zivotko", "uroky", "dary", "odbory"];
const DPFO_CREDITS = ["slevaManzel", "slevaInvalidita", "slevaStudent"];
const DPFO_CHILDREN = ["deti1", "deti2", "deti3"];
const DPFO_ADVANCES = ["zalohyDan", "zalohySoc", "zalohyZdrav"];
const DPFO_ALL_FIELDS = [...DPFO_DEDUCTIONS, ...DPFO_CREDITS, ...DPFO_CHILDREN, ...DPFO_ADVANCES];
/* roční daňové zvýhodnění na dítě dle pořadí (orientační, editovatelné v modálu) */
const DPFO_CHILD_AMOUNTS = { deti1: 15204, deti2: 22320, deti3: 27840 };
const annNum = v => { const n = Number(v); return (v == null || v === "" || isNaN(n)) ? 0 : n; };

function computeAnnualTax(year) {
  const est = computeTaxEstimate(year);
  const a = store.taxAnnual[String(year)] || {};
  const nezdanitelne = DPFO_DEDUCTIONS.reduce((s, k) => s + annNum(a[k]), 0);
  const zakladSniz = Math.max(0, est.zaklad - nezdanitelne);
  const zakladZaokr = Math.floor(zakladSniz / 100) * 100;
  const prah = est.danPrah || Infinity;
  const danHruba = Math.round(zakladZaokr <= prah
    ? zakladZaokr * est.danSazba / 100
    : prah * est.danSazba / 100 + (zakladZaokr - prah) * (est.danSazba2 || est.danSazba) / 100);
  const slevy = est.slevaPoplatnik + DPFO_CREDITS.reduce((s, k) => s + annNum(a[k]), 0);
  const danPoSleve = Math.max(0, danHruba - slevy);
  const zvyhodneni = DPFO_CHILDREN.reduce((s, k) => s + annNum(a[k]) * (DPFO_CHILD_AMOUNTS[k] || 0), 0);
  const danPoZvyh = danPoSleve - zvyhodneni;         /* < 0 = daňový bonus */
  const dan = Math.max(0, danPoZvyh);
  const bonus = danPoZvyh < 0 ? -danPoZvyh : 0;
  const doplatekDane = danPoZvyh - annNum(a.zalohyDan);
  const doplatekSoc = est.soc - annNum(a.zalohySoc);
  const doplatekZdrav = est.zdrav - annNum(a.zalohyZdrav);
  /* nová měsíční záloha pro příští rok z letošního vyměřovacího základu */
  const novaZalohaSoc = est.nAct ? Math.ceil((est.socVZ / est.nAct) * est.socSazba / 100) : 0;
  const novaZalohaZdrav = est.nAct ? Math.ceil((est.zdravVZ / est.nAct) * est.zdravSazba / 100) : 0;
  return {
    ...est, nezdanitelne, zakladSniz, zakladZaokr, danHruba, slevy, zvyhodneni,
    danPoSleve, danPoZvyh, dan, bonus, doplatekDane, doplatekSoc, doplatekZdrav,
    novaZalohaSoc, novaZalohaZdrav, inputs: a
  };
}

/* --- tisknutelný souhrn (přiznání / přehled) --- */
function annualRow(label, val, opts = {}) {
  const cls = opts.total ? ' class="ann-total"' : opts.sub ? ' class="ann-sub"' : "";
  const v = opts.raw !== undefined ? opts.raw : fmtMoney(val);
  return `<tr${cls}><td>${escHtml(label)}</td><td class="num">${v}</td></tr>`;
}
function annualSummaryHtml(year, kind) {
  const t = computeAnnualTax(year);
  const dpZnamenko = x => x >= 0 ? `doplatek ${fmtMoney(x)}` : `přeplatek ${fmtMoney(-x)}`;
  if (kind === "dpfo") {
    return `<table class="ann-table">
      <tr class="ann-head"><td colspan="2">Daň z příjmů fyzických osob za rok ${year}</td></tr>
      ${annualRow("Příjmy ze samostatné činnosti (§ 7)", t.prijmy)}
      ${annualRow(`Výdaje paušálem ${t.pausal} %`, -t.vydaje)}
      ${annualRow("Dílčí základ daně", t.zaklad, { sub: true })}
      ${t.nezdanitelne ? annualRow("Nezdanitelné části (penzijko, dary, úroky…)", -t.nezdanitelne) : ""}
      ${annualRow("Základ daně po odpočtech (zaokr. na 100 dolů)", t.zakladZaokr, { sub: true })}
      ${annualRow(`Daň ${t.danSazba} %${t.danPrah && t.zakladZaokr > t.danPrah ? " / " + t.danSazba2 + " % nad prahem" : ""}`, t.danHruba)}
      ${annualRow("Slevy na dani (poplatník" + (t.slevy > t.slevaPoplatnik ? " + další" : "") + ")", -t.slevy)}
      ${annualRow("Daň po slevách", t.danPoSleve, { sub: true })}
      ${t.zvyhodneni ? annualRow("Daňové zvýhodnění na děti", -t.zvyhodneni) : ""}
      ${t.bonus ? annualRow("Daňový bonus", t.bonus, { sub: true }) : annualRow("Daň po zvýhodnění", t.danPoZvyh, { sub: true })}
      ${annualRow("Zaplacené zálohy na daň", -annNum(t.inputs.zalohyDan))}
      ${annualRow(dpZnamenko(t.doplatekDane).startsWith("doplatek") ? "Doplatek daně" : "Přeplatek daně", 0, { total: true, raw: dpZnamenko(t.doplatekDane) })}
    </table>
    <p class="ann-note">Orientační výpočet z faktur a zadaných odpočtů. Před podáním na MOJE daně zkontroluj proti oficiálnímu formuláři a přílohám.</p>`;
  }
  if (kind === "csz") {
    return `<table class="ann-table">
      <tr class="ann-head"><td colspan="2">Přehled o příjmech a výdajích OSVČ — ČSSZ, rok ${year}</td></tr>
      ${annualRow("Daňový základ (příjmy − výdaje)", t.zaklad)}
      ${annualRow(`Vyměřovací základ (${t.socVymZakladPct} % základu, min. dle měsíců)`, t.socVZ, { sub: true })}
      ${annualRow(`Pojistné ${t.socSazba} % z vyměřovacího základu`, t.soc, { sub: true })}
      ${annualRow("Zaplacené zálohy na sociální pojištění", -annNum(t.inputs.zalohySoc))}
      ${annualRow(t.doplatekSoc >= 0 ? "Doplatek pojistného" : "Přeplatek pojistného", 0, { total: true, raw: t.doplatekSoc >= 0 ? `doplatek ${fmtMoney(t.doplatekSoc)}` : `přeplatek ${fmtMoney(-t.doplatekSoc)}` })}
      ${annualRow("Nová měsíční záloha na příští rok", t.novaZalohaSoc, { sub: true })}
    </table>
    <p class="ann-note">Podává se na ePortál ČSSZ. Hodnoty jsou orientační — zkontroluj minima a rozhodnou částku za daný rok.</p>`;
  }
  /* zp */
  return `<table class="ann-table">
    <tr class="ann-head"><td colspan="2">Přehled OSVČ pro zdravotní pojišťovnu — rok ${year}</td></tr>
    ${annualRow("Daňový základ (příjmy − výdaje)", t.zaklad)}
    ${annualRow(`Vyměřovací základ (${t.zdravVymZakladPct} % základu, min. dle měsíců)`, t.zdravVZ, { sub: true })}
    ${annualRow(`Pojistné ${t.zdravSazba} % z vyměřovacího základu`, t.zdrav, { sub: true })}
    ${annualRow("Zaplacené zálohy na zdravotní pojištění", -annNum(t.inputs.zalohyZdrav))}
    ${annualRow(t.doplatekZdrav >= 0 ? "Doplatek pojistného" : "Přeplatek pojistného", 0, { total: true, raw: t.doplatekZdrav >= 0 ? `doplatek ${fmtMoney(t.doplatekZdrav)}` : `přeplatek ${fmtMoney(-t.doplatekZdrav)}` })}
    ${annualRow("Nová měsíční záloha na příští rok", t.novaZalohaZdrav, { sub: true })}
  </table>
  <p class="ann-note">Podává se u tvé zdravotní pojišťovny (VZP a další mají vlastní formulář / portál).</p>`;
}

/* ---- archiv PDF ---- */
let pdfTargetReportId = null; // null = nový samostatný záznam
document.getElementById("new-pdf-archive").addEventListener("click", () => {
  pdfTargetReportId = null;
  document.getElementById("archive-pdf-file").click();
});
document.getElementById("archive-pdf-file").addEventListener("change", e => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  if (file.size > 3 * 1024 * 1024) { alert("PDF je moc velké (max 3 MB) — úložiště prohlížeče má omezenou kapacitu."); return; }
  const reader = new FileReader();
  reader.onload = () => {
    if (pdfTargetReportId) {
      const r = store.reports.find(x => x.id === pdfTargetReportId);
      r.pdfName = file.name;
      r.pdfData = reader.result;
    } else {
      const period = prompt("Za jaké období je tento dokument? (MM/RRRR)", `${prevMonthPeriod().mesic}/${prevMonthPeriod().rok}`);
      if (period === null) return;
      const m = period.match(/^(\d{1,2})\s*\/\s*(\d{4})$/);
      store.reports.push({
        id: uid(), type: "pdf",
        mesic: m ? Number(m[1]) : prevMonthPeriod().mesic,
        rok: m ? Number(m[2]) : prevMonthPeriod().rok,
        pdfName: file.name, pdfData: reader.result
      });
    }
    try { saveStore(); } catch (err) { alert("Nepodařilo se uložit — úložiště prohlížeče je plné. Smaž starší PDF přílohy."); return; }
    renderReports();
  };
  reader.readAsDataURL(file);
});
function downloadDataUrl(name, dataUrl) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = name;
  a.click();
}

/* ---- seznam hlášení ---- */
const REPORT_LABELS = { shv: "Souhrnné hlášení", dp3: "Přiznání DPH", kh1: "Kontrolní hlášení", dpfo: "Přiznání DPFO", csz: "Přehled ČSSZ", zp: "Přehled zdravotní", oss: "OSS", pdf: "PDF dokument" };
const ANNUAL_TYPES = ["dpfo", "csz", "zp"];
function reportSummary(r) {
  if (r.type === "shv") return fmtMoney(r.rows.reduce((a, x) => a + x.hodnota, 0)).replace(",00", "") + ` (${r.rows.length} řádk${r.rows.length === 1 ? "ek" : "y"})`;
  if (r.type === "dp3") {
    const d = Number(r.values.dano_da) || 0;
    return d ? "daň " + fmtMoney(d).replace(",00", "") : "—";
  }
  if (r.type === "kh1") {
    const aCount = (r.aRows || []).length;
    const bCount = (r.bRows || []).length;
    return `${aCount + bCount} řádků (A: ${aCount}, B: ${bCount})`;
  }
  if (ANNUAL_TYPES.includes(r.type)) {
    const t = computeAnnualTax(r.rok);
    if (r.type === "dpfo") return t.doplatekDane >= 0 ? "doplatek daně " + fmtMoney(t.doplatekDane).replace(",00", "") : "přeplatek " + fmtMoney(-t.doplatekDane).replace(",00", "");
    if (r.type === "csz") return t.doplatekSoc >= 0 ? "doplatek " + fmtMoney(t.doplatekSoc).replace(",00", "") : "přeplatek " + fmtMoney(-t.doplatekSoc).replace(",00", "");
    return t.doplatekZdrav >= 0 ? "doplatek " + fmtMoney(t.doplatekZdrav).replace(",00", "") : "přeplatek " + fmtMoney(-t.doplatekZdrav).replace(",00", "");
  }
  if (r.type === "oss") {
    const v = r.rows.reduce((a, x) => a + x.vat, 0);
    return `${r.rows.length} zemí · DPH ${v.toLocaleString("cs-CZ", { maximumFractionDigits: 0 })} €`;
  }
  return r.pdfName || "—";
}
function renderReports() {
  const wrap = document.getElementById("report-list");
  if (!store.reports.length) {
    wrap.innerHTML = `<div class="empty-note">Zatím žádná hlášení. Vytvoř souhrnné hlášení nebo přiznání DPH, případně nahraj PDF ze starších období.</div>`;
    return;
  }
  const sorted = [...store.reports].sort((a, b) => (b.rok - a.rok) || (b.mesic - a.mesic));
  wrap.innerHTML = `<table class="list-table">
    <thead><tr><th>Typ</th><th>Období</th><th>Obsah</th><th>PDF</th><th></th></tr></thead>
    <tbody>${sorted.map(r => `
      <tr>
        <td><span class="report-type-badge ${r.type}">${REPORT_LABELS[r.type]}</span></td>
        <td data-label="Období"><strong>${ANNUAL_TYPES.includes(r.type) ? "Rok " + r.rok : r.type === "oss" ? r.ctvrtleti + "Q " + r.rok : MONTH_NAMES[r.mesic - 1] + " " + r.rok}</strong></td>
        <td data-label="Obsah">${escHtml(reportSummary(r))}</td>
        <td data-label="PDF">${r.pdfData ? `<button class="btn-ghost btn-small" data-report-pdf="${r.id}">${icon("download")} ${escHtml(r.pdfName || "PDF")}</button>` : `<button class="btn-ghost btn-small" data-report-attach="${r.id}">${icon("paperclip")} Připojit PDF</button>`}</td>
        <td class="actions">
          ${r.type === "oss" ? `<button class="btn-ghost btn-small" data-report-print="${r.id}">${icon("printer")} Tisk / PDF</button>
          <button class="btn-ghost btn-small" data-report-edit="${r.id}">Upravit</button>`
          : ANNUAL_TYPES.includes(r.type) ? `<button class="btn-ghost btn-small" data-report-print="${r.id}">${icon("printer")} Tisk / PDF</button>
          <button class="btn-ghost btn-small" data-report-edit="${r.id}">Upravit</button>`
          : r.type !== "pdf" ? `<button class="btn-ghost btn-small" data-report-xml="${r.id}">${icon("download")} XML</button>
          <button class="btn-ghost btn-small" data-report-edit="${r.id}">Upravit</button>` : ""}
          <button class="btn-ghost btn-small btn-danger" data-report-del="${r.id}">Smazat</button>
        </td>
      </tr>`).join("")}</tbody></table>`;
}
document.addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  const rid = b.dataset.reportXml || b.dataset.reportEdit || b.dataset.reportDel || b.dataset.reportPdf || b.dataset.reportAttach || b.dataset.reportPrint;
  if (!rid) return;
  const r = store.reports.find(x => x.id === rid);
  if (b.dataset.reportPrint && ANNUAL_TYPES.includes(r.type)) {
    const titles = { dpfo: "Přiznání k dani z příjmů " + r.rok, csz: "Přehled ČSSZ " + r.rok, zp: "Přehled zdravotní pojišťovna " + r.rok };
    printDocument(titles[r.type], annualSummaryHtml(r.rok, r.type));
    return;
  }
  if (b.dataset.reportPrint && r.type === "oss") { printDocument(`OSS ${r.ctvrtleti}Q ${r.rok}`, ossSummaryHtml(r)); return; }
  if (b.dataset.reportEdit && r.type === "oss") { openOssModal(r); return; }
  if (b.dataset.reportXml) {
    const xml = r.type === "shv" ? shvXml(r) : r.type === "kh1" ? kh1Xml(r) : dp3Xml(r);
    const prefix = r.type === "shv" ? "souhrnne-hlaseni" : r.type === "kh1" ? "kontrolni-hlaseni" : "dph-priznani";
    downloadFile(`${prefix}-${r.rok}-${String(r.mesic).padStart(2, "0")}.xml`, xml, "application/xml");
  }
  if (b.dataset.reportEdit) {
    if (ANNUAL_TYPES.includes(r.type)) openAnnualModal(r.rok);
    else r.type === "shv" ? openShvModal(r) : r.type === "kh1" ? openKh1Modal(r) : openDp3Modal(r);
  }
  if (b.dataset.reportDel && confirm("Opravdu smazat toto hlášení?")) {
    store.reports = store.reports.filter(x => x.id !== rid);
    saveStore(); renderReports();
  }
  if (b.dataset.reportPdf) downloadDataUrl(r.pdfName || "dokument.pdf", r.pdfData);
  if (b.dataset.reportAttach) {
    pdfTargetReportId = rid;
    document.getElementById("archive-pdf-file").click();
  }
});

/* ---- modál Roční daně (DPFO + přehledy) ---- */
const annualModal = document.getElementById("annual-modal");
const annualForm = document.getElementById("annual-form");
let annualYear = new Date().getFullYear() - 1; /* přiznání se dělá za minulý rok */

function readAnnualInputs() {
  const d = {};
  for (const k of DPFO_ALL_FIELDS) {
    const el = annualForm.elements[k];
    d[k] = el && el.value.trim() !== "" ? Number(el.value) : "";
  }
  return d;
}
function saveAnnualInputs() {
  store.taxAnnual[String(annualYear)] = readAnnualInputs();
  saveStore();
}
function renderAnnualResult() {
  saveAnnualInputs(); /* aby computeAnnualTax počítal s aktuálními vstupy */
  const t = computeAnnualTax(annualYear);
  const line = (l, v, cls) => `<div class="ann-r${cls ? " " + cls : ""}"><span>${l}</span><strong>${v}</strong></div>`;
  const dp = (x) => x >= 0 ? `<span class="ann-pay">doplatek ${fmtMoney(x)}</span>` : `<span class="ann-ok">přeplatek ${fmtMoney(-x)}</span>`;
  document.getElementById("annual-result").innerHTML = `
    <div class="ann-grid">
      <div class="ann-col">
        <div class="ann-col-h">Daň z příjmů</div>
        ${line("Základ daně", fmtMoney(t.zaklad))}
        ${t.nezdanitelne ? line("− nezdanitelné části", fmtMoney(t.nezdanitelne)) : ""}
        ${line("Daň po slevách", fmtMoney(t.danPoSleve))}
        ${t.zvyhodneni ? line("− zvýhodnění na děti", fmtMoney(t.zvyhodneni)) : ""}
        ${t.bonus ? line("Daňový bonus", fmtMoney(t.bonus), "hl") : ""}
        ${line("Zálohy zaplaceno", fmtMoney(annNum(t.inputs.zalohyDan)))}
        ${line("Výsledek", dp(t.doplatekDane), "hl")}
      </div>
      <div class="ann-col">
        <div class="ann-col-h">Sociální (ČSSZ)</div>
        ${line("Pojistné za rok", fmtMoney(t.soc))}
        ${line("Zálohy zaplaceno", fmtMoney(annNum(t.inputs.zalohySoc)))}
        ${line("Výsledek", dp(t.doplatekSoc), "hl")}
        ${line("Nová záloha/měs.", fmtMoney(t.novaZalohaSoc))}
      </div>
      <div class="ann-col">
        <div class="ann-col-h">Zdravotní</div>
        ${line("Pojistné za rok", fmtMoney(t.zdrav))}
        ${line("Zálohy zaplaceno", fmtMoney(annNum(t.inputs.zalohyZdrav)))}
        ${line("Výsledek", dp(t.doplatekZdrav), "hl")}
        ${line("Nová záloha/měs.", fmtMoney(t.novaZalohaZdrav))}
      </div>
    </div>`;
}
function openAnnualModal(year) {
  annualForm.reset();
  annualYear = Number(year) || new Date().getFullYear() - 1;
  document.getElementById("annual-modal-title").textContent = "Roční daně a přehledy — " + annualYear;
  annualForm.elements.rok.value = annualYear;
  const saved = store.taxAnnual[String(annualYear)] || {};
  for (const k of DPFO_ALL_FIELDS) if (annualForm.elements[k]) annualForm.elements[k].value = saved[k] ?? "";
  /* předvyplnit poplatníka (sdílené s DPH hlášeními) */
  fillTaxpayer(annualForm, saved.taxpayer);
  renderAnnualResult();
  annualModal.hidden = false;
}
document.getElementById("new-annual").addEventListener("click", () => openAnnualModal(new Date().getFullYear() - 1));
annualForm.addEventListener("input", e => {
  if (e.target.name === "rok") { annualYear = Number(e.target.value) || annualYear; document.getElementById("annual-modal-title").textContent = "Roční daně a přehledy — " + annualYear; }
  if (DPFO_ALL_FIELDS.includes(e.target.name) || e.target.name === "rok") renderAnnualResult();
});
document.getElementById("annual-print-dpfo").addEventListener("click", () => { saveAnnualInputs(); annualModal.hidden = true; printDocument("Přiznání k dani z příjmů " + annualYear, annualSummaryHtml(annualYear, "dpfo")); });
document.getElementById("annual-print-csz").addEventListener("click", () => { saveAnnualInputs(); annualModal.hidden = true; printDocument("Přehled ČSSZ " + annualYear, annualSummaryHtml(annualYear, "csz")); });
document.getElementById("annual-print-zp").addEventListener("click", () => { saveAnnualInputs(); annualModal.hidden = true; printDocument("Přehled zdravotní pojišťovna " + annualYear, annualSummaryHtml(annualYear, "zp")); });
document.getElementById("annual-save").addEventListener("click", () => {
  saveAnnualInputs();
  const taxpayer = readTaxpayer(annualForm);
  /* uložit (nebo aktualizovat) záznamy DPFO/ČSSZ/ZP do archivu hlášení */
  for (const type of ANNUAL_TYPES) {
    let rec = store.reports.find(x => x.type === type && x.rok === annualYear);
    if (rec) { rec.taxpayer = taxpayer; }
    else store.reports.push({ id: uid(), type, rok: annualYear, mesic: 12, taxpayer });
  }
  saveStore(); renderReports();
  annualModal.hidden = true;
  alert(`Roční daně za ${annualYear} uloženy do archivu (Hlášení). Přiznání i přehledy tam kdykoli otevřeš, vytiskneš nebo stáhneš.`);
});

/* ---- OSS — režim jednoho správního místa (evidence + přehled) ---- */
const ossModal = document.getElementById("oss-modal");
const ossForm = document.getElementById("oss-form");
const ossLines = document.getElementById("oss-lines");
const EU_STATES = ["AT","BE","BG","HR","CY","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE"];
function ossLineRow(row = { stat: "", rate: "", base: "", vat: "" }) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><select name="o-stat">${EU_STATES.map(s => `<option${s === row.stat ? " selected" : ""}>${s}</option>`).join("")}</select></td>
    <td><input name="o-rate" type="number" step="any" value="${escHtml(row.rate)}" placeholder="21"></td>
    <td><input name="o-base" type="number" step="any" value="${escHtml(row.base)}" placeholder="0"></td>
    <td><input name="o-vat" type="number" step="any" value="${escHtml(row.vat)}" placeholder="0"></td>
    <td><button type="button" class="line-del" title="Odebrat">✕</button></td>`;
  tr.querySelector(".line-del").addEventListener("click", () => tr.remove());
  /* auto-dopočet DPH ze základu a sazby, pokud DPH prázdné */
  const base = tr.querySelector('[name="o-base"]'), rate = tr.querySelector('[name="o-rate"]'), vat = tr.querySelector('[name="o-vat"]');
  const recalc = () => { if (Number(base.value) && Number(rate.value)) vat.value = (Number(base.value) * Number(rate.value) / 100).toFixed(2); };
  base.addEventListener("input", recalc); rate.addEventListener("input", recalc);
  return tr;
}
document.getElementById("oss-add-line").addEventListener("click", () => ossLines.appendChild(ossLineRow()));
document.getElementById("new-oss").addEventListener("click", () => openOssModal());
function openOssModal(r) {
  ossForm.reset();
  ossLines.innerHTML = "";
  document.getElementById("oss-modal-title").textContent = r ? `OSS ${r.ctvrtleti}Q/${r.rok}` : "OSS — režim jednoho správního místa";
  const now = new Date();
  ossForm.elements.id.value = r ? r.id : "";
  ossForm.elements.rok.value = r ? r.rok : now.getFullYear();
  ossForm.elements.ctvrtleti.value = r ? r.ctvrtleti : Math.floor(now.getMonth() / 3) + 1 || 1;
  (r && r.rows.length ? r.rows : [undefined]).forEach(row => ossLines.appendChild(ossLineRow(row)));
  ossModal.hidden = false;
}
ossForm.addEventListener("submit", e => {
  e.preventDefault();
  const rows = [...ossLines.querySelectorAll("tr")].map(tr => ({
    stat: tr.querySelector('[name="o-stat"]').value,
    rate: Number(tr.querySelector('[name="o-rate"]').value) || 0,
    base: Number(tr.querySelector('[name="o-base"]').value) || 0,
    vat: Number(tr.querySelector('[name="o-vat"]').value) || 0
  })).filter(r => r.base || r.vat);
  if (!rows.length) { alert("Přidej aspoň jeden řádek s částkou."); return; }
  const f = ossForm.elements;
  const data = { type: "oss", ctvrtleti: Number(f.ctvrtleti.value), rok: Number(f.rok.value), mesic: Number(f.ctvrtleti.value) * 3, rows };
  if (f.id.value) Object.assign(store.reports.find(x => x.id === f.id.value), data);
  else { data.id = uid(); store.reports.push(data); }
  saveStore(); renderReports(); ossModal.hidden = true;
});
function ossSummaryHtml(r) {
  const totBase = r.rows.reduce((a, x) => a + x.base, 0), totVat = r.rows.reduce((a, x) => a + x.vat, 0);
  const eur = n => n.toLocaleString("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  return `<table class="ann-table" style="max-width:720px">
    <tr class="ann-head"><td colspan="4">OSS — ${r.ctvrtleti}. čtvrtletí ${r.rok}</td></tr>
    <tr class="ann-sub"><td>Země</td><td class="num">Sazba</td><td class="num">Základ</td><td class="num">DPH</td></tr>
    ${r.rows.map(x => `<tr><td>${escHtml(x.stat)}</td><td class="num">${x.rate} %</td><td class="num">${eur(x.base)}</td><td class="num">${eur(x.vat)}</td></tr>`).join("")}
    <tr class="ann-total"><td>Celkem</td><td></td><td class="num">${eur(totBase)}</td><td class="num">${eur(totVat)}</td></tr>
  </table>
  <p class="ann-note">Přehled OSS se podává čtvrtletně přes daňový portál (Elektronická podání pro OSS). Částky jsou v eurech dle pravidel režimu OSS.</p>`;
}

/* =====================================================================
   PRAVIDELNÉ FAKTURY — šablony, které se automaticky vystavují
   ===================================================================== */
if (!store.recurring) store.recurring = [];
const REC_INTERVALS = { weekly: "týdně", monthly: "měsíčně", quarterly: "čtvrtletně", halfyearly: "pololetně", yearly: "ročně" };
const plural = (n, one, few, many) => n === 1 ? one : n >= 2 && n <= 4 ? few : many;

/* posun data o měsíce se zachováním dne (31. 1. + 1 měsíc = 28. 2.) */
function addMonthsISO(iso, months) {
  const [y, m, d] = iso.split("-").map(Number);
  const base = new Date(y, m - 1 + months, 1);
  const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  base.setDate(Math.min(d, lastDay));
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
}
function nextRecDate(iso, interval) {
  if (interval === "weekly") return addDaysISO(iso, 7);
  return addMonthsISO(iso, { monthly: 1, quarterly: 3, halfyearly: 6, yearly: 12 }[interval] || 1);
}
/* {obdobi} → 07/2026, {mesic} → 07, {rok} → 2026, {mesic_nazev} → červenec */
function applyRecTokens(text, issuedOn) {
  const [y, m] = issuedOn.split("-");
  return String(text)
    .replaceAll("{obdobi}", `${m}/${y}`)
    .replaceAll("{mesic}", m)
    .replaceAll("{rok}", y)
    .replaceAll("{mesic_nazev}", ["leden","únor","březen","duben","květen","červen","červenec","srpen","září","říjen","listopad","prosinec"][Number(m) - 1]);
}
function issueFromRecurring(r, issuedOn) {
  const number = nextInvoiceNumber(issuedOn);
  const inv = {
    id: uid(), clientId: r.clientId, number, vs: vsFromNumber(number),
    issuedOn, dueDays: r.dueDays, dueOn: addDaysISO(issuedOn, r.dueDays),
    paymentMethod: r.paymentMethod, rounding: r.rounding,
    status: "issued", recurringId: r.id,
    lines: r.lines.map(l => ({ ...l, name: applyRecTokens(l.name, issuedOn) }))
  };
  store.invoices.push(inv);
  return inv;
}
/* při startu: vystavit vše, co mělo být vystaveno (i zameškaná období) */
function generateDueRecurring() {
  const today = todayISO();
  const created = [];
  for (const r of store.recurring) {
    if (!r.active) continue;
    let guard = 0;
    while (r.nextOn <= today && guard++ < 60) {
      if (r.endOn && r.nextOn > r.endOn) { r.active = false; break; }
      created.push(issueFromRecurring(r, r.nextOn));
      r.nextOn = nextRecDate(r.nextOn, r.interval);
    }
    if (r.endOn && r.nextOn > r.endOn) r.active = false;
  }
  if (created.length) saveStore();
  return created;
}
function showRecurringBanner(created) {
  document.getElementById("recurring-banner").innerHTML = `<div class="rec-banner">
    ${icon("repeat")} Automaticky ${plural(created.length, "vystavena 1 pravidelná faktura", `vystaveny ${created.length} pravidelné faktury`, `vystaveno ${created.length} pravidelných faktur`)}:
    <strong>${created.map(i => escHtml(i.number)).join(", ")}</strong>
    <button class="btn-ghost btn-small" data-rec-banner-close>OK</button>
  </div>`;
}

function renderRecurring() {
  const wrap = document.getElementById("recurring-list");
  if (!store.recurring.length) { wrap.innerHTML = ""; return; }
  wrap.innerHTML = `<div class="card recurring-card">
    <h3 class="recurring-head">${icon("repeat")} Pravidelné faktury</h3>
    <table class="list-table">
    <thead><tr><th>Název</th><th>Klient</th><th>Opakování</th><th>Další vystavení</th><th class="num">Částka</th><th>Stav</th><th></th></tr></thead>
    <tbody>${store.recurring.map(r => {
      const c = clientById(r.clientId);
      return `<tr>
        <td><strong>${escHtml(r.title || (c ? c.name : "Pravidelná faktura"))}</strong></td>
        <td data-label="Klient">${escHtml(c ? c.name : "—")}</td>
        <td data-label="Opakování">${REC_INTERVALS[r.interval] || r.interval}${r.endOn ? ` · do ${fmtDate(r.endOn)}` : ""}</td>
        <td data-label="Další vystavení">${r.active ? fmtDate(r.nextOn) : "—"}</td>
        <td class="num" data-label="Částka">${fmtMoney(invoiceTotal(r).total)}</td>
        <td data-label="Stav">${r.active ? `<span class="badge paid">Aktivní</span>` : `<span class="badge draft">Pozastavená</span>`}</td>
        <td class="actions">
          <div class="action-stack">
            <button class="btn-ghost btn-small" data-rec-now="${r.id}">${icon("repeat")} Vystavit teď</button>
            <button class="btn-ghost btn-small" data-rec-toggle="${r.id}">${icon(r.active ? "ban" : "check")} ${r.active ? "Pozastavit" : "Spustit"}</button>
            <button class="btn-ghost btn-small" data-rec-edit="${r.id}">${icon("edit")} Upravit</button>
            <button class="btn-ghost btn-small btn-danger" data-rec-del="${r.id}">${icon("trash")} Smazat</button>
          </div>
        </td>
      </tr>`;
    }).join("")}</tbody></table></div>`;
}

const recModal = document.getElementById("recurring-modal");
const recForm = document.getElementById("recurring-form");
const recLinesBody = document.getElementById("rec-lines-body");
const updateRecTotal = () => updateLinesTotal(recLinesBody, recForm.elements.rounding.checked, document.getElementById("rec-form-total"));
recForm.elements.rounding.addEventListener("change", updateRecTotal);
document.getElementById("rec-add-line").addEventListener("click", () => { recLinesBody.appendChild(lineRow(undefined, updateRecTotal)); updateRecTotal(); });

document.getElementById("new-recurring").addEventListener("click", () => {
  if (!store.settings.name || !store.settings.bankAccount) {
    alert("Nejdřív si v záložce Nastavení vyplň svoje údaje (jméno a bankovní účet).");
    return;
  }
  if (!store.clients.length) {
    alert("Nejdřív si v záložce Klienti přidej aspoň jednoho klienta.");
    return;
  }
  openRecurringModal();
});

function openRecurringModal(r) {
  recForm.reset();
  recLinesBody.innerHTML = "";
  document.getElementById("recurring-modal-title").textContent = r ? "Upravit pravidelnou fakturu" : "Nová pravidelná faktura";
  const sel = recForm.elements.clientId;
  sel.innerHTML = store.clients.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join("");
  if (r) {
    recForm.elements.id.value = r.id;
    recForm.elements.title.value = r.title || "";
    sel.value = r.clientId;
    recForm.elements.interval.value = r.interval;
    recForm.elements.nextOn.value = r.nextOn;
    recForm.elements.endOn.value = r.endOn || "";
    recForm.elements.dueDays.value = String(r.dueDays);
    recForm.elements.paymentMethod.value = r.paymentMethod;
    recForm.elements.rounding.checked = !!r.rounding;
    r.lines.forEach(l => recLinesBody.appendChild(lineRow(l, updateRecTotal)));
  } else {
    recForm.elements.nextOn.value = addMonthsISO(todayISO(), 1).slice(0, 8) + "01";
    recForm.elements.dueDays.value = String(store.settings.dueDays || 14);
    recForm.elements.rounding.checked = true;
    recLinesBody.appendChild(lineRow(undefined, updateRecTotal));
  }
  updateRecTotal();
  recModal.hidden = false;
}

recForm.addEventListener("submit", e => {
  e.preventDefault();
  const f = recForm.elements;
  const lines = readLines(recLinesBody).filter(l => l.name);
  if (!lines.length) { alert("Přidej aspoň jednu položku."); return; }
  const data = {
    title: f.title.value.trim(),
    clientId: f.clientId.value,
    interval: f.interval.value,
    nextOn: f.nextOn.value,
    endOn: f.endOn.value || null,
    dueDays: Number(f.dueDays.value),
    paymentMethod: f.paymentMethod.value,
    rounding: f.rounding.checked,
    lines
  };
  if (data.endOn && data.endOn < data.nextOn) { alert("Datum „Vystavovat do“ je dřív než příští vystavení."); return; }
  if (f.id.value) {
    const r = store.recurring.find(x => x.id === f.id.value);
    Object.assign(r, data);
    r.active = true; // úprava šablonu znovu aktivuje (změna nextOn = nový plán)
  } else {
    data.id = uid();
    data.active = true;
    store.recurring.push(data);
  }
  saveStore(); renderRecurring(); recModal.hidden = true;
  /* kdyby bylo příští vystavení dnes nebo v minulosti, vystavit hned */
  const created = generateDueRecurring();
  if (created.length) { renderInvoices(); renderRecurring(); showRecurringBanner(created); }
});

document.addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.recBannerClose !== undefined) document.getElementById("recurring-banner").innerHTML = "";
  const rid = b.dataset.recEdit || b.dataset.recDel || b.dataset.recToggle || b.dataset.recNow;
  if (!rid) return;
  const r = store.recurring.find(x => x.id === rid);
  if (!r) return;
  if (b.dataset.recEdit) openRecurringModal(r);
  if (b.dataset.recDel && confirm("Opravdu smazat pravidelnou fakturu? Už vystavené faktury zůstanou.")) {
    store.recurring = store.recurring.filter(x => x.id !== rid);
    saveStore(); renderRecurring();
  }
  if (b.dataset.recToggle) {
    r.active = !r.active;
    /* při znovuspuštění posunout plán do budoucna, ať se nedosypou zameškaná období */
    if (r.active) { const today = todayISO(); let g = 0; while (r.nextOn <= today && g++ < 120) r.nextOn = nextRecDate(r.nextOn, r.interval); }
    saveStore(); renderRecurring();
  }
  if (b.dataset.recNow) {
    const c = clientById(r.clientId);
    if (!confirm(`Vystavit fakturu pro ${c ? c.name : "klienta"} s dnešním datem? Plánované vystavení ${fmtDate(r.nextOn)} zůstane beze změny.`)) return;
    const inv = issueFromRecurring(r, todayISO());
    saveStore(); renderInvoices(); renderRecurring();
    showPreview(inv);
  }
});

/* =====================================================================
   CENOVÉ NABÍDKY — návrh pro klienta, po přijetí převod na fakturu
   ===================================================================== */
if (!store.quotes) store.quotes = [];
const QUOTE_STATUS = {
  open: ["issued", "Odeslaná"],
  accepted: ["paid", "Přijatá"],
  declined: ["cancelled", "Odmítnutá"],
  invoiced: ["draft", "Fakturovaná"]
};
/* číselná řada nabídek: N-RRRR-NN (přes celý rok) */
function nextQuoteNumber(forDateISO) {
  const year = (forDateISO || todayISO()).slice(0, 4);
  let max = 0;
  for (const q of store.quotes) {
    if (q.number.startsWith(`N-${year}-`)) {
      const n = parseInt(q.number.slice(7), 10);
      if (n > max) max = n;
    }
  }
  return `N-${year}-${String(max + 1).padStart(2, "0")}`;
}

const quoteModal = document.getElementById("quote-modal");
const quoteForm = document.getElementById("quote-form");
const quoteLinesBody = document.getElementById("quote-lines-body");
const updateQuoteTotal = () => updateLinesTotal(quoteLinesBody, quoteForm.elements.rounding.checked, document.getElementById("quote-form-total"));
quoteForm.elements.rounding.addEventListener("change", updateQuoteTotal);
document.getElementById("quote-add-line").addEventListener("click", () => { quoteLinesBody.appendChild(lineRow(undefined, updateQuoteTotal)); updateQuoteTotal(); });

document.getElementById("new-quote").addEventListener("click", () => {
  if (!store.settings.name) { alert("Nejdřív si v záložce Nastavení vyplň svoje údaje."); return; }
  if (!store.clients.length) { alert("Nejdřív si v záložce Klienti přidej aspoň jednoho klienta."); return; }
  openQuoteModal();
});

function openQuoteModal(q) {
  quoteForm.reset();
  quoteLinesBody.innerHTML = "";
  document.getElementById("quote-modal-title").textContent = q ? "Upravit nabídku " + q.number : "Nová nabídka";
  const sel = quoteForm.elements.clientId;
  sel.innerHTML = store.clients.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join("");
  if (q) {
    quoteForm.elements.id.value = q.id;
    sel.value = q.clientId;
    quoteForm.elements.number.value = q.number;
    quoteForm.elements.issuedOn.value = q.issuedOn;
    quoteForm.elements.validDays.value = String(q.validDays);
    quoteForm.elements.rounding.checked = !!q.rounding;
    quoteForm.elements.intro.value = q.intro || "";
    q.lines.forEach(l => quoteLinesBody.appendChild(lineRow(l, updateQuoteTotal)));
  } else {
    quoteForm.elements.number.value = nextQuoteNumber();
    quoteForm.elements.issuedOn.value = todayISO();
    quoteForm.elements.rounding.checked = true;
    quoteLinesBody.appendChild(lineRow(undefined, updateQuoteTotal));
  }
  updateQuoteTotal();
  quoteModal.hidden = false;
}

quoteForm.addEventListener("submit", e => {
  e.preventDefault();
  const f = quoteForm.elements;
  const lines = readLines(quoteLinesBody).filter(l => l.name);
  if (!lines.length) { alert("Přidej aspoň jednu položku."); return; }
  const data = {
    clientId: f.clientId.value,
    number: f.number.value.trim(),
    issuedOn: f.issuedOn.value,
    validDays: Number(f.validDays.value),
    validUntil: addDaysISO(f.issuedOn.value, f.validDays.value),
    rounding: f.rounding.checked,
    intro: f.intro.value.trim(),
    lines
  };
  let q;
  if (f.id.value) {
    q = store.quotes.find(q => q.id === f.id.value);
    Object.assign(q, data);
  } else {
    data.id = uid();
    data.status = "open";
    store.quotes.push(data);
    q = data;
  }
  autoSavePdf(q, 'quote').then(r => { if (r && r.id) { q.fileId = r.id; saveStore(); } });
  saveStore(); renderQuotes(); quoteModal.hidden = true;
});

function renderQuotes() {
  const wrap = document.getElementById("quote-list");
  if (!store.quotes.length) {
    wrap.innerHTML = `<div class="empty-note">Zatím žádné nabídky. Vytvoř první tlačítkem „+ Nová nabídka“.</div>`;
    return;
  }
  const today = todayISO();
  const sorted = [...store.quotes].sort((a, b) => b.issuedOn.localeCompare(a.issuedOn) || b.number.localeCompare(a.number));
  wrap.innerHTML = `<table class="list-table">
    <thead><tr><th>Číslo</th><th>Klient</th><th>Vystavena</th><th>Platí do</th><th class="num">Částka</th><th>Stav</th><th></th></tr></thead>
    <tbody>${sorted.map(q => {
      const c = clientById(q.clientId);
      const expired = q.status === "open" && q.validUntil < today;
      const [cls, label] = expired ? ["overdue", "Propadlá"] : QUOTE_STATUS[q.status] || QUOTE_STATUS.open;
      return `<tr>
        <td><strong>${escHtml(q.number)}</strong></td>
        <td data-label="Klient">${escHtml(c ? c.name : "—")}</td>
        <td data-label="Vystavena">${fmtDate(q.issuedOn)}</td>
        <td data-label="Platí do">${fmtDate(q.validUntil)}</td>
        <td class="num" data-label="Částka">${fmtMoney(invoiceTotal(q).total)}</td>
        <td data-label="Stav"><span class="badge ${cls}">${label}</span></td>
        <td class="actions">
          <button class="btn-ghost btn-small" data-quote-view="${q.id}">Náhled / PDF</button>
          ${q.status === "open" ? `<button class="btn-ghost btn-small" data-quote-accept="${q.id}">Přijata ${icon("check")}</button>
            <button class="btn-ghost btn-small" data-quote-decline="${q.id}">Odmítnuta</button>` : ""}
          ${q.status === "accepted" ? `<button class="btn-ghost btn-small" data-quote-invoice="${q.id}">${icon("convert")} Vystavit fakturu</button>` : ""}
          ${q.status !== "invoiced" ? `<button class="btn-ghost btn-small" data-quote-edit="${q.id}">Upravit</button>` : ""}
          ${["declined", "invoiced"].includes(q.status) ? `<button class="btn-ghost btn-small" data-quote-reopen="${q.id}">Obnovit</button>` : ""}
          <button class="btn-ghost btn-small btn-danger" data-quote-del="${q.id}">Smazat</button>
        </td>
      </tr>`;
    }).join("")}</tbody></table>`;
}

/* papír nabídky — bez platebních údajů a QR */
function quotePaperHtml(q) {
  const s = store.settings;
  const c = clientById(q.clientId) || {};
  const t = invoiceTotal(q);
  const vat = s.vatPayer;
  return `
    <div class="inv-head">
      <div class="inv-title-block"><div class="inv-title">Cenová nabídka<br><span class="inv-number">${escHtml(q.number)}</span></div></div>
    </div>
    <div class="inv-parties">
      <div class="party">
        <div class="party-label">Dodavatel</div>
        <div class="party-name">${escHtml(s.name)}</div>
        <address>${escHtml(s.street)}<br>${escHtml(s.zip)} ${escHtml(s.city)}</address>
        <div class="kv-block">
          <div class="kv"><span class="k">IČO</span><span class="v">${escHtml(s.ico)}</span></div>
          ${vat ? `<div class="kv"><span class="k">DIČ</span><span class="v">${escHtml(s.dic)}</span></div>` : `<div class="kv"><span class="k">Neplátce DPH</span><span class="v"></span></div>`}
          ${s.email ? `<div class="kv"><span class="k">E-mail</span><span class="v">${escHtml(s.email)}</span></div>` : ""}
          ${s.phone ? `<div class="kv"><span class="k">Telefon</span><span class="v">${escHtml(s.phone)}</span></div>` : ""}
        </div>
      </div>
      <div class="party">
        <div class="party-label">Odběratel</div>
        <div class="party-name">${escHtml(c.name)}</div>
        <address>${escHtml(c.street)}<br>${escHtml(c.zip)} ${escHtml(c.city)}</address>
        <div class="kv-block">
          ${c.ico ? `<div class="kv"><span class="k">IČO</span><span class="v">${escHtml(c.ico)}</span></div>` : ""}
          ${c.dic ? `<div class="kv"><span class="k">DIČ</span><span class="v">${escHtml(c.dic)}</span></div>` : ""}
        </div>
        <div class="kv-block">
          <div class="kv"><span class="k">Datum vystavení</span><span class="v">${fmtDate(q.issuedOn)}</span></div>
          <div class="kv"><span class="k">Nabídka platí do</span><span class="v">${fmtDate(q.validUntil)}</span></div>
        </div>
      </div>
    </div>
    ${q.intro ? `<div class="quote-intro">${escHtml(q.intro)}</div>` : ""}
    <table class="inv-lines">
      <thead><tr>
        <th class="desc"></th>
        ${anyQty(q) ? "<th>Počet</th>" : ""}
        ${vat ? "<th>DPH</th>" : ""}
        <th>Cena</th>
      </tr></thead>
      <tbody>${q.lines.map(l => `<tr>
        <td class="desc">${escHtml(l.name)}</td>
        ${anyQty(q) ? `<td>${l.qty} ${escHtml(l.unit)}</td>` : ""}
        ${vat ? `<td>${l.vatRate} %</td>` : ""}
        <td>${fmtMoney(l.qty * l.unitPrice * (1 + (vat ? l.vatRate : 0) / 100))}</td>
      </tr>`).join("")}</tbody>
    </table>
    <div class="inv-bottom">
      <div></div>
      <div class="inv-summary">
        ${vat ? `<div class="kv"><span class="k">Základ</span><span class="v">${fmtMoney(t.subtotal)}</span></div>
                 <div class="kv"><span class="k">DPH</span><span class="v">${fmtMoney(t.vatTotal)}</span></div>` : ""}
        ${Math.abs(t.roundingAdjustment) >= 0.005 ? `<div class="kv"><span class="k">Zaokrouhlení</span><span class="v">${fmtMoney(t.roundingAdjustment)}</span></div>` : ""}
        <div class="inv-total">${fmtMoney(t.total)}</div>
      </div>
    </div>
    <div class="inv-footer">Toto je cenová nabídka, nikoli daňový doklad ani výzva k platbě.${store.settings.footerNote ? "\n" + escHtml(store.settings.footerNote) : ""}</div>`;
}
function showQuotePreview(q) {
  previewInvoice = null;
  const paper = document.getElementById("invoice-paper");
  paper.className = "paper";
  paper.innerHTML = quotePaperHtml(q);
  document.getElementById("preview-xml").hidden = true;
  document.querySelectorAll(".tab").forEach(t => (t.hidden = true));
  document.querySelector(".topbar").style.display = "none";
  document.getElementById("preview-wrap").hidden = false;
  window.scrollTo(0, 0);
  document.title = "Nabídka " + q.number;
}

/* z přijaté nabídky vystavit fakturu */
function quoteToInvoice(q) {
  const issuedOn = todayISO();
  const number = nextInvoiceNumber(issuedOn);
  const dueDays = store.settings.dueDays || 14;
  const inv = {
    id: uid(), clientId: q.clientId, number, vs: vsFromNumber(number),
    issuedOn, dueDays, dueOn: addDaysISO(issuedOn, dueDays),
    paymentMethod: "Převodem", rounding: q.rounding,
    status: "issued", quoteId: q.id,
    lines: q.lines.map(l => ({ ...l }))
  };
  store.invoices.push(inv);
  q.status = "invoiced";
  q.invoiceId = inv.id;
  saveStore(); renderInvoices(); renderQuotes();
  showPreview(inv);
}

document.addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  const qid = b.dataset.quoteView || b.dataset.quoteEdit || b.dataset.quoteDel || b.dataset.quoteAccept
    || b.dataset.quoteDecline || b.dataset.quoteInvoice || b.dataset.quoteReopen;
  if (!qid) return;
  const q = store.quotes.find(x => x.id === qid);
  if (!q) return;
  if (b.dataset.quoteView) showQuotePreview(q);
  if (b.dataset.quoteEdit) openQuoteModal(q);
  if (b.dataset.quoteDel && confirm("Opravdu smazat nabídku?")) {
    store.quotes = store.quotes.filter(x => x.id !== qid);
    saveStore(); renderQuotes();
  }
  if (b.dataset.quoteAccept) { q.status = "accepted"; saveStore(); renderQuotes(); }
  if (b.dataset.quoteDecline) { q.status = "declined"; saveStore(); renderQuotes(); }
  if (b.dataset.quoteReopen) { q.status = "open"; delete q.invoiceId; saveStore(); renderQuotes(); }
  if (b.dataset.quoteInvoice && confirm(`Vystavit fakturu z nabídky ${q.number}? Faktura dostane dnešní datum a splatnost ${store.settings.dueDays || 14} dní.`)) {
    quoteToInvoice(q);
  }
});

/* ---------------- Záloha / obnova ---------------- */
function downloadFile(name, content, mime) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
/* nahradit celý store daty ze zálohy + doplnit novější části a výchozí hodnoty */
function applyRestoredStore(data) {
  store = data;
  for (const k of ["incomes", "expenses", "reports", "recurring", "recurringExpenses", "recurringIncomes", "quotes", "products", "stockMoves"]) {
    if (!Array.isArray(store[k])) store[k] = [];
  }
  if (!store.reportDefaults) store.reportDefaults = {};
  if (!store.taxAnnual) store.taxAnnual = {};
  store.settings = { ...defaultSettings(), ...store.settings };
  store.taxSettings = { ...defaultTaxSettings(), ...(store.taxSettings || {}) };
  if (!store.taxSettings.years) store.taxSettings.years = {};
  saveStore();
  fillSettingsForm(); renderClients(); renderInvoices(); renderRecurring(); renderRecurringExpenses(); renderRecurringIncomes(); renderQuotes();
  renderReports(); renderExpenses(); renderIncomes(); renderWarehouse();
}
const setBackupStatus = t => { document.getElementById("backup-status").textContent = t; };

document.getElementById("backup-export").addEventListener("click", () => {
  downloadFile(`fakturace-zaloha-${todayISO()}.json`, JSON.stringify(store, null, 2), "application/json");
});

/* ---- kompletní záloha (ZIP): data + všechny soubory z app/data ---- */
function u8ToBase64(u8) {
  let s = "";
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
/* čtečka ZIP pro naše zálohy (vše metodou „stored“, bez komprese) */
function readZipStored(buf) {
  const dv = new DataView(buf), bytes = new Uint8Array(buf), dec = new TextDecoder();
  const files = []; let off = 0;
  while (off + 4 <= bytes.length && dv.getUint32(off, true) === 0x04034b50) {
    const compSize = dv.getUint32(off + 18, true);
    const nameLen = dv.getUint16(off + 26, true);
    const extraLen = dv.getUint16(off + 28, true);
    const nameStart = off + 30;
    const name = dec.decode(bytes.subarray(nameStart, nameStart + nameLen));
    const dataStart = nameStart + nameLen + extraLen;
    files.push({ name, data: bytes.subarray(dataStart, dataStart + compSize) });
    off = dataStart + compSize;
  }
  return files;
}

document.getElementById("backup-export-zip").addEventListener("click", async () => {
  const btn = document.getElementById("backup-export-zip");
  btn.disabled = true;
  try {
    const entries = [{ name: "data.json", text: JSON.stringify(store, null, 2) }];
    if (serverMode) {
      const all = await FilesBackend.list();
      entries.push({ name: "files-meta.json", text: JSON.stringify(all, null, 2) });
      let i = 0;
      for (const f of all) {
        setBackupStatus(`Přidávám soubory… ${++i}/${all.length}`);
        const ab = await (await fetch(`/api/files/${f.id}/content?inline=1`)).arrayBuffer();
        entries.push({ name: `soubory/${f.category}/${f.name}`, text: new Uint8Array(ab) });
      }
    }
    setBackupStatus("Balím ZIP…");
    downloadFile(`fakturace-kompletni-zaloha-${todayISO()}.zip`, makeZip(entries));
    setBackupStatus(`✓ Kompletní záloha stažena${serverMode ? "" : " (bez souborů — běžíš bez serveru)"}.`);
  } catch (err) {
    setBackupStatus("");
    alert("Zálohu se nepodařilo vytvořit: " + err.message);
  } finally {
    btn.disabled = false;
    setTimeout(() => setBackupStatus(""), 6000);
  }
});

document.getElementById("backup-import").addEventListener("click", () => document.getElementById("backup-file").click());
document.getElementById("backup-file").addEventListener("change", async e => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  const isZip = /\.zip$/i.test(file.name);
  try {
    if (isZip) {
      const entries = readZipStored(await file.arrayBuffer());
      const dataEntry = entries.find(x => x.name === "data.json");
      if (!dataEntry) throw new Error("v ZIP záloze chybí data.json");
      const data = JSON.parse(new TextDecoder().decode(dataEntry.data));
      if (!data.settings || !Array.isArray(data.invoices)) throw new Error("neplatný formát dat");
      const metaEntry = entries.find(x => x.name === "files-meta.json");
      const fileCount = entries.filter(x => x.name.startsWith("soubory/")).length;
      const restoreFiles = serverMode && metaEntry && fileCount > 0;
      if (!confirm(`Nahradit všechna současná data zálohou?${restoreFiles ? `\n\nSoučástí je ${fileCount} souborů — obnoví se do app/data (mohou vzniknout duplikáty, pokud tam soubory už jsou).` : ""}`)) return;
      applyRestoredStore(data);
      if (restoreFiles) await restoreFilesFromZip(entries, JSON.parse(new TextDecoder().decode(metaEntry.data)));
      alert("Data obnovena ze zálohy." + (restoreFiles ? ` Obnoveno i ${fileCount} souborů.` : metaEntry && !serverMode ? " Soubory se neobnovily — spusť aplikaci přes start.command." : ""));
    } else {
      const data = JSON.parse(await file.text());
      if (!data.settings || !Array.isArray(data.invoices)) throw new Error("neplatný formát");
      if (!confirm("Nahradit všechna současná data zálohou?")) return;
      applyRestoredStore(data);
      alert("Data obnovena ze zálohy.");
    }
  } catch (err) { alert("Soubor se nepodařilo načíst: " + err.message); }
});

/* obnovit soubory ze ZIP na server a přemapovat fileId odkazy */
async function restoreFilesFromZip(entries, oldMeta) {
  const idMap = {};
  let i = 0;
  for (const m of oldMeta) {
    const entry = entries.find(x => x.name === `soubory/${m.category}/${m.name}`);
    if (!entry) continue;
    setBackupStatus(`Obnovuji soubory… ${++i}/${oldMeta.length}`);
    const rec = await apiJson("/api/files", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: m.name, category: m.category, period: m.period || "", note: m.note || "", type: m.type || "", dataBase64: u8ToBase64(entry.data) })
    });
    if (rec && rec.id) {
      idMap[m.id] = rec.id;
      if (m.ai) await FilesBackend.update(rec.id, { ai: m.ai });
    }
  }
  /* přepsat staré fileId novými */
  for (const coll of [store.invoices, store.expenses, store.incomes]) {
    for (const it of coll || []) if (it.fileId && idMap[it.fileId]) it.fileId = idMap[it.fileId];
  }
  saveStore();
  renderInvoices(); renderExpenses(); renderIncomes(); renderFiles();
  setBackupStatus("");
}

/* ---------------- Multi-supplier (Profily Firem) ---------------- */
const supSelect = document.getElementById("supplier-select");
function renderSupplierSelect() {
  supSelect.innerHTML = PROFILES.map(p => `<option value="${p.id}" ${p.id === STORE_KEY ? 'selected' : ''}>${escHtml(p.name)}</option>`).join("");
  document.getElementById("del-supplier-btn").style.display = PROFILES.length > 1 ? "inline-block" : "none";
}
supSelect.addEventListener("change", e => {
  localStorage.setItem("fakturace_active_profile", e.target.value);
  location.reload();
});
document.getElementById("new-supplier-btn").addEventListener("click", () => {
  const name = prompt("Název nové firmy / profilu:");
  if (!name) return;
  const newId = "fakturace_" + Date.now().toString(36);
  PROFILES.push({ id: newId, name });
  saveProfiles();
  localStorage.setItem("fakturace_active_profile", newId);
  location.reload();
});
document.getElementById("del-supplier-btn").addEventListener("click", () => {
  if (PROFILES.length <= 1) return;
  if (!confirm(`Opravdu smazat aktuální profil (${PROFILES.find(p => p.id === STORE_KEY).name}) včetně všech dat?`)) return;
  PROFILES = PROFILES.filter(p => p.id !== STORE_KEY);
  localStorage.removeItem(STORE_KEY);
  saveProfiles();
  localStorage.setItem("fakturace_active_profile", PROFILES[0].id);
  location.reload();
});
/* =====================================================================
   SKLADOVÉ ŘÍZENÍ — zboží, ceník, pohyby, inventura
   ===================================================================== */
if (!store.products) store.products = [];
if (!store.stockMoves) store.stockMoves = [];
const productModal = document.getElementById("product-modal");
const productForm = document.getElementById("product-form");
const stockMoveModal = document.getElementById("stockmove-modal");
const stockMoveForm = document.getElementById("stockmove-form");

function renderWarehouse() {
  const wrap = document.getElementById("product-list");
  const stats = document.getElementById("wh-stats");
  if (!wrap) return;
  if (!store.products.length) {
    if (stats) stats.innerHTML = "";
    wrap.innerHTML = `<div class="empty-note">Zatím žádné zboží. Přidej první tlačítkem „+ Nové zboží“.</div>`;
    return;
  }
  const lowStock = store.products.filter(p => Number(p.stock) <= 0);
  const totalValue = store.products.reduce((a, p) => a + (Number(p.stock) || 0) * (Number(p.price) || 0), 0);
  if (stats) stats.innerHTML = `<div class="tiles tiles-mini-row">
    <div class="tile tile-mini"><div class="tile-label">Položek</div><div class="tile-value">${store.products.length}</div></div>
    <div class="tile tile-mini"><div class="tile-label">Hodnota skladu</div><div class="tile-value">${fmtMoney(totalValue)}</div><div class="tile-sub">v prodejních cenách</div></div>
    <div class="tile tile-mini${lowStock.length ? " t-critical" : ""}"><div class="tile-label">Vyprodáno / záporný stav</div><div class="tile-value">${lowStock.length}</div></div>
  </div>`;
  const sorted = [...store.products].sort((a, b) => a.name.localeCompare(b.name, "cs"));
  wrap.innerHTML = `<table class="list-table">
    <thead><tr><th>Název</th><th>SKU</th><th class="num">Cena</th><th class="num">Skladem</th><th class="num">Hodnota</th><th></th></tr></thead>
    <tbody>${sorted.map(p => {
      const stock = Number(p.stock) || 0;
      return `<tr>
        <td><strong>${escHtml(p.name)}</strong>${p.note ? `<div class="file-ai">${escHtml(p.note)}</div>` : ""}</td>
        <td data-label="SKU">${escHtml(p.sku || "—")}</td>
        <td class="num" data-label="Cena">${fmtMoney(Number(p.price) || 0)}</td>
        <td class="num" data-label="Skladem"><strong style="color:${stock <= 0 ? "var(--status-critical)" : "inherit"}">${stock} ${escHtml(p.unit || "ks")}</strong></td>
        <td class="num" data-label="Hodnota">${fmtMoney(stock * (Number(p.price) || 0))}</td>
        <td class="actions"><div class="action-stack">
          <button class="btn-ghost btn-small" data-stock-in="${p.id}" title="Naskladnit">${icon("plus")} Příjem</button>
          <button class="btn-ghost btn-small" data-stock-out="${p.id}" title="Vyskladnit">${icon("minus")} Výdej</button>
          <button class="btn-ghost btn-small" data-prod-history="${p.id}">${icon("clock")} Pohyby</button>
          <button class="btn-ghost btn-small" data-prod-edit="${p.id}">${icon("edit")} Upravit</button>
          <button class="btn-ghost btn-small btn-danger" data-prod-del="${p.id}">${icon("trash")} Smazat</button>
        </div></td>
      </tr>`;
    }).join("")}</tbody></table>`;
}

document.getElementById("new-product").addEventListener("click", () => openProductModal());
function openProductModal(p) {
  productForm.reset();
  document.getElementById("product-modal-title").textContent = p ? "Upravit zboží" : "Nové zboží";
  if (p) for (const k of ["id", "name", "sku", "unit", "price", "stock", "note"]) if (productForm.elements[k]) productForm.elements[k].value = p[k] ?? "";
  productModal.hidden = false;
}
productForm.addEventListener("submit", e => {
  e.preventDefault();
  const f = productForm.elements;
  const data = { name: f.name.value.trim(), sku: f.sku.value.trim(), unit: f.unit.value.trim() || "ks", price: Number(f.price.value) || 0, stock: Number(f.stock.value) || 0, note: f.note.value.trim() };
  if (f.id.value) Object.assign(store.products.find(p => p.id === f.id.value), data);
  else { data.id = uid(); store.products.push(data); }
  saveStore(); renderWarehouse(); productModal.hidden = true;
});

let stockMoveType = "in";
function openStockMoveModal(productId, type) {
  const p = store.products.find(x => x.id === productId);
  if (!p) return;
  stockMoveForm.reset();
  stockMoveForm.elements.productId.value = productId;
  stockMoveForm.elements.type.value = type || "in";
  stockMoveForm.elements.date.value = todayISO();
  document.getElementById("stockmove-modal-title").textContent = `Skladový pohyb — ${p.name} (nyní ${Number(p.stock) || 0} ${p.unit || "ks"})`;
  stockMoveModal.hidden = false;
}
stockMoveForm.addEventListener("submit", e => {
  e.preventDefault();
  const f = stockMoveForm.elements;
  const p = store.products.find(x => x.id === f.productId.value);
  if (!p) return;
  const qty = Number(f.qty.value) || 0;
  const type = f.type.value;
  const before = Number(p.stock) || 0;
  if (type === "in") p.stock = before + qty;
  else if (type === "out") p.stock = before - qty;
  else p.stock = qty; /* inventura = nastavit stav */
  store.stockMoves.push({ id: uid(), productId: p.id, date: f.date.value, type, qty, before, after: Number(p.stock), note: f.note.value.trim() });
  saveStore(); renderWarehouse(); stockMoveModal.hidden = true;
});

document.getElementById("product-list").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.stockIn) openStockMoveModal(b.dataset.stockIn, "in");
  if (b.dataset.stockOut) openStockMoveModal(b.dataset.stockOut, "out");
  if (b.dataset.prodEdit) openProductModal(store.products.find(p => p.id === b.dataset.prodEdit));
  if (b.dataset.prodDel && confirm("Opravdu smazat zboží i jeho historii pohybů?")) {
    store.products = store.products.filter(p => p.id !== b.dataset.prodDel);
    store.stockMoves = store.stockMoves.filter(m => m.productId !== b.dataset.prodDel);
    saveStore(); renderWarehouse();
  }
  if (b.dataset.prodHistory) {
    const p = store.products.find(x => x.id === b.dataset.prodHistory);
    const moves = store.stockMoves.filter(m => m.productId === p.id).sort((a, b2) => b2.date.localeCompare(a.date));
    const TYP = { in: "Příjem", out: "Výdej", set: "Inventura" };
    const body = moves.length
      ? `<table class="doc-table"><thead><tr><th>Datum</th><th>Typ</th><th class="num">Množství</th><th class="num">Stav po</th><th>Poznámka</th></tr></thead>
         <tbody>${moves.map(m => `<tr><td>${fmtDate(m.date)}</td><td>${TYP[m.type]}</td><td class="num">${m.type === "set" ? "→" : m.type === "out" ? "−" : "+"}${m.qty}</td><td class="num">${m.after}</td><td>${escHtml(m.note || "")}</td></tr>`).join("")}</tbody></table>`
      : `<p>Zatím žádné pohyby.</p>`;
    printDocument(`Pohyby skladu — ${p.name}`, body);
  }
});
document.getElementById("wh-export").addEventListener("click", () => {
  if (!store.products.length) { alert("Žádné zboží k exportu."); return; }
  const rows = [["Název", "SKU", "Jednotka", "Cena", "Skladem", "Hodnota", "Poznámka"]];
  for (const p of store.products) rows.push([p.name, p.sku || "", p.unit || "ks", csvNum((Number(p.price) || 0).toFixed(2)), p.stock || 0, csvNum(((Number(p.stock) || 0) * (Number(p.price) || 0)).toFixed(2)), p.note || ""]);
  downloadFile(`sklad-${todayISO()}.csv`, toCsv(rows), "text/csv;charset=utf-8");
});

/* =====================================================================
   PRAVIDELNÉ VÝDAJE A PŘÍJMY
   ===================================================================== */
if (!store.recurringExpenses) store.recurringExpenses = [];
if (!store.recurringIncomes) store.recurringIncomes = [];

function generateDueRecurringExpensesAndIncomes() {
  const today = todayISO();
  let createdAny = false;

  for (const r of store.recurringExpenses) {
    if (!r.active) continue;
    let guard = 0;
    while (r.nextOn <= today && guard++ < 60) {
      if (r.endOn && r.nextOn > r.endOn) { r.active = false; break; }
      store.expenses.push({
        id: uid(),
        supplier: applyRecTokens(r.supplier, r.nextOn),
        amount: r.amount,
        date: r.nextOn,
        category: r.category,
        note: applyRecTokens(r.note || "", r.nextOn),
        source: "recurring",
        fileId: null,
        recurringId: r.id
      });
      createdAny = true;
      r.nextOn = nextRecDate(r.nextOn, r.interval);
    }
    if (r.endOn && r.nextOn > r.endOn) r.active = false;
  }

  for (const r of store.recurringIncomes) {
    if (!r.active) continue;
    let guard = 0;
    while (r.nextOn <= today && guard++ < 60) {
      if (r.endOn && r.nextOn > r.endOn) { r.active = false; break; }
      store.incomes.push({
        id: uid(),
        supplier: applyRecTokens(r.supplier, r.nextOn),
        amount: r.amount,
        date: r.nextOn,
        period: r.period ? applyRecTokens(r.period, r.nextOn) : undefined,
        note: applyRecTokens(r.note || "", r.nextOn),
        source: "recurring",
        fileId: null,
        recurringId: r.id
      });
      createdAny = true;
      r.nextOn = nextRecDate(r.nextOn, r.interval);
    }
    if (r.endOn && r.nextOn > r.endOn) r.active = false;
  }
  return createdAny;
}

function renderRecurringExpenses() {
  const wrap = document.getElementById("recurring-expenses-list");
  if (!store.recurringExpenses.length) { wrap.innerHTML = ""; return; }
  wrap.innerHTML = `<div class="card recurring-card" style="margin-bottom:1.5rem">
    <h3 class="recurring-head">${icon("repeat")} Pravidelné výdaje</h3>
    <table class="list-table">
    <thead><tr><th>Název</th><th>Dodavatel</th><th>Kategorie</th><th>Opakování</th><th>Další zaúčtování</th><th class="num">Částka</th><th>Stav</th><th></th></tr></thead>
    <tbody>${store.recurringExpenses.map(r => `<tr>
        <td><strong>${escHtml(r.title || "Pravidelný výdaj")}</strong></td>
        <td data-label="Dodavatel">${escHtml(r.supplier)}</td>
        <td data-label="Kategorie">${escHtml(r.category)}</td>
        <td data-label="Opakování">${REC_INTERVALS[r.interval] || r.interval}${r.endOn ? ` · do ${fmtDate(r.endOn)}` : ""}</td>
        <td data-label="Další zaúčtování">${r.active ? fmtDate(r.nextOn) : "—"}</td>
        <td class="num" data-label="Částka">${fmtMoney(r.amount)}</td>
        <td data-label="Stav">${r.active ? `<span class="badge paid">Aktivní</span>` : `<span class="badge draft">Pozastaveno</span>`}</td>
        <td class="actions">
          <div class="action-stack">
            <button class="btn-ghost btn-small" data-recexp-toggle="${r.id}">${icon(r.active ? "ban" : "check")} ${r.active ? "Pozastavit" : "Spustit"}</button>
            <button class="btn-ghost btn-small" data-recexp-edit="${r.id}">${icon("edit")} Upravit</button>
            <button class="btn-ghost btn-small btn-danger" data-recexp-del="${r.id}">${icon("trash")} Smazat</button>
          </div>
        </td>
      </tr>`).join("")}</tbody></table></div>`;
}

function renderRecurringIncomes() {
  const wrap = document.getElementById("recurring-incomes-list");
  if (!store.recurringIncomes.length) { wrap.innerHTML = ""; return; }
  wrap.innerHTML = `<div class="card recurring-card" style="margin-bottom:1.5rem">
    <h3 class="recurring-head">${icon("repeat")} Pravidelné příjmy</h3>
    <table class="list-table">
    <thead><tr><th>Název</th><th>Zdroj</th><th>Opakování</th><th>Další zaúčtování</th><th class="num">Částka</th><th>Stav</th><th></th></tr></thead>
    <tbody>${store.recurringIncomes.map(r => `<tr>
        <td><strong>${escHtml(r.title || "Pravidelný příjem")}</strong></td>
        <td data-label="Zdroj">${escHtml(r.supplier)}</td>
        <td data-label="Opakování">${REC_INTERVALS[r.interval] || r.interval}${r.endOn ? ` · do ${fmtDate(r.endOn)}` : ""}</td>
        <td data-label="Další zaúčtování">${r.active ? fmtDate(r.nextOn) : "—"}</td>
        <td class="num" data-label="Částka">${fmtMoney(r.amount)}</td>
        <td data-label="Stav">${r.active ? `<span class="badge paid">Aktivní</span>` : `<span class="badge draft">Pozastaveno</span>`}</td>
        <td class="actions">
          <div class="action-stack">
            <button class="btn-ghost btn-small" data-recinc-toggle="${r.id}">${icon(r.active ? "ban" : "check")} ${r.active ? "Pozastavit" : "Spustit"}</button>
            <button class="btn-ghost btn-small" data-recinc-edit="${r.id}">${icon("edit")} Upravit</button>
            <button class="btn-ghost btn-small btn-danger" data-recinc-del="${r.id}">${icon("trash")} Smazat</button>
          </div>
        </td>
      </tr>`).join("")}</tbody></table></div>`;
}

const recExpModal = document.getElementById("recurring-expense-modal");
const recExpForm = document.getElementById("recurring-expense-form");
document.getElementById("new-recurring-expense").addEventListener("click", () => openRecExpModal());

function openRecExpModal(r) {
  recExpForm.reset();
  document.getElementById("recurring-expense-modal-title").textContent = r ? "Upravit pravidelný výdaj" : "Nový pravidelný výdaj";
  const f = recExpForm.elements;
  if (r) {
    f.id.value = r.id;
    f.title.value = r.title || "";
    f.supplier.value = r.supplier;
    f.amount.value = r.amount;
    f.category.value = r.category;
    f.interval.value = r.interval;
    f.nextOn.value = r.nextOn;
    f.endOn.value = r.endOn || "";
    f.note.value = r.note || "";
  } else {
    f.nextOn.value = addMonthsISO(todayISO(), 1).slice(0, 8) + "01";
  }
  recExpModal.hidden = false;
}

recExpForm.addEventListener("submit", e => {
  e.preventDefault();
  const f = recExpForm.elements;
  const data = {
    title: f.title.value.trim(),
    supplier: f.supplier.value.trim(),
    amount: Number(f.amount.value) || 0,
    category: f.category.value,
    interval: f.interval.value,
    nextOn: f.nextOn.value,
    endOn: f.endOn.value || null,
    note: f.note.value.trim()
  };
  if (data.endOn && data.endOn < data.nextOn) { alert("Datum „Účtovat do“ je dřív než příští zaúčtování."); return; }
  
  if (f.id.value) {
    const r = store.recurringExpenses.find(x => x.id === f.id.value);
    Object.assign(r, data);
    r.active = true;
  } else {
    data.id = uid();
    data.active = true;
    store.recurringExpenses.push(data);
  }
  saveStore(); renderRecurringExpenses(); recExpModal.hidden = true;
  if (generateDueRecurringExpensesAndIncomes()) { saveStore(); renderExpenses(); renderDashboard(); renderRecurringExpenses(); }
});

const recIncModal = document.getElementById("recurring-income-modal");
const recIncForm = document.getElementById("recurring-income-form");
document.getElementById("new-recurring-income").addEventListener("click", () => openRecIncModal());

function openRecIncModal(r) {
  recIncForm.reset();
  document.getElementById("recurring-income-modal-title").textContent = r ? "Upravit pravidelný příjem" : "Nový pravidelný příjem";
  const f = recIncForm.elements;
  if (r) {
    f.id.value = r.id;
    f.title.value = r.title || "";
    f.supplier.value = r.supplier;
    f.amount.value = r.amount;
    f.interval.value = r.interval;
    f.nextOn.value = r.nextOn;
    f.endOn.value = r.endOn || "";
    f.period.value = r.period || "";
    f.note.value = r.note || "";
  } else {
    f.nextOn.value = addMonthsISO(todayISO(), 1).slice(0, 8) + "01";
  }
  recIncModal.hidden = false;
}

recIncForm.addEventListener("submit", e => {
  e.preventDefault();
  const f = recIncForm.elements;
  const data = {
    title: f.title.value.trim(),
    supplier: f.supplier.value.trim(),
    amount: Number(f.amount.value) || 0,
    interval: f.interval.value,
    nextOn: f.nextOn.value,
    endOn: f.endOn.value || null,
    period: f.period.value.trim() || undefined,
    note: f.note.value.trim()
  };
  if (data.endOn && data.endOn < data.nextOn) { alert("Datum „Účtovat do“ je dřív než příští zaúčtování."); return; }
  
  if (f.id.value) {
    const r = store.recurringIncomes.find(x => x.id === f.id.value);
    Object.assign(r, data);
    r.active = true;
  } else {
    data.id = uid();
    data.active = true;
    store.recurringIncomes.push(data);
  }
  saveStore(); renderRecurringIncomes(); recIncModal.hidden = true;
  if (generateDueRecurringExpensesAndIncomes()) { saveStore(); renderIncomes(); renderDashboard(); renderRecurringIncomes(); }
});

document.addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  
  // Expenses
  const reId = b.dataset.recexpEdit || b.dataset.recexpDel || b.dataset.recexpToggle;
  if (reId) {
    const r = store.recurringExpenses.find(x => x.id === reId);
    if (!r) return;
    if (b.dataset.recexpEdit) openRecExpModal(r);
    if (b.dataset.recexpDel && confirm("Opravdu smazat pravidelný výdaj? Už vytvořené výdaje zůstanou.")) {
      store.recurringExpenses = store.recurringExpenses.filter(x => x.id !== reId);
      saveStore(); renderRecurringExpenses();
    }
    if (b.dataset.recexpToggle) {
      r.active = !r.active;
      if (r.active) { const today = todayISO(); let g = 0; while (r.nextOn <= today && g++ < 120) r.nextOn = nextRecDate(r.nextOn, r.interval); }
      saveStore(); renderRecurringExpenses();
    }
  }

  // Incomes
  const riId = b.dataset.recincEdit || b.dataset.recincDel || b.dataset.recincToggle;
  if (riId) {
    const r = store.recurringIncomes.find(x => x.id === riId);
    if (!r) return;
    if (b.dataset.recincEdit) openRecIncModal(r);
    if (b.dataset.recincDel && confirm("Opravdu smazat pravidelný příjem? Už vytvořené příjmy zůstanou.")) {
      store.recurringIncomes = store.recurringIncomes.filter(x => x.id !== riId);
      saveStore(); renderRecurringIncomes();
    }
    if (b.dataset.recincToggle) {
      r.active = !r.active;
      if (r.active) { const today = todayISO(); let g = 0; while (r.nextOn <= today && g++ < 120) r.nextOn = nextRecDate(r.nextOn, r.interval); }
      saveStore(); renderRecurringIncomes();
    }
  }
});

/* ---------------- Start ---------------- */
renderSupplierSelect();
fillSettingsForm();
renderBank();
renderClients();
/* vystavit pravidelné faktury, kterým nastal termín */
const autoCreated = generateDueRecurring();
if (generateDueRecurringExpensesAndIncomes()) saveStore();
renderInvoices();
renderRecurring();
renderRecurringExpenses();
renderRecurringIncomes();
renderQuotes();
if (autoCreated.length) showRecurringBanner(autoCreated);
renderReports();
renderExpenses();
renderIncomes();
renderWarehouse();
initFiles();

/* ikony do statických prvků s data-icon */
document.querySelectorAll("[data-icon]").forEach(el => el.insertAdjacentHTML("afterbegin", icon(el.dataset.icon) + " "));

/* =====================================================================
   AUTOMATICKÉ ULOŽENÍ A SYNCHRONIZACE SOUBORŮ
   ===================================================================== */
async function linkAndSyncInvoices() {
  if (!serverMode) return;
  const files = await apiJson("/api/files");
  if (!files || files.error) return;
  
  let storeChanged = false;
  
  // 1. Zpětné a FORCE propojení (opraví rozbité vazby na staré naskenované PDF od Woltu atd.)
  for (const inv of store.invoices) {
    const safeNum = String(inv.number).trim();
    
    // Přísnější match: buď přesné jméno souboru, nebo přesný AI štítek
    const match = files.find(f => {
      if (f.name === `${safeNum}.pdf` || f.name === `faktura-${safeNum}.pdf` || f.name === `dobropis-${safeNum}.pdf` || f.name === `zalohovka-${safeNum}.pdf`) return true;
      if (f.name.startsWith(`${safeNum}_`) && f.name.endsWith(`.pdf`)) return true; // např. 6_2.pdf
      if (f.ai && (f.ai.includes(`Vydaná faktura ${safeNum} `) || f.ai.includes(`Přijatá faktura ${safeNum} `))) return true;
      return false;
    });
    
    if (match) {
      // Pokud jsme našli PŘESNOU shodu, propojíme to (opraví chybná propojení)
      if (inv.fileId !== match.id) {
        inv.fileId = match.id;
        storeChanged = true;
      }
    } else if (!inv.fileId && inv.status !== 'draft' && inv.status !== 'deleted') {
      // Pokud nemáme vůbec nic, vygenerujeme PDF ze šablony (koncepty a koš přeskočit)
      const r = await autoSavePdf(inv, 'invoice');
      if (r && r.id) {
        inv.fileId = r.id;
        storeChanged = true;
        files.push(r);
      }
    }
  }
  if (storeChanged) saveStore();
  
  // 2. Synchronizace kategorií
  let filesChanged = false;
  for (const inv of store.invoices) {
    if (!inv.fileId) continue;
    const file = files.find(f => f.id === inv.fileId);
    if (!file) continue;
    
    let expectedCategory;
    if (inv.status === 'deleted') expectedCategory = 'Koš';
    else if (inv.status === 'cancelled') expectedCategory = 'Faktury/Stornované';
    else if (inv.docType === 'creditNote') expectedCategory = 'Faktury/Dobropisy';
    else if (inv.docType === 'proforma') expectedCategory = inv.paidOn ? 'Faktury/Uhrazené' : 'Faktury/Zálohovky';
    else expectedCategory = inv.paidOn ? 'Faktury/Uhrazené' : 'Faktury';
    
    if (file.category !== expectedCategory) {
      await FilesBackend.update(inv.fileId, { category: expectedCategory });
      file.category = expectedCategory;
      filesChanged = true;
    }
  }
  
  if (filesChanged || storeChanged) renderFiles();
}

linkAndSyncInvoices(); // spustit po načtení

async function autoSavePdf(doc, type, customShowStamp = null) {
  if (!serverMode || store.settings.disableAutoPdf) return null;
  try {
    let bodyHtml, category, prefix, statusClass = "";
    let css = "";
    try { const resp = await fetch("/style.css"); css = await resp.text(); } catch(e) {}
    
    if (type === 'invoice') {
      const showStamp = customShowStamp !== null ? customShowStamp : true;
      bodyHtml = invoicePaperHtml(doc, showStamp);
      
      const useSub = store.settings.useSubfolders !== false;
      if (useSub) {
        if (doc.status === 'cancelled') category = 'Faktury/Stornované';
        else if (doc.docType === 'creditNote') category = 'Faktury/Dobropisy';
        else if (doc.docType === 'proforma') category = doc.paidOn ? 'Faktury/Uhrazené' : 'Faktury/Zálohovky';
        else category = doc.paidOn ? 'Faktury/Uhrazené' : 'Faktury';
      } else {
        category = 'Faktury';
      }
      
      prefix = doc.docType === 'creditNote' ? 'dobropis-' : doc.docType === 'proforma' ? 'zalohovka-' : 'faktura-';
      
      if (doc.status === 'cancelled') statusClass = " status-cancelled";
      else if (doc.paidOn) statusClass = " status-paid";
      else if (doc.docType === 'creditNote') statusClass = " status-credit";
    } else if (type === 'quote') {
      bodyHtml = quotePaperHtml(doc);
      category = 'Ostatní';
      prefix = 'nabidka-';
    }
    
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@600;700;800&display=swap" rel="stylesheet">
      <style>${css}</style>
      <style>body { background: white; margin: 0; padding: 0; font-family: 'Inter', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }</style>
      </head><body><div id="invoice-paper"><div class="paper${statusClass}">${bodyHtml}</div></div></body></html>`;

    const r = await apiJson("/api/htmlpdf", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        html: fullHtml,
        landscape: false,
        name: `${prefix}${doc.number}.pdf`,
        category: category,
        replaceFileId: doc.fileId,
        ai: `Automaticky uloženo systémem`
      })
    });
    if (!r.error) renderFiles();
    return r;
  } catch (err) {
    console.error("Autosave PDF failed:", err);
    return null;
  }
}

/* otevření záložky přes URL, např. http://localhost:4321/#files */
const hashTab = location.hash.slice(1);
const hashBtn = hashTab && document.querySelector(`.tab-btn[data-tab="${hashTab}"]`);
if (hashBtn) hashBtn.click();
