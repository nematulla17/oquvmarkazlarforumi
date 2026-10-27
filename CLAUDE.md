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
- Aloqa: +998 55 515 73 91, t.me/oquvmarkazlarforumi, rasmiy sayt markazlarforumi.uz
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
server/dashboard.js  sotuv + Meta Ads dashboard backendi: GET /dashboard, /api/dashboard?from&to,
                   /api/dashboard/video?id= (Basic auth, 5 daqiqalik xotira keshi, faqat GET so‘rovlar)
dashboard/         index.html, app.js, style.css — dashboard UI (to‘q tema, Chart.js cdnjs dan)
server/.env        TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, DASHBOARD_USER/PASSWORD, USD_UZS ... (gitga kirmaydi)
railway.json       Railway deploy: node server/server.js, healthcheck /
assets/video/      forum-lavhalar.mp4 — to‘liq 1:41 video, kesilmaydi (Nematulla talabi), 848px, ~8.8 MB.
                   Hero fonida ovozsiz (≥768px), #atmosfera bo‘limida ovozi bilan — bitta fayl
                   manba: Desktop/projectai/oquv markazlar forumi/2026-10-21 08.56.39.mp4 (849×478)
assets/docs/       Biznes_hamkorlar_paketi_2026.pdf — lead magnet
docs/screenshots/  desktop va mobil skrinshotlar
```

Sahifa bo‘limlari: hero (video fon) + stats → #atmosfera (forum lavhalari videosi) → nega shu auditoriya (chart) → Ko‘mak →
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
- Claude dashboard (surat, Dashboard turi): https://claude.ai/artifact/LzYagDzVQZ6GkCw4x4XWCG — 22.09–21.10.2026
  ma'lumoti /api/dashboard dan JSON fayl qilib yuklangan (ism/telefonsiz), videolar 360p nusxa. Yangilash:
  /api/dashboard ni qayta olib, datasets/* fayllarini almashtirish.
- Mac'dagi vaqtinchalik lid serveri 2026-10-21 da to‘xtatildi — lid poller endi Render'da ishlaydi.
- Railway: hali ulanmagan. Reja: Railway → New Project → Deploy from GitHub repo →
  Variables: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID → Generate Domain. Ulangach `main` ga
  har push avtomatik deploy bo‘ladi.
- Telegram lid xabarlari hozircha Nematullaning shaxsiy chatiga (TELEGRAM_CHAT_ID=768318899) — sotuv guruhi
  qo‘shilgach guruh ID siga almashtiriladi.
- Render (bepul, 2026-10-21 dan asosiy hosting): https://oquvmarkazlarforumi.onrender.com, servis
  srv-dbca8fdg1s2s739id3hg (Frankfurt). DIQQAT: repo ochiq URL orqali ulangan (GitHub ilovasisiz), shuning uchun
  push'dan keyin auto deploy ishlamayapti — har push'dan keyin Render API bilan deploy qilinadi
  (POST /v1/services/<id>/deploys, kalit .env RENDER_API_KEY). Doimiy yechim: Render'da repo'ni GitHub
  akkaunti orqali qayta ulash. Barcha o'zgaruvchilar Render Environment'da
  (.env dan, Nematulla ruxsati bilan API orqali). Dashboard login forum / parol .env da. Uxlamasligi uchun
  .github/workflows/keepalive.yml har 10 daqiqada ping qiladi. Dashboard: /dashboard (Basic auth).
- Lokal: Desktop/projectai/yangi oquvmarkazlarforumi (git clone qilinadi).
- Meta reklama (BM "oquvmarkazlarforumi" `1311775053970451`, 2026-10-21 holati):
  kabinet `1338204998260984` "forum 2026" (Asia/Tashkent, USD, VISA *2692; status 9 = grace period,
  $27.26 to‘lanmagan qoldiq); sahifa `1339727935893840` "Oquv markazlar forumi" (Lead Ads ToS qabul
  qilingan); IG `17841477739867635` @oquvmarkazlarforumi — sahifa va kabinetga ulangan;
  pixel `1767288624497407` "Forum capi" — BM ga tegishli, kabinetga ulangan.
  Claude.ai Meta Ads MCP foydalanuvchi tokeni bilan ishlaydi va IG/ToS ni ko‘rmaydi; system user
  tokeni (server/.env → META_SYSTEM_USER_TOKEN: ads_management, business_management, pages_manage_ads,
  leads_retrieval) to‘g‘ri holatni ko‘rsatadi. Kampaniyalar faqat PAUSED yaratiladi, yoqish —
  Nematulla tasdiqlagandan keyin.
- Pixel saytda: index.html da PageView, arizada `Lead` (eventID). Server shu event_id bilan CAPI
  `Lead` yuboradi (ph, fn/ln, country, external_id, fbp/fbc, IP, UA — SHA-256). .env: META_PIXEL_ID,
  META_CAPI_TOKEN, META_TEST_EVENT_CODE (faqat Events Manager → Test events dagi haqiqiy kod;
  o‘ylab topilgan kod bilan hodisa oddiy hodisa bo‘lib yoziladi). 2026-10-21 tekshiruvda 2 ta
  test Lead pixelga tushgan (ism "Test Sinov").
- CAPI for CRM (server/crm_capi.js, 2026-10-22): har 5 daqiqada (CRM_CAPI_POLL_SEC) amoCRM `/api/v4/events`
  dan "forum hamkorlar" bosqich o‘zgarishlari olinib, pixelga `system_generated` hodisa yuboriladi:
  YANGI LID→Lead (faqat lead_id bo‘lsa), KO`TARMADI→Not_reached, QAYA ALOQA→Callback, mA`LUMOT BERILDI→Qualified,
  TO`LOV KUTILYAPTI→Payment_pending, TO`LANDI→Paid (value/UZS), rad etdi→Disqualified (xarita `STAGE_EVENTS`).
  user_data: lead_id ("Facebook №…" nomi yoki UTM_REFERRER fb_lead:…) + ph xeshi; event_id `crm-<bitim>-<bosqich>`.
  Birinchi aylanish 7 kun orqaga (CRM_CAPI_BACKFILL_HOURS), keyin 1 soatlik ustma-ust oyna. O‘chirish: CRM_CAPI=off.
  Tekshirish (yubormaydi): `node server/crm_capi.js --dry-run [--hours N]`.
- amoCRM: https://sanjarrmm.amocrm.ru, voronka "forum hamkorlar" `11406294`, bosqich "YANGI LID"
  `89356402` (.env: AMOCRM_BASE_URL, AMOCRM_TOKEN, ixtiyoriy AMOCRM_PIPELINE_ID/STATUS_ID). Har
  arizada /leads/complex: bitim "Forum hamkor: {kompaniya}" + kontakt (ism, telefon) + kompaniya,
  UTM_*/REFERRER/FBCLID maydonlari, teglar (forum-sayt, paket), eslatma (yo‘nalish, paket, izoh).
  Telegram xabarida bitim havolasi. 2026-10-21 test bitimlari `14903453`, `14903601` "rad etdi" da.
  Teglar: forum-sayt, paket, utm_source (yo‘q bo‘lsa "organik"). UTM sessionStorage da saqlanadi.
- Dublikat qoidasi (`markDuplicate`, sayt va instant forma lidlari uchun): bitim ochilgach/boyitilgach
  `/api/v4/contacts?query=<oxirgi 9 raqam>&with=leads` orqali shu telefonning "forum hamkorlar" dagi boshqa
  bitimlari qidiriladi (`dublikat` tegli va joriy bitim hisobga olinmaydi; 9 tadan kam yoki 111111111/123456789
  kabi soxta raqamlar tekshirilmaydi). Avvalroq ochilgan bitim (eng kichik created_at = asosiy) bo‘lsa: yangi
  bitimga `dublikat` tegi + "Takroriy murojaat. Asosiy bitim: …" eslatmasi, bosqichi Неразобранное/YANGI LID
  bo‘lsa "rad etdi" (143) ga o‘tadi; asosiy bitimga "Yana murojaat qildi: …, manba, kampaniya" eslatmasi;
  Telegramda "♻️ Takroriy murojaat" qatori. Hech narsa o‘chirilmaydi; amoCRM xatosi faqat logga yoziladi.
  2026-10-22 dan: asosiy bitim = eng ilgarilagan bosqichdagisi (gaplashilgani), teng bo‘lsa eng eskisi; avvalgi
  bitimlar hammasi "rad etdi" bo‘lsa yangi bitim yopilmaydi (qayta qiziqish), faqat eslatma. Native bitim nomida
  lid ID bo‘lmasa, shu telefonning ±1 soat ichida ochilgan boyitilmagan bitimi topilib boyitiladi (yangisi ochilmaydi).
- QOIDA (Nematulla, 2026-10-22): "YANGI LID" dagi eski lidlarga (17–19.10, 180 ta, ishlanmagan) TEGILMAYDI —
  ko‘chirilmaydi, yopilmaydi, birlashtirilmaydi.
- 2026-10-22: amoCRM "Facebook" integratsiyasidan (amoМаркет → Facebook → Форма Facebook) forum formalari
  (form 1, yangi12/10, hamkorlar uchun) UZILDI — Nematulla talabi. Endi BARCHA forma lidlarini faqat bizning
  server ochadi: Meta har 30 s so‘raladi (META_LEADGEN_POLL_SEC), kutish yo‘q (META_NATIVE_WAIT_MIN=0),
  lid ~30–60 s da CRM'da. Render uxlamasligi uchun server RENDER_EXTERNAL_URL ga har 5 daqiqada o‘zi ping
  qiladi (+ GitHub keepalive). Integratsiyaning o‘zi (Messenger va h.k.) o‘chirilmagan — akkauntni boshqa
  voronkalar ham ishlatadi.
- Instant forma javoblari: Meta variant KALITINI qaytaradi (v3 yonalish: d0 EdTech va IT, d1 Marketing va reklama,
  d2 Bank, to‘lov, lizing, d3 Jihoz, mebel, texnika, d4 Nashriyot, o‘quv qurollari, d5 Startap, d6 Boshqa) —
  server forma `questions{options}` dan matnga o‘giradi; yo‘nalish bitimga TEG bo‘lib ham yoziladi.
- Reklama qarori (Nematulla, 2026-10-21): $10/kun, butun O‘zbekiston, muddatsiz (to‘xtatguncha).
  `kreativlar/yangi/` ga video tushsa: Ads Manager'ga yuklash → kampaniya yaratish → DARHOL yoqish
  (alohida tasdiq shart emas), keyin hisobot. Fayl `kreativlar/yuklangan/` ga ko‘chiriladi.
  Sayt jonli bo‘lmaguncha kampaniya PAUSED turadi (havola ishlamaydi).
- Instant formalar (sahifa): "form 1 hamkorlar" `4447597638826376` (eski, 591 lid, maxfiylik havolasi
  buzuq), v2 `3318431208359646` (optimallashtirilgan: ism, telefon, kompaniya, yo‘nalish; RU_RU;
  maxfiylik markazlarforumi.uz/maxfiylik). Uzbek locale Meta'da yo‘q. Boshqa formalar: "hamkorlar uchun"
  `3182290488627819`, "yangi12/10/26" `985828477118225`, "Instant forma v1" `1413183077645812`.
- amoCRM'ning O‘ZINING Facebook integratsiyasi (source 11683) barcha forma lidlarini "forum hamkorlar"
  ga "Facebook №<lead_id>" nomi, `fb<form_id>` va `#forum` teglari bilan ochadi (UTM/javoblarsiz).
  Bizning server (META_LEADGEN_FORM_IDS = 6 ta forma) har 30 soniyada lidlarni olib, o‘sha native
  bitimni BOYITADI: UTM_SOURCE=facebook, MEDIUM=instant_form, CAMPAIGN/CONTENT/TERM = kampaniya/e'lon/
  guruh, UTM_REFERRER=fb_lead:<id> (takrorlanmaslik belgisi), teglar meta-forma+facebook+paket, javoblar
  eslatmasi; Telegram (faqat server ishga tushgandan keyingi lidlar). 15 daqiqada native bitim
  topilmasa — o‘zimiz ochamiz. Dublikat ochilmaydi (2026-10-21 da form 1 bo‘yicha 7 lid bilan sinaldi).
- Kampaniya `120255873473240150` "Forum 2026 | Hamkorlar | Instant forma" (CBO $10/kun), guruh
  `120255873601880150` (UZ, 25+, LEAD_GENERATION, ON_AD), video `2509950506160819` (spiker Sherzod
  Ibragimov). E'lon yaratilmagan (2026-10-21): system user ilovasi "Forum APP" `2096149907690629`
  dev_mode → kreativ yaratib bo‘lmaydi; Claude Meta Ads konnektorida forum sahifasiga
  pages_manage_ads yo‘q. Ibrat farzandlari bilan partnership uchun ularning IG ID + ruxsat kerak.
- 2026-10-21 holati (Ads Manager orqali, Chrome): barcha faol e'lonlar ("1", "ibrat bilan", "registon",
  "2", "Turin", "oquv markaz") forma v3 `2652969721821068` ga o‘tkazildi (yakuniy ekranda menejer raqami
  +998 55 515 73 91). Lead nurturing (Messenger + Instagram) yoqilgan, salomlashuv: "Arizangiz keldi…
  +998 55 515 73 91 raqamidan qo‘ng‘iroq qiladi…", FAQ: narx / sana-joy / paketlar (javoblari bilan).
  "3" kampaniyasi o‘chiq — tegilmagan. Spiker e'loni `120255874208880150` (kampaniya 120255873473240150)
  — Ibrat Farzandlari bilan PARTNERSHIP (sahifa 109583008861183, IG @ibrat.farzandlari, ruxsat bor).
  Kreativ/forma almashtirish faqat Ads Manager UI orqali (system user ilovasi dev_mode).
- QOIDA (Nematulla, 2026-10-22): `kreativlar/yangi/` ga tushgan HAR BIR yangi video — ALOHIDA YANGI KAMPANIYA:
  OUTCOME_LEADS, CBO $10/kun, guruh: UZ, 25+, Advantage+, LEAD_GENERATION (ON_AD, sahifa 1339727935893840),
  2026-10-24 DAN: Forum APP LIVE — hammasi API orqali, bitta buyruq:
  `python3 server/launch_video.py <video> "<Ism Familiya (Kompaniya)>"` (andoza kreativ 1579034130648261 — Temurbek e'loni;
  degrees_of_freedom_spec ichidan standard_enhancements olib tashlanadi, Meta rad etadi). Chrome endi shart emas.
  e'lon: forma v3 2652969721821068 + lead nurturing (raqam bilan salomlashuv, 3 ta FAQ), Ibrat Farzandlari
  bilan partnership, sponsorlarga qaratilgan matn; nom: "Forum 2026 | <video nomi>". Kampaniya va guruh
  Graph API (system user) orqali, e'lon Ads Manager'da mavjud spiker e'lonini Copy → yangi guruhga Paste
  qilib, videoni Replace media bilan almashtirib yaratiladi; keyin uchala daraja ACTIVE. Mavjud
  reklamalarga (matn, sana va h.k.) Nematulla aytmaguncha tegilmaydi.
- Temurbek Athamov (Najot Ta'lim, Robbit) videosi (2026-10-24): video `1110054788455077`, kampaniya `120255914094910150`
- Shoxrux Qudratov (Polyglot, Samarqand) videosi (2026-10-26): 17,4–23 s dagi Yoshlar ishlari agentligi logosi/taqdirlash kadri B-roll bilan almashtirildi; video `1675593534214267`, kampaniya `120255949022040150` ($10 CBO), guruh `120255949022270150`, e'lon `120255949024820150`, kreativ `1134177039556103`.
- Temurbek Athamov v2 (2026-10-27): asl e'lon "public figure/brand scam" deb rad etilgan (review kutilmoqda). Tahrir: kirish kartochkasi (ism + Najot Ta'lim/Robbit, ovoz bilan) kesildi, Najot stendi/IDP banneri/agentlik logoli panel B-roll bilan almashtirildi, sahna ekrani logosi xiralashtirildi. Video `1423291367526460`, kampaniya `120255975418930150`, guruh `120255975419210150`, e'lon `120255975423140150`.
  v2 foydalanuvchi so'rovi bilan PAUZA. O'rniga asl video qayta yuklandi: video `1689675619391210`, kampaniya `120255975454030150` "Spiker Temurbek Athamov (qayta)", e'lon `120255975462650150`.
- Aziz (Result School) videosi (2026-10-27): rasmiylar kadrlari (ko'rgazma guruhi, delegatsiya, sahnadagi rasmiy) olib tashlandi, "Yoshlar ishlari" suv belgisi xiralashtirildi. Video `2269108603663208`, kampaniya `120255975547410150`, e'lon `120255975557690150`. DIQQAT: forum suratlarida agentlik suv belgisi va rasmiylar bo'lishi mumkin — har kadrni tekshir.
  Foydalanuvchi so'rovi bilan ORIGINAL ham yoqildi (istisno, rasmiylar/suv belgisi bilan): video `1104629705812151`, kampaniya `120255975618740150`, e'lon `120255975632700150`.
  ($10 CBO), guruh `120255914095150150`, e'lon `120255914115340150` (Jahongir e'lonidan nusxa). Ads Manager chop etishda
  xavfsizlik tasdig'i (#3858385, email kod) so'raldi — Nematulla o'zi tasdiqladi.
- Forum APP ilovasi (2096149907690629) egasi `nematgafforov01@gmail.com` developer akkaunti; Chrome'dagi akkaunt developers
  saytiga kira olmaydi. Live uchun maxfiylik: https://oquvmarkazlarforumi.onrender.com/privacy (2026-10-23 qo'yildi).
- Sayt kampaniyasi (2026-10-22): `120255897318250150` "Forum 2026 | Sayt | B2B kreativlar (20)" (OUTCOME_LEADS),
  guruh `120255897319390150` "UZ | 25+ | Sayt Lead" ($10/kun, OFFSITE_CONVERSIONS, pixel LEAD, UZ 25–65 Advantage+).
  E'lonlar (hammasi Ibrat Farzandlari partnership, sayt URL + url_tags UTM, Browser add-on = None):
  "B2B video 13-20" (8 video), "B2B rasm 01-06", "B2B rasm 07-12" (1x1+9x16). Partnership e'lonlarda Flexible
  format yo'q — "Single image or video" ichida 10 tagacha media. Nusxalashda "Instant form (suggested)" add-on
  o'zi yoqilib qoladi — har doim None ga qaytarish. Kreativlarda rasmiy shaxslar (Alisher Sadullayev va h.k.)
  kadrlari ISHLATILMAYDI (Nematulla talabi) — faqat zal, olomon, stend, bino, ayol spikerlar.
- Maqsad (2026-10-22): kuniga 100 lid. Byudjetlar 22.10 da (guruh darajasida): rustam 13, FORUM 1 13, turin 26,
  oquv markazlar 26, 2 hamkorlar 15, ibrat bilan 5 (CPL $2+ bo‘lgani uchun kesildi), spiker kampaniyasi CBO 10
  — jami $108/kun. Byudjet kuniga ko‘pi bilan +20–30% oshiriladi (learning qayta boshlanmasligi uchun).
  CRM CAPI 22.10 05:51 UTC da ishga tushdi: birinchi yuborishda 812 hodisa (7 kunlik backfill) qabul qilindi.
- Meta reklama havolasi (ad creative `url_tags`):
  `utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}`
- CAPI tokeni, system user tokeni va amoCRM tokeni chatda ochiq yuborilgan — deploydan keyin
  uchalasini yangilash.

## 5a. Sotuv dashboardi (2026-10-21)

- Ochish: `node server/server.js` → `http://localhost:3000/dashboard` (Railway'da `https://<domen>/dashboard`).
  Login/parol: `server/.env` → `DASHBOARD_USER` (standart `forum`) / `DASHBOARD_PASSWORD`. Parol bo‘sh bo‘lsa
  dashboard 503 "dashboard sozlanmagan" qaytaradi. Railway Variables'ga ham DASHBOARD_PASSWORD qo‘shish kerak.
- Bo‘limlar: Raqamlar (KPI + kunlik grafik/jadval), Voronka (bosqichlar tarixi, lidlar ro‘yxati, filtr),
  Kampaniyalar (Meta + CRM, ROAS = sotuv so‘m / (sarf × USD_UZS, standart 12800)), Kreativlar (9:16 kartalar,
  ▶ bosilganda video /api/dashboard/video orqali olinadi — fbcdn havolalari eskirgani uchun talab bo‘yicha).
- Davr: standart oxirgi 30 kun, Asia/Tashkent; presetlar Bugun/Kecha/7 kun/30 kun/Shu oy.
- CRM lid → kampaniya/e'lon bog‘lash: avval UTM_CAMPAIGN/UTM_CONTENT, bo‘lmasa "Facebook №<leadgen_id>" nomidagi
  ID bo‘yicha Graph `/{leadgen_id}?fields=campaign_id,ad_id,...` (xotirada abadiy kesh; server restartdan keyin
  birinchi yuklash ~30 s). Manba: meta-forma (fb<form> teg / Facebook № / UTM facebook), forum-sayt, boshqa.
- Meta xatosi: kunlik bo‘lishda (time_increment=1 yoki time_ranges) `actions` maydoni so‘ralsa spend/impressions
  0 qaytadi — shuning uchun kunlik ma'lumot ikki so‘rovda olinadi (metrikalar va actions alohida).
- Reels videolari `source` ni system user tokeni bilan bermasa, sahifa tokeni (`/{page}?fields=access_token`) bilan
  qayta so‘raladi. Video ID faqat dashboard ro‘yxatidagi e'lonlarniki bo‘lsa qabul qilinadi.
- loadEnv: muhitda (hatto bo‘sh) berilgan o‘zgaruvchi .env dan ustun. Lokal sinovda poller amoCRM ga yozmasligi
  uchun: `PORT=3019 META_LEADGEN_FORM_IDS= node server/server.js`.

## 6. Qilinmagan / kutilayotgan ishlar

1. Railway'ga deploy (yuqoridagi reja).
2. Telegram guruh chat ID ni aniqlash: botni guruhga qo‘shib, xabar yozib,
   `https://api.telegram.org/bot<TOKEN>/getUpdates` dan `chat.id` olinadi; `.env` ga yoziladi.
3. ✅ Forum videosi qo‘shildi (2026-10-21), hero va #atmosfera bitta faylda. Manba 849×478 — yuqori
   sifatli asl video bo‘lsa, almashtirish kerak.
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

- QOIDA (2026-10-25): Tashkilotchi = "Faol o‘quv markazlar". Yoshlar ishlari agentligi va Alisher Sadullayev sayt, reklama, kreativ, hujjat — hech qayerda ko‘rsatilmaydi.
- 2026-10-27 BUDJET STRATEGIYASI: maqsad kuniga 100–120 lid, CPL $1–1.5. Arzon kreativga ko'proq pul (+20–30%/kun dan oshmasin).
  O'zgarishlar: Jahongir $32, Xurshid kamp. $13 (Sherzod e'loni pauza), 2 hamkorlar $19, registon $20, rustam $10, ibrat bilan pauza, Sayt B2B $7 (rasm 01-06 pauza).
  Yangi: "Forum 2026 | CPL cap $1.5 | Eng arzon kreativlar" kampaniya `120255972093950150` (COST_CAP, bid 150, $30/kun), guruh `120255972095820150`, 5 post: Jahongir, Xurshid, 2, 1, Turin.
- Telegram hisobotlari: `server/report.js` — 09:00 kecha, 19:00 bugun; hisob to'xtashi (to'lov) va rad etilgan e'lon ogohlantirishi har 30 daqiqada. O'chirish: REPORTS=off.
- 2026-10-27: `120255972093950150` dan cost cap olib tashlandi (LOWEST_COST_WITHOUT_CAP), nomi "Eng arzon kreativlar (cap yo'q)".
- Rahbarlar kampaniyasi `120255976479680150` ($25 CBO), guruh `120255976480020150`: UZ 25–60, advantage_audience=0, lavozimlar Owner/Founder/CEO/Director/Managing Director/Владелец/Ген.директор + Small business owners, Business page admins + qiziqishlar Entrepreneurship/Small business/Business networking (spec: scratchpad tg_owners.json, ~1.3–1.5 mln). 12 ta forma posti (object_story_id) bitta guruhda.
- 2026-10-27 kechqurun: eski ad setlar 18–65 yoshda ekan (sifatsiz lid manbai). age_min=25 qilindi (age_range tavsiyasi va
  individual_setting.age olib tashlandi): turin, rustam, ibrat bilan, FORUM 1. registon (`120255805568760150`) va
  "2 hamkorlar" (`120255696751720150`) da Meta "Broaden your audience" deb rad etdi (tor work_positions) — 18+ qolgan.
