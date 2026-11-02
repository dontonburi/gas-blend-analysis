/* ===================================================================
   The AMA can on the Gas Blend Scrap Factor Report (Nov 2, 2026).
   Don's aerosol "ask me anything" can (ama/ama-can.js) at the bottom left of
   every page once someone is signed in. Click it to search this site: pages
   and sections, How we calculate, a glossary, the items and the gas events.
   A result jumps in place (#page~kind:value), the same as a deep link.

   The index is built in the browser from the page and the data the person
   has already loaded, so it follows their role: guests never see admin-only
   pages, item descriptions or lb per case. Nothing is written to a file.
   Needs app.js loaded first (navigate, role, items, getTable, ...).
   =================================================================== */
(function () {
  const SRC = "ama/ama-can.js", SRC3D = "ama/ama-can-3d.js";
  const THREE_SRC = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
  const KEY = "aerosol";
  const q1 = (s, r = document) => r.querySelector(s), qa = (s, r = document) => [...r.querySelectorAll(s)];
  const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();

  /* ---------- the pages as they are before any data is drawn ---------- */
  const PAGE_TITLE = { dashboard: "Dashboard", analysis: "Analysis", runs: "Production runs", readings: "Meter readings", checks: "Gas weight check", items: "Items", convert: "Conversions" };
  const PAGE_X = {
    dashboard: "Waste by month, each line at a glance, the waste-by-shift chart and every shift in one table, with How we calculate at the bottom.",
    analysis: "Scrap factor analysis: performance by line, whether it's improving, efficiency vs waste, start of run, performance by item, blend left open and gas with no production logged.",
    convert: "The gas blend setting calculator: what the meter's scf weighs, and what the BOM should say for a measured gas weight."
  };
  // sections whose own text is filled in by the data, or that have none
  const SEC_X = {
    "h-shifts": "Every shift in the period with its items, cases, cans, gas, blend ratio, filler speed, efficiency, g per can, waste % and the target's basis. Filter by item, shift, waste or efficiency; click a row for the full breakdown.",
    "an-sec-trend": "Waste week by week for each line, as a chart and a week-by-week table.",
    "an-sec-start": "The first shift of each run against the rest of that run: waste, filler speed and the extra gas the first shift used.",
    "pw-h": "The paper check sheets themselves, filtered by the bar at the top of the page.",
    "cal-title": "The calendar: each square is a day, navy when C Line ran, sky for D Line, split in half when both ran. Click a day to list only its runs."
  };
  const main = q1("#main");
  qa(".page", main).forEach((pg) => qa("h2, h3.cal-title", pg).forEach((h, i) => { if (!h.id) h.id = `ama-${pg.id.replace("page-", "")}-${i}`; }));
  const PRISTINE = main.cloneNode(true);   // app.js hasn't drawn anything yet when this runs

  const DROP = "script, style, svg, .chart-wrap, .kpis, #ticker, #line-cards, .dots, datalist, #an-count, #pw-sum, #gw-filter, #f-count, #rd-count, #cal, #cal-months, #cal-sum, #an-trend-text, #an-start-text, #an-idle-text, #an-events-filter";
  function textOf(node, guest, extraDrop) {
    const c = node.cloneNode(true);
    qa(DROP + (extraDrop ? ", " + extraDrop : "") + (guest ? ", .admin-only, .g-note, .g-hide" : ", .g-only"), c).forEach((n) => n.remove());
    qa("table:not(.facts) tbody", c).forEach((n) => n.remove());
    return clean(c.textContent);
  }

  /* ---------- the glossary: short answers in the site's own terms ---------- */
  const Q = (n) => `dashboard~qa:h-methods.${n}`;
  const TERMS = [
    { t: "Scrap factor", a: "The share of blend gas that doesn't end up in a can. On this site it is waste %, worked out shift by shift from the meter and the cans filled.", h: Q(3), k: "scrap waste loss overuse giveaway" },
    { t: "Waste %", a: "(Gas metered − target) ÷ target, where target = cans filled × target grams per can. 0% means the meter matches what went into the cans; 50% means half as much gas again went somewhere other than a can.", h: Q(3), k: "waste percent scrap over target" },
    { t: "Target", a: "What a shift's cans should have taken: cans filled × target grams per can. The grams per can come from the gas weights measured on the line that shift (paper and Enact averaged by cans weighed), or the items' BOM gas per can when there are none.", h: Q(2), k: "target standard expected goal grams per can" },
    { t: "Basis", a: "Which target a shift used: the paper check, Enact, both, or the BOM. It's the Basis column in Every shift.", h: "dashboard~sec:h-shifts", k: "basis paper enact bom source" },
    { t: "BOM", a: "The bill of materials: each item's gas standard in lb of N₂O and N₂ per case. Per can = lb per case × 453.592 ÷ cans per case.", h: "items", k: "bill of materials standard spec lb per case" },
    { t: "scf", a: "Standard cubic feet, the unit the blender's totalizers count. One scf of N₂O weighs 0.116 lb; one scf of N₂ weighs 0.0739 lb.", h: "convert~sec:ama-convert-0", k: "standard cubic feet meter volume pounds lbs weight" },
    { t: "Totalizer", a: "The blender's running count of scf for each gas. A shift's gas is the difference between the readings at its start and end (07:00, 15:00 and 23:00).", h: Q(0), ha: "readings", k: "meter reading counter tank level" },
    { t: "N₂O", a: "Nitrous oxide (44.01 g/mol), the heavier gas in the blend: 0.116 lb per scf.", h: "convert~sec:ama-convert-2", k: "nitrous oxide propellant" },
    { t: "N₂", a: "Nitrogen (28.01 g/mol), the lighter gas in the blend: 0.0739 lb per scf.", h: "convert~sec:ama-convert-2", k: "nitrogen" },
    { t: "Blend ratio", a: "The blender sets N₂O as a share by volume. N₂O is heavier, so 85% by volume is 89.9% by mass, 78% is 84.8% and 70% is 78.6%.", h: "convert~sec:ama-convert-2", k: "ratio percent volume mass setpoint split mix" },
    { t: "Efficiency", a: "Cans produced ÷ the cans the filler could make at its setpoint over the shift (C Line 300 a minute, D Line 250).", h: Q(4), k: "efficiency speed uptime performance oee" },
    { t: "CPM", a: "Cans per minute, the filler's speed. Setpoints: C Line 300, D Line 250.", h: "analysis~sec:an-sec-eff", k: "cans per minute filler speed rate" },
    { t: "EQV", a: "The cans in a case, used to turn cases into cans: a 6-pack case counts 6 cans.", h: Q(4), k: "cans per case pack equivalent" },
    { t: "Shifts", a: "Shift 1 runs 07:00–15:00, shift 2 15:00–23:00 and shift 3 23:00–07:00 the next day. A gas weight check written before 07:00 counts toward the previous day's shift 3.", h: Q(0), k: "shift 1 2 3 first second third night hours" },
    { t: "Gas event", a: "A time the blend system was open with no gas-blend production: startup before the first can, downtime stops of 30 minutes or more, end of schedule (including CIP) and changeovers to non-gas items.", h: "analysis~sec:an-sec-events", k: "event open purge leak startup downtime changeover cip" },
    { t: "Blend left open", a: "Gas that flowed while nothing was being gassed. End of schedule, changeover and downtime are the opportunity: closing the blend would have saved that gas outright.", h: "analysis~sec:an-sec-events", k: "left on open idle purge shut off turn off wasted" },
    { t: "Shared shift", a: "When several items run in one shift the meter can't separate them, so that shift's gas is split between them by cans filled.", h: "analysis~sec:an-sec-items", k: "shared split several items" },
    { t: "Gas weight check", a: "Gas per can measured on the production line. The paper check sheet and Enact's operating gas weight are the same measurement.", h: Q(2), ha: "checks", k: "paper check sheet weigh gasser fill weight grams" },
    { t: "Enact", a: "The plant's production tracking system. Its KPI data gives each shift's output and the operating gas weight.", aa: " Shifts it has recorded show as production runs until their cases are entered.", h: Q(2), ha: "runs", k: "enact kpi operating gas weight" },
    { t: "Production run", admin: 1, a: "A line, date, shift and item with the cases produced, entered from the daily production report.", h: "runs", k: "run daily production report cases" },
    { t: "Non-gas item", a: "An item whose cans take no blend gas. Its cans are left out of the target, so they don't make a shift's waste look lower than it is.", h: "items", k: "non blend no gas excluded" }
  ];

  /* ---------- building the index ---------- */
  const seen = { items: null, ev: null };
  async function build() {
    const guest = role() === "guest", E = [];
    const pages = qa(".page", PRISTINE);
    pages.forEach((pg) => {
      const id = pg.id.replace("page-", ""), title = PAGE_TITLE[id];
      if (!title || (guest && ADMIN_PAGES.includes(id))) return;
      const ledeEl = q1(".page-head .lede", pg);
      E.push({ ty: "Page", t: title, p: "Page", h: id, x: PAGE_X[id] || (ledeEl ? textOf(ledeEl, guest) : ""), k: textOf(pg, guest).slice(0, 1500) });
      qa("h2, h3.cal-title", pg).forEach((h) => {
        if (guest && h.closest(".admin-only")) return;
        let box = h.closest(".an-sec, .split-card");
        if (!box || box === pg) {   // a heading straight on the page: its section runs to the next heading
          box = document.createElement("div");
          for (let n = h.nextElementSibling; n && !n.matches("h2"); n = n.nextElementSibling) box.appendChild(n.cloneNode(true));
        }
        const lede = qa("p", box).map((p) => textOf(p, guest)).find((s) => s.length > 20) || "";
        E.push({ ty: "Section", t: clean(h.textContent), p: title, h: `${id}~sec:${h.id}`, x: SEC_X[h.id] || lede, k: textOf(box, guest).slice(0, 1200) });
      });
      qa("details.qa", pg).forEach((d) => {
        const sec = d.closest(".an-sec, section"), hid = q1("h2", sec)?.id || "", n = qa("details.qa", sec).indexOf(d);
        E.push({ ty: "FAQ", t: clean(q1("summary", d).textContent), a: textOf(q1(".ans", d) || d, guest), p: "How we calculate", l: clean(q1("h2", sec)?.textContent || title), h: `${id}~qa:${hid}.${n}` });
      });
    });
    if (!guest) E.push({ ty: "Page", t: "Supplier scorecard", p: "Page · opens on its own", h: "supplier", u: "supplier-quality.html", x: "The supplier quality scorecard, on its own page.", k: "supplier quality scorecard component logs" });
    TERMS.forEach((g) => {
      if (g.admin && guest) return;
      E.push({ ty: "Term", t: g.t, a: g.a + (!guest && g.aa ? g.aa : ""), p: "Glossary", h: !guest && g.ha ? g.ha : g.h, k: g.k });
    });
    // the items, from the same rows the Items page shows this person
    seen.items = items;
    items.forEach((it) => {
      const c = itemCalc(it), parts = [];
      if (it.gas_blend === false) parts.push("Not a gas-blend item: its cans are left out of the target");
      else {
        if (c.totG != null) parts.push(`BOM ${fmt(c.totG, 2)} g of gas per can (N₂O ${fmt(c.n2oG, 2)} g, N₂ ${fmt(c.n2G, 2)} g)`);
        else if (it.bom_gas_g_per_can != null) parts.push(`BOM ${fmt(Number(it.bom_gas_g_per_can), 2)} g of gas per can`);
        if (it.n2o_ratio_vol != null) parts.push(`${fmt(Number(it.n2o_ratio_vol) * 100, 1)}% N₂O by volume`);
        if (it.target_gas_g != null) parts.push(`target set to ${fmt(Number(it.target_gas_g), 2)} g a can`);
      }
      if (!guest && it.cans_per_case) parts.push(`${it.cans_per_case} cans a case`);
      E.push({ ty: "Row", t: it.brand ? `${it.code} · ${it.brand}` : it.code, p: "Items", h: `items~item:${encodeURIComponent(it.code)}`, x: parts.join(" · "),
        k: [it.code, it.brand, guest ? "" : it.description, guest ? "" : it.notes, it.gas_blend === false ? "non-gas no blend" : "gas blend"].filter(Boolean).join(" ") });
    });
    // the gas events (blend left open), confirmed and detected
    const evP = getTable("gas_events"); seen.ev = evP;
    const events = await evP.catch(() => []);
    const fd = (t) => new Date(t).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const ft = (t) => new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    (events || []).forEach((e) => {
      const cat = (typeof CATS !== "undefined" && CATS[e.category]) || e.category || "Event", d = new Date(e.start_ts);
      E.push({ ty: "Row", t: `${cat} · ${LINE_NAME[e.line] || e.line} · ${fd(e.start_ts)}`, p: "Blend left open" + (e.detected ? " · detected" : ""), h: `analysis~ev:${e.id}`,
        x: `${fmt(e.hrs, 1)} h open, ${fmt(e.lb)} lb of gas, ${ft(e.start_ts)} to ${ft(e.end_ts)}${e.cause ? " · " + e.cause : ""}`,
        k: [cat, e.category, e.line + " line", d.toLocaleDateString("en-US", { month: "long" }), `${d.getMonth() + 1}/${d.getDate()}`, e.cause, "event open blend left"].filter(Boolean).join(" ") });
    });
    return { v: "gbr", entries: E, batches: [] };
  }

  /* ---------- the wording ---------- */
  function words() {
    const guest = role() === "guest";
    const codes = new Set(items.map((i) => i.code)), item = codes.has("AD54") ? "AD54" : (items.find((i) => i.gas_blend !== false) || {}).code;
    return {
      eyebrow: "Ask the report", label: "Ask the report: search its pages, methods, glossary, items and gas events",
      greet: "Hi! Ask me anything about the gas blend report.", placeholder: `Try waste %, ${item || "an item"} or blend left open`,
      chips: ["What does waste % mean?", item, "Blend left open", "scf to lb", "Shift 3", guest ? "BOM" : "Gas weight check", "Efficiency", "Target"].filter(Boolean),
      hint: "Try a shorter word, an item code, a line (C or D), a unit (scf, lb) or a month (Oct).",
      refGroup: "Items and gas events",
      coverage: (X, c) => `Searches <b>${c((e) => e.ty === "Page")} pages</b> and <b>${c((e) => e.ty === "Section")} sections</b>, <b>${c((e) => e.ty === "FAQ")} answers</b> from How we calculate, `
        + `<b>${c((e) => e.ty === "Term")} glossary terms</b>, <b>${c((e) => e.ty === "Row" && e.p === "Items")} items</b> and <b>${c((e) => e.ty === "Row" && /^Blend left open/.test(e.p))} gas events</b>.`
    };
  }

  /* ---------- jumping to a result ---------- */
  function topOffset() {
    let off = q1(".site-header")?.getBoundingClientRect().bottom || 0;
    qa(`#page-${currentPage} .ctl`).forEach((c) => { if (getComputedStyle(c).position === "sticky" && c.getClientRects().length) off += c.getBoundingClientRect().height; });
    return off + 16;
  }
  function flash(el) { el.classList.remove("ama-hit"); void el.offsetWidth; el.classList.add("ama-hit"); setTimeout(() => el.classList.remove("ama-hit"), 2600); }
  function bring(el) {
    const behavior = REDUCED ? "auto" : "smooth";
    const go = () => window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - topOffset()), behavior });
    go(); flash(el);
    const f = el.matches("details") ? q1("summary", el) : el;
    if (!f.matches("a, button, input, select, textarea, summary") && !f.hasAttribute("tabindex")) f.setAttribute("tabindex", "-1");
    f.focus({ preventScroll: true });
    // charts above it may still be drawing: settle once more, unless the person has scrolled since
    let moved = false; const mark = () => { moved = true; }, EV = ["wheel", "touchstart", "keydown", "pointerdown"];
    EV.forEach((t) => window.addEventListener(t, mark, { passive: true, once: true }));
    setTimeout(() => { EV.forEach((t) => window.removeEventListener(t, mark)); if (!moved && el.isConnected) go(); }, 900);
  }
  let jumpN = 0;
  async function jump(hash) {
    const [page, spec = ""] = String(hash).replace(/^#/, "").split("~");
    if (!PAGE_IDS.includes(page)) return;
    const my = ++jumpN;
    try { history.replaceState(history.state, "", "#" + page); } catch (e) { /* not allowed here */ }
    await Promise.resolve(currentPage !== page ? navigate(page) : lastNav).catch(() => {});
    if (my !== jumpN || currentPage !== page) return;   // a newer jump, or a guest sent back to the dashboard
    setTimeout(lift, 60);
    const i = spec.indexOf(":"), kind = i < 0 ? "" : spec.slice(0, i), val = i < 0 ? "" : decodeURIComponent(spec.slice(i + 1));
    let el = null;
    if (kind === "item") {
      const inp = q1("#items-brand"); if (inp) { inp.value = val; renderItems(); }
      el = qa("#items-table tbody tr").find((tr) => clean(tr.cells[0]?.textContent).split(" ")[0] === val) || null;
    } else if (kind === "qa") {
      const [sid, n] = val.split("."), sec = sid ? document.getElementById(sid)?.closest(".an-sec, section") : null, d = sec ? qa("details.qa", sec)[+n] : null;
      if (d) { d.open = true; el = d; }
    } else if (kind === "sec") el = document.getElementById(val);
    else if (kind === "ev") el = document.getElementById("an-sec-events");
    if (el && el.getClientRects().length) bring(el);
    else window.scrollTo({ top: 0, behavior: REDUCED ? "auto" : "smooth" });
  }
  window.addEventListener("hashchange", () => { if (api && location.hash.includes("~")) jump(location.hash); });

  /* ---------- phones: stand above the bars pinned to the bottom of the screen ---------- */
  const DOCKS = ["#dash-ctl", "#pw", "#si-pill"];
  function lift() {
    if (!api) return;
    const el = api.el; let b = 0;
    if (!el.classList.contains("open")) {
      const right = (q1(".ama-btn", el)?.getBoundingClientRect().right || 80) + 8;
      DOCKS.forEach((s) => {
        const d = q1(s); if (!d || d.closest(".page.hidden, .hidden")) return;
        const cs = getComputedStyle(d); if (cs.position !== "fixed" || cs.display === "none" || cs.visibility === "hidden") return;
        const r = d.getBoundingClientRect(); if (!r.height || r.left > right) return;
        b = Math.max(b, window.innerHeight - r.top);
      });
    }
    el.style.bottom = b ? `${Math.round(b + 8)}px` : "";
  }

  /* ---------- mounting ---------- */
  let api = null, wanted = false, loading = null, ro = null, mo = null;
  const load = (src) => new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => no(new Error("did not load: " + src)); document.head.appendChild(s); });
  function fresh() { return items !== seen.items || tableCache.gas_events !== seen.ev; }
  function reindex() { window.AF.amaIndexes[KEY] = build(); if (api) api.reindex(); }
  async function mount() {
    wanted = true;
    if (api) return;
    try { loading = loading || (window.AF && AF.ama ? Promise.resolve() : load(SRC)); await loading; } catch (e) { loading = null; return; }
    if (!wanted || api) return;
    Object.assign(AF.ama.CHARS[KEY], words());
    AF.amaIndexes = AF.amaIndexes || {}; AF.amaIndexes[KEY] = build();
    api = AF.ama.mount({
      char: KEY, introKey: "gbrAmaIntro.v1", target: "_self", delay: 700,
      link: (e) => e.u || "#" + e.h,
      onJump: (ent, ev, a) => {
        a.close();
        const href = ev.target.closest("a")?.getAttribute("href") || "";
        if (href.startsWith("#") && href === location.hash) { ev.preventDefault(); jump(href); }
      },
      src3d: SRC3D, threeSrc: THREE_SRC
    });
    // the data may have been pulled again since: rebuild before the search opens
    api.el.addEventListener("click", (e) => { if (e.target.closest(".ama-btn") && fresh()) { Object.assign(AF.ama.CHARS[KEY], words()); reindex(); } }, true);
    document.body.classList.add("has-ama");
    if (window.ResizeObserver) { ro = new ResizeObserver(() => lift()); DOCKS.forEach((s) => { const d = q1(s); if (d) ro.observe(d); }); }
    mo = new MutationObserver(() => lift()); mo.observe(api.el, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("resize", lift); window.addEventListener("hashchange", onHash);
    setTimeout(lift, 50);
    if (location.hash.includes("~")) jump(location.hash);
  }
  const onHash = () => setTimeout(lift, 80);
  function unmount() {
    wanted = false;
    if (ro) { ro.disconnect(); ro = null; } if (mo) { mo.disconnect(); mo = null; }
    window.removeEventListener("resize", lift); window.removeEventListener("hashchange", onHash);
    if (api) { api.destroy(); api = null; }
    if (window.AF && AF.amaIndexes) delete AF.amaIndexes[KEY];
    document.body.classList.remove("has-ama");
  }
  window.amaSite = { mount, unmount, jump, get api() { return api; } };
  // signed in before this file ran (the preview, or a fast session check): mount now
  if (!q1("#app").classList.contains("hidden")) mount();
})();
