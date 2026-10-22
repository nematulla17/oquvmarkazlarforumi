/* =====================================================================
   CAPI for CRM (Conversion Leads) — amoCRM bosqich o‘zgarishlari → Meta
   "forum hamkorlar" (11406294) voronkasidagi bitim bosqichi o‘zgarsa, shu hodisa Meta pixeliga
   action_source "system_generated" bilan yuboriladi — reklama lid SIFATIGA qarab optimallashadi.
   - Manba: amoCRM /api/v4/events (lead_status_changed), keyin bitimlar (with=contacts) va kontaktlar.
   - lead_id: bitim nomi "Facebook №<id>" (amoCRM native integratsiyasi) yoki UTM_REFERRER "fb_lead:<id>".
     Ikkalasi ham yo‘q bo‘lsa (sayt lidlari) — faqat xeshlangan telefon bilan; telefon ham yo‘q bo‘lsa o‘tkaziladi.
   - event_id = crm-<bitim>-<bosqich> → qayta yuborish Meta tomonida dedup bo‘ladi (restartda ham xavfsiz).
   - Xato faqat logga yoziladi, serverni yiqitmaydi.
   CLI (hech narsa yubormaydi):  node server/crm_capi.js --dry-run [--hours N]
   Haqiqiy yuborish (qo‘lda):     node server/crm_capi.js --send [--hours N]
   ===================================================================== */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PIPELINE = 11406294; // "forum hamkorlar"
// amoCRM bosqichi → Meta event_name (bitta joyda)
const STAGE_EVENTS = {
  89356402: "Lead",            // YANGI LID (faqat lead_id ma'lum bo‘lsa — sayt lidlari Lead ni allaqachon yuborgan)
  89356518: "Not_reached",     // KO`TARMADI
  89412314: "Callback",        // QAYA ALOQA
  89356406: "Qualified",       // mA`LUMOT BERILDI
  89356410: "Payment_pending", // TO`LOV KUTILYAPTI
  142: "Paid",                 // TO`LANDI
  143: "Disqualified"          // rad etdi
};
const MAX_AGE_SEC = 7 * 24 * 3600 - 15 * 60; // Meta 7 kundan eski hodisani qabul qilmaydi (15 daqiqa zaxira)

const env = () => ({
  amoUrl: (process.env.AMOCRM_BASE_URL || "").replace(/\/+$/, ""),
  amoToken: process.env.AMOCRM_TOKEN || "",
  pixel: process.env.META_PIXEL_ID || "",
  capiToken: process.env.META_CAPI_TOKEN || "",
  testCode: process.env.META_TEST_EVENT_CODE || ""
});

const sha = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");

async function amoGet(p) {
  const { amoUrl, amoToken } = env();
  const url = p.startsWith("http") ? p : `${amoUrl}${p}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${amoToken}` }, signal: AbortSignal.timeout(10000) });
  if (r.status === 204) return {};
  if (!r.ok) throw new Error(`amoCRM GET ${url.replace(amoUrl, "").split("?")[0]} ${r.status}`);
  return r.json();
}

// lead_status_changed hodisalari (faqat PIPELINE), har bitim+bosqich uchun eng oxirgi vaqt
async function fetchStatusChanges(fromTs) {
  const out = new Map(); // `${deal}-${status}` -> {dealId, statusId, time}
  let page = 1, url = `/api/v4/events?filter[type]=lead_status_changed&filter[entity]=lead&filter[created_at][from]=${fromTs}&limit=100&page=1`;
  while (url && page <= 200) {
    const d = await amoGet(url);
    for (const ev of (d._embedded || {}).events || []) {
      const st = (((ev.value_after || [])[0] || {}).lead_status) || {};
      if (Number(st.pipeline_id) !== PIPELINE || !STAGE_EVENTS[st.id]) continue;
      const key = `${ev.entity_id}-${st.id}`;
      const prev = out.get(key);
      if (!prev || ev.created_at > prev.time) out.set(key, { dealId: ev.entity_id, statusId: st.id, time: ev.created_at });
    }
    const next = d._links && d._links.next && d._links.next.href;
    page++;
    url = next || null;
  }
  return [...out.values()];
}

async function fetchByIds(entity, ids, extra = "") {
  const res = new Map();
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const q = chunk.map((id) => `filter[id][]=${id}`).join("&");
    const d = await amoGet(`/api/v4/${entity}?${q}&limit=250${extra}`);
    for (const x of (d._embedded || {})[entity] || []) res.set(x.id, x);
  }
  return res;
}

function fbLeadId(deal) {
  const m = /Facebook\s*№\s*(\d{6,})/i.exec(deal.name || "");
  if (m) return m[1];
  for (const f of deal.custom_fields_values || []) {
    if (f.field_code !== "UTM_REFERRER") continue;
    for (const v of f.values || []) { const r = /^fb_lead:(\d{6,})$/.exec(String(v.value)); if (r) return r[1]; }
  }
  return null;
}

function normPhone(v) {
  let d = String(v || "").replace(/\D/g, "");
  if (d.length === 9) d = "998" + d;
  if (d.length < 11 || d.length > 15) return null;
  const k = d.slice(-9);
  if (/^(\d)\1{8}$/.test(k) || k === "123456789" || k === "987654321") return null; // soxta raqam
  return d;
}

// Yuboriladigan hodisalar va statistika (hech narsa yubormaydi)
async function buildEvents(fromTs) {
  const stats = { changes: 0, events: 0, byEvent: {}, withLeadId: 0, phoneOnly: 0, skippedNoId: 0, skippedOld: 0, skippedLeadNoId: 0, missingDeal: 0 };
  const changes = await fetchStatusChanges(fromTs);
  stats.changes = changes.length;
  if (!changes.length) return { events: [], stats };
  const deals = await fetchByIds("leads", [...new Set(changes.map((c) => c.dealId))], "&with=contacts");
  const contactIds = new Set();
  const mainContact = new Map();
  for (const deal of deals.values()) {
    const cs = (deal._embedded || {}).contacts || [];
    const c = cs.find((x) => x.is_main) || cs[0];
    if (c) { mainContact.set(deal.id, c.id); contactIds.add(c.id); }
  }
  const contacts = contactIds.size ? await fetchByIds("contacts", [...contactIds]) : new Map();
  const minTime = Math.floor(Date.now() / 1000) - MAX_AGE_SEC;
  const events = [];
  for (const ch of changes.sort((a, b) => a.time - b.time)) {
    if (ch.time < minTime) { stats.skippedOld++; continue; }
    const deal = deals.get(ch.dealId);
    if (!deal) { stats.missingDeal++; continue; } // o‘chirilgan bitim
    const leadId = fbLeadId(deal);
    const ct = contacts.get(mainContact.get(deal.id));
    const phones = [...new Set(((ct && ct.custom_fields_values) || []).filter((f) => f.field_code === "PHONE")
      .flatMap((f) => (f.values || []).map((v) => normPhone(v.value))).filter(Boolean))].slice(0, 3);
    if (!leadId && !phones.length) { stats.skippedNoId++; continue; }
    const name = STAGE_EVENTS[ch.statusId];
    if (name === "Lead" && !leadId) { stats.skippedLeadNoId++; continue; }
    // dublikat sifatida yopilgan bitim — odam rad etmagan, Meta'ga "Disqualified" yuborilmaydi
    if (name === "Disqualified" && (((deal._embedded || {}).tags) || []).some((t) => t.name === "dublikat")) { stats.skippedDup = (stats.skippedDup || 0) + 1; continue; }
    const user_data = {};
    if (leadId) user_data.lead_id = leadId; // JSON da son bo‘lib chiqadi (toJson)
    if (phones.length) user_data.ph = phones.map(sha);
    const custom_data = { lead_event_source: "amoCRM", event_source: "crm" };
    if (name === "Paid" && Number(deal.price) > 0) { custom_data.value = Number(deal.price); custom_data.currency = "UZS"; }
    events.push({ event_name: name, event_time: ch.time, action_source: "system_generated", event_id: `crm-${deal.id}-${ch.statusId}`, user_data, custom_data });
    stats.events++;
    stats.byEvent[name] = (stats.byEvent[name] || 0) + 1;
    if (leadId) stats.withLeadId++; else stats.phoneOnly++;
  }
  return { events, stats };
}

// lead_id 16+ raqamli bo‘lishi mumkin — JS Number aniqligini yo‘qotmaslik uchun matndan songa aylantiriladi
function toJson(body) { return JSON.stringify(body).replace(/"lead_id":"(\d+)"/g, '"lead_id":$1'); }

// true — hammasi yuborildi
async function sendEvents(events, sent) {
  const { pixel, capiToken, testCode } = env();
  let ok = true, count = 0;
  const todo = events.filter((e) => !sent.has(e.event_id));
  for (let i = 0; i < todo.length; i += 1000) {
    const batch = todo.slice(i, i + 1000);
    const body = { data: batch };
    if (testCode) body.test_event_code = testCode;
    try {
      const r = await fetch(`https://graph.facebook.com/v23.0/${pixel}/events?access_token=${encodeURIComponent(capiToken)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: toJson(body), signal: AbortSignal.timeout(5000)
      });
      if (!r.ok) { ok = false; console.error("CRM CAPI xato", r.status, (await r.text()).slice(0, 500)); continue; }
      batch.forEach((e) => sent.add(e.event_id));
      count += batch.length;
    } catch (e) { ok = false; console.error("CRM CAPI yuborilmadi", e.message); }
  }
  return { ok, count };
}

/* ---------- server ichidagi poller ---------- */
let started = false;
function startCrmCapi() {
  const { pixel, capiToken, amoToken, amoUrl } = env();
  if (started || !pixel || !capiToken || !amoToken || !amoUrl || process.env.CRM_CAPI === "off") return false;
  started = true;
  const pollMs = Math.max(60, Number(process.env.CRM_CAPI_POLL_SEC || 300)) * 1000;
  const backfillH = Math.min(168, Number(process.env.CRM_CAPI_BACKFILL_HOURS || 168));
  const sent = new Set();
  let since = Math.floor(Date.now() / 1000) - backfillH * 3600;
  const run = async () => {
    const now = Math.floor(Date.now() / 1000);
    const from = Math.max(since, now - MAX_AGE_SEC);
    const { events, stats } = await buildEvents(from);
    const { ok, count } = await sendEvents(events, sent);
    if (count) console.log(`CRM CAPI: ${count} ta hodisa yuborildi`, JSON.stringify(stats.byEvent));
    if (ok) since = now - 3600; // keyingi aylanishda 1 soatlik ustma-ust oyna; xato bo‘lsa oyna saqlanadi
  };
  const loop = () => run().catch((e) => console.error("CRM CAPI", e.message)).finally(() => setTimeout(loop, pollMs));
  setTimeout(loop, 20000);
  return true;
}

/* ---------- CLI ---------- */
async function cli() {
  loadEnv(path.join(__dirname, ".env"));
  const args = process.argv.slice(2);
  const hi = args.indexOf("--hours");
  const hours = Math.min(168, hi >= 0 ? Number(args[hi + 1]) || 168 : 168);
  const send = args.includes("--send") && !args.includes("--dry-run");
  const { amoToken, amoUrl, pixel, capiToken } = env();
  if (!amoToken || !amoUrl) { console.error("AMOCRM_BASE_URL / AMOCRM_TOKEN yo‘q"); process.exit(1); }
  const from = Math.floor(Date.now() / 1000) - hours * 3600;
  const { events, stats } = await buildEvents(from);
  console.log(`Davr: oxirgi ${hours} soat (${new Date(from * 1000).toISOString()} dan)`);
  console.log(`Bosqich o‘zgarishlari (voronka ${PIPELINE}, xaritadagi bosqichlar): ${stats.changes}`);
  console.log(`Yuboriladigan hodisalar: ${stats.events}  (lead_id bilan: ${stats.withLeadId}, faqat telefon: ${stats.phoneOnly})`);
  console.log("event_name bo‘yicha:", JSON.stringify(stats.byEvent));
  console.log(`O‘tkazildi: lead_id/telefon yo‘q ${stats.skippedNoId}, "Lead" lead_id siz ${stats.skippedLeadNoId}, 7 kundan eski ${stats.skippedOld}, bitim topilmadi ${stats.missingDeal}`);
  const samples = [events.find((e) => e.user_data.lead_id), events.find((e) => !e.user_data.lead_id), events.find((e) => e.event_name === "Paid")]
    .filter(Boolean).concat(events).filter((e, i, a) => a.indexOf(e) === i).slice(0, 3);
  for (const e of samples) {
    const ud = Object.assign({}, e.user_data, e.user_data.ph ? { ph: e.user_data.ph.map((h) => h.slice(0, 10) + "…") } : {});
    console.log(toJson(Object.assign({}, e, { user_data: ud })));
  }
  if (!send) { console.log("--dry-run: hech narsa yuborilmadi"); return; }
  if (!pixel || !capiToken) { console.error("META_PIXEL_ID / META_CAPI_TOKEN yo‘q"); process.exit(1); }
  const r = await sendEvents(events, new Set());
  console.log(`Yuborildi: ${r.count}${r.ok ? "" : " (xatolar bor, logga qarang)"}`);
}

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  fs.readFileSync(file, "utf8").split("\n").forEach((line) => {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  });
}

module.exports = { startCrmCapi, buildEvents, STAGE_EVENTS };
if (require.main === module) cli().catch((e) => { console.error("CRM CAPI", e.message); process.exit(1); });
