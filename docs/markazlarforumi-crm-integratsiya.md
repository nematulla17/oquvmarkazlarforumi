# markazlarforumi.uz → amoCRM integratsiyasi

Maqsad: saytda ro‘yxatdan o‘tgan ishtirokchilar va hamkorlik arizalari amoCRM'ga va jamoaning Telegram guruhiga avtomatik tushsin, chipta sotib olinganda esa bitim o‘zi “TO‘LANDI” bosqichiga o‘tsin.

amoCRM'ga to‘g‘ridan-to‘g‘ri ulanish shart emas. Sayt serveri ma’lumotni bizning qabul nuqtamizga yuboradi, amoCRM va Telegram'ga yozishni bizning server o‘zi qiladi.

---

## 1. Qachon yuboriladi

| Holat | Qachon | `direction` |
|---|---|---|
| Ishtirokchi ro‘yxatdan o‘tdi | SMS/Telegram kod tasdiqlanib, akkaunt ochilgandan keyin | `Ishtirokchi (markazlarforumi.uz)` |
| Hamkorlik arizasi | `POST /api/landing/partner-requests` bazaga saqlangandan keyin | `Hamkor (markazlarforumi.uz)` |

Yuborish faqat **serverdan** bo‘ladi (brauzerdan emas).

---

## 2. Qayerga yuboriladi

```
POST https://oquvmarkazlarforumi.onrender.com/api/lead
Content-Type: application/json
X-Forward-Key: <kalit>
```

**Kalit** maxfiy, uni sizga shaxsan beramiz. Uni faqat serverning `.env` fayliga yozing (`CRM_FORWARD_KEY=...`), kodga, git'ga va brauzer kodiga qo‘ymang. Kalitsiz so‘rovlar bitta IP'dan 10 daqiqada 8 tadan oshsa rad etiladi; kalit bilan cheklov yo‘q.

---

## 3. Maydonlar

| Maydon | Majburiy | Izoh |
|---|---|---|
| `name` | ha | Ism Familiya (kamida 2 belgi) |
| `company` | ha | Tashkilot nomi. Yo‘q bo‘lsa: `Hozircha yo'q` |
| `phone` | ha | Faqat raqamlar, **12 ta**, `+` belgisisiz: `998901234567` |
| `direction` | ha | 1-bo‘limdagi jadvaldan |
| `package` | yo‘q | Hamkorlik arizasida tanlangan paket (`plan`) |
| `comment` | yo‘q | Ishtirokchi uchun: `Viloyat, tuman` |
| `source` | ha | Doim `markazlarforumi.uz` |
| `page` | yo‘q | Ariza yuborilgan sahifa manzili |
| `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` | yo‘q | Foydalanuvchi saytga birinchi kelgandagi UTM'lar (saqlangan bo‘lsa) |

**`event_id` yubormang.** Meta'ga hodisani sayt serveri o‘zi yuboradi; `event_id` kelsa, bizning server ham Meta'ga yuboradi va hodisa ikki marta sanaladi.

---

## 4. Namuna

### Ishtirokchi

```json
{
  "name": "Aziz Karimov",
  "company": "Hozircha yo'q",
  "phone": "998901234567",
  "direction": "Ishtirokchi (markazlarforumi.uz)",
  "comment": "Jizzax viloyati, Sharof Rashidov tumani",
  "source": "markazlarforumi.uz",
  "page": "https://markazlarforumi.uz/ishtirok-etish",
  "utm_source": "facebook",
  "utm_medium": "paid",
  "utm_campaign": "mf_sales",
  "utm_content": "Registon"
}
```

### Hamkorlik arizasi

```json
{
  "name": "Dilshod Rahimov",
  "company": "Smart Education",
  "phone": "998935551122",
  "direction": "Hamkor (markazlarforumi.uz)",
  "package": "gold",
  "source": "markazlarforumi.uz",
  "page": "https://markazlarforumi.uz/#hamkorlik"
}
```

---

## 5. Kod (Next.js / Node.js)

```ts
// lib/crm-forward.ts
const CRM_URL = "https://oquvmarkazlarforumi.onrender.com/api/lead";

type CrmLead = {
  name: string;
  company?: string;
  phone: string;            // "+998 90 123 45 67" bo'lsa ham bo'ladi, pastda tozalanadi
  direction: string;
  package?: string;
  comment?: string;
  page?: string;
  utm?: Record<string, string | undefined>;
};

/** amoCRM + Telegram uchun nusxa. Javobni kutmaydi, xato bo'lsa faqat log yozadi. */
export function forwardToCrm(l: CrmLead) {
  const body = {
    name: l.name.trim(),
    company: l.company?.trim() || "Hozircha yo'q",
    phone: l.phone.replace(/\D/g, ""),
    direction: l.direction,
    package: l.package ?? "",
    comment: l.comment ?? "",
    source: "markazlarforumi.uz",
    page: l.page ?? "",
    utm_source: l.utm?.utm_source, utm_medium: l.utm?.utm_medium, utm_campaign: l.utm?.utm_campaign,
    utm_content: l.utm?.utm_content, utm_term: l.utm?.utm_term,
  };
  void fetch(CRM_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forward-Key": process.env.CRM_FORWARD_KEY ?? "" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  })
    .then((r) => { if (!r.ok) console.error("crm forward", r.status); })
    .catch((err) => console.error("crm forward", err));
}
```

```ts
// OTP tasdiqlanib, foydalanuvchi yaratilgandan keyin
forwardToCrm({
  name: `${user.first_name} ${user.last_name}`,
  company: user.organization,
  phone: user.phone,
  direction: "Ishtirokchi (markazlarforumi.uz)",
  comment: [user.region, user.district].filter(Boolean).join(", "),
  page: body.event_source_url,
  utm: user.utm,             // saqlangan bo'lsa
});

// partner-requests bazaga saqlangandan keyin
forwardToCrm({
  name: body.full_name,
  company: body.organization,
  phone: body.phone,
  direction: "Hamkor (markazlarforumi.uz)",
  package: body.plan,
  page: body.event_source_url,
  utm: body.utm,
});
```

---

## 6. Javoblar

| Javob | Ma’nosi |
|---|---|
| `200 {"ok":true}` | Qabul qilindi, amoCRM'da bitim ochildi |
| `422 {"error":"validation"}` | `name`/`company` 2 belgidan qisqa, telefon 12 raqam emas yoki `direction` bo‘sh |
| `429` | Kalit yuborilmagan yoki noto‘g‘ri, bitta IP'dan juda ko‘p so‘rov ketgan. `X-Forward-Key` ni tekshiring |

Javobni kutmang va foydalanuvchiga xato ko‘rsatmang: CRM'ga nusxa yuborish saytning asosiy ishiga ta’sir qilmasligi kerak.

---

## 7. Buyurtma va to‘lov

Ishtirokchi saytda chipta sotib olsa, amoCRM'dagi bitimi o‘zi oldinga suriladi:

| Holat | Qachon | amoCRM bosqichi |
|---|---|---|
| `checkout` | Buyurtma yaratilib, foydalanuvchi to‘lov sahifasiga yuborilganda (`POST /api/payment/orders`) | TO‘LOV KUTILYAPTI |
| `paid` | Payme / Click / Uzum Nasiya to‘lovni **tasdiqlaganda** (callback) | TO‘LANDI |

Bitim telefon raqami bo‘yicha topiladi. Topilmasa, yangi bitim ochiladi. Bosqich faqat oldinga suriladi. Bir xil `order_id` bilan callback qayta kelsa, ikkinchi marta yozilmaydi. To‘lovda jamoaning Telegram guruhiga “chipta sotildi” xabari boradi.

```
POST https://oquvmarkazlarforumi.onrender.com/api/site-event
Content-Type: application/json
X-Forward-Key: <kalit>        ← majburiy, kalitsiz 401 qaytadi
```

| Maydon | Majburiy | Izoh |
|---|---|---|
| `event` | ha | `checkout` yoki `paid` |
| `phone` | ha | Ishtirokchi telefoni, 12 raqam: `998901234567` |
| `order_id` | ha | Buyurtma raqami |
| `amount` | ha | Summa, so‘mda (raqam): `1099000` |
| `name` | yo‘q | Ism Familiya (bitim topilmasa yangi bitimga yoziladi) |
| `company` | yo‘q | Tashkilot |
| `plan` | yo‘q | Chipta turi |
| `payment_method` | yo‘q | `payme`, `click` yoki `uzum` |

```ts
// lib/crm-forward.ts ga qo'shing
export function sendOrderToCrm(event: "checkout" | "paid", o: {
  phone: string; order_id: string | number; amount: number;
  name?: string; company?: string; plan?: string; payment_method?: string;
}) {
  void fetch("https://oquvmarkazlarforumi.onrender.com/api/site-event", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forward-Key": process.env.CRM_FORWARD_KEY ?? "" },
    body: JSON.stringify({ event, ...o, phone: o.phone.replace(/\D/g, ""), order_id: String(o.order_id) }),
    signal: AbortSignal.timeout(8000),
  })
    .then((r) => { if (!r.ok) console.error("crm order", r.status); })
    .catch((err) => console.error("crm order", err));
}
```

```ts
// 1) POST /api/payment/orders — buyurtma yaratilib, payment_url qaytarilishidan oldin
sendOrderToCrm("checkout", {
  phone: user.phone, name: `${user.first_name} ${user.last_name}`, company: user.organization,
  order_id: order.id, amount: order.amount, plan: order.plan, payment_method: body.payment_method,
});

// 2) Payme / Click / Uzum callback — to'lov TASDIQLANGANDA (Meta'ga Purchase yuboriladigan joyda)
sendOrderToCrm("paid", {
  phone: user.phone, name: `${user.first_name} ${user.last_name}`, company: user.organization,
  order_id: order.id, amount: order.amount, plan: order.plan, payment_method: order.provider,
});
```

Muhim: `paid` faqat to‘lov tizimi pulni tasdiqlaganda yuboriladi (Payme `PerformTransaction`, Click `complete`, Uzum muvaffaqiyatli holat). To‘lov sahifasiga o‘tganda yoki bekor qilinganda yuborilmaydi.

| Javob | Ma’nosi |
|---|---|
| `200 {"ok":true,"deal":123}` | Bitim yangilandi |
| `200 {"ok":true,"duplicate":true}` | Bu buyurtma avval qabul qilingan |
| `401` | Kalit yo‘q yoki noto‘g‘ri |
| `422` | `event` noto‘g‘ri yoki telefon 12 raqam emas |

---

## 8. Tekshirish

1. Saytda test raqam bilan ro‘yxatdan o‘ting va test hamkorlik arizasi yuboring.
2. amoCRM'da “forum hamkorlar” voronkasida ikkita yangi bitim paydo bo‘ladi, Telegram guruhga xabar keladi.
3. Test buyurtma oching: bitim TO‘LOV KUTILYAPTI bosqichiga o‘tadi. To‘lov tasdiqlansa, TO‘LANDI bosqichiga o‘tadi va Telegram'ga “chipta sotildi” keladi.
4. Bizga yozing: test bitimlarni yopib, CRM'da hammasi to‘g‘ri yozilganini tekshiramiz.

Savollar bo‘yicha: +998 55 515 73 91
