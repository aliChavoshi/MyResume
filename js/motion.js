/* ==========================================================================
   Motion system: entrance reveals, in-view gating for looping diagrams,
   the hero headline, counters, timeline progress and cursor spotlights.
   All effects are skipped when the visitor prefers reduced motion; the CSS
   base styles are already the finished, static state.
   ========================================================================== */
(function () {
   "use strict";

   const root = document.documentElement;
   const reduceMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
   const isPrint = root.classList.contains("is-print");
   const hasIO = "IntersectionObserver" in window;
   const still = () => reduceMQ.matches || isPrint;
   const lang = () => (window.Site ? window.Site.lang() : "en");

   /* ---------------- Entrance reveals (once) ---------------- */
   const revealEls = Array.from(document.querySelectorAll("[data-reveal]"));
   const revealAll = () => revealEls.forEach((el) => el.classList.add("is-in"));

   if (still() || !hasIO) {
      revealAll();
   } else {
      const revealer = new IntersectionObserver(
         (entries) => {
            entries.forEach((entry) => {
               if (!entry.isIntersecting) return;
               entry.target.classList.add("is-in");
               revealer.unobserve(entry.target);
            });
         },
         { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
      );
      revealEls.forEach((el) => revealer.observe(el));
   }

   /* ---------------- In-view gating for loops ---------------- */
   // Looping diagrams only animate while on screen; CSS pauses the rest.
   const loopEls = Array.from(document.querySelectorAll("[data-inview]"));
   if (hasIO) {
      const watcher = new IntersectionObserver(
         (entries) => entries.forEach((entry) => entry.target.classList.toggle("is-inview", entry.isIntersecting)),
         { rootMargin: "80px 0px" },
      );
      loopEls.forEach((el) => watcher.observe(el));
   } else {
      loopEls.forEach((el) => el.classList.add("is-inview"));
   }

   /* ---------------- Hero entrance ---------------- */
   const hero = document.querySelector(".hero");
   const headline = document.querySelector(".hero__headline[data-split]");

   function splitHeadline() {
      if (!headline) return;
      const text = headline.textContent.trim().replace(/\s+/g, " ");
      const frag = document.createDocumentFragment();
      text.split(" ").forEach((word, i) => {
         if (i) frag.appendChild(document.createTextNode(" "));
         const outer = document.createElement("span");
         outer.className = "w";
         const inner = document.createElement("span");
         inner.style.setProperty("--wi", i);
         inner.textContent = word;
         outer.appendChild(inner);
         frag.appendChild(outer);
      });
      headline.textContent = "";
      headline.appendChild(frag);
      hero.classList.add("is-split");
   }

   if (hero) {
      if (!still()) splitHeadline();
      // Two frames so the hidden state is painted before the entrance runs.
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => hero.classList.add("is-ready")));
      // The language swap replaces the headline copy; split the new words
      // so they rise in again as feedback for the switch.
      document.addEventListener("site:langchange", () => {
         if (!still()) splitHeadline();
      });
   }

   /* ---------------- Counters ---------------- */
   const counters = Array.from(document.querySelectorAll(".metric__num[data-count]"));
   const formatters = {};
   const fmt = (n) => {
      const key = lang();
      if (!formatters[key]) formatters[key] = new Intl.NumberFormat(key === "fa" ? "fa-IR" : "en-US");
      return formatters[key].format(n);
   };
   const suffixOf = (el) => (lang() === "fa" && el.hasAttribute("data-fa-suffix") ? el.getAttribute("data-fa-suffix") : el.getAttribute("data-suffix") || "");
   const paint = (el, n) => {
      el.textContent = fmt(n) + suffixOf(el);
   };
   const counted = new WeakSet();

   counters.forEach((el) => paint(el, +el.getAttribute("data-count")));

   function countUp(el) {
      if (counted.has(el)) return;
      counted.add(el);
      const target = +el.getAttribute("data-count");
      const duration = 1600;
      const start = performance.now();
      const tick = (now) => {
         const p = Math.min((now - start) / duration, 1);
         const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p); // expo out
         paint(el, Math.round(eased * target));
         if (p < 1) window.requestAnimationFrame(tick);
      };
      paint(el, 0);
      window.requestAnimationFrame(tick);
   }

   if (!still() && hasIO && counters.length) {
      const counterObserver = new IntersectionObserver(
         (entries) => {
            entries.forEach((entry) => {
               if (!entry.isIntersecting) return;
               countUp(entry.target);
               counterObserver.unobserve(entry.target);
            });
         },
         { threshold: 0.6 },
      );
      counters.forEach((el) => counterObserver.observe(el));
   }

   document.addEventListener("site:langchange", () => {
      counters.forEach((el) => paint(el, +el.getAttribute("data-count")));
   });

   /* ---------------- Timeline progress ---------------- */
   (function timelineProgress() {
      const timeline = document.getElementById("timeline");
      if (!timeline) return;
      const rail = timeline.querySelector(".timeline__rail");
      const roles = Array.from(timeline.querySelectorAll(".role"));
      if (!rail) return;

      if (still() || !hasIO) {
         timeline.style.setProperty("--p", 1);
         roles.forEach((r) => r.classList.add("is-reached"));
         return;
      }

      let nodeOffsets = [];
      let railHeight = 1;
      let listening = false;
      let frame = 0;

      const measure = () => {
         railHeight = rail.offsetHeight || 1;
         nodeOffsets = roles.map((r) => r.offsetTop + 12);
      };

      const update = () => {
         frame = 0;
         const rect = rail.getBoundingClientRect();
         const reading = window.innerHeight * 0.62;
         const p = Math.max(0, Math.min(1, (reading - rect.top) / railHeight));
         timeline.style.setProperty("--p", p.toFixed(4));
         const reach = p * railHeight + 10;
         roles.forEach((r, i) => r.classList.toggle("is-reached", reach >= nodeOffsets[i]));
      };

      const onScroll = () => {
         if (!frame) frame = window.requestAnimationFrame(update);
      };

      new IntersectionObserver(([entry]) => {
         if (entry.isIntersecting && !listening) {
            listening = true;
            measure();
            window.addEventListener("scroll", onScroll, { passive: true });
            update();
         } else if (!entry.isIntersecting && listening) {
            listening = false;
            window.removeEventListener("scroll", onScroll);
            update();
         }
      }).observe(timeline);

      if ("ResizeObserver" in window) {
         new ResizeObserver(() => {
            measure();
            update();
         }).observe(timeline);
      }
   })();

   /* ---------------- Cursor spotlight on cards ---------------- */
   if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      document.querySelectorAll("[data-spotlight]").forEach((el) => {
         let frame = 0;
         let x = 0;
         let y = 0;
         el.addEventListener(
            "pointermove",
            (e) => {
               const rect = el.getBoundingClientRect();
               x = e.clientX - rect.left;
               y = e.clientY - rect.top;
               if (frame) return;
               frame = window.requestAnimationFrame(() => {
                  frame = 0;
                  el.style.setProperty("--mx", x + "px");
                  el.style.setProperty("--my", y + "px");
               });
            },
            { passive: true },
         );
      });
   }

   /* ---------------- Scroll progress fallback ---------------- */
   // Browsers with CSS scroll timelines drive the bar in styles.css.
   const bar = document.getElementById("scrollProgress");
   const cssTimeline = window.CSS && CSS.supports && CSS.supports("animation-timeline: scroll()");
   if (bar && !cssTimeline) {
      let frame = 0;
      const update = () => {
         frame = 0;
         const max = document.documentElement.scrollHeight - window.innerHeight;
         bar.style.setProperty("--progress", max > 0 ? (window.scrollY / max).toFixed(4) : 0);
      };
      window.addEventListener(
         "scroll",
         () => {
            if (!frame) frame = window.requestAnimationFrame(update);
         },
         { passive: true },
      );
      update();
   }

   /* ---------------- Preference changes mid-visit ---------------- */
   reduceMQ.addEventListener("change", (e) => {
      if (e.matches) {
         revealAll();
         counters.forEach((el) => paint(el, +el.getAttribute("data-count")));
      }
   });
})();
