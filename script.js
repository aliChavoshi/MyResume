(function () {
  "use strict";

  // Footer year
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ============================================================
  // LANGUAGE TOGGLE (EN default, LTR / FA, RTL)
  // ============================================================
  var STORAGE_KEY = "site-lang";
  var htmlEl = document.documentElement;
  var toggleBtn = document.getElementById("langToggle");

  // Elements whose *text content* swaps with data-fa / englishOriginal
  var textSwapEls = Array.prototype.slice.call(document.querySelectorAll("[data-fa]"));
  var imgSwapEls = Array.prototype.slice.call(document.querySelectorAll("[data-fa-alt]"));
  var titleSwapEls = Array.prototype.slice.call(document.querySelectorAll("[data-fa-title]"));

  // Cache each element's original English markup once, so we can restore it exactly.
  textSwapEls.forEach(function (el) {
    if (!el.hasAttribute("data-en-cache")) {
      el.setAttribute("data-en-cache", el.innerHTML);
    }
  });
  imgSwapEls.forEach(function (el) {
    if (!el.hasAttribute("data-en-alt-cache")) {
      el.setAttribute("data-en-alt-cache", el.getAttribute("alt") || "");
    }
  });
  titleSwapEls.forEach(function (el) {
    if (!el.hasAttribute("data-en-title-cache")) {
      el.setAttribute("data-en-title-cache", el.getAttribute("title") || "");
    }
  });

  function decodeEntities(str) {
    var ta = document.createElement("textarea");
    ta.innerHTML = str;
    return ta.value;
  }

  function applyLang(lang) {
    var isFa = lang === "fa";

    htmlEl.setAttribute("lang", isFa ? "fa" : "en");
    htmlEl.setAttribute("dir", isFa ? "rtl" : "ltr");

    textSwapEls.forEach(function (el) {
      if (isFa) {
        var faMarkup = el.getAttribute("data-fa") || "";
        // data-fa on block-level text stores HTML-escaped tags for <strong> emphasis;
        // decode once so <strong>…</strong> renders as an element, not literal text.
        el.innerHTML = faMarkup.indexOf("&lt;") !== -1 ? decodeEntities(faMarkup) : faMarkup;
      } else {
        el.innerHTML = el.getAttribute("data-en-cache") || el.innerHTML;
      }
    });

    imgSwapEls.forEach(function (el) {
      var attr = isFa ? "data-fa-alt" : "data-en-alt-cache";
      var val = el.getAttribute(attr);
      if (val !== null) el.setAttribute("alt", val);
    });

    titleSwapEls.forEach(function (el) {
      var attr = isFa ? "data-fa-title" : "data-en-title-cache";
      var val = el.getAttribute(attr);
      if (val !== null) el.setAttribute("title", val);
    });

    if (toggleBtn) {
      toggleBtn.setAttribute(
        "aria-label",
        isFa ? "تغییر زبان به انگلیسی" : "Switch language to Persian"
      );
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, isFa ? "fa" : "en");
    } catch (e) {
      /* localStorage unavailable — ignore, toggle still works for this session */
    }
  }

  function getInitialLang() {
    try {
      var saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "fa" || saved === "en") return saved;
    } catch (e) {
      /* ignore */
    }
    return "en"; // default per spec
  }

  var currentLang = getInitialLang();
  applyLang(currentLang);

  if (toggleBtn) {
    toggleBtn.addEventListener("click", function () {
      currentLang = currentLang === "fa" ? "en" : "fa";
      applyLang(currentLang);
    });
  }

  // ============================================================
  // Scroll-reveal: fade + rise each .reveal block into view once.
  // Respects prefers-reduced-motion (handled purely in CSS as well).
  // ============================================================
  var revealEls = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
  if (!revealEls.length) return;

  if (!("IntersectionObserver" in window)) {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
    return;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      root: null,
      rootMargin: "0px 0px -10% 0px",
      threshold: 0.12,
    }
  );

  revealEls.forEach(function (el) {
    observer.observe(el);
  });

  // ============================================================
  // CERTIFICATE GALLERY + LIGHTBOX (MODAL)
  // ============================================================
  var certCards = Array.prototype.slice.call(document.querySelectorAll(".cert-card"));
  var lightbox = document.getElementById("certLightbox");
  var lightboxImg = document.getElementById("certLightboxImg");
  var lightboxTitle = document.getElementById("certLightboxTitle");

  // Placeholder images (cer-N.jpg that don't exist yet) hide the broken
  // icon and keep the elegant placeholder visible instead.
  var certImgs = Array.prototype.slice.call(document.querySelectorAll(".cert-card__thumb img"));
  certImgs.forEach(function (img) {
    img.addEventListener("load", function () {
      img.setAttribute("data-loaded", "true");
    });
    img.addEventListener("error", function () {
      img.style.display = "none";
    });
  });

  function setLightboxTitle(card) {
    if (!lightboxTitle || !card) return;
    var isFa = currentLang === "fa";
    var key = isFa ? "data-cert-title-fa" : "data-cert-title-en";
    lightboxTitle.innerHTML = card.getAttribute(key) || "";
  }

  function openLightbox(card) {
    if (!lightbox || !card) return;
    var src = card.getAttribute("data-cert-img");
    if (!src) return;

    lightboxImg.setAttribute("src", src);
    lightboxImg.setAttribute("alt", "");
    setLightboxTitle(card);
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("lightbox-open");

    var closeBtn = lightbox.querySelector("[data-close-lightbox]");
    if (closeBtn && closeBtn.tagName === "BUTTON") closeBtn.focus();
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("lightbox-open");
    lightboxImg.setAttribute("src", "");
    // return focus to the card that opened the modal
    if (lastCard) lastCard.focus();
  }
  var lastCard = null;

  if (certCards.length && lightbox) {
    certCards.forEach(function (card) {
      function requestOpen(e) {
        // ignore clicks that are just keyboard-triggered synthetic events
        if (e && e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return;
        lastCard = card;
        openLightbox(card);
        if (e && e.type === "keydown") e.preventDefault();
      }
      card.addEventListener("click", requestOpen);
      card.addEventListener("keydown", requestOpen);
    });

    lightbox
      .querySelectorAll("[data-close-lightbox]")
      .forEach(function (el) {
        el.addEventListener("click", closeLightbox);
      });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeLightbox();
    });
  }

  // When the language changes while a modal is open, refresh the title.
  if (toggleBtn && lightbox) {
    toggleBtn.addEventListener("click", function () {
      if (lightbox.classList.contains("is-open") && lastCard) {
        setLightboxTitle(lastCard);
      }
    });
  }
})();