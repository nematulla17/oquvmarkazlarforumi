# O‘zbekiston o‘quv markazlari forumi — Biznes hamkorlar landing

B2B hamkorlar (sponsorlar) uchun lead generation sayti. Maqsad: o‘quv markazlariga xizmat
ko‘rsatuvchi kompaniyalardan ariza olib, sotuv bo‘limiga Telegram orqali lid yetkazish.

## Tuzilma

```
index.html            — bitta sahifali landing (mobil + desktop)
css/style.css         — forum ranglari (to‘q yashil #0B3A1A, yashil #1D9A33, lime #C6F23D)
js/main.js            — video, menyu, forma, telefon maskasi, UTM, analitika hook
assets/video/         — hero.mp4 / hero.webm ni shu yerga qo‘ying (README ichida yo‘riqnoma)
assets/img/           — logo-emblem.png, logo-original.jpg, favicon.png, hero-poster.svg
assets/docs/          — Biznes_hamkorlar_paketi_2026.pdf (lead magnet)
server/server.js      — Node server: statik sayt + POST /api/lead -> Telegram + leads.csv
server/.env.example   — bot token va chat id namunasi
```

## Ishga tushirish (lokal)

```
cp server/.env.example server/.env     # TELEGRAM_BOT_TOKEN va TELEGRAM_CHAT_ID ni kiriting
node server/server.js                  # http://localhost:3000
```

Node 18+ kerak, tashqi kutubxona yo‘q.

## Lidlar qayerga tushadi

1. `server/leads.csv` — har bir ariza qatori (Excel ochadi, `;` ajratuvchi).
2. Telegram guruh — `.env` to‘ldirilgan bo‘lsa, har lid shunday keladi:

```
🟢 Yangi B2B lid — Forum 2026
👤 Ism · 🏢 Kompaniya · 📞 Telefon · 🎯 Yo‘nalish · 📦 Paket · 💬 Izoh
🔗 Manba: Silver tugmasi · UTM: instagram / cpc / b2b_oct
```

Bot sozlash: @BotFather da bot yarating, tokenni oling, botni sotuv guruhiga qo‘shing,
guruh ID sini (masalan `-1001234567890`) `TELEGRAM_CHAT_ID` ga yozing.

Server ishlamay qolsa forma foydalanuvchini yo‘qotmaydi: xato xabari bilan birga
tayyor matnli Telegram havolasi va telefon raqami ko‘rsatiladi.

## Formadagi manbalar (source)

| source            | Qayerdan bosildi                          |
|-------------------|-------------------------------------------|
| form              | Oddiy forma                               |
| pdf               | "Paket taqdimotini yuklab olish" tugmasi  |
| direction         | "Kimlar uchun" bo‘limidagi yo‘nalish kartasi (paket avtomatik belgilanadi) |
| package_bronze/silver/gold | Paket kartasidagi tugma          |

UTM parametrlari (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`) URL dan
olinadi, sessiyada saqlanadi va lid bilan birga yuboriladi.

## Analitika

`js/main.js` ichidagi `track()` funksiyasi `gtag`, `fbq`, `ym` va `dataLayer` mavjud bo‘lsa
avtomatik ishlaydi. GA4 / Meta Pixel / Yandex Metrika kodini `index.html` `<head>` ga
qo‘shing. Asosiy hodisalar: `hero_cta`, `pkg_silver`, `dir_select`, `form_submit`,
`lead_success`, `pdf_download`.

## Statik hosting (Vercel, Netlify, oddiy hosting)

Sayt statik, `server/` siz ham ishlaydi. Bu holda `index.html` ichida
`<script>window.LEAD_ENDPOINT = "https://sizning-api.uz/lead";</script>` qo‘yib,
lidlarni qabul qiladigan manzilni ko‘rsating (yoki `server/server.js` ni alohida VPS da ishga tushiring).

## Almashtirish kerak bo‘lgan narsalar

- `assets/img/logo-emblem.png` — rasmiy emblema (shaffof fon), `logo-original.jpg` — to‘liq logo
- `assets/video/hero.mp4` — hero video
- `assets/img/og-cover.png` — ijtimoiy tarmoqlar uchun 1200×630 rasm
- FAQ dagi forum sanasi — aniq sana tasdiqlangach

## Railway'ga chiqarish

1. https://railway.app → New Project → Deploy from GitHub repo → `nematulla17/oquvmarkazlarforumi`.
2. Service → Variables: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (Railway `PORT` ni o‘zi beradi).
3. Settings → Networking → Generate Domain. Sayt va `/api/lead` bitta manzilda ishlaydi.

`railway.json` start buyrug‘i va healthcheck ni belgilaydi; `main` ga har push avtomatik deploy bo‘ladi.
