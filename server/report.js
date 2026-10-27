/* =====================================================================
   Meta reklama hisobotlari Telegram botga (tashqi kutubxonasiz)
   - 09:00 (Toshkent) — kechagi to‘liq hisobot: sarf, lid, CPL, kampaniyalar, eng arzon/qimmat e'lonlar
   - 19:00 — bugungi oraliq hisobot
   - har 30 daqiqada: hisob to‘xtasa (to‘lov), e'lon rad etilsa — darhol ogohlantirish
   Maqsad: kuniga 100–120 lid, CPL $1–1.5. Yo‘q qilish: REPORTS=off
   ===================================================================== */
const fs = require("fs");
const path = require("path");

const ACT = "act_1338204998260984";
const TARGET = { leadsMin: 100, leadsMax: 120, cplMax: 1.5 };
const STATE_FILE = path.join(__dirname, ".report_state.json");
const ACCOUNT_STATUS = { 1: "faol", 2: "o‘chirilgan", 3: "to‘lov qilinmagan", 7: "tekshiruvda", 9: "grace period", 101: "yopilgan" };

// Render deploy'da fayl yo‘qoladi: holat yo‘q bo‘lsa, birinchi aylanish jim (takror hisobot/ogohlantirish yubormaydi)
let state = null;
try { state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); } catch {}
const seeding = !state;
state = state || {};
const save = () => { try { fs.writeFileSync(STATE_FILE, JSON.stringify(state)); } catch {} };

function start({ token, chatId, botToken }) {
  if (process.env.REPORTS === "off" || !token || !chatId || !botToken) return false;
  const send = (text) => fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
    signal: AbortSignal.timeout(15000)
  }).then((r) => r.ok || r.text().then((t) => console.error("report tg", t.slice(0, 200))));

  const graph = async (q) => {
    const sep = q.includes("?") ? "&" : "?";
    const r = await fetch(`https://graph.facebook.com/v23.0/${q}${sep}access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(20000) });
    const d = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(d).slice(0, 300));
    return d;
  };

  let first = seeding;
  const tick = async () => {
    const now = tashkent();
    try {
      if (first) {
        first = false;
        if (now.hour >= 9) state.daily = now.date;
        if (now.hour >= 19) state.evening = now.date;
        await alerts(graph); // joriy holatni eslab qoladi, xabar yubormaydi
        return save();
      }
      if (now.hour >= 9 && state.daily !== now.date) { await send(await report(graph, "yesterday")); state.daily = now.date; save(); }
      if (now.hour >= 19 && state.evening !== now.date) { await send(await report(graph, "today")); state.evening = now.date; save(); }
      for (const msg of await alerts(graph)) await send(msg);
    } catch (e) { console.error("report", e.message); }
  };
  setTimeout(tick, 60 * 1000);
  setInterval(tick, 30 * 60 * 1000).unref();
  return true;
}

function tashkent() {
  const d = new Date(Date.now() + 5 * 3600 * 1000);
  return { date: d.toISOString().slice(0, 10), hour: d.getUTCHours() };
}

const leadsOf = (r) => (r.actions || []).filter((a) => a.action_type === "lead").reduce((s, a) => s + Number(a.value), 0);
const usd = (n) => `$${n.toFixed(2)}`;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const mark = (cpl, leads) => (!leads ? "⚪" : cpl <= TARGET.cplMax ? "🟢" : cpl <= 2 ? "🟡" : "🔴");

async function report(graph, preset) {
  const [acc, camps, ads, budgets] = await Promise.all([
    graph(`${ACT}/insights?fields=spend,actions&date_preset=${preset}`),
    graph(`${ACT}/insights?level=campaign&fields=campaign_name,spend,actions&date_preset=${preset}&limit=100`),
    graph(`${ACT}/insights?level=ad&fields=ad_name,campaign_name,spend,actions&date_preset=${preset}&limit=300`),
    activeDailyBudget(graph)
  ]);
  const a = acc.data[0] || {};
  const spend = Number(a.spend || 0), leads = leadsOf(a), cpl = leads ? spend / leads : 0;
  const day = preset === "today" ? "Bugun (19:00 gacha)" : "Kecha";
  const date = (a.date_start || "").split("-").reverse().slice(0, 2).join(".");

  const L = [`📊 <b>${day}${date ? ` · ${date}` : ""}</b>`,
    `Sarf: <b>${usd(spend)}</b> · Lid: <b>${leads}</b> · CPL: <b>${leads ? usd(cpl) : "—"}</b> ${mark(cpl, leads)}`,
    `Maqsad: ${TARGET.leadsMin}–${TARGET.leadsMax} lid, CPL ≤ $${TARGET.cplMax}` +
      (preset === "yesterday" ? ` → ${leads >= TARGET.leadsMin ? "✅ lid soni bajarildi" : `lid ${TARGET.leadsMin - leads} ta kam`}` : ""),
    `Faol kunlik byudjet: ${usd(budgets)}`, "", "<b>Kampaniyalar</b>"];

  const rows = camps.data.map((r) => ({ n: r.campaign_name, s: Number(r.spend), l: leadsOf(r) })).filter((r) => r.s > 0.5).sort((x, y) => y.l - x.l || y.s - x.s);
  for (const r of rows) L.push(`${mark(r.l ? r.s / r.l : 0, r.l)} ${esc(r.n.slice(0, 42))} — ${r.l} lid, ${usd(r.s)}${r.l ? `, CPL ${usd(r.s / r.l)}` : ""}`);

  const adRows = ads.data.map((r) => ({ n: r.ad_name, c: r.campaign_name, s: Number(r.spend), l: leadsOf(r) })).filter((r) => r.s >= 3);
  const withCpl = adRows.filter((r) => r.l).map((r) => ({ ...r, cpl: r.s / r.l })).sort((x, y) => x.cpl - y.cpl);
  if (withCpl.length) {
    L.push("", "🏆 <b>Eng arzon e'lonlar</b>");
    for (const r of withCpl.slice(0, 3)) L.push(`• ${esc(r.n.slice(0, 40))} — CPL ${usd(r.cpl)} (${r.l} lid)`);
  }
  const bad = adRows.filter((r) => !r.l || r.s / r.l > 2).sort((x, y) => y.s - x.s).slice(0, 3);
  if (bad.length) {
    L.push("", "⚠️ <b>Qimmat e'lonlar</b>");
    for (const r of bad) L.push(`• ${esc(r.n.slice(0, 40))} — ${r.l ? `CPL ${usd(r.s / r.l)}` : `${usd(r.s)} sarf, lid yo‘q`}`);
  }
  return L.join("\n");
}

async function activeDailyBudget(graph) {
  const d = await graph(`${ACT}/campaigns?fields=effective_status,daily_budget,adsets.limit(50){effective_status,daily_budget}&limit=100`);
  let sum = 0;
  for (const c of d.data) {
    if (c.effective_status !== "ACTIVE") continue;
    if (c.daily_budget) { sum += Number(c.daily_budget); continue; }
    for (const s of c.adsets?.data || []) if (s.effective_status === "ACTIVE" && s.daily_budget) sum += Number(s.daily_budget);
  }
  return sum / 100;
}

async function alerts(graph) {
  const out = [];
  const acc = await graph(`${ACT}?fields=account_status,balance`);
  const st = acc.account_status;
  if (st !== state.accStatus) {
    if (st !== 1) out.push(`🚨 <b>Reklama hisobi to‘xtadi</b>: ${ACCOUNT_STATUS[st] || st}` +
      (st === 3 ? `\nQarz: ${usd(Number(acc.balance || 0) / 100)}. To‘lash: business.facebook.com/billing_hub` : ""));
    else if (state.accStatus) out.push("✅ Reklama hisobi qayta faol");
    state.accStatus = st; save();
  }
  const ads = await graph(`${ACT}/ads?fields=name,effective_status&filtering=${encodeURIComponent(JSON.stringify([{ field: "effective_status", operator: "IN", value: ["DISAPPROVED", "WITH_ISSUES"] }]))}&limit=100`);
  state.badAds = state.badAds || [];
  for (const ad of ads.data) {
    if (state.badAds.includes(ad.id)) continue;
    out.push(`❌ <b>E'lon rad etildi</b>: ${esc(ad.name)}\nSababini Ads Manager'da ko‘ring va Request review bosing.`);
    state.badAds.push(ad.id); save();
  }
  return out;
}

module.exports = { start, report };
