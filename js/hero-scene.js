/* ==========================================================================
   Hero scene: a live, three-layer model of the Ecommerce-Microservice
   architecture (Angular client / ASP.NET Core services / data + messaging).
   Rendered on a 2D canvas with a small orthographic projection, so it costs
   no 3D library. Requests, gRPC calls and RabbitMQ events travel the real
   routes of the project; the camera leans toward the cursor.

   Performance: the loop runs only while the canvas is on screen and the
   tab is visible. Reduced motion renders one still frame.
   ========================================================================== */
(function () {
   "use strict";

   const canvas = document.getElementById("heroScene");
   const root = document.documentElement;
   if (!canvas || !canvas.getContext || root.classList.contains("is-print")) return;

   const ctx = canvas.getContext("2d");
   const reduceMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
   const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
   const lang = () => (window.Site ? window.Site.lang() : "en");

   /* ---------------- World model ---------------- */
   const Z_CLIENT = 1.5;
   const Z_SERVICES = 0;
   const Z_DATA = -1.5;

   const PLANES = [
      { id: "data", z: Z_DATA, cx: 0, cy: 0, w: 1.55, d: 1.0, label: { en: "DATA · MESSAGING", fa: "داده و پیام‌رسانی" } },
      { id: "services", z: Z_SERVICES, cx: 0, cy: 0, w: 1.55, d: 1.0, label: { en: "SERVICES · KUBERNETES", fa: "سرویس‌ها · Kubernetes" } },
      { id: "client", z: Z_CLIENT, cx: 0, cy: 0.45, w: 0.82, d: 0.46, label: { en: "CLIENT", fa: "کلاینت" } },
   ];

   // kind: box (service), db (cylinder), edge (gateway), app (client)
   const NODES = {
      spa: { x: 0, y: 0.72, z: Z_CLIENT, kind: "app", label: "Angular" },
      gateway: { x: 0, y: 0.72, z: Z_SERVICES, kind: "edge", label: "Ocelot gateway" },
      identity: { x: -1.12, y: 0.72, z: Z_SERVICES, kind: "box", label: "Identity Server" },
      elk: { x: 1.12, y: 0.72, z: Z_SERVICES, kind: "box", label: "Elasticsearch" },
      catalog: { x: -1.12, y: -0.3, z: Z_SERVICES, kind: "box", label: "Catalog" },
      basket: { x: -0.37, y: -0.3, z: Z_SERVICES, kind: "box", label: "Basket" },
      discount: { x: 0.37, y: -0.3, z: Z_SERVICES, kind: "box", label: "Discount" },
      ordering: { x: 1.12, y: -0.3, z: Z_SERVICES, kind: "box", label: "Ordering" },
      mongodb: { x: -1.12, y: -0.3, z: Z_DATA, kind: "db", label: "MongoDB" },
      redis: { x: -0.37, y: -0.3, z: Z_DATA, kind: "db", label: "Redis" },
      postgres: { x: 0.37, y: -0.3, z: Z_DATA, kind: "db", label: "PostgreSQL" },
      sqlserver: { x: 1.12, y: -0.3, z: Z_DATA, kind: "db", label: "SQL Server" },
   };
   Object.keys(NODES).forEach((k) => {
      NODES[k].id = k;
      NODES[k].pulse = 0;
   });

   const P = (x, y, z) => ({ x, y, z });
   const N = (id) => NODES[id];
   const TRUNK_Y = 0.2;
   const BUS_Y = -0.88;

   // Static wiring, drawn per plane. Each entry is a polyline.
   const WIRES = {
      services: [
         { pts: [P(0, 0.72, 0), P(-1.12, 0.72, 0)] },
         { pts: [P(0, 0.72, 0), P(0, TRUNK_Y, 0)] },
         { pts: [P(-1.12, TRUNK_Y, 0), P(1.12, TRUNK_Y, 0)] },
         { pts: [P(-1.12, TRUNK_Y, 0), P(-1.12, -0.3, 0)] },
         { pts: [P(-0.37, TRUNK_Y, 0), P(-0.37, -0.3, 0)] },
         { pts: [P(1.12, TRUNK_Y, 0), P(1.12, -0.3, 0)] },
         { pts: [P(1.12, TRUNK_Y, 0), P(1.12, 0.72, 0)], faint: true },
         { pts: [P(-0.37, -0.3, 0), P(0.37, -0.3, 0)], dash: [4, 4] },
         { pts: [P(-0.37, -0.3, 0), P(-0.37, BUS_Y, 0)], dash: [2, 4] },
         { pts: [P(1.12, -0.3, 0), P(1.12, BUS_Y, 0)], dash: [2, 4] },
         { pts: [P(-1.36, BUS_Y, 0), P(1.36, BUS_Y, 0)], bus: true },
      ],
      // vertical links between layers
      drops: [
         { pts: [P(-1.12, -0.3, 0), P(-1.12, -0.3, Z_DATA)] },
         { pts: [P(-0.37, -0.3, 0), P(-0.37, -0.3, Z_DATA)] },
         { pts: [P(0.37, -0.3, 0), P(0.37, -0.3, Z_DATA)] },
         { pts: [P(1.12, -0.3, 0), P(1.12, -0.3, Z_DATA)] },
      ],
      rise: [{ pts: [P(0, 0.72, 0), P(0, 0.72, Z_CLIENT)] }],
   };

   const at = (n) => P(n.x, n.y, n.z);
   const ROUTES = {
      catalog: [N("spa"), N("gateway"), P(0, TRUNK_Y, 0), P(-1.12, TRUNK_Y, 0), N("catalog"), N("mongodb")],
      basket: [N("spa"), N("gateway"), P(0, TRUNK_Y, 0), P(-0.37, TRUNK_Y, 0), N("basket"), N("redis")],
      grpc: [N("basket"), N("discount"), N("postgres")],
      auth: [N("spa"), N("gateway"), N("identity")],
      checkout: [N("spa"), N("gateway"), P(0, TRUNK_Y, 0), P(-0.37, TRUNK_Y, 0), N("basket")],
      event: [N("basket"), P(-0.37, BUS_Y, 0), P(1.12, BUS_Y, 0), N("ordering"), N("sqlserver")],
      logs: [N("ordering"), P(1.12, TRUNK_Y, 0), N("elk")],
   };

   /* ---------------- Theme colours ---------------- */
   let C = {};
   const hexToRgb = (hex) => {
      const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex.trim());
      return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [79, 209, 165];
   };
   function readColors() {
      const cs = getComputedStyle(root);
      const v = (name) => cs.getPropertyValue(name).trim();
      C = {
         plane: v("--scene-plane"),
         edge: v("--scene-plane-edge"),
         grid: v("--scene-grid"),
         wire: v("--scene-wire"),
         node: v("--scene-node"),
         ink: v("--scene-ink"),
         label: v("--scene-label"),
         bg: v("--bg"),
         accent: v("--accent"),
         accentRgb: hexToRgb(v("--accent")),
         glow: v("--scene-glow") === "1",
      };
      makeSprite();
   }

   let sprite = null;
   function makeSprite() {
      sprite = document.createElement("canvas");
      sprite.width = sprite.height = 64;
      const s = sprite.getContext("2d");
      const [r, g, b] = C.accentRgb;
      const grad = s.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, `rgba(${r},${g},${b},${C.glow ? 0.9 : 0.55})`);
      grad.addColorStop(0.25, `rgba(${r},${g},${b},${C.glow ? 0.35 : 0.2})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      s.fillStyle = grad;
      s.fillRect(0, 0, 64, 64);
   }

   /* ---------------- Camera & projection ---------------- */
   const BASE_YAW = -0.42;
   const BASE_ELEV = 0.5;
   const K = 0.95;
   const cam = { yaw: BASE_YAW, elev: BASE_ELEV, tYaw: BASE_YAW, tElev: BASE_ELEV };
   let W = 0;
   let H = 0;
   let S = 1;
   let OX = 0;
   let OY = 0;
   let cY = 1;
   let sY = 0;
   let cE = 1;
   let sE = 0;

   function setCamera() {
      cY = Math.cos(cam.yaw);
      sY = Math.sin(cam.yaw);
      cE = Math.cos(cam.elev);
      sE = Math.sin(cam.elev);
   }

   // returns [screenX, screenY]
   function proj(p, dz) {
      const xr = p.x * cY - p.y * sY;
      const yr = p.x * sY + p.y * cY;
      return [OX + xr * S, OY + (yr * sE - (p.z + (dz || 0)) * cE * K) * S];
   }

   function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, rect.width);
      H = Math.max(1, rect.height);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      S = Math.min(W / 4.3, H / 3.95);
      OX = W / 2;
      OY = H / 2 - 0.27 * S;
   }

   /* ---------------- Packets ---------------- */
   const packets = [];

   function makePath(points, reverse) {
      const pts = points.map((p) => P(p.x, p.y, p.z));
      if (reverse) pts.reverse();
      const lens = [];
      let total = 0;
      for (let i = 1; i < pts.length; i++) {
         const a = pts[i - 1];
         const b = pts[i];
         const l = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
         lens.push(l);
         total += l;
      }
      const stops = points.map((p) => (p.id ? p : null));
      if (reverse) stops.reverse();
      return { pts, lens, total, stops };
   }

   function pointAt(path, d) {
      d = Math.max(0, Math.min(path.total, d));
      let i = 0;
      while (i < path.lens.length - 1 && d > path.lens[i]) {
         d -= path.lens[i];
         i++;
      }
      const a = path.pts[i];
      const b = path.pts[i + 1];
      const t = path.lens[i] ? d / path.lens[i] : 0;
      return P(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
   }

   function spawn(points, opts, then) {
      const path = makePath(points, opts && opts.reverse);
      packets.push({
         path,
         d: 0,
         speed: (opts && opts.speed) || 1.55,
         kind: (opts && opts.kind) || "req",
         nextStop: 1,
         then,
      });
      const first = path.stops[0];
      if (first) first.pulse = 1;
   }

   // A request goes out, then its response comes back along the same wire.
   function roundTrip(route, opts, then) {
      spawn(route, opts, () => spawn(route, { reverse: true, kind: "res", speed: 1.9 }, then));
   }

   const SCENARIOS = [
      () => roundTrip(ROUTES.catalog),
      () => roundTrip(ROUTES.basket, null, () => roundTrip(ROUTES.grpc, { kind: "grpc", speed: 1.4 })),
      () => roundTrip(ROUTES.auth),
      () => spawn(ROUTES.checkout, null, () => spawn(ROUTES.event, { kind: "event", speed: 1.15 }, () => spawn(ROUTES.logs, { kind: "res", speed: 1.3 }))),
      () => roundTrip(ROUTES.catalog),
      () => roundTrip(ROUTES.basket),
   ];
   let scenarioIndex = 0;
   let nextSpawn = 0.6;

   function stepPackets(dt) {
      for (let i = packets.length - 1; i >= 0; i--) {
         const pk = packets[i];
         pk.d += pk.speed * dt;
         // pulse nodes as the packet passes them
         let acc = 0;
         for (let s = 1; s < pk.path.pts.length; s++) {
            acc += pk.path.lens[s - 1];
            if (s >= pk.nextStop && pk.d >= acc) {
               const stop = pk.path.stops[s];
               if (stop) stop.pulse = 1;
               pk.nextStop = s + 1;
            }
         }
         if (pk.d >= pk.path.total) {
            packets.splice(i, 1);
            if (pk.then) pk.then();
         }
      }
      nextSpawn -= dt;
      if (nextSpawn <= 0 && packets.length < 7) {
         SCENARIOS[scenarioIndex % SCENARIOS.length]();
         scenarioIndex++;
         nextSpawn = 1.3 + Math.random() * 0.9;
      }
      Object.keys(NODES).forEach((k) => {
         NODES[k].pulse = Math.max(0, NODES[k].pulse - dt * 1.4);
      });
   }

   /* ---------------- Drawing ---------------- */
   const ease = (t) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
   let intro = 0; // 0 → 1 over the entrance
   let hovered = null;

   function polyline(pts, progress, dz) {
      if (progress <= 0) return;
      const projected = pts.map((p) => proj(p, dz));
      ctx.beginPath();
      ctx.moveTo(projected[0][0], projected[0][1]);
      if (progress >= 1) {
         for (let i = 1; i < projected.length; i++) ctx.lineTo(projected[i][0], projected[i][1]);
      } else {
         // partial draw for the entrance
         let total = 0;
         const seg = [];
         for (let i = 1; i < projected.length; i++) {
            const l = Math.hypot(projected[i][0] - projected[i - 1][0], projected[i][1] - projected[i - 1][1]);
            seg.push(l);
            total += l;
         }
         let remaining = total * progress;
         for (let i = 1; i < projected.length && remaining > 0; i++) {
            const l = seg[i - 1];
            const t = Math.min(1, remaining / l);
            ctx.lineTo(projected[i - 1][0] + (projected[i][0] - projected[i - 1][0]) * t, projected[i - 1][1] + (projected[i][1] - projected[i - 1][1]) * t);
            remaining -= l;
         }
      }
      ctx.stroke();
   }

   function drawPlane(pl, appear) {
      if (appear <= 0) return;
      const dz = (1 - appear) * -0.35;
      const x0 = pl.cx - pl.w;
      const x1 = pl.cx + pl.w;
      const y0 = pl.cy - pl.d;
      const y1 = pl.cy + pl.d;
      const corners = [P(x0, y0, pl.z), P(x1, y0, pl.z), P(x1, y1, pl.z), P(x0, y1, pl.z)].map((p) => proj(p, dz));

      ctx.globalAlpha = appear;
      ctx.beginPath();
      corners.forEach((c, i) => (i ? ctx.lineTo(c[0], c[1]) : ctx.moveTo(c[0], c[1])));
      ctx.closePath();
      ctx.fillStyle = C.plane;
      ctx.fill();

      // blueprint grid
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const step = 0.2;
      for (let x = x0 + step; x < x1 - 1e-6; x += step) {
         const a = proj(P(x, y0, pl.z), dz);
         const b = proj(P(x, y1, pl.z), dz);
         ctx.moveTo(a[0], a[1]);
         ctx.lineTo(b[0], b[1]);
      }
      for (let y = y0 + step; y < y1 - 1e-6; y += step) {
         const a = proj(P(x0, y, pl.z), dz);
         const b = proj(P(x1, y, pl.z), dz);
         ctx.moveTo(a[0], a[1]);
         ctx.lineTo(b[0], b[1]);
      }
      ctx.stroke();
      ctx.restore();

      ctx.beginPath();
      corners.forEach((c, i) => (i ? ctx.lineTo(c[0], c[1]) : ctx.moveTo(c[0], c[1])));
      ctx.closePath();
      ctx.strokeStyle = C.edge;
      ctx.lineWidth = 1;
      ctx.stroke();

      // corner ticks on the front-left corner, and the layer label
      const fl = corners[3];
      const fa = lang() === "fa";
      ctx.fillStyle = C.label;
      ctx.font = fa ? `600 ${labelSize(11)}px Vazirmatn, Geist, sans-serif` : `500 ${labelSize(10)}px "Geist Mono", ui-monospace, monospace`;
      // just outside the front edge, so it never collides with the next layer
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.direction = fa ? "rtl" : "ltr";
      ctx.fillText(pl.label[lang()], Math.max(4, fl[0] + 6), fl[1] + 8);
      ctx.direction = "ltr";
      ctx.globalAlpha = 1;
   }

   const labelSize = (base) => Math.round(Math.max(base - 1, Math.min(base + 2, base * (S / 120))));

   function drawBox(n, a, dz) {
      const s = 0.085;
      const h = n.kind === "edge" ? 0.1 : 0.07;
      const z = n.z + dz;
      const base = [P(n.x - s, n.y - s, z), P(n.x + s, n.y - s, z), P(n.x + s, n.y + s, z), P(n.x - s, n.y + s, z)];
      const top = base.map((p) => P(p.x, p.y, p.z + h));
      const B = base.map((p) => proj(p));
      const T = top.map((p) => proj(p));
      const accent = n === hovered || n.pulse > 0.05 || n.kind === "edge";

      ctx.globalAlpha = a;
      ctx.lineWidth = 1;
      ctx.strokeStyle = accent ? C.accent : C.wire;
      // visible sides: front (+y) and left (-x)
      const face = (i, j) => {
         ctx.beginPath();
         ctx.moveTo(B[i][0], B[i][1]);
         ctx.lineTo(B[j][0], B[j][1]);
         ctx.lineTo(T[j][0], T[j][1]);
         ctx.lineTo(T[i][0], T[i][1]);
         ctx.closePath();
         ctx.fillStyle = C.node;
         ctx.fill();
         ctx.stroke();
      };
      face(3, 2);
      face(0, 3);
      ctx.beginPath();
      T.forEach((c, i) => (i ? ctx.lineTo(c[0], c[1]) : ctx.moveTo(c[0], c[1])));
      ctx.closePath();
      ctx.fillStyle = C.node;
      ctx.fill();
      if (accent) {
         const [r, g, b] = C.accentRgb;
         ctx.fillStyle = `rgba(${r},${g},${b},${0.14 + n.pulse * 0.4})`;
         ctx.fill();
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
   }

   function drawCylinder(n, a) {
      const r = 0.1;
      const h = 0.1;
      const c0 = proj(P(n.x, n.y, n.z));
      const c1 = proj(P(n.x, n.y, n.z + h));
      const rx = r * S;
      const ry = r * S * sE;
      const accent = n === hovered || n.pulse > 0.05;
      ctx.globalAlpha = a;
      ctx.lineWidth = 1;
      ctx.strokeStyle = accent ? C.accent : C.wire;
      ctx.fillStyle = C.node;
      ctx.beginPath();
      ctx.ellipse(c0[0], c0[1], rx, ry, 0, 0, Math.PI);
      ctx.lineTo(c1[0] - rx, c1[1]);
      ctx.ellipse(c1[0], c1[1], rx, ry, 0, Math.PI, Math.PI * 2, false);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(c1[0], c1[1], rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      if (accent) {
         const [rr, g, b] = C.accentRgb;
         ctx.fillStyle = `rgba(${rr},${g},${b},${0.14 + n.pulse * 0.4})`;
         ctx.fill();
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
   }

   function drawPulse(n) {
      if (n.pulse <= 0.02) return;
      const c = proj(at(n));
      const t = 1 - n.pulse;
      const r = (0.12 + t * 0.26) * S;
      const [rr, g, b] = C.accentRgb;
      ctx.strokeStyle = `rgba(${rr},${g},${b},${n.pulse * 0.7})`;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.ellipse(c[0], c[1], r, r * sE, 0, 0, Math.PI * 2);
      ctx.stroke();
   }

   function drawLabel(n, a) {
      const c = proj(P(n.x, n.y, n.z + 0.1));
      const size = labelSize(11);
      ctx.globalAlpha = a;
      ctx.font = `${n === hovered ? 600 : 500} ${size}px "Geist Mono", ui-monospace, monospace`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const gap = 0.13 * S;
      let x = c[0] + gap;
      let y = c[1] - 2;
      if (n.kind === "db") {
         // databases sit in a tight row: label them underneath
         ctx.textAlign = "center";
         x = c[0];
         y = c[1] + 0.2 * S * sE + size;
      } else if (x + ctx.measureText(n.label).width > W - 4) {
         ctx.textAlign = "right";
         x = c[0] - gap;
      }
      ctx.lineWidth = 3;
      ctx.strokeStyle = C.bg;
      ctx.lineJoin = "round";
      ctx.strokeText(n.label, x, y);
      ctx.fillStyle = n === hovered || n.pulse > 0.3 ? C.accent : C.ink;
      ctx.fillText(n.label, x, y);
      ctx.globalAlpha = 1;
   }

   function drawNode(n, a) {
      if (a <= 0) return;
      drawPulse(n);
      if (n.kind === "db") drawCylinder(n, a);
      else drawBox(n, a, 0);
      if (W > 360 || n.kind === "edge" || n.kind === "app") drawLabel(n, a);
   }

   function drawPacket(pk) {
      const head = pk.path;
      const dim = pk.kind === "res" ? 0.55 : 1;
      const [r, g, b] = C.accentRgb;
      // trail sampled along the path, so it bends with the wires
      ctx.lineCap = "round";
      for (let i = 0; i < 10; i++) {
         const d0 = pk.d - i * 0.035;
         const d1 = pk.d - (i + 1) * 0.035;
         if (d1 < 0) break;
         const p0 = proj(pointAt(head, d0));
         const p1 = proj(pointAt(head, d1));
         ctx.strokeStyle = `rgba(${r},${g},${b},${(1 - i / 10) * 0.7 * dim})`;
         ctx.lineWidth = 2.2 - i * 0.16;
         ctx.beginPath();
         ctx.moveTo(p0[0], p0[1]);
         ctx.lineTo(p1[0], p1[1]);
         ctx.stroke();
      }
      const p = proj(pointAt(head, pk.d));
      const glow = pk.kind === "res" ? 22 : 30;
      ctx.drawImage(sprite, p[0] - glow / 2, p[1] - glow / 2, glow, glow);
      ctx.fillStyle = pk.kind === "res" ? `rgba(${r},${g},${b},.8)` : C.accent;
      if (pk.kind === "event") {
         ctx.beginPath();
         ctx.moveTo(p[0], p[1] - 5);
         ctx.lineTo(p[0] + 5, p[1]);
         ctx.lineTo(p[0], p[1] + 5);
         ctx.lineTo(p[0] - 5, p[1]);
         ctx.closePath();
         ctx.fill();
      } else {
         ctx.beginPath();
         ctx.arc(p[0], p[1], pk.kind === "res" ? 2.4 : 3.2, 0, Math.PI * 2);
         ctx.fill();
      }
   }

   function drawWires(list, progress, dz) {
      list.forEach((w) => {
         ctx.strokeStyle = w.bus ? C.accent : C.wire;
         ctx.globalAlpha = w.bus ? 0.55 : w.faint ? 0.5 : 1;
         ctx.lineWidth = w.bus ? 2.5 : 1;
         ctx.setLineDash(w.dash || (w.bus ? [8, 6] : []));
         polyline(w.pts, progress, dz);
      });
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
   }

   function drawBusLabel(a) {
      const p = proj(P(-1.36, BUS_Y, 0));
      ctx.globalAlpha = a;
      ctx.font = `600 ${labelSize(10)}px "Geist Mono", ui-monospace, monospace`;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillStyle = C.accent;
      ctx.fillText("RabbitMQ", p[0] - 8, p[1]);
      ctx.globalAlpha = 1;
   }

   function render() {
      setCamera();
      ctx.clearRect(0, 0, W, H);
      ctx.lineJoin = "round";

      const planeIn = (i) => ease((intro - i * 0.14) / 0.5);
      const nodesIn = (i) => ease((intro - 0.3 - i * 0.12) / 0.4);
      const wiresIn = ease((intro - 0.5) / 0.5);

      // back to front: data, links up, services, link up, client
      drawPlane(PLANES[0], planeIn(0));
      ["mongodb", "redis", "postgres", "sqlserver"].forEach((k) => drawNode(NODES[k], nodesIn(0)));

      ctx.globalAlpha = 0.9;
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = C.wire;
      ctx.lineWidth = 1;
      WIRES.drops.forEach((w) => polyline(w.pts, wiresIn));
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      drawPlane(PLANES[1], planeIn(1));
      drawWires(WIRES.services, wiresIn);
      if (wiresIn > 0) drawBusLabel(wiresIn);
      ["identity", "elk", "catalog", "basket", "discount", "ordering", "gateway"].forEach((k) => drawNode(NODES[k], nodesIn(1)));

      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = C.wire;
      WIRES.rise.forEach((w) => polyline(w.pts, wiresIn));
      ctx.setLineDash([]);

      drawPlane(PLANES[2], planeIn(2));
      drawNode(NODES.spa, nodesIn(2));

      if (packets.length) {
         ctx.globalCompositeOperation = C.glow ? "lighter" : "source-over";
         packets.forEach(drawPacket);
         ctx.globalCompositeOperation = "source-over";
      }
   }

   /* ---------------- Loop ---------------- */
   let running = false;
   let visible = true;
   let last = 0;
   let raf = 0;
   let pointer = { x: 0, y: 0, active: false };
   let time = 0;

   function frame(now) {
      raf = 0;
      if (!running) return;
      const dt = Math.min(0.05, (now - (last || now)) / 1000);
      last = now;
      time += dt;

      if (intro < 1) intro = Math.min(1, intro + dt / 1.8);

      const sway = Math.sin(time * 0.22) * 0.05;
      cam.tYaw = BASE_YAW + sway + (pointer.active ? pointer.x * 0.22 : 0);
      cam.tElev = BASE_ELEV + (pointer.active ? pointer.y * 0.07 : 0);
      const k = 1 - Math.exp(-dt * 4);
      cam.yaw += (cam.tYaw - cam.yaw) * k;
      cam.elev += (cam.tElev - cam.elev) * k;

      if (intro > 0.75) stepPackets(dt);
      render();
      raf = window.requestAnimationFrame(frame);
   }

   function start() {
      if (running || reduceMQ.matches) return;
      running = true;
      last = 0;
      raf = window.requestAnimationFrame(frame);
   }

   function stop() {
      running = false;
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
   }

   function update() {
      if (visible && !document.hidden && !reduceMQ.matches) start();
      else stop();
   }

   // A single still frame: the finished model with a few requests mid-flight.
   function renderStill() {
      intro = 1;
      cam.yaw = BASE_YAW;
      cam.elev = BASE_ELEV;
      packets.length = 0;
      const freeze = (route, d, kind) => {
         const path = makePath(route);
         packets.push({ path, d: path.total * d, speed: 0, kind: kind || "req", nextStop: 99 });
      };
      freeze(ROUTES.catalog, 0.55);
      freeze(ROUTES.event, 0.45, "event");
      freeze(ROUTES.auth, 0.7, "res");
      render();
      packets.length = 0;
   }

   function redraw() {
      if (reduceMQ.matches) renderStill();
      else if (!running) render();
   }

   /* ---------------- Wiring ---------------- */
   // Boot after the page has rendered: reading styles and layout any earlier
   // forces a full synchronous layout while the document is still loading.
   function boot() {
   readColors();
   resize();

   if ("ResizeObserver" in window) {
      new ResizeObserver(() => {
         resize();
         redraw();
      }).observe(canvas);
   } else {
      window.addEventListener("resize", () => {
         resize();
         redraw();
      });
   }

   if ("IntersectionObserver" in window) {
      new IntersectionObserver(([entry]) => {
         visible = entry.isIntersecting;
         update();
      }).observe(canvas);
   }
   document.addEventListener("visibilitychange", update);
   reduceMQ.addEventListener("change", () => {
      update();
      redraw();
   });

   document.addEventListener("site:themechange", () => {
      readColors();
      redraw();
   });
   document.addEventListener("site:langchange", redraw);
   if (document.fonts && document.fonts.ready) document.fonts.ready.then(redraw);

   // Cursor: lean the camera and highlight the nearest node.
   const heroEl = canvas.closest(".hero") || canvas;
   if (finePointer) {
      heroEl.addEventListener(
         "pointermove",
         (e) => {
            const rect = heroEl.getBoundingClientRect();
            pointer.x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
            pointer.y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
            pointer.active = true;

            const c = canvas.getBoundingClientRect();
            const mx = e.clientX - c.left;
            const my = e.clientY - c.top;
            let best = null;
            let bestD = 26;
            Object.keys(NODES).forEach((key) => {
               const n = NODES[key];
               const p = proj(P(n.x, n.y, n.z + 0.05));
               const dist = Math.hypot(p[0] - mx, p[1] - my);
               if (dist < bestD) {
                  best = n;
                  bestD = dist;
               }
            });
            hovered = best;
         },
         { passive: true },
      );
      heroEl.addEventListener("pointerleave", () => {
         pointer.active = false;
         hovered = null;
      });
   }

   if (reduceMQ.matches) {
      renderStill();
   } else {
      render();
      update();
   }
   }

   if (document.readyState === "complete") window.requestAnimationFrame(boot);
   else window.addEventListener("load", () => window.requestAnimationFrame(boot), { once: true });
})();
