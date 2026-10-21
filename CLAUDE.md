# Loyiha konteksti — O‘zbekiston o‘quv markazlari forumi, B2B landing

Bu fayl loyiha tarixini va ish qoidalarini saqlaydi. Claude Code shu papkada ochilganda
avval shu faylni o‘qiydi. Yangi qaror qabul qilinsa, shu faylni yangilab bor.

## 1. Maqsad

Forumning **biznes hamkorlari (sponsorlar)** uchun lead generation sayti. Auditoriya: o‘quv
markazlariga xizmat ko‘rsatuvchi B2B kompaniyalar (EdTech, marketing, bank, sug‘urta, jihoz,
nashriyot, HR, startaplar va h.k.). Saytning vazifasi: ariza (lid) olib, uni forum sotuv
bo‘limiga Telegram orqali yetkazish. Oddiy ishtirokchilar (o‘quv markazlari) bu saytning
auditoriyasi emas.

Buyurtmachi: Nematulla (GitHub: nematulla17). Muloqot tili: o‘zbek (lotin).

## 2. Forum haqida faktlar (manba: "Biznes hamkorlar paketi 2026" taqdimoti, assets/docs/)

- Nomi: O‘zbekiston o‘quv markazlari forumi 2026. Tashkilotchi: Yoshlar ishlari agentligi.
- Joy: Yoshlar ijod saroyi, Toshkent. Aniq sana hali tasdiqlanmagan (dekabr 2026 deb yozilgan).
- Aloqa: +998 77 150 32 32, t.me/oquvmarkazlarforumi, rasmiy sayt markazlarforumi.uz
  (bulut sessiyasidan saytga kirib bo‘lmadi, mazmuni hali o‘rganilmagan).
- Raqamlar: forumda 800+ o‘quv markazi; Forum 2025 qamrovi: telekanallar 12 mln+, saytlar
  5 mln+, ijtimoiy tarmoqlar 700 ming+. O‘quv markazlari soni: 2024 — 9 097, 2025 — 10 385,
  2026 (1-oktabr) — 13 623 (+50%). Xodimlar: 66 245 / 80 307 / 72 345.
- "Ko‘mak" loyihasi: olis hududlarda yangi markaz ochish uchun ssuda (1-bosqich 140 mln,
  2-bosqich 300 mln so‘m), jami 78 mlrd 286 mln so‘m, 629 ariza, 612 tasi ko‘rib chiqilgan.
- Paketlar (narxlar taqdimotda yo‘q, menejer aytadi):
  - **Bronze** — 5 imkoniyat, 2 chipta: veb-sahifada logo, Telegram tanishtiruv posti,
    ishtirokchi paketida reklama materiali, top ekspert ma’ruzalari, 100 kishilik networking.
  - **Silver** — 10 imkoniyat, 4 chipta: Bronze + ko‘rgazmada stend, ijtimoiy tarmoqlarda
    logo va 3 post, maxsus taklif e’loni, Business Dinner, VIP oqim.
  - **Gold** — 16 imkoniyat, 6 chipta: Silver + asosiy sahnada 5–7 daqiqa taqdimot,
    sahna/bannerlarda yirik logo, blogerlar va OAV, investor va CEO uchrashuvlari,
    Harvard darsi va AI workshop, 1 yillik hamkorlik.
- Yo‘nalish → tavsiya paket jadvali va startaplar bo‘limi (Akmal Paiziev sessiyasi) saytda bor.

## 3. Brend

- Ranglar (logodan olingan): qora #000000, lime **#A7F000**; sayt uchun to‘q yashil #0B3A1A,
  yashil #1D9A33, Bronze #B9783F, Silver #8A9099, Gold #C9981B. Tokenlar css/style.css `:root` da.
- Shrift: Montserrat (Google Fonts).
- Logo: assets/img/logo-original.jpg (rasmiy), logo-emblem.png (shaffof fonli emblema,
  sarlavha va footerda matn HTML orqali oq rangda yoziladi), favicon.png.

## 4. Texnik tuzilma

```
index.html         bitta sahifali landing, o‘zbek tilida, mobil-first
css/style.css      vanilla CSS, breakpointlar 640 / 1024 / 1280
js/main.js         video, menyu, forma, +998 maskasi, UTM, analitika hook, fallback
server/server.js   Node 18+, tashqi kutubxonasiz: statik sayt + POST /api/lead
                   → Telegram guruh (HTML format) + server/leads.csv
server/.env        TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (gitga kirmaydi)
railway.json       Railway deploy: node server/server.js, healthcheck /
assets/video/      hero.mp4 / hero.webm — hali qo‘shilmagan, poster ko‘rinadi
assets/docs/       Biznes_hamkorlar_paketi_2026.pdf — lead magnet
docs/screenshots/  desktop va mobil skrinshotlar
```

Sahifa bo‘limlari: hero (video) → stats → nega shu auditoriya (chart) → Ko‘mak →
B2B yo‘nalishlar (kartani bossa forma to‘ladi) → paketlar + taqqoslash jadvali →
hamkorlik yo‘li (4 bosqich) → startaplar → 4 qadam → ariza formasi → FAQ → final CTA → footer.
Mobilda sticky CTA panel. Forma maydonlari: ism, kompaniya, telefon, yo‘nalish, paket
(Bronze/Silver/Gold/Maslahat kerak), izoh; yashirin: source, page, utm_*.

Forma yuborish: `POST /api/lead` (yoki `window.LEAD_ENDPOINT`). Server bo‘lmasa (statik
hosting, Claude artifact) modal ochilib, ariza tayyor matn bilan
t.me/oquvmarkazlarforumi ga yo‘naltiriladi.

## 5. Qayerda nima turibdi

- GitHub: https://github.com/nematulla17/oquvmarkazlarforumi (public, branch `main`).
- Claude artifact (statik preview): https://claude.ai/artifact/98PcomhnkonQ8PFgsdERqz
- Railway: hali ulanmagan. Reja: Railway → New Project → Deploy from GitHub repo →
  Variables: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID → Generate Domain. Ulangach `main` ga
  har push avtomatik deploy bo‘ladi.
- Lokal: Desktop/projectai/yangi oquvmarkazlarforumi (git clone qilinadi).
- Meta reklama: kabinet `1338204998260984` ("forum 2026", Asia/Tashkent, USD, 2026-10-21 gacha
  $457.72 sarflangan), sahifa `1339727935893840` ("Oquv markazlar forumi"), IG `17841477739867635`
  (kabinetga ulanmagan — 2026-10-21 holati). Pixel/dataset yo‘q. Lead Ads ToS qabul qilinmagan.
  Kampaniyalar faqat PAUSED holatda yaratiladi, yoqish — Nematulla tasdiqlagandan keyin.

## 6. Qilinmagan / kutilayotgan ishlar

1. Railway'ga deploy (yuqoridagi reja).
2. Telegram guruh chat ID ni aniqlash: botni guruhga qo‘shib, xabar yozib,
   `https://api.telegram.org/bot<TOKEN>/getUpdates` dan `chat.id` olinadi; `.env` ga yoziladi.
3. Hero videoni assets/video/hero.mp4 sifatida qo‘shish (1920×1080, ovozsiz, ≤5 MB).
4. assets/img/og-cover.png (1200×630) — ijtimoiy tarmoq preview.
5. Forum aniq sanasi tasdiqlangach FAQ dagi matnni yangilash.
6. markazlarforumi.uz saytini o‘rganib, kerakli faktlarni qo‘shish.
7. Keyingi bosqich: Meta/Instagram target uchun kreativlar, UTM bilan kampaniya rejasi,
   lidlar uchun CRM/Google Sheets integratsiyasi.

## 7. Ish qoidalari

- Har o‘zgarishdan keyin: lokal `node server/server.js` → Playwright/brauzerda 390px va
  1440px da tekshirish → commit → `git push origin main`. Railway ulangach deploy avtomatik.
- Claude artifact ssilkasini ham yangilash kerak bo‘lsa, o‘sha URL ga qayta publish qilinadi.
- Tokenlar va sirlar faqat `server/.env` da, hech qachon commit qilinmaydi va chatga
  yozilmaydi. Chatda bir marta ochiq yuborilgan bot tokeni va Railway tokenini deploy
  tugagach yangilash (BotFather `/revoke`, railway.app/account/tokens).
- Taqdimotdagi raqamlar o‘zgartirilmaydi; yangi raqam faqat tasdiqlangan manbadan.
- Narx yozilmaydi (taqdimotda yo‘q), "menejer tijorat taklifini yuboradi" formulasi.
- Dizayn: forum ranglari, gradient va bezaklarsiz, lime faqat CTA va aksent uchun.
- Uslub (2026-10-21 qayta ishlangan): tadbir afishasi / bosma katalog. O‘tkir burchaklar (2px),
  ingichka chiziqlar, soya, emoji, pill-yorliq, sanab chiquvchi raqam va scroll-animatsiyasiz.
  Bo‘lim yorlig‘i `.label` (ustida chiziq), desktopda `.split` (chapda sarlavha, o‘ngda kontent).
  Tasdiqlanmagan belgilar ("Eng ko‘p tanlanadi") qo‘yilmaydi.
- UI matnlari o‘zbek lotin, apostrof uchun ‘ (U+2018) belgisi ishlatilgan.
