/* Forum 2026 sotuv paneli — brauzer qismi. Ma'lumot faqat /api/dashboard dan (tokenlar serverda). */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- formatlash: to‘liq raqamlar, minglik ajratgich — bo‘shliq ---------- */
  const group = (s) => s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  function num(n, dec = 0) {
    if (n == null || !isFinite(n)) return "—";
    const neg = n < 0; const [i, d] = Math.abs(n).toFixed(dec).split(".");
    return (neg ? "−" : "") + group(i) + (d ? "," + d : "");
  }
  const usd = (n) => (n == null || !isFinite(n) ? "—" : "$" + num(n, 2));
  const uzs = (n) => (n == null || !isFinite(n) ? "—" : num(n) + " so‘m");
  const pct = (n, dec = 2) => (n == null || !isFinite(n) ? "—" : num(n, dec) + "%");

  const STAGE_UZ = {
    89356398: "Saralanmagan", 89356402: "Yangi lid", 89356518: "Ko‘tarmadi", 89412314: "Qayta aloqa",
    89356406: "Ma‘lumot berildi", 89356410: "To‘lov kutilyapti", 142: "To‘landi", 143: "Rad etdi"
  };
  const STATUS = {
    ACTIVE: ["Faol", "on"], PAUSED: ["To‘xtatilgan", ""], CAMPAIGN_PAUSED: ["Kampaniya to‘xtatilgan", ""], ADSET_PAUSED: ["Guruh to‘xtatilgan", ""],
    PENDING_REVIEW: ["Tekshiruvda", "wait"], IN_PROCESS: ["Jarayonda", "wait"], PENDING_BILLING_INFO: ["To‘lov ma‘lumoti kutilmoqda", "wait"],
    DISAPPROVED: ["Rad etilgan", "bad"], WITH_ISSUES: ["Muammo bor", "bad"], ARCHIVED: ["Arxivda", ""], DELETED: ["O‘chirilgan", ""]
  };
  const statusBadge = (s) => { const [t, c] = STATUS[s] || [s || "—", ""]; return `<span class="st ${c ? "st--" + c : ""}">${esc(t)}</span>`; };

  /* ---------- sana (Asia/Tashkent, UTC+5) ---------- */
  const today = () => new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);
  const shift = (d, n) => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
  const human = (d) => d.split("-").reverse().join(".");
  const dt = (ts) => { const d = new Date(ts * 1000 + 5 * 3600e3).toISOString(); return human(d.slice(0, 10)) + " " + d.slice(11, 16); };
  const PRESETS = {
    today: () => [today(), today()],
    yesterday: () => [shift(today(), -1), shift(today(), -1)],
    7: () => [shift(today(), -6), today()],
    30: () => [shift(today(), -29), today()],
    month: () => [today().slice(0, 8) + "01", today()]
  };

  let DATA = null, charts = {}, leadLimit = 50;

  function markPreset() {
    const f = $("#from").value, t = $("#to").value;
    document.querySelectorAll(".presets button").forEach((b) => {
      const [a, z] = PRESETS[b.dataset.p](); b.classList.toggle("on", a === f && z === t);
    });
  }
  function setRange(f, t, load) { $("#from").value = f; $("#to").value = t; $("#from").max = $("#to").max = today(); markPreset(); if (load) fetchData(); }

  document.querySelectorAll(".presets button").forEach((b) => b.addEventListener("click", () => setRange(...PRESETS[b.dataset.p](), true)));
  $("#range").addEventListener("submit", (e) => { e.preventDefault(); markPreset(); fetchData(); });

  async function fetchData() {
    const f = $("#from").value, t = $("#to").value;
    history.replaceState(null, "", `?from=${f}&to=${t}${location.hash}`);
    $("#status").textContent = "Ma‘lumotlar yuklanmoqda…";
    document.body.setAttribute("aria-busy", "true");
    try {
      const r = await fetch(location.origin + `/api/dashboard?from=${f}&to=${t}`, { credentials: "same-origin" });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "HTTP " + r.status);
      DATA = d; render();
      $("#status").textContent = "";
    } catch (e) {
      $("#status").textContent = "Yuklab bo‘lmadi: " + e.message;
    } finally { document.body.removeAttribute("aria-busy"); }
  }

  function render() {
    const d = DATA;
    $("#from").value = d.from; $("#to").value = d.to; markPreset();
    $("#period").textContent = `${human(d.from)} — ${human(d.to)} · Toshkent vaqti`;
    $("#updated").textContent = `Yangilangan: ${dt(Math.floor(Date.parse(d.generatedAt) / 1000))} · kesh 5 daqiqa`;
    const errs = $("#errors");
    errs.hidden = !d.errors.length; errs.textContent = d.errors.length ? "Ba‘zi ma‘lumotlar olinmadi: " + d.errors.join("; ") : "";
    renderKpis(d); renderCharts(d); renderDaily(d); renderFunnel(d); renderLeads(); renderCampaigns(d); renderAds(d);
  }

  /* ---------- 1. Raqamlar ---------- */
  const tile = (label, value, sub, accent) => `<div class="kpi${accent ? " kpi--accent" : ""}"><div class="kpi__l">${esc(label)}</div><div class="kpi__v">${value}</div>${sub ? `<div class="kpi__s">${sub}</div>` : ""}</div>`;
  function renderKpis(d) {
    const m = d.meta || {}, c = d.crm;
    $("#kpi-meta").innerHTML = d.meta ? [
      tile("Sarf", usd(m.spend), uzs(m.spend * d.usdUzs) + ` (1$ = ${num(d.usdUzs)})`, true),
      tile("Ko‘rishlar (impressions)", num(m.impressions), "CPM " + usd(m.cpm)),
      tile("Qamrov (reach)", num(m.reach)),
      tile("Kliklar", num(m.clicks)),
      tile("CTR", pct(m.ctr)),
      tile("Lidlar (Meta)", num(m.leads)),
      tile("CPL (Meta)", usd(m.cpl), "1 lid narxi")
    ].join("") : tile("Meta", "—", "ma‘lumot yo‘q");
    const share = (n) => (c.leads ? pct((n / c.leads) * 100, 1) + " lidlardan" : "");
    $("#kpi-crm").innerHTML = [
      tile("Yangi lidlar", num(c.leads), Object.entries(c.bySource).map(([k, v]) => `${esc(k)}: ${num(v)}`).join(" · ")),
      tile("Aloqa qilindi", num(c.contacted), share(c.contacted)),
      tile("Sifatli (Ma‘lumot berildi+)", num(c.qualified), share(c.qualified)),
      tile("To‘lov kutilyapti", num(c.awaiting), "hozir shu bosqichda"),
      tile("To‘landi", num(c.won), "Rad etdi: " + num(c.lost), true),
      tile("Sotuv summasi", uzs(c.sales), "to‘langan bitimlar narxi", true),
      tile("Konversiya lid → sotuv", pct(c.conversion == null ? null : c.conversion * 100)),
      tile("CAC (sarf / to‘landi)", usd(c.cac), c.cac != null ? uzs(c.cac * d.usdUzs) : "to‘lov hali yo‘q")
    ].join("");
  }

  function renderCharts(d) {
    if (!window.Chart) return;
    const css = getComputedStyle(document.documentElement);
    const v = (n) => css.getPropertyValue(n).trim();
    Chart.defaults.color = v("--muted"); Chart.defaults.font.family = v("--font"); Chart.defaults.borderColor = v("--line");
    const labels = d.daily.map((r) => human(r.date).slice(0, 5));
    const base = {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { display: false }, tooltip: { backgroundColor: "#000", borderColor: v("--line"), borderWidth: 1, padding: 10,
        titleFont: { weight: "700" }, callbacks: { title: (it) => human(d.daily[it[0].dataIndex].date) } } },
      scales: { x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 12 } },
        y: { beginAtZero: true, grid: { color: "rgba(255,255,255,.05)" }, border: { display: false } } }
    };
    Object.values(charts).forEach((c) => c.destroy());
    charts.spend = new Chart($("#ch-spend"), {
      type: "bar",
      data: { labels, datasets: [{ label: "Sarf", data: d.daily.map((r) => r.spend), backgroundColor: v("--meta"), borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: "bottom", maxBarThickness: 22 }] },
      options: { ...base, plugins: { ...base.plugins, tooltip: { ...base.plugins.tooltip, callbacks: { ...base.plugins.tooltip.callbacks,
        label: (it) => ` Sarf: ${usd(it.raw)} · Meta lidlar: ${num(d.daily[it.dataIndex].metaLeads)}` } } },
        scales: { ...base.scales, y: { ...base.scales.y, ticks: { callback: (x) => "$" + num(x) } } } }
    });
    const line = (label, data, color) => ({ label, data, borderColor: color, backgroundColor: color, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, tension: 0.25 });
    charts.leads = new Chart($("#ch-leads"), {
      type: "line",
      data: { labels, datasets: [line("Meta lidlar", d.daily.map((r) => r.metaLeads), v("--meta")), line("CRM lidlar", d.daily.map((r) => r.crmLeads), v("--crm"))] },
      options: { ...base, plugins: { ...base.plugins, tooltip: { ...base.plugins.tooltip, callbacks: { ...base.plugins.tooltip.callbacks,
        label: (it) => ` ${it.dataset.label}: ${num(it.raw)}` } } },
        scales: { ...base.scales, y: { ...base.scales.y, ticks: { precision: 0, callback: (x) => num(x) } } } }
    });
  }

  function renderDaily(d) {
    const rows = d.daily.slice().reverse();
    const sum = (k) => d.daily.reduce((s, r) => s + r[k], 0);
    const cell = (v, f) => `<td${!v ? ' class="zero"' : ""}>${f(v)}</td>`;
    $("#tbl-daily").innerHTML = `<thead><tr><th>Sana</th><th>Sarf</th><th>Ko‘rishlar</th><th>Qamrov</th><th>Kliklar</th><th>CTR</th><th>Meta lidlar</th><th>CPL</th><th>CRM lidlar</th><th>Sifatli</th><th>To‘landi</th></tr></thead><tbody>` +
      rows.map((r) => `<tr><td>${human(r.date)}</td>${cell(r.spend, usd)}${cell(r.impressions, num)}${cell(r.reach, num)}${cell(r.clicks, num)}${cell(r.ctr, pct)}${cell(r.metaLeads, num)}<td>${usd(r.metaLeads ? r.spend / r.metaLeads : null)}</td>${cell(r.crmLeads, num)}${cell(r.crmQualified, num)}${cell(r.crmWon, num)}</tr>`).join("") +
      `</tbody><tfoot><tr><td>Jami</td><td>${usd(sum("spend"))}</td><td>${num(sum("impressions"))}</td><td>—</td><td>${num(sum("clicks"))}</td><td>${pct(d.meta && d.meta.ctr)}</td><td>${num(sum("metaLeads"))}</td><td>${usd(d.meta && d.meta.cpl)}</td><td>${num(sum("crmLeads"))}</td><td>${num(sum("crmQualified"))}</td><td>${num(sum("crmWon"))}</td></tr></tfoot>`;
  }

  /* ---------- 2. Voronka ---------- */
  function renderFunnel(d) {
    const top = d.funnel[0].count || 1;
    $("#funnel").innerHTML = d.funnel.map((s, i) => {
      const prev = i ? d.funnel[i - 1].count : null;
      const conv = i ? `<div class="fstep__conv">Oldingi bosqichdan: <b>${pct(prev ? (s.count / prev) * 100 : null, 1)}</b> · jami lidlardan: <b>${pct((s.count / top) * 100, 1)}</b></div>` : "";
      return `<div class="fstep"><div class="fstep__top"><span>${esc(s.name)}</span><b>${num(s.count)}</b></div>
        <div class="fstep__bar"><i style="width:${Math.max(0.3, (s.count / top) * 100)}%"></i></div>${conv}</div>`;
    }).join("");
    const max = Math.max(1, ...d.stageCounts.map((s) => s.count));
    $("#stages").innerHTML = d.stageCounts.map((s) => `<button type="button" class="sbar${s.id === 142 ? " sbar--won" : s.id === 143 ? " sbar--lost" : ""}" data-stage="${s.id}" title="Ro‘yxatni shu bosqich bo‘yicha filtrlash">
      <span>${esc(STAGE_UZ[s.id] || s.name)}</span><span class="sbar__t"><i style="width:${(s.count / max) * 100}%"></i></span><span class="sbar__n">${num(s.count)}</span></button>`).join("");
    document.querySelectorAll(".sbar").forEach((b) => b.addEventListener("click", () => {
      $("#f-stage").value = b.dataset.stage; leadLimit = 50; renderLeads();
      $("#tbl-leads").scrollIntoView({ behavior: "smooth", block: "start" });
    }));
    const sel = $("#f-stage"), cur = sel.value;
    sel.innerHTML = `<option value="">Hammasi</option>` + d.stageCounts.map((s) => `<option value="${s.id}">${esc(STAGE_UZ[s.id] || s.name)} (${num(s.count)})</option>`).join("");
    sel.value = cur;
  }

  ["#f-stage", "#f-source"].forEach((s) => $(s).addEventListener("change", () => { leadLimit = 50; renderLeads(); }));
  $("#f-q").addEventListener("input", () => { leadLimit = 50; renderLeads(); });
  $("#more").addEventListener("click", () => { leadLimit += 100; renderLeads(); });

  function chipFor(id, i, arr) {
    const cls = id === 142 ? " chip--won" : id === 143 ? " chip--lost" : i === arr.length - 1 ? " chip--cur" : "";
    return `<span class="chip${cls}">${esc(STAGE_UZ[id] || id)}</span>`;
  }
  function renderLeads() {
    if (!DATA) return;
    const st = $("#f-stage").value, src = $("#f-source").value, q = $("#f-q").value.trim().toLowerCase();
    const list = DATA.leads.filter((l) => (!st || String(l.status) === st) && (!src || l.source === src) &&
      (!q || [l.name, l.campaign, l.ad, l.adset, l.id].join(" ").toLowerCase().includes(q)));
    $("#f-count").textContent = `${num(list.length)} ta bitim`;
    const link = (l) => DATA.amoUrl ? `<a href="${esc(DATA.amoUrl)}/leads/detail/${l.id}" target="_blank" rel="noopener">${esc(l.name)}</a>` : esc(l.name);
    $("#tbl-leads").innerHTML = `<thead><tr><th class="l">Bitim</th><th class="l">Manba</th><th class="l">Kampaniya / e‘lon</th><th class="l">Hozirgi bosqich</th><th>Yaratilgan</th><th>Bosqichda</th><th class="l">O‘tgan bosqichlar</th><th>Summa</th></tr></thead><tbody>` +
      (list.slice(0, leadLimit).map((l) => `<tr>
        <td class="lname">${link(l)}<small>#${l.id}</small></td>
        <td class="l"><span class="src src--${esc(l.source)}">${esc(l.source)}</span></td>
        <td class="l lname">${l.campaign ? esc(l.campaign) + (l.ad ? `<small>e‘lon: ${esc(l.ad)}</small>` : "") : '<span class="muted">—</span>'}</td>
        <td class="l">${chipFor(l.status, 0, [l.status])}</td>
        <td>${dt(l.created)}</td>
        <td>${num(l.daysInStage)} kun</td>
        <td class="l"><div class="chips">${l.path.map((s, i, a) => chipFor(s, i, a)).join('<span class="arr">→</span>')}</div></td>
        <td${l.price ? "" : ' class="zero"'}>${l.price ? uzs(l.price) : "—"}</td></tr>`).join("") ||
        `<tr><td colspan="8" class="l muted">Bu filtr bo‘yicha bitim yo‘q</td></tr>`) + "</tbody>";
    $("#more").hidden = list.length <= leadLimit;
    $("#more").textContent = `Yana ko‘rsatish (${num(Math.min(100, list.length - leadLimit))})`;
  }

  /* ---------- 3. Kampaniyalar ---------- */
  function renderCampaigns(d) {
    const cs = d.campaigns;
    const best = cs.length && (cs[0].crmWon || cs[0].crmQualified || cs[0].crmLeads) ? cs[0].id : null;
    const z = (v, f) => `<td${!v ? ' class="zero"' : ""}>${f(v)}</td>`;
    const tot = (k) => cs.reduce((s, c) => s + (c[k] || 0), 0);
    const tSpend = tot("spend"), tMeta = tot("metaLeads"), tSales = tot("sales");
    $("#tbl-camp").innerHTML = `<thead><tr><th>Kampaniya</th><th class="l">Holat</th><th>Kunlik byudjet</th><th>Sarf</th><th>Ko‘rishlar</th><th>Kliklar</th><th>CTR</th><th>Meta lidlar</th><th>CPL</th><th>CRM lidlar</th><th>Sifatli</th><th>To‘landi</th><th>Sotuv summasi</th><th>ROAS</th></tr></thead><tbody>` +
      cs.map((c) => `<tr class="${c.id === best ? "best" : ""}">
        <td class="cname">${esc(c.name)}${c.id === best ? '<span class="best-tag">Eng yaxshi</span>' : ""}</td>
        <td class="l">${statusBadge(c.status)}</td>
        <td>${c.dailyBudget != null ? usd(c.dailyBudget) : "—"}</td>
        ${z(c.spend, usd)}${z(c.impressions, num)}${z(c.clicks, num)}${z(c.ctr, pct)}${z(c.metaLeads, num)}
        <td>${usd(c.cpl)}</td>${z(c.crmLeads, num)}${z(c.crmQualified, num)}${z(c.crmWon, num)}${z(c.sales, uzs)}
        <td${c.roas ? "" : ' class="zero"'}>${c.roas != null ? num(c.roas, 2) + "×" : "—"}</td></tr>`).join("") +
      `</tbody><tfoot><tr><td>Jami</td><td></td><td></td><td>${usd(tSpend)}</td><td>${num(tot("impressions"))}</td><td>${num(tot("clicks"))}</td><td></td><td>${num(tMeta)}</td><td>${usd(tMeta ? tSpend / tMeta : null)}</td><td>${num(tot("crmLeads"))}</td><td>${num(tot("crmQualified"))}</td><td>${num(tot("crmWon"))}</td><td>${uzs(tSales)}</td><td>${tSpend ? num(tSales / (tSpend * d.usdUzs), 2) + "×" : "—"}</td></tr></tfoot>`;
    $("#camp-note").textContent = `Saralash: to‘landi → sotuv summasi → sifatli → CRM lidlar. ROAS = sotuv (so‘m) / sarf × ${num(d.usdUzs)}. ` +
      (d.unmatchedMeta ? `Kampaniyaga bog‘lanmagan meta-forma bitimlari: ${num(d.unmatchedMeta)}.` : "");
  }

  /* ---------- 4. Kreativlar ---------- */
  function renderAds(d) {
    $("#ads").innerHTML = d.ads.map((a, i) => `<article class="ad" data-i="${i}">
      ${a.thumb ? `<img src="${esc(a.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ""}
      <div class="ad__top"><div class="ad__name">${esc(a.name)}<small>${esc(a.campaign)}</small></div>${statusBadge(a.status)}</div>
      ${a.video ? `<button type="button" class="play" aria-label="Videoni ko‘rish: ${esc(a.name)}">▶</button>` : ""}
      <button type="button" class="ad__close">Yopish ✕</button>
      <div class="ad__stats">
        <div><span>Sarf</span><b>${usd(a.spend)}</b></div>
        <div class="opt"><span>Ko‘rishlar</span><b>${num(a.impressions)}</b></div>
        <div><span>CTR</span><b>${pct(a.ctr)}</b></div>
        <div><span>Meta lidlar</span><b>${num(a.metaLeads)}</b></div>
        <div><span>CPL</span><b>${usd(a.cpl)}</b></div>
        <div><span>CRM lid / sifatli</span><b>${num(a.crmLeads)} / ${num(a.crmQualified)}</b></div>
        <div class="won"><span>To‘landi</span><b>${num(a.crmWon)}</b></div>
        <div class="opt"><span>Sotuv</span><b>${a.sales ? uzs(a.sales) : "—"}</b></div>
      </div></article>`).join("") || '<p class="muted">Bu kabinetda e‘lon yo‘q.</p>';
  }
  $("#ads").addEventListener("click", async (e) => {
    const card = e.target.closest(".ad"); if (!card) return;
    const a = DATA.ads[card.dataset.i];
    if (e.target.closest(".ad__close")) {
      const v = card.querySelector("video"); if (v) { v.pause(); v.remove(); }
      card.classList.remove("playing"); return;
    }
    const btn = e.target.closest(".play"); if (!btn) return;
    btn.disabled = true; btn.textContent = "…";
    const old = card.querySelector(".ad__msg"); if (old) old.remove();
    try {
      const r = await fetch(location.origin + `/api/dashboard/video?id=${encodeURIComponent(a.video)}${a.videoAlt ? "&alt=" + encodeURIComponent(a.videoAlt) : ""}`);
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      document.querySelectorAll(".ad.playing .ad__close").forEach((b) => b.click()); // bir vaqtda bitta video
      const v = document.createElement("video");
      v.src = j.src; v.controls = true; v.autoplay = true; v.playsInline = true; v.poster = a.thumb || "";
      card.appendChild(v); card.classList.add("playing");
      v.play().catch(() => {});
    } catch (err) {
      card.insertAdjacentHTML("beforeend", `<div class="ad__msg">Videoni olib bo‘lmadi</div>`);
    } finally { btn.disabled = false; btn.textContent = "▶"; }
  });

  /* ---------- start ---------- */
  const qs = new URLSearchParams(location.search);
  const ok = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");
  const [df, dt0] = PRESETS[30]();
  setRange(ok(qs.get("from")) ? qs.get("from") : df, ok(qs.get("to")) ? qs.get("to") : dt0, true);
})();
