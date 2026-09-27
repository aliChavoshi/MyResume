/* ==========================================================================
   Request journey: the Ecommerce-Microservice case study diagram.
   Pick a scenario (tabs) and a packet walks the real route through the
   gateway, services, gRPC call, RabbitMQ event and databases while the
   matching step is highlighted. Loops while on screen; reduced motion shows
   the whole route statically.
   ========================================================================== */
(function () {
   "use strict";

   const wrap = document.getElementById("journey");
   const svg = document.getElementById("journeyMap");
   if (!wrap || !svg || document.documentElement.classList.contains("is-print")) return;

   const packet = document.getElementById("journeyPacket");
   const stepsEl = document.getElementById("journeySteps");
   const panel = document.getElementById("journeyPanel");
   const replay = document.getElementById("journeyReplay");
   const canvasWrap = wrap.querySelector(".journey__canvas");
   const tabs = Array.from(wrap.querySelectorAll('[role="tab"]'));
   const reduceMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
   const lang = () => (window.Site ? window.Site.lang() : "en");

   const SPEED = 250; // viewBox units per second
   const DWELL = 520; // pause between steps, ms
   const LOOP_PAUSE = 2200;

   // [edgeId, reverse?]
   const SCENARIOS = {
      catalog: [
         {
            legs: [["client-gateway"]],
            nodes: ["client", "gateway"],
            en: "The Angular client requests the product list.",
            fa: "کلاینت Angular فهرست محصولات را درخواست می‌کند.",
         },
         {
            legs: [["gateway-catalog"]],
            nodes: ["catalog"],
            en: "Ocelot routes the request to Catalog.API.",
            fa: "Ocelot درخواست را به Catalog.API هدایت می‌کند.",
         },
         {
            legs: [["catalog-mongodb"]],
            nodes: ["mongodb"],
            en: "Catalog.API reads the products from MongoDB.",
            fa: "Catalog.API محصولات را از MongoDB می‌خواند.",
         },
         {
            legs: [["catalog-mongodb", true], ["gateway-catalog", true], ["client-gateway", true]],
            nodes: ["client"],
            en: "The response returns to the client through the gateway.",
            fa: "پاسخ از طریق Gateway به کلاینت برمی‌گردد.",
         },
      ],
      signin: [
         {
            legs: [["client-gateway"], ["gateway-identity"]],
            nodes: ["client", "gateway", "identity"],
            en: "The sign-in request reaches Identity Server through the gateway.",
            fa: "درخواست ورود از طریق Gateway به Identity Server می‌رسد.",
         },
         {
            legs: [],
            hold: 900,
            nodes: ["identity"],
            en: "Identity Server authenticates the user and issues a JWT access token.",
            fa: "Identity Server کاربر را احراز هویت می‌کند و توکن JWT صادر می‌کند.",
         },
         {
            legs: [["gateway-identity", true], ["client-gateway", true]],
            nodes: ["gateway", "client"],
            en: "The token returns to the client and travels with every API call.",
            fa: "توکن به کلاینت برمی‌گردد و همراه هر درخواست API ارسال می‌شود.",
         },
      ],
      discount: [
         {
            legs: [["client-gateway"], ["gateway-basket"]],
            nodes: ["client", "gateway", "basket"],
            en: "The client updates the basket through the gateway.",
            fa: "کلاینت سبد خرید را از طریق Gateway به‌روزرسانی می‌کند.",
         },
         {
            legs: [["basket-discount"]],
            nodes: ["discount"],
            en: "Basket.API asks Discount.API for the coupon over gRPC.",
            fa: "Basket.API کد تخفیف را از طریق gRPC از Discount.API می‌پرسد.",
         },
         {
            legs: [["discount-postgres"], ["discount-postgres", true], ["basket-discount", true]],
            nodes: ["postgres", "discount", "basket"],
            en: "Discount.API reads the coupon from PostgreSQL and replies.",
            fa: "Discount.API کد تخفیف را از PostgreSQL می‌خواند و پاسخ می‌دهد.",
         },
         {
            legs: [["basket-redis"]],
            nodes: ["redis"],
            en: "The discounted basket is stored in Redis.",
            fa: "سبد خرید با تخفیف در Redis ذخیره می‌شود.",
         },
      ],
      checkout: [
         {
            legs: [["client-gateway"], ["gateway-basket"]],
            nodes: ["client", "gateway", "basket"],
            en: "The client submits the checkout to Basket.API.",
            fa: "کلاینت درخواست ثبت سفارش را به Basket.API می‌فرستد.",
         },
         {
            legs: [["basket-redis"], ["basket-redis", true]],
            nodes: ["redis", "basket"],
            en: "Basket.API clears the basket from Redis.",
            fa: "Basket.API سبد خرید را از Redis پاک می‌کند.",
         },
         {
            legs: [["basket-rabbitmq"]],
            nodes: ["rabbitmq"],
            en: "Basket.API publishes a checkout event to RabbitMQ.",
            fa: "Basket.API رویداد ثبت سفارش را در RabbitMQ منتشر می‌کند.",
         },
         {
            legs: [["rabbitmq-ordering"]],
            nodes: ["ordering"],
            en: "Ordering.API consumes the event asynchronously.",
            fa: "Ordering.API رویداد را به‌صورت ناهمگام دریافت می‌کند.",
         },
         {
            legs: [["ordering-sqlserver"]],
            nodes: ["sqlserver"],
            en: "The order is persisted in SQL Server.",
            fa: "سفارش در SQL Server ذخیره می‌شود.",
         },
      ],
   };

   const edgeEl = (id) => svg.getElementById ? svg.getElementById("je-" + id) : document.getElementById("je-" + id);
   const nodeEl = (id) => svg.querySelector('[data-node="' + id + '"]');
   const lengths = {};
   const lengthOf = (id) => {
      if (!(id in lengths)) {
         const el = edgeEl(id);
         lengths[id] = el ? el.getTotalLength() : 0;
      }
      return lengths[id];
   };

   let current = "catalog";
   let stepIndex = -1;
   let token = 0; // invalidates in-flight animations when the scenario changes
   let visible = false;
   let pausedAt = null; // resume point when the diagram scrolls away
   let userScrolledAt = 0;

   /* ---------------- rendering ---------------- */
   function renderSteps() {
      const steps = SCENARIOS[current];
      stepsEl.textContent = "";
      steps.forEach((step, i) => {
         const li = document.createElement("li");
         li.textContent = step[lang()];
         if (i < stepIndex) li.classList.add("is-done");
         if (i === stepIndex) li.classList.add("is-current");
         stepsEl.appendChild(li);
      });
   }

   function markSteps() {
      Array.from(stepsEl.children).forEach((li, i) => {
         li.classList.toggle("is-done", i < stepIndex);
         li.classList.toggle("is-current", i === stepIndex);
      });
   }

   function clearMap() {
      svg.querySelectorAll(".je").forEach((el) => el.classList.remove("is-active", "is-visited"));
      svg.querySelectorAll(".jn").forEach((el) => el.classList.remove("is-on", "is-current"));
   }

   function showWholeRoute() {
      clearMap();
      SCENARIOS[current].forEach((step) => {
         step.legs.forEach(([id]) => {
            const el = edgeEl(id);
            if (el) el.classList.add("is-visited");
         });
         step.nodes.forEach((id) => {
            const el = nodeEl(id);
            if (el) el.classList.add("is-on");
         });
      });
      svg.classList.remove("is-running");
      stepIndex = SCENARIOS[current].length;
      markSteps();
   }

   function followNode(id) {
      if (!canvasWrap || canvasWrap.scrollWidth <= canvasWrap.clientWidth + 4) return;
      if (Date.now() - userScrolledAt < 4000) return;
      const el = nodeEl(id);
      if (!el) return;
      // getCTM already includes the viewBox scaling, so this is in CSS px.
      const box = el.getBBox();
      const ctm = el.getCTM();
      if (!ctm) return;
      const x = ctm.e + (box.x + box.width / 2) * ctm.a;
      canvasWrap.scrollTo({ left: Math.max(0, x - canvasWrap.clientWidth / 2), behavior: "smooth" });
   }

   /* ---------------- animation ---------------- */
   const wait = (ms, t) =>
      new Promise((resolve) => {
         window.setTimeout(() => resolve(t === token), ms);
      });

   function animateLeg(id, reverse, t) {
      const path = edgeEl(id);
      const len = lengthOf(id);
      if (!path || !len) return Promise.resolve(t === token);
      const duration = Math.max(260, (len / SPEED) * 1000);
      path.classList.add("is-active");
      return new Promise((resolve) => {
         const start = performance.now();
         const tick = (now) => {
            if (t !== token) return resolve(false);
            if (!visible) {
               // hold position; resume from the same leg when back on screen
               pausedAt = { resume: () => window.requestAnimationFrame(tick) };
               return;
            }
            const p = Math.min(1, (now - start) / duration);
            const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
            const pt = path.getPointAtLength((reverse ? 1 - eased : eased) * len);
            packet.setAttribute("cx", pt.x.toFixed(1));
            packet.setAttribute("cy", pt.y.toFixed(1));
            if (p < 1) window.requestAnimationFrame(tick);
            else {
               path.classList.remove("is-active");
               path.classList.add("is-visited");
               resolve(true);
            }
         };
         window.requestAnimationFrame(tick);
      });
   }

   async function play() {
      const t = ++token;
      clearMap();
      stepIndex = -1;
      markSteps();
      svg.classList.add("is-running");
      const steps = SCENARIOS[current];

      for (let i = 0; i < steps.length; i++) {
         stepIndex = i;
         markSteps();
         svg.querySelectorAll(".jn.is-current").forEach((el) => el.classList.remove("is-current"));
         steps[i].nodes.forEach((id) => {
            const el = nodeEl(id);
            if (el) el.classList.add("is-on", "is-current");
         });
         if (steps[i].nodes.length) followNode(steps[i].nodes[steps[i].nodes.length - 1]);
         for (const [id, reverse] of steps[i].legs) {
            if (!(await animateLeg(id, reverse, t))) return;
         }
         if (!(await wait(steps[i].hold || DWELL, t))) return;
      }
      stepIndex = steps.length;
      markSteps();
      svg.querySelectorAll(".jn.is-current").forEach((el) => el.classList.remove("is-current"));
      if (!(await wait(LOOP_PAUSE, t))) return;
      if (visible && t === token) play();
      else if (t === token) pausedAt = { resume: play };
   }

   function select(name, focus) {
      if (!SCENARIOS[name]) return;
      current = name;
      tabs.forEach((tab) => {
         const on = tab.getAttribute("data-scenario") === name;
         tab.setAttribute("aria-selected", String(on));
         tab.tabIndex = on ? 0 : -1;
         if (on) {
            panel.setAttribute("aria-labelledby", tab.id);
            if (focus) tab.focus();
         }
      });
      token++;
      pausedAt = null;
      stepIndex = -1;
      renderSteps();
      if (reduceMQ.matches) showWholeRoute();
      else if (visible) play();
      else {
         clearMap();
         pausedAt = { resume: play };
      }
   }

   /* ---------------- wiring ---------------- */
   tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => select(tab.getAttribute("data-scenario")));
      tab.addEventListener("keydown", (e) => {
         const rtl = document.documentElement.getAttribute("dir") === "rtl";
         const nextKey = rtl ? "ArrowLeft" : "ArrowRight";
         const prevKey = rtl ? "ArrowRight" : "ArrowLeft";
         let target = null;
         if (e.key === nextKey) target = tabs[(i + 1) % tabs.length];
         else if (e.key === prevKey) target = tabs[(i - 1 + tabs.length) % tabs.length];
         else if (e.key === "Home") target = tabs[0];
         else if (e.key === "End") target = tabs[tabs.length - 1];
         if (target) {
            e.preventDefault();
            select(target.getAttribute("data-scenario"), true);
         }
      });
   });

   if (replay) {
      replay.addEventListener("click", () => {
         if (reduceMQ.matches) showWholeRoute();
         else {
            pausedAt = null;
            play();
         }
      });
   }

   if (canvasWrap) {
      const note = () => (userScrolledAt = Date.now());
      canvasWrap.addEventListener("pointerdown", note, { passive: true });
      canvasWrap.addEventListener("wheel", note, { passive: true });
      canvasWrap.addEventListener("touchstart", note, { passive: true });
   }

   document.addEventListener("site:langchange", renderSteps);
   reduceMQ.addEventListener("change", () => {
      token++;
      if (reduceMQ.matches) showWholeRoute();
      else if (visible) play();
   });

   renderSteps();

   if (reduceMQ.matches || !("IntersectionObserver" in window)) {
      visible = true;
      showWholeRoute();
      return;
   }

   pausedAt = { resume: play };
   new IntersectionObserver(
      ([entry]) => {
         visible = entry.isIntersecting;
         if (visible && pausedAt) {
            const next = pausedAt;
            pausedAt = null;
            next.resume();
         }
      },
      { threshold: 0.35 },
   ).observe(svg);
})();
