(function () {
  "use strict";

  // Footer year
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ============================================================
  // TOP NAV: smooth scroll, active-section highlight, scroll progress
  // ============================================================
  (function navModule() {
    var navLinks = Array.prototype.slice.call(document.querySelectorAll(".topnav__links a[data-nav]"));
    var progressBar = document.getElementById("scrollProgress");
    var sections = navLinks
      .map(function (link) {
        var id = link.getAttribute("data-nav");
        var el = document.getElementById(id);
        return el ? { link: link, el: el } : null;
      })
      .filter(Boolean);

    if (!sections.length && !progressBar) return;

    // Smooth-scroll on click, accounting for the sticky nav height.
    navLinks.forEach(function (link) {
      link.addEventListener("click", function (e) {
        var id = link.getAttribute("data-nav");
        var target = document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        var nav = document.querySelector(".topnav");
        var navHeight = nav ? nav.getBoundingClientRect().height : 0;
        var top = target.getBoundingClientRect().top + window.pageYOffset - navHeight - 12;
        window.scrollTo({ top: top, behavior: "smooth" });
        if (window.history && window.history.pushState) {
          window.history.pushState(null, "", "#" + id);
        }
      });
    });

    function updateActiveLink() {
      var navEl = document.querySelector(".topnav");
      var navHeight = navEl ? navEl.getBoundingClientRect().height : 0;
      var probe = window.pageYOffset + navHeight + 24;

      var activeIndex = -1;
      sections.forEach(function (s, i) {
        var top = s.el.getBoundingClientRect().top + window.pageYOffset;
        if (probe >= top) activeIndex = i;
      });

      sections.forEach(function (s, i) {
        if (i === activeIndex) {
          s.link.classList.add("is-active");
        } else {
          s.link.classList.remove("is-active");
        }
      });
    }

    function updateProgress() {
      if (!progressBar) return;
      var scrollTop = window.pageYOffset;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var pct = docHeight > 0 ? Math.min(100, Math.max(0, (scrollTop / docHeight) * 100)) : 0;
      progressBar.style.width = pct + "%";
    }

    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        updateActiveLink();
        updateProgress();
        ticking = false;
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
  })();

  // ============================================================
  // LANGUAGE TOGGLE (EN default, LTR / FA, RTL)
  // ============================================================
  var STORAGE_KEY = "site-lang";
  var THEME_STORAGE_KEY = "site-theme";
  var htmlEl = document.documentElement;
  var toggleBtn = document.getElementById("langToggle");
  var themeToggle = document.getElementById("themeToggle");
  var downloadCv = document.getElementById("downloadCv");
  var titleElement = document.querySelector("title");
  var resumeSections = Array.prototype.slice.call(document.querySelectorAll("main section[id]"));
  var activeTitleSection = null;
  var titleLabels = {
    about: { en: "About", fa: "درباره من" },
    skills: { en: "Skills", fa: "مهارت‌ها" },
    experience: { en: "Experience", fa: "سوابق کاری" },
    teaching: { en: "Teaching", fa: "آموزش" },
    projects: { en: "Open-Source Projects", fa: "پروژه‌های متن‌باز" },
    education: { en: "Education", fa: "سوابق تحصیلی" },
    tech: { en: "Technologies", fa: "فناوری‌ها" },
    certificates: { en: "Certificates", fa: "گواهی‌ها" }
  };

  function updatePageTitle(sectionId) {
    if (sectionId) activeTitleSection = sectionId;
    if (!titleElement) return;

    var lang = htmlEl.getAttribute("lang") === "fa" ? "fa" : "en";
    var label = titleLabels[activeTitleSection];
    titleElement.textContent = label
      ? (lang === "fa" ? "علی چاوشی | " : "Ali Chavoshi | ") + label[lang]
      : (lang === "fa" ? "علی چاوشی | توسعه‌دهنده ارشد" : "Ali Chavoshi | Senior Full-Stack Developer");
  }

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

    if (themeToggle) {
      var isDark = htmlEl.getAttribute("data-theme") === "dark";
      var themeAction = isDark
        ? (isFa ? "تغییر به حالت روشن" : "Switch to light mode")
        : (isFa ? "تغییر به حالت تاریک" : "Switch to dark mode");
      themeToggle.setAttribute("aria-label", themeAction);
      themeToggle.setAttribute("title", themeAction);
    }

    if (downloadCv) {
      var resumeFile = isFa ? "Ali-Chavoshi-Resume-FA.pdf" : "Ali-Chavoshi-Resume-EN.pdf";
      var resumeAction = isFa ? "دانلود رزومه فارسی به صورت PDF" : "Download English resume as PDF";
      downloadCv.setAttribute("href", "output/pdf/" + resumeFile);
      downloadCv.setAttribute("download", resumeFile);
      downloadCv.setAttribute("aria-label", resumeAction);
      downloadCv.setAttribute("title", resumeAction);
    }

    updatePageTitle();

    try {
      window.localStorage.setItem(STORAGE_KEY, isFa ? "fa" : "en");
    } catch (e) {
      /* localStorage unavailable — ignore, toggle still works for this session */
    }
  }

  function getInitialLang() {
    var requestedLang = new URLSearchParams(window.location.search).get("lang");
    if (requestedLang === "fa" || requestedLang === "en") return requestedLang;
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
  // COLOR THEME — starts from the saved choice or system preference.
  // The small inline script in <head> applies this before first paint.
  // ============================================================
  function applyTheme(theme) {
    var isDark = theme === "dark";
    if (isDark) htmlEl.setAttribute("data-theme", "dark");
    else htmlEl.removeAttribute("data-theme");

    if (themeToggle) {
      var isFa = htmlEl.getAttribute("lang") === "fa";
      var themeAction = isDark
        ? (isFa ? "تغییر به حالت روشن" : "Switch to light mode")
        : (isFa ? "تغییر به حالت تاریک" : "Switch to dark mode");
      themeToggle.setAttribute("aria-label", themeAction);
      themeToggle.setAttribute("title", themeAction);
      themeToggle.setAttribute("aria-pressed", String(isDark));
    }
  }

  function getInitialTheme() {
    if (new URLSearchParams(window.location.search).get("print") === "1") return "light";
    try {
      var saved = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === "dark" || saved === "light") return saved;
    } catch (e) {
      /* ignore */
    }
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  var currentTheme = getInitialTheme();
  applyTheme(currentTheme);

  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      currentTheme = currentTheme === "dark" ? "light" : "dark";
      applyTheme(currentTheme);
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
      } catch (e) {
        /* localStorage unavailable — ignore */
      }
    });
  }

  // Keep the browser-tab title in step with the section a reader is viewing.
  var titleScrollFrame = null;
  function setTitleFromScrollPosition() {
    titleScrollFrame = null;
    var currentSection = resumeSections[0];
    resumeSections.forEach(function (section) {
      if (section.getBoundingClientRect().top <= 180) currentSection = section;
    });
    if (currentSection) updatePageTitle(currentSection.id);
  }

  function requestTitleUpdate() {
    if (titleScrollFrame !== null) return;
    titleScrollFrame = window.requestAnimationFrame(setTitleFromScrollPosition);
  }

  window.addEventListener("scroll", requestTitleUpdate, { passive: true });
  window.addEventListener("resize", requestTitleUpdate);
  requestTitleUpdate();

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
