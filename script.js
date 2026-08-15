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
})();