/* ==========================================================================
   Core behaviour: language, theme, navigation, menus, disclosures, contact
   form and certificates. Animation lives in js/motion.js, js/hero-scene.js
   and js/journey.js; they react to the events dispatched here:
     site:langchange   detail: { lang: "en" | "fa" }
     site:themechange  detail: { theme: "light" | "dark" }
   ========================================================================== */
(function () {
   "use strict";

   const root = document.documentElement;
   const LANG_KEY = "site-lang";
   const THEME_KEY = "site-theme";
   const params = new URLSearchParams(window.location.search);
   const isPrint = params.get("print") === "1";
   const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

   const store = {
      get(key) {
         try {
            return window.localStorage.getItem(key);
         } catch (e) {
            return null;
         }
      },
      set(key, value) {
         try {
            window.localStorage.setItem(key, value);
         } catch (e) {
            /* storage unavailable: the choice still applies for this visit */
         }
      },
   };

   const lang = () => (root.getAttribute("lang") === "fa" ? "fa" : "en");
   const pick = (dict) => dict[lang()];
   const emit = (name, detail) => document.dispatchEvent(new CustomEvent(name, { detail }));

   window.Site = { lang, pick, isPrint, reduceMotion };

   const yearEl = document.getElementById("year");
   if (yearEl) yearEl.textContent = String(new Date().getFullYear());

   /* ------------------------------------------------------------------
      LANGUAGE (EN default, LTR / FA, RTL)
      Every [data-fa] element keeps its English markup in data-en-cache so
      it can be restored exactly. Only leaf-level elements carry data-fa.
      ------------------------------------------------------------------ */
   const textEls = Array.from(document.body.querySelectorAll("[data-fa]"));
   const attrSwaps = [
      ["data-fa-alt", "alt"],
      ["data-fa-aria", "aria-label"],
      ["data-fa-placeholder", "placeholder"],
      ["data-fa-title", "title"],
   ].map(([source, target]) => ({
      target,
      source,
      els: Array.from(document.querySelectorAll("[" + source + "]")),
   }));
   const metaDescription = document.querySelector('meta[name="description"]');

   const enMarkup = new Map(textEls.map((el) => [el, el.innerHTML]));
   let appliedLang = "en"; // the markup ships in English
   attrSwaps.forEach(({ target, els }) => {
      els.forEach((el) => {
         if (!el.hasAttribute("data-en-" + target)) el.setAttribute("data-en-" + target, el.getAttribute(target) || "");
      });
   });
   if (metaDescription) metaDescription.setAttribute("data-en-content", metaDescription.getAttribute("content"));

   const langToggle = document.getElementById("langToggle");
   const langToggleLabel = langToggle && langToggle.querySelector(".sr-only");
   const themeToggle = document.getElementById("themeToggle");
   const downloadLinks = Array.from(document.querySelectorAll(".js-download-cv"));

   function applyLang(next) {
      const fa = next === "fa";
      root.setAttribute("lang", fa ? "fa" : "en");
      root.setAttribute("dir", fa ? "rtl" : "ltr");

      if (appliedLang !== (fa ? "fa" : "en")) {
         textEls.forEach((el) => {
            el.innerHTML = fa ? el.getAttribute("data-fa") : enMarkup.get(el);
         });
         appliedLang = fa ? "fa" : "en";
      }
      attrSwaps.forEach(({ target, source, els }) => {
         els.forEach((el) => {
            const value = el.getAttribute(fa ? source : "data-en-" + target);
            if (value !== null) el.setAttribute(target, value);
         });
      });
      if (metaDescription) {
         metaDescription.setAttribute(
            "content",
            fa ? metaDescription.getAttribute("data-fa") : metaDescription.getAttribute("data-en-content"),
         );
      }

      if (langToggleLabel) {
         langToggleLabel.textContent = fa ? "تغییر زبان به انگلیسی" : "Switch language to Persian";
      }

      const file = fa ? "Ali-Chavoshi-Resume-FA.pdf" : "Ali-Chavoshi-Resume-EN.pdf";
      downloadLinks.forEach((el) => {
         el.setAttribute("href", "output/pdf/" + file);
         el.setAttribute("download", file);
         // The accessible name starts with the visible label (WCAG 2.5.3).
         el.setAttribute("aria-label", fa ? "رزومه PDF، نسخه فارسی" : "Resume PDF, English version");
      });

      syncThemeLabels();
      store.set(LANG_KEY, fa ? "fa" : "en");
      root.classList.remove("i18n-pending");
      emit("site:langchange", { lang: fa ? "fa" : "en" });
   }

   function initialLang() {
      const requested = params.get("lang");
      if (requested === "fa" || requested === "en") return requested;
      const saved = store.get(LANG_KEY);
      return saved === "fa" ? "fa" : "en";
   }

   /* ------------------------------------------------------------------
      THEME (saved choice, else the system preference; ?print=1 = light)
      ------------------------------------------------------------------ */
   function currentTheme() {
      return root.getAttribute("data-theme") === "dark" ? "dark" : "light";
   }

   function syncThemeLabels() {
      if (!themeToggle) return;
      const dark = currentTheme() === "dark";
      const label = dark
         ? pick({ en: "Switch to light mode", fa: "تغییر به حالت روشن" })
         : pick({ en: "Switch to dark mode", fa: "تغییر به حالت تاریک" });
      themeToggle.setAttribute("aria-label", label);
      themeToggle.setAttribute("title", label);
      themeToggle.setAttribute("aria-pressed", String(dark));
   }

   function setTheme(theme, origin) {
      const commit = () => {
         if (theme === "dark") root.setAttribute("data-theme", "dark");
         else root.removeAttribute("data-theme");
         syncThemeLabels();
         emit("site:themechange", { theme });
      };

      // A circular reveal from the toggle, where the browser supports it.
      if (origin && document.startViewTransition && !reduceMotion.matches) {
         const rect = origin.getBoundingClientRect();
         const x = rect.left + rect.width / 2;
         const y = rect.top + rect.height / 2;
         const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
         root.style.setProperty("--vt-x", x + "px");
         root.style.setProperty("--vt-y", y + "px");
         root.style.setProperty("--vt-r", r + "px");
         document.startViewTransition(commit);
      } else {
         commit();
      }
   }

   if (themeToggle) {
      themeToggle.addEventListener("click", () => {
         const next = currentTheme() === "dark" ? "light" : "dark";
         store.set(THEME_KEY, next);
         setTheme(next, themeToggle);
      });
   }

   // Follow the OS while the visitor has not picked a theme themselves.
   const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
   darkQuery.addEventListener("change", (e) => {
      if (isPrint || store.get(THEME_KEY)) return;
      setTheme(e.matches ? "dark" : "light");
   });

   /* ------------------------------------------------------------------
      COLLAPSIBLE LISTS: [data-collapsible="N"] keeps the first N items.
      ------------------------------------------------------------------ */
   const collapsibles = [];
   const CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.4 5.6 9l1.4-1.4 5 5 5-5L18.4 9z"/></svg>';

   document.querySelectorAll("[data-collapsible]").forEach((list, index) => {
      const keep = parseInt(list.getAttribute("data-collapsible"), 10) || 5;
      const items = Array.from(list.children);
      if (items.length <= keep) return;
      const extra = items.slice(keep);
      if (!list.id) list.id = "collapsible-" + index;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "list-toggle";
      btn.setAttribute("aria-controls", list.id);
      const label = document.createElement("span");
      btn.appendChild(label);
      btn.insertAdjacentHTML("beforeend", CHEVRON);
      list.after(btn);

      const entry = { expanded: false };
      entry.render = (animate) => {
         extra.forEach((li, i) => {
            li.hidden = !entry.expanded;
            li.classList.toggle("is-entering", entry.expanded && animate);
            li.style.setProperty("--i", i);
         });
         btn.setAttribute("aria-expanded", String(entry.expanded));
         label.textContent = entry.expanded
            ? pick({ en: "Show less", fa: "نمایش کمتر" })
            : pick({ en: "Show all " + items.length + " details", fa: "مشاهده همه " + items.length.toLocaleString("fa-IR") + " مورد" });
      };
      btn.addEventListener("click", () => {
         entry.expanded = !entry.expanded;
         entry.render(true);
      });
      entry.render(false);
      collapsibles.push(entry);
   });

   /* ------------------------------------------------------------------
      DISCLOSURES: case-study "Engineering details"
      ------------------------------------------------------------------ */
   const disclosures = Array.from(document.querySelectorAll("[data-disclosure]")).map((btn) => {
      const panel = document.getElementById(btn.getAttribute("aria-controls"));
      const labelEl = btn.querySelector(".case__toggle-label");
      const state = { open: false };
      const render = () => {
         btn.setAttribute("aria-expanded", String(state.open));
         if (panel) {
            panel.classList.toggle("is-open", state.open);
            panel.inert = !state.open;
            panel.setAttribute("aria-hidden", String(!state.open));
         }
         if (labelEl) {
            const key = (lang() === "fa" ? "data-fa-" : "data-label-") + (state.open ? "close" : "open");
            labelEl.textContent = labelEl.getAttribute(key);
         }
      };
      btn.addEventListener("click", () => {
         state.open = !state.open;
         render();
      });
      render();
      return render;
   });

   /* ------------------------------------------------------------------
      NAVIGATION: scrolled state, active section, sliding indicator,
      section-aware document title.
      ------------------------------------------------------------------ */
   const nav = document.getElementById("siteNav");
   const railList = document.querySelector(".nav__links ul");
   const navLinks = Array.from(document.querySelectorAll("[data-nav]"));
   let indicator = null;
   let activeId = null;

   if (railList) {
      indicator = document.createElement("li");
      indicator.className = "nav__indicator";
      indicator.setAttribute("aria-hidden", "true");
      railList.prepend(indicator);
   }

   function placeIndicator() {
      if (!indicator) return;
      const link = railList.querySelector('a[data-nav="' + activeId + '"]');
      if (!link || !link.offsetParent) {
         indicator.classList.remove("is-on");
         return;
      }
      indicator.style.setProperty("--x", link.parentElement.offsetLeft + "px");
      indicator.style.setProperty("--w", link.parentElement.offsetWidth + "px");
      indicator.classList.add("is-on");
   }

   const TITLES = {
      about: { en: "About", fa: "درباره من" },
      skills: { en: "Skills", fa: "مهارت‌ها" },
      architecture: { en: "Architecture", fa: "معماری" },
      experience: { en: "Experience", fa: "سوابق کاری" },
      teaching: { en: "Teaching", fa: "آموزش" },
      projects: { en: "Open-Source Projects", fa: "پروژه‌های متن‌باز" },
      certificates: { en: "Education & Certificates", fa: "تحصیلات و گواهینامه‌ها" },
      contact: { en: "Contact", fa: "تماس" },
   };

   function updateTitle() {
      const name = pick({ en: "Ali Chavoshi", fa: "علی چاوشی" });
      const label = TITLES[activeId];
      document.title = label
         ? name + " | " + pick(label)
         : name + " | " + pick({ en: "Senior Full-Stack Developer & Software Architect", fa: "توسعه‌دهنده ارشد و معمار نرم‌افزار" });
   }

   function setActive(id) {
      if (id === activeId) return;
      activeId = id;
      navLinks.forEach((link) => {
         const on = link.getAttribute("data-nav") === id;
         link.classList.toggle("is-active", on);
         if (on && link.closest(".nav__links, .menu")) link.setAttribute("aria-current", "location");
         else link.removeAttribute("aria-current");
      });
      placeIndicator();
      updateTitle();
   }

   if ("IntersectionObserver" in window) {
      // Scrolled state: a 1px sentinel at the very top of the document.
      const sentinel = document.createElement("div");
      sentinel.setAttribute("aria-hidden", "true");
      sentinel.style.cssText = "position:absolute;top:0;left:0;width:1px;height:24px;pointer-events:none";
      document.body.prepend(sentinel);
      new IntersectionObserver(([entry]) => {
         nav && nav.classList.toggle("is-scrolled", !entry.isIntersecting);
      }).observe(sentinel);

      // Active section: whichever section crosses the middle band of the viewport.
      const targets = [];
      const seen = new Set();
      navLinks.forEach((link) => {
         const id = link.getAttribute("data-nav");
         const el = document.getElementById(id);
         if (el && !seen.has(id)) {
            seen.add(id);
            targets.push(el);
         }
      });
      const hero = document.getElementById("hero-intro");
      if (hero) targets.push(hero);
      const sectionObserver = new IntersectionObserver(
         (entries) => {
            entries.forEach((entry) => {
               if (entry.isIntersecting) setActive(entry.target.id === "hero-intro" ? null : entry.target.id);
            });
         },
         { rootMargin: "-45% 0px -50% 0px" },
      );
      targets.forEach((el) => sectionObserver.observe(el));
   }

   window.addEventListener("resize", placeIndicator, { passive: true });
   if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeIndicator);

   /* ------------------------------------------------------------------
      MOBILE MENU
      ------------------------------------------------------------------ */
   const menuBtn = document.getElementById("navToggle");
   const menu = document.getElementById("mobileMenu");
   const inertWhenMenu = [document.getElementById("main"), document.querySelector(".footer"), document.querySelector(".skip-link")].filter(Boolean);

   function setMenu(open, restoreFocus) {
      if (!menuBtn || !menu) return;
      menu.hidden = !open;
      root.classList.toggle("menu-open", open);
      menuBtn.setAttribute("aria-expanded", String(open));
      menuBtn.setAttribute("aria-label", open ? pick({ en: "Close menu", fa: "بستن منو" }) : pick({ en: "Open menu", fa: "باز کردن منو" }));
      inertWhenMenu.forEach((el) => (el.inert = open));
      if (open) {
         const first = menu.querySelector("a");
         if (first) first.focus({ preventScroll: true });
      } else if (restoreFocus) {
         menuBtn.focus();
      }
   }

   if (menuBtn && menu) {
      menuBtn.addEventListener("click", () => setMenu(menuBtn.getAttribute("aria-expanded") !== "true"));
      menu.addEventListener("click", (e) => {
         if (e.target.closest("a")) setMenu(false);
      });
      document.addEventListener("keydown", (e) => {
         if (e.key === "Escape" && menuBtn.getAttribute("aria-expanded") === "true") setMenu(false, true);
      });
      window.matchMedia("(min-width: 1200px)").addEventListener("change", (e) => {
         if (e.matches) setMenu(false);
      });
   }

   /* ------------------------------------------------------------------
      CONTACT FORM (Formspree)
      ------------------------------------------------------------------ */
   (function contactForm() {
      const form = document.getElementById("contactForm");
      if (!form) return;
      const submit = document.getElementById("cfSubmit");
      const success = document.getElementById("cfSuccess");
      const failure = document.getElementById("cfError");
      const fields = Array.from(form.querySelectorAll("input[required], textarea[required]"));
      const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

      const isValid = (el) => {
         const value = el.value.trim();
         if (!value) return false;
         return el.type === "email" ? EMAIL.test(value) : true;
      };

      const mark = (el, ok) => {
         const err = document.getElementById(el.getAttribute("aria-describedby"));
         if (ok) el.removeAttribute("aria-invalid");
         else el.setAttribute("aria-invalid", "true");
         if (err) err.hidden = ok;
      };

      fields.forEach((el) => {
         el.addEventListener("input", () => {
            if (el.getAttribute("aria-invalid") === "true" && isValid(el)) mark(el, true);
         });
         el.addEventListener("blur", () => {
            if (el.getAttribute("aria-invalid") === "true") mark(el, isValid(el));
         });
      });

      form.addEventListener("submit", (e) => {
         e.preventDefault();
         success.hidden = true;
         failure.hidden = true;

         let firstInvalid = null;
         fields.forEach((el) => {
            const ok = isValid(el);
            mark(el, ok);
            if (!ok && !firstInvalid) firstInvalid = el;
         });
         if (firstInvalid) {
            firstInvalid.focus();
            return;
         }

         // Bots fill the hidden field; pretend it went through.
         const trap = form.querySelector('[name="_gotcha"]');
         if (trap && trap.value) {
            form.reset();
            success.hidden = false;
            return;
         }

         form.classList.add("is-loading");
         submit.disabled = true;
         submit.setAttribute("aria-busy", "true");

         const controller = "AbortController" in window ? new AbortController() : null;
         const timer = controller ? window.setTimeout(() => controller.abort(), 15000) : 0;

         fetch(form.action, {
            method: "POST",
            body: new FormData(form),
            headers: { Accept: "application/json" },
            signal: controller ? controller.signal : undefined,
         })
            .then((res) => {
               if (!res.ok) throw new Error("HTTP " + res.status);
               form.reset();
               success.hidden = false;
               success.scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth", block: "nearest" });
            })
            .catch(() => {
               failure.hidden = false;
            })
            .finally(() => {
               window.clearTimeout(timer);
               form.classList.remove("is-loading");
               submit.disabled = false;
               submit.removeAttribute("aria-busy");
            });
      });
   })();

   /* ------------------------------------------------------------------
      COPY EMAIL
      ------------------------------------------------------------------ */
   (function copyEmail() {
      const btn = document.getElementById("copyEmail");
      const status = document.getElementById("copyStatus");
      if (!btn) return;
      let timer = 0;

      const fallbackCopy = (text) => {
         const ta = document.createElement("textarea");
         ta.value = text;
         ta.setAttribute("readonly", "");
         ta.style.cssText = "position:fixed;opacity:0;pointer-events:none";
         document.body.appendChild(ta);
         ta.select();
         let ok = false;
         try {
            ok = document.execCommand("copy");
         } catch (e) {
            ok = false;
         }
         ta.remove();
         return ok ? Promise.resolve() : Promise.reject();
      };

      btn.addEventListener("click", () => {
         const text = btn.getAttribute("data-copy");
         const attempt = navigator.clipboard && window.isSecureContext ? navigator.clipboard.writeText(text) : fallbackCopy(text);
         attempt
            .then(() => {
               btn.classList.add("is-copied");
               if (status) status.textContent = pick({ en: "Email address copied", fa: "آدرس ایمیل کپی شد" });
               window.clearTimeout(timer);
               timer = window.setTimeout(() => {
                  btn.classList.remove("is-copied");
                  if (status) status.textContent = "";
               }, 2000);
            })
            .catch(() => {
               if (status) status.textContent = pick({ en: "Copy failed. The address is " + text, fa: "کپی انجام نشد. آدرس: " + text });
            });
      });
   })();

   /* ------------------------------------------------------------------
      CERTIFICATES: tiles with a scan become buttons that open a dialog.
      ------------------------------------------------------------------ */
   (function certificates() {
      const dialog = document.getElementById("certLightbox");
      const img = document.getElementById("certLightboxImg");
      const title = document.getElementById("certLightboxTitle");
      if (!dialog || typeof dialog.showModal !== "function") return;
      let current = null;

      const titleFor = (card) => card.getAttribute(lang() === "fa" ? "data-cert-title-fa" : "data-cert-title-en") || "";

      const open = (card) => {
         current = card;
         title.textContent = titleFor(card);
         img.src = card.getAttribute("data-cert-img");
         img.alt = titleFor(card);
         dialog.showModal();
      };

      document.querySelectorAll(".cert-card").forEach((card) => {
         const src = (card.getAttribute("data-cert-img") || "").trim();
         if (!src) return;
         const thumb = document.createElement("img");
         thumb.className = "cert-card__thumb";
         thumb.src = src;
         thumb.alt = "";
         thumb.loading = "lazy";
         thumb.decoding = "async";
         thumb.addEventListener("error", () => {
            thumb.remove();
            card.classList.remove("has-image");
            card.removeAttribute("role");
            card.removeAttribute("tabindex");
         });
         card.prepend(thumb);
         card.classList.add("has-image");
         card.setAttribute("role", "button");
         card.setAttribute("tabindex", "0");
         card.setAttribute("aria-haspopup", "dialog");
         card.addEventListener("click", () => card.classList.contains("has-image") && open(card));
         card.addEventListener("keydown", (e) => {
            if ((e.key === "Enter" || e.key === " ") && card.classList.contains("has-image")) {
               e.preventDefault();
               open(card);
            }
         });
      });

      dialog.querySelectorAll("[data-close-lightbox]").forEach((btn) => btn.addEventListener("click", () => dialog.close()));
      dialog.addEventListener("click", (e) => {
         if (e.target === dialog) dialog.close();
      });
      dialog.addEventListener("close", () => {
         img.removeAttribute("src");
      });
      document.addEventListener("site:langchange", () => {
         if (dialog.open && current) {
            title.textContent = titleFor(current);
            img.alt = titleFor(current);
         }
      });
   })();

   /* ------------------------------------------------------------------
      Boot: language last, so every module above re-labels itself.
      ------------------------------------------------------------------ */
   document.addEventListener("site:langchange", () => {
      collapsibles.forEach((entry) => entry.render(false));
      disclosures.forEach((render) => render());
      if (menuBtn) menuBtn.setAttribute("aria-label", menuBtn.getAttribute("aria-expanded") === "true" ? pick({ en: "Close menu", fa: "بستن منو" }) : pick({ en: "Open menu", fa: "باز کردن منو" }));
      updateTitle();
      window.requestAnimationFrame(placeIndicator);
   });

   if (langToggle) {
      langToggle.addEventListener("click", () => applyLang(lang() === "fa" ? "en" : "fa"));
   }

   applyLang(initialLang());
   syncThemeLabels();
})();
