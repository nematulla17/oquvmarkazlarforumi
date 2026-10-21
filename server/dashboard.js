/* =====================================================================
   Sotuv + Meta Ads dashboard (tashqi kutubxonasiz, Node 18+)
   - GET /dashboard                 -> dashboard/index.html (+ app.js, style.css)
   - GET /api/dashboard?from&to     -> server tomonda yig‘ilgan JSON (tokenlar brauzerga chiqmaydi)
   - GET /api/dashboard/video?id=   -> e'lon videosining o‘ynaladigan mp4 manzili (talab bo‘yicha)
   Hammasi HTTP Basic auth bilan himoyalangan: DASHBOARD_USER / DASHBOARD_PASSWORD.
   Faqat O‘QISH so‘rovlari: Meta va amoCRM da hech narsa o‘zgartirilmaydi.
   ===================================================================== */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DIR = path.resolve(__dirname, "..", "dashboard");
const FILES = { "/dashboard": "index.html", "/dashboard/": "index.html", "/dashboard/index.html": "index.html", "/dashboard/app.js": "app.js", "/dashboard/style.css": "style.css" };
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };

const AD_ACCOUNT = process.env.META_AD_ACCOUNT || "act_1338204998260984";
const PAGE_ID = process.env.META_PAGE_ID || "1339727935893840";
const PIPELINE = 11406294;
const CACHE_MS = 5 * 60 * 1000;
const TZ_OFFSET = "+05:00"; // Asia/Tashkent (yozgi vaqt yo‘q)

// Voronka bosqichlari (amoCRM sort tartibida). rank — "qanchalik oldinga borgan"
const STAGES = [
  { id: 89356398, name: "Неразобранное", rank: 0 },
  { id: 89356402, name: "YANGI LID", rank: 1 },
  { id: 89356518, name: "KO`TARMADI", rank: 2 },
  { id: 89412314, name: "QAYA ALOQA", rank: 3 },
  { id: 89356406, name: "mA`LUMOT BERILDI", rank: 4 },
  { id: 89356410, name: "TO`LOV KUTILYAPTI", rank: 5 },
  { id: 142, name: "TO`LANDI", rank: 6 },
  { id: 143, name: "rad etdi", rank: -1 }
];
const STAGE = Object.fromEntries(STAGES.map((s) => [s.id, s]));
const WON = 142, LOST = 143;

function env() {
  return {
    metaToken: process.env.META_SYSTEM_USER_TOKEN || "",
    amoUrl: (process.env.AMOCRM_BASE_URL || "").replace(/\/+$/, ""),
    amoToken: process.env.AMOCRM_TOKEN || "",
    usdUzs: Number(process.env.USD_UZS || 12800) || 12800,
    user: process.env.DASHBOARD_USER || "forum",
    pass: process.env.DASHBOARD_PASSWORD || ""
  };
}

/* ---------- USD → so‘m kursi: Markaziy bank (cbu.uz), 6 soatda bir yangilanadi ----------
   CBU ishlamasa oxirgi ma'lum kurs, u ham bo‘lmasa USD_UZS (env) ishlatiladi. */
let fx = null; // { rate, date, t }
async function usdRate(fallback) {
  if (fx && Date.now() - fx.t < 6 * 3600 * 1000) return fx;
  try {
    const r = await fetch("https://cbu.uz/uz/arkhiv-kursov-valyut/json/USD/", { signal: AbortSignal.timeout(8000) });
    const row = (await r.json())[0] || {};
    const rate = Number(row.Rate);
    if (!r.ok || !(rate > 1000)) throw new Error("CBU javobi noto‘g‘ri");
    fx = { rate, date: row.Date || "", source: "cbu.uz", t: Date.now() };
  } catch (err) {
    console.error("USD kursi:", err.message);
    if (!fx) return { rate: fallback, date: "", source: "USD_UZS (zaxira)" };
  }
  return fx;
}

/* ---------- HTTP kirish nuqtasi: true qaytarsa so‘rov shu yerda ishlandi ---------- */
async function handle(req, res) {
  const url = new URL(req.url, "http://x");
  const p = url.pathname;
  const isPage = p === "/dashboard" || p.startsWith("/dashboard/");
  const isApi = p === "/api/dashboard" || p.startsWith("/api/dashboard/");
  if (!isPage && !isApi) return false;

  const e = env();
  if (!e.pass) { send(res, 503, "text/plain; charset=utf-8", "dashboard sozlanmagan"); return true; }
  if (!authorized(req, e)) {
    res.writeHead(401, { "WWW-Authenticate": 'Basic realm="Forum dashboard", charset="UTF-8"', "Content-Type": "text/plain; charset=utf-8" });
    res.end("Login kerak"); return true;
  }
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); res.end(); return true; }

  if (isPage) {
    const f = FILES[p];
    if (!f) { send(res, 404, "text/plain", "Not found"); return true; }
    fs.readFile(path.join(DIR, f), (err, buf) => {
      if (err) return send(res, 404, "text/plain", "Not found");
      send(res, 200, TYPES[path.extname(f)], buf);
    });
    return true;
  }

  try {
    if (p === "/api/dashboard") {
      const { from, to } = parseRange(url.searchParams.get("from"), url.searchParams.get("to"));
      const rate = await usdRate(e.usdUzs);
      e.usdUzs = rate.rate; e.usdUzsDate = rate.date; e.usdUzsSource = rate.source;
      const data = await cached(`dash:${from}:${to}:${rate.date}`, CACHE_MS, () => buildDashboard(from, to, e));
      sendJson(res, 200, data);
    } else if (p === "/api/dashboard/video") {
      const ids = [url.searchParams.get("id"), url.searchParams.get("alt")].filter((x) => /^\d{5,25}$/.test(x || ""));
      if (!ids.length || !ids.every((id) => knownVideos.has(id))) return sendJson(res, 400, { ok: false, error: "video_id" }), true;
      const src = await cached(`video:${ids.join(",")}`, 30 * 60 * 1000, () => videoSource(ids, e));
      sendJson(res, src ? 200 : 404, src ? { ok: true, src } : { ok: false, error: "source_yoq" });
    } else sendJson(res, 404, { ok: false });
  } catch (err) {
    console.error("Dashboard", err.message);
    sendJson(res, 502, { ok: false, error: String(err.message || err).replace(/access_token=[^&\s"]+/g, "access_token=***").slice(0, 300) });
  }
  return true;
}

function authorized(req, e) {
  const m = /^Basic\s+(.+)$/i.exec(req.headers.authorization || "");
  if (!m) return false;
  const raw = Buffer.from(m[1], "base64").toString("utf8");
  const i = raw.indexOf(":");
  if (i < 0) return false;
  const eq = (a, b) => { const x = crypto.createHash("sha256").update(a).digest(), y = crypto.createHash("sha256").update(b).digest(); return crypto.timingSafeEqual(x, y); };
  return eq(raw.slice(0, i), e.user) & eq(raw.slice(i + 1), e.pass) ? true : false;
}

function send(res, code, type, body) {
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" });
  res.end(body);
}
function sendJson(res, code, obj) { send(res, code, "application/json; charset=utf-8", JSON.stringify(obj)); }

/* ---------- sana oralig‘i (Toshkent vaqti) ---------- */
function tashkentToday() { return new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10); }
function addDays(d, n) { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
function parseRange(f, t) {
  const ok = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "") && !isNaN(Date.parse(s + "T00:00:00Z"));
  const today = tashkentToday();
  let to = ok(t) ? t : today;
  let from = ok(f) ? f : addDays(to, -29);
  if (to > today) to = today;
  if (from > to) [from, to] = [to, from];
  if (Date.parse(to) - Date.parse(from) > 400 * 86400000) from = addDays(to, -400);
  return { from, to };
}
const unix = (d, end) => Math.floor(Date.parse(`${d}T${end ? "23:59:59" : "00:00:00"}${TZ_OFFSET}`) / 1000);
const dayOf = (ts) => new Date(ts * 1000 + 5 * 3600 * 1000).toISOString().slice(0, 10);

/* ---------- kesh ---------- */
const cache = new Map(); // key -> { t, p }
function cached(key, ttl, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < ttl) return hit.p;
  const p = fn();
  cache.set(key, { t: Date.now(), p });
  p.catch(() => cache.delete(key));
  if (cache.size > 200) for (const [k, v] of cache) if (Date.now() - v.t > ttl * 6) cache.delete(k);
  return p;
}

/* ---------- Meta Graph (faqat GET) ---------- */
async function graph(pathAndQuery, token) {
  const sep = pathAndQuery.includes("?") ? "&" : "?";
  const r = await fetch(`https://graph.facebook.com/v23.0/${pathAndQuery}${sep}access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(25000) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Meta: ${(d.error && d.error.message) || r.status}`);
  return d;
}
async function graphAll(pathAndQuery, token, maxPages = 20) {
  let out = [], next = pathAndQuery;
  for (let i = 0; next && i < maxPages; i++) {
    const d = await graph(next, token);
    out = out.concat(d.data || []);
    next = d.paging && d.paging.next ? d.paging.next.replace(/^https:\/\/graph\.facebook\.com\/v[\d.]+\//, "").replace(/&?access_token=[^&]*/, "") : null;
  }
  return out;
}

const knownVideos = new Set();
let pageToken = null;
async function videoSource(ids, e) {
  for (const id of ids) {
    try { const d = await graph(`${id}?fields=source`, e.metaToken); if (d.source) return d.source; } catch { /* keyingisi */ }
  }
  // Ba'zi reels videolari faqat sahifa tokeni bilan ochiladi
  try {
    if (!pageToken) pageToken = (await graph(`${PAGE_ID}?fields=access_token`, e.metaToken)).access_token || null;
    for (const id of ids) {
      if (!pageToken) break;
      try { const d = await graph(`${id}?fields=source`, pageToken); if (d.source) return d.source; } catch { /* keyingisi */ }
    }
  } catch (err) { console.error("Video sahifa tokeni", err.message); }
  return null;
}

async function dailyInsights(from, to, F, token) {
  const days = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  const chunks = [];
  for (let i = 0; i < days.length; i += 31) chunks.push(days.slice(i, i + 31));
  // Kunlik bo‘lishda "actions" so‘ralsa Meta spend/impressions ni 0 qaytaradi — shuning uchun ikki alohida so‘rov
  const get = (fields) => Promise.all(chunks.map((c) => graphAll(`${AD_ACCOUNT}/insights?level=account&fields=${fields}&limit=100&time_ranges=` +
    encodeURIComponent(JSON.stringify(c.map((d) => ({ since: d, until: d })))), token))).then((p) => p.flat());
  const [base, acts] = await Promise.all([get("spend,impressions,reach,clicks,ctr,cpm"), get("actions")]);
  const byDay = new Map(acts.map((r) => [r.date_start, r.actions]));
  return base.map((r) => ({ ...r, actions: byDay.get(r.date_start) || [] }));
}

function actionVal(list, types) {
  for (const t of types) { const a = (list || []).find((x) => x.action_type === t); if (a) return Number(a.value) || 0; }
  return 0;
}
const LEAD_TYPES = ["lead", "onsite_conversion.lead_grouped"];

async function fetchMeta(from, to, token) {
  const tr = encodeURIComponent(JSON.stringify({ since: from, until: to }));
  const F = "spend,impressions,reach,clicks,ctr,cpm,actions,cost_per_action_type";
  const [total, daily, camps, ads, campaigns, adsets, adList] = await Promise.all([
    graphAll(`${AD_ACCOUNT}/insights?level=account&fields=${F}&time_range=${tr}`, token),
    dailyInsights(from, to, F, token),
    graphAll(`${AD_ACCOUNT}/insights?level=campaign&fields=campaign_id,campaign_name,${F}&time_range=${tr}&limit=500`, token),
    graphAll(`${AD_ACCOUNT}/insights?level=ad&fields=ad_id,ad_name,campaign_id,${F}&time_range=${tr}&limit=500`, token),
    graphAll(`${AD_ACCOUNT}/campaigns?fields=name,status,effective_status,daily_budget,lifetime_budget,created_time&limit=200`, token),
    graphAll(`${AD_ACCOUNT}/adsets?fields=name,campaign_id,status,effective_status,daily_budget,lifetime_budget&limit=200`, token),
    graphAll(`${AD_ACCOUNT}/ads?fields=name,status,effective_status,campaign_id,adset_id,created_time,` +
      `creative.thumbnail_width(540).thumbnail_height(960){video_id,thumbnail_url,image_url,object_story_spec}&limit=200`, token)
  ]);
  const norm = (r) => ({
    spend: Number(r.spend) || 0, impressions: Number(r.impressions) || 0, reach: Number(r.reach) || 0,
    clicks: Number(r.clicks) || 0, ctr: Number(r.ctr) || 0, cpm: Number(r.cpm) || 0, leads: actionVal(r.actions, LEAD_TYPES)
  });
  return { total: total[0] ? norm(total[0]) : norm({}), daily: daily.map((r) => ({ date: r.date_start, ...norm(r) })),
    camps: camps.map((r) => ({ id: r.campaign_id, name: r.campaign_name, ...norm(r) })),
    ads: ads.map((r) => ({ id: r.ad_id, name: r.ad_name, campaign_id: r.campaign_id, ...norm(r) })),
    campaigns, adsets, adList };
}

/* ---------- amoCRM (faqat GET) ---------- */
async function amo(e, p) {
  const r = await fetch(`${e.amoUrl}/api/v4/${p}`, { headers: { Authorization: `Bearer ${e.amoToken}` }, signal: AbortSignal.timeout(25000) });
  if (r.status === 204) return {};
  if (!r.ok) throw new Error(`amoCRM ${r.status}`);
  return r.json();
}
async function amoAll(e, p, key, limit, maxPages) {
  let out = [];
  for (let page = 1; page <= maxPages; page++) {
    const d = await amo(e, `${p}&limit=${limit}&page=${page}`);
    const rows = ((d._embedded || {})[key]) || [];
    out = out.concat(rows);
    if (rows.length < limit || !(d._links && d._links.next)) break;
  }
  return out;
}

// "Facebook №<leadgen_id>" bitimlari uchun Meta lid -> kampaniya/e'lon (abadiy kesh, o‘zgarmaydi)
const fbAttr = new Map(); // leadgen_id -> {campaign_id, campaign_name, ad_id, ad_name, adset_name} | null
async function attributeFb(ids, token) {
  const todo = [...new Set(ids)].filter((id) => !fbAttr.has(id));
  let i = 0;
  const worker = async () => {
    while (i < todo.length) {
      const id = todo[i++];
      try {
        const d = await graph(`${id}?fields=campaign_id,campaign_name,ad_id,ad_name,adset_name`, token);
        fbAttr.set(id, { campaign_id: d.campaign_id || "", campaign_name: d.campaign_name || "", ad_id: d.ad_id || "", ad_name: d.ad_name || "", adset_name: d.adset_name || "" });
      } catch { fbAttr.set(id, null); }
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
}

/* ---------- yig‘ish ---------- */
async function buildDashboard(from, to, e) {
  const errors = [];
  const t0 = unix(from), t1 = unix(to, true);

  const metaP = e.metaToken ? fetchMeta(from, to, e.metaToken).catch((err) => { errors.push(err.message); return null; }) : Promise.resolve(null);
  const amoP = e.amoUrl && e.amoToken ? Promise.all([
    amoAll(e, `leads?filter[pipeline_id]=${PIPELINE}&filter[created_at][from]=${t0}&filter[created_at][to]=${t1}&order[created_at]=asc`, "leads", 250, 40),
    amoAll(e, `events?filter[type]=lead_status_changed&filter[entity]=lead&filter[created_at][from]=${t0}`, "events", 100, 150)
  ]).catch((err) => { errors.push(err.message); return null; }) : Promise.resolve(null);
  if (!e.metaToken) errors.push("META_SYSTEM_USER_TOKEN yo‘q");
  if (!e.amoToken) errors.push("AMOCRM_TOKEN yo‘q");

  const [meta, crm] = await Promise.all([metaP, amoP]);
  const rawLeads = crm ? crm[0] : [], events = crm ? crm[1] : [];

  // Bosqichlar tarixi
  const byLead = new Map();
  for (const ev of events) {
    if (!ev.entity_id) continue;
    (byLead.get(ev.entity_id) || byLead.set(ev.entity_id, []).get(ev.entity_id)).push(ev);
  }
  const cf = (l, code) => { const f = (l.custom_fields_values || []).find((x) => x.field_code === code); return f && f.values[0] ? String(f.values[0].value || "") : ""; };

  // Meta forma bitimlarini kampaniyaga bog‘lash
  const fbIdOf = (l) => (/^Facebook\s*№\s*(\d{6,})/.exec(l.name || "") || [])[1] || "";
  if (meta && e.metaToken) {
    const need = rawLeads.filter((l) => !cf(l, "UTM_CAMPAIGN")).map(fbIdOf).filter(Boolean);
    try { await attributeFb(need, e.metaToken); } catch (err) { errors.push("Meta lid atributsiyasi: " + err.message); }
  }

  const nowS = Math.floor(Date.now() / 1000);
  const leads = rawLeads.map((l) => {
    const evs = (byLead.get(l.id) || []).filter((x) => {
      const a = x.value_after && x.value_after[0] && x.value_after[0].lead_status;
      return a && a.pipeline_id === PIPELINE;
    }).sort((a, b) => a.created_at - b.created_at);
    const trail = [];
    const first = evs[0] && evs[0].value_before && evs[0].value_before[0] && evs[0].value_before[0].lead_status;
    if (first && first.pipeline_id === PIPELINE) trail.push(first.id);
    for (const ev of evs) { const s = ev.value_after[0].lead_status.id; if (trail[trail.length - 1] !== s) trail.push(s); }
    if (trail[trail.length - 1] !== l.status_id) trail.push(l.status_id);
    const maxRank = Math.max(...trail.map((s) => (STAGE[s] ? STAGE[s].rank : 0)), l.status_id === WON ? 6 : -1);
    const lastChange = evs.length ? evs[evs.length - 1].created_at : l.created_at;
    const tags = ((l._embedded || {}).tags || []).map((t) => t.name);
    const fid = fbIdOf(l);
    const attr = fid ? fbAttr.get(fid) : null;
    const utm = { source: cf(l, "UTM_SOURCE"), campaign: cf(l, "UTM_CAMPAIGN"), content: cf(l, "UTM_CONTENT"), term: cf(l, "UTM_TERM") };
    const isMeta = !!fid || tags.includes("meta-forma") || tags.some((t) => /^fb\d+$/.test(t)) || /^(facebook|fb|ig|instagram)$/i.test(utm.source);
    const source = isMeta ? "meta-forma" : tags.includes("forum-sayt") ? "forum-sayt" : "boshqa";
    return {
      id: l.id, name: l.name || `#${l.id}`, status: l.status_id, price: Number(l.price) || 0,
      created: l.created_at, closed: l.closed_at || null, day: dayOf(l.created_at),
      daysInStage: Math.max(0, Math.floor((nowS - lastChange) / 86400)),
      path: trail, maxRank, left: trail.some((s) => s !== 89356398 && s !== 89356402),
      source, tags,
      campaign: utm.campaign || (attr && attr.campaign_name) || "", campaign_id: (attr && attr.campaign_id) || "",
      ad: utm.content || (attr && attr.ad_name) || "", ad_id: (attr && attr.ad_id) || "",
      adset: utm.term || (attr && attr.adset_name) || ""
    };
  });

  // CRM KPI
  const won = leads.filter((l) => l.status === WON);
  const crmTotals = {
    leads: leads.length,
    contacted: leads.filter((l) => l.left).length,
    qualified: leads.filter((l) => l.maxRank >= 4).length,
    awaiting: leads.filter((l) => l.status === 89356410).length,
    awaitingPlus: leads.filter((l) => l.maxRank >= 5).length,
    won: won.length,
    lost: leads.filter((l) => l.status === LOST).length,
    sales: won.reduce((s, l) => s + l.price, 0),
    bySource: leads.reduce((o, l) => (o[l.source] = (o[l.source] || 0) + 1, o), {})
  };

  // Voronka
  const funnel = [
    { key: "all", name: "Jami lidlar", count: leads.length },
    { key: "contacted", name: "Aloqa qilindi (YANGI LID dan chiqdi)", count: crmTotals.contacted },
    { key: "qualified", name: "Ma‘lumot berildi va undan keyin", count: crmTotals.qualified },
    { key: "awaiting", name: "To‘lov kutilyapti va undan keyin", count: crmTotals.awaitingPlus },
    { key: "won", name: "To‘landi", count: crmTotals.won }
  ];
  const stageCounts = STAGES.map((s) => ({ id: s.id, name: s.name, count: leads.filter((l) => l.status === s.id).length }));

  // Kunlik jadval
  const days = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  const metaDay = new Map(((meta && meta.daily) || []).map((r) => [r.date, r]));
  const daily = days.map((d) => {
    const m = metaDay.get(d) || { spend: 0, impressions: 0, reach: 0, clicks: 0, ctr: 0, leads: 0 };
    const dl = leads.filter((l) => l.day === d);
    return { date: d, spend: m.spend, impressions: m.impressions, reach: m.reach, clicks: m.clicks, ctr: m.ctr, metaLeads: m.leads,
      crmLeads: dl.length, crmQualified: dl.filter((l) => l.maxRank >= 4).length, crmWon: dl.filter((l) => l.status === WON).length };
  });

  // Kampaniyalar
  const key = (s) => String(s || "").trim().toLowerCase();
  let campaigns = [], ads = [], unmatchedMeta = 0;
  if (meta) {
    const ins = new Map(meta.camps.map((c) => [c.id, c]));
    const budgetOf = (c) => {
      if (Number(c.daily_budget)) return Number(c.daily_budget) / 100;
      const sets = meta.adsets.filter((a) => a.campaign_id === c.id && (a.effective_status || a.status) === "ACTIVE");
      const sum = sets.reduce((s, a) => s + (Number(a.daily_budget) || 0), 0);
      return sum ? sum / 100 : null;
    };
    const campByName = new Map(meta.campaigns.map((c) => [key(c.name), c.id]));
    const leadCamp = (l) => l.campaign_id || campByName.get(key(l.campaign)) || "";
    const crmFor = (pred) => {
      const ls = leads.filter(pred), w = ls.filter((l) => l.status === WON);
      return { crmLeads: ls.length, crmQualified: ls.filter((l) => l.maxRank >= 4).length, crmWon: w.length, sales: w.reduce((s, l) => s + l.price, 0) };
    };
    campaigns = meta.campaigns.map((c) => {
      const m = ins.get(c.id) || { spend: 0, impressions: 0, reach: 0, clicks: 0, ctr: 0, leads: 0 };
      const crmc = crmFor((l) => leadCamp(l) === c.id);
      const spendUzs = m.spend * e.usdUzs;
      return { id: c.id, name: c.name, status: c.effective_status || c.status, dailyBudget: budgetOf(c),
        spend: m.spend, impressions: m.impressions, reach: m.reach, clicks: m.clicks, ctr: m.ctr, metaLeads: m.leads,
        cpl: m.leads ? m.spend / m.leads : null, ...crmc, roas: spendUzs ? crmc.sales / spendUzs : null };
    }).filter((c) => c.spend > 0 || c.crmLeads > 0 || c.status === "ACTIVE")
      .sort((a, b) => b.crmWon - a.crmWon || b.sales - a.sales || b.crmQualified - a.crmQualified || b.crmLeads - a.crmLeads || b.spend - a.spend);
    unmatchedMeta = leads.filter((l) => l.source === "meta-forma" && !leadCamp(l)).length;

    // Kreativlar (e'lonlar)
    const adIns = new Map(meta.ads.map((a) => [a.id, a]));
    const campName = new Map(meta.campaigns.map((c) => [c.id, c.name]));
    const nameCount = meta.adList.reduce((o, a) => (o[key(a.name)] = (o[key(a.name)] || 0) + 1, o), {});
    ads = meta.adList.map((a) => {
      const m = adIns.get(a.id) || { spend: 0, impressions: 0, clicks: 0, ctr: 0, leads: 0, reach: 0 };
      const cr = a.creative || {};
      const story = cr.object_story_spec || {};
      const vd = story.video_data || {};
      const vid = cr.video_id || vd.video_id || "";
      const alt = vd.video_id && vd.video_id !== vid ? vd.video_id : "";
      [vid, alt].filter(Boolean).forEach((v) => knownVideos.add(String(v)));
      const cn = campName.get(a.campaign_id) || "";
      const crmc = crmFor((l) => l.ad_id ? l.ad_id === a.id
        : key(l.ad) === key(a.name) && (leadCamp(l) ? leadCamp(l) === a.campaign_id : nameCount[key(a.name)] === 1));
      return { id: a.id, name: a.name, campaign: cn, campaign_id: a.campaign_id, status: a.effective_status || a.status,
        thumb: cr.thumbnail_url || cr.image_url || vd.image_url || "", video: vid ? String(vid) : "", videoAlt: alt ? String(alt) : "",
        title: vd.title || (story.link_data && story.link_data.name) || "", message: vd.message || (story.link_data && story.link_data.message) || "",
        spend: m.spend, impressions: m.impressions, reach: m.reach, clicks: m.clicks, ctr: m.ctr, metaLeads: m.leads,
        cpl: m.leads ? m.spend / m.leads : null, ...crmc };
    }).sort((a, b) => b.spend - a.spend || b.crmWon - a.crmWon);
  }

  const spend = meta ? meta.total.spend : 0;
  return {
    ok: true, from, to, generatedAt: new Date().toISOString(), usdUzs: e.usdUzs, usdUzsDate: e.usdUzsDate || "", usdUzsSource: e.usdUzsSource || "", amoUrl: e.amoUrl, errors,
    meta: meta ? { ...meta.total, cpl: meta.total.leads ? spend / meta.total.leads : null } : null,
    crm: { ...crmTotals, conversion: crmTotals.leads ? crmTotals.won / crmTotals.leads : null, cac: crmTotals.won ? spend / crmTotals.won : null },
    daily, funnel, stages: STAGES.map((s) => ({ id: s.id, name: s.name, rank: s.rank })), stageCounts,
    campaigns, unmatchedMeta, ads,
    leads: leads.sort((a, b) => b.created - a.created).map(({ tags, maxRank, left, ...l }) => ({ ...l, maxRank }))
  };
}

module.exports = { handle };
