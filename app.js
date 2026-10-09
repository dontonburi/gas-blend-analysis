/* Gas Blend Runs: app logic. Talks directly to Supabase; charts are Apache ECharts; no build step. */

const $ = (s) => document.querySelector(s);
const PREVIEW = !!window.GBR_PREVIEW;                 // set only by the design-preview artifact
document.documentElement.classList.add("js");
let sb;
try {
  if (typeof CONFIG === "undefined") throw new Error("config.js is missing or failed to load.");
  if (typeof supabase === "undefined") throw new Error("Supabase library did not load (check internet / ad blocker).");
  // sign-in lasts for this browser tab (sessionStorage), like the old password gate
  const mem = {}, tabStore = { getItem: (k) => { try { return sessionStorage.getItem(k); } catch (e) { return mem[k] ?? null; } }, setItem: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) { mem[k] = v; } }, removeItem: (k) => { try { sessionStorage.removeItem(k); } catch (e) { delete mem[k]; } } };
  sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, { auth: { storage: tabStore, storageKey: "gbr-auth", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
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
// Supabase Auth accounts behind the one password box; the database only answers these signed-in roles
const ACCOUNTS = [{ email: "admin@gas-blend-runs.app", role: "admin" }, { email: "guest@gas-blend-runs.app", role: "guest" }];
const normCode = (c) => (c || "").trim().toUpperCase().replace(/^([A-Z]{2}\d+).*$/, "$1");   // AD28-T, AG45-WIP -> AD28, AG45
let items = [];

/* ---------- helpers ---------- */
function toast(msg, isError = false) {
  const t = $("#toast");
  t.textContent = msg; t.className = "toast show" + (isError ? " error" : "");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 3500);
}
function fmt(n, d = 0) { return n == null || isNaN(n) ? "—" : Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }); }
function formData(form) {
  const o = {};
  new FormData(form).forEach((v, k) => { o[k] = v === "" ? null : (form.elements[k].type === "number" ? Number(v) : v); });
  return o;
}
function csv(rows, filename) {
  if (PREVIEW) return toast("CSV export works on the live site; it's off in the preview");
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
const shortDate = (s) => `${+s.slice(5, 7)}/${+s.slice(8, 10)}`;
const esc = (v) => String(v ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function segVal(sel) { return $(`${sel} button.on`)?.dataset.v || "ALL"; }
function segBind(sel, fn) { $(sel).addEventListener("click", (e) => { const b = e.target.closest("button[data-v]"); if (!b || b.classList.contains("on")) return; $$(`${sel} button`).forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", String(x === b)); }); fn(b.dataset.v); }); }
function segSet(sel, v) { $$(`${sel} button`).forEach(x => { x.classList.toggle("on", x.dataset.v === v); x.setAttribute("aria-pressed", String(x.dataset.v === v)); }); }

/* ---------- charts: Apache ECharts, drawn when they scroll into view, morphing on every update ---------- */
const COL = { C: "#2563b0", D: "#22a7c4", both: "#457a94", amber: "#c27a12", ink: "#031b27", ink2: "#6f7378", grid: "rgba(92,92,97,.13)", axis: "rgba(92,92,97,.38)" };
const LINE_NAME = { C: "C Line", D: "D Line" };
const FONT = '"DM Sans", "Helvetica Neue", Helvetica, Arial, sans-serif';
const REDUCED = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)").matches : false;
const AX = { axisLine: { lineStyle: { color: COL.axis } }, axisTick: { show: false }, axisLabel: { color: COL.ink2, fontFamily: FONT, fontSize: 12, hideOverlap: true }, splitLine: { lineStyle: { color: COL.grid, type: [4, 4] } }, nameTextStyle: { color: COL.ink2, fontFamily: FONT, fontSize: 12 } };
const TIP = { backgroundColor: "#ffffff", borderColor: "rgba(3,27,39,.08)", borderWidth: 1, padding: [10, 14], textStyle: { color: COL.ink, fontFamily: FONT, fontSize: 13 }, extraCssText: "border-radius:12px;box-shadow:0 12px 32px rgba(3,27,39,.16);max-width:340px;white-space:normal;" };
const LEG = { top: 0, right: 0, icon: "roundRect", itemWidth: 12, itemHeight: 12, itemGap: 18, textStyle: { color: COL.ink, fontFamily: FONT, fontSize: 13 } };
const ZOOM_SLIDER = { type: "slider", height: 20, bottom: 6, borderColor: "transparent", backgroundColor: "rgba(212,241,255,.45)", fillerColor: "rgba(37,99,176,.16)", dataBackground: { lineStyle: { color: COL.axis }, areaStyle: { color: "rgba(92,92,97,.08)" } }, handleSize: "120%", handleStyle: { color: "#fff", borderColor: COL.C }, moveHandleSize: 0, textStyle: { color: COL.ink2, fontFamily: FONT, fontSize: 11 }, brushSelect: false };
const dot = (c) => `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${c};margin-right:6px"></span>`;
const pct = (v) => v == null || isNaN(v) ? "—" : `${v > 0 ? "+" : ""}${fmt(v)}%`;
function chartBase(extra) {
  return Object.assign({ textStyle: { fontFamily: FONT, color: COL.ink2 }, animation: !REDUCED, animationDuration: 1000, animationEasing: "cubicOut", animationDurationUpdate: 750, animationEasingUpdate: "cubicInOut", tooltip: { ...TIP }, legend: { ...LEG } }, extra);
}
const charts = {};
const chartIO = window.IntersectionObserver ? new IntersectionObserver((entries) => entries.forEach(en => { if (en.isIntersecting) { const c = Object.values(charts).find(x => x.el === en.target); if (c && !c.inst) initChart(c); } }), { rootMargin: "0px 0px -8% 0px", threshold: .15 }) : null;
function initChart(c) {
  if (typeof echarts === "undefined") { c.el.closest(".chart-wrap")?.classList.add("nolib"); return; }
  c.inst = echarts.init(c.el, null, { renderer: "canvas" });
  c.inst.on("click", (p) => c.handlers.click && c.handlers.click(p));
  chartIO && chartIO.unobserve(c.el);
  c.inst.setOption(c.option, true);
}
// draw (or update) a chart. Series keep their ids between updates, so switching C / D / Both morphs instead of redrawing.
function drawChart(key, sel, option, handlers = {}) {
  const el = $(sel); if (!el) return;
  const wrap = el.closest(".chart-wrap"); wrap?.classList.remove("loading");
  let c = charts[key];
  if (c && c.el !== el) { c.inst && c.inst.dispose(); c = null; }
  if (!c) c = charts[key] = { el, inst: null, option: null, handlers };
  c.option = option; c.handlers = handlers;
  if (c.inst) { c.inst.setOption(option, { replaceMerge: ["series", "xAxis", "yAxis", "grid", "dataZoom"] }); c.inst.resize(); return c; }
  const r = el.getBoundingClientRect();
  if (!chartIO || (r.width && r.top < innerHeight * .92 && r.bottom > 0)) initChart(c); else chartIO.observe(el);
  return c;
}
function resizeCharts() { Object.values(charts).forEach(c => c.inst && c.el.offsetParent && c.inst.resize()); }
let _rz; window.addEventListener("resize", () => { clearTimeout(_rz); _rz = setTimeout(resizeCharts, 120); });

/* ---------- sign in (Supabase Auth) ---------- */
let currentRole = null;
function showSignin() { $("#signin").classList.remove("hidden"); $("#app").classList.add("hidden"); }
async function showApp() {
  $("#signin").classList.add("hidden"); $("#app").classList.remove("hidden");
  await loadItems();
  navigate(location.hash.replace("#", "") || "dashboard");
}
window.addEventListener("scroll", () => document.body.classList.toggle("scrolled", window.scrollY > 10), { passive: true });
const ADMIN_PAGES = ["runs", "readings", "checks"];
function role() { return PREVIEW ? "admin" : currentRole; }
const roleOf = (user) => user?.app_metadata?.role === "admin" ? "admin" : user?.app_metadata?.role === "guest" ? "guest" : null;
function applyRole() { const guest = role() === "guest"; document.body.classList.toggle("guest", guest); $("#signout").textContent = guest ? "Sign out (guest)" : "Sign out"; }
// when embedded (e.g. a SharePoint Embed web part), offer a link to open the site in its own tab
const EMBEDDED = !PREVIEW && (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
if (EMBEDDED) { const show = () => $("#open-full")?.classList.remove("hidden"); document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", show) : show(); }
async function boot() {
  if (!sb) return;
  if (PREVIEW) { applyRole(); return showApp(); }
  const { data } = await sb.auth.getSession();
  currentRole = roleOf(data?.session?.user);
  if (currentRole) { applyRole(); showApp(); } else showSignin();
}
$("#signin-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const pw = $("#password").value, btn = e.target.querySelector("button[type=submit]"), err = $("#signin-error");
  err.textContent = ""; btn.disabled = true; btn.textContent = "Signing in…";
  let user = null, netErr = null;
  for (const a of ACCOUNTS) {
    const { data, error } = await sb.auth.signInWithPassword({ email: a.email, password: pw });
    if (!error && data?.user) { user = data.user; break; }
    if (error && !/invalid login credentials/i.test(error.message)) netErr = error;
  }
  btn.disabled = false; btn.textContent = "Open";
  if (!user) { err.textContent = netErr ? `Couldn't reach the sign-in service (${netErr.message}). Check the connection and try again.` : "Wrong password."; return; }
  currentRole = roleOf(user);
  if (!currentRole) { await sb.auth.signOut(); err.textContent = "This account has no access to the site."; return; }
  $("#password").value = ""; applyRole(); showApp();
});
$("#signout").addEventListener("click", async () => { if (PREVIEW) return toast("Sign-out is off in the preview"); await sb.auth.signOut(); currentRole = null; document.body.classList.remove("guest"); showSignin(); });

/* ---------- navigation ---------- */
const loaders = { analysis: loadAnalysis, dashboard: loadDashboard, runs: loadRuns, readings: loadReadings, checks: loadChecks, items: renderItems, convert: renderConvert };
function navigate(page) {
  if (!loaders[page]) page = "dashboard";
  if (!$("#app") || $("#app").classList.contains("hidden")) return;
  if (role() === "guest" && ADMIN_PAGES.includes(page)) page = "dashboard";
  $$(".page").forEach(p => p.classList.add("hidden"));
  $(`#page-${page}`).classList.remove("hidden");
  $$(".site-nav a").forEach(a => a.classList.toggle("active", a.dataset.page === page));
  $("#siteNav").classList.remove("open"); $("#menuBtn").setAttribute("aria-expanded", "false");
  const sec = $(`#page-${page}`); sec.style.animation = "none"; void sec.offsetWidth; sec.style.animation = "";
  $$(`#page-${page} .reveal`).forEach(el => el.classList.remove("in")); setTimeout(revealNow, 60);
  currentPage = page; window.scrollTo({ top: 0 });
  setTimeout(resizeCharts, 30);
  loaders[page]();
}
let currentPage = null;
const PAGE_IDS = Object.keys(loaders);
window.addEventListener("hashchange", () => { const hsh = location.hash.replace("#", ""); if (PAGE_IDS.includes(hsh) && hsh !== currentPage) navigate(hsh); });
$("#menuBtn").addEventListener("click", () => { const open = $("#siteNav").classList.toggle("open"); $("#menuBtn").setAttribute("aria-expanded", String(open)); });
$("#to-top").addEventListener("click", (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); });

/* ---------- items ---------- */
// guests read items through a view without description, cans per case or lb per case
async function loadItems() { items = await fetchAll(role() === "guest" ? "items_guest" : "items", "code"); }
let itemSort = { key: "code", dir: 1 };
function itemCalc(it) {
  if (it.n2o_g_per_can !== undefined) { const o = it.n2o_g_per_can == null ? null : Number(it.n2o_g_per_can), n = it.n2_g_per_can == null ? null : Number(it.n2_g_per_can);
    return { n2oG: o, n2G: n, totG: o == null && n == null ? null : (o || 0) + (n || 0), massR: it.bom_split_mass == null ? null : Number(it.bom_split_mass) }; }
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
    tr.innerHTML = `<td><b title="${(it.notes || "").replace(/"/g, "&quot;")}">${it.code}</b>${it.gas_blend === false ? " <small class='empty'>non-gas</small>" : ""}${it.notes ? " <span class='note-dot' title='" + it.notes.replace(/'/g, "&#39;") + "'>●</span>" : ""}</td><td><span class="chip chip-${(it.brand || "").replace(/[^a-z]/gi, "").toLowerCase()}">${it.brand || "—"}</span></td><td class="g-hide">${it.description || "<span class='empty'>—</span>"}</td><td class="num g-hide">${flag(it.cans_per_case)}</td>
      <td class="num grp g-hide">${it.n2o_lb_per_case != null ? Number(it.n2o_lb_per_case).toFixed(4) : flag(null)}</td><td class="num g-hide">${it.n2_lb_per_case != null ? Number(it.n2_lb_per_case).toFixed(4) : flag(null)}</td>
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
$("#items-export").addEventListener("click", () => csv(items.map(i => { const c = itemCalc(i); const g = role() === "guest";   // guests don't get description, cans/case or lb/case
    return { code: i.code, brand: i.brand, ...(g ? {} : { description: i.description, cans_per_case: i.cans_per_case, n2o_lb_per_case: i.n2o_lb_per_case, n2_lb_per_case: i.n2_lb_per_case }), n2o_g_per_can: c.n2oG, n2_g_per_can: c.n2G, total_g_per_can: c.totG, n2o_ratio_vol: i.n2o_ratio_vol, bom_split_mass: c.massR, target_gas_g: i.target_gas_g, notes: i.notes }; }), "items.csv"));

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
// Enact rows -> gas weight per line/date/shift. Only the gas-weight feature counts (not gas pressure or can weights).
// Parts: only gas-blend items on the Items list; anything else (e.g. "Regular Cream", non-blend codes) is ignored.
// Shift summaries arrive just after the shift ends, so shift 3 (ends 07:00) belongs to the previous day;
// daily summaries are stamped at midnight UTC, so their date is read in UTC.
function enactGasRows(enactRows) {
  return (enactRows || []).map(k => {
    const feat = String(k.feature_name || "").trim();
    if (!/^(operating )?gas weight$/i.test(feat)) return null;
    const part = String(k.part_name || "").trim(), code = normCode(part.split(/[ -]/)[0]);
    const it = items.find(i => i.code === code);
    if (!it || it.gas_blend === false) return null;   // gas-blend items from the Items list only
    const pn = String(k.process_name || "");
    const line = /D Line|D-Line|Aerosol D|Gasser D|\bD\b/i.test(pn) ? "D" : /C Line|C-Line|Aerosol C|Gasser C|\bC\b/i.test(pn) ? "C" : null;
    if (!line) return null;
    const sh = k.shift_name ? (/3|third|3rd|night/i.test(k.shift_name) ? 3 : /2|second|2nd|even|swing/i.test(k.shift_name) ? 2 : 1) : null;
    const t = new Date(k.summary_date); let date;
    if (sh) { if (sh === 3 && t.getHours() < 12) t.setDate(t.getDate() - 1); date = localDate(t); }
    else date = String(k.summary_date).slice(0, 10);
    return { ...k, line, shift: sh, date, item: it ? code : part, gasser: k.process_leaf || pn };
  }).filter(Boolean);
}
/* >>> gas-weight-compare: paper checks and Enact are the same measurement; shown per shift with the BOM and the waste factor */
function gasWeightModel(checks, enactRows, shiftRows) {
  const key = (l, d, s) => `${l}|${d}|${s}`, rows = {}; let noTime = 0, low = 0;
  checks.forEach(c => { const w = Number(c.weight_g); if (!(w >= 2.3)) { if (w > 0) low++; return; } const s = checkShift(c); if (!s) { noTime++; return; }
    const line = c.line || "C", k = key(line, s.date, s.shift), r = rows[k] = rows[k] || { line, date: s.date, shift: s.shift };
    const p = r.paper = r.paper || { n: 0, sum: 0, mn: Infinity, mx: -Infinity, items: {}, corr: 0 };
    p.n++; p.sum += w; p.mn = Math.min(p.mn, w); p.mx = Math.max(p.mx, w); if (c.item_code) p.items[c.item_code] = (p.items[c.item_code] || 0) + 1; if (c.correction_g != null && c.correction_g !== "") p.corr++; });
  const eg = enactGasRows(enactRows), ignored = (enactRows || []).filter(k => /^(operating )?gas weight$/i.test(String(k.feature_name || "").trim()) && k.shift_name).length - eg.filter(k => k.shift).length;
  eg.filter(k => k.shift).forEach(k => { const n = Number(k.piece_count) || 0, m = Number(k.mean); if (!(n > 0) || isNaN(m)) return;
    const kk = key(k.line, k.date, k.shift), r = rows[kk] = rows[kk] || { line: k.line, date: k.date, shift: k.shift };
    const e = r.enact = r.enact || { n: 0, sum: 0, gassers: [], items: new Set() }; e.n += n; e.sum += m * n; e.items.add(k.item); e.gassers.push({ gasser: k.gasser, item: k.item, n, mean: m, sd: Number(k.sd_long_term) }); });
  const byShift = {}; (shiftRows || []).forEach(s => byShift[key(s.line, s.date, s.shift)] = s);
  const bomOf = (code) => items.find(i => i.code === normCode(code))?.bom_gas_g_per_can ?? null;
  const list = Object.values(rows).map(r => {
    const s = byShift[key(r.line, r.date, r.shift)];
    if (r.paper) r.paper.g = r.paper.sum / r.paper.n;
    if (r.enact) r.enact.g = r.enact.sum / r.enact.n;
    const sheetItem = r.paper ? Object.entries(r.paper.items).sort((x, y) => y[1] - x[1])[0]?.[0] : null;
    r.item = sheetItem || (s && s.items) || (r.enact ? [...r.enact.items].join(" + ") : "") || "—";
    r.n = (r.paper?.n || 0) + (r.enact?.n || 0);
    r.measured = r.n ? ((r.paper?.sum || 0) + (r.enact?.sum || 0)) / r.n : null;     // cans-weighted average of both sources
    r.bom = s && s.bomLb > 0 && s.cans ? s.bomLb * G_PER_LB / s.cans : (r.item.includes("+") ? null : bomOf(r.item));
    r.vsBom = r.bom && r.measured ? (r.measured - r.bom) / r.bom * 100 : null;
    if (s && s.totalLb != null && s.cans && !s.nonGasOnly) { r.cans = s.cans; r.lb = s.totalLb; r.meterG = s.totalLb * G_PER_LB / s.cans;
      r.waste = r.measured ? (r.meterG - r.measured) / r.measured * 100 : null; r.wasteBom = s.bomLb > 0 ? (s.totalLb - s.bomLb) / s.bomLb * 100 : null; }
    return r; }).sort((x, y) => y.date.localeCompare(x.date) || y.shift - x.shift || x.line.localeCompare(y.line));
  const span = (arr) => arr.length ? [arr.reduce((m, d) => d < m ? d : m), arr.reduce((m, d) => d > m ? d : m)] : null;
  const coverage = [
    { label: "Paper checks", sub: [...new Set(list.filter(r => r.paper).map(r => r.line))].sort().map(l => l + " Line").join(", ") || "none", span: span(list.filter(r => r.paper).map(r => r.date)), cls: "paper" },
    { label: "Enact", sub: [...new Set(list.filter(r => r.enact).map(r => r.line))].sort().map(l => l + " Line").join(", ") || "none", span: span(list.filter(r => r.enact).map(r => r.date)), cls: "enact" },
    ...["C", "D"].map(L => ({ label: `Meter + runs, ${L}`, sub: "waste possible", span: span((shiftRows || []).filter(s => s.line === L && s.totalLb != null && s.cans).map(s => s.date)), cls: "meter" })),
  ];
  return { rows: list, coverage, noTime, low, ignored: Math.max(0, ignored) };
}
let gwModel = null, gwLine = "ALL", gwAll = false, gwItem = null;
function renderGasWeight() {
  const m = gwModel; if (!m) return;
  const both = m.rows.filter(r => r.paper && r.enact).length, wasted = m.rows.filter(r => r.waste != null), medW = med(wasted.map(r => r.waste));
  // coverage timeline
  const dates = m.coverage.flatMap(c => c.span || []), lo = dates.length ? dates.reduce((a, d) => d < a ? d : a) : null, hi = dates.length ? dates.reduce((a, d) => d > a ? d : a) : null;
  if (lo) { const t0 = new Date(lo.slice(0, 8) + "01T00:00").getTime(), t1 = new Date(hi + "T00:00").getTime() + 6 * 864e5, x = (d) => (new Date(d + "T00:00").getTime() - t0) / (t1 - t0) * 100;
    const months = []; for (let d = new Date(t0); d.getTime() <= t1; d.setMonth(d.getMonth() + 1)) months.push(d.toLocaleDateString([], { month: "short" }));
    $("#gw-cov").innerHTML = `<div class="tl">${m.coverage.map((c, i) => `<div class="lab">${c.label}<small>${esc(c.sub)}</small></div><div class="track">${c.span ? (() => { const l = x(c.span[0]), w = Math.max(.9, x(c.span[1]) - l + .6); return `<div class="bar ${c.cls}${l + w > 78 ? " right" : ""}" style="left:${l}%;width:${w}%;animation-delay:${i * 110}ms"><span>${shortDate(c.span[0])}–${shortDate(c.span[1])}</span></div>`; })() : `<span class="none">no data</span>`}</div>`).join("")}<div class="axis">${months.map(x => `<span>${x}</span>`).join("")}</div></div>`;
  } else $("#gw-cov").innerHTML = `<p class="note">No paper checks or Enact gas weights yet.</p>`;
  $("#gw-kpis").innerHTML = [
    ["Paper shifts", m.rows.filter(r => r.paper).length, `${fmt(m.rows.reduce((a, r) => a + (r.paper?.n || 0), 0))} readings`, "paper"],
    ["Enact shifts", m.rows.filter(r => r.enact).length, `${fmt(m.rows.reduce((a, r) => a + (r.enact?.n || 0), 0))} cans weighed`, "enact"],
    ["Both on one shift", both, both ? "averaged into one target" : "nothing to compare yet", "both"],
    ["With a waste factor", wasted.length, wasted.length ? `median ${pct(medW)} vs measured` : "needs meter data + runs", "meter"],
  ].map(([h, v, s, c]) => `<div class="kpi mini-kpi gw-${c}"><h3>${h}</h3><div class="big">${v}<small>${s}</small></div></div>`).join("");
  // table
  const full = m.rows.filter(r => (gwLine === "ALL" || r.line === gwLine) && (!gwItem || r.item.split(" + ").includes(gwItem))), list = gwAll || gwItem ? full : full.slice(0, 10);
  const more = $("#gw-more"); more.hidden = full.length <= 10 || !!gwItem; more.textContent = gwAll ? "Show the latest 10" : `Show all ${full.length} shifts`;
  $("#gw-filter").innerHTML = gwItem ? `Showing <b>${esc(gwItem)}</b> only · <a href="#" id="gw-clear">show all items</a>` : "";
  $("#gw-clear")?.addEventListener("click", (e) => { e.preventDefault(); gwItem = null; renderGasWeight(); });
  const dash = '<span class="muted">—</span>';
  $("#gw-table tbody").innerHTML = list.map((r, i) => `<tr class="${r.enact ? "run has-g" : ""}" data-i="${i}"><td>${r.line}</td><td class="date">${r.date}</td><td>${r.shift}</td><td><b>${esc(r.item)}</b></td>
      <td class="nw">${r.paper ? '<span class="src paper">Paper</span>' : ""}${r.enact ? '<span class="src enact">Enact</span>' : ""}</td>
      <td class="num grp">${r.paper ? `<b>${fmt(r.paper.g, 2)}</b> <small>${r.paper.n} rdg · ${fmt(r.paper.mn, 1)}–${fmt(r.paper.mx, 1)}</small>` : dash}</td>
      <td class="num">${r.enact ? `<b>${fmt(r.enact.g, 2)}</b> <small>${r.enact.n} pcs</small>` : dash}</td>
      <td class="num grp">${r.bom ? fmt(r.bom, 2) : '<span class="muted">no BOM</span>'}</td>
      <td class="num ${r.vsBom == null ? "" : r.vsBom > 0 ? "over" : "under"}">${pct(r.vsBom)}</td>
      <td class="num grp">${r.meterG ? `${fmt(r.meterG, 1)} <small>${fmt(r.lb)} lb · ${fmt(r.cans)} cans</small>` : '<span class="muted">no meter data</span>'}</td>
      <td class="num">${r.waste == null ? dash : `<span class="waste-v">${pct(r.waste)}</span>`}</td>
      <td class="num">${r.wasteBom == null ? dash : pct(r.wasteBom)}</td></tr>`
    + (r.enact ? r.enact.gassers.map(g => `<tr class="sub hidden" data-for="${i}"><td colspan="5">${esc(g.gasser)} · ${esc(g.item)}</td><td class="num grp"></td><td class="num">${fmt(g.mean, 2)} <small>${g.n} pcs · sd ${fmt(g.sd, 2)}</small></td><td class="num grp"></td><td class="num">${pct(r.bom ? (g.mean - r.bom) / r.bom * 100 : null)}</td><td class="num grp" colspan="3"></td></tr>`).join("") : "")).join("")
    || `<tr><td colspan="12" class="empty">No gas weights for this line yet.</td></tr>`;
  // by item
  const by = {};
  m.rows.filter(r => gwLine === "ALL" || r.line === gwLine).forEach(r => r.item.split(" + ").forEach(code => { const o = by[code] = by[code] || { code, shifts: 0, pN: 0, pS: 0, eN: 0, eS: 0, lb: 0, tgt: 0, bom: r.bom };
    o.shifts++; if (r.paper) { o.pN += r.paper.n; o.pS += r.paper.sum; } if (r.enact) { o.eN += r.enact.n; o.eS += r.enact.sum; } if (r.waste != null && !r.item.includes("+")) { o.lb += r.lb; o.tgt += r.cans * r.measured / G_PER_LB; } }));
  $("#gw-items tbody").innerHTML = Object.values(by).sort((x, y) => y.shifts - x.shifts || x.code.localeCompare(y.code)).map(o => { const it = items.find(i => i.code === normCode(o.code)) || {}, p = o.pN ? o.pS / o.pN : null, e = o.eN ? o.eS / o.eN : null, mm = (o.pN + o.eN) ? (o.pS + o.eS) / (o.pN + o.eN) : null, bom = it.bom_gas_g_per_can ?? null;
    return `<tr class="run${gwItem === o.code ? " selected" : ""}" data-item="${esc(o.code)}"><td><b>${esc(o.code)}</b>${it.description ? `<span class="sub">${esc(it.description)}</span>` : ""}</td><td>${esc(it.brand || "—")}</td><td class="nw">${p != null ? '<span class="src paper">Paper</span>' : ""}${e != null ? '<span class="src enact">Enact</span>' : ""}</td><td class="num">${o.shifts}</td>
      <td class="num grp">${p == null ? dash : `<b>${fmt(p, 2)}</b> <small>${fmt(o.pN)} rdg</small>`}</td><td class="num">${e == null ? dash : `<b>${fmt(e, 2)}</b> <small>${fmt(o.eN)} pcs</small>`}</td>
      <td class="num grp">${bom ? fmt(bom, 2) : '<span class="muted">no BOM</span>'}</td><td class="num ${bom && mm ? (mm > bom ? "over" : "under") : ""}">${bom && mm ? pct((mm - bom) / bom * 100) : "—"}</td>
      <td class="num grp">${o.tgt ? `<span class="waste-v">${pct((o.lb - o.tgt) / o.tgt * 100)}</span>` : dash}</td></tr>`; }).join("") || `<tr><td colspan="9" class="empty">Nothing yet.</td></tr>`;
  $("#gw-ignored tbody").innerHTML = [["Paper readings with no time written", "Can't be placed in a shift", m.noTime], ["Paper readings under 2.3 g", "Below the cut-off (a mis-read)", m.low], ["Enact gas weights for other parts", "Not on the gas-blend Items list (for example “Regular Cream”)", m.ignored]]
    .map(([w, why, n]) => `<tr><td>${w}</td><td>${why}</td><td class="num">${fmt(n)}</td></tr>`).join("");
}
$("#gw-table tbody").addEventListener("click", (e) => { const tr = e.target.closest("tr.has-g"); if (!tr) return; const open = tr.classList.toggle("open"); $$(`#gw-table tr.sub[data-for="${tr.dataset.i}"]`).forEach(x => x.classList.toggle("hidden", !open)); });
$("#gw-items tbody").addEventListener("click", (e) => { const tr = e.target.closest("tr[data-item]"); if (!tr) return; gwItem = gwItem === tr.dataset.item ? null : tr.dataset.item; renderGasWeight(); $("#h-gw").scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "start" }); });
$("#gw-more").addEventListener("click", () => { gwAll = !gwAll; renderGasWeight(); });
segBind("#gw-line", (v) => { gwLine = v; renderGasWeight(); });
/* <<< gas-weight-compare */

async function loadChecks() {
  const [rows, enactRows] = await Promise.all([fetchAll("gas_weight_checks", "check_date", false), fetchAll("enact_kpi", "summary_date", false).catch(() => [])]);
  const w = rows.map(r => Number(r.weight_g)).filter(x => !isNaN(x) && x > 0).sort((a, b) => a - b);
  const mean = w.reduce((a, b) => a + b, 0) / (w.length || 1), md = w.length ? w[Math.floor(w.length / 2)] : null;
  $("#checks-stats").innerHTML = `<span>Paper readings <b>${fmt(w.length)}</b></span><span>Mean <b>${fmt(mean, 2)} g</b></span><span>Median <b>${fmt(md, 2)} g</b></span><span>Min <b>${fmt(w[0], 1)} g</b></span><span>Max <b>${fmt(w[w.length - 1], 1)} g</b></span>`;
  // the shift window covering every gas weight, for metered gas and production
  const ds = [...rows.map(r => r.check_date), ...enactGasRows(enactRows).map(k => k.date)].filter(Boolean).sort();
  const shiftRows = ds.length ? await computeShiftRows(["C", "D"], ds[0], ds[ds.length - 1]) : [];
  gwModel = gasWeightModel(rows, enactRows, shiftRows); renderGasWeight();
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
const BASIS = { paperwork: ["Paperwork", "rdg"], Enact: ["Enact", "pcs"], "paper + Enact": ["Paper + Enact", "cans"], BOM: ["BOM", ""] };
let dashRows = [], dashSort = { key: "date", dir: -1 }, lastEnact = null, lastReading = null;
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
    const tr = document.createElement("tr"); tr.className = "run"; tr.dataset.key = `${r.line}|${r.date}|${r.shift}`;
    if (r.nonGasOnly) { tr.classList.add("muted"); tr.innerHTML = `<td>${r.line}</td><td class="date">${r.date}</td><td>${r.shift}</td><td>${r.items}</td><td class="num">—</td><td class="num">—</td><td class="num">${r.totalLb == null ? "—" : fmt(r.totalLb)}</td><td colspan="6">non-gas-blend production only — ${r.totalLb == null ? "no meter data" : fmt(r.totalLb) + " lb of blend flowed with no gas item running"}</td>`; }
    else if (r.totalLb == null) { tr.classList.add("muted"); tr.innerHTML = `<td>${r.line}</td><td class="date">${r.date}</td><td>${r.shift}</td><td>${r.items}</td><td class="num">${fmt(r.cases)}</td><td class="num">${fmt(r.cans)}</td><td colspan="7">no meter data for this shift</td>`; }
    else tr.innerHTML = `<td>${r.line}</td><td class="date">${r.date}</td><td>${r.shift}</td><td>${r.items}</td><td class="num">${fmt(r.cases)}</td><td class="num">${fmt(r.cans)}</td>
      <td class="num">${fmt(r.totalLb)}</td><td class="num">${fmt(r.volPct, 1)}%</td><td class="num">${r.avgCpm == null ? "—" : fmt(r.avgCpm)}</td><td class="num">${r.eff == null ? "—" : fmt(r.eff) + "%"}</td><td class="num">${fmt(r.gPerCan, 1)}</td><td class="num waste">${r.wastePct == null ? "—" : fmt(r.wastePct) + "%"}</td><td class="basis">${!r.basis ? "<span class='empty'>none</span>" : r.basis === "BOM" ? "BOM" : `${BASIS[r.basis][0]} <small>${r.paperN} ${BASIS[r.basis][1]}</small>`}</td>`;
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
      wasteRow(`${(BASIS[r.basis] || BASIS.paperwork)[0]} ${fmt(r.paperG, 2)} g <small>(${r.paperN} ${(BASIS[r.basis] || BASIS.paperwork)[1]})</small>`, r.paperLb, !!r.basis && r.basis !== "BOM") + wasteRow(`BOM${r.itemRows.length === 1 && r.itemRows[0].bomG ? " " + fmt(r.itemRows[0].bomG, 2) + " g" : ""}`, r.bomLb, r.basis === "BOM") + `</tbody></table>` : `<p class="hint">No paperwork for this shift and no BOM gas standard for its items, so waste isn't calculated.</p>`;
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
  tb.onclick = (e) => { const tr = e.target.closest("tr.run"); if (tr) { const open = tr.nextElementSibling.classList.toggle("hidden"); tr.classList.toggle("open", !open); } };
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
  // Enact per-shift means: key line|date|shift -> { g, n, item } (gas-blend items only)
  const enact = {};
  enactGasRows(enactRaw).forEach(k => {
    if (!k.shift) return;
    const key = `${k.line}|${k.date}|${k.shift}`; const n = Number(k.piece_count) || 0, m = Number(k.mean); if (!(n > 0) || isNaN(m)) return;
    const o = enact[key] = enact[key] || { sum: 0, n: 0, items: new Set() }; o.sum += m * n; o.n += n; o.items.add(k.item);
  });
  const eg = enactGasRows(enactRaw); lastEnact = eg.sort((a, b) => String(b.summary_date).localeCompare(String(a.summary_date)))[0] || null;
  lastReading = raw.length ? raw.reduce((m, r) => r.ts > m ? r.ts : m, raw[0].ts) : null;
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
    // measured gas weight for the shift: paper checks and Enact are the same measurement, so when both exist they are averaged, weighted by cans weighed
    const pk = `${g.line}|${g.date}|${g.shift}`, pp = paper[pk], ee = enact[pk];
    const pw = pp && ee ? { sum: pp.sum + ee.sum, n: pp.n + ee.n, src: "paper + Enact" } : pp ? { ...pp, src: "paperwork" } : ee ? { ...ee, src: "Enact" } : null;
    const paperG = pw ? pw.sum / pw.n : null, paperN = pw ? pw.n : 0, paperSrc = pw?.src || "paperwork";
    const paperLb = paperG != null ? cans * paperG / G_PER_LB : null;
    if (bomMissing) bomLb = 0;
    // target basis: paperwork for this line/date/shift if it exists, otherwise the items' BOM standard; never the 4.87 assumption
    const basis = paperLb != null ? paperSrc : bomLb ? "BOM" : null;
    const targetLb = basis === "BOM" ? bomLb : basis ? paperLb : 0;
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

// open one shift's row in the table (from a chart click), clearing filters that would hide it
function openDashRow(r) {
  const key = `${r.line}|${r.date}|${r.shift}`;
  let tr = $(`#dash-table tr.run[data-key="${key}"]`);
  if (!tr) { ["#f-item", "#f-wf", "#f-eff"].forEach(id => $(id).value = ""); $("#f-shift").value = ""; renderDashTable(); tr = $(`#dash-table tr.run[data-key="${key}"]`); }
  if (!tr) return;
  const det = tr.nextElementSibling; det.classList.remove("hidden"); tr.classList.add("open");
  $("#dash-shifts").classList.add("in");
  tr.classList.remove("flash"); void tr.offsetWidth; tr.classList.add("flash");
  tr.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "center" });
}

// weekly waste % per line, for the tile sparklines
function weeklyWaste(rows, L) {
  const w = {}; rows.filter(r => r.line === L).forEach(r => { const k = weekStart(r.date); const o = w[k] = w[k] || { lb: 0, tgt: 0 }; o.lb += r.totalLb; o.tgt += r.targetLb; });
  return Object.entries(w).sort(([a], [b]) => a.localeCompare(b)).map(([k, o]) => ({ week: k, v: (o.lb - o.tgt) / o.tgt * 100 }));
}
function sparkSVG(pts, color) {
  if (pts.length < 2) return `<svg viewBox="0 0 300 96" aria-hidden="true"><text x="0" y="60" fill="currentColor">Not enough weeks yet for a trend.</text></svg>`;
  const W = 300, H = 96, pad = 8, vs = pts.map(p => p.v), lo = Math.min(0, ...vs), hi = Math.max(...vs, 1);
  const x = (i) => pad + i * (W - pad * 2) / (pts.length - 1), y = (v) => H - 14 - (v - lo) / (hi - lo || 1) * (H - 30);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
  const len = Math.round(pts.reduce((a, p, i) => i ? a + Math.hypot(x(i) - x(i - 1), y(p.v) - y(pts[i - 1].v)) : 0, 0)) + 10;
  const last = pts[pts.length - 1];
  return `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true" preserveAspectRatio="none"><path class="sp-area" d="${d} L${x(pts.length - 1).toFixed(1)} ${H - 14} L${x(0).toFixed(1)} ${H - 14} Z" fill="${color}"/>${lo < 0 ? `<line class="sp-zero" x1="${pad}" x2="${W - pad}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" stroke="${color}"/>` : ""}<path class="sp-line" d="${d}" stroke="${color}" style="--len:${len}"/><circle class="sp-end" cx="${x(pts.length - 1).toFixed(1)}" cy="${y(last.v).toFixed(1)}" r="5" fill="${color}"/><text x="${pad}" y="${H}" fill="currentColor">${shortDate(pts[0].week)}</text><text x="${W - pad}" y="${H}" text-anchor="end" fill="currentColor">wk of ${shortDate(last.week)}</text></svg>`;
}
function renderLineCards(all, from, to) {
  const sum = (arr) => arr.reduce((a, r) => ({ lb: a.lb + r.totalLb, tgt: a.tgt + r.targetLb, cans: a.cans + r.cans, n: a.n + 1 }), { lb: 0, tgt: 0, cans: 0, n: 0 });
  const sel = segVal("#dash-line");
  const card = (L, cls, ink) => { const g = all.filter(r => r.line === L); const T = sum(g); if (!T.n) return `<button type="button" class="tool ${cls}" data-line="${L}"><span class="tool-k">${LINE_NAME[L]}</span><span class="tool-n">—</span><span class="tool-d">No shifts with meter data and production in this range.</span></button>`;
    const w = (T.lb - T.tgt) / T.tgt * 100;
    return `<button type="button" class="tool ${cls}${sel === L ? " sel" : ""}" data-line="${L}" aria-pressed="${sel === L}"><span class="tool-k">${LINE_NAME[L]}</span><span class="tool-n">${pct(w)}<small>gas over target</small></span><span class="tool-spark">${sparkSVG(weeklyWaste(all, L), ink)}</span><span class="tool-d">${fmt(T.lb)} lb metered over ${T.n} shifts · ${fmt(T.lb * G_PER_LB / T.cans, 1)} g per can against ${fmt(T.tgt * G_PER_LB / T.cans, 2)} g target</span><span class="tool-go">${sel === L ? "Show both lines" : `Show ${LINE_NAME[L]} only`}</span></button>`; };
  const T = sum(all), over = T.lb - T.tgt, days = Math.max(1, Math.round((new Date(to) - new Date(from)) / 864e5) + 1);
  $("#line-cards").innerHTML = card("C", "t-navy", "#8ae5ff") + card("D", "t-sky", "#031b27") +
    `<a class="tool t-lime" href="#analysis"><span class="tool-k">Both lines · ${shortDate(from)} to ${shortDate(to)}</span><span class="tool-n">${fmt(over)}<small>lb of gas over target</small></span><span class="tool-spark"><svg viewBox="0 0 300 96" aria-hidden="true"><text x="0" y="44" fill="currentColor" style="font-size:17px;font-weight:700;opacity:.9">≈ ${fmt(over / days)} lb a day</text><text x="0" y="72" fill="currentColor" style="font-size:14px;opacity:.75">${fmt(over * G_PER_LB / 1000)} kg over ${days} days</text></svg></span><span class="tool-d">${fmt(T.lb)} lb metered against ${fmt(T.tgt)} lb that went into ${fmt(T.cans)} cans.</span><span class="tool-go">Where it goes</span></a>`;
  $$("#line-cards button.tool[data-line]").forEach(b => b.onclick = () => { const L = b.dataset.line; const v = segVal("#dash-line") === L ? "ALL" : L; segSet("#dash-line", v); loadDashboard(); });
  setupCarousel();
}
// phone: centre tile tracking and dots for the swipe row
function setupCarousel() {
  const row = $("#line-cards"), dots = $("#line-dots"), tiles = [...row.children];
  dots.innerHTML = tiles.map(() => "<i></i>").join("");
  const mark = () => { const mid = row.scrollLeft + row.clientWidth / 2; let best = 0, bd = 1e9; tiles.forEach((t, i) => { const d = Math.abs(t.offsetLeft + t.offsetWidth / 2 - mid); if (d < bd) { bd = d; best = i; } }); tiles.forEach((t, i) => t.classList.toggle("center", i === best)); [...dots.children].forEach((d, i) => d.classList.toggle("on", i === best)); };
  row.onscroll = () => { cancelAnimationFrame(row._raf); row._raf = requestAnimationFrame(mark); }; mark();
}

// navy ticker: the figures a supervisor checks first, looping
function renderTicker(all, lines) {
  const items = [];
  lines.forEach(L => { const g = all.filter(r => r.line === L); if (!g.length) return; const lb = g.reduce((a, r) => a + r.totalLb, 0), t = g.reduce((a, r) => a + r.targetLb, 0), cans = g.reduce((a, r) => a + r.cans, 0);
    items.push(`<a class="tk-item" href="#dash-shifts">${LINE_NAME[L]} <b class="${(lb - t) / t > .25 ? "warn" : ""}">${pct((lb - t) / t * 100)}</b><small>over target</small></a>`);
    items.push(`<span class="tk-item">${LINE_NAME[L]} <b>${fmt(lb * G_PER_LB / cans, 1)} g</b><small>per can metered</small></span>`); });
  const ranked = all.filter(r => r.wastePct != null && r.hours >= 7).sort((a, b) => a.wastePct - b.wastePct);
  if (ranked.length) { const b = ranked[0], w = ranked[ranked.length - 1];
    items.push(`<span class="tk-item">Best shift <b>${b.line} ${shortDate(b.date)} S${b.shift}</b><small>${pct(b.wastePct)} · ${esc(b.items)}</small></span>`);
    items.push(`<span class="tk-item">Worst shift <b class="warn">${w.line} ${shortDate(w.date)} S${w.shift}</b><small>${pct(w.wastePct)} · ${esc(w.items)}</small></span>`); }
  if (lastEnact) items.push(`<span class="tk-item">Latest Enact <b>${fmt(lastEnact.mean, 2)} g</b><small>${esc(lastEnact.item)} · ${esc(lastEnact.gasser)} · ${shortDate(lastEnact.date)} ${lastEnact.shift ? "S" + lastEnact.shift : "day"}</small></span>`);
  if (lastReading) items.push(`<span class="tk-item">Meter read <b>${new Date(lastReading).toLocaleString([], { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</b><small>latest totalizer</small></span>`);
  const mark = `<svg class="tk-mark" aria-hidden="true"><use href="#mark"/></svg>`;
  const set = items.map(i => `<li>${i}</li><li>${mark}</li>`).join("");
  const tk = $("#ticker"); tk.classList.toggle("static", items.length < 2);
  tk.querySelector(".tk-track").innerHTML = items.length ? `<ul class="tk-set">${set}</ul><ul class="tk-set" aria-hidden="true">${set.replace(/<a /g, '<a tabindex="-1" ')}</ul>` : `<ul class="tk-set"><li><span class="tk-item">No shifts with meter data in this range.</span></li></ul>`;
}

async function loadDashboard() {
  const from = $("#dash-from"), to = $("#dash-to");
  $("#chart-waste").closest(".chart-wrap").classList.add("loading");
  if (!from.value) { const { data } = await sb.from("production_runs").select("run_date").order("run_date").limit(1); from.value = data?.[0]?.run_date || localDate(new Date(Date.now() - 30 * 864e5)); to.value = localDate(new Date()); }
  const lineSel = segVal("#dash-line"); const lines = lineSel === "ALL" ? ["C", "D"] : [lineSel];
  // tiles and ticker always show both lines; the chart and table follow the C / D / Both switch
  const both = await computeShiftRows(["C", "D"], from.value, to.value);
  const out = both.filter(r => lines.includes(r.line));
  dashRows = out; renderDashTable();
  const have = out.filter(r => r.totalLb != null && r.targetLb);
  const haveBoth = both.filter(r => r.totalLb != null && r.targetLb && !r.nonGasOnly);
  renderLineCards(haveBoth, from.value, to.value);
  renderTicker(haveBoth, ["C", "D"]);

  const summ = lines.map(L => { const h = have.filter(r => r.line === L); if (!h.length) return null;
    const T = h.reduce((a, r) => ({ lb: a.lb + r.totalLb, tgt: a.tgt + r.targetLb, cans: a.cans + r.cans, cases: a.cases + r.cases }), { lb: 0, tgt: 0, cans: 0, cases: 0 });
    return `<b>${LINE_NAME[L]}</b>: ${h.length} shifts, ${fmt(T.cases)} cases, ${fmt(T.lb)} lb metered against ${fmt(T.tgt)} lb target, <b>${pct((T.lb - T.tgt) / T.tgt * 100)}</b>.`; }).filter(Boolean);
  $("#dash-summary").innerHTML = summ.length ? summ.join("<br>") : "No shifts with both production and meter data in this range.";

  // ---- waste by shift: one slot per date + shift, C and D side by side; filler speed in its own panel below (no second y-axis)
  const showCpm = $("#dash-cpm").getAttribute("aria-pressed") === "true";
  const wrap = $("#chart-waste").closest(".chart-wrap"); wrap.classList.toggle("with-cpm", showCpm); wrap.classList.toggle("empty", !have.length);
  const cats = [...new Set(have.map(r => `${r.date}|${r.shift}`))].sort();
  const byKey = {}; have.forEach(r => byKey[`${r.line}|${r.date}|${r.shift}`] = r);
  const xLab = (k) => { const [d, sh] = k.split("|"); return `${shortDate(d)} S${sh}`; };
  const fitN = innerWidth < 700 ? 16 : 42, zoomStart = cats.length > fitN ? Math.round((1 - fitN / cats.length) * 100) : 0;
  const bars = lines.map((L, li) => ({ id: "w" + L, name: LINE_NAME[L], type: "bar", xAxisIndex: 0, yAxisIndex: 0, barMaxWidth: 18, barGap: "12%", barCategoryGap: "28%",
    data: cats.map(k => { const r = byKey[`${L}|${k}`]; return r ? { value: Math.round(r.wastePct * 10) / 10, r } : null; }),
    itemStyle: { color: COL[L], borderRadius: 4 }, emphasis: { focus: "series", itemStyle: { color: COL[L] } }, blur: { itemStyle: { opacity: .25 } },
    universalTransition: { enabled: true }, animationDelay: (i) => i * 10 + li * 60,
    markLine: li === 0 ? { silent: true, symbol: "none", lineStyle: { color: COL.ink, width: 1, type: "solid", opacity: .55 }, label: { show: true, position: "insideEndTop", formatter: "on target", color: COL.ink2, fontFamily: FONT, fontSize: 11 }, data: [{ yAxis: 0 }] } : undefined }));
  const cpm = !showCpm ? [] : lines.map(L => ({ id: "c" + L, name: `${LINE_NAME[L]} filler`, type: "line", xAxisIndex: 1, yAxisIndex: 1, connectNulls: true, symbol: "circle", symbolSize: 6, showSymbol: true,
    data: cats.map(k => { const r = byKey[`${L}|${k}`]; return r && r.avgCpm != null ? { value: Math.round(r.avgCpm), r } : null; }),
    lineStyle: { color: COL[L], width: 2, type: [6, 4] }, itemStyle: { color: "#fff", borderColor: COL[L], borderWidth: 2 },
    markLine: { silent: true, symbol: "none", lineStyle: { color: COL[L], width: 1, type: "dotted", opacity: .8 }, label: { formatter: `${L} max ${FILLER_SETPOINT[L]}`, color: COL.ink2, fontFamily: FONT, fontSize: 11, position: "insideEndTop" }, data: [{ yAxis: FILLER_SETPOINT[L] }] } }));
  const grids = showCpm ? [{ left: 56, right: 20, top: 42, bottom: "36%" }, { left: 56, right: 20, top: "70%", bottom: 64 }] : [{ left: 56, right: 20, top: 42, bottom: 64 }];
  const xAxes = [{ ...AX, type: "category", gridIndex: 0, data: cats.map(xLab), axisLabel: { ...AX.axisLabel, show: !showCpm }, axisLine: { ...AX.axisLine, onZero: false } }];
  const yAxes = [{ ...AX, type: "value", gridIndex: 0, name: "gas over target", nameLocation: "end", nameGap: 14, nameTextStyle: { ...AX.nameTextStyle, align: "left" }, axisLabel: { ...AX.axisLabel, formatter: (v) => v + "%" } }];
  if (showCpm) { xAxes.push({ ...AX, type: "category", gridIndex: 1, data: cats.map(xLab) }); yAxes.push({ ...AX, type: "value", gridIndex: 1, name: "filler cans / min", nameLocation: "end", nameGap: 10, nameTextStyle: { ...AX.nameTextStyle, align: "left" }, min: 0, max: (v) => Math.max(v.max, 300) * 1.08, splitNumber: 3, axisLabel: { ...AX.axisLabel, formatter: (v) => Math.round(v) } }); }
  const xIdx = showCpm ? [0, 1] : [0];
  drawChart("waste", "#chart-waste", chartBase({
    legend: { ...LEG, data: [...bars, ...cpm].map(s => s.name) },
    grid: grids, xAxis: xAxes, yAxis: yAxes,
    dataZoom: [{ type: "inside", xAxisIndex: xIdx, start: zoomStart, end: 100, zoomOnMouseWheel: "shift", moveOnMouseWheel: false }, { ...ZOOM_SLIDER, xAxisIndex: xIdx, start: zoomStart, end: 100 }],
    axisPointer: { link: [{ xAxisIndex: "all" }] },
    tooltip: { ...TIP, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: "rgba(212,241,255,.45)" } },
      formatter: (ps) => { const k = cats[ps[0].dataIndex]; const [d, sh] = k.split("|");
        return `<b>${new Date(d + "T12:00").toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} · shift ${sh}</b>` + lines.map(L => { const r = byKey[`${L}|${k}`]; if (!r) return "";
          return `<div style="margin-top:6px">${dot(COL[L])}<b>${LINE_NAME[L]} ${pct(r.wastePct)}</b> <span style="color:${COL.ink2}">${r.basis && r.basis !== "BOM" ? "vs " + BASIS[r.basis][0].toLowerCase() : "vs BOM"}</span><br><span style="color:${COL.ink2}">${esc(r.items)} · ${fmt(r.cases)} cases · ${fmt(r.gPerCan, 1)} g/can${r.avgCpm != null ? ` · ${fmt(r.avgCpm)} cpm` : ""}</span></div>`; }).join("") + `<div style="margin-top:6px;color:${COL.ink2};font-size:12px">Click to open in the table</div>`; } },
    series: [...bars, ...cpm],
  }), { click: (p) => { const r = p.data?.r; if (r) openDashRow(r); } });

  $("#dash-export").onclick = () => csv(out.map(r => ({ line: r.line, date: r.date, shift: r.shift, items: r.items, cases: r.cases, cans: r.cans, hours: r.hours, n2o_scf: r.n2oScf, n2_scf: r.n2Scf, n2o_lb: r.n2oLb, n2_lb: r.n2Lb, total_lb: r.totalLb, n2o_pct_vol: r.volPct, avg_cpm: r.avgCpm, efficiency_pct_cans_vs_capacity: r.eff, capacity_cans: r.capacityCans, pct_shift_filler_down: r.pctDown, longest_stop_min: r.longestStop, target_basis: r.basis, target_lb: r.targetLb, paperwork_g_per_can: r.paperG, paperwork_readings: r.paperN, bom_target_lb: r.bomLb, g_per_can: r.gPerCan, waste_pct: r.wastePct, notes: r.notes })), "consumption_by_shift.csv");
  revealNow();
}
segBind("#dash-line", () => loadDashboard());
["#dash-from", "#dash-to"].forEach(id => $(id).addEventListener("change", loadDashboard));
$("#dash-cpm").addEventListener("click", (e) => { const b = e.currentTarget; b.setAttribute("aria-pressed", String(b.getAttribute("aria-pressed") !== "true")); loadDashboard(); });
$("#dash-more").addEventListener("click", (e) => { const open = $("#dash-ctl").classList.toggle("open"); e.currentTarget.setAttribute("aria-expanded", String(open)); });
$("#an-more").addEventListener("click", (e) => { const open = $("#an-ctl").classList.toggle("open"); e.currentTarget.setAttribute("aria-expanded", String(open)); });


/* ---------- analysis ---------- */
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

async function loadAnalysis() {
  const from = $("#an-from"), to = $("#an-to");
  if (!from.value) { const { data } = await sb.from("production_runs").select("run_date").order("run_date").limit(1); from.value = data?.[0]?.run_date || "2026-08-01"; to.value = localDate(new Date()); }
  $$("#page-analysis .chart-wrap").forEach(w => { if (!charts[w.querySelector(".chart")?.id]) w.classList.add("loading"); });
  const lineSel = segVal("#an-line"); const lines = lineSel === "ALL" ? ["C", "D"] : [lineSel];
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
  const colors = { C: COL.C, D: COL.D };
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
    const ch = charts["an-chart-items"]?.inst; if (ch) ch.setOption({ series: [{ id: "g", data: itemBars() }] });
  };
  $("#an-items tbody").onclick = (e) => { const tr = e.target.closest("tr.run"); if (tr) openItem(tr.dataset.code); };
  function itemBars() { return topItems.map(o => ({ value: Math.round(o.lb * G_PER_LB / o.cans * 100) / 100, o, itemStyle: { color: baseColor(o), opacity: openCode && o.code !== openCode ? .3 : 1, borderColor: o.code === openCode ? COL.ink : "transparent", borderWidth: o.code === openCode ? 2 : 0, borderRadius: 4 } })); }
  drawChart("an-chart-items", "#an-chart-items", chartBase({
    legend: { ...LEG, data: ["Gas per can, metered", "Target"] },
    grid: { left: 52, right: 16, top: 42, bottom: 40 },
    xAxis: { ...AX, type: "category", data: topItems.map(o => o.code), axisLabel: { ...AX.axisLabel, interval: 0, rotate: topItems.length > 9 ? 30 : 0 } },
    yAxis: { ...AX, type: "value", name: "g per can", nameTextStyle: { ...AX.nameTextStyle, align: "left" } },
    tooltip: { ...TIP, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: "rgba(212,241,255,.45)" } }, formatter: (ps) => { const o = topItems[ps[0].dataIndex]; const g = o.lb * G_PER_LB / o.cans, t = o.tgt * G_PER_LB / o.cans;
      return `<b>${esc(o.code)}</b> <span style="color:${COL.ink2}">${esc(o.brand || "")}</span><div style="margin-top:6px">${dot(baseColor(o))}${fmt(g, 2)} g per can metered</div><div>${dot(COL.amber)}${fmt(t, 2)} g target · <b>${pct((g - t) / t * 100)}</b></div><div style="color:${COL.ink2};margin-top:4px">${o.shifts} shifts${o.mixed ? ` (${o.mixed} shared)` : ""} · ${[...o.lines].map(l => LINE_NAME[l]).join(", ")} · click to list them</div>`; } },
    series: [
      { id: "g", name: "Gas per can, metered", type: "bar", barMaxWidth: 34, data: itemBars(), itemStyle: { color: COL.both }, universalTransition: { enabled: true }, animationDelay: (i) => i * 40 },
      { id: "t", name: "Target", type: "line", step: "middle", symbol: "none", lineStyle: { color: COL.amber, width: 2, type: [6, 4] }, itemStyle: { color: COL.amber }, data: topItems.map(o => Math.round(o.tgt * G_PER_LB / o.cans * 100) / 100), z: 3 },
    ],
  }), { click: (p) => { const o = topItems[p.dataIndex]; if (o) openItem(o.code, true); } });
  $("#an-export").onclick = () => csv(itemList.map(o => ({ item: o.code, brand: o.brand, lines: [...o.lines].join(" "), shifts: o.shifts, shared_shifts: o.mixed, cases: o.cases, cans: o.cans, gas_lb_allocated: o.lb, g_per_can: o.lb * G_PER_LB / o.cans, target_g_per_can: o.tgt * G_PER_LB / o.cans, waste_pct: (o.lb - o.tgt) / o.tgt * 100, waste_pct_vs_bom: o.bom ? (o.lb - o.bom) / o.bom * 100 : null })), "analysis_by_item.csv");

  // ===== by line =====
  const byLine = lines.map(L => {
    const g = rows.filter(r => r.line === L); if (!g.length) return null;
    const T = g.reduce((a, r) => ({ lb: a.lb + r.totalLb, tgt: a.tgt + r.targetLb, bom: a.bom + r.bomLb, cans: a.cans + r.cans, cases: a.cases + r.cases, hrs: a.hrs + r.hours }), { lb: 0, tgt: 0, bom: 0, cans: 0, cases: 0, hrs: 0 });
    const f = g.filter(r => r.hours >= 7.5); const fit = fitLine(f.map(r => r.casesHr), f.map(r => r.lbHr)); const effs = g.map(r => r.eff).filter(x => x != null);
    return { line: L, shifts: g.length, paperShifts: g.filter(r => r.basis && r.basis !== "BOM").length, cases: T.cases, cans: T.cans, lb: T.lb, waste: (T.lb - T.tgt) / T.tgt * 100, wasteBom: T.bom ? (T.lb - T.bom) / T.bom * 100 : null, gcan: T.lb * G_PER_LB / T.cans, tgtG: T.tgt * G_PER_LB / T.cans, eff: effs.length ? effs.reduce((a, b) => a + b, 0) / effs.length : null, fit, medianW: med(g.map(r => r.wastePct)), best: Math.min(...g.map(r => r.wastePct)), worst: Math.max(...g.map(r => r.wastePct)) };
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
  const showEff = (r) => { const box = $("#an-eff-detail"); box.classList.remove("hidden");
    box.innerHTML = `<b>${LINE_NAME[r.line]} · ${r.date} · shift ${r.shift}</b> · ${esc(r.items)}<div class="pick-grid"><div><span>Filler</span>${fmt(r.avgCpm)} cpm average = ${fmt(effOf(r))}% of ${FILLER_SETPOINT[r.line]}${r.pctDown != null ? " · down " + fmt(r.pctDown) + "% of shift" : ""}</div><div><span>Production</span>${fmt(r.cases)} cases · ${fmt(r.cans)} cans</div><div><span>Gas</span>${fmt(r.totalLb)} lb · ${fmt(r.lbHr)} lb/hr · ${fmt(r.gPerCan, 1)} g/can</div><div><span>Waste</span>${pct(r.wastePct)} against the ${r.basis} target</div></div>`; };
  const effSeries = lines.flatMap(L => { const g = effRows.filter(r => r.line === L); const f = fitLine(g.map(effOf), g.map(r => r.wastePct)); const xs = g.map(effOf); const xmin = Math.min(...xs), xmax = Math.max(...xs);
    return [{ id: "s" + L, name: LINE_NAME[L], type: "scatter", symbolSize: 11, data: g.map(r => ({ value: [Math.round(effOf(r) * 10) / 10, Math.round(r.wastePct * 10) / 10], r })), itemStyle: { color: colors[L], borderColor: "#fff", borderWidth: 1.5, opacity: .9 }, emphasis: { scale: 1.6, focus: "series" }, blur: { itemStyle: { opacity: .2 } }, universalTransition: { enabled: true }, animationDelay: (i) => i * 12 },
      ...(f && g.length > 3 ? [{ id: "f" + L, name: `${LINE_NAME[L]} trend`, type: "line", silent: true, symbol: "none", lineStyle: { color: colors[L], width: 2, type: [6, 4] }, data: [[xmin, f.c + f.m * xmin], [xmax, f.c + f.m * xmax]], tooltip: { show: false } }] : [])]; });
  drawChart("an-chart-eff", "#an-chart-eff", chartBase({
    legend: { ...LEG, data: lines.map(L => LINE_NAME[L]) },
    grid: { left: 56, right: 24, top: 42, bottom: 48 },
    xAxis: { ...AX, type: "value", min: 0, name: "filler speed, % of maximum", nameLocation: "middle", nameGap: 30, axisLabel: { ...AX.axisLabel, formatter: (v) => v + "%" } },
    yAxis: { ...AX, type: "value", name: "gas over target", nameTextStyle: { ...AX.nameTextStyle, align: "left" }, axisLabel: { ...AX.axisLabel, formatter: (v) => v + "%" } },
    dataZoom: [{ type: "inside", xAxisIndex: 0, filterMode: "none", zoomOnMouseWheel: "shift" }, { type: "inside", yAxisIndex: 0, filterMode: "none", zoomOnMouseWheel: "shift" }],
    tooltip: { ...TIP, trigger: "item", formatter: (p) => { const r = p.data?.r; if (!r) return ""; return `${dot(colors[r.line])}<b>${LINE_NAME[r.line]} ${shortDate(r.date)} S${r.shift}</b><br>${pct(r.wastePct)} waste at ${fmt(effOf(r))}% filler speed<br><span style="color:${COL.ink2}">${esc(r.items)} · click for details</span>`; } },
    series: effSeries,
  }), { click: (p) => p.data?.r && showEff(p.data.r) });
  const bands = [[0, 40, "under 40%"], [40, 70, "40–70%"], [70, 1e9, "over 70%"]];
  $("#an-eff-kpis").innerHTML = bands.map(([lo, hi, lab]) => { const g = effRows.filter(r => effOf(r) >= lo && effOf(r) < hi); if (!g.length) return ""; return `<div class="kpi mini-kpi"><h3>Filler at ${lab} of max</h3><div class="big">${fmt(wasteOf(g))}%<small>gas over target · ${g.length} shifts · median ${fmt(med(g.map(r => r.gPerCan)), 1)} g/can</small></div></div>`; }).join("");

  // ===== trend =====
  const weeks = {}; rows.forEach(r => { const k = `${weekStart(r.date)}|${r.line}`; const w = weeks[k] = weeks[k] || { week: weekStart(r.date), line: r.line, lb: 0, tgt: 0, cans: 0, n: 0 }; w.lb += r.totalLb; w.tgt += r.targetLb; w.cans += r.cans; w.n++; });
  const weekList = Object.values(weeks).sort((a, b) => a.week.localeCompare(b.week)); const weekLabels = [...new Set(weekList.map(w => w.week))];
  $("#an-weeks tbody").innerHTML = weekList.map(w => `<tr><td class="date">${w.week}</td><td>${w.line}</td><td class="num">${w.n}</td><td class="num">${fmt(w.cans)}</td><td class="num">${fmt(w.lb)}</td><td class="num">${fmt(w.lb * G_PER_LB / w.cans, 1)}</td><td class="num waste">${fmt((w.lb - w.tgt) / w.tgt * 100)}%</td></tr>`).join("");
  $("#an-trend-text").innerHTML = lines.map(L => { const g = rows.filter(r => r.line === L).sort((a, b) => a.date.localeCompare(b.date) || a.shift - b.shift); if (g.length < 4) return null;
    const t0 = new Date(g[0].date).getTime(); const f = fitLine(g.map(r => (new Date(r.date).getTime() - t0) / 864e5), g.map(r => r.gPerCan)); const half = Math.floor(g.length / 2); const a1 = wasteOf(g.slice(0, half)), a2 = wasteOf(g.slice(half));
    return `<b>${L} Line</b>: first half of the period ${fmt(a1)}% over target → second half ${fmt(a2)}% (${a2 - a1 >= 0 ? "+" : ""}${fmt(a2 - a1)} points). Gas per can trending ${f.m >= 0 ? "up" : "down"} ${Math.abs(f.m * 7).toFixed(2)} g per week${f.r2 < 0.1 ? " — not a meaningful trend yet; shift-to-shift variation dominates" : ""}.`; }).filter(Boolean).join("<br>") || "Need at least 4 shifts per line to test for a trend.";
  drawChart("an-chart-trend", "#an-chart-trend", chartBase({
    legend: { ...LEG, data: lines.map(L => LINE_NAME[L]) },
    grid: { left: 52, right: 70, top: 42, bottom: weekLabels.length > 10 ? 58 : 36 },
    xAxis: { ...AX, type: "category", boundaryGap: false, data: weekLabels.map(w => `wk ${shortDate(w)}`) },
    yAxis: { ...AX, type: "value", name: "gas over target", nameTextStyle: { ...AX.nameTextStyle, align: "left" }, axisLabel: { ...AX.axisLabel, formatter: (v) => v + "%" } },
    dataZoom: weekLabels.length > 10 ? [{ type: "inside", zoomOnMouseWheel: "shift" }, { ...ZOOM_SLIDER }] : [],
    tooltip: { ...TIP, trigger: "axis", axisPointer: { type: "line", lineStyle: { color: COL.axis } }, formatter: (ps) => `<b>Week of ${shortDate(weekLabels[ps[0].dataIndex])}</b>` + ps.map(p => { const x = weekList.find(v => v.week === weekLabels[p.dataIndex] && LINE_NAME[v.line] === p.seriesName); return x ? `<div style="margin-top:5px">${dot(p.color)}${p.seriesName} <b>${pct(p.value)}</b> <span style="color:${COL.ink2}">${x.n} shifts · ${fmt(x.lb * G_PER_LB / x.cans, 1)} g/can</span></div>` : ""; }).join("") },
    series: lines.map((L, li) => ({ id: "t" + L, name: LINE_NAME[L], type: "line", smooth: .3, symbol: "circle", symbolSize: 8, connectNulls: true,
      data: weekLabels.map(w => { const x = weekList.find(v => v.week === w && v.line === L); return x ? Math.round((x.lb - x.tgt) / x.tgt * 1000) / 10 : null; }),
      lineStyle: { color: colors[L], width: 2.5 }, itemStyle: { color: colors[L], borderColor: "#fff", borderWidth: 2 },
      areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: colors[L] + "33" }, { offset: 1, color: colors[L] + "00" }] } },
      endLabel: { show: true, formatter: LINE_NAME[L], color: COL.ink, fontFamily: FONT, fontSize: 12, fontWeight: 600 }, emphasis: { focus: "series" },
      universalTransition: { enabled: true }, animationDuration: 1400, animationDelay: li * 150,
      markLine: li === 0 ? { silent: true, symbol: "none", lineStyle: { color: COL.ink, width: 1, opacity: .5, type: "solid" }, label: { formatter: "on target", position: "insideEndTop", color: COL.ink2, fontFamily: FONT, fontSize: 11 }, data: [{ yAxis: 0 }] } : undefined })),
  }));

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
    $("#an-events-clear")?.addEventListener("click", (ev) => { ev.preventDefault(); evFilter = null; renderEvents(); });
    $("#an-events-kpis").innerHTML = catOrder.map(c => { const v = byCat[c]; return `<div class="kpi mini-kpi ${evFilter === c ? "on" : ""}" data-cat="${c}" style="--c:${CAT_COLORS[c]}"><h3><span class="cat" style="--c:${CAT_COLORS[c]}"></span>${CATS[c]}${c === "startup" ? " <small>(expected)</small>" : ""}</h3><div class="big">${fmt(v.lb)} lb<small>${v.n} event${v.n === 1 ? "" : "s"} · ${fmt(v.hrs, 1)} h${v.hrs ? " · " + fmt(v.lb / v.hrs) + " lb/hr" : ""}</small></div><p class="hint">${CAT_NOTE[c]}</p></div>`; }).join("")
      + `<div class="kpi mini-kpi total"><h3>Opportunity</h3><div class="big">${fmt(opportunity)} lb<small>end of schedule + changeover + downtime · ${fmt(opportunity / (gasTot + evTot) * 100, 1)}% of gas in the period</small></div></div>`;
    $$("#an-events-kpis .kpi[data-cat]").forEach(k => k.onclick = () => { evFilter = evFilter === k.dataset.cat ? null : k.dataset.cat; renderEvents(); });
  };
  renderEvents();
  drawChart("an-chart-events", "#an-chart-events", chartBase({
    legend: { ...LEG, show: lines.length > 1, data: lines.map(L => LINE_NAME[L]) },
    grid: { left: 118, right: 24, top: lines.length > 1 ? 40 : 14, bottom: 34 },
    yAxis: { ...AX, type: "category", inverse: true, data: catOrder.map(c => CATS[c] + (c === "startup" ? " (expected)" : "")), axisLabel: { ...AX.axisLabel, color: COL.ink, fontSize: 12.5 }, splitLine: { show: false } },
    xAxis: { ...AX, type: "value", axisLabel: { ...AX.axisLabel, formatter: (v) => v ? fmt(v) + " lb" : "0" } },
    tooltip: { ...TIP, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: "rgba(212,241,255,.45)" } }, formatter: (ps) => { const c = catOrder[ps[0].dataIndex]; return `<b>${CATS[c]}</b>` + ps.map(p => `<div style="margin-top:5px">${dot(p.color)}${p.seriesName} <b>${fmt(p.value)} lb</b></div>`).join("") + `<div style="color:${COL.ink2};margin-top:4px">${byCat[c].n} events · ${fmt(byCat[c].hrs, 1)} h · click to filter</div>`; } },
    series: lines.map((L, li) => ({ id: "e" + L, name: LINE_NAME[L], type: "bar", stack: "s", barMaxWidth: 26, data: catOrder.map(c => ({ value: Math.round(byCat[c][L] || 0), itemStyle: { opacity: c === "startup" ? .45 : 1 } })), itemStyle: { color: colors[L], borderRadius: li === lines.length - 1 ? [0, 4, 4, 0] : 0, borderColor: "#fff", borderWidth: 1 }, universalTransition: { enabled: true }, animationDelay: (i) => i * 90 + li * 120 })),
  }), { click: (p) => { const c = catOrder[p.dataIndex]; evFilter = evFilter === c ? null : c; renderEvents(); } });

  // ===== start-of-run effect =====
  const runsList = [];
  lines.forEach(L => { const g = all.filter(r => r.line === L).sort((a, b) => a.date.localeCompare(b.date) || a.shift - b.shift); let cur = null, prev = null;
    g.forEach(r => { const t = new Date(r.date).getTime() + SHIFT_START[r.shift] * 3600e3; if (prev == null || t - prev > 9 * 3600e3) { cur = { line: L, shifts: [] }; runsList.push(cur); } cur.shifts.push(r); prev = t; }); });
  const runStats = runsList.filter(rn => rn.shifts.length >= 2).map(rn => { const first = rn.shifts[0], rest = rn.shifts.slice(1); const wF = first.wastePct, wR = wasteOf(rest); const gR = rest.reduce((a, r) => a + r.totalLb, 0) / rest.reduce((a, r) => a + r.cans, 0) * G_PER_LB;
    return { rn, first, rest, wF, wR, cpmF: first.avgCpm, cpmR: med(rest.map(r => r.avgCpm)), extra: first.totalLb - first.cans * gR / G_PER_LB, label: `${rn.line} ${shortDate(first.date)}`, items: [...new Set(rn.shifts.flatMap(r => r.itemRows.map(x => x.code)))].join(", ") }; });
  const firsts = runStats.map(s => s.first), rests = runStats.flatMap(s => s.rest);
  const extraTot = runStats.reduce((x, s) => x + Math.max(0, s.extra), 0);
  $("#an-start-text").innerHTML = runStats.length ? `The first shift of a run is consistently the worst: median <b>${fmt(med(firsts.map(r => r.wastePct)))}% over target</b> against <b>${fmt(med(rests.map(r => r.wastePct)))}%</b> for the shifts that follow. The reason is visible in the filler — first shifts average ${fmt(med(firsts.map(r => r.avgCpm)))} cpm versus ${fmt(med(rests.map(r => r.avgCpm)))} cpm later — so the same fixed bleed is spread over far fewer cans while the line is being brought up. In ${runStats.length} runs that cost about <b>${fmt(extraTot)} lb</b> more than if the first shift had run at the rest of the run's rate.` : "Need runs of 2+ shifts to measure.";
  $("#an-start-kpis").innerHTML = runStats.length ? `<div class="kpi mini-kpi"><h3>First shift of a run</h3><div class="big">${fmt(med(firsts.map(r => r.wastePct)))}%<small>median waste · ${firsts.length} shifts · ${fmt(med(firsts.map(r => r.avgCpm)))} cpm · ${fmt(med(firsts.map(r => r.eff)))}% efficiency</small></div></div><div class="kpi mini-kpi"><h3>Later shifts</h3><div class="big">${fmt(med(rests.map(r => r.wastePct)))}%<small>median waste · ${rests.length} shifts · ${fmt(med(rests.map(r => r.avgCpm)))} cpm · ${fmt(med(rests.map(r => r.eff)))}% efficiency</small></div></div>` : "";
  $("#an-start-table tbody").innerHTML = runStats.map(s => `<tr><td class="date">${s.label}</td><td>${s.rn.line}</td><td>${s.items}</td><td class="num waste">${fmt(s.wF)}%</td><td class="num">${fmt(s.wR)}%</td><td class="num">${s.cpmF == null ? "—" : fmt(s.cpmF) + " cpm"}</td><td class="num">${s.cpmR == null ? "—" : fmt(s.cpmR) + " cpm"}</td><td class="num">${s.extra > 0 ? fmt(s.extra) + " lb" : "—"}</td></tr>`).join("");
  drawChart("an-chart-start", "#an-chart-start", chartBase({
    legend: { ...LEG, data: ["First shift of the run", "Rest of the run"] },
    grid: { left: 52, right: 16, top: 42, bottom: runStats.length > 18 ? 92 : runStats.length > 10 ? 64 : 36 },
    xAxis: { ...AX, type: "category", data: runStats.map(s => s.label), axisLabel: { ...AX.axisLabel, interval: runStats.length > 18 ? "auto" : 0, rotate: runStats.length > 10 ? 30 : 0 } },
    yAxis: { ...AX, type: "value", name: "gas over target", nameTextStyle: { ...AX.nameTextStyle, align: "left" }, axisLabel: { ...AX.axisLabel, formatter: (v) => v + "%" } },
    dataZoom: runStats.length > 18 ? [{ type: "inside", zoomOnMouseWheel: "shift" }, { ...ZOOM_SLIDER }] : [],
    tooltip: { ...TIP, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: "rgba(212,241,255,.45)" } }, formatter: (ps) => { const s = runStats[ps[0].dataIndex]; return `<b>${LINE_NAME[s.rn.line]} run from ${shortDate(s.first.date)}</b><div style="margin-top:5px">${dot(COL.amber)}First shift <b>${pct(s.wF)}</b> · ${s.cpmF == null ? "—" : fmt(s.cpmF) + " cpm"}</div><div>${dot(colors[s.rn.line])}Rest of run <b>${pct(s.wR)}</b> · ${s.cpmR == null ? "—" : fmt(s.cpmR) + " cpm"}</div><div style="color:${COL.ink2};margin-top:4px">${esc(s.items)}</div>`; } },
    series: [
      { id: "f", name: "First shift of the run", type: "bar", barMaxWidth: 16, barGap: "15%", data: runStats.map(s => Math.round(s.wF * 10) / 10), itemStyle: { color: COL.amber, borderRadius: 4 }, universalTransition: { enabled: true }, animationDelay: (i) => i * 30 },
      { id: "r", name: "Rest of the run", type: "bar", barMaxWidth: 16, data: runStats.map(s => ({ value: Math.round(s.wR * 10) / 10, itemStyle: { color: colors[s.rn.line] } })), itemStyle: { color: COL.C, borderRadius: 4 }, universalTransition: { enabled: true }, animationDelay: (i) => i * 30 + 80 },
    ],
  }));

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
segBind("#an-line", () => loadAnalysis());
["#an-from", "#an-to"].forEach(id => $(id).addEventListener("change", loadAnalysis));
// section index: sticky on the left; on a phone it is a sheet opened from the floating pill
const siPill = $("#si-pill"), secIndex = $("#an-index");
const setSheet = (open) => { secIndex.classList.toggle("open", open); siPill.setAttribute("aria-expanded", String(open)); };
siPill.addEventListener("click", () => setSheet(!secIndex.classList.contains("open")));
document.addEventListener("click", (e) => { if (secIndex.classList.contains("open") && !e.target.closest("#an-index, #si-pill")) setSheet(false); });
$$("#an-index a").forEach(link => link.addEventListener("click", (e) => { e.preventDefault(); setSheet(false); const t = $("#" + link.dataset.target); if (!t) return; t.closest(".reveal")?.classList.add("in"); const y = t.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hdr")) || 68) - 96; window.scrollTo({ top: y, behavior: REDUCED ? "auto" : "smooth" }); }));
const anObserver = new IntersectionObserver((entries) => { entries.forEach(en => { if (!en.isIntersecting) return; $$("#an-index a").forEach(l => l.classList.toggle("on", l.dataset.target === en.target.id)); const cur = $(`#an-index a[data-target="${en.target.id}"]`); if (cur) $("#si-cur").textContent = cur.textContent; }); }, { rootMargin: "-25% 0px -65% 0px" });
$$("#page-analysis h2[id]").forEach(h2 => anObserver.observe(h2));
window.addEventListener("scroll", () => { if (currentPage === "analysis" && window.scrollY < 260) { $$("#an-index a").forEach((l, i) => l.classList.toggle("on", i === 0)); $("#si-cur").textContent = "Overview"; } }, { passive: true });

/* ---------- scroll reveal (Onyx / Palantir style) ---------- */
function splitWords(el) { if (el.dataset.split) return; el.dataset.split = "1"; const words = el.textContent.trim().split(/\s+/); el.innerHTML = words.map((w, i) => `<span class="w"><span style="--i:${i}">${w}</span></span>`).join(" "); }
$$(".reveal h2").forEach(splitWords);
// the controls bars turn frosted once they stick under the header
(() => { const check = () => $$(".ctl").forEach(c => { if (!c.offsetParent) return; const top = parseFloat(getComputedStyle(c).top) || 0; c.classList.toggle("floating", window.scrollY > 40 && c.getBoundingClientRect().top <= top + 1); });
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
