/* =====================================================================
   Lead server — tashqi kutubxonasiz (Node 18+)
   - Statik saytni beradi (loyiha ildizi)
   - POST /api/lead -> Telegram guruhga xabar + leads.csv ga yozadi
   Ishga tushirish:
     cp server/.env.example server/.env   # token va chat id ni kiriting
     node server/server.js
   ===================================================================== */
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
loadEnv(path.join(__dirname, ".env"));

const PORT = Number(process.env.PORT || 3000);
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";
const LEADS_CSV = process.env.LEADS_CSV || path.join(__dirname, "leads.csv");
const PIXEL_ID = process.env.META_PIXEL_ID || "";
const CAPI_TOKEN = process.env.META_CAPI_TOKEN || "";
const CAPI_TEST_CODE = process.env.META_TEST_EVENT_CODE || ""; // faqat test paytida
const AMO_URL = (process.env.AMOCRM_BASE_URL || "").replace(/\/+$/, "");
const AMO_TOKEN = process.env.AMOCRM_TOKEN || "";
const AMO_PIPELINE = Number(process.env.AMOCRM_PIPELINE_ID || 11406294); // "forum hamkorlar"
const AMO_STATUS = Number(process.env.AMOCRM_STATUS_ID || 89356402);     // "YANGI LID"
const META_TOKEN = process.env.META_SYSTEM_USER_TOKEN || "";
const LEADGEN_FORMS = (process.env.META_LEADGEN_FORM_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
const LEADGEN_POLL_MS = Number(process.env.META_LEADGEN_POLL_SEC || 120) * 1000;

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".mp4": "video/mp4", ".webm": "video/webm", ".pdf": "application/pdf", ".ico": "image/x-icon", ".json": "application/json",
  ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8", ".md": "text/plain; charset=utf-8"
};

const rate = new Map(); // ip -> [timestamps]

http.createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/lead") return await handleLead(req, res);
    if (req.method === "GET" || req.method === "HEAD") return serveStatic(req, res);
    res.writeHead(405); res.end();
  } catch (e) {
    console.error(e);
    json(res, 500, { ok: false, error: "server_error" });
  }
}).listen(PORT, () => console.log(`Sayt: http://localhost:${PORT}  (lead -> ${BOT_TOKEN ? "Telegram + CSV" : "faqat CSV, TELEGRAM_BOT_TOKEN yo‘q"}${PIXEL_ID && CAPI_TOKEN ? " + Meta CAPI" : ""})`));

async function handleLead(req, res) {
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").toString().split(",")[0].trim();
  if (!allow(ip)) return json(res, 429, { ok: false, error: "too_many_requests" });

  const body = await readJson(req, 20_000);
  if (!body) return json(res, 400, { ok: false, error: "bad_json" });
  if (body.website) return json(res, 200, { ok: true }); // honeypot

  const lead = {
    name: str(body.name, 80), company: str(body.company, 120), phone: str(body.phone, 30),
    direction: str(body.direction, 80), package: str(body.package, 30), comment: str(body.comment, 600),
    source: str(body.source, 40), page: str(body.page, 300), referrer: str(body.referrer, 300),
    utm_source: str(body.utm_source, 80), utm_medium: str(body.utm_medium, 80),
    utm_campaign: str(body.utm_campaign, 120), utm_content: str(body.utm_content, 120), utm_term: str(body.utm_term, 120),
    submitted_at: new Date().toISOString(), ip
  };
  const digits = lead.phone.replace(/\D/g, "");
  if (lead.name.length < 2 || lead.company.length < 2 || digits.length !== 12 || !lead.direction) {
    return json(res, 422, { ok: false, error: "validation" });
  }

  appendCsv(lead);
  const meta = {
    event_id: str(body.event_id, 80), external_id: str(body.external_id, 80),
    fbp: str(body.fbp, 120), fbc: str(body.fbc, 300), ua: str(req.headers["user-agent"], 400)
  };
  const capi = sendCapi(lead, meta); // Telegram bilan parallel
  lead.fbclid = (/^fb\.\d\.\d+\.(.+)$/.exec(meta.fbc) || [])[1] || "";
  lead.amo_id = await sendAmo(lead);
  if (BOT_TOKEN && CHAT_ID) {
    const sent = await sendTelegram(formatTelegram(lead));
    if (!sent) console.error("Telegram yuborilmadi", lead.phone);
  }
  await capi;
  json(res, 200, { ok: true });
}

/* ---------- Meta instant forma lidlari: har N soniyada olib, amoCRM + Telegram ga ----------
   Takrorlanmaslik: amoCRM dagi UTM_REFERRER = "fb_lead:<id>" bo‘yicha tekshiriladi, shuning uchun
   server qayta ishga tushsa ham (Railway deploy) bir lid ikki marta tushmaydi. */
const seenLeads = new Set();
let leadgenSince = Math.floor(Date.now() / 1000) - 3 * 24 * 3600; // birinchi aylanishda oxirgi 3 kun

async function pollLeadgen() {
  const from = leadgenSince;
  leadgenSince = Math.floor(Date.now() / 1000) - 600; // keyingi aylanishlarda 10 daqiqalik ustma-ust oyna
  for (const form of LEADGEN_FORMS) {
    let url = `https://graph.facebook.com/v23.0/${form}/leads?fields=id,created_time,field_data,ad_name,adset_name,campaign_name,platform&limit=100` +
      `&filtering=${encodeURIComponent(JSON.stringify([{ field: "time_created", operator: "GREATER_THAN", value: from }]))}&access_token=${encodeURIComponent(META_TOKEN)}`;
    while (url) {
      let page;
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
        page = await r.json();
        if (!r.ok) { console.error("Leadgen xato", form, JSON.stringify(page).slice(0, 300)); break; }
      } catch (e) { console.error("Leadgen so‘rov", e.message); break; }
      for (const fl of page.data || []) await handleInstantLead(fl, form);
      url = page.paging && page.paging.next;
    }
  }
}

async function handleInstantLead(fl, form) {
  if (seenLeads.has(fl.id)) return;
  if (await amoHasFbLead(fl.id)) { seenLeads.add(fl.id); return; }
  const f = {};
  (fl.field_data || []).forEach((x) => { f[x.name] = (x.values || []).join(", "); });
  const lead = {
    name: str(f.full_name || [f.first_name, f.last_name].filter(Boolean).join(" ") || "—", 80),
    company: str(f.company_name || f.company || "—", 120),
    phone: str(f.phone_number || f.phone || "", 30),
    direction: str(f.yonalish, 80), package: str(f.paket, 30), comment: "",
    source: "instant_form", page: `Meta instant forma ${form} (${fl.platform || "fb/ig"})`, referrer: "",
    utm_source: "facebook", utm_medium: "instant_form",
    utm_campaign: str(fl.campaign_name, 120), utm_content: str(fl.ad_name, 120), utm_term: str(fl.adset_name, 120),
    submitted_at: new Date(fl.created_time || Date.now()).toISOString(), ip: "", fb_lead_id: fl.id
  };
  appendCsv(lead);
  lead.amo_id = await sendAmo(lead);
  if (!lead.amo_id && AMO_TOKEN) return; // amoCRM ishlamasa keyingi aylanishda qayta urinamiz
  seenLeads.add(fl.id);
  if (BOT_TOKEN && CHAT_ID) await sendTelegram(formatTelegram(lead));
}

async function amoHasFbLead(id) {
  if (!AMO_URL || !AMO_TOKEN) return false;
  try {
    const r = await fetch(`${AMO_URL}/api/v4/leads?query=${encodeURIComponent(`fb_lead:${id}`)}&limit=1`, {
      headers: { Authorization: `Bearer ${AMO_TOKEN}` }, signal: AbortSignal.timeout(8000)
    });
    if (r.status === 204) return false;
    const d = await r.json();
    return ((d._embedded && d._embedded.leads) || []).length > 0;
  } catch (e) { console.error("amoCRM qidiruv", e.message); return true; } // shubhada takrorlamaymiz
}

if (META_TOKEN && LEADGEN_FORMS.length) {
  const loop = () => pollLeadgen().catch((e) => console.error("Leadgen", e.message)).finally(() => setTimeout(loop, LEADGEN_POLL_MS));
  setTimeout(loop, 5000);
}

/* ---------- amoCRM: "forum hamkorlar" voronkasiga bitim + kontakt + kompaniya ---------- */
async function sendAmo(l) {
  if (!AMO_URL || !AMO_TOKEN) return null;
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${AMO_TOKEN}` };
  const track = [["UTM_SOURCE", l.utm_source], ["UTM_MEDIUM", l.utm_medium], ["UTM_CAMPAIGN", l.utm_campaign],
    ["UTM_CONTENT", l.utm_content], ["UTM_TERM", l.utm_term], ["REFERRER", l.referrer], ["FBCLID", l.fbclid],
    ["UTM_REFERRER", l.fb_lead_id ? `fb_lead:${l.fb_lead_id}` : ""]]
    .filter(([, v]) => v).map(([code, v]) => ({ field_code: code, values: [{ value: v }] }));
  const origin = l.source === "instant_form" ? "meta-forma" : "forum-sayt";
  const tags = [origin, l.package, l.utm_source || "organik", !["form", "instant_form"].includes(l.source) ? l.source : null].filter(Boolean).map((name) => ({ name }));
  const body = [{
    name: `Forum hamkor: ${l.company}`,
    pipeline_id: AMO_PIPELINE, status_id: AMO_STATUS,
    custom_fields_values: track.length ? track : undefined,
    _embedded: {
      tags,
      contacts: [{ first_name: l.name, custom_fields_values: [{ field_code: "PHONE", values: [{ value: "+" + l.phone.replace(/\D/g, ""), enum_code: "WORK" }] }] }],
      companies: [{ name: l.company }]
    }
  }];
  try {
    const r = await fetch(`${AMO_URL}/api/v4/leads/complex`, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(6000) });
    if (!r.ok) { console.error("amoCRM xato", r.status, (await r.text()).slice(0, 400)); return null; }
    const id = (await r.json())[0]?.id;
    if (!id) return null;
    const text = [`Saytdan ariza (Forum 2026, biznes hamkorlar)`, `Yo‘nalish: ${l.direction}`, `Paket: ${l.package}`,
      l.comment ? `Izoh: ${l.comment}` : null, `Sahifa: ${l.page || "—"}`].filter(Boolean).join("\n");
    await fetch(`${AMO_URL}/api/v4/leads/${id}/notes`, {
      method: "POST", headers, body: JSON.stringify([{ note_type: "common", params: { text } }]), signal: AbortSignal.timeout(6000)
    }).catch((e) => console.error("amoCRM eslatma", e.message));
    return id;
  } catch (e) { console.error("amoCRM yuborilmadi", e.message); return null; }
}

/* ---------- Meta Conversions API: Lead ---------- */
async function sendCapi(l, m) {
  if (!PIXEL_ID || !CAPI_TOKEN || !m.event_id) return;
  const sha = (s) => require("crypto").createHash("sha256").update(String(s).trim().toLowerCase()).digest("hex");
  const parts = l.name.toLowerCase().replace(/[^\p{L}\s]/gu, "").split(/\s+/).filter(Boolean);
  const user_data = {
    ph: [sha(l.phone.replace(/\D/g, ""))],
    country: [sha("uz")],
    client_ip_address: l.ip || undefined,
    client_user_agent: m.ua || undefined
  };
  if (parts[0]) user_data.fn = [sha(parts[0])];
  if (parts[1]) user_data.ln = [sha(parts[parts.length - 1])];
  if (m.external_id) user_data.external_id = [sha(m.external_id)];
  if (m.fbp) user_data.fbp = m.fbp;
  if (m.fbc) user_data.fbc = m.fbc;
  const body = {
    data: [{
      event_name: "Lead", event_time: Math.floor(Date.now() / 1000), event_id: m.event_id,
      action_source: "website", event_source_url: l.page || undefined, user_data,
      custom_data: { content_name: l.package, content_category: l.direction }
    }]
  };
  if (CAPI_TEST_CODE) body.test_event_code = CAPI_TEST_CODE;
  try {
    const r = await fetch(`https://graph.facebook.com/v23.0/${PIXEL_ID}/events?access_token=${encodeURIComponent(CAPI_TOKEN)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(3000)
    });
    if (!r.ok) console.error("CAPI xato", r.status, (await r.text()).slice(0, 300));
  } catch (e) { console.error("CAPI yuborilmadi", e.message); }
}

function formatTelegram(l) {
  const esc = (s) => String(s || "—").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
  const src = { form: "Forma", pdf: "PDF taqdimot", direction: "Yo‘nalish kartasi", package_bronze: "Bronze tugmasi", package_silver: "Silver tugmasi", package_gold: "Gold tugmasi", instant_form: "Meta instant forma" }[l.source] || l.source;
  const utm = [l.utm_source, l.utm_medium, l.utm_campaign, l.utm_content, l.utm_term].filter(Boolean).join(" / ");
  return [
    `🟢 <b>Yangi B2B lid — Forum 2026</b>`,
    ``,
    `👤 <b>Ism:</b> ${esc(l.name)}`,
    `🏢 <b>Kompaniya:</b> ${esc(l.company)}`,
    `📞 <b>Telefon:</b> <a href="tel:${l.phone.replace(/\s/g, "")}">${esc(l.phone)}</a>`,
    `🎯 <b>Yo‘nalish:</b> ${esc(l.direction)}`,
    `📦 <b>Paket:</b> ${esc(l.package)}`,
    l.comment ? `💬 <b>Izoh:</b> ${esc(l.comment)}` : null,
    ``,
    `🔗 Manba: ${esc(src)}${utm ? ` · UTM: ${esc(utm)}` : ""}`,
    l.amo_id ? `📋 <a href="${AMO_URL}/leads/detail/${l.amo_id}">amoCRM bitimi</a>` : (AMO_TOKEN ? `⚠️ amoCRM ga tushmadi` : null),
    `🕒 ${l.submitted_at.replace("T", " ").slice(0, 16)} UTC`
  ].filter((x) => x !== null).join("\n");
}

async function sendTelegram(text) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: "HTML", disable_web_page_preview: true })
    });
    return r.ok;
  } catch (e) { console.error(e.message); return false; }
}

function appendCsv(l) {
  const cols = ["submitted_at", "name", "company", "phone", "direction", "package", "comment", "source", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "page", "referrer", "ip"];
  const q = (v) => `"${String(v || "").replace(/"/g, '""')}"`;
  if (!fs.existsSync(LEADS_CSV)) fs.writeFileSync(LEADS_CSV, "﻿" + cols.join(";") + "\n");
  fs.appendFileSync(LEADS_CSV, cols.map((c) => q(l[c])).join(";") + "\n");
}

function serveStatic(req, res) {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT) || file.includes(`${path.sep}server${path.sep}`)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("Not found"); }
    const ext = path.extname(file).toLowerCase();
    const headers = { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=86400" };
    // Video uchun Range so‘rovlari (iOS Safari talab qiladi)
    const range = req.headers.range;
    if (range && (ext === ".mp4" || ext === ".webm")) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      const start = m && m[1] ? Number(m[1]) : 0;
      const end = m && m[2] ? Number(m[2]) : st.size - 1;
      res.writeHead(206, Object.assign(headers, { "Content-Range": `bytes ${start}-${end}/${st.size}`, "Accept-Ranges": "bytes", "Content-Length": end - start + 1 }));
      if (req.method === "HEAD") return res.end();
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, Object.assign(headers, { "Content-Length": st.size, "Accept-Ranges": "bytes" }));
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

/* ---------- helpers ---------- */
function allow(ip) {
  const now = Date.now(), win = 10 * 60 * 1000, max = 8;
  const arr = (rate.get(ip) || []).filter((t) => now - t < win);
  if (arr.length >= max) return false;
  arr.push(now); rate.set(ip, arr); return true;
}
function readJson(req, limit) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > limit) { req.destroy(); resolve(null); } });
    req.on("end", () => { try { resolve(JSON.parse(data || "{}")); } catch { resolve(null); } });
    req.on("error", () => resolve(null));
  });
}
function str(v, max) { return String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max); }
function json(res, code, obj) { res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" }); res.end(JSON.stringify(obj)); }
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  fs.readFileSync(file, "utf8").split("\n").forEach((line) => {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  });
}
