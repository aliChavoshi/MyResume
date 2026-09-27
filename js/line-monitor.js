/* ==========================================================================
   Line monitor: the Iskra production-line monitoring and Andon story.
   One 13s "shift": the line runs (output grows, station stock is consumed,
   the press counts mold strikes), station 3 raises an Andon stop (line
   halts, downtime grows, an SMS alert goes out), the line resumes (stock is
   refilled from the depot) and one defective part is rejected at station 4
   while waste stays under its allowed limit.
   Runs only while on screen; reduced motion shows the Andon moment still.
   ========================================================================== */
(function () {
   "use strict";

   const fig = document.getElementById("lineMonitor");
   if (!fig || document.documentElement.classList.contains("is-print")) return;

   const reduceMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
   const fills = {};
   fig.querySelectorAll("[data-kpi]").forEach((el) => (fills[el.getAttribute("data-kpi")] = el));

   const state = { output: 0.3, downtime: 0.08, waste: 0.12, stock: 0.84, mold: 0.2 };

   function set(key, value, ms) {
      state[key] = Math.max(0, Math.min(1, value));
      if (key === "mold") {
         fig.style.setProperty("--mold", state.mold.toFixed(3));
         return;
      }
      const el = fills[key];
      if (!el) return;
      el.style.transitionDuration = (ms || 900) + "ms";
      el.style.setProperty("--v", state[key].toFixed(3));
   }

   let timers = [];
   let running = false;
   const later = (fn, ms) => timers.push(window.setTimeout(fn, ms));
   const clearAll = () => {
      timers.forEach(window.clearTimeout);
      timers = [];
   };

   // A running stretch: each tick is one press strike worth of production.
   function run(ticks, done) {
      let i = 0;
      const step = () => {
         if (i++ >= ticks) return done();
         set("output", Math.min(0.92, state.output + 0.07), 1000);
         set("stock", Math.max(0.28, state.stock - 0.08), 1000);
         set("mold", state.mold + 0.03 > 1 ? 0.05 : state.mold + 0.03);
         later(step, 1000);
      };
      step();
   }

   function shift() {
      clearAll();
      fig.classList.remove("is-stopped", "is-alert", "is-defect");
      set("output", 0.3, 700);
      set("downtime", 0.08, 700);
      set("waste", 0.12, 700);
      set("stock", 0.84, 700);

      run(5, () => {
         // Andon: station 3 stops the line and the alert goes out
         fig.classList.add("is-stopped");
         set("downtime", 0.36, 3200);
         later(() => fig.classList.add("is-alert"), 500);

         later(() => {
            fig.classList.remove("is-stopped");
            later(() => fig.classList.remove("is-alert"), 1400);
            set("stock", 0.86, 1400); // depot refills the stations

            later(() => {
               fig.classList.add("is-defect");
               later(() => set("waste", 0.2, 600), 1000);
               later(() => fig.classList.remove("is-defect"), 1900);
            }, 1500);

            run(4, () => later(shift, 1200));
         }, 3400);
      });
   }

   function start() {
      if (running || reduceMQ.matches) return;
      running = true;
      shift();
   }

   function stop() {
      running = false;
      clearAll();
   }

   function still() {
      stop();
      fig.classList.remove("is-defect");
      fig.classList.add("is-stopped", "is-alert");
      set("output", 0.66);
      set("downtime", 0.3);
      set("waste", 0.2);
      set("stock", 0.52);
      set("mold", 0.62);
   }

   let visible = false;
   const update = () => {
      if (reduceMQ.matches) return still();
      if (visible && !document.hidden) start();
      else stop();
   };

   if ("IntersectionObserver" in window) {
      new IntersectionObserver(([entry]) => {
         visible = entry.isIntersecting;
         update();
      }).observe(fig);
   } else {
      visible = true;
   }
   document.addEventListener("visibilitychange", update);
   reduceMQ.addEventListener("change", update);
   update();
})();
