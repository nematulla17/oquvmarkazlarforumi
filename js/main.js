/* =====================================================================
   Biznes hamkorlar landing — asosiy skript
   - Hero video (faqat keng ekranlarda yuklanadi, ko‘rinmasa pauza)
   - Mobil menyu
   - Yo‘nalish kartochkasi -> formani oldindan to‘ldirish
   - Telefon maskasi, validatsiya, yuborish (POST /api/lead)
   - UTM va manbani saqlash
   - Sticky CTA, raqamlar animatsiyasi, reveal
   ===================================================================== */
(function () {
  "use strict";

  var CONFIG = {
    endpoint: window.LEAD_ENDPOINT || "/api/lead",
    videoMinWidth: 768,
    videoSources: [
      { src: "assets/video/hero.webm", type: "video/webm" },
      { src: "assets/video/hero.mp4", type: "video/mp4" }
    ],
    pdf: "assets/docs/Biznes_hamkorlar_paketi_2026.pdf"
  };
  var VIDEO_MIN_WIDTH = CONFIG.videoMinWidth;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- analytics hook (GA4 / Meta Pixel / Yandex) ---------- */
  function track(name, data) {
    data = data || {};
    try {
      if (typeof window.gtag === "function") window.gtag("event", name, data);
      if (typeof window.fbq === "function") window.fbq("trackCustom", name, data);
      if (typeof window.ym === "function" && window.YM_ID) window.ym(window.YM_ID, "reachGoal", name, data);
      if (window.dataLayer) window.dataLayer.push(Object.assign({ event: name }, data));
    } catch (e) { /* no-op */ }
  }
  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-track]");
    if (el) track(el.getAttribute("data-track"));
  });

  /* ---------- hero video ---------- */
  var video = $("#heroVideo");
  if (video) {
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var saveData = navigator.connection && navigator.connection.saveData;
    if (!reduce && !saveData && window.innerWidth >= VIDEO_MIN_WIDTH) {
      CONFIG.videoSources.forEach(function (s) {
        var el = document.createElement("source");
        el.src = s.src; el.type = s.type; video.appendChild(el);
      });
      video.addEventListener("error", function () { video.removeAttribute("src"); }, true);
      video.load();
      var p = video.play();
      if (p && p.catch) p.catch(function () { /* autoplay bloklangan — poster qoladi */ });
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (entries) {
          entries.forEach(function (en) {
            if (en.isIntersecting) { video.play().catch(function () {}); } else { video.pause(); }
          });
        }, { threshold: 0.1 }).observe(video);
      }
    }
  }

  /* ---------- mobile menu ---------- */
  var burger = $(".burger"), menu = $("#mobileMenu");
  if (burger && menu) {
    burger.addEventListener("click", function () {
      var open = burger.getAttribute("aria-expanded") === "true";
      burger.setAttribute("aria-expanded", String(!open));
      burger.setAttribute("aria-label", open ? "Menyuni ochish" : "Menyuni yopish");
      menu.hidden = open;
    });
    $$("a", menu).forEach(function (a) {
      a.addEventListener("click", function () {
        burger.setAttribute("aria-expanded", "false"); menu.hidden = true;
      });
    });
  }

  /* ---------- form refs ---------- */
  var form = $("#leadForm");
  if (!form) return;
  var status = $(".form__status", form);
  var submitBtn = $("#submitBtn");
  var sourceInput = $("#fSource");

  /* UTM va sahifa */
  try {
    var qs = new URLSearchParams(location.search);
    ["utm_source", "utm_medium", "utm_campaign", "utm_content"].forEach(function (k) {
      var v = qs.get(k) || sessionStorage.getItem(k) || "";
      if (qs.get(k)) sessionStorage.setItem(k, qs.get(k));
      var inp = form.elements[k]; if (inp) inp.value = v;
    });
    form.elements.page.value = location.href;
  } catch (e) { /* no-op */ }

  /* ---------- prefill helpers ---------- */
  function setPackage(pkg) {
    var map = { bronze: "Bronze", silver: "Silver", gold: "Gold" };
    var val = map[pkg];
    $$('input[name="package"]', form).forEach(function (r) { r.checked = (val ? r.value === val : r.value === "Maslahat kerak"); });
  }
  function scrollToForm(focusField) {
    var target = $("#ariza");
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    if (focusField) setTimeout(function () { var f = form.elements[focusField]; if (f) f.focus({ preventScroll: true }); }, 500);
  }

  // Paket tugmalari va PDF tugmasi
  $$("[data-open-form]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var kind = btn.getAttribute("data-open-form");
      if (kind === "pdf") {
        sourceInput.value = "pdf";
        setPackage(null);
        $(".btn__label", submitBtn).textContent = "Taqdimotni olish";
      } else {
        sourceInput.value = "package_" + kind;
        setPackage(kind);
        $(".btn__label", submitBtn).textContent = "Taklif olish";
      }
      scrollToForm("name");
    });
  });

  // Yo‘nalish kartochkalari
  $$(".dir[data-dir]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var dir = btn.getAttribute("data-dir");
      var sel = form.elements.direction;
      var found = false;
      $$("option", sel).forEach(function (o) { if (o.textContent.trim() === dir) { o.selected = true; found = true; } });
      if (!found) sel.value = "Boshqa";
      setPackage(btn.getAttribute("data-pkg"));
      sourceInput.value = "direction";
      track("dir_select", { direction: dir });
      scrollToForm("name");
    });
  });

  /* ---------- phone mask (+998 XX XXX XX XX) ---------- */
  var phone = form.elements.phone;
  function formatPhone(v) {
    var d = v.replace(/\D/g, "");
    if (d.indexOf("998") === 0) d = d.slice(3);
    d = d.slice(0, 9);
    var out = "+998";
    if (d.length > 0) out += " " + d.slice(0, 2);
    if (d.length > 2) out += " " + d.slice(2, 5);
    if (d.length > 5) out += " " + d.slice(5, 7);
    if (d.length > 7) out += " " + d.slice(7, 9);
    return out;
  }
  phone.addEventListener("input", function () { phone.value = formatPhone(phone.value); });
  phone.addEventListener("focus", function () { if (!phone.value) phone.value = "+998 "; });
  phone.addEventListener("keydown", function (e) {
    // "+998 " ni o‘chirishga yo‘l qo‘ymaslik
    if (e.key === "Backspace" && phone.value.replace(/\D/g, "").length <= 3) e.preventDefault();
  });

  /* ---------- validation ---------- */
  function fieldWrap(el) { return el.closest(".field"); }
  function setError(el, msg) {
    var w = fieldWrap(el); if (!w) return;
    var err = $(".err", w);
    if (msg) { w.classList.add("is-invalid"); if (err) err.textContent = msg; }
    else { w.classList.remove("is-invalid"); if (err) err.textContent = ""; }
  }
  function validate() {
    var ok = true, first = null;
    var name = form.elements.name, company = form.elements.company, dir = form.elements.direction;
    var nameV = name.value.trim(), compV = company.value.trim();
    if (nameV.length < 2) { setError(name, "Ismingizni kiriting"); ok = false; first = first || name; } else setError(name, "");
    if (compV.length < 2) { setError(company, "Kompaniya nomini kiriting"); ok = false; first = first || company; } else setError(company, "");
    if (phone.value.replace(/\D/g, "").length !== 12) { setError(phone, "To‘liq raqam kiriting: +998 XX XXX XX XX"); ok = false; first = first || phone; } else setError(phone, "");
    if (!dir.value) { setError(dir, "Yo‘nalishni tanlang"); ok = false; first = first || dir; } else setError(dir, "");
    if (first) first.focus();
    return ok;
  }
  ["name", "company", "direction"].forEach(function (k) {
    form.elements[k].addEventListener("input", function () { setError(form.elements[k], ""); });
    form.elements[k].addEventListener("change", function () { setError(form.elements[k], ""); });
  });
  phone.addEventListener("input", function () { setError(phone, ""); });

  /* ---------- submit ---------- */
  var modal = $("#successModal");
  function openModal() {
    if (!modal) return;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    var btn = $(".btn", modal); if (btn) btn.focus();
  }
  function closeModal() {
    if (!modal) return;
    modal.hidden = true; document.body.style.overflow = "";
  }
  if (modal) {
    $(".modal__close", modal).addEventListener("click", closeModal);
    modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !modal.hidden) closeModal(); });
  }

  function setStatus(msg, kind) {
    status.textContent = msg || "";
    status.classList.toggle("is-error", kind === "error");
    status.classList.toggle("is-ok", kind === "ok");
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (form.elements.website && form.elements.website.value) return; // bot
    if (!validate()) { setStatus("Belgilangan maydonlarni to‘ldiring.", "error"); return; }
    setStatus("");

    var payload = {};
    $$("input, select, textarea", form).forEach(function (el) {
      if (!el.name || el.name === "website") return;
      if (el.type === "radio") { if (el.checked) payload[el.name] = el.value; return; }
      payload[el.name] = el.value.trim();
    });
    payload.submitted_at = new Date().toISOString();
    payload.referrer = document.referrer || "";
    payload.user_agent = navigator.userAgent;

    submitBtn.classList.add("is-loading");
    submitBtn.disabled = true;

    var done = function () {
      submitBtn.classList.remove("is-loading");
      submitBtn.disabled = false;
    };

    fetch(CONFIG.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json().catch(function () { return {}; });
    }).then(function () {
      done();
      track("lead_success", { package: payload.package, direction: payload.direction, source: payload.source });
      form.reset();
      phone.value = "+998 ";
      openModal();
    }).catch(function (err) {
      done();
      track("lead_fallback", { message: String(err && err.message) });
      // Server yo‘q (statik hosting) yoki xatolik — arizani Telegram orqali yuborishga o‘tkazamiz
      var text = encodeURIComponent(
        "Salom! Forum 2026 hamkorligi bo‘yicha taklif olmoqchiman.\n" +
        "Ism: " + payload.name + "\nKompaniya: " + payload.company + "\nTelefon: " + payload.phone +
        "\nYo‘nalish: " + payload.direction + "\nPaket: " + payload.package +
        (payload.comment ? "\nIzoh: " + payload.comment : "")
      );
      var tgUrl = "https://t.me/oquvmarkazlarforumi?text=" + text;
      if (modal) {
        $("#successTitle", modal).textContent = "Arizani Telegram orqali yuboring";
        $("p", modal).textContent = "Ma’lumotlaringiz tayyor xabar sifatida ochiladi — faqat “Yuborish” tugmasini bosing. Menejer 1 ish kuni ichida bog‘lanadi.";
        var main = $(".btn", modal);
        main.textContent = "Telegram orqali yuborish";
        main.href = tgUrl;
        main.setAttribute("data-track", "lead_tg_fallback");
        var link = $(".link--center", modal);
        link.textContent = "Yoki qo‘ng‘iroq qiling: +998 77 150 32 32";
        link.href = "tel:+998771503232";
        openModal();
      } else {
        setStatus("Yuborishda xatolik. Qo‘ng‘iroq qiling: +998 77 150 32 32", "error");
      }
    });
  });

  /* ---------- sticky CTA: hero va forma ko‘rinmayotganda ---------- */
  var sticky = $("#stickyCta");
  if (sticky && "IntersectionObserver" in window) {
    var hidden = { hero: true, form: false };
    var update = function () { sticky.classList.toggle("is-visible", !hidden.hero && !hidden.form); };
    var heroEl = $(".hero"), formEl = $("#ariza");
    new IntersectionObserver(function (en) { hidden.hero = en[0].isIntersecting; update(); }, { threshold: 0.2 }).observe(heroEl);
    new IntersectionObserver(function (en) { hidden.form = en[0].isIntersecting; update(); }, { threshold: 0.15 }).observe(formEl);
  }

  /* ---------- counters ---------- */
  function fmt(n, format) {
    var s = String(Math.round(n));
    if (format === "space") s = s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return s;
  }
  var counters = $$("[data-count]");
  if (counters.length && "IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target; io.unobserve(el);
        var target = parseFloat(el.getAttribute("data-count"));
        var suffix = el.getAttribute("data-suffix") || "";
        var format = el.getAttribute("data-format");
        var start = performance.now(), dur = 900;
        (function tick(now) {
          var t = Math.min(1, (now - start) / dur);
          var eased = 1 - Math.pow(1 - t, 3);
          el.textContent = fmt(target * eased, format) + suffix;
          if (t < 1) requestAnimationFrame(tick);
        })(start);
      });
    }, { threshold: 0.5 });
    counters.forEach(function (c) { io.observe(c); });
  }

  /* ---------- reveal ---------- */
  var revealEls = $$(".card, .pkg, .step, .dir, .howto li, .needs__grid li");
  if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    revealEls.forEach(function (el) { el.classList.add("reveal"); });
    var rio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-in"); rio.unobserve(en.target); } });
    }, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });
    revealEls.forEach(function (el) { rio.observe(el); });
  }
})();
