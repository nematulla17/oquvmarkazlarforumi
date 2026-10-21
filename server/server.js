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
}).listen(PORT, () => console.log(`Sayt: http://localhost:${PORT}  (lead -> ${BOT_TOKEN ? "Telegram + CSV" : "faqat CSV, TELEGRAM_BOT_TOKEN yo‘q"})`));

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
    utm_campaign: str(body.utm_campaign, 80), utm_content: str(body.utm_content, 80),
    submitted_at: new Date().toISOString(), ip
  };
  const digits = lead.phone.replace(/\D/g, "");
  if (lead.name.length < 2 || lead.company.length < 2 || digits.length !== 12 || !lead.direction) {
    return json(res, 422, { ok: false, error: "validation" });
  }

  appendCsv(lead);
  if (BOT_TOKEN && CHAT_ID) {
    const sent = await sendTelegram(formatTelegram(lead));
    if (!sent) console.error("Telegram yuborilmadi", lead.phone);
  }
  json(res, 200, { ok: true });
}

function formatTelegram(l) {
  const esc = (s) => String(s || "—").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
  const src = { form: "Forma", pdf: "PDF taqdimot", direction: "Yo‘nalish kartasi", package_bronze: "Bronze tugmasi", package_silver: "Silver tugmasi", package_gold: "Gold tugmasi" }[l.source] || l.source;
  const utm = [l.utm_source, l.utm_medium, l.utm_campaign, l.utm_content].filter(Boolean).join(" / ");
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
  const cols = ["submitted_at", "name", "company", "phone", "direction", "package", "comment", "source", "utm_source", "utm_medium", "utm_campaign", "utm_content", "page", "referrer", "ip"];
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
