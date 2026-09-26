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
const GUEST_HASH = "84983c60f7daadc1cb8698621f802c0d9f9a3c3c295c810748fb048115c186ec";
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
const ADMIN_PAGES = ["runs", "readings", "checks"];
function role() { return sessionStorage.getItem("gaslog-role"); }
function applyRole() { const guest = role() === "guest"; document.body.classList.toggle("guest", guest); $("#signout").textContent = guest ? "Sign out (guest)" : "Sign out"; }
async function boot() {
  if (!sb) return;
  if (role()) { applyRole(); showApp(); } else showSignin();
}
$("#signin-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const hsh = await sha256($("#password").value);
  if (hsh === PASSWORD_HASH) sessionStorage.setItem("gaslog-role", "admin"); else if (hsh === GUEST_HASH) sessionStorage.setItem("gaslog-role", "guest");
  else { $("#signin-error").textContent = "Wrong password."; return; }
  $("#password").value = ""; applyRole(); showApp();
});
$("#signout").addEventListener("click", () => { sessionStorage.removeItem("gaslog-role"); document.body.classList.remove("guest"); showSignin(); });

/* ---------- navigation ---------- */
const loaders = { analysis: loadAnalysis, dashboard: loadDashboard, runs: loadRuns, readings: loadReadings, checks: loadChecks, items: renderItems, convert: renderConvert };
function navigate(page) {
  if (!loaders[page]) page = "dashboard";
  if (role() === "guest" && ADMIN_PAGES.includes(page)) page = "dashboard";
  $$(".page").forEach(p => p.classList.add("hidden"));
  $(`#page-${page}`).classList.remove("hidden");
  $$(".site-nav a").forEach(a => a.classList.toggle("active", a.dataset.page === page));
  const sec = $(`#page-${page}`); sec.classList.remove("enter"); void sec.offsetWidth; sec.classList.add("enter");
  $$(`#page-${page} .reveal`).forEach(el => el.classList.remove("in")); setTimeout(revealNow, 60);
  loaders[page]();
}
window.addEventListener("hashchange", () => { const hsh = location.hash.replace("#", ""); if (!hsh.startsWith("an-sec-")) navigate(hsh); });

/* ---------- items ---------- */
async function loadItems() { items = await fetchAll("items", "code"); }
let itemSort = { key: "code", dir: 1 };
function itemCalc(it) {
  const c = it.cans_per_case || 12, o = Number(it.n2o_lb_per_case) || 0, n = Number(it.n2_lb_per_case) || 0;
  return { n2oG: it.n2o_lb_per_case != null ? o * G_PER_LB / c : null, n2G: it.n2_lb_per_case != null ? n * G_PER_LB / c : null, totG: (it.n2o_lb_per_case != null || it.n2_lb_per_case != null) ? (o + n) * G_PER_LB / c : null, massR: (o + n) > 0 ? o / (o + n) : null };
}
function renderItems() {
  const brands = [...new Set(items.map(i => i.brand).filter(Boolean))].sort();
  const bsel = $("#items-brand"); const cur = bsel.value; bsel.innerHTML = `<option value="">All brands</option>` + brands.map(b => `<option value="${b}"${b === cur ? " selected" : ""}>${b}</option>`).join("");
  const k = itemSort.key, d = itemSort.dir;
  const rows = items.map(it => ({ ...it, ...itemCalc(it) })).filter(it => !cur || it.brand === cur)
    .sort((x, y) => { const a = x[k], b = y[k]; if (a == null && b == null) return 0; if (a == null) return 1; if (b == null) return -1; return (typeof a === "string" ? a.localeCompare(b) : a - b) * d || x.code.localeCompare(y.code); });
  $$("#items-table th[data-sort]").forEach(th => { th.classList.toggle("asc", th.dataset.sort === k && d === 1); th.classList.toggle("desc", th.dataset.sort === k && d === -1); });
  const tb = $("#items-table tbody"); tb.innerHTML = "";
  const flag = (v) => v == null ? "<span class='empty'>—</span>" : v;
  rows.forEach(it => {
    const tr = document.createElement("tr");
    const ratioMismatch = it.n2o_ratio_vol != null && it.massR != null && Math.abs(it.n2o_ratio_vol - it.massR) < 0.02;
    tr.innerHTML = `<td><b title="${(it.notes || "").replace(/"/g, "&quot;")}">${it.code}</b>${it.gas_blend === false ? " <small class='empty'>non-gas</small>" : ""}${it.notes ? " <span class='note-dot' title='" + it.notes.replace(/'/g, "&#39;") + "'>●</span>" : ""}</td><td><span class="chip chip-${(it.brand || "").replace(/[^a-z]/gi, "").toLowerCase()}">${it.brand || "—"}</span></td><td>${it.description || "<span class='empty'>—</span>"}</td><td class="num">${flag(it.cans_per_case)}</td>
      <td class="num grp">${it.n2o_lb_per_case != null ? Number(it.n2o_lb_per_case).toFixed(4) : flag(null)}</td><td class="num">${it.n2_lb_per_case != null ? Number(it.n2_lb_per_case).toFixed(4) : flag(null)}</td>
      <td class="num grp n2o">${it.n2oG != null ? it.n2oG.toFixed(2) : flag(null)}</td><td class="num n2">${it.n2G != null ? it.n2G.toFixed(2) : flag(null)}</td><td class="num"><b>${it.totG != null ? it.totG.toFixed(2) : flag(null)}</b></td>
      <td class="num grp">${it.n2o_ratio_vol != null ? (it.n2o_ratio_vol * 100).toFixed(1) + "%" : "<span class='empty'>default</span>"}</td><td class="num ${ratioMismatch ? "warn" : ""}" title="${ratioMismatch ? "BOM split equals the volume ratio numerically: BOM likely written by mass" : ""}">${it.massR != null ? (it.massR * 100).toFixed(1) + "%" : flag(null)}</td>
      <td class="actions"><button class="small" data-edit="${it.code}">Edit</button><button class="small danger" data-del="${it.code}">Delete</button></td>`;
    tb.appendChild(tr);
  });
  tb.onclick = async (e) => {
    if (role() === "guest") return;
    const code = e.target.dataset.edit || e.target.dataset.del; if (!code) return;
    const it = items.find(x => x.code === code);
    if (e.target.dataset.edit) { const f = $("#item-form"); f.classList.remove("hidden"); Object.keys(it).forEach(k => { if (f.elements[k]) f.elements[k].value = it[k] ?? ""; }); f.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    if (!confirm(`Delete item ${code}?`)) return;
    const { error } = await sb.from("items").delete().eq("code", code);
    if (error) return toast(error.message, true);
    await loadItems(); renderItems(); toast("Item deleted");
  };
  const sel = $("#run-item"); sel.onchange = () => { const it = items.find(i => i.code === sel.value); if (it?.cans_per_case) $("#run-form").elements.cans_per_case.value = it.cans_per_case; }; sel.innerHTML = `<option value="">— not recorded —</option>` + items.map(i => `<option value="${i.code}">${i.code}${i.brand ? " — " + i.brand : ""}${i.gas_blend === false ? " (non-gas)" : ""}</option>`).join("");
}
$("#items-brand").addEventListener("change", renderItems);
$("#items-add").addEventListener("click", () => { const f = $("#item-form"); f.reset(); f.classList.remove("hidden"); f.elements.code.focus(); });
$("#item-cancel").addEventListener("click", () => { const f = $("#item-form"); f.reset(); f.classList.add("hidden"); $("#item-error").textContent = ""; });
$("#items-table thead").addEventListener("click", (e) => { const th = e.target.closest("th[data-sort]"); if (!th) return; itemSort = th.dataset.sort === itemSort.key ? { key: itemSort.key, dir: -itemSort.dir } : { key: th.dataset.sort, dir: 1 }; renderItems(); });
$("#items-export").addEventListener("click", () => csv(items.map(i => { const c = itemCalc(i); return { code: i.code, brand: i.brand, description: i.description, cans_per_case: i.cans_per_case, n2o_lb_per_case: i.n2o_lb_per_case, n2_lb_per_case: i.n2_lb_per_case, n2o_g_per_can: c.n2oG, n2_g_per_can: c.n2G, total_g_per_can: c.totG, n2o_ratio_vol: i.n2o_ratio_vol, bom_split_mass: c.massR, target_gas_g: i.target_gas_g, notes: i.notes }; }), "items.csv"));

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
function checkShift(c) { // shift from check time; 00:00-06:59 belongs to the previous day's shift 3
  const hr = c.check_time ? parseInt(String(c.check_time).split(":")[0], 10) : NaN; if (isNaN(hr)) return null;
  let d = c.check_date, sh = hr >= 7 && hr < 15 ? 1 : hr >= 15 && hr < 23 ? 2 : 3;
  if (hr < 7) { const t = new Date(d + "T12:00:00"); t.setDate(t.getDate() - 1); d = localDate(t); }
  return { date: d, shift: sh };
}
async function loadChecks() {
  const [rows, runs, enactRows] = await Promise.all([fetchAll("gas_weight_checks", "check_date", false), fetchAll("production_runs", "run_date"), fetchAll("enact_kpi", "summary_date", false).catch(() => [])]);
  $("#enact-status").textContent = enactRows.length ? `— ${enactRows.length} shift/day summaries received` : "— nothing received yet; the receiver adds rows here automatically after each shift";
  $("#enact-table tbody").innerHTML = enactRows.slice(0, 200).map(k => `<tr><td class="date">${localDate(new Date(k.summary_date))}</td><td>${k.shift_name || "day"}</td><td>${k.process_leaf || k.process_name}</td><td>${k.part_name}</td><td>${k.feature_name}</td><td class="num">${fmt(k.subgroup_count)}</td><td class="num">${fmt(k.piece_count)}</td><td class="num"><b>${fmt(k.mean, 2)}</b></td><td class="num">${fmt(k.sd_long_term, 2)}</td><td class="num">${fmt(k.oos_count)}</td><td>${new Date(k.received_at).toLocaleDateString()}</td></tr>`).join("") || `<tr><td colspan="11" class="empty">No Enact data yet.</td></tr>`;
  const w = rows.map(r => Number(r.weight_g)).filter(x => !isNaN(x) && x > 0).sort((a, b) => a - b);
  const mean = w.reduce((a, b) => a + b, 0) / (w.length || 1), med = w.length ? w[Math.floor(w.length / 2)] : null;
  $("#checks-stats").innerHTML = `<span>Readings <b>${fmt(w.length)}</b></span><span>Mean <b>${fmt(mean, 2)} g</b></span><span>Median <b>${fmt(med, 2)} g</b></span><span>Min <b>${fmt(w[0], 1)} g</b></span><span>Max <b>${fmt(w[w.length - 1], 1)} g</b></span>`;
  // group by line / date / shift
  const groups = {};
  rows.forEach(c => {
    const s = checkShift(c); if (!s) return;
    const k = `${c.line || "C"}|${s.date}|${s.shift}`;
    const g = groups[k] = groups[k] || { line: c.line || "C", date: s.date, shift: s.shift, weights: [], gassers: new Set(), times: new Set(), initials: new Set(), corr: 0 };
    const wt = Number(c.weight_g); if (wt > 0) g.weights.push(wt);
    g.gassers.add(c.gasser); if (c.check_time) g.times.add(c.check_time); if (c.initials) g.initials.add(c.initials); if (c.correction_g != null && c.correction_g !== "") g.corr++;
  });
  const runsFor = (line, date, shift) => runs.filter(r => r.line === line && r.run_date === date && r.shift === shift && r.item_code);
  const itemsFor = (line, date, shift) => [...new Set(runsFor(line, date, shift).map(r => r.item_code))].join(" + ") || "<span class='empty'>no run logged</span>";
  const bomFor = (line, date, shift) => { // can-weighted BOM g/can across the items run that shift
    let cans = 0, g = 0; runsFor(line, date, shift).forEach(r => { const it = items.find(i => i.code === r.item_code); if (it?.bom_gas_g_per_can) { const n = r.cases * (r.cans_per_case || 12); cans += n; g += n * it.bom_gas_g_per_can; } });
    return cans ? g / cans : null; };
  // item for each group: explicit item_code on the readings if present, else the biggest run that shift
  Object.values(groups).forEach(g => { const explicit = rows.find(c => c.item_code && `${c.line || "C"}|${checkShift(c)?.date}|${checkShift(c)?.shift}` === `${g.line}|${g.date}|${g.shift}`); g.item = explicit ? explicit.item_code : (runsFor(g.line, g.date, g.shift).sort((x, y) => y.cases - x.cases)[0]?.item_code || null); });
  const byItem = {};
  Object.values(groups).forEach(g => { const k = g.item || "(no run logged)"; const o = byItem[k] = byItem[k] || { item: k, weights: [], shifts: 0, lines: new Set(), dates: new Set() }; o.weights.push(...g.weights); o.shifts++; o.lines.add(g.line); o.dates.add(g.date); });
  const itemStats = Object.values(byItem).map(o => { const w = [...o.weights].sort((x, y) => x - y), n = w.length, m = n ? w.reduce((x, y) => x + y, 0) / n : 0, sd = n ? Math.sqrt(w.reduce((x, y) => x + (y - m) ** 2, 0) / n) : 0; const it = items.find(i => i.code === o.item) || {}; const ds = [...o.dates].sort();
    return { ...o, n, m, sd, med: n ? w[Math.floor(n / 2)] : null, min: w[0], max: w[n - 1], brand: it.brand || "", bom: it.bom_gas_g_per_can, dates: ds.length > 1 ? `${ds[0]} → ${ds[ds.length - 1]}` : ds[0] || "" }; }).sort((x, y) => y.n - x.n);
  $("#checks-items tbody").innerHTML = itemStats.map(o => `<tr class="run" data-item="${o.item}"><td><b>${o.item}</b></td><td>${o.brand}</td><td>${[...o.lines].join(", ")}</td><td class="num">${fmt(o.n)}</td><td class="num">${o.shifts}</td><td class="num"><b>${fmt(o.m, 2)}</b></td><td class="num">${fmt(o.med, 2)}</td><td class="num">${fmt(o.min, 1)}</td><td class="num">${fmt(o.max, 1)}</td><td class="num">${fmt(o.sd, 2)}</td><td class="num">${o.bom ? fmt(o.bom, 2) : "—"}</td><td class="num ${o.bom ? (o.m > o.bom ? "over" : "under") : ""}">${o.bom ? (o.m > o.bom ? "+" : "") + fmt((o.m - o.bom) / o.bom * 100) + "%" : "—"}</td><td>${o.dates}</td></tr>`).join("");
  let itemFilter = null;
  const renderShifts = () => {
  $("#checks-shift-filter").innerHTML = itemFilter ? `— showing ${itemFilter} · <a href="#" id="checks-clear">show all</a>` : "";
  $("#checks-clear")?.addEventListener("click", (e) => { e.preventDefault(); itemFilter = null; $$("#checks-items tr.run").forEach(t => t.classList.remove("selected")); renderShifts(); });
  const tb = $("#checks-table tbody"); tb.innerHTML = "";
  Object.values(groups).filter(g => !itemFilter || (g.item || "(no run logged)") === itemFilter).sort((a, b) => b.date.localeCompare(a.date) || b.shift - a.shift || a.line.localeCompare(b.line)).forEach(g => {
    const ws = [...g.weights].sort((a, b) => a - b); const n = ws.length; if (!n) return;
    const m = ws.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(ws.reduce((a, b) => a + (b - m) ** 2, 0) / n);
    const tr = document.createElement("tr");
    const bom = bomFor(g.line, g.date, g.shift); const dev = bom ? (m - bom) / bom * 100 : null;
    tr.innerHTML = `<td>${g.line}</td><td class="date">${g.date}</td><td>${g.shift}</td><td>${g.item || itemsFor(g.line, g.date, g.shift)}</td><td>${[...g.gassers].sort().join(", ")}</td><td>${[...g.times].sort().join(", ")}</td>
      <td class="num">${n}</td><td class="num"><b>${fmt(m, 2)}</b></td><td class="num">${fmt(ws[Math.floor(n / 2)], 2)}</td><td class="num">${fmt(sd, 2)}</td><td class="num">${fmt(ws[0], 1)} – ${fmt(ws[n - 1], 1)}</td>
      <td class="num">${bom ? fmt(bom, 2) : "—"}</td><td class="num ${dev == null ? "" : dev > 0 ? "over" : "under"}">${dev == null ? "—" : (dev > 0 ? "+" : "") + fmt(dev) + "%"}</td><td class="num">${g.corr || ""}</td>`;
    tb.appendChild(tr);
  });
  };
  renderShifts();
  $("#checks-items tbody").onclick = (e) => { const tr = e.target.closest("tr.run"); if (!tr) return; itemFilter = itemFilter === tr.dataset.item ? null : tr.dataset.item; $$("#checks-items tr.run").forEach(t => t.classList.toggle("selected", t.dataset.item === itemFilter)); renderShifts(); $("#checks-table").scrollIntoView({ behavior: "smooth", block: "nearest" }); };
  const sel = $("#check-item"); if (sel) sel.innerHTML = `<option value="">— from production run —</option>` + items.filter(i => i.gas_blend !== false).map(i => `<option value="${i.code}">${i.code}${i.brand ? " — " + i.brand : ""}</option>`).join("");
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
    (isNaN(fWf) || (r.wastePct != null && r.wastePct >= fWf)) &&
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
    if (r.nonGasOnly) { tr.classList.add("muted"); tr.innerHTML = `<td>${r.line}</td><td class="date">${r.date}</td><td>${r.shift}</td><td>${r.items}</td><td class="num">—</td><td class="num">—</td><td class="num">${r.totalLb == null ? "—" : fmt(r.totalLb)}</td><td colspan="6">non-gas-blend production only — ${r.totalLb == null ? "no meter data" : fmt(r.totalLb) + " lb of blend flowed with no gas item running"}</td>`; }
    else if (r.totalLb == null) { tr.classList.add("muted"); tr.innerHTML = `<td>${r.line}</td><td class="date">${r.date}</td><td>${r.shift}</td><td>${r.items}</td><td class="num">${fmt(r.cases)}</td><td class="num">${fmt(r.cans)}</td><td colspan="7">no meter data for this shift</td>`; }
    else tr.innerHTML = `<td>${r.line}</td><td class="date">${r.date}</td><td>${r.shift}</td><td>${r.items}</td><td class="num">${fmt(r.cases)}</td><td class="num">${fmt(r.cans)}</td>
      <td class="num">${fmt(r.totalLb)}</td><td class="num">${fmt(r.volPct, 1)}%</td><td class="num">${r.avgCpm == null ? "—" : fmt(r.avgCpm)}</td><td class="num">${r.eff == null ? "—" : fmt(r.eff) + "%"}</td><td class="num">${fmt(r.gPerCan, 1)}</td><td class="num waste">${r.wastePct == null ? "—" : fmt(r.wastePct) + "%"}</td><td class="basis">${r.basis === "paperwork" ? `Paperwork <small>${r.paperN} rdg</small>` : r.basis === "Enact" ? `Enact <small>${r.paperN} pcs</small>` : r.basis === "BOM" ? "BOM" : "<span class='empty'>none</span>"}</td>`;
    tb.appendChild(tr);
    const det = document.createElement("tr"); det.className = "detail hidden";
    const itemsTable = `<table class="mini"><thead><tr><th>Item</th><th>Brand</th><th class="num">Cases</th><th class="num">Cans/case</th><th class="num">Cans</th><th class="num">N₂O ratio</th></tr></thead><tbody>` +
      r.itemRows.map(x => `<tr class="${x.nonGas ? "muted" : ""}"><td>${x.code}${x.nonGas ? " <small>non-gas</small>" : ""}</td><td>${x.brand || "—"}</td><td class="num">${fmt(x.cases)}</td><td class="num">${x.cpc}</td><td class="num">${fmt(x.cans)}</td><td class="num">${x.nonGas ? "—" : x.ratio != null ? (x.ratio * 100).toFixed(1) + "%" : "default"}</td></tr>`).join("") +
      (r.itemRows.length > 1 ? `<tr class="total"><td>Total</td><td></td><td class="num">${fmt(r.cases)}</td><td></td><td class="num">${fmt(r.cans)}</td><td></td></tr>` : "") + `</tbody></table>`;
    const gasTable = r.totalLb == null ? "—" : `<table class="mini"><thead><tr><th>Gas</th><th class="num">scf</th><th class="num">lb</th><th class="num">% by vol</th></tr></thead><tbody>
      <tr><td class="n2o">N₂O</td><td class="num">${fmt(r.n2oScf)}</td><td class="num">${fmt(r.n2oLb)}</td><td class="num">${fmt(r.volPct, 1)}%</td></tr>
      <tr><td class="n2">N₂</td><td class="num">${fmt(r.n2Scf)}</td><td class="num">${fmt(r.n2Lb)}</td><td class="num">${fmt(100 - r.volPct, 1)}%</td></tr>
      <tr class="total"><td>Total</td><td class="num">${fmt(r.n2oScf + r.n2Scf)}</td><td class="num">${fmt(r.totalLb)}</td><td></td></tr></tbody></table>`;
    const wasteRow = (label, tgt, used) => tgt ? `<tr class="${used ? "used" : ""}"><td>${label}${used ? " <small>· used</small>" : ""}</td><td class="num">${fmt(tgt)}</td><td class="num">${r.totalLb == null ? "—" : fmt(r.totalLb - tgt)}</td><td class="num waste">${r.totalLb == null ? "—" : fmt((r.totalLb - tgt) / tgt * 100) + "%"}</td></tr>` : "";
    const wasteTable = (r.paperLb || r.bomLb) ? `<table class="mini"><thead><tr><th>Basis</th><th class="num">Target lb</th><th class="num">Over lb</th><th class="num">Waste %</th></tr></thead><tbody>` +
      wasteRow(`${r.basis === "Enact" ? "Enact" : "Paperwork"} ${fmt(r.paperG, 2)} g <small>(${r.paperN} ${r.basis === "Enact" ? "pcs" : "rdg"})</small>`, r.paperLb, r.basis === "paperwork" || r.basis === "Enact") + wasteRow(`BOM${r.itemRows.length === 1 && r.itemRows[0].bomG ? " " + fmt(r.itemRows[0].bomG, 2) + " g" : ""}`, r.bomLb, r.basis === "BOM") + `</tbody></table>` : `<p class="hint">No paperwork for this shift and no BOM gas standard for its items, so waste isn't calculated.</p>`;
    const kv = (label, val) => `<div class="kv"><span>${label}</span><div>${val}</div></div>`;
    det.innerHTML = `<td colspan="13"><div class="run-detail">
      <div class="detail-tables">
        <section><h4>Items</h4>${itemsTable}</section>
        <div class="detail-pair">
          <section><h4>Gas metered</h4>${gasTable}</section>
          <section><h4>Target &amp; waste</h4>${wasteTable}</section>
        </div>
      </div>
      <div class="detail-stats">
        ${kv("Duration", `${r.hours.toFixed(1)} h${r.hours < 7.9 ? " · partial meter coverage" : ""}`)}
        ${kv("Efficiency", `<b>${fmt(r.eff)}%</b> — ${fmt(r.cans)} cans ÷ ${fmt(r.capacityCans)} capacity<br><small>${FILLER_SETPOINT[r.line]} cpm × ${r.hours.toFixed(1)} h</small>`)}
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
  dashSort = th.dataset.sort === dashSort.key ? { key: dashSort.key, dir: -dashSort.dir } : { key: th.dataset.sort, dir: th.dataset.sort === "wastePct" || th.dataset.sort === "gPerCan" ? -1 : 1 }; renderDashTable(); });

async function computeShiftRows(lines, from, to) {
  const [runs, raw, fillerRaw, downRaw, checksRaw, enactRaw] = await Promise.all([
    sb.from("production_runs").select("*").in("line", lines).gte("run_date", from).lte("run_date", to).order("run_date").order("shift").then(r => r.data || []),
    fetchAll("gas_readings", "ts"),
    fetchAll("filler_readings", "ts").catch(() => []),
    fetchAll("filler_downtime", "ts").catch(() => []),
    fetchAll("gas_weight_checks", "check_date").catch(() => []),
    fetchAll("enact_kpi", "summary_date").catch(() => []),
  ]);
  // Enact per-shift means: key line|date|shift -> { g, n, item }
  const enact = {};
  enactRaw.forEach(k => {
    if (!/gas|weight/i.test(k.feature_name || "")) return;
    const line = /\bD\b|D Line|D-Line/i.test(k.process_name) ? "D" : /\bC\b|C Line|C-Line/i.test(k.process_name) ? "C" : null; if (!line) return;
    const sh = k.shift_name ? (/3|third|3rd|night/i.test(k.shift_name) ? 3 : /2|second|2nd|even|swing/i.test(k.shift_name) ? 2 : 1) : null; if (!sh) return;
    const d = localDate(new Date(k.summary_date)); const key = `${line}|${d}|${sh}`; const n = Number(k.piece_count) || 0, m = Number(k.mean);
    const o = enact[key] = enact[key] || { sum: 0, n: 0, items: new Set() }; o.sum += m * n; o.n += n; o.items.add(normCode(String(k.part_name).split(/[ -]/)[0]));
  });
  // paperwork: mean measured gas weight per line + date + shift (check_time decides the shift; 00:00-06:59 belongs to previous day's shift 3)
  const paper = {};
  checksRaw.forEach(c => {
    const w = Number(c.weight_g); if (!(w >= 2.3)) return;
    const hr = c.check_time ? parseInt(String(c.check_time).split(":")[0], 10) : NaN; if (isNaN(hr)) return;
    let d = c.check_date, sh = hr >= 7 && hr < 15 ? 1 : hr >= 15 && hr < 23 ? 2 : 3;
    if (hr < 7) { const t = new Date(d + "T12:00:00"); t.setDate(t.getDate() - 1); d = localDate(t); }
    const k = `${c.line || "C"}|${d}|${sh}`; (paper[k] = paper[k] || { sum: 0, n: 0 }); paper[k].sum += w; paper[k].n++;
  });
  const readingsBy = {}, fillerBy = {}, downBy = {};
  downRaw.forEach(r => (downBy[r.line] = downBy[r.line] || []).push({ t: new Date(r.ts).getTime(), m: Number(r.downtime_mins) }));
  raw.forEach(r => (readingsBy[r.line] = readingsBy[r.line] || []).push({ t: new Date(r.ts).getTime(), n2o: Number(r.n2o_scf), n2: Number(r.n2_scf) }));
  fillerRaw.forEach(r => (fillerBy[r.line] = fillerBy[r.line] || []).push({ t: new Date(r.ts).getTime(), cpm: Number(r.cpm) }));
  const dN2O = D.n2o, dN2 = D.n2;

  const groups = {};
  runs.forEach(r => { const k = `${r.line}|${r.run_date}|${r.shift}`; (groups[k] = groups[k] || { line: r.line, date: r.run_date, shift: r.shift, runs: [] }).runs.push(r); });
  const out = [];
  Object.values(groups).sort((a, b) => a.date.localeCompare(b.date) || a.shift - b.shift || a.line.localeCompare(b.line)).forEach(g => {
    const readings = readingsBy[g.line] || [];
    const [s, e] = shiftWindow(g.date, g.shift);
    const last = readings.length ? readings[readings.length - 1].t : 0;
    const eUse = (e > last && e - last <= 15 * 60e3) ? last : e;
    const a = interp(readings, s), b = interp(readings, eUse);
    let cans = 0, bomLb = 0, bomMissing = false, nonGasCans = 0;
    const itemRows = g.runs.map(r => {
      const it = items.find(i => i.code === r.item_code) || {};
      const n = r.cases * (r.cans_per_case || 12);
      const nonGas = it.gas_blend === false;
      if (nonGas) { nonGasCans += n; return { code: r.item_code || "—", brand: it.brand || "", cases: r.cases, cpc: r.cans_per_case || 12, cans: n, nonGas: true }; }
      cans += n;
      if (it.bom_gas_g_per_can) bomLb += n * it.bom_gas_g_per_can / G_PER_LB; else bomMissing = true;
      return { code: r.item_code || "—", brand: it.brand || "", cases: r.cases, cpc: r.cans_per_case || 12, cans: n, ratio: it.n2o_ratio_vol, bomG: it.bom_gas_g_per_can };
    });
    const nonGasOnly = cans === 0 && (nonGasCans > 0 || g.runs.some(r => /non-gas/i.test(r.notes || "")));
    const pw = paper[`${g.line}|${g.date}|${g.shift}`] || (enact[`${g.line}|${g.date}|${g.shift}`] && { ...enact[`${g.line}|${g.date}|${g.shift}`], src: "Enact" });
    const paperG = pw ? pw.sum / pw.n : null, paperN = pw ? pw.n : 0, paperSrc = pw?.src || "paperwork";
    const paperLb = paperG != null ? cans * paperG / G_PER_LB : null;
    if (bomMissing) bomLb = 0;
    // target basis: paperwork for this line/date/shift if it exists, otherwise the items' BOM standard; never the 4.87 assumption
    const basis = paperLb != null ? paperSrc : bomLb ? "BOM" : null;
    const targetLb = basis === "paperwork" ? paperLb : basis === "BOM" ? bomLb : 0;
    const cases = g.runs.filter(r => !itemRows.find(x => x.code === r.item_code)?.nonGas).reduce((x, r) => x + r.cases, 0);
    const hours = (eUse - s) / 3600e3;
    const fill = (fillerBy[g.line] || []).filter(p => p.t >= s && p.t < e).map(p => p.cpm);
    const avgCpm = fill.length ? fill.reduce((x, y) => x + y, 0) / fill.length : null;
    const pctRunning = fill.length ? fill.filter(c => c > 20).length / fill.length * 100 : null;
    const capacityCans = FILLER_SETPOINT[g.line] * 60 * hours;               // cans the filler could make at setpoint over the window
    const eff = cans && hours ? cans / capacityCans * 100 : null;              // efficiency = cans produced ÷ setpoint capacity
    const dn = (downBy[g.line] || []).filter(p => p.t >= s && p.t < e).map(p => p.m);
    const pctDown = dn.length ? dn.filter(m => m > 5).length / dn.length * 100 : null;
    const longestStop = dn.length ? Math.max(...dn) : null;
    const row = { line: g.line, date: g.date, shift: g.shift, cases, cans, targetLb, bomLb, paperLb, paperG, paperN, basis, itemRows, nonGasOnly, nonGasCans, hours, avgCpm, pctRunning, eff, capacityCans, pctDown, longestStop,
      items: [...new Set(itemRows.map(i => i.code))].join(" + "), fillerCans: avgCpm != null ? avgCpm * 60 * hours : null,
      notes: g.runs.map(r => r.notes).filter(Boolean).join("; ") };
    if (a && b) {
      row.n2oScf = b.n2o - a.n2o; row.n2Scf = b.n2 - a.n2;
      row.n2oLb = row.n2oScf * dN2O; row.n2Lb = row.n2Scf * dN2; row.totalLb = row.n2oLb + row.n2Lb;
      row.volPct = row.n2oScf / (row.n2oScf + row.n2Scf) * 100;
      row.gPerCan = cans ? row.totalLb * G_PER_LB / cans : null;
      row.wf = targetLb ? row.totalLb / targetLb : null; row.wastePct = targetLb ? (row.totalLb - targetLb) / targetLb * 100 : null;
      row.wfBom = bomLb ? row.totalLb / bomLb : null; row.wfPaper = paperLb ? row.totalLb / paperLb : null; row.lbHr = row.totalLb / hours; row.casesHr = cases / hours;
    }
    out.push(row);
  });

  return out;
}

async function loadDashboard() {
  const from = $("#dash-from"), to = $("#dash-to");
  if (!from.value) { const { data } = await sb.from("production_runs").select("run_date").order("run_date").limit(1); from.value = data?.[0]?.run_date || localDate(new Date(Date.now() - 30 * 864e5)); to.value = localDate(new Date()); }
  const lineSel = $("#dash-line").value; const lines = lineSel === "ALL" ? ["C", "D"] : [lineSel];
  const out = await computeShiftRows(lines, from.value, to.value);
  dashRows = out; renderDashTable();


  const have = out.filter(r => r.totalLb != null && r.targetLb);
  const summ = lines.map(L => { const h = have.filter(r => r.line === L); if (!h.length) return null;
    const T = h.reduce((a, r) => ({ lb: a.lb + r.totalLb, tgt: a.tgt + r.targetLb, cans: a.cans + r.cans, cases: a.cases + r.cases }), { lb: 0, tgt: 0, cans: 0, cases: 0 });
    return `<b>${L} Line</b>: ${h.length} shifts, ${fmt(T.cases)} cases, ${fmt(T.lb)} lb metered vs ${fmt(T.tgt)} lb target — <b>${fmt((T.lb - T.tgt) / T.tgt * 100)}% over target</b>, ${fmt(T.lb * G_PER_LB / T.cans, 1)} g/can`; }).filter(Boolean);
  $("#dash-summary").innerHTML = summ.length ? summ.join("<br>") : "No shifts with both production and meter data in this range.";

  if (chart) chart.destroy();
  const colors = { C: "#014583", D: "#8ae5ff" }, cpmColors = { C: "#c27a12", D: "#031b27" };   // brand palette: C primary blue, D sky blue; CPM lines orange / navy
  const bars = lines.map(L => ({ type: "bar", label: `${L} Line waste %`, data: have.map(r => r.line === L ? r.wastePct : null), backgroundColor: colors[L], yAxisID: "y", order: 2, skipNull: true }));
  const showCpm = $("#dash-cpm").checked;
  const cpmLines = showCpm ? lines.map(L => ({ type: "line", label: `${L} Line avg CPM`, data: have.map(r => r.line === L ? r.avgCpm : null), borderColor: cpmColors[L], backgroundColor: cpmColors[L], pointBackgroundColor: "#fff", pointBorderColor: cpmColors[L], pointBorderWidth: 2, pointRadius: 4, borderWidth: 2, borderDash: [6, 4], spanGaps: true, yAxisID: "y2", order: 1 })) : [];
  chart = new Chart($("#chart-waste"), {
    data: { labels: have.map(r => `${r.date.slice(5)} S${r.shift}`), datasets: [...bars, ...cpmLines] },
    options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
      plugins: { legend: { display: true }, tooltip: { callbacks: { afterBody: (c) => { const r = have[c[0].dataIndex]; return `${r.items} · ${fmt(r.cases)} cases`; } } } },
      scales: { x: { stacked: true },
        y: { beginAtZero: true, position: "left", title: { display: true, text: "waste % over target" }, ticks: { callback: v => v + "%" } },
        y2: { display: showCpm, beginAtZero: true, position: "right", grid: { drawOnChartArea: false }, title: { display: true, text: "filler cans / min" } } } }
  });
  $("#dash-export").onclick = () => csv(out.map(r => ({ line: r.line, date: r.date, shift: r.shift, items: r.items, cases: r.cases, cans: r.cans, hours: r.hours, n2o_scf: r.n2oScf, n2_scf: r.n2Scf, n2o_lb: r.n2oLb, n2_lb: r.n2Lb, total_lb: r.totalLb, n2o_pct_vol: r.volPct, avg_cpm: r.avgCpm, efficiency_pct_cans_vs_capacity: r.eff, capacity_cans: r.capacityCans, pct_shift_filler_down: r.pctDown, longest_stop_min: r.longestStop, target_basis: r.basis, target_lb: r.targetLb, paperwork_g_per_can: r.paperG, paperwork_readings: r.paperN, bom_target_lb: r.bomLb, g_per_can: r.gPerCan, waste_pct: r.wastePct, notes: r.notes })), "consumption_by_shift.csv");
}
$("#dash-refresh").addEventListener("click", loadDashboard);
$("#dash-line").addEventListener("change", loadDashboard);
$("#dash-cpm").addEventListener("change", loadDashboard);


/* ---------- analysis ---------- */
let anCharts = {};
function fitLine(xs, ys) {
  const n = xs.length; if (n < 2) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, sst = 0; xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; });
  if (!sxx) return null; const m = sxy / sxx, c = my - m * mx; ys.forEach(y => sst += (y - my) ** 2);
  const sse = ys.reduce((acc, y, i) => acc + (y - (m * xs[i] + c)) ** 2, 0);
  return { m, c, r2: sst ? 1 - sse / sst : 0, n };
}
function weekStart(dateStr) { const d = new Date(dateStr + "T00:00:00"); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return localDate(d); }
const CATS = { startup: "Startup", end_of_schedule: "End of schedule", changeover: "Changeover", downtime: "Downtime" };
const CAT_COLORS = { startup: "#8ae5ff", end_of_schedule: "#014583", changeover: "#c27a12", downtime: "#b3261e" };
const CAT_NOTE = { startup: "expected — gas to bring the system up before the first can", end_of_schedule: "blend left open after the last can, or through a CIP", changeover: "blend open while a non-gas item ran, or during a long changeover", downtime: "blend open through a stop of 30 min or more with the filler idle" };
const med = (arr) => { const v = arr.filter(x => x != null && !isNaN(x)).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };
const mkChart = (key, el, cfg) => { if (anCharts[key]) anCharts[key].destroy(); anCharts[key] = new Chart($(el), cfg); return anCharts[key]; };

async function loadAnalysis() {
  const from = $("#an-from"), to = $("#an-to");
  if (!from.value) { const { data } = await sb.from("production_runs").select("run_date").order("run_date").limit(1); from.value = data?.[0]?.run_date || "2026-08-01"; to.value = localDate(new Date()); }
  const lineSel = $("#an-line .on")?.dataset.v || "ALL"; const lines = lineSel === "ALL" ? ["C", "D"] : [lineSel];
  const [allShifts, allRuns, rawR, rawF, rawEvents] = await Promise.all([computeShiftRows(lines, from.value, to.value), fetchAll("production_runs", "run_date"), fetchAll("gas_readings", "ts"), fetchAll("filler_readings", "ts").catch(() => []), fetchAll("gas_events", "start_ts").catch(() => [])]);
  const all = allShifts.filter(r => r.totalLb != null && r.targetLb && !r.nonGasOnly);
  const readingsBy = {}, fillerBy = {};
  rawR.forEach(r => (readingsBy[r.line] = readingsBy[r.line] || []).push({ t: new Date(r.ts).getTime(), n2o: Number(r.n2o_scf), n2: Number(r.n2_scf) }));
  rawF.forEach(r => (fillerBy[r.line] = fillerBy[r.line] || []).push({ t: new Date(r.ts).getTime(), cpm: Number(r.cpm) }));
  const itemSel = $("#an-item"); const cur = itemSel.value;
  const codes = [...new Set(all.flatMap(r => r.itemRows.filter(x => !x.nonGas).map(x => x.code)))].sort();
  const brandOf = (c) => items.find(i => i.code === c)?.brand || "Other";
  const brands = [...new Set(codes.map(brandOf))].sort();
  itemSel.innerHTML = `<option value="">All items</option>` + brands.map(b => `<optgroup label="${b}"><option value="brand:${b}"${cur === "brand:" + b ? " selected" : ""}>All ${b}</option>` + codes.filter(c => brandOf(c) === b).map(c => `<option value="${c}"${c === cur ? " selected" : ""}>${c} — ${(items.find(i => i.code === c)?.description || "").replace(/^(Silk|Dunkin|International Delight|McDonald's) /, "")}</option>`).join("") + `</optgroup>`).join("");
  const rows = !cur ? all : cur.startsWith("brand:") ? all.filter(r => r.itemRows.some(x => brandOf(x.code) === cur.slice(6))) : all.filter(r => r.itemRows.some(x => x.code === cur));
  const full = rows.filter(r => r.hours >= 7.5);
  const gasTot = rows.reduce((x, r) => x + r.totalLb, 0);
  $("#an-count").textContent = `${rows.length} shifts, ${from.value} to ${to.value}`;
  const colors = { C: "#014583", D: "#8ae5ff" }, dark = { C: "#031b27", D: "#457a94" };
  const wasteOf = (arr) => { const lb = arr.reduce((a, r) => a + r.totalLb, 0), t = arr.reduce((a, r) => a + r.targetLb, 0); return t ? (lb - t) / t * 100 : null; };

  // ===== by item =====
  const byItem = {};
  rows.forEach(r => r.itemRows.filter(x => !x.nonGas).forEach(x => {
    const share = r.cans ? x.cans / r.cans : 0; const it = items.find(i => i.code === x.code) || {};
    const o = byItem[x.code] = byItem[x.code] || { code: x.code, brand: x.brand, lines: new Set(), shifts: 0, mixed: 0, cases: 0, cans: 0, lb: 0, tgt: 0, bom: 0 };
    o.lines.add(r.line); o.shifts++; if (r.itemRows.length > 1) o.mixed++;
    o.cases += x.cases; o.cans += x.cans; o.lb += r.totalLb * share; o.tgt += r.targetLb * share; o.bom += it.bom_gas_g_per_can ? x.cans * it.bom_gas_g_per_can / G_PER_LB : 0;
  }));
  const itemList = Object.values(byItem).sort((a, b) => b.lb - a.lb);
  const topItems = itemList.slice(0, 12);
  const baseColor = (o) => [...o.lines].includes("C") && ![...o.lines].includes("D") ? colors.C : [...o.lines].includes("D") && ![...o.lines].includes("C") ? colors.D : "#457a94";
  const itemShifts = (code) => rows.filter(r => r.itemRows.some(x => x.code === code)).sort((x, y) => x.date.localeCompare(y.date) || x.shift - y.shift).map(r => { const x = r.itemRows.find(i => i.code === code); const share = r.cans ? x.cans / r.cans : 0; return { r, x, share, lb: r.totalLb * share, tgt: r.targetLb * share }; });
  const drill = (code) => `<table class="mini"><thead><tr><th>Line</th><th>Date</th><th>Shift</th><th>Ran with</th><th class="num">Cases</th><th class="num">Cans</th><th class="num">Share</th><th class="num">Gas lb</th><th class="num">g / can</th><th class="num">Waste %</th><th>Basis</th><th class="num">Filler cpm</th><th class="num">Efficiency</th></tr></thead><tbody>`
    + itemShifts(code).map(({ r, x, share, lb, tgt }) => `<tr><td>${r.line}</td><td>${r.date}</td><td>${r.shift}</td><td>${r.itemRows.filter(i => i.code !== code).map(i => i.code).join(" + ") || "—"}</td><td class="num">${fmt(x.cases)}</td><td class="num">${fmt(x.cans)}</td><td class="num">${fmt(share * 100)}%</td><td class="num">${fmt(lb)}</td><td class="num">${fmt(lb * G_PER_LB / x.cans, 1)}</td><td class="num waste">${tgt ? fmt((lb - tgt) / tgt * 100) + "%" : "—"}</td><td>${r.basis || "—"}</td><td class="num">${r.avgCpm == null ? "—" : fmt(r.avgCpm)}</td><td class="num">${r.eff == null ? "—" : fmt(r.eff) + "%"}</td></tr>`).join("") + `</tbody></table>`;
  $("#an-items tbody").innerHTML = itemList.map(o => `<tr class="run" data-code="${o.code}"><td><b>${o.code}</b></td><td>${o.brand || "—"}</td><td>${[...o.lines].join(", ")}</td><td class="num">${o.shifts}${o.mixed ? ` <small>(${o.mixed} shared)</small>` : ""}</td><td class="num">${fmt(o.cases)}</td><td class="num">${fmt(o.cans)}</td><td class="num">${fmt(o.lb)}</td><td class="num">${fmt(o.lb * G_PER_LB / o.cans, 1)}</td><td class="num">${fmt(o.tgt * G_PER_LB / o.cans, 2)}</td><td class="num waste">${fmt((o.lb - o.tgt) / o.tgt * 100)}%</td><td class="num">${o.bom ? fmt((o.lb - o.bom) / o.bom * 100) + "%" : "—"}</td></tr><tr class="detail hidden" data-for="${o.code}"><td colspan="11"><div class="run-detail one">${drill(o.code)}</div></td></tr>`).join("");
  let openCode = null;
  const openItem = (code, scroll) => {
    const det = $(`#an-items tr.detail[data-for="${code}"]`); if (!det) return;
    const wasOpen = !det.classList.contains("hidden");
    $$("#an-items tr.detail").forEach(d => d.classList.add("hidden")); $$("#an-items tr.run").forEach(t => t.classList.remove("selected"));
    openCode = wasOpen ? null : code;
    if (!wasOpen) { det.classList.remove("hidden"); det.previousElementSibling.classList.add("selected"); if (scroll) det.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
    const ch = anCharts.items; if (ch) { ch.data.datasets[0].backgroundColor = topItems.map(o => o.code === openCode ? "#c27a12" : baseColor(o)); ch.data.datasets[0].borderColor = topItems.map(o => o.code === openCode ? "#031b27" : "transparent"); ch.data.datasets[0].borderWidth = topItems.map(o => o.code === openCode ? 2 : 0); ch.update(); }
  };
  $("#an-items tbody").onclick = (e) => { const tr = e.target.closest("tr.run"); if (tr) openItem(tr.dataset.code); };
  mkChart("items", "#an-chart-items", { type: "bar",
    data: { labels: topItems.map(o => o.code), datasets: [{ label: "gas per can (g, allocated) — click a bar to expand", data: topItems.map(o => o.lb * G_PER_LB / o.cans), backgroundColor: topItems.map(baseColor), borderColor: topItems.map(() => "transparent"), borderWidth: 0, borderRadius: 6 }, { label: "target g (paperwork or BOM)", type: "line", data: topItems.map(o => o.tgt * G_PER_LB / o.cans), borderColor: "#c27a12", borderDash: [6, 4], borderWidth: 2, pointRadius: 0, stepped: true }] },
    options: { responsive: true, maintainAspectRatio: false, animation: { duration: 900, easing: "easeOutQuart" }, onClick: (evt, els) => { if (els.length) openItem(topItems[els[0].index].code, true); }, scales: { y: { beginAtZero: true, title: { display: true, text: "g per can" } } } } });
  $("#an-export").onclick = () => csv(itemList.map(o => ({ item: o.code, brand: o.brand, lines: [...o.lines].join(" "), shifts: o.shifts, shared_shifts: o.mixed, cases: o.cases, cans: o.cans, gas_lb_allocated: o.lb, g_per_can: o.lb * G_PER_LB / o.cans, target_g_per_can: o.tgt * G_PER_LB / o.cans, waste_pct: (o.lb - o.tgt) / o.tgt * 100, waste_pct_vs_bom: o.bom ? (o.lb - o.bom) / o.bom * 100 : null })), "analysis_by_item.csv");

  // ===== by line =====
  const byLine = lines.map(L => {
    const g = rows.filter(r => r.line === L); if (!g.length) return null;
    const T = g.reduce((a, r) => ({ lb: a.lb + r.totalLb, tgt: a.tgt + r.targetLb, bom: a.bom + r.bomLb, cans: a.cans + r.cans, cases: a.cases + r.cases, hrs: a.hrs + r.hours }), { lb: 0, tgt: 0, bom: 0, cans: 0, cases: 0, hrs: 0 });
    const f = g.filter(r => r.hours >= 7.5); const fit = fitLine(f.map(r => r.casesHr), f.map(r => r.lbHr)); const effs = g.map(r => r.eff).filter(x => x != null);
    return { line: L, shifts: g.length, paperShifts: g.filter(r => r.basis === "paperwork").length, cases: T.cases, cans: T.cans, lb: T.lb, waste: (T.lb - T.tgt) / T.tgt * 100, wasteBom: T.bom ? (T.lb - T.bom) / T.bom * 100 : null, gcan: T.lb * G_PER_LB / T.cans, tgtG: T.tgt * G_PER_LB / T.cans, eff: effs.length ? effs.reduce((a, b) => a + b, 0) / effs.length : null, fit, medianW: med(g.map(r => r.wastePct)), best: Math.min(...g.map(r => r.wastePct)), worst: Math.max(...g.map(r => r.wastePct)) };
  }).filter(Boolean);
  $("#an-lines").innerHTML = byLine.map(L => `<div class="kpi" data-line="${L.line}"><h3>${L.line} Line</h3><div class="big">${fmt(L.waste)}%<small>gas over target</small></div><dl>
      <dt>Gas per can</dt><dd>${fmt(L.gcan, 1)} g <small>vs ${fmt(L.tgtG, 2)} g target</small></dd>
      <dt>Target basis</dt><dd>${L.paperShifts} of ${L.shifts} <small>shifts measured (paperwork / Enact), rest BOM</small></dd>
      <dt>Shifts · cases</dt><dd>${fmt(L.shifts)} · ${fmt(L.cases)}</dd>
      <dt>Gas metered</dt><dd>${fmt(L.lb)} lb</dd>
      <dt>vs BOM only</dt><dd>${L.wasteBom == null ? "—" : fmt(L.wasteBom) + "%"}</dd>
      <dt>Efficiency</dt><dd>${L.eff == null ? "—" : fmt(L.eff) + "%"} <small>of setpoint</small></dd>
      <dt>Range</dt><dd>${fmt(L.best)}% – ${fmt(L.worst)}% <small>median ${fmt(L.medianW)}%</small></dd>
      <dt>Fixed bleed</dt><dd>${L.fit ? fmt(L.fit.c) + " lb/hr" : "—"} <small>${L.fit ? "regardless of output" : ""}</small></dd>
      <dt>Per can</dt><dd>${L.fit ? fmt(L.fit.m * G_PER_LB / 12, 1) + " g" : "—"} <small>${L.fit ? "R² " + L.fit.r2.toFixed(2) : ""}</small></dd></dl></div>`).join("") || "<p class='hint'>No shifts in range.</p>";

  // ===== efficiency vs waste =====
  const effOf = (r) => r.avgCpm != null ? r.avgCpm / FILLER_SETPOINT[r.line] * 100 : null;
  const effRows = full.filter(r => effOf(r) != null);
  mkChart("eff", "#an-chart-eff", { type: "scatter",
    data: { datasets: lines.flatMap(L => { const g = effRows.filter(r => r.line === L); const f = fitLine(g.map(effOf), g.map(r => r.wastePct)); const xs = g.map(effOf); const xmin = Math.min(...xs), xmax = Math.max(...xs);
      return [{ label: `${L} Line shifts`, data: g.map(r => ({ x: effOf(r), y: r.wastePct, r })), backgroundColor: colors[L], pointBorderColor: dark[L], pointRadius: 6, pointHoverRadius: 9 },
        ...(f && g.length > 3 ? [{ label: `${L} trend`, type: "line", data: [{ x: xmin, y: f.c + f.m * xmin }, { x: xmax, y: f.c + f.m * xmax }], borderColor: dark[L], borderDash: [6, 4], borderWidth: 2, pointRadius: 0, pointHitRadius: 0 }] : [])]; }) },
    options: { responsive: true, maintainAspectRatio: false, animation: { duration: 900, easing: "easeOutQuart" }, interaction: { mode: "nearest", intersect: true },
      onClick: (evt, els) => { if (!els.length) return; const d = anCharts.eff.data.datasets[els[0].datasetIndex].data[els[0].index]; if (!d.r) return; const r = d.r; const box = $("#an-eff-detail"); box.classList.remove("hidden");
        box.innerHTML = `<b>${r.line} Line · ${r.date} · shift ${r.shift}</b> — ${r.items}<div class="pick-grid"><div><span>Filler</span>${fmt(r.avgCpm)} cpm average = ${fmt(effOf(r))}% of ${FILLER_SETPOINT[r.line]}${r.pctDown != null ? " · down " + fmt(r.pctDown) + "% of shift" : ""}</div><div><span>Production</span>${fmt(r.cases)} cases · ${fmt(r.cans)} cans</div><div><span>Gas</span>${fmt(r.totalLb)} lb · ${fmt(r.lbHr)} lb/hr · ${fmt(r.gPerCan, 1)} g/can</div><div><span>Waste</span>${fmt(r.wastePct)}% over ${r.basis} target</div></div>`; },
      plugins: { tooltip: { callbacks: { label: (c) => c.raw.r ? `${c.raw.r.date} S${c.raw.r.shift} ${c.raw.r.items}: ${fmt(c.raw.y)}% waste at ${fmt(c.raw.x)}% filler speed` : c.dataset.label } } },
      scales: { x: { beginAtZero: true, title: { display: true, text: "filler speed, % of maximum (avg cpm ÷ setpoint)" }, ticks: { callback: v => v + "%" } }, y: { beginAtZero: true, title: { display: true, text: "gas % over target" }, ticks: { callback: v => v + "%" } } } } });
  const bands = [[0, 40, "under 40%"], [40, 70, "40–70%"], [70, 1e9, "over 70%"]];
  $("#an-eff-kpis").innerHTML = bands.map(([lo, hi, lab]) => { const g = effRows.filter(r => effOf(r) >= lo && effOf(r) < hi); if (!g.length) return ""; return `<div class="kpi mini-kpi"><h3>Filler at ${lab} of max</h3><div class="big">${fmt(wasteOf(g))}%<small>gas over target · ${g.length} shifts · median ${fmt(med(g.map(r => r.gPerCan)), 1)} g/can</small></div></div>`; }).join("");

  // ===== trend =====
  const weeks = {}; rows.forEach(r => { const k = `${weekStart(r.date)}|${r.line}`; const w = weeks[k] = weeks[k] || { week: weekStart(r.date), line: r.line, lb: 0, tgt: 0, cans: 0, n: 0 }; w.lb += r.totalLb; w.tgt += r.targetLb; w.cans += r.cans; w.n++; });
  const weekList = Object.values(weeks).sort((a, b) => a.week.localeCompare(b.week)); const weekLabels = [...new Set(weekList.map(w => w.week))];
  $("#an-weeks tbody").innerHTML = weekList.map(w => `<tr><td class="date">${w.week}</td><td>${w.line}</td><td class="num">${w.n}</td><td class="num">${fmt(w.cans)}</td><td class="num">${fmt(w.lb)}</td><td class="num">${fmt(w.lb * G_PER_LB / w.cans, 1)}</td><td class="num waste">${fmt((w.lb - w.tgt) / w.tgt * 100)}%</td></tr>`).join("");
  $("#an-trend-text").innerHTML = lines.map(L => { const g = rows.filter(r => r.line === L).sort((a, b) => a.date.localeCompare(b.date) || a.shift - b.shift); if (g.length < 4) return null;
    const t0 = new Date(g[0].date).getTime(); const f = fitLine(g.map(r => (new Date(r.date).getTime() - t0) / 864e5), g.map(r => r.gPerCan)); const half = Math.floor(g.length / 2); const a1 = wasteOf(g.slice(0, half)), a2 = wasteOf(g.slice(half));
    return `<b>${L} Line</b>: first half of the period ${fmt(a1)}% over target → second half ${fmt(a2)}% (${a2 - a1 >= 0 ? "+" : ""}${fmt(a2 - a1)} points). Gas per can trending ${f.m >= 0 ? "up" : "down"} ${Math.abs(f.m * 7).toFixed(2)} g per week${f.r2 < 0.1 ? " — not a meaningful trend yet; shift-to-shift variation dominates" : ""}.`; }).filter(Boolean).join("<br>") || "Need at least 4 shifts per line to test for a trend.";
  mkChart("trend", "#an-chart-trend", { type: "line",
    data: { labels: weekLabels, datasets: lines.map(L => ({ label: `${L} Line weekly waste %`, data: weekLabels.map(w => { const x = weekList.find(v => v.week === w && v.line === L); return x ? (x.lb - x.tgt) / x.tgt * 100 : null; }), borderColor: colors[L], backgroundColor: colors[L], pointRadius: 5, borderWidth: 2.5, spanGaps: true, tension: 0.3 })) },
    options: { responsive: true, maintainAspectRatio: false, animation: { duration: 900, easing: "easeOutQuart" }, scales: { y: { beginAtZero: true, title: { display: true, text: "gas % over target" }, ticks: { callback: v => v + "%" } }, x: { title: { display: true, text: "week starting" } } } } });

  // ===== gas-open events (4 groups) =====
  const events = rawEvents.filter(e => lines.includes(e.line) && e.start_ts.slice(0, 10) >= from.value && e.start_ts.slice(0, 10) <= to.value);
  events.forEach(e => { const pts = readingsBy[e.line] || []; const a = interp(pts, new Date(e.start_ts).getTime()), b = interp(pts, new Date(e.end_ts).getTime()); e.lb = a && b ? (b.n2o - a.n2o) * D.n2o + (b.n2 - a.n2) * D.n2 : Number(e.gas_lb) || 0; e.hrs = (new Date(e.end_ts) - new Date(e.start_ts)) / 3600e3; });
  // detected downtime: gas flowing while the filler sat idle for 30+ min inside a run, not already covered by a confirmed event
  lines.forEach(L => {
    const pts = readingsBy[L] || [], fl = (fillerBy[L] || []).filter(p => p.t >= new Date(from.value).getTime() && p.t < new Date(to.value).getTime() + 864e5); if (pts.length < 2 || fl.length < 2) return;
    const lbAt = (t) => { const v = interp(pts, t); return v ? v.n2o * D.n2o + v.n2 * D.n2 : null; };
    let cur = null; const found = [];
    for (let i = 0; i < fl.length - 1; i++) {
      const s0 = fl[i].t, e0 = fl[i + 1].t, a0 = lbAt(s0), b0 = lbAt(e0); if (a0 == null || b0 == null) continue;
      const lb = b0 - a0, hrs = (e0 - s0) / 3600e3;
      if (hrs > 2 || lb < 1) { if (cur) { found.push(cur); cur = null; } continue; }   // gas off, or a data gap
      if (fl[i].cpm < 20) { if (!cur) cur = { start: s0, end: e0, lb, hrs }; else { cur.end = e0; cur.lb += lb; cur.hrs += hrs; } }
      else if (cur) { cur.runsAfter = true; found.push(cur); cur = null; }
    }
    found.filter(f => f.hrs >= 0.5 && f.runsAfter && !events.some(e => e.line === L && new Date(e.start_ts).getTime() < f.end && new Date(e.end_ts).getTime() > f.start))
      .forEach(f => events.push({ id: null, line: L, start_ts: new Date(f.start).toISOString(), end_ts: new Date(f.end).toISOString(), category: "downtime", cause: "detected — filler idle with gas up (equipment stop?)", lb: f.lb, hrs: f.hrs, detected: true }));
  });
  const catOrder = ["startup", "end_of_schedule", "changeover", "downtime"];
  const byCat = {}; catOrder.forEach(c => byCat[c] = { lb: 0, hrs: 0, n: 0, C: 0, D: 0 }); events.forEach(e => { const c = byCat[e.category] || (byCat[e.category] = { lb: 0, hrs: 0, n: 0, C: 0, D: 0 }); c.lb += e.lb; c.hrs += e.hrs; c.n++; c[e.line] = (c[e.line] || 0) + e.lb; });
  const evTot = events.reduce((x, e) => x + e.lb, 0), opportunity = events.filter(e => e.category !== "startup").reduce((x, e) => x + e.lb, 0);
  let evFilter = null;
  const fdt = (t) => new Date(t).toLocaleString([], { weekday: "short", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const renderEvents = () => {
    const list = events.filter(e => !evFilter || e.category === evFilter).sort((a, b) => catOrder.indexOf(a.category) - catOrder.indexOf(b.category) || b.lb - a.lb);
    $("#an-events-filter").innerHTML = evFilter ? `Showing <b>${CATS[evFilter]}</b> only — <a href="#" id="an-events-clear">show all</a>` : "";
    $("#an-events tbody").innerHTML = list.map(e => `<tr><td><span class="cat" style="--c:${CAT_COLORS[e.category]}"></span>${CATS[e.category] || e.category}</td><td>${e.line}</td><td>${fdt(e.start_ts)}</td><td>${fdt(e.end_ts)}</td><td class="num">${fmt(e.hrs, 1)}</td><td class="num">${fmt(e.lb)}</td><td class="num">${fmt(e.lb / e.hrs)}</td><td>${e.detected ? "<span class='empty'>" + e.cause + "</span>" : (e.cause || "")}</td></tr>`).join("") || `<tr><td colspan="8" class="empty">No events in this range.</td></tr>`;
    $("#an-events-clear")?.addEventListener("click", (ev) => { ev.preventDefault(); evFilter = null; renderEvents(); anCharts.events.setActiveElements([]); anCharts.events.update(); });
    $("#an-events-kpis").innerHTML = catOrder.map(c => { const v = byCat[c]; return `<div class="kpi mini-kpi ${evFilter === c ? "on" : ""}" data-cat="${c}" style="--c:${CAT_COLORS[c]}"><h3><span class="cat" style="--c:${CAT_COLORS[c]}"></span>${CATS[c]}${c === "startup" ? " <small>(expected)</small>" : ""}</h3><div class="big">${fmt(v.lb)} lb<small>${v.n} event${v.n === 1 ? "" : "s"} · ${fmt(v.hrs, 1)} h${v.hrs ? " · " + fmt(v.lb / v.hrs) + " lb/hr" : ""}</small></div><p class="hint">${CAT_NOTE[c]}</p></div>`; }).join("")
      + `<div class="kpi mini-kpi total"><h3>Opportunity</h3><div class="big">${fmt(opportunity)} lb<small>end of schedule + changeover + downtime · ${fmt(opportunity / (gasTot + evTot) * 100, 1)}% of gas in the period</small></div></div>`;
    $$("#an-events-kpis .kpi[data-cat]").forEach(k => k.onclick = () => { evFilter = evFilter === k.dataset.cat ? null : k.dataset.cat; renderEvents(); });
  };
  renderEvents();
  mkChart("events", "#an-chart-events", { type: "bar",
    data: { labels: catOrder.map(c => CATS[c]), datasets: lines.map(L => ({ label: `${L} Line`, data: catOrder.map(c => byCat[c][L] || 0), backgroundColor: L === "C" ? catOrder.map(c => CAT_COLORS[c]) : catOrder.map(c => CAT_COLORS[c] + "88"), borderColor: catOrder.map(c => CAT_COLORS[c]), borderWidth: L === "D" ? 2 : 0, borderRadius: 6, stack: "s" })) },
    options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, animation: { duration: 900, easing: "easeOutQuart" },
      onClick: (evt, els) => { if (!els.length) return; const c = catOrder[els[0].index]; evFilter = evFilter === c ? null : c; renderEvents(); },
      plugins: { legend: { display: lines.length > 1 }, tooltip: { callbacks: { footer: (its) => { const c = catOrder[its[0].dataIndex]; return `${byCat[c].n} events · ${fmt(byCat[c].hrs, 1)} h`; } } } },
      scales: { x: { stacked: true, beginAtZero: true, title: { display: true, text: "gas lb" } }, y: { stacked: true } } } });

  // ===== start-of-run effect =====
  const runsList = [];
  lines.forEach(L => { const g = all.filter(r => r.line === L).sort((a, b) => a.date.localeCompare(b.date) || a.shift - b.shift); let cur = null, prev = null;
    g.forEach(r => { const t = new Date(r.date).getTime() + SHIFT_START[r.shift] * 3600e3; if (prev == null || t - prev > 9 * 3600e3) { cur = { line: L, shifts: [] }; runsList.push(cur); } cur.shifts.push(r); prev = t; }); });
  const runStats = runsList.filter(rn => rn.shifts.length >= 2).map(rn => { const first = rn.shifts[0], rest = rn.shifts.slice(1); const wF = first.wastePct, wR = wasteOf(rest); const gR = rest.reduce((a, r) => a + r.totalLb, 0) / rest.reduce((a, r) => a + r.cans, 0) * G_PER_LB;
    return { rn, first, rest, wF, wR, cpmF: first.avgCpm, cpmR: med(rest.map(r => r.avgCpm)), extra: first.totalLb - first.cans * gR / G_PER_LB, label: `${rn.line} ${first.date.slice(5)}`, items: [...new Set(rn.shifts.flatMap(r => r.itemRows.map(x => x.code)))].join(", ") }; });
  const firsts = runStats.map(s => s.first), rests = runStats.flatMap(s => s.rest);
  const extraTot = runStats.reduce((x, s) => x + Math.max(0, s.extra), 0);
  $("#an-start-text").innerHTML = runStats.length ? `The first shift of a run is consistently the worst: median <b>${fmt(med(firsts.map(r => r.wastePct)))}% over target</b> against <b>${fmt(med(rests.map(r => r.wastePct)))}%</b> for the shifts that follow. The reason is visible in the filler — first shifts average ${fmt(med(firsts.map(r => r.avgCpm)))} cpm versus ${fmt(med(rests.map(r => r.avgCpm)))} cpm later — so the same fixed bleed is spread over far fewer cans while the line is being brought up. In ${runStats.length} runs that cost about <b>${fmt(extraTot)} lb</b> more than if the first shift had run at the rest of the run's rate.` : "Need runs of 2+ shifts to measure.";
  $("#an-start-kpis").innerHTML = runStats.length ? `<div class="kpi mini-kpi"><h3>First shift of a run</h3><div class="big">${fmt(med(firsts.map(r => r.wastePct)))}%<small>median waste · ${firsts.length} shifts · ${fmt(med(firsts.map(r => r.avgCpm)))} cpm · ${fmt(med(firsts.map(r => r.eff)))}% efficiency</small></div></div><div class="kpi mini-kpi"><h3>Later shifts</h3><div class="big">${fmt(med(rests.map(r => r.wastePct)))}%<small>median waste · ${rests.length} shifts · ${fmt(med(rests.map(r => r.avgCpm)))} cpm · ${fmt(med(rests.map(r => r.eff)))}% efficiency</small></div></div>` : "";
  $("#an-start-table tbody").innerHTML = runStats.map(s => `<tr><td>${s.label}</td><td>${s.rn.line}</td><td>${s.items}</td><td class="num waste">${fmt(s.wF)}%</td><td class="num">${fmt(s.wR)}%</td><td class="num">${s.cpmF == null ? "—" : fmt(s.cpmF) + " cpm"}</td><td class="num">${s.cpmR == null ? "—" : fmt(s.cpmR) + " cpm"}</td><td class="num">${s.extra > 0 ? fmt(s.extra) + " lb" : "—"}</td></tr>`).join("");
  mkChart("start", "#an-chart-start", { type: "bar",
    data: { labels: runStats.map(s => s.label), datasets: [{ label: "first shift of run", data: runStats.map(s => s.wF), backgroundColor: "#c27a12", borderRadius: 6 }, { label: "rest of run", data: runStats.map(s => s.wR), backgroundColor: runStats.map(s => colors[s.rn.line]), borderRadius: 6 }] },
    options: { responsive: true, maintainAspectRatio: false, animation: { duration: 900, easing: "easeOutQuart" }, plugins: { tooltip: { callbacks: { afterBody: (its) => { const s = runStats[its[0].dataIndex]; return `${s.items}\nfiller ${s.cpmF == null ? "—" : fmt(s.cpmF)} cpm first shift vs ${s.cpmR == null ? "—" : fmt(s.cpmR)} cpm later`; } } } },
      scales: { y: { beginAtZero: true, title: { display: true, text: "gas % over target" }, ticks: { callback: v => v + "%" } }, x: { title: { display: true, text: "run (line · first day)" } } } } });

  // ===== not logged =====
  const idleRows = []; const runKeys = new Set(allRuns.map(r => `${r.line}|${r.run_date}|${r.shift}`));
  lines.forEach(L => { const pts = readingsBy[L] || []; if (!pts.length) return; const fill = fillerBy[L] || [];
    let t = new Date(from.value + "T00:00:00"); const endT = new Date(to.value + "T00:00:00"); endT.setDate(endT.getDate() + 1);
    for (; t < endT; t.setDate(t.getDate() + 1)) { const date = localDate(t);
      [1, 2, 3].forEach(sh => { if (runKeys.has(`${L}|${date}|${sh}`)) return; const [s, e] = shiftWindow(date, sh); const first = Math.max(s, pts[0].t), last = Math.min(e, pts[pts.length - 1].t); if (last <= first) return;
        const a = interp(pts, first), b = interp(pts, last); if (!a || !b) return; const n2o = b.n2o - a.n2o, n2 = b.n2 - a.n2, lb = n2o * D.n2o + n2 * D.n2; if (lb < 50) return;
        const hrs = (last - first) / 3600e3; const f = fill.filter(p => p.t >= s && p.t < e).map(p => p.cpm); const cpm = f.length ? f.reduce((x, y) => x + y, 0) / f.length : null;
        const ev = events.find(v => v.line === L && new Date(v.start_ts).getTime() < e && new Date(v.end_ts).getTime() > s);
        idleRows.push({ line: L, date, shift: sh, cov: `${new Date(first).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}–${new Date(last).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`, lb, lbHr: lb / hrs, vol: n2o / (n2o + n2) * 100, cpm, covered: !!ev, likely: ev ? `covered by confirmed event — ${CATS[ev.category].toLowerCase()}` : cpm != null && cpm > 30 ? "production not logged (filler was running)" : "line idle with gas up" }); }); } });
  idleRows.sort((x, y) => x.date.localeCompare(y.date) || x.shift - y.shift || x.line.localeCompare(y.line));
  $("#an-idle tbody").innerHTML = idleRows.map(r => `<tr class="${r.covered ? "muted" : ""}"><td>${r.line}</td><td class="date">${r.date}</td><td>${r.shift}</td><td>${r.cov}</td><td class="num">${fmt(r.lb)}</td><td class="num">${fmt(r.lbHr)}</td><td class="num">${fmt(r.vol, 1)}%</td><td class="num">${r.cpm == null ? "—" : fmt(r.cpm)}</td><td>${r.likely}</td></tr>`).join("") || `<tr><td colspan="9" class="empty">None in this range.</td></tr>`;
  const open = idleRows.filter(r => !r.covered), openTot = open.reduce((x, r) => x + r.lb, 0), covTot = idleRows.filter(r => r.covered).reduce((x, r) => x + r.lb, 0);
  $("#an-idle-text").innerHTML = idleRows.length ? `<b>${fmt(openTot)} lb</b> across ${open.length} unexplained shift${open.length === 1 ? "" : "s"}. A further ${fmt(covTot)} lb in ${idleRows.length - open.length} shifts is already explained by confirmed events (greyed).` : "";
  revealNow();
}
$("#an-item").addEventListener("change", loadAnalysis);
$("#an-line").addEventListener("click", (e) => { const b = e.target.closest("button[data-v]"); if (!b || b.classList.contains("on")) return; $$("#an-line button").forEach(x => x.classList.toggle("on", x === b)); loadAnalysis(); });
$("#an-refresh").addEventListener("click", loadAnalysis);
$$(".an-index a").forEach(link => link.addEventListener("click", (e) => { e.preventDefault(); const t = $("#" + link.dataset.target); if (!t) return; const y = t.getBoundingClientRect().top + window.scrollY - 160; window.scrollTo({ top: y, behavior: "smooth" }); }));
const anObserver = new IntersectionObserver((entries) => { entries.forEach(en => { if (en.isIntersecting) $$(".an-index a").forEach(l => l.classList.toggle("active", l.dataset.target === en.target.id)); }); }, { rootMargin: "-25% 0px -65% 0px" });
$$("#page-analysis h2[id]").forEach(h2 => anObserver.observe(h2));

/* ---------- scroll reveal (Onyx / Palantir style) ---------- */
function splitWords(el) { if (el.dataset.split) return; el.dataset.split = "1"; const words = el.textContent.trim().split(/\s+/); el.innerHTML = words.map((w, i) => `<span class="w"><span style="--i:${i}">${w}</span></span>`).join(" "); }
$$(".reveal h2").forEach(splitWords);
(() => { const sent = $("#an-sentinel"), head = $(".an-head"); if (!sent || !head) return;
  const check = () => { if ($("#page-analysis").classList.contains("hidden")) return; head.classList.toggle("floating", sent.getBoundingClientRect().top < 72); };
  window.addEventListener("scroll", check, { passive: true }); window.addEventListener("hashchange", () => setTimeout(check, 100)); })();
const revealObs = new IntersectionObserver((entries) => { entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); revealObs.unobserve(en.target); } }); }, { rootMargin: "0px 0px -10% 0px", threshold: 0.08 });
function revealNow() { $$(".reveal:not(.in)").forEach(el => { const r = el.getBoundingClientRect(); if (r.top < window.innerHeight * 0.9) el.classList.add("in"); else revealObs.observe(el); }); }

/* ---------- conversions ---------- */
const MW = { n2o: 44.013, n2: 28.014 };
function massFromVol(v) { return v * D.n2o / (v * D.n2o + (1 - v) * D.n2); }          // N2O fraction by mass from fraction by volume
function volFromMass(m) { const a = m / MW.n2o, b = (1 - m) / MW.n2; return a / (a + b); } // by volume (= molar) from by mass
function renderConvert() {
  const f = $("#conv-form"), out = $("#conv-out");
  const big = (label, value, unit, cls = "") => `<div class="stat ${cls}"><span>${label}</span><b>${value}</b><small>${unit}</small></div>`;
  const run = () => {
    const gas = f.elements.gas.value, unit = f.elements.unit.value, amt = Number(f.elements.amount.value) || 0, r = Math.min(1, Math.max(0, Number(f.elements.ratio.value) / 100));
    $("#conv-ratio-wrap").classList.toggle("hidden", gas !== "blend");
    const toScf = (a, u, d) => u === "scf" ? a : u === "lb" ? a / d : u === "g" ? a / G_PER_LB / d : a * 1000 / G_PER_LB / d;
    const block = (name, scf, d, cls) => { const lb = scf * d; return `<div class="result-row ${cls}"><h4>${name}</h4>${big("scf", fmt(scf, 1), "standard cu ft")}${big("lb", fmt(lb, 2), "pounds")}${big("g", fmt(lb * G_PER_LB, 0), "grams")}${big("kg", fmt(lb * G_PER_LB / 1000, 3), "kilograms")}</div>`; };
    if (gas === "n2o") out.innerHTML = block("N₂O", toScf(amt, unit, D.n2o), D.n2o, "n2o");
    else if (gas === "n2") out.innerHTML = block("N₂", toScf(amt, unit, D.n2), D.n2, "n2");
    else {
      const dBlend = r * D.n2o + (1 - r) * D.n2, scfTot = toScf(amt, unit, dBlend);
      out.innerHTML = block(`N₂O · ${(r * 100).toFixed(1)}% by volume`, scfTot * r, D.n2o, "n2o") + block(`N₂ · ${((1 - r) * 100).toFixed(1)}% by volume`, scfTot * (1 - r), D.n2, "n2") + block("Blend total", scfTot, dBlend, "total")
        + `<p class="result-note">By mass this blend is ${(massFromVol(r) * 100).toFixed(1)}% N₂O. One scf of it weighs ${fmt(dBlend, 4)} lb.</p>`;
    }
  };
  f.onsubmit = (e) => { e.preventDefault(); run(); }; f.elements.gas.onchange = run; run();

  const bf = $("#bom-form"), bo = $("#bom-out");
  const runBom = () => {
    const g = Number(bf.elements.gcan.value) || 0, cans = Math.max(1, Number(bf.elements.cans.value) || 12), pct = Math.min(1, Math.max(0, Number(bf.elements.pct.value) / 100)), basis = bf.elements.basis.value;
    const mN2O = basis === "vol" ? massFromVol(pct) : pct, vN2O = basis === "vol" ? pct : volFromMass(pct);
    const gO = g * mN2O, gN = g * (1 - mN2O), lbO = gO * cans / G_PER_LB, lbN = gN * cans / G_PER_LB;
    bo.innerHTML = `<div class="result-row n2o"><h4>N₂O</h4>${big("per can", gO.toFixed(2), "grams")}${big("by mass", (mN2O * 100).toFixed(1) + "%", "of gas weight")}${big("by volume", (vN2O * 100).toFixed(1) + "%", "blender basis")}${big("BOM", lbO.toFixed(4), `lb per case of ${cans}`)}</div>
      <div class="result-row n2"><h4>N₂</h4>${big("per can", gN.toFixed(2), "grams")}${big("by mass", ((1 - mN2O) * 100).toFixed(1) + "%", "of gas weight")}${big("by volume", ((1 - vN2O) * 100).toFixed(1) + "%", "blender basis")}${big("BOM", lbN.toFixed(4), `lb per case of ${cans}`)}</div>
      <div class="result-row total"><h4>Total</h4>${big("per can", g.toFixed(2), "grams")}${big("", "", "")}${big("", "", "")}${big("BOM", (lbO + lbN).toFixed(4), `lb per case of ${cans}`)}</div>
      <p class="result-note">${basis === "vol" ? `A setpoint of ${(pct * 100).toFixed(1)}% by volume puts ${(mN2O * 100).toFixed(1)}% of the gas mass in as N₂O.` : `A setpoint of ${(pct * 100).toFixed(1)}% by mass corresponds to ${(vN2O * 100).toFixed(1)}% by volume on a blender that meters scf.`} BOM figures are lb per case with no scrap allowance.</p>`;
  };
  bf.onsubmit = (e) => { e.preventDefault(); runBom(); }; runBom();
}

boot();
