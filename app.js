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
const DEFAULT_TARGET_G = 4.87;                    // g gas per can when item target is blank
const PASSWORD_HASH = "b4b9c4c60e9dd10880a39f1825f1de018e23aea06e08b8d94aa336519d5fc088";
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
  $$(".rail a").forEach(a => a.classList.toggle("active", a.dataset.page === page));
  loaders[page]();
}
window.addEventListener("hashchange", () => navigate(location.hash.replace("#", "")));

/* ---------- items ---------- */
async function loadItems() { items = await fetchAll("items", "code"); }
function renderItems() {
  const tb = $("#items-table tbody"); tb.innerHTML = "";
  items.forEach(it => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${it.code}</td><td>${it.brand || ""}</td><td>${it.description || ""}</td>
      <td class="num">${it.can_size_oz ?? ""}</td><td class="num">${it.n2o_ratio_vol != null ? (it.n2o_ratio_vol * 100).toFixed(1) + "%" : "<span class='empty'>default</span>"}</td>
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
  const sel = $("#run-item"); sel.innerHTML = `<option value="">— not recorded —</option>` + items.map(i => `<option value="${i.code}">${i.code}${i.brand ? " — " + i.brand : ""}</option>`).join("");
}
$("#item-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const row = formData(e.target); row.code = row.code.trim().toUpperCase();
  const { error } = await sb.from("items").upsert(row);
  if (error) return toast(error.message, true);
  e.target.reset(); await loadItems(); renderItems(); toast(`Saved ${row.code}`);
});
$("#items-export").addEventListener("click", () => csv(items.map(i => ({ code: i.code, brand: i.brand, description: i.description, can_size_oz: i.can_size_oz, n2o_ratio_vol: i.n2o_ratio_vol, target_gas_g: i.target_gas_g })), "items.csv"));

/* ---------- production runs ---------- */
async function loadRuns() {
  renderItems();
  const rows = await fetchAll("production_runs", "run_date", false);
  const tb = $("#runs-table tbody"); tb.innerHTML = "";
  rows.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${r.run_date}</td><td>${r.shift}</td><td>${r.item_code || "<span class='empty'>—</span>"}</td><td class="num">${fmt(r.cases)}</td><td class="num">${r.cans_per_case}</td><td>${r.notes || ""}</td>
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
  const row = formData(e.target); row.shift = Number(row.shift);
  const { error } = await sb.from("production_runs").insert(row);
  if (error) return toast(error.message, true);
  e.target.reset(); e.target.elements.cans_per_case.value = 12; loadRuns(); toast("Run saved");
});

/* ---------- meter readings ---------- */
function parseReadings(text) {
  const rows = [];
  text.split(/\r?\n/).forEach(line => {
    const parts = line.split(/[\t,;]/).map(s => s.trim().replace(/^"|"$/g, ""));
    if (parts.length < 3) return;
    const ts = new Date(parts[0]); const a = Number(parts[1]); const b = Number(parts[2]);
    if (isNaN(ts) || isNaN(a) || isNaN(b)) return;
    rows.push({ ts: ts.toISOString(), n2o_scf: a, n2_scf: b });
  });
  return rows;
}
$("#readings-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const rows = parseReadings(e.target.elements.paste.value);
  if (!rows.length) return toast("No readings recognised in the pasted text", true);
  const seen = new Set(); const uniq = rows.filter(r => !seen.has(r.ts) && seen.add(r.ts));
  let ok = 0;
  for (let i = 0; i < uniq.length; i += 500) {
    const { error } = await sb.from("gas_readings").upsert(uniq.slice(i, i + 500), { onConflict: "ts", ignoreDuplicates: true });
    if (error) return toast(error.message, true);
    ok += Math.min(500, uniq.length - i);
    $("#readings-status").textContent = `Imported ${ok} of ${uniq.length}…`;
  }
  $("#readings-status").textContent = ""; e.target.reset(); loadReadings(); toast(`Imported ${uniq.length} readings`);
});
function shiftOf(d) { // returns {date:'YYYY-MM-DD', shift}
  const h = d.getHours(); let date = new Date(d); let shift;
  if (h >= 7 && h < 15) shift = 1; else if (h >= 15 && h < 23) shift = 2; else { shift = 3; if (h < 7) date.setDate(date.getDate() - 1); }
  return { date: localDate(date), shift };
}
async function loadReadings() {
  const rows = await fetchAll("gas_readings", "ts");
  const pts = rows.map(r => ({ t: new Date(r.ts).getTime(), n2o: Number(r.n2o_scf), n2: Number(r.n2_scf) }));
  const groups = {};
  pts.forEach(p => { const k = shiftOf(new Date(p.t)); const key = `${k.date}|${k.shift}`; (groups[key] = groups[key] || { ...k, n: 0 }).n++; });
  const tb = $("#readings-table tbody"); tb.innerHTML = "";
  Object.values(groups).sort((a, b) => b.date.localeCompare(a.date) || b.shift - a.shift).forEach(g => {
    const [s, e] = shiftWindow(g.date, g.shift);
    const first = Math.max(s, pts[0].t), last = Math.min(e, pts[pts.length - 1].t);
    const a = interp(pts, first), b = interp(pts, last);
    const n2o = b.n2o - a.n2o, n2 = b.n2 - a.n2, pct = n2o + n2 > 0 ? n2o / (n2o + n2) * 100 : null;
    const full = first === s && last === e;
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${g.date}</td><td>${g.shift}</td><td>${new Date(first).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}–${new Date(last).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}${full ? "" : " (partial)"}</td>
      <td class="num">${fmt(g.n)}</td><td class="num n2o">${fmt(n2o)}</td><td class="num n2">${fmt(n2)}</td><td class="num n2o">${fmt(n2o * D.n2o)}</td><td class="num n2">${fmt(n2 * D.n2)}</td>
      <td>${pct == null ? "—" : `N₂O ${pct.toFixed(1)}% / ${(100 - pct).toFixed(1)}% N₂`}</td>`;
    tb.appendChild(tr);
  });
  $("#readings-export").onclick = () => csv(rows, "gas_readings.csv");
}

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
async function loadDashboard() {
  const from = $("#dash-from"), to = $("#dash-to");
  if (!from.value) { const t = new Date(); to.value = localDate(t); t.setDate(t.getDate() - 30); from.value = localDate(t); }
  const [runs, raw] = await Promise.all([
    sb.from("production_runs").select("*").gte("run_date", from.value).lte("run_date", to.value).order("run_date").order("shift").then(r => r.data || []),
    fetchAll("gas_readings", "ts"),
  ]);
  const readings = raw.map(r => ({ t: new Date(r.ts).getTime(), n2o: Number(r.n2o_scf), n2: Number(r.n2_scf) }));
  const dN2O = D.n2o, dN2 = D.n2, defTarget = DEFAULT_TARGET_G;

  // group runs by date+shift (several items may run in one shift)
  const groups = {};
  runs.forEach(r => { const k = `${r.run_date}|${r.shift}`; (groups[k] = groups[k] || { date: r.run_date, shift: r.shift, runs: [] }).runs.push(r); });
  const out = [];
  Object.values(groups).sort((a, b) => a.date.localeCompare(b.date) || a.shift - b.shift).forEach(g => {
    const [s, e] = shiftWindow(g.date, g.shift);
    const last = readings.length ? readings[readings.length - 1].t : 0;
    const eUse = (e > last && e - last <= 15 * 60e3) ? last : e;   // accept an export that stops within 15 min of shift end
    const a = interp(readings, s), b = interp(readings, eUse);
    let cans = 0, targetLb = 0;
    g.runs.forEach(r => {
      const it = items.find(i => i.code === r.item_code) || {};
      const n = r.cases * (r.cans_per_case || 12); cans += n;
      targetLb += n * (it.target_gas_g ?? defTarget) / G_PER_LB;
    });
    const cases = g.runs.reduce((x, r) => x + r.cases, 0);
    const row = { date: g.date, shift: g.shift, cases, cans, targetLb };
    if (a && b) {
      row.n2oScf = b.n2o - a.n2o; row.n2Scf = b.n2 - a.n2;
      row.n2oLb = row.n2oScf * dN2O; row.n2Lb = row.n2Scf * dN2; row.totalLb = row.n2oLb + row.n2Lb;
      row.volPct = row.n2oScf / (row.n2oScf + row.n2Scf) * 100;
      row.gPerCan = cans ? row.totalLb * G_PER_LB / cans : null;
      row.wf = targetLb ? row.totalLb / targetLb : null; row.wastePct = targetLb ? (row.totalLb - targetLb) / targetLb * 100 : null;
    }
    out.push(row);
  });

  const tb = $("#dash-table tbody"); tb.innerHTML = "";
  out.forEach(r => {
    const tr = document.createElement("tr");
    if (r.totalLb == null) { tr.className = "muted"; tr.innerHTML = `<td>${r.date}</td><td>${r.shift}</td><td class="num">${fmt(r.cases)}</td><td class="num">${fmt(r.cans)}</td><td colspan="8">no meter data for this shift</td>`; }
    else tr.innerHTML = `<td>${r.date}</td><td>${r.shift}</td><td class="num">${fmt(r.cases)}</td><td class="num">${fmt(r.cans)}</td>
      <td class="num n2o">${fmt(r.n2oLb)}</td><td class="num n2">${fmt(r.n2Lb)}</td><td class="num">${fmt(r.totalLb)}</td><td class="num">${fmt(r.volPct, 1)}%</td>
      <td class="num">${fmt(r.targetLb)}</td><td class="num">${fmt(r.gPerCan, 1)}</td><td class="num waste">${fmt(r.wf, 2)}×</td><td class="num">${fmt(r.wastePct)}%</td>`;
    tb.appendChild(tr);
  });
  const have = out.filter(r => r.totalLb != null);
  const T = have.reduce((a, r) => ({ lb: a.lb + r.totalLb, tgt: a.tgt + r.targetLb, cans: a.cans + r.cans, cases: a.cases + r.cases }), { lb: 0, tgt: 0, cans: 0, cases: 0 });
  $("#dash-summary").textContent = have.length
    ? `${have.length} shifts with meter data: ${fmt(T.cases)} cases, ${fmt(T.lb)} lb of blended gas metered against ${fmt(T.tgt)} lb needed at target — waste factor ${(T.lb / T.tgt).toFixed(2)}×, ${fmt(T.lb * G_PER_LB / T.cans, 1)} g per can.`
    : "No shifts with both production and meter data in this range. Add runs and import meter readings to see consumption.";

  if (chart) chart.destroy();
  chart = new Chart($("#chart-waste"), {
    type: "bar",
    data: { labels: have.map(r => `${r.date.slice(5)} S${r.shift}`),
      datasets: [{ label: "Waste factor (metered ÷ target)", data: have.map(r => r.wf), backgroundColor: "#c27a12" }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, title: { display: true, text: "× target" } } } }
  });
  $("#dash-export").onclick = () => csv(out.map(r => ({ date: r.date, shift: r.shift, cases: r.cases, cans: r.cans, n2o_scf: r.n2oScf, n2_scf: r.n2Scf, n2o_lb: r.n2oLb, n2_lb: r.n2Lb, total_lb: r.totalLb, n2o_pct_vol: r.volPct, target_lb: r.targetLb, g_per_can: r.gPerCan, waste_factor: r.wf, waste_pct: r.wastePct })), "consumption_by_shift.csv");
}
$("#dash-refresh").addEventListener("click", loadDashboard);

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
