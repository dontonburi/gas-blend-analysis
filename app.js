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

let settings = {};
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

/* ---------- auth ---------- */
async function boot() {
  if (!sb) return;
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session) showApp(); else showSignin();
    sb.auth.onAuthStateChange((_e, s) => s ? showApp() : showSignin());
  } catch (err) { $("#signin-error").textContent = "Could not start: " + err.message; }
}
function showSignin() { $("#signin").classList.remove("hidden"); $("#app").classList.add("hidden"); }
async function showApp() {
  $("#signin").classList.add("hidden"); $("#app").classList.remove("hidden");
  await loadSettings(); await loadItems();
  navigate(location.hash.replace("#", "") || "dashboard");
}
$("#signin-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!sb) return;
  if (!CONFIG.LOGIN_EMAIL) { $("#signin-error").textContent = "LOGIN_EMAIL is not set in config.js."; return; }
  const { error } = await sb.auth.signInWithPassword({ email: CONFIG.LOGIN_EMAIL, password: $("#password").value });
  $("#signin-error").textContent = error ? (error.message === "Invalid login credentials" ? "Wrong password, or the user hasn't been created in Supabase yet." : error.message) : "";
  if (!error) $("#password").value = "";
});
$("#signout").addEventListener("click", () => sb.auth.signOut());

/* ---------- navigation ---------- */
const loaders = { dashboard: loadDashboard, runs: loadRuns, readings: loadReadings, checks: loadChecks, items: renderItems, settings: renderSettings };
function navigate(page) {
  if (!loaders[page]) page = "dashboard";
  $$(".page").forEach(p => p.classList.add("hidden"));
  $(`#page-${page}`).classList.remove("hidden");
  $$(".rail a").forEach(a => a.classList.toggle("active", a.dataset.page === page));
  loaders[page]();
}
window.addEventListener("hashchange", () => navigate(location.hash.replace("#", "")));

/* ---------- settings ---------- */
async function loadSettings() {
  const { data } = await sb.from("settings").select("*");
  settings = {}; (data || []).forEach(r => settings[r.key] = { value: Number(r.value), label: r.label });
}
function renderSettings() {
  const f = $("#settings-form"); f.innerHTML = "";
  Object.entries(settings).forEach(([k, s]) => {
    const l = document.createElement("label"); l.textContent = s.label || k;
    const i = document.createElement("input"); i.type = "number"; i.step = "any"; i.name = k; i.value = s.value; l.appendChild(i); f.appendChild(l);
  });
  const b = document.createElement("button"); b.className = "primary"; b.textContent = "Save settings"; f.appendChild(b);
  f.onsubmit = async (e) => {
    e.preventDefault();
    const rows = Object.keys(settings).map(k => ({ key: k, value: Number(f.elements[k].value), label: settings[k].label }));
    const { error } = await sb.from("settings").upsert(rows);
    if (error) return toast(error.message, true);
    await loadSettings(); toast("Settings saved");
  };
}

/* ---------- items ---------- */
async function loadItems() { items = await fetchAll("items", "code"); }
function renderItems() {
  const tb = $("#items-table tbody"); tb.innerHTML = "";
  items.forEach(it => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${it.code}</td><td>${it.family || ""}</td><td>${it.description || ""}</td>
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
  const sel = $("#run-item"); sel.innerHTML = `<option value="">— not recorded —</option>` + items.map(i => `<option value="${i.code}">${i.code}</option>`).join("");
}
$("#item-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const row = formData(e.target); row.code = row.code.trim().toUpperCase();
  const { error } = await sb.from("items").upsert(row);
  if (error) return toast(error.message, true);
  e.target.reset(); await loadItems(); renderItems(); toast(`Saved ${row.code}`);
});
$("#items-export").addEventListener("click", () => csv(items, "items.csv"));

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
  e.target.reset(); e.target.elements.cans_per_case.value = settings.cans_per_case?.value || 12; loadRuns(); toast("Run saved");
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
async function loadReadings() {
  const rows = await fetchAll("gas_readings", "ts");
  const days = {};
  rows.forEach(r => { const d = localDate(new Date(r.ts)); (days[d] = days[d] || []).push(r); });
  const tb = $("#readings-table tbody"); tb.innerHTML = "";
  Object.keys(days).sort().reverse().forEach(d => {
    const v = days[d]; const f = v[0], l = v[v.length - 1];
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${d}</td><td>${new Date(f.ts).toLocaleTimeString()}</td><td>${new Date(l.ts).toLocaleTimeString()}</td>
      <td class="num">${fmt(v.length)}</td><td class="num n2o">${fmt(l.n2o_scf - f.n2o_scf)}</td><td class="num n2">${fmt(l.n2_scf - f.n2_scf)}</td>`;
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
  const tb = $("#checks-table tbody"); tb.innerHTML = "";
  rows.slice(0, 500).forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${r.check_date}</td><td>${r.gasser}</td><td>${r.check_time || ""}</td><td>${r.initials || ""}</td><td class="num">${r.head ?? ""}</td>
      <td class="num">${r.before_g ?? ""}</td><td class="num">${r.after_g ?? ""}</td><td class="num">${r.weight_g ?? ""}</td><td class="num">${r.correction_g ?? ""}</td>
      <td><button class="small danger" data-del="${r.id}">Delete</button></td>`;
    tb.appendChild(tr);
  });
  tb.onclick = async (e) => {
    const id = e.target.dataset.del; if (!id || !confirm("Delete this reading?")) return;
    const { error } = await sb.from("gas_weight_checks").delete().eq("id", id);
    if (error) return toast(error.message, true);
    loadChecks(); toast("Reading deleted");
  };
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
  const dN2O = settings.n2o_lb_per_scf?.value ?? 0.116, dN2 = settings.n2_lb_per_scf?.value ?? 0.0739;
  const defRatio = settings.default_n2o_ratio_vol?.value ?? 0.85, defTarget = settings.default_target_gas_g?.value ?? 4.87;

  // group runs by date+shift (several items may run in one shift)
  const groups = {};
  runs.forEach(r => { const k = `${r.run_date}|${r.shift}`; (groups[k] = groups[k] || { date: r.run_date, shift: r.shift, runs: [] }).runs.push(r); });
  const out = [];
  Object.values(groups).sort((a, b) => a.date.localeCompare(b.date) || a.shift - b.shift).forEach(g => {
    const [s, e] = shiftWindow(g.date, g.shift);
    const a = interp(readings, s), b = interp(readings, e);
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

boot();
