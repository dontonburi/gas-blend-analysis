/* C Line gas log — app logic. Talks directly to Supabase; no build step. */

const $ = (s) => document.querySelector(s);
let sb;
try {
  if (typeof CONFIG === "undefined") throw new Error("config.js is missing or failed to load.");
  if (typeof supabase === "undefined") throw new Error("Supabase library did not load (check internet / ad blocker).");
  sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
} catch (err) {
  document.addEventListener("DOMContentLoaded", () => { $("#signin-error").textContent = err.message; });
}
const $$ = (s) => [...document.querySelectorAll(s)];
const G_PER_LB = 453.592;
const SHIFT_START = { 1: 7, 2: 15, 3: 23 };   // hour of day, local time

const D = { n2o: 0.116, n2: 0.0739 };            // lb per scf at 60F / 14.7 psia
const DEFAULT_RATIO_VOL = 0.85;                   // N2O fraction by volume when item ratio is blank
const DEFAULT_TARGET_G = 4.87;
const FILLER_SETPOINT = { C: 300, D: 250 };            // cans per minute at full speed                    // g gas per can when item target is blank
const PASSWORD_HASH = "b4b9c4c60e9dd10880a39f1825f1de018e23aea06e08b8d94aa336519d5fc088";
const normCode = (c) => (c || "").trim().toUpperCase().replace(/^([A-Z]{2}\d+).*$/, "$1");   // AD28-T, AG45-WIP -> AD28, AG45
let items = [];
let chart = null;

/* ---------- helpers ---------- */
function toast(msg, isError = false) {
  const t = $("#toast");
  t.textContent = msg; t.className = "toast" + (isError ? " error" : "");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.add("hidden"), 3500);
}
function fmt(n, d = 0) { return n == null || isNaN(n) ? "—" : Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }); }
function formData(form) {
  const o = {};
  new FormData(form).forEach((v, k) => { o[k] = v === "" ? null : (form.elements[k].type === "number" ? Number(v) : v); });
  return o;
}
function csv(rows, filename) {
  if (!rows.length) return toast("Nothing to export");
  const cols = Object.keys(rows[0]);
  const esc = (v) => v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
  const text = [cols.join(","), ...rows.map(r => cols.map(c => esc(r[c])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" })); a.download = filename; a.click();
}
async function fetchAll(table, order, asc = true) {
  const out = []; let from = 0;
  while (true) {
    const { data, error } = await sb.from(table).select("*").order(order, { ascending: asc }).range(from, from + 999);
    if (error) { toast(error.message, true); break; }
    out.push(...data); if (data.length < 1000) break; from += 1000;
  }
  return out;
}
function localDate(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

/* ---------- password gate ---------- */
async function sha256(s) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join(""); }
function showSignin() { $("#signin").classList.remove("hidden"); $("#app").classList.add("hidden"); }
async function showApp() {
  $("#signin").classList.add("hidden"); $("#app").classList.remove("hidden");
  await loadItems();
  navigate(location.hash.replace("#", "") || "dashboard");
}
const LOGO = (typeof CONFIG !== "undefined" && CONFIG.LOGO_URL) || "https://www.alamancefoods.com/wp-content/uploads/2026/09/cropped-alamance-favicon-new-270x270.png";
document.addEventListener("DOMContentLoaded", () => { $$("#logo-img, #logo-img-signin").forEach(i => i.src = LOGO); });
window.addEventListener("scroll", () => document.body.classList.toggle("scrolled", window.scrollY > 10), { passive: true });
async function boot() {
  if (!sb) return;
  if (sessionStorage.getItem("gaslog-ok") === "1") showApp(); else showSignin();
}
$("#signin-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (await sha256($("#password").value) === PASSWORD_HASH) { sessionStorage.setItem("gaslog-ok", "1"); $("#password").value = ""; showApp(); }
  else $("#signin-error").textContent = "Wrong password.";
});
$("#signout").addEventListener("click", () => { sessionStorage.removeItem("gaslog-ok"); showSignin(); });

/* ---------- navigation ---------- */
const loaders = { dashboard: loadDashboard, runs: loadRuns, readings: loadReadings, checks: loadChecks, items: renderItems, convert: renderConvert };
function navigate(page) {
  if (!loaders[page]) page = "dashboard";
  $$(".page").forEach(p => p.classList.add("hidden"));
  $(`#page-${page}`).classList.remove("hidden");
  $$(".site-nav a").forEach(a => a.classList.toggle("active", a.dataset.page === page));
  const sec = $(`#page-${page}`); sec.classList.remove("enter"); void sec.offsetWidth; sec.classList.add("enter");
  loaders[page]();
}
window.addEventListener("hashchange", () => navigate(location.hash.replace("#", "")));

/* ---------- items ---------- */
async function loadItems() { items = await fetchAll("items", "code"); }
function renderItems() {
  const tb = $("#items-table tbody"); tb.innerHTML = "";
  items.forEach(it => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${it.code}</td><td>${it.brand || ""}</td><td>${it.description || ""}</td><td class="num">${it.cans_per_case ?? ""}</td><td class="num">${it.n2o_lb_per_case ?? ""}</td><td class="num">${it.n2_lb_per_case ?? ""}</td><td class="num">${it.bom_gas_g_per_can ?? ""}</td>
      <td class="num">${it.n2o_ratio_vol != null ? (it.n2o_ratio_vol * 100).toFixed(1) + "%" : "<span class='empty'>default</span>"}</td>
      <td class="num">${it.target_gas_g != null ? it.target_gas_g : "<span class='empty'>default</span>"}</td>
      <td><button class="small" data-edit="${it.code}">Edit</button> <button class="small danger" data-del="${it.code}">Delete</button></td>`;
    tb.appendChild(tr);
  });
  tb.onclick = async (e) => {
    const code = e.target.dataset.edit || e.target.dataset.del; if (!code) return;
    const it = items.find(x => x.code === code);
    if (e.target.dataset.edit) { const f = $("#item-form"); Object.keys(it).forEach(k => { if (f.elements[k]) f.elements[k].value = it[k] ?? ""; }); f.scrollIntoView(); return; }
    if (!confirm(`Delete item ${code}?`)) return;
    const { error } = await sb.from("items").delete().eq("code", code);
    if (error) return toast(error.message, true);
    await loadItems(); renderItems(); toast("Item deleted");
  };
  const sel = $("#run-item"); sel.onchange = () => { const it = items.find(i => i.code === sel.value); if (it?.cans_per_case) $("#run-form").elements.cans_per_case.value = it.cans_per_case; }; sel.innerHTML = `<option value="">— not recorded —</option>` + items.map(i => `<option value="${i.code}">${i.code}${i.brand ? " — " + i.brand : ""}</option>`).join("");
}
$("#item-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const row = formData(e.target); row.code = normCode(row.code);
  $("#item-error").textContent = "";
  const { error } = await sb.from("items").upsert(row);
  if (error) { $("#item-error").textContent = "Could not save: " + error.message + (/brand/.test(error.message) ? " — run supabase/update_2026-09-11.sql in Supabase to add the brand column." : ""); return; }
  e.target.reset(); await loadItems(); renderItems(); toast(`Saved ${row.code}`);
});
$("#items-export").addEventListener("click", () => csv(items.map(i => ({ code: i.code, brand: i.brand, description: i.description, cans_per_case: i.cans_per_case, n2o_lb_per_case: i.n2o_lb_per_case, n2_lb_per_case: i.n2_lb_per_case, bom_gas_g_per_can: i.bom_gas_g_per_can, n2o_ratio_vol: i.n2o_ratio_vol, target_gas_g: i.target_gas_g })), "items.csv"));

/* ---------- production runs ---------- */
async function loadRuns() {
  renderItems();
  const rows = await fetchAll("production_runs", "run_date", false);
  const tb = $("#runs-table tbody"); tb.innerHTML = "";
  rows.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${r.line}</td><td>${r.run_date}</td><td>${r.shift}</td><td>${r.item_code || "<span class='empty'>—</span>"}</td><td class="num">${fmt(r.cases)}</td><td class="num">${r.cans_per_case}</td><td>${r.notes || ""}</td>
      <td><button class="small danger" data-del="${r.id}">Delete</button></td>`;
    tb.appendChild(tr);
  });
  tb.onclick = async (e) => {
    const id = e.target.dataset.del; if (!id || !confirm("Delete this run?")) return;
    const { error } = await sb.from("production_runs").delete().eq("id", id);
    if (error) return toast(error.message, true);
    loadRuns(); toast("Run deleted");
  };
  $("#runs-export").onclick = () => csv(rows, "production_runs.csv");
}
$("#run-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const row = formData(e.target); row.shift = Number(row.shift); if (row.item_code) row.item_code = normCode(row.item_code);
  const { error } = await sb.from("production_runs").insert(row);
  if (error) return toast(error.message, true);
  e.target.reset(); e.target.elements.cans_per_case.value = 12; loadRuns(); toast("Run saved");
});

/* ---------- meter readings ---------- */
function parseReadings(text, order = "n2o_first", line = "C") {
  const rows = [];
  text.split(/\r?\n/).forEach(line => {
    const parts = line.split(/[\t,;]/).map(s => s.trim().replace(/^"|"$/g, ""));
    if (parts.length < 3) return;
    const ts = new Date(parts[0]); let a = Number(parts[1]); let b = Number(parts[2]);
    if (isNaN(ts) || isNaN(a) || isNaN(b)) return;
    if (order === "n2_first") [a, b] = [b, a];
    rows.push({ line, ts: ts.toISOString(), n2o_scf: a, n2_scf: b });
  });
  return rows;
}
$("#readings-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const rows = parseReadings(e.target.elements.paste.value, e.target.elements.order.value, e.target.elements.line.value);
  if (!rows.length) return toast("No readings recognised in the pasted text", true);
  const seen = new Set(); const uniq = rows.filter(r => !seen.has(r.ts) && seen.add(r.ts));
  let ok = 0;
  for (let i = 0; i < uniq.length; i += 500) {
    const { error } = await sb.from("gas_readings").upsert(uniq.slice(i, i + 500), { onConflict: "line,ts", ignoreDuplicates: true });
    if (error) return toast(error.message, true);
    ok += Math.min(500, uniq.length - i);
    $("#readings-status").textContent = `Imported ${ok} of ${uniq.length}…`;
  }
  $("#readings-status").textContent = ""; e.target.elements.paste.value = ""; loadReadings(); toast(`Imported ${uniq.length} readings`);
});
function shiftOf(d) { // returns {date:'YYYY-MM-DD', shift}
  const h = d.getHours(); let date = new Date(d); let shift;
  if (h >= 7 && h < 15) shift = 1; else if (h >= 15 && h < 23) shift = 2; else { shift = 3; if (h < 7) date.setDate(date.getDate() - 1); }
  return { date: localDate(date), shift };
}
async function loadReadings() {
  const rows = await fetchAll("gas_readings", "ts");
  const byLine = {};
  rows.forEach(r => (byLine[r.line] = byLine[r.line] || []).push({ t: new Date(r.ts).getTime(), n2o: Number(r.n2o_scf), n2: Number(r.n2_scf) }));
  const groups = {};
  Object.entries(byLine).forEach(([line, pts]) => pts.forEach(p => { const k = shiftOf(new Date(p.t)); const key = `${line}|${k.date}|${k.shift}`; (groups[key] = groups[key] || { line, ...k, n: 0 }).n++; }));
  const tb = $("#readings-table tbody"); tb.innerHTML = "";
  Object.values(groups).sort((a, b) => b.date.localeCompare(a.date) || b.shift - a.shift || a.line.localeCompare(b.line)).forEach(g => {
    const pts = byLine[g.line];
    const [s, e] = shiftWindow(g.date, g.shift);
    const first = Math.max(s, pts[0].t), last = Math.min(e, pts[pts.length - 1].t);
    const a = interp(pts, first), b = interp(pts, last);
    const n2o = b.n2o - a.n2o, n2 = b.n2 - a.n2, pct = n2o + n2 > 0 ? n2o / (n2o + n2) * 100 : null;
    if (n2o + n2 < 50) return;   // idle shift (no meaningful gas flow) — not listed
    const full = first === s && last === e;
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${g.line}</td><td>${g.date}</td><td>${g.shift}</td><td>${new Date(first).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}–${new Date(last).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}${full ? "" : " (partial)"}</td>
      <td class="num">${fmt(g.n)}</td><td class="num n2o">${fmt(n2o)}</td><td class="num n2">${fmt(n2)}</td><td class="num n2o">${fmt(n2o * D.n2o)}</td><td class="num n2">${fmt(n2 * D.n2)}</td>
      <td>${pct == null ? "—" : `N₂O ${pct.toFixed(1)}% / ${(100 - pct).toFixed(1)}% N₂`}</td>`;
    tb.appendChild(tr);
  });
  $("#readings-export").onclick = () => csv(rows, "gas_readings.csv");
}

$("#filler-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const line = e.target.elements.line.value; const rows = [];
  e.target.elements.paste.value.split(/\r?\n/).forEach(l => {
    const p = l.split(/[\t,;]/).map(s => s.trim().replace(/^"|"$/g, "")); if (p.length < 2) return;
    const ts = new Date(p[0]); const nums = p.slice(1).map(Number).filter(n => !isNaN(n)); if (isNaN(ts) || !nums.length) return;
    rows.push({ line, ts: ts.toISOString(), cpm: nums.reduce((x, y) => x + y, 0) });
  });
  if (!rows.length) return toast("No filler readings recognised", true);
  for (let i = 0; i < rows.length; i += 500) { const { error } = await sb.from("filler_readings").upsert(rows.slice(i, i + 500), { onConflict: "line,ts", ignoreDuplicates: true }); if (error) return toast(error.message, true); }
  e.target.elements.paste.value = ""; toast(`Imported ${rows.length} filler readings to ${line} Line`);
});
$("#downtime-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const line = e.target.elements.line.value; const rows = [];
  e.target.elements.paste.value.split(/\r?\n/).forEach(l => {
    const p = l.split(/[\t,;]/).map(s => s.trim().replace(/^"|"$/g, "")); if (p.length < 2) return;
    const ts = new Date(p[0]); const nums = p.slice(1).map(Number).filter(n => !isNaN(n)); if (isNaN(ts) || !nums.length) return;
    rows.push({ line, ts: ts.toISOString(), downtime_mins: Math.min(...nums) });
  });
  if (!rows.length) return toast("No downtime readings recognised", true);
  for (let i = 0; i < rows.length; i += 500) { const { error } = await sb.from("filler_downtime").upsert(rows.slice(i, i + 500), { onConflict: "line,ts", ignoreDuplicates: true }); if (error) return toast(error.message, true); }
  e.target.elements.paste.value = ""; toast(`Imported ${rows.length} downtime readings to ${line} Line`);
});

/* ---------- gas weight checks ---------- */
async function loadChecks() {
  const rows = await fetchAll("gas_weight_checks", "check_date", false);
  const w = rows.map(r => Number(r.weight_g)).filter(x => !isNaN(x) && x > 0).sort((a, b) => a - b);
  const mean = w.reduce((a, b) => a + b, 0) / (w.length || 1), med = w.length ? w[Math.floor(w.length / 2)] : null;
  $("#checks-stats").innerHTML = `<span>Readings <b>${fmt(w.length)}</b></span><span>Mean <b>${fmt(mean, 2)} g</b></span><span>Median <b>${fmt(med, 2)} g</b></span><span>Min <b>${fmt(w[0], 1)} g</b></span><span>Max <b>${fmt(w[w.length - 1], 1)} g</b></span>`;
  $("#checks-export").onclick = () => csv(rows, "gas_weight_checks.csv");
}
$("#check-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const row = formData(e.target);
  if (row.weight_g == null && row.before_g != null && row.after_g != null) row.weight_g = Math.round((row.after_g - row.before_g) * 10) / 10;
  const { error } = await sb.from("gas_weight_checks").insert(row);
  if (error) return toast(error.message, true);
  const keep = ["check_date", "gasser", "check_time", "initials", "operator", "can_size"].map(k => [k, e.target.elements[k].value]);
  e.target.reset(); keep.forEach(([k, v]) => e.target.elements[k].value = v);
  e.target.elements.head.value = Math.min(18, (Number(row.head) || 0) + 1); e.target.elements.before_g.focus();
  loadChecks(); toast(`Saved head ${row.head}`);
});

/* ---------- dashboard ---------- */
function interp(readings, t) {
  // readings sorted by ts (ms). Linear interpolation of totalizers at time t. Returns null if outside coverage.
  if (!readings.length || t < readings[0].t || t > readings[readings.length - 1].t) return null;
  let lo = 0, hi = readings.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; (readings[m].t <= t ? lo = m : hi = m); }
  const a = readings[lo], b = readings[hi]; const f = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
  return { n2o: a.n2o + f * (b.n2o - a.n2o), n2: a.n2 + f * (b.n2 - a.n2) };
}
function shiftWindow(dateStr, shift) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const s = new Date(y, m - 1, d, SHIFT_START[shift]); const e = new Date(s.getTime() + 8 * 3600e3);
  return [s.getTime(), e.getTime()];
}
let dashRows = [], dashSort = { key: "date", dir: 1 };
function renderDashTable() {
  const fItem = $("#f-item").value.trim().toLowerCase(), fShift = $("#f-shift").value, fWf = parseFloat($("#f-wf").value), fEff = parseFloat($("#f-eff").value);
  let rows = dashRows.filter(r =>
    (!fItem || r.items.toLowerCase().includes(fItem) || r.itemRows.some(x => (x.brand || "").toLowerCase().includes(fItem))) &&
    (!fShift || String(r.shift) === fShift) &&
    (isNaN(fWf) || (r.wf != null && r.wf >= fWf)) &&
    (isNaN(fEff) || (r.eff != null && r.eff <= fEff)));
  const k = dashSort.key, d = dashSort.dir;
  rows = [...rows].sort((x, y) => { const a = x[k], b = y[k]; if (a == null && b == null) return 0; if (a == null) return 1; if (b == null) return -1;
    return (typeof a === "string" ? a.localeCompare(b) : a - b) * d || x.date.localeCompare(y.date) || x.shift - y.shift; });
  $$("#dash-table th[data-sort]").forEach(th => th.classList.toggle("asc", th.dataset.sort === k && d === 1) || th.classList.toggle("desc", th.dataset.sort === k && d === -1));
  $("#f-count").textContent = `${rows.length} of ${dashRows.length} shifts`;
  const tb = $("#dash-table tbody"); tb.innerHTML = "";
  const cell = (label, val) => `<div><span>${label}</span><b>${val}</b></div>`;
  rows.forEach((r) => {
    const tr = document.createElement("tr"); tr.className = "run";
    if (r.totalLb == null) { tr.classList.add("muted"); tr.innerHTML = `<td>${r.line}</td><td class="date">${r.date}</td><td>${r.shift}</td><td>${r.items}</td><td class="num">${fmt(r.cases)}</td><td class="num">${fmt(r.cans)}</td><td colspan="6">no meter data for this shift</td>`; }
    else tr.innerHTML = `<td>${r.line}</td><td class="date">${r.date}</td><td>${r.shift}</td><td>${r.items}</td><td class="num">${fmt(r.cases)}</td><td class="num">${fmt(r.cans)}</td>
      <td class="num">${fmt(r.totalLb)}</td><td class="num">${fmt(r.volPct, 1)}%</td><td class="num">${r.avgCpm == null ? "—" : fmt(r.avgCpm)}</td><td class="num">${r.eff == null ? "—" : fmt(r.eff) + "%"}</td><td class="num">${fmt(r.gPerCan, 1)}</td><td class="num waste">${fmt(r.wf, 2)}×</td>`;
    tb.appendChild(tr);
    const det = document.createElement("tr"); det.className = "detail hidden";
    const itemsTable = `<table class="mini"><thead><tr><th>Item</th><th>Brand</th><th class="num">Cases</th><th class="num">Cans/case</th><th class="num">Cans</th><th class="num">N₂O ratio</th></tr></thead><tbody>` +
      r.itemRows.map(x => `<tr><td>${x.code}</td><td>${x.brand || "—"}</td><td class="num">${fmt(x.cases)}</td><td class="num">${x.cpc}</td><td class="num">${fmt(x.cans)}</td><td class="num">${x.ratio != null ? (x.ratio * 100).toFixed(1) + "%" : "default"}</td></tr>`).join("") +
      (r.itemRows.length > 1 ? `<tr class="total"><td>Total</td><td></td><td class="num">${fmt(r.cases)}</td><td></td><td class="num">${fmt(r.cans)}</td><td></td></tr>` : "") + `</tbody></table>`;
    const gasTable = r.totalLb == null ? "—" : `<table class="mini"><thead><tr><th>Gas</th><th class="num">scf</th><th class="num">lb</th><th class="num">% by vol</th></tr></thead><tbody>
      <tr><td class="n2o">N₂O</td><td class="num">${fmt(r.n2oScf)}</td><td class="num">${fmt(r.n2oLb)}</td><td class="num">${fmt(r.volPct, 1)}%</td></tr>
      <tr><td class="n2">N₂</td><td class="num">${fmt(r.n2Scf)}</td><td class="num">${fmt(r.n2Lb)}</td><td class="num">${fmt(100 - r.volPct, 1)}%</td></tr>
      <tr class="total"><td>Total</td><td class="num">${fmt(r.n2oScf + r.n2Scf)}</td><td class="num">${fmt(r.totalLb)}</td><td></td></tr></tbody></table>`;
    const wasteRow = (label, tgt) => tgt ? `<tr><td>${label}</td><td class="num">${fmt(tgt)}</td><td class="num">${r.totalLb == null ? "—" : fmt(r.totalLb - tgt)}</td><td class="num">${r.totalLb == null ? "—" : fmt((r.totalLb - tgt) / tgt * 100) + "%"}</td><td class="num waste">${r.totalLb == null ? "—" : fmt(r.totalLb / tgt, 2) + "×"}</td></tr>` : "";
    const wasteTable = `<table class="mini"><thead><tr><th>Basis</th><th class="num">Target lb</th><th class="num">Over target lb</th><th class="num">Waste %</th><th class="num">Factor</th></tr></thead><tbody>` +
      wasteRow(`${DEFAULT_TARGET_G} g/can`, r.targetLb) + wasteRow("BOM standard", r.bomLb) + `</tbody></table>`;
    const kv = (label, val) => `<div class="kv"><span>${label}</span><div>${val}</div></div>`;
    det.innerHTML = `<td colspan="12"><div class="detail">
      <div class="detail-tables">
        <section><h4>Items</h4>${itemsTable}</section>
        <div class="detail-pair">
          <section><h4>Gas metered</h4>${gasTable}</section>
          <section><h4>Target &amp; waste</h4>${wasteTable}</section>
        </div>
      </div>
      <div class="detail-stats">
        ${kv("Window", `${r.hours.toFixed(1)} h${r.hours < 7.9 ? " · partial meter coverage" : ""}`)}
        ${kv("Rates", r.totalLb == null ? "—" : `${fmt(r.lbHr)} lb/hr gas<br>${fmt(r.casesHr)} cases/hr`)}
        ${kv("Efficiency", `<b>${fmt(r.eff)}%</b> — ${fmt(r.cans)} cans ÷ ${fmt(r.capacityCans)} capacity<br><small>${FILLER_SETPOINT[r.line]} cpm × ${r.hours.toFixed(1)} h</small>`)}
        ${kv("Filler", r.avgCpm == null ? "no filler data" : `${fmt(r.avgCpm)} cpm average (${fmt(r.avgCpm / FILLER_SETPOINT[r.line] * 100)}% of setpoint)<br><small>≈ ${fmt(r.fillerCans)} cans by filler vs ${fmt(r.cans)} from cases</small>`)}
        ${kv("Downtime", r.pctDown == null ? "no downtime data" : `down ${fmt(r.pctDown)}% of shift<br><small>longest stop ${fmt(r.longestStop)} min</small>`)}
        ${r.notes ? kv("Notes", r.notes) : ""}
      </div>
    </div></td>`;
    tb.appendChild(det);
  });
  tb.onclick = (e) => { const tr = e.target.closest("tr.run"); if (tr) tr.nextElementSibling.classList.toggle("hidden"); };
}
["#f-item", "#f-shift", "#f-wf", "#f-eff"].forEach(id => $(id).addEventListener("input", renderDashTable));
$("#f-clear").addEventListener("click", () => { ["#f-item", "#f-wf", "#f-eff"].forEach(id => $(id).value = ""); $("#f-shift").value = ""; renderDashTable(); });
$("#dash-table thead").addEventListener("click", (e) => { const th = e.target.closest("th[data-sort]"); if (!th) return;
  dashSort = th.dataset.sort === dashSort.key ? { key: dashSort.key, dir: -dashSort.dir } : { key: th.dataset.sort, dir: th.dataset.sort === "wf" || th.dataset.sort === "gPerCan" ? -1 : 1 }; renderDashTable(); });

async function loadDashboard() {
  const from = $("#dash-from"), to = $("#dash-to");
  if (!from.value) { const t = new Date(); to.value = localDate(t); t.setDate(t.getDate() - 30); from.value = localDate(t); }
  const lineSel = $("#dash-line").value; const lines = lineSel === "ALL" ? ["C", "D"] : [lineSel];
  const [runs, raw, fillerRaw, downRaw] = await Promise.all([
    sb.from("production_runs").select("*").in("line", lines).gte("run_date", from.value).lte("run_date", to.value).order("run_date").order("shift").then(r => r.data || []),
    fetchAll("gas_readings", "ts"),
    fetchAll("filler_readings", "ts").catch(() => []),
    fetchAll("filler_downtime", "ts").catch(() => []),
  ]);
  const readingsBy = {}, fillerBy = {}, downBy = {};
  downRaw.forEach(r => (downBy[r.line] = downBy[r.line] || []).push({ t: new Date(r.ts).getTime(), m: Number(r.downtime_mins) }));
  raw.forEach(r => (readingsBy[r.line] = readingsBy[r.line] || []).push({ t: new Date(r.ts).getTime(), n2o: Number(r.n2o_scf), n2: Number(r.n2_scf) }));
  fillerRaw.forEach(r => (fillerBy[r.line] = fillerBy[r.line] || []).push({ t: new Date(r.ts).getTime(), cpm: Number(r.cpm) }));
  const dN2O = D.n2o, dN2 = D.n2, defTarget = DEFAULT_TARGET_G;

  const groups = {};
  runs.forEach(r => { const k = `${r.line}|${r.run_date}|${r.shift}`; (groups[k] = groups[k] || { line: r.line, date: r.run_date, shift: r.shift, runs: [] }).runs.push(r); });
  const out = [];
  Object.values(groups).sort((a, b) => a.date.localeCompare(b.date) || a.shift - b.shift || a.line.localeCompare(b.line)).forEach(g => {
    const readings = readingsBy[g.line] || [];
    const [s, e] = shiftWindow(g.date, g.shift);
    const last = readings.length ? readings[readings.length - 1].t : 0;
    const eUse = (e > last && e - last <= 15 * 60e3) ? last : e;
    const a = interp(readings, s), b = interp(readings, eUse);
    let cans = 0, targetLb = 0, bomLb = 0;
    const itemRows = g.runs.map(r => {
      const it = items.find(i => i.code === r.item_code) || {};
      const n = r.cases * (r.cans_per_case || 12); cans += n;
      targetLb += n * (it.target_gas_g ?? defTarget) / G_PER_LB;
      if (it.bom_gas_g_per_can) bomLb += n * it.bom_gas_g_per_can / G_PER_LB;
      return { code: r.item_code || "—", brand: it.brand || "", cases: r.cases, cpc: r.cans_per_case || 12, cans: n, ratio: it.n2o_ratio_vol };
    });
    const cases = g.runs.reduce((x, r) => x + r.cases, 0);
    const hours = (eUse - s) / 3600e3;
    const fill = (fillerBy[g.line] || []).filter(p => p.t >= s && p.t < e).map(p => p.cpm);
    const avgCpm = fill.length ? fill.reduce((x, y) => x + y, 0) / fill.length : null;
    const pctRunning = fill.length ? fill.filter(c => c > 20).length / fill.length * 100 : null;
    const capacityCans = FILLER_SETPOINT[g.line] * 60 * hours;               // cans the filler could make at setpoint over the window
    const eff = cans && hours ? cans / capacityCans * 100 : null;              // efficiency = cans produced ÷ setpoint capacity
    const dn = (downBy[g.line] || []).filter(p => p.t >= s && p.t < e).map(p => p.m);
    const pctDown = dn.length ? dn.filter(m => m > 5).length / dn.length * 100 : null;
    const longestStop = dn.length ? Math.max(...dn) : null;
    const row = { line: g.line, date: g.date, shift: g.shift, cases, cans, targetLb, bomLb, itemRows, hours, avgCpm, pctRunning, eff, capacityCans, pctDown, longestStop,
      items: [...new Set(itemRows.map(i => i.code))].join(" + "), fillerCans: avgCpm != null ? avgCpm * 60 * hours : null,
      notes: g.runs.map(r => r.notes).filter(Boolean).join("; ") };
    if (a && b) {
      row.n2oScf = b.n2o - a.n2o; row.n2Scf = b.n2 - a.n2;
      row.n2oLb = row.n2oScf * dN2O; row.n2Lb = row.n2Scf * dN2; row.totalLb = row.n2oLb + row.n2Lb;
      row.volPct = row.n2oScf / (row.n2oScf + row.n2Scf) * 100;
      row.gPerCan = cans ? row.totalLb * G_PER_LB / cans : null;
      row.wf = targetLb ? row.totalLb / targetLb : null; row.wastePct = targetLb ? (row.totalLb - targetLb) / targetLb * 100 : null;
      row.wfBom = bomLb ? row.totalLb / bomLb : null; row.lbHr = row.totalLb / hours; row.casesHr = cases / hours;
    }
    out.push(row);
  });

  dashRows = out; renderDashTable();


  const have = out.filter(r => r.totalLb != null);
  const summ = lines.map(L => { const h = have.filter(r => r.line === L); if (!h.length) return null;
    const T = h.reduce((a, r) => ({ lb: a.lb + r.totalLb, tgt: a.tgt + r.targetLb, cans: a.cans + r.cans, cases: a.cases + r.cases }), { lb: 0, tgt: 0, cans: 0, cases: 0 });
    return `<b>${L} Line</b>: ${h.length} shifts, ${fmt(T.cases)} cases, ${fmt(T.lb)} lb metered vs ${fmt(T.tgt)} lb target — <b>${(T.lb / T.tgt).toFixed(2)}×</b>, ${fmt(T.lb * G_PER_LB / T.cans, 1)} g/can`; }).filter(Boolean);
  $("#dash-summary").innerHTML = summ.length ? summ.join("<br>") : "No shifts with both production and meter data in this range.";

  if (chart) chart.destroy();
  const colors = { C: "#014583", D: "#8ae5ff" }, cpmColors = { C: "#c27a12", D: "#031b27" };   // brand palette: C primary blue, D sky blue; CPM lines orange / navy
  const bars = lines.map(L => ({ type: "bar", label: `${L} Line waste factor`, data: have.map(r => r.line === L ? r.wf : null), backgroundColor: colors[L], yAxisID: "y", order: 2, skipNull: true }));
  const showCpm = $("#dash-cpm").checked;
  const cpmLines = showCpm ? lines.map(L => ({ type: "line", label: `${L} Line avg CPM`, data: have.map(r => r.line === L ? r.avgCpm : null), borderColor: cpmColors[L], backgroundColor: cpmColors[L], pointBackgroundColor: "#fff", pointBorderColor: cpmColors[L], pointBorderWidth: 2, pointRadius: 4, borderWidth: 2, borderDash: [6, 4], spanGaps: true, yAxisID: "y2", order: 1 })) : [];
  chart = new Chart($("#chart-waste"), {
    data: { labels: have.map(r => `${r.date.slice(5)} S${r.shift}`), datasets: [...bars, ...cpmLines] },
    options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
      plugins: { legend: { display: true }, tooltip: { callbacks: { afterBody: (c) => { const r = have[c[0].dataIndex]; return `${r.items} · ${fmt(r.cases)} cases`; } } } },
      scales: { x: { stacked: true },
        y: { beginAtZero: true, position: "left", title: { display: true, text: "waste factor (× target)" } },
        y2: { display: showCpm, beginAtZero: true, position: "right", grid: { drawOnChartArea: false }, title: { display: true, text: "filler cans / min" } } } }
  });
  $("#dash-export").onclick = () => csv(out.map(r => ({ line: r.line, date: r.date, shift: r.shift, items: r.items, cases: r.cases, cans: r.cans, hours: r.hours, n2o_scf: r.n2oScf, n2_scf: r.n2Scf, n2o_lb: r.n2oLb, n2_lb: r.n2Lb, total_lb: r.totalLb, n2o_pct_vol: r.volPct, avg_cpm: r.avgCpm, efficiency_pct_cans_vs_capacity: r.eff, capacity_cans: r.capacityCans, pct_shift_filler_down: r.pctDown, longest_stop_min: r.longestStop, target_lb: r.targetLb, bom_target_lb: r.bomLb, g_per_can: r.gPerCan, waste_factor: r.wf, waste_factor_vs_bom: r.wfBom, waste_pct: r.wastePct, notes: r.notes })), "consumption_by_shift.csv");
}
$("#dash-refresh").addEventListener("click", loadDashboard);
$("#dash-line").addEventListener("change", loadDashboard);
$("#dash-cpm").addEventListener("change", loadDashboard);

/* ---------- conversions ---------- */
function renderConvert() {
  const f = $("#conv-form"); const tb = $("#conv-out tbody");
  const run = () => {
    const gas = f.elements.gas.value, unit = f.elements.unit.value, amt = Number(f.elements.amount.value) || 0, r = Math.min(1, Math.max(0, Number(f.elements.ratio.value) / 100));
    f.elements.ratio.disabled = gas !== "blend";
    const line = (name, scf, lbPerScf, cls = "") => { const lb = scf * lbPerScf; return `<tr><td class="${cls}">${name}</td><td class="num">${fmt(scf, 1)}</td><td class="num">${fmt(lb, 2)}</td><td class="num">${fmt(lb * G_PER_LB, 0)}</td><td class="num">${fmt(lb * G_PER_LB / 1000, 3)}</td></tr>`; };
    const toScf = (a, u, d) => u === "scf" ? a : u === "lb" ? a / d : u === "g" ? a / G_PER_LB / d : a * 1000 / G_PER_LB / d;
    let html = "";
    if (gas === "n2o") html = line("N₂O", toScf(amt, unit, D.n2o), D.n2o, "n2o");
    else if (gas === "n2") html = line("N₂", toScf(amt, unit, D.n2), D.n2, "n2");
    else {
      const dBlend = r * D.n2o + (1 - r) * D.n2;               // lb per scf of blend
      const scfTot = toScf(amt, unit, dBlend);
      html = line("Blend total", scfTot, dBlend) + line(`N₂O (${(r * 100).toFixed(1)}% vol)`, scfTot * r, D.n2o, "n2o") + line(`N₂ (${((1 - r) * 100).toFixed(1)}% vol)`, scfTot * (1 - r), D.n2, "n2");
      const mN2O = r * D.n2o / dBlend * 100;
      html += `<tr class="muted"><td colspan="5">By mass this blend is ${mN2O.toFixed(1)}% N₂O / ${(100 - mN2O).toFixed(1)}% N₂ — ${fmt(dBlend, 4)} lb per scf</td></tr>`;
    }
    tb.innerHTML = html;
  };
  f.oninput = run; run();
}

boot();
