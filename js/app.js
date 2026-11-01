/*
 * SITTING SALA SCALA · aplicación
 * ===============================
 * Editor del plano de la sala (dos plantas) y sitting automático a partir del Excel de reservas.
 *
 * Partes del archivo:
 *   1. Configuración: medidas de la sala, tipos de mesa (T) y dibujo de las zonas fijas.
 *   2. Editor del plano: crear, mover, girar y borrar mesas, zoom y guardado en el navegador.
 *   3. Planta alta: barra del anfiteatro (62 sillas) y escalones.
 *   4. Sitting automático (runSitting): reglas de reparto de reservas.
 *   5. Dibujo del sitting: colores, nombres, iconos ⚠ y 🎂, puntos verdes.
 *   6. Mover reservas a mano, bloqueo del plano y copias (exportar/importar).
 *
 * Unidades: todas las posiciones y medidas de las mesas van en METROS. Las funciones X() e Y()
 * las convierten a píxeles del dibujo.
 */

const LX0 = 1.75,
  LX1 = 43.5,
  LY1 = 27.32,
  S = 630 / (LX1 - LX0),
  OX = 25 - LX0 * S,
  OY = 14,
  W = 45,
  H = 36.32,
  MAIN = 34;
const FL = {
  base: {
    doc: "planos/base",
    ls: "scala-plano-base",
    extras: true,
    t: "Plano planta baja · distribución base",
  },
  p2: {
    doc: "planos/planta2",
    ls: "scala-plano-planta2",
    extras: false,
    t: "Plano planta alta · distribución base",
  },
};
let FLOOR = "base";
const BARRA_SILLAS = 50; // sillas de la barra del anfiteatro, repartidas a lo largo de toda la barra
// Tipos de mesa: medidas en metros (w = largo, h = fondo) y plazas (cap).
const T = {
  vip: { w: 2.29, h: 1.6, cap: 4, n: "VIP" },
  m8: { w: 2.12, h: 0.6, cap: 8, n: "Mesa 8" },
  m6: { w: 1.5, h: 0.6, cap: 6, n: "Mesa 6" },
  m4: { w: 1.1, h: 0.6, cap: 4, n: "Mesa 4" },
  m4u: { w: 1.1, h: 0.6, cap: 2, n: "Mesa 4 usada por un lado" },
  r60: { w: 0.6, h: 0.6, cap: 0, n: "Mesa redonda Ø 0,60 m", round: true },
  sil4: { w: 1.8, h: 1.6, cap: 2, n: "Sillón 2 con mesa redonda delante", sofa: true },
  esc: { w: 0.6, h: 1.2, cap: 0, n: "Escalera 0,60 × 1,20 m (0,80 m de alto)" },
  pt: { w: LX1 - LX0, h: 2.32, cap: 0, n: "Pasillo de las 300" },
  esc2: { w: 1.0, h: 1.2, cap: 0, n: "Escalera 1,00 × 1,20 m (0,80 m de alto)" },
};
const NS = "http://www.w3.org/2000/svg",
  svg = document.getElementById("plan"),
  tl = document.getElementById("tl"),
  gr = document.getElementById("grid"),
  fx = document.getElementById("fixed"),
  st = document.getElementById("st");
let ts = [],
  nid = 1,
  selId = null,
  drag = null,
  hist = [],
  db = null,
  updated = 0,
  timers = {};
const X = (m) => OX + m * S,
  Y = (m) => OY + m * S;
// Crea un elemento SVG con sus atributos y lo añade al grupo indicado.
function el(tag, attrs, parent, text) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text != null) e.textContent = text;
  (parent || fx).appendChild(e);
  return e;
}
for (let i = Math.ceil(LX0); i < LX1; i++)
  el(
    "line",
    { x1: X(i), y1: Y(0), x2: X(i), y2: Y(LY1), stroke: "var(--line)", "stroke-width": i % 5 ? 0.3 : 0.8 },
    gr,
  );
for (let i = 1; i < LY1; i++)
  el(
    "line",
    { x1: X(LX0), y1: Y(i), x2: X(LX1), y2: Y(i), stroke: "var(--line)", "stroke-width": i % 5 ? 0.3 : 0.8 },
    gr,
  );
const czr = document.getElementById("czr");
czr.setAttribute("x", X(LX0));
czr.setAttribute("y", Y(0));
czr.setAttribute("width", (LX1 - LX0) * S);
czr.setAttribute("height", LY1 * S);
el(
  "rect",
  {
    x: X(LX0),
    y: Y(0),
    width: (LX1 - LX0) * S,
    height: LY1 * S,
    fill: "none",
    stroke: "var(--line2)",
    "stroke-width": 1.5,
  },
  gr,
);
// Dibuja una zona fija (escenario, pasillos, pasarela) en metros.
function zone(x, y, w, h, l1, l2, fs) {
  el("rect", {
    x: X(x),
    y: Y(y),
    width: w * S,
    height: h * S,
    fill: "var(--accbg)",
    stroke: "var(--acc)",
    "stroke-width": 0.8,
  });
  const cx = X(x + w / 2),
    cy = Y(y + h / 2);
  if (!l1) return;
  if (l2) {
    el(
      "text",
      {
        x: cx,
        y: cy - 9,
        "text-anchor": "middle",
        "dominant-baseline": "central",
        "font-size": fs || 14,
        fill: "var(--acc)",
      },
      null,
      l1,
    );
    el(
      "text",
      {
        x: cx,
        y: cy + 9,
        "text-anchor": "middle",
        "dominant-baseline": "central",
        "font-size": 11,
        fill: "var(--acc)",
      },
      null,
      l2,
    );
  } else
    el(
      "text",
      {
        x: cx,
        y: cy,
        "text-anchor": "middle",
        "dominant-baseline": "central",
        "font-size": fs || 10,
        fill: "var(--acc)",
      },
      null,
      l1,
    );
}
zone(12.5, 0, 20, 10);
zone(2.5, 9, 10, 1);
zone(32.5, 9, 10, 1);
zone(17.5, 10, 10, 4.64);
// Dibuja un tramo de muro (los muros en T).
function wall(x, y, w, h) {
  el("rect", { x: X(x), y: Y(y), width: w * S, height: h * S, fill: "var(--muted)" });
}
[12.5, 32.5].forEach((cx) => {
  wall(cx - 0.1, 10, 0.2, 6.75);
  wall(cx - 2, 16.55, 4, 0.2);
});
// Añade una mesa (o elemento) a la lista del plano actual.
function mk(type, x, y, r) {
  ts.push({ id: nid++, type, x, y, r: r || 0 });
}
// Ancho y fondo de una mesa en metros, teniendo en cuenta si está girada.
function dim(t) {
  const d = T[t.type];
  return t.r ? { w: d.h, h: d.w } : { w: d.w, h: d.h };
}
// Distribución inicial: el plano oficial de Sala Scala (plano-oficial.js).
function defaults() {
  ts = [];
  nid = 1;
  if (typeof PLANO_OFICIAL !== "undefined" && PLANO_OFICIAL[FLOOR]) {
    fromData(PLANO_OFICIAL[FLOOR], W, 2);
    return;
  }
  if (!FL[FLOOR].extras) return;
  [12.4, 15.4, 18.4].forEach((y) => {
    mk("vip", 0, y);
    mk("vip", W - T.vip.w, y);
  });
  for (let i = 0; i < 9; i++) mk("vip", 9.3 + i * 3, MAIN - T.vip.h);
  mk("m8", 21.9, 16, 90);
  mk("m8", 22.84, 16, 90);
}
// Se asegura de que existan las escaleras y el pasillo de las 300 en la planta baja.
function ensureEsc() {
  if (!FL[FLOOR].extras) return false;
  let a = false;
  ts.forEach((t) => {
    if (t.type === "pt" && t.x !== LX0) {
      t.x = LX0;
      a = true;
    }
  });
  if (!ts.some((t) => t.type === "pt")) {
    ts.unshift({ id: nid++, type: "pt", x: LX0, y: 25, r: 0 });
    a = true;
  }
  if (!ts.some((t) => t.type === "esc")) {
    mk("esc", 18, 14.64, 0);
    mk("esc", 26.9, 14.64, 0);
    a = true;
  }
  if (!ts.some((t) => t.type === "esc2")) {
    mk("esc2", 22, 14.64, 0);
    a = true;
  }
  return a;
}
// Convierte las mesas del plano a la lista [tipo, x, y, orientación] que se guarda.
function toData() {
  return ts.map((t) => [t.type, +t.x.toFixed(2), +t.y.toFixed(2), t.r ? "v" : "h"]);
}
// Carga una lista guardada [tipo, x, y, orientación] en el plano (con migraciones de versiones antiguas).
function fromData(a, roomW, vipV) {
  const sh = (W - (roomW || 42)) / 2;
  ts = [];
  nid = 1;
  const oldW = roomW || 42;
  a.forEach((d) => {
    let ty = d[0] === "m2" ? "m4u" : d[0];
    if (!T[ty]) return;
    const r = d[3] === "v" ? 90 : 0,
      w = r ? T[ty].h : T[ty].w;
    let x = d[1] + sh;
    if (sh && d[1] <= 0.01) x = 0;
    else if (sh && d[1] + w >= oldW - 0.01) x = W - w;
    let y = d[2];
    if (ty === "vip" && !r && !vipV) {
      if (Math.abs(x + 2.4 - W) < 0.02) x = W - T.vip.w;
      if (Math.abs(y + 2 - MAIN) < 0.02) y = MAIN - T.vip.h;
    }
    mk(ty, +x.toFixed(2), +y.toFixed(2), r);
  });
}
// Muestra un mensaje bajo el plano (ok = verde, warn = aviso).
function status(txt, cls) {
  st.textContent = txt;
  st.className = cls || "";
}
// Guarda el estado actual para poder deshacer.
function snapshot() {
  hist.push(JSON.stringify(toData()));
  if (hist.length > 50) hist.shift();
  document.getElementById("bu").disabled = false;
}
// Deshace el último cambio del plano.
function undo() {
  if (sitLocked()) return;
  const s = hist.pop();
  if (!s) return;
  fromData(JSON.parse(s), W, 2);
  selId = null;
  render();
  save();
  document.getElementById("bu").disabled = !hist.length;
}
// Guarda el plano en el navegador (localStorage) cada vez que cambia.
function save() {
  updated = Date.now();
  const data = toData(),
    F = FL[FLOOR],
    up = updated;
  try {
    localStorage.setItem(F.ls, JSON.stringify({ tables: data, updated: up, roomW: W, vipV: 2 }));
  } catch (e) {}
  status("Guardando…");
  clearTimeout(timers[F.doc]);
  timers[F.doc] = setTimeout(async () => {
    if (!db) {
      status("Guardado en este navegador", "warn");
      return;
    }
    try {
      await db.doc(F.doc).set({ tables: JSON.stringify(data), updated: up, roomW: W, vipV: 2 });
      status("Guardado", "ok");
    } catch (e) {
      status("No se pudo guardar en la nube; copia local guardada", "warn");
    }
  }, 600);
}
// Redibuja todas las mesas del plano y el recuento de mesas y plazas.
function render() {
  tl.innerHTML = "";
  [...ts]
    .sort((a, b) => (b.type === "pt") - (a.type === "pt"))
    .forEach((t) => {
      const d = dim(t),
        vip = t.type === "vip",
        esc = t.type.startsWith("esc"),
        g = el("g", {}, tl);
      g.style.cursor = "grab";
      const r = el(
        "rect",
        {
          x: X(t.x),
          y: Y(t.y),
          width: d.w * S,
          height: d.h * S,
          rx: T[t.type].round ? (d.w * S) / 2 : T[t.type].sofa ? 6 : vip ? 5 : 1.5,
          fill: esc ? "var(--accbg)" : "var(--card)",
          stroke: t.id === selId ? "var(--txt)" : esc ? "var(--acc)" : "var(--muted)",
          "stroke-width": t.id === selId ? 2.2 : 0.9,
        },
        g,
      );
      if (t.type === "m4u") r.setAttribute("stroke-dasharray", "3 2");
      let lx = t.x + d.w / 2,
        ly = t.y + d.h / 2;
      if (T[t.type].sofa) {
        const sd = 0.8,
          td = 0.6,
          gp = 0.2;
        let cx, cy;
        el(
          "rect",
          { x: X(t.x), y: Y(t.y), width: d.w * S, height: d.h * S, fill: "transparent", stroke: "none" },
          g,
        );
        if (!t.r) {
          r.setAttribute("y", Y(t.y + td + gp));
          r.setAttribute("height", sd * S);
          cx = t.x + d.w / 2;
          cy = t.y + td / 2;
          ly = t.y + td + gp + sd / 2;
        } else {
          r.setAttribute("x", X(t.x + td + gp));
          r.setAttribute("width", sd * S);
          cx = t.x + td / 2;
          cy = t.y + d.h / 2;
          lx = t.x + td + gp + sd / 2;
        }
        el(
          "circle",
          {
            cx: X(cx),
            cy: Y(cy),
            r: (td * S) / 2,
            fill: "var(--card)",
            stroke: t.id === selId ? "var(--txt)" : "var(--muted)",
            "stroke-width": t.id === selId ? 2.2 : 0.9,
          },
          g,
        );
      }
      if (t.type === "pt") {
        r.setAttribute("fill", "var(--accbg)");
        r.setAttribute("fill-opacity", "0.35");
        r.setAttribute("stroke", "var(--acc)");
        r.setAttribute("stroke-dasharray", "5 4");
        r.setAttribute("rx", 0);
        g.style.pointerEvents = "none";
      }
      el(
        "text",
        {
          x: X(lx),
          y: Y(ly),
          "text-anchor": "middle",
          "dominant-baseline": "central",
          "font-size": t.type === "pt" ? 11 : esc ? 8 : 10,
          "pointer-events": "none",
          fill: esc || t.type === "pt" ? "var(--acc)" : "var(--txt)",
        },
        g,
        SIT && SIT.tmap[keyOf(t.type, t.x, t.y)] && SIT.tmap[keyOf(t.type, t.x, t.y)].floor === FLOOR
          ? ""
          : t.type === "pt"
            ? "Pasillo de las 300"
            : esc
              ? "E"
              : T[t.type].cap || "",
      );
      g.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        e.preventDefault();
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        try {
          svg.setPointerCapture(e.pointerId);
        } catch (_) {}
        if (ptrs.size >= 2) {
          endDrag();
          startPinch();
          return;
        }
        if (SIT) {
          sitDown(t, e);
          return;
        }
        if (LOCKED) {
          ptrs.delete(e.pointerId);
          sitLocked();
          return;
        }
        selId = t.id;
        const p = pm(e);
        snapshot();
        drag = { t, dx: p.x - t.x, dy: p.y - t.y, moved: false };
        render();
      });
    });
  const seats = ts.reduce((s, t) => s + T[t.type].cap, 0) + (FLOOR === "p2" ? AMPH : 0),
    vips = ts.filter((t) => t.type === "vip").length;
  document.getElementById("cnt").textContent =
    ts.filter((t) => T[t.type].cap > 0).length +
    " mesas · " +
    vips +
    " VIP · " +
    (FLOOR === "p2" ? "barra del anfiteatro (zona PMR): máx. " + AMPH + " sillas, cada PMR ocupa 2 · " : "") +
    seats +
    " plazas";
  const s = ts.find((t) => t.id === selId);
  sitOverlay();
  document.getElementById("sel").textContent = SIT
    ? "Sitting cargado y bloqueado: toca una reserva para ver su ficha. Para mover reservas, pulsa «Sitting bloqueado»."
    : s
      ? T[s.type].n +
        (s.r ? " (vertical)" : "") +
        " en x " +
        s.x.toFixed(1) +
        " m, y " +
        s.y.toFixed(1) +
        " m"
      : "Toca una mesa para seleccionarla y arrástrala para moverla";
}
// Convierte la posición del dedo o del ratón a metros del plano.
function pm(e) {
  const p = svg.createSVGPoint();
  p.x = e.clientX;
  p.y = e.clientY;
  const q = p.matrixTransform(svg.getScreenCTM().inverse());
  return { x: (q.x - OX) / S, y: (q.y - OY) / S };
}
const BW = 680,
  BH = Math.ceil(OY * 2 + LY1 * S);
svg.setAttribute("viewBox", "0 0 " + BW + " " + BH);
let vb = { x: 0, y: 0, w: BW, h: BH },
  ptrs = new Map(),
  pan = null,
  pinch = null;
// Aplica el zoom y el desplazamiento actuales a la vista.
function applyVB() {
  vb.w = Math.max(BW / 8, Math.min(BW, vb.w));
  vb.h = (vb.w * BH) / BW;
  vb.x = Math.max(-vb.w * 0.25, Math.min(BW - vb.w * 0.75, vb.x));
  vb.y = Math.max(-vb.h * 0.25, Math.min(BH - vb.h * 0.75, vb.y));
  if (vb.w >= BW) {
    vb.x = 0;
    vb.y = 0;
  }
  svg.setAttribute("viewBox", vb.x + " " + vb.y + " " + vb.w + " " + vb.h);
  document.getElementById("zl").textContent = Math.round((BW / vb.w) * 100) + "%";
}
// Hace zoom alrededor de un punto de la pantalla.
function zoomAt(f, fx, fy) {
  const nw = Math.max(BW / 8, Math.min(BW, vb.w / f)),
    px = vb.x + fx * vb.w,
    py = vb.y + fy * vb.h;
  vb.x = px - fx * nw;
  vb.y = py - (fy * nw * BH) / BW;
  vb.w = nw;
  applyVB();
}
// Zoom con los botones + y −.
function zoomBtn(f) {
  zoomAt(f, 0.5, 0.5);
}
// Vuelve a ver el plano completo.
function zoomFit() {
  vb = { x: 0, y: 0, w: BW, h: BH };
  applyVB();
}
// Posición relativa (0 a 1) de un punto dentro del plano en pantalla.
function frac(cx, cy) {
  const r = svg.getBoundingClientRect();
  return { fx: (cx - r.left) / r.width, fy: (cy - r.top) / r.height };
}
// Punto medio y distancia entre dos dedos (para el pellizco).
function mid() {
  const a = [...ptrs.values()];
  return {
    x: (a[0].x + a[1].x) / 2,
    y: (a[0].y + a[1].y) / 2,
    d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1,
  };
}
// Empieza un zoom con dos dedos.
function startPinch() {
  pan = null;
  const m = mid(),
    f = frac(m.x, m.y);
  pinch = { d0: m.d, vb0: { ...vb }, px: vb.x + f.fx * vb.w, py: vb.y + f.fy * vb.h };
}
// Termina de arrastrar una mesa y guarda si se ha movido.
function endDrag() {
  if (!drag) return;
  if (drag.moved) save();
  else {
    hist.pop();
    document.getElementById("bu").disabled = !hist.length;
  }
  drag = null;
}
svg.addEventListener("pointerdown", (e) => {
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  try {
    svg.setPointerCapture(e.pointerId);
  } catch (_) {}
  if (ptrs.size >= 2) {
    endDrag();
    startPinch();
    return;
  }
  pan = { cx: e.clientX, cy: e.clientY, vb0: { ...vb }, moved: false };
});
svg.addEventListener("pointermove", (e) => {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && ptrs.size >= 2) {
    const m = mid(),
      f = frac(m.x, m.y),
      nw = Math.max(BW / 8, Math.min(BW, (pinch.vb0.w * pinch.d0) / m.d));
    vb.w = nw;
    vb.x = pinch.px - f.fx * nw;
    vb.y = pinch.py - (f.fy * nw * BH) / BW;
    applyVB();
    return;
  }
  if (pan) {
    const r = svg.getBoundingClientRect(),
      dx = ((e.clientX - pan.cx) * vb.w) / r.width,
      dy = ((e.clientY - pan.cy) * vb.h) / r.height;
    if (Math.abs(e.clientX - pan.cx) + Math.abs(e.clientY - pan.cy) > 4) pan.moved = true;
    vb.x = pan.vb0.x - dx;
    vb.y = pan.vb0.y - dy;
    applyVB();
    return;
  }
  if (pmove) {
    sitMove(e);
    return;
  }
  if (!drag) return;
  const p = pm(e),
    d = dim(drag.t),
    sn = (v) => Math.round(v * 4) / 4;
  const nx = Math.max(LX0, Math.min(LX1 - d.w, sn(p.x - drag.dx))),
    ny = Math.max(0, Math.min(LY1 - d.h, sn(p.y - drag.dy)));
  const fx2 = drag.t.type === "pt" ? LX0 : nx;
  if (fx2 !== drag.t.x || ny !== drag.t.y) {
    drag.t.x = fx2;
    drag.t.y = ny;
    drag.moved = true;
    render();
  }
});
// Al levantar el dedo o soltar el ratón: termina arrastres, pellizcos y desplazamientos.
function up(e) {
  if (pmove) {
    ptrs.delete(e.pointerId);
    sitUp(e);
    return;
  }
  ptrs.delete(e.pointerId);
  if (ptrs.size < 2) pinch = null;
  if (pan && ptrs.size === 0) {
    if (!pan.moved && selId != null) {
      selId = null;
      render();
    }
    pan = null;
  }
  if (ptrs.size === 0) endDrag();
}
svg.addEventListener("pointerup", up);
svg.addEventListener("pointercancel", up);
svg.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const f = frac(e.clientX, e.clientY);
    zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, f.fx, f.fy);
  },
  { passive: false },
);
// Mesa seleccionada actualmente.
function cur() {
  return ts.find((t) => t.id === selId);
}
// Botones "+ Mesa…": añade una mesa nueva.
function addT(type) {
  if (sitLocked()) return;
  snapshot();
  mk(type, 21, 24, 0);
  selId = nid - 1;
  render();
  save();
}
// Botón "Un lado / dos lados": convierte una mesa de 4 en mesa de 2 y al revés.
function lado() {
  if (sitLocked()) return;
  const t = cur();
  if (t && (t.type === "m4" || t.type === "m4u")) {
    snapshot();
    t.type = t.type === "m4" ? "m4u" : "m4";
    render();
    save();
  }
}
// Botón "Girar": gira la mesa seleccionada 90 grados.
function rot() {
  if (sitLocked()) return;
  const t = cur();
  if (t && t.type !== "pt") {
    snapshot();
    t.r = t.r ? 0 : 90;
    const d = dim(t);
    t.x = Math.min(t.x, LX1 - d.w);
    t.y = Math.min(t.y, LY1 - d.h);
    render();
    save();
  }
}
// Botón "Duplicar": copia la mesa seleccionada al lado.
function dup() {
  if (sitLocked()) return;
  const t = cur();
  if (t && t.type !== "pt") {
    snapshot();
    const d = dim(t);
    mk(t.type, Math.min(t.x + d.w + 0.5, LX1 - d.w), t.y, t.r);
    selId = nid - 1;
    render();
    save();
  }
}
// Botón "Borrar": elimina la mesa seleccionada.
function del() {
  if (sitLocked()) return;
  if (selId == null || (cur() && cur().type === "pt")) return;
  snapshot();
  ts = ts.filter((t) => t.id !== selId);
  selId = null;
  render();
  save();
}
let loadSeq = 0,
  AMPH = 0;
// Base de datos en la nube: no se usa en esta versión (todo se guarda en el navegador).
async function getDb() {
  return null;
}
// Carga una planta (base = planta baja, p2 = planta alta) y la dibuja.
async function loadFloor(f) {
  const seq = ++loadSeq;
  FLOOR = f;
  const F = FL[f];
  hist = [];
  selId = null;
  drag = null;
  updated = 0;
  document.getElementById("ttl").textContent = F.t;
  drawFloorFx();
  ["base", "p2"].forEach((k) => document.getElementById("tab-" + k).classList.toggle("on", k === f));
  let local = null;
  try {
    local = JSON.parse(localStorage.getItem(F.ls));
  } catch (e) {}
  if (local && local.tables) {
    fromData(local.tables, local.roomW, local.vipV);
    updated = local.updated || 0;
  } else defaults();
  let changed = ensureEsc() || (local && local.tables && (local.roomW !== W || !local.vipV));
  document.getElementById("bu").disabled = true;
  render();
  await getDb();
  if (seq !== loadSeq) return;
  if (!db) {
    status(local ? "Guardado en este navegador" : "Plano oficial cargado", "warn");
    if (changed) save();
    return;
  }
  try {
    const snap = await db.doc(F.doc).get();
    if (seq !== loadSeq) return;
    const v = snap && (snap.data ? snap.data() : snap);
    if (v && v.tables && (v.updated || 0) > updated) {
      fromData(JSON.parse(v.tables), v.roomW, v.vipV);
      updated = v.updated;
      const c = ensureEsc() || v.roomW !== W || !v.vipV;
      render();
      if (c) save();
      else status("Guardado", "ok");
    } else if (changed || (local && local.tables && (!v || !v.tables || (v.updated || 0) < updated))) save();
    else status(v && v.tables ? "Guardado" : "Listo", "ok");
  } catch (e) {
    status("Sin conexión a la nube; guardando en este navegador", "warn");
    if (changed) save();
  }
}
// Dibujos fijos de la planta alta: barra del anfiteatro, su borde y los escalones.
function drawFloorFx() {
  const g = document.getElementById("floorfx");
  g.innerHTML = "";
  if (FLOOR !== "p2") return;
  function uPath(L, R, F, r, LT, RT) {
    const k = 0.5523 * r;
    return (
      "M" +
      X(L) +
      " " +
      Y(LT) +
      " L" +
      X(L) +
      " " +
      Y(F - r) +
      " C" +
      X(L) +
      " " +
      Y(F - r + k) +
      " " +
      X(L + r - k) +
      " " +
      Y(F) +
      " " +
      X(L + r) +
      " " +
      Y(F) +
      " L" +
      X(R - r) +
      " " +
      Y(F) +
      " C" +
      X(R - r + k) +
      " " +
      Y(F) +
      " " +
      X(R) +
      " " +
      Y(F - r + k) +
      " " +
      X(R) +
      " " +
      Y(F - r) +
      " L" +
      X(R) +
      " " +
      Y(RT)
    );
  }
  const L = 8.85,
    R = 36,
    F = 18.5,
    LT = 11.75,
    RT = 11.5,
    r = 6,
    o = 0.5;
  el(
    "path",
    {
      d: uPath(L - o / 2, R + o / 2, F + o / 2, r + o / 2, LT, RT),
      fill: "none",
      stroke: "var(--line2)",
      "stroke-width": o * S,
      "stroke-linecap": "butt",
      "stroke-linejoin": "round",
    },
    g,
  );
  el(
    "path",
    {
      d: uPath(L, R, F, r, LT, RT),
      fill: "none",
      stroke: "var(--acc)",
      "stroke-width": 2.5,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    },
    g,
  );
  el(
    "path",
    {
      d: uPath(L - o, R + o, F + o, r + o, LT, RT),
      fill: "none",
      stroke: "var(--acc)",
      "stroke-width": 1.5,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    },
    g,
  );
  const Lo = L - o,
    Ro = R + o,
    Fo = F + o,
    ro = r + o,
    cw = 0.5,
    gap = 0.1,
    cd = 0.45,
    off = 0.02 + cd / 2;
  const segs = [
    { len: Fo - ro - LT, f: (u) => ({ x: Lo, y: LT + u, nx: -1, ny: 0 }) },
    {
      len: (Math.PI / 2) * ro,
      f: (u) => {
        const th = Math.PI - u / ro;
        return {
          x: Lo + ro + ro * Math.cos(th),
          y: Fo - ro + ro * Math.sin(th),
          nx: Math.cos(th),
          ny: Math.sin(th),
        };
      },
    },
    { len: Ro - ro - (Lo + ro), f: (u) => ({ x: Lo + ro + u, y: Fo, nx: 0, ny: 1 }) },
    {
      len: (Math.PI / 2) * ro,
      f: (u) => {
        const th = Math.PI / 2 - u / ro;
        return {
          x: Ro - ro + ro * Math.cos(th),
          y: Fo - ro + ro * Math.sin(th),
          nx: Math.cos(th),
          ny: Math.sin(th),
        };
      },
    },
    { len: Fo - ro - RT, f: (u) => ({ x: Ro, y: Fo - ro - u, nx: 1, ny: 0 }) },
  ];
  const tot = segs.reduce((a, q) => a + q.len, 0),
    n = BARRA_SILLAS,
    gap2 = (tot - n * cw) / (n - 1),
    st0 = 0;
  function at(sd) {
    for (const q of segs) {
      if (sd <= q.len) return q.f(sd);
      sd -= q.len;
    }
    const q = segs[segs.length - 1];
    return q.f(q.len);
  }

  AMPH = n;
  const yl = Fo + 1.5,
    hw = (Ro - Lo) / 2 - 4,
    cxm = 22.5;
  el(
    "line",
    {
      x1: X(cxm - hw),
      y1: Y(yl),
      x2: X(cxm + hw),
      y2: Y(yl),
      stroke: "var(--warn)",
      "stroke-width": 1.5,
      "stroke-dasharray": "6 3",
    },
    g,
  );
  el(
    "line",
    {
      x1: X(cxm - hw),
      y1: Y(yl + 1),
      x2: X(cxm + hw),
      y2: Y(yl + 1),
      stroke: "var(--warn)",
      "stroke-width": 1.5,
      "stroke-dasharray": "6 3",
    },
    g,
  );
  el(
    "text",
    {
      x: X(cxm),
      y: Y(yl + 0.5),
      "text-anchor": "middle",
      "dominant-baseline": "central",
      "font-size": 11,
      fill: "var(--warn)",
    },
    g,
    "Escalones",
  );
}
// Pestañas "Planta baja" / "Planta alta".
function switchFloor(f) {
  if (f === FLOOR) return;
  loadFloor(f);
}
loadFloor(location.hash === "#planta-alta" ? "p2" : "base");
/* ===== Sitting automático ===== */
const CATC = { VIP: "#2E7D32", Premium: "#8E44AD", General: "#2F7FD8", Show: "#0E9AA7" };
const PMRC = "#E24B4A",
  INVC = "#FFC800";
function isInv(u) {
  return !!(u && (u.staff || u.gest));
}
var SIT = null;
// Calcula las 62 sillas de la barra del anfiteatro (0,50 m de ancho, 0,10 m de separación), numeradas de izquierda a derecha.
function barraSeats() {
  const L = 8.85,
    R = 36,
    F = 18.5,
    LT = 11.75,
    RT = 11.5,
    r = 6,
    o = 0.5,
    Lo = L - o,
    Ro = R + o,
    Fo = F + o,
    ro = r + o,
    cw = 0.5,
    gap = 0.1,
    cd = 0.45,
    off = 0.02 + cd / 2;
  const segs = [
    { len: Fo - ro - LT, f: (u) => ({ x: Lo, y: LT + u, nx: -1, ny: 0 }) },
    {
      len: (Math.PI / 2) * ro,
      f: (u) => {
        const th = Math.PI - u / ro;
        return {
          x: Lo + ro + ro * Math.cos(th),
          y: Fo - ro + ro * Math.sin(th),
          nx: Math.cos(th),
          ny: Math.sin(th),
        };
      },
    },
    { len: Ro - ro - (Lo + ro), f: (u) => ({ x: Lo + ro + u, y: Fo, nx: 0, ny: 1 }) },
    {
      len: (Math.PI / 2) * ro,
      f: (u) => {
        const th = Math.PI / 2 - u / ro;
        return {
          x: Ro - ro + ro * Math.cos(th),
          y: Fo - ro + ro * Math.sin(th),
          nx: Math.cos(th),
          ny: Math.sin(th),
        };
      },
    },
    { len: Fo - ro - RT, f: (u) => ({ x: Ro, y: Fo - ro - u, nx: 1, ny: 0 }) },
  ];
  const tot = segs.reduce((a, q) => a + q.len, 0),
    n = BARRA_SILLAS,
    gap2 = (tot - n * cw) / (n - 1),
    st0 = 0,
    out = [];
  for (let i = 0; i < n; i++) {
    let sd = st0 + cw / 2 + i * (cw + gap2),
      k = 0;
    while (k < segs.length - 1 && sd > segs[k].len) {
      sd -= segs[k].len;
      k++;
    }
    const P = segs[k].f(Math.min(sd, segs[k].len));
    out.push({
      i,
      x: P.x + P.nx * off,
      y: P.y + P.ny * off,
      ang: (Math.atan2(P.ny, P.nx) * 180) / Math.PI - 90,
      zone: k === 2 ? "central" : k < 2 ? "izq" : "der",
      cw,
      cd,
    });
  }
  return out;
}
// Devuelve las mesas guardadas de una planta, aunque no sea la que se está viendo.
async function floorData(f) {
  if (f === FLOOR) return toData();
  const F = FL[f];
  let best = null;
  try {
    const l = JSON.parse(localStorage.getItem(F.ls));
    if (l && l.tables) best = { t: l.tables, u: l.updated || 0 };
  } catch (e) {}
  try {
    await getDb();
    if (db) {
      const s = await db.doc(F.doc).get();
      const v = s && (s.data ? s.data() : s);
      if (v && v.tables && (!best || (v.updated || 0) >= best.u))
        best = { t: JSON.parse(v.tables), u: v.updated };
    }
  } catch (e) {}
  return best ? best.t : [];
}
const keyOf = (ty, x, y) => ty + "@" + (+x).toFixed(2) + "," + (+y).toFixed(2);
const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
// Lee el Excel de reservas: busca la hoja con la columna "Categoría" y convierte cada fila en una reserva.
function parseExcel(buf) {
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  for (const sn of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: "" });
    const hi = rows.findIndex((r) => r.some((c) => norm(c) === "categoria"));
    if (hi < 0) continue;
    const H = rows[hi].map(norm),
      ix = (n) => H.findIndex((h) => h.startsWith(n));
    const c = {
      res: ix("nreserva"),
      nom: ix("nombre"),
      tel: ix("telefono"),
      cat: ix("categoria"),
      mn: ix("menusnomad"),
      mv: ix("menusveganos"),
      mi: ix("menusnino"),
      tot: ix("totalpersonas"),
      al: ix("alergias"),
      pmr: ix("npmr"),
      cu: ix("cumple"),
      gr: ix("codigodegrupo"),
      ob: ix("observaciones"),
      inv: ix("invitacion"),
      ges: ix("reservagestionada"),
    };
    const g = (r, k) => (c[k] >= 0 ? r[c[k]] : "");
    const num = (v) => {
      const n = parseInt(v, 10);
      return isNaN(n) ? 0 : n;
    };
    const out = [];
    for (const r of rows.slice(hi + 1)) {
      const cat = String(g(r, "cat")).trim();
      if (!cat) continue;
      const catN = { vip: "VIP", premium: "Premium", general: "General", show: "Show" }[norm(cat)] || cat;
      let pax = num(g(r, "mn")) + num(g(r, "mv")) + num(g(r, "mi"));
      if (!pax) pax = num(g(r, "tot"));
      if (!pax) continue;
      out.push({
        res: String(g(r, "res")),
        nom: String(g(r, "nom")),
        tel: String(g(r, "tel")).trim(),
        mn: num(g(r, "mn")),
        cat: catN,
        pax,
        veg: num(g(r, "mv")),
        nino: num(g(r, "mi")),
        al: String(g(r, "al")).trim(),
        pmr: num(g(r, "pmr")),
        cu: norm(g(r, "cu")) === "si",
        gr: String(g(r, "gr")).trim(),
        ob: String(g(r, "ob")).trim(),
        staff: (() => {
          const v = String(g(r, "inv")).trim();
          return v && norm(v) !== "no" ? v : "";
        })(),
        ges:
          { regidor: "Regidor", jefedesala: "Jefe de sala", propiedad: "Propiedad" }[norm(g(r, "ges"))] || "",
      });
    }
    return out;
  }
  throw new Error('No encuentro una hoja con la columna "Categoría".');
}
// Distancia entre dos mesas (0 si se tocan). Sirve para saber si dos VIP o dos mesas están pegados.
function rectGap(a, b) {
  const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w)),
    dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
  return Math.hypot(dx, dy);
}
// ---- Mesas compartidas: cada mesa se divide en columnas (parejas de sillas enfrentadas). Una reserva ocupa columnas seguidas, nunca se separa.
var VIPS = [];
// Mesas asignadas al regidor (ids del plano). Pendiente: el jefe de sala tiene que confirmar cuáles son.
const REGIDOR_MESAS = [];
function nCols(t) {
  return t.type === "m4u"
    ? 2
    : t.type === "vip" || (T[t.type] && T[t.type].sofa) || t.type === "r60"
      ? 1
      : Math.max(1, Math.round(t.cap / 2));
}
function perCol(t) {
  return t.type === "m4u" ? 1 : nCols(t) === 1 ? t.cap : 2;
}
function colsNeed(u, t) {
  return Math.ceil(u.pax / perCol(t));
}
function occOf(t) {
  return t.occ || (t.occ = []);
}
function syncT(t) {
  t.unit = occOf(t).length ? t.occ[0].u : null;
}
function usedCols(t) {
  const z = new Set();
  occOf(t).forEach((o) => o.cols.forEach((c) => z.add(c)));
  return z;
}
function colOrder(t) {
  const n = nCols(t),
    idx = [...Array(n).keys()];
  if (n < 2) return idx;
  const long = t.w >= t.h;
  const cc = (k) => {
    const f = (k + 0.5) / n;
    return long
      ? Math.hypot(STAGE.x - (t.x + t.w * f), STAGE.y - t.cy)
      : Math.hypot(STAGE.x - t.cx, STAGE.y - (t.y + t.h * f));
  };
  const d0 = cc(0),
    d1 = cc(n - 1),
    rev = behindVip(t) ? d1 < d0 : d1 > d0;
  return rev ? idx.reverse() : idx;
}
function findRun(t, k) {
  if (k > nCols(t)) return null;
  const ord = colOrder(t),
    used = usedCols(t);
  for (let i = 0; i + k <= ord.length; i++) {
    const r = ord.slice(i, i + k);
    if (r.every((c) => !used.has(c))) return r;
  }
  return null;
}
function addOcc(t, u, cols) {
  occOf(t).push({ u, cols: cols || [...Array(nCols(t)).keys()] });
  syncT(t);
}
function remOcc(t, u) {
  t.occ = occOf(t).filter((o) => o.u !== u);
  syncT(t);
}
function compat(a, b) {
  if (a.cat === b.cat) return a.cat === "Premium" || a.cat === "General" || a.cat === "Show";
  return ["Premium", "General"].includes(a.cat) && ["Premium", "General"].includes(b.cat);
}
function seatCol(t, q) {
  const n = nCols(t);
  if (n < 2) return 0;
  const long = t.w >= t.h,
    f = long ? (q.x - t.x) / t.w : (q.y - t.y) / t.h;
  return Math.max(0, Math.min(n - 1, Math.floor(f * n)));
}
function fitCols(u, t, share) {
  const k = colsNeed(u, t);
  if (nCols(t) === 1) return occOf(t).length || t.cap < u.pax ? null : [0];
  if (t.type === "m4u" && occOf(t).length) return null; // las mesas de 2 nunca se comparten (dos personas solas no se sientan juntas)
  if (occOf(t).length) {
    if (!share || !occOf(t).every((o) => compat(o.u, u))) return null;
  }
  return findRun(t, k);
}
// SITTING AUTOMÁTICO: reparte las reservas en mesas y en la barra siguiendo las reglas de Sala Scala.
// Orden: VIP → Premium → Invitaciones/personal → General → barra del anfiteatro (General y Show).
async function runSitting(resv) {
  const base = await floorData("base");
  const tabs = [];
  base.forEach((d) => {
    const ty = d[0];
    if (!T[ty] || !T[ty].cap || ty === "pt") return;
    const r = d[3] === "v",
      w = r ? T[ty].h : T[ty].w,
      h = r ? T[ty].w : T[ty].h;
    tabs.push({
      key: keyOf(ty, d[1], d[2]),
      floor: "base",
      type: ty,
      x: d[1],
      y: d[2],
      w,
      h,
      cap: T[ty].cap,
      cx: d[1] + w / 2,
      cy: d[2] + h / 2,
      unit: null,
    });
  });
  const tip = { x: 22.5, y: 14.64 };
  tabs.forEach((t) => (t.dist = Math.hypot(t.cx - tip.x, t.cy - tip.y)));
  const vips = tabs.filter((t) => t.type === "vip"),
    mesas = tabs.filter((t) => t.type !== "vip");
  VIPS = vips;
  tabs.forEach((t) => (t.occ = []));
  {
    const row = vips.filter((v) => v.w >= v.h);
    if (row.length) {
      const bx0 = Math.min(...row.map((v) => v.x)),
        bx1 = Math.max(...row.map((v) => v.x + v.w)),
        by0 = Math.min(...row.map((v) => v.y)),
        by1 = Math.max(...row.map((v) => v.y + v.h));
      const outer = (t) => t.type !== "vip" && (t.cx < 12.5 || t.cx > 32.5) && t.cy < by0;
      const dV = (t) => Math.hypot(Math.max(bx0 - t.cx, 0, t.cx - bx1), Math.max(by0 - t.cy, 0, t.cy - by1));
      const os = tabs.filter(outer);
      if (os.length) {
        const base0 = Math.min(...os.map((t) => t.dist));
        os.forEach((t) => {
          t.dist = base0 + dV(t);
        });
      }
    }
  }
  let n = 0;
  [...vips].sort((a, b) => a.y - b.y || a.x - b.x).forEach((t) => (t.id = "V" + ++n));
  n = 0;
  [...mesas].sort((a, b) => a.y - b.y || a.x - b.x).forEach((t) => (t.id = "M" + ++n));
  // Sillones de la planta alta (2 personas con mesa redonda): última opción para General y Show
  const sill = [],
    p2t = [];
  (await floorData("p2")).forEach((d) => {
    if (d[0] !== "sil4") {
      if (T[d[0]] && T[d[0]].cap > 0 && d[0] !== "pt") {
        const r = d[3] === "v",
          w = r ? T[d[0]].h : T[d[0]].w,
          h = r ? T[d[0]].w : T[d[0]].h,
          cx = d[1] + w / 2,
          cy = d[2] + h / 2;
        p2t.push({
          key: keyOf(d[0], d[1], d[2]),
          floor: "p2",
          type: d[0],
          x: d[1],
          y: d[2],
          w,
          h,
          cap: T[d[0]].cap,
          cx,
          cy,
          unit: null,
          dist: Math.hypot(cx - 22.5, cy - 12.3),
        });
      }
      return;
    }
    const r = d[3] === "v",
      w = r ? T.sil4.h : T.sil4.w,
      h = r ? T.sil4.w : T.sil4.h,
      cx = d[1] + w / 2,
      cy = d[2] + h / 2;
    sill.push({
      key: keyOf("sil4", d[1], d[2]),
      floor: "p2",
      type: "sil4",
      x: d[1],
      y: d[2],
      w,
      h,
      cap: T.sil4.cap,
      cx,
      cy,
      unit: null,
      dist: Math.hypot(cx - 22.5, cy - 12.3),
    });
  });
  sill.sort((a, b) => a.x - b.x).forEach((t, k) => (t.id = "S" + (k + 1)));
  p2t.sort((a, b) => a.x - b.x || a.y - b.y).forEach((t, k) => (t.id = "A" + (k + 1)));
  tabs.forEach((t) => (t.floor = "base"));
  tabs.push(...sill, ...p2t);
  // VIP blocks: chains of physically touching VIPs
  const blocks = [];
  const used = new Set();
  for (const v of vips) {
    if (used.has(v)) continue;
    const blk = [v];
    used.add(v);
    let grow = true;
    while (grow) {
      grow = false;
      for (const o of vips) {
        if (used.has(o)) continue;
        if (blk.some((b) => rectGap(b, o) < 0.5)) {
          blk.push(o);
          used.add(o);
          grow = true;
        }
      }
    }
    const horiz =
      Math.max(...blk.map((b) => b.cx)) - Math.min(...blk.map((b) => b.cx)) >=
      Math.max(...blk.map((b) => b.cy)) - Math.min(...blk.map((b) => b.cy));
    blk.sort((a, b) => (horiz ? a.cx - b.cx : b.cy - a.cy));
    blocks.push(blk);
  }
  blocks.sort((a, b) => b.length - a.length);
  const seats = barraSeats().map((s) => ({ ...s, id: "B" + (s.i + 1), unit: null, pmr: false }));
  // units (merge group codes within same category)
  const units = [];
  const byGr = {};
  for (const r of resv) {
    if (r.gr) {
      const k = r.cat + "|" + r.gr;
      if (byGr[k]) {
        const u = byGr[k];
        u.res.push(r);
        u.pax += r.pax;
        u.pmr += r.pmr;
        u.cu = u.cu || r.cu;
        u.staff = u.staff || r.staff;
        u.gest = u.gest || r.ges;
        continue;
      }
    }
    const u = {
      res: [r],
      cat: r.cat,
      pax: r.pax,
      pmr: r.pmr,
      cu: r.cu,
      staff: r.staff,
      gest: r.ges,
      where: [],
      note: "",
    };
    units.push(u);
    if (r.gr) byGr[r.cat + "|" + r.gr] = u;
  }
  units.forEach((u, i) => {
    u.idx = i;
    u.name = u.res.map((r) => r.nom).join(" + ");
  });
  const warn = [];
  function seatRun(zoneFilter, u, order) {
    const need = u.pax - u.pmr + 2 * u.pmr;
    const list = seats.filter((s) => zoneFilter(s.zone));
    const ordered = order === "rev" ? list.slice().reverse() : list;
    for (let i = 0; i + need <= ordered.length; i++) {
      const run = ordered.slice(i, i + need);
      if (run.every((s) => !s.unit) && run.every((s, j) => j === 0 || Math.abs(s.i - run[j - 1].i) === 1)) {
        run.forEach((s, j) => {
          s.unit = u;
          s.pmr = j < 2 * u.pmr;
        });
        const ids = run.map((s) => s.i + 1).sort((a, b) => a - b);
        u.where.push(
          "Barra anfiteatro " +
            (ids.length > 1 ? "B" + ids[0] + "–B" + ids[ids.length - 1] : "B" + ids[0]) +
            (u.pmr ? " (" + u.pmr + " PMR)" : ""),
        );
        return true;
      }
    }
    return false;
  }
  // 1. VIP
  // Orden de los VIP: primero la fila frontal, después los laterales más cercanos a ella; los que sobran son los laterales más cercanos al escenario
  function placeVip(u) {
    const k = Math.ceil(u.pax / 4);
    const cands = [];
    for (const blk of blocks)
      for (let i = 0; i + k <= blk.length; i++) {
        const run = blk.slice(i, i + k);
        if (run.every((v) => !v.unit)) {
          cands.push({ run, score: (blk.length >= 9 ? 0 : 1) * 100 + i });
        }
      }
    cands.sort((a, b) => a.score - b.score);
    if (!cands.length) return false;
    const run = cands[0].run;
    run.forEach((v) => addOcc(v, u));
    u.where.push(run.map((v) => v.id).join("+"));
    return true;
  }
  // ---- Reservas gestionadas por la propiedad, el jefe de sala y el regidor (prioridad)
  const row = blocks.find((b) => b.length >= 9) || [],
    central =
      row.length >= 9 ? row.slice(Math.floor(row.length / 2) - 1, Math.floor(row.length / 2) + 2) : [];
  const latV0 = vips.filter((v) => v.w < v.h),
    isBL0 = (t) =>
      t.type !== "vip" &&
      ((latV0.some((v) => v.cx < 22.5) &&
        t.cx < Math.min(...latV0.filter((v) => v.cx < 22.5).map((v) => v.x))) ||
        (latV0.some((v) => v.cx >= 22.5) &&
          t.cx > Math.max(...latV0.filter((v) => v.cx >= 22.5).map((v) => v.x + v.w))));
  const gTag = { Propiedad: " · propiedad", "Jefe de sala": " · jefe de sala", Regidor: " · regidor" };
  function vipBy(u, scoreFn) {
    const k = Math.ceil(u.pax / 4);
    const c = [];
    for (const blk of blocks)
      for (let i = 0; i + k <= blk.length; i++) {
        const run = blk.slice(i, i + k);
        if (run.every((v) => !v.unit)) {
          const sc = scoreFn(blk, i, k);
          if (sc != null) c.push({ run, sc });
        }
      }
    c.sort((a, b) => a.sc - b.sc);
    if (!c.length) return false;
    c[0].run.forEach((v) => addOcc(v, u));
    u.where.push(c[0].run.map((v) => v.id).join("+"));
    return true;
  }
  const mid9 = (row.length - 1) / 2,
    rowScore = (blk, i, k) => (blk === row ? Math.abs(i + (k - 1) / 2 - mid9) : 100 + i);
  // mesas del regidor: si tiene reservas, quedan apartadas para él
  const regU = units.filter((u) => u.gest === "Regidor"),
    regT = tabs.filter((t) => REGIDOR_MESAS.includes(t.id)),
    HOLD = { cat: "Apartada", pax: 0, res: [{ nom: "Regidor" }] };
  if (regU.length) regT.forEach((t) => addOcc(t, HOLD));
  if (regU.length && !regT.length)
    warn.push(
      "Hay reservas del regidor pero todavía no están definidas sus mesas: van a VIP libres y después a mesas General de dentro de los VIP.",
    );
  // 1) Propiedad (familia Angulo): los 3 VIP centrales
  for (const u of units.filter((u) => u.gest === "Propiedad").sort((a, b) => b.pax - a.pax)) {
    if (
      vipBy(u, (blk, i, k) => {
        const r = blk.slice(i, i + k);
        return r.every((v) => central.includes(v)) ? rowScore(blk, i, k) : null;
      }) ||
      vipBy(u, rowScore)
    ) {
      u.where[u.where.length - 1] += gTag[u.gest];
      continue;
    }
    u.gest = "";
  }
  // 2) Jefe de sala: las mejores mesas de toda la sala (los 3 VIP centrales si la propiedad no los usa, después el resto de VIP, las mesas de 8 y las mesas de dentro de los VIP)
  {
    const best = tabs
      .filter((t) => t.floor === "base" && t.type !== "vip" && !isBL0(t))
      .sort((a, b) => (a.type === "m8" ? 0 : 1) - (b.type === "m8" ? 0 : 1) || a.dist - b.dist);
    for (const u of units.filter((u) => u.gest === "Jefe de sala").sort((a, b) => b.pax - a.pax)) {
      if (vipBy(u, rowScore) || placeOnTables(u, best, false) || placeOnTables(u, best, true)) {
        u.where[u.where.length - 1] += gTag[u.gest];
        continue;
      }
      u.gest = "";
    }
  }
  units
    .filter((u) => u.cat === "VIP" && !u.gest)
    .sort((a, b) => b.pax - a.pax)
    .forEach((u) => {
      const k = Math.ceil(u.pax / 4);
      let done = placeVip(u);
      if (!done) {
        warn.push("VIP sin hueco: " + u.name + " (" + u.pax + " pax, necesita " + k + " VIP pegados)");
        u.note = "Sin ubicar";
      }
      if (u.pmr) warn.push("PMR en VIP: " + u.name + " – revisar accesibilidad");
    });
  // 2. Premium (mesas de 8 alrededor de la pasarela; nunca en VIP)
  const isPrem = (t) => t.type === "m8";
  // Persona sola en mesa compartida: ocupa su propia pareja de sillas; con otra persona sola al lado, en diagonal (nunca cara a cara ni hombro con hombro)
  function placeSingle(u, pool) {
    let best = null;
    for (const t of pool) {
      if (nCols(t) < 2) continue;
      if (occOf(t).length && !occOf(t).every((o) => compat(o.u, u))) continue;
      const used = usedCols(t);
      const solo = (c) => occOf(t).some((o) => o.u.pax === 1 && o.cols.length === 1 && o.cols[0] === c);
      for (const c of colOrder(t)) {
        if (used.has(c) || (solo(c - 1) && solo(c + 1))) continue;
        const sc = t.dist + (occOf(t).length ? 0 : 3);
        if (!best || sc < best.sc) best = { t, c, sc };
        break;
      }
    }
    if (!best) return false;
    const sh = occOf(best.t).length > 0;
    addOcc(best.t, u, [best.c]);
    u.where.push(best.t.id + " (" + T[best.t.type].n + ")" + (sh ? " · compartida" : ""));
    return true;
  }
  function placeOnTables(u, pool, share) {
    // una mesa: la que deja menos sillas vacías y está más cerca del escenario
    let best = null;
    for (const t of pool) {
      const cols = fitCols(u, t, share);
      if (!cols) continue;
      const waste =
        (nCols(t) - usedCols(t).size - cols.length) * perCol(t) + (cols.length * perCol(t) - u.pax);
      const sc = t.dist + 1.5 * (share ? waste : t.cap - u.pax);
      if (!best || sc < best.sc) best = { t, cols, sc };
    }
    if (best) {
      const sh = occOf(best.t).length > 0;
      addOcc(best.t, u, best.cols);
      u.where.push(best.t.id + " (" + T[best.t.type].n + ")" + (sh ? " · compartida" : ""));
      return true;
    }
    // dos mesas vacías pegadas
    const free = pool.filter((t) => !occOf(t).length && nCols(t) > 1);
    let b2 = null;
    for (let i = 0; i < free.length; i++)
      for (let j = i + 1; j < free.length; j++) {
        const a = free[i],
          b = free[j];
        if (rectGap(a, b) > 0.8) continue;
        const c = a.cap + b.cap;
        if (c < u.pax) continue;
        const s2 = (c - u.pax) * 10 + Math.min(a.dist, b.dist);
        if (!b2 || s2 < b2.sc) b2 = { a, b, sc: s2 };
      }
    if (b2) {
      addOcc(b2.a, u);
      addOcc(b2.b, u);
      u.where.push(b2.a.id + "+" + b2.b.id + " (mesas juntas)");
      return true;
    }
    return false;
  }
  // 3) Regidor: sus mesas → VIP vacíos → mesas General de dentro de los VIP
  regT.forEach((t) => remOcc(t, HOLD));
  {
    const inner = tabs.filter((t) => t.floor === "base" && t.type !== "vip" && t.type !== "m8" && !isBL0(t));
    for (const u of regU.sort((a, b) => b.pax - a.pax)) {
      if (
        placeOnTables(u, regT, false) ||
        placeOnTables(u, regT, true) ||
        placeVip(u) ||
        placeOnTables(u, inner, false) ||
        placeOnTables(u, inner, true)
      ) {
        u.where[u.where.length - 1] += gTag[u.gest];
        continue;
      }
      u.gest = "";
    }
  }
  {
    const pf = [];
    for (const u of units.filter((u) => u.cat === "Premium" && !u.gest).sort((a, b) => b.pax - a.pax)) {
      if (u.pmr) warn.push("PMR en Premium: " + u.name + " – revisar accesibilidad de su mesa");
      if (!placeOnTables(u, mesas.filter(isPrem), false)) pf.push(u);
    }
    // si no caben todas en mesas propias, se comparten mesas de 8 entre reservas Premium
    // Premium que no cabe en mesa propia: las reservas de 3 o más van a los VIP que sobran (una por VIP); las de 1–2, o si no hay VIP libre, comparten mesa de 8
    for (const u of pf) {
      if (u.pax >= 3 && placeVip(u)) {
        u.where[u.where.length - 1] += " (VIP libre)";
        continue;
      }
      if (placeOnTables(u, mesas.filter(isPrem), true)) continue;
      // Premium que no cabe ni en las mesas de 8 ni en VIP: la mejor mesa General de delante de los VIP (más cercana al escenario), con aviso
      const fr = mesas.filter((t) => t.type !== "m8" && t.type !== "m4u" && !isBL0(t));
      if (placeOnTables(u, fr, false) || placeOnTables(u, fr, true)) {
        u.where[u.where.length - 1] += " · Premium en mesa General";
        warn.push(
          "Premium sin sitio en mesas de 8 ni VIP: " +
            u.name +
            " (" +
            u.pax +
            " pax) va a " +
            u.where[u.where.length - 1].split(" ")[0] +
            ", mesa General más cercana al escenario",
        );
        continue;
      }
      warn.push("Premium sin hueco: " + u.name + " (" + u.pax + " pax)");
      u.note = "Sin ubicar";
    }
  }
  // 3. General: huecos Premium sobrantes (más cerca de la pasarela) → mesas General → barra del anfiteatro (centro). Con PMR: barra.
  const toBarra = [];
  const isTwo = (t) => t.type === "m4u";
  let front, back;
  {
    const pairs = [],
      singles = [];
    // Mesas detrás de los VIP laterales (hacia la pared): no son prioridad. Solo se usan cuando las de delante (incluso compartiendo) están llenas, y de la más lejana al escenario a la más cercana.
    const latV = vips.filter((v) => v.w < v.h),
      latL = latV.filter((v) => v.cx < 22.5),
      latR = latV.filter((v) => v.cx >= 22.5);
    const isBL = (t) =>
      t.type !== "vip" &&
      ((latL.length && t.cx < Math.min(...latL.map((v) => v.x))) ||
        (latR.length && t.cx > Math.max(...latR.map((v) => v.x + v.w))));
    mesas.filter(isBL).forEach((t) => (t.dist = 1000 - 10 * t.cy));
    front = mesas.filter((t) => !isBL(t));
    back = mesas.filter(isBL);
    for (const u of units
      .filter((u) => u.cat === "General" && !u.gest)
      .sort((a, b) => (b.pmr > 0) - (a.pmr > 0) || !!b.staff - !!a.staff || b.pax - a.pax)) {
      if (u.pmr) {
        toBarra.push(u);
        continue;
      }
      if (u.staff) {
        if (placeOnTables(u, front.filter(isPrem))) {
          u.where[u.where.length - 1] += " · hueco Premium";
          continue;
        }
        if (
          placeOnTables(
            u,
            front.filter((t) => !isPrem(t)),
          )
        )
          continue;
        toBarra.push(u);
        continue;
      }
      if (u.pax === 1) {
        singles.push(u);
        continue;
      }
      if (placeOnTables(u, front.filter(isPrem))) {
        u.where[u.where.length - 1] += " · hueco Premium";
        continue;
      }
      if (
        placeOnTables(
          u,
          front.filter((t) => !isPrem(t) && !isTwo(t)),
        )
      )
        continue;
      if (u.pax === 2) {
        pairs.push(u);
        continue;
      }
      toBarra.push(u);
    }
    for (const u of pairs) {
      if (!placeOnTables(u, front.filter(isTwo))) toBarra.push(u);
    }
    // personas solas: mesa de 2 libre de planta baja; si no hay, al anfiteatro
    for (const u of singles) {
      if (placeOnTables(u, mesas.filter(isTwo))) continue;
      toBarra.push(u);
    }
    // planta baja ante todo: compartir mesas General de delante → mesas de detrás de los VIP laterales (propias y después compartidas) → huecos de las mesas Premium
    const hasPrem = (t) => occOf(t).some((o) => o.u.cat === "Premium");
    const steps = [
      [front.filter((t) => !hasPrem(t)), true, ""],
      [back, false, ""],
      [back, true, ""],
      [mesas.filter(hasPrem), true, " con Premium"],
    ];
    for (const [pool, sh, tag] of steps) {
      const left = toBarra.filter((u) => !u.pmr && u.pax > 1).sort((a, b) => b.pax - a.pax);
      for (const u of left) {
        if (
          placeOnTables(
            u,
            pool.filter((t) => !hasPrem(t) || tag),
            sh,
          )
        ) {
          if (tag) u.where[u.where.length - 1] += tag;
          toBarra.splice(toBarra.indexOf(u), 1);
        }
      }
    }
  }
  // 4. Barra del anfiteatro de dentro hacia fuera (General en el centro, después Show), con una silla libre entre reservas.
  // Si la sala se llena, se quitan las separaciones de las curvas y laterales (el tramo central las mantiene).
  const nS = seats.length,
    mid = Math.floor(nS / 2);
  let lo,
    hi,
    lastSide = null,
    curveFree = 0;
  function resetBarra() {
    seats.forEach((x) => {
      x.unit = null;
      x.pmr = false;
    });
    lo = mid;
    hi = mid - 1;
    lastSide = null;
  }
  function takeSide(u, force) {
    const need = u.pax - u.pmr + 2 * u.pmr;
    if (hi < lo) {
      if (need > nS) return false;
      const st = Math.floor((nS - need) / 2),
        run = seats.slice(st, st + need);
      lo = st;
      hi = st + need - 1;
      const ctr = (need - 1) / 2,
        ord = run.map((x, k) => ({ x, d: Math.abs(k - ctr) })).sort((a, b) => a.d - b.d);
      ord.forEach((o, k) => {
        o.x.unit = u;
        o.x.pmr = k < 2 * u.pmr;
      });
      u.where.push(
        "Barra anfiteatro " +
          (need > 1 ? "B" + (st + 1) + "–B" + (st + need) : "B" + (st + 1)) +
          (u.pmr ? " (" + u.pmr + " PMR)" : ""),
      );
      return true;
    }
    const lExt = mid - lo,
      rExt = hi - (mid - 1);
    const solo = (x) => x && x.unit && x.unit.pax === 1 && u.pax === 1; // dos personas solas nunca hombro con hombro: entre ellas la silla libre se mantiene
    const gL = curveFree > 0 && seats[lo - 1] && seats[lo - 1].zone !== "central" && !solo(seats[lo]) ? 0 : 1,
      gR = curveFree > 0 && seats[hi + 1] && seats[hi + 1].zone !== "central" && !solo(seats[hi]) ? 0 : 1;
    const canL = lo - gL - need >= 0,
      canR = hi + gR + need <= nS - 1;
    let side = null;
    if (force === "L" && canL) side = "L";
    else if (force === "R" && canR) side = "R";
    else if (lExt <= rExt) {
      side = canL ? "L" : canR ? "R" : null;
    } else {
      side = canR ? "R" : canL ? "L" : null;
    }
    if (!side) return false;
    lastSide = side;
    let run;
    if (side === "L") {
      if (!gL) curveFree--;
      run = seats.slice(lo - gL - need, lo - gL).reverse();
      lo -= need + gL;
    } else {
      if (!gR) curveFree--;
      run = seats.slice(hi + 1 + gR, hi + 1 + gR + need);
      hi += need + gR;
    }
    run.forEach((x, k) => {
      x.unit = u;
      x.pmr = k < 2 * u.pmr;
    });
    const ids = run.map((x) => x.i + 1).sort((a, b) => a - b);
    u.where.push(
      "Barra anfiteatro " +
        (ids.length > 1 ? "B" + ids[0] + "–B" + ids[ids.length - 1] : "B" + ids[0]) +
        (u.pmr ? " (" + u.pmr + " PMR)" : ""),
    );
    return true;
  }
  function runBarra(list) {
    resetBarra();
    let prevSingleCat = null,
      sSide = null;
    const failed = [];
    list.forEach((u) => {
      u.where = u.where.filter((w) => !w.startsWith("Barra"));
      let force = null;
      if (u.pax === 1 && !u.pmr && prevSingleCat === u.cat) force = sSide;
      const ok = takeSide(u, force);
      if (ok && u.pax === 1 && !u.pmr) {
        prevSingleCat = u.cat;
        sSide = lastSide;
      }
      if (!ok) failed.push(u);
    });
    return failed;
  }
  {
    const big = (a, b) => b.pax - a.pax,
      shows = units.filter((u) => u.cat === "Show" && !u.gest);
    const grp = (l) => l.filter((u) => !u.pmr && u.pax > 1).sort(big),
      sgl = (l) => l.filter((u) => !u.pmr && u.pax === 1);
    const order = [
      ...toBarra.filter((u) => u.pmr).sort(big),
      ...shows.filter((u) => u.pmr).sort(big),
      ...grp(toBarra),
      ...sgl(toBarra),
      ...grp(shows),
      ...sgl(shows),
    ];
    let failed = runBarra(order),
      kBest = 0;
    // Show que no cabe en la barra: mesas de la planta alta
    // Show que no cabe en la barra: primero las mesas de 2 junto a los sillones (mejor visibilidad)
    const p2two = p2t.filter((t) => t.type === "m4u"),
      p2lat = p2t.filter((t) => t.type !== "m4u");
    failed = failed.filter((u) => {
      if (u.cat === "Show" && placeOnTables(u, p2two)) {
        u.where[u.where.length - 1] += " · planta alta";
        return false;
      }
      return true;
    });
    // Sala llena: se quitan las separaciones de las curvas y laterales y se vuelve a repartir la barra
    // de forma progresiva: primero las separaciones más cercanas al centro, hasta que quepan todos
    if (failed.length) {
      const onTables = new Set(p2t.filter((t) => t.unit).map((t) => t.unit)),
        rest = order.filter((u) => !onTables.has(u)),
        pax = (l) => l.reduce((a, u) => a + u.pax, 0);
      let best = 0,
        bestF = pax(failed);
      for (let k = 1; k <= nS && bestF > 0; k++) {
        curveFree = k;
        const f = pax(runBarra(rest));
        if (curveFree > 0) break;
        if (f < bestF) {
          bestF = f;
          best = k;
        }
      }
      curveFree = best;
      kBest = best;
      failed = runBarra(rest);
      curveFree = 0;
      if (best)
        warn.push(
          "Sala llena: se han quitado " +
            best +
            " sillas de separación en las curvas y laterales de la barra (empezando por las más cercanas al centro)",
        );
    }
    // General que baja a planta baja: compartir mesa de 4, 6 u 8 (las personas solas, nunca cara a cara ni hombro con hombro con otra persona sola)
    function downGeneral(u) {
      const hp = (t) => occOf(t).some((o) => o.u.cat === "Premium"),
        nt = mesas.filter((t) => t.type !== "m4u");
      for (const [pool, tag] of [
        [front.filter((t) => t.type !== "m4u" && !hp(t)), ""],
        [back.filter((t) => t.type !== "m4u"), ""],
        [nt.filter(hp), " con Premium"],
      ]) {
        const ok = u.pax === 1 ? placeSingle(u, pool) : placeOnTables(u, pool, true);
        if (ok) {
          if (tag) u.where[u.where.length - 1] += tag;
          return true;
        }
      }
      return false;
    }
    // Si aún falta sitio para Show en la barra, las personas solas de General le dejan la barra y bajan a compartir mesa (de la más exterior a la más central)
    if (failed.some((u) => u.cat === "Show")) {
      const onT = new Set(p2t.filter((t) => t.unit).map((t) => t.unit));
      let cur = order.filter((u) => !onT.has(u));
      const sol = cur.filter((u) => u.cat === "General" && u.pax === 1 && !u.pmr && !failed.includes(u));
      sol.sort(
        (a, b) =>
          Math.abs(Math.min(...seats.filter((x) => x.unit === b).map((x) => x.i)) - mid) -
          Math.abs(Math.min(...seats.filter((x) => x.unit === a).map((x) => x.i)) - mid),
      );
      for (const u of sol) {
        if (!failed.some((f) => f.cat === "Show")) break;
        u.where = u.where.filter((w) => !w.startsWith("Barra"));
        if (!downGeneral(u)) break;
        cur = cur.filter((x) => x !== u);
        curveFree = kBest;
        failed = runBarra(cur);
        curveFree = 0;
      }
    }
    // después las mesas laterales del anfiteatro y, como última opción, los sillones
    failed = failed.filter((u) => {
      if (u.cat === "Show" && (placeOnTables(u, p2lat) || placeOnTables(u, [...p2two, ...p2lat], true))) {
        u.where[u.where.length - 1] += " · planta alta";
        return false;
      }
      return true;
    });
    // General que no cabe en el anfiteatro (personas solas): compartir mesa de 4, 6 u 8 en planta baja (nunca cara a cara ni hombro con hombro con otra persona sola)
    failed = failed.filter((u) => !(u.cat === "General" && downGeneral(u)));
    failed.forEach((u) => {
      if (placeOnTables(u, sill)) {
        u.where[u.where.length - 1] += " · planta alta";
        return;
      }
      warn.push(
        (u.cat === "Show"
          ? "Show sin hueco en la barra, mesas de planta alta ni sillones: "
          : "General sin hueco (ni en planta baja, ni en la barra, ni en los sillones): ") +
          u.name +
          " (" +
          u.pax +
          " pax)",
      );
      u.note = "Sin ubicar";
    });
  }
  {
    const bu = [...new Set(seats.filter((x) => x.unit).map((x) => x.unit))];
    bu.sort(
      (a, b) =>
        Math.min(...seats.filter((x) => x.unit === a).map((x) => x.i)) -
        Math.min(...seats.filter((x) => x.unit === b).map((x) => x.i)),
    );
    bu.forEach((u, k) => {
      u.mesaNo = 500 + k;
      u.where = u.where.map((w) =>
        w.startsWith("Barra") ? "Mesa " + u.mesaNo + " · " + w.replace("Barra anfiteatro", "barra") : w,
      );
    });
  }
  // 4. Premium

  const other = units.filter((u) => !["VIP", "Show", "General", "Premium"].includes(u.cat));
  other.forEach((u) => {
    u.note = "Categoría desconocida";
    warn.push("Categoría desconocida: " + u.cat + " (" + u.name + ")");
  });
  tabs.forEach((t) => {
    if (occOf(t).length > 1)
      t.occ.forEach((o) => {
        o.u.where = o.u.where.map((w) =>
          w.startsWith(t.id + " (") && !w.includes("compartida") ? w + " · compartida" : w,
        );
      });
  });
  const tmap = {};
  tabs.forEach((t) => {
    if (occOf(t).length) tmap[t.key] = t;
  });
  SIT = { units, warn, tmap, seats, tabs, vipBlocks: blocks };
}
// ¿Alguna persona de la reserva tiene alergias o intolerancias?
function hasAl(u) {
  return u.res.some((r) => r.al);
}
// Dibuja los iconos ⚠ (alergias) y 🎂 (cumpleaños) en fila.
function badges(g, px, py, u) {
  let k = 0;
  const one = (txt, col, title) => {
    const cx = px + k * 10,
      cy = py;
    const b = el("g", {}, g);
    el("circle", { cx, cy, r: 4.6, fill: "#fff", stroke: col, "stroke-width": 1.2 }, b);
    el(
      "text",
      { x: cx, y: cy + 0.4, "text-anchor": "middle", "dominant-baseline": "central", "font-size": 6 },
      b,
      txt,
    );
    k++;
  };
  if (hasAl(u)) one("⚠", "#A32D2D");
  if (u.cu) one("🎂", "#854F0B");
}
// Dibuja un icono (⚠ o 🎂) en un punto.
function badgeOne(g, cx, cy, ic) {
  const col = ic === "al" ? "#A32D2D" : "#854F0B",
    txt = ic === "al" ? "⚠" : "🎂";
  const b = el("g", {}, g);
  el("circle", { cx, cy, r: 4.6, fill: "#fff", stroke: col, "stroke-width": 1.2 }, b);
  el(
    "text",
    { x: cx, y: cy + 0.4, "text-anchor": "middle", "dominant-baseline": "central", "font-size": 6 },
    b,
    txt,
  );
}
// Texto con el detalle de una reserva (al tocar su mesa).
function unitInfo(u) {
  const al = u.res
    .map((r) => r.al)
    .filter(Boolean)
    .join("; ");
  return (
    u.name +
    " · " +
    u.cat +
    (u.staff ? " (" + u.staff + ")" : "") +
    (u.gest ? " · reserva de " + u.gest.toLowerCase() : "") +
    " · " +
    u.pax +
    " pax" +
    (al ? " · Alergias: " + al : "") +
    (u.cu ? " · Cumpleaños" : "") +
    (u.pmr ? " · " + u.pmr + " PMR" : "")
  );
}
// Dibuja el sitting encima del plano: colores por categoría, nombres, iconos, puntos verdes y números de la barra.
function sitOverlay() {
  const g = document.getElementById("sitfx");
  if (!g) return;
  g.innerHTML = "";
  if (!SIT) return;
  {
    const bdone = new Set();
    for (const t of Object.values(SIT.tmap).filter((t) => t.floor === FLOOR)) {
      if (occOf(t).length > 1) {
        drawShared(g, t);
        continue;
      }
      const c = CATC[t.unit.cat] || "#888";
      el(
        "rect",
        {
          x: X(t.x),
          y: Y(t.y),
          width: t.w * S,
          height: t.h * S,
          rx: 3,
          fill: c,
          "fill-opacity": 0.55,
          stroke: t.unit.pmr ? PMRC : isInv(t.unit) ? INVC : c,
          "stroke-width": t.unit.pmr || isInv(t.unit) ? 2.8 : 1.5,
        },
        g,
      );
      if (t.unit.pmr && isInv(t.unit))
        el(
          "rect",
          {
            x: X(t.x) + 2.6,
            y: Y(t.y) + 2.6,
            width: t.w * S - 5.2,
            height: t.h * S - 5.2,
            rx: 2,
            fill: "none",
            stroke: INVC,
            "stroke-width": 2,
          },
          g,
        );
      const nm = t.unit.res[0].nom.split(/[ ,]/)[0].slice(0, 9);
      el(
        "text",
        {
          x: X(t.x + t.w / 2),
          y: Y(t.y + t.h / 2),
          "text-anchor": "middle",
          "dominant-baseline": "central",
          "font-size": t.w < 1.2 || t.h < 1.2 ? 7 : 9,
          fill: "var(--txt)",
          "font-weight": 600,
          transform: t.h > t.w * 1.5 ? "rotate(-90 " + X(t.x + t.w / 2) + " " + Y(t.y + t.h / 2) + ")" : "",
        },
        g,
        nm,
      );
      if (!bdone.has(t.unit)) {
        bdone.add(t.unit);
        const nb = (hasAl(t.unit) ? 1 : 0) + (t.unit.cu ? 1 : 0);
        if (nb) {
          const ut = SIT.tabs.filter((q) => q.unit === t.unit),
            x0 = Math.min(...ut.map((q) => q.x)),
            x1 = Math.max(...ut.map((q) => q.x + q.w)),
            y0 = Math.min(...ut.map((q) => q.y)),
            y1 = Math.max(...ut.map((q) => q.y + q.h)),
            cy = (y0 + y1) / 2,
            horiz = x1 - x0 >= y1 - y0;
          const icons = [];
          if (hasAl(t.unit)) icons.push("al");
          if (t.unit.cu) icons.push("cu");
          if (t.type === "vip" && !horiz) {
            const ex = t.cx < 22.5 ? x1 : x0;
            icons.forEach((ic, k) => badgeOne(g, X(ex), Y(cy) + (k - (icons.length - 1) / 2) * 10, ic));
          } else if (horiz && t.type === "vip") {
            icons.forEach((ic, k) =>
              badgeOne(g, X((x0 + x1) / 2) + (k - (icons.length - 1) / 2) * 10, Y(y0), ic),
            );
          } else if (horiz && (t.type === "m6" || t.type === "m4") && (x1 < 7.3 || x0 > 37.5)) {
            const ex = x1 < 7.3 ? x0 : x1;
            icons.forEach((ic, k) => badgeOne(g, X(ex), Y(cy) + (k - (icons.length - 1) / 2) * 10, ic));
          } else if (horiz && t.type === "m8") {
            const ex = (x0 + x1) / 2 < 22.5 ? x1 : x0;
            icons.forEach((ic, k) => badgeOne(g, X(ex), Y(cy) + (k - (icons.length - 1) / 2) * 10, ic));
          } else if (
            horiz &&
            (t.type === "m6" || t.type === "m4u") &&
            [12.5, 32.5].some((w) => Math.abs(x0 - w) < 0.6 || Math.abs(x1 - w) < 0.6)
          ) {
            const w = [12.5, 32.5].find((w) => Math.abs(x0 - w) < 0.6 || Math.abs(x1 - w) < 0.6),
              ex = Math.abs(x0 - w) < Math.abs(x1 - w) ? x1 : x0;
            icons.forEach((ic, k) => badgeOne(g, X(ex), Y(cy) + (k - (icons.length - 1) / 2) * 10, ic));
          } else if (horiz) {
            badgeOne(g, X(x0), Y(cy), icons[0]);
            if (icons[1]) badgeOne(g, X(x1), Y(cy), icons[1]);
          } else badges(g, X((x0 + x1) / 2) - (nb - 1) * 5, Y(y0), t.unit);
        }
      }
    }
    drawDots(g);
  }
  if (FLOOR === "p2") {
    const done = new Set();
    for (const s of SIT.seats) {
      if (!s.unit || done.has(s.unit) || !s.unit.mesaNo) continue;
      done.add(s.unit);
      const ss = SIT.seats.filter((x) => x.unit === s.unit),
        m = ss[Math.floor(ss.length / 2)],
        nx = m.x - (m.x < 22.5 ? 0.9 : -0.9) * (m.y < 17 ? 1 : 0),
        ny = m.y + (m.y >= 17 ? 0.75 : 0);
      el(
        "text",
        {
          x: X(m.y >= 17 ? m.x : nx),
          y: Y(m.y >= 17 ? m.y + 0.75 : m.y),
          "text-anchor": "middle",
          "dominant-baseline": "central",
          "font-size": 9,
          "font-weight": 600,
          fill: "var(--txt)",
        },
        g,
        s.unit.mesaNo,
      );
      badges(
        g,
        X(m.y >= 17 ? m.x : nx) - ((hasAl(s.unit) ? 1 : 0) + (s.unit.cu ? 1 : 0) - 1) * 5,
        Y(m.y >= 17 ? m.y + 0.75 : m.y) + 11,
        s.unit,
      );
    }
    for (const s of SIT.seats) {
      const c = s.unit ? CATC[s.unit.cat] || "#888" : "none";
      if (s.unit && !s.pmr)
        el("circle", { cx: X(s.x), cy: Y(s.y), r: Math.max(2, 0.1 * S), fill: "#3B6D11" }, g);
      const sr = el(
        "rect",
        {
          x: (-s.cw * S) / 2,
          y: (-s.cd * S) / 2,
          width: s.cw * S,
          height: s.cd * S,
          rx: 2,
          fill: s.unit ? c : "var(--card)",
          "fill-opacity": s.unit ? 0.85 : 1,
          stroke: s.unit && s.unit.pmr ? PMRC : isInv(s.unit) ? INVC : "var(--muted)",
          "stroke-width": s.unit && (s.unit.pmr || isInv(s.unit)) ? 1.8 : 0.6,
          transform: "translate(" + X(s.x) + " " + Y(s.y) + ") rotate(" + s.ang + ")",
        },
        g,
      );
      if (s.unit) {
        const uu = s.unit;
        sr.style.pointerEvents = "all";
        sr.style.cursor = "pointer";
        sr.addEventListener("pointerdown", (ev) => {
          ev.stopPropagation();
          ev.preventDefault();
          showPop(uu);
        });
      }
    }
  }
}
function showPop(u) {
  if (!u || !u.res) return;
  const box = document.getElementById("pop");
  const e = esc_;
  const tabsU = SIT ? SIT.tabs.filter((t) => occOf(t).some((o) => o.u === u)) : [],
    mates = [...new Set(tabsU.flatMap((t) => t.occ.map((o) => o.u)).filter((x) => x !== u))];
  const al = u.res.filter((r) => r.al),
    obs = u.res.map((r) => r.ob).filter(Boolean),
    mn = u.res.reduce((a, r) => a + (r.mn || 0), 0),
    veg = u.res.reduce((a, r) => a + r.veg, 0),
    ni = u.res.reduce((a, r) => a + r.nino, 0);
  const contact = (v) => {
    v = String(v).trim();
    if (!v) return "";
    if (v.includes("@")) return '<a href="mailto:' + e(v) + '">' + e(v) + "</a>";
    const d = v.replace(/[^+\d]/g, "");
    return d.length >= 6 ? '<a href="tel:' + e(d) + '">' + e(v) + "</a>" : e(v);
  };
  let h =
    '<button class="x" aria-label="Cerrar">×</button><h3>' +
    e(u.name) +
    '</h3><div class="sub">' +
    e(
      u.res
        .map((r) => r.res)
        .filter(Boolean)
        .join(", "),
    ) +
    "</div>";
  h +=
    '<span class="tag" style="background:' +
    (CATC[u.cat] || "#888") +
    '">' +
    e(u.cat) +
    "</span>" +
    (u.pmr ? '<span class="tag" style="background:' + PMRC + '">' + u.pmr + " PMR</span>" : "") +
    (u.cu ? '<span class="tag" style="background:#854F0B">🎂 Cumpleaños</span>' : "");
  if (u.staff || u.gest)
    h +=
      '<div class="inv">' +
      (u.staff ? "Invitación / personal: " + e(u.staff) : "Reserva con prioridad") +
      (u.gest
        ? " · gestionada por " + e(u.gest.toLowerCase()) + (u.gest === "Propiedad" ? " (familia Angulo)" : "")
        : "") +
      "</div>";
  if (al.length)
    h +=
      '<div class="al">⚠ Alergias / intolerancias:<br>' +
      al.map((r) => (u.res.length > 1 ? e(r.nom) + ": " : "") + e(r.al)).join("<br>") +
      "</div>";
  h +=
    "<dl><dt>Personas</dt><dd>" +
    u.pax +
    "</dd><dt>Menús</dt><dd>" +
    [mn ? mn + " Nomad" : "", veg ? veg + " vegano" : "", ni ? ni + " niño" : ""].filter(Boolean).join(", ") +
    "</dd>";
  h +=
    "<dt>Ubicación</dt><dd>" +
    (u.where.length ? e(u.where.join(", ")) : "<i>" + e(u.note || "Sin ubicar") + "</i>") +
    "</dd>";
  if (mates.length)
    h +=
      "<dt>Comparte mesa con</dt><dd>" +
      mates.map((m) => e(m.name) + " (" + e(m.cat) + ", " + m.pax + ")").join("<br>") +
      "</dd>";
  const tels = u.res.filter((r) => r.tel);
  if (tels.length)
    h +=
      "<dt>Contacto</dt><dd>" +
      tels.map((r) => (u.res.length > 1 ? e(r.nom) + ": " : "") + contact(r.tel)).join("<br>") +
      "</dd>";
  const gr = [...new Set(u.res.map((r) => r.gr).filter(Boolean))];
  if (gr.length)
    h +=
      "<dt>Código de grupo</dt><dd>" +
      e(gr.join(", ")) +
      (u.res.length > 1 ? " (" + u.res.length + " reservas juntas)" : "") +
      "</dd>";
  if (obs.length) h += "<dt>Observaciones</dt><dd>" + obs.map(e).join("<br>") + "</dd>";
  h += "</dl>";
  box.innerHTML = '<div class="popc" role="dialog">' + h + "</div>";
  box.style.display = "flex";
  box.onclick = (ev) => {
    if (ev.target === box || ev.target.closest(".x")) box.style.display = "none";
  };
}
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") {
    const b = document.getElementById("pop");
    if (b) b.style.display = "none";
  }
});
// Escapa texto para mostrarlo en la tabla sin riesgo.
function esc_(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}
// Pinta el resumen, los avisos y la tabla de reservas bajo el plano.
function showSitting() {
  const box = document.getElementById("sitres");
  if (!SIT) {
    box.innerHTML = "";
    return;
  }
  const U = SIT.units,
    cats = ["VIP", "Premium", "General", "Show"];
  let h =
    '<div class="sitsum">' +
    cats
      .map((c) => {
        const us = U.filter((u) => u.cat === c);
        const ok = us.filter((u) => u.where.length);
        return (
          '<span><b style="color:' +
          CATC[c] +
          '">' +
          c +
          "</b>: " +
          ok.length +
          "/" +
          us.length +
          " reservas · " +
          us.reduce((a, u) => a + u.pax, 0) +
          " pax</span>"
        );
      })
      .join("") +
    "</div>";
  if (SIT.warn.length)
    h +=
      '<div class="sitwarn"><b>Avisos</b><ul>' +
      SIT.warn.map((w) => "<li>" + esc_(w) + "</li>").join("") +
      "</ul></div>";
  h +=
    '<table class="sittab"><thead><tr><th>Reserva</th><th>Nombre</th><th>Cat.</th><th>Pax</th><th>Ubicación</th><th>Alergias</th><th>Menús</th><th>PMR</th><th>Cumple</th></tr></thead><tbody>';
  const rows = [...U].sort(
    (a, b) =>
      cats.indexOf(a.cat) - cats.indexOf(b.cat) ||
      String(a.where[0] || "zz").localeCompare(String(b.where[0] || "zz"), "es", { numeric: true }),
  );
  for (const u of rows) {
    const al = u.res
        .map((r) => r.al)
        .filter(Boolean)
        .join("; "),
      veg = u.res.reduce((a, r) => a + r.veg, 0),
      ni = u.res.reduce((a, r) => a + r.nino, 0);
    h +=
      '<tr data-u="' +
      u.idx +
      '" style="cursor:pointer"><td>' +
      esc_(u.res.map((r) => r.res).join(", ")) +
      "</td><td>" +
      esc_(u.name) +
      '</td><td><span class="dot" style="background:' +
      CATC[u.cat] +
      '"></span>' +
      esc_(u.cat) +
      (u.staff ? " · <b>" + esc_(u.staff) + "</b>" : "") +
      "</td><td>" +
      u.pax +
      "</td><td>" +
      (u.where.length ? esc_(u.where.join(", ")) : "<i>" + esc_(u.note || "Sin ubicar") + "</i>") +
      "</td><td>" +
      (al ? "<b>" + esc_(al) + "</b>" : "") +
      "</td><td>" +
      [veg ? veg + " vegano" : "", ni ? ni + " niño" : ""].filter(Boolean).join(", ") +
      "</td><td>" +
      (u.pmr || "") +
      "</td><td>" +
      (u.cu ? "Sí" : "") +
      "</td></tr>";
  }
  box.innerHTML = h + "</tbody></table>";
}
document.getElementById("sitfile").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const m = document.getElementById("sitmsg");
  m.textContent = "Leyendo " + f.name + "…";
  try {
    if (typeof XLSX === "undefined") throw new Error("No se pudo cargar el lector de Excel.");
    const resv = parseExcel(await f.arrayBuffer());
    if (!resv.length) throw new Error("No hay reservas en el archivo.");
    await runSitting(resv);
    m.textContent =
      f.name +
      ": " +
      resv.length +
      " reservas, " +
      resv.reduce((a, r) => a + r.pax, 0) +
      " personas. Las mesas coloreadas son el sitting propuesto; cambia de planta para ver la barra del anfiteatro.";
    document.getElementById("sitclear").disabled = false;
    setSitLock(true);
    render();
    showSitting();
  } catch (err) {
    m.textContent = "Error: " + err.message;
  }
  e.target.value = "";
});
/* ===== Asientos (puntos verdes), bloqueo y mover gente ===== */
const STAGE = { x: 22.5, y: 12.3 };
// Asientos de una mesa ordenados por prioridad: primero el lado con visión al escenario y los más cercanos.
function seatSlots(t) {
  if (T[t.type].sofa) {
    const sd = 0.8,
      td = 0.6,
      gp = 0.2,
      rot = t.w < t.h;
    return [0.25, 0.75]
      .map((f) =>
        rot
          ? { x: t.x + td + gp + sd / 2, y: t.y + t.h * f }
          : { x: t.x + t.w * f, y: t.y + td + gp + sd / 2 },
      )
      .map((q) => ({ ...q, score: -Math.hypot(q.x - STAGE.x, q.y - STAGE.y) }));
  }
  const out = [],
    off = 0.2,
    long = t.w >= t.h,
    ty = t.type;
  function side(ax, ay, bx, by, nx, ny, n) {
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n;
      out.push({ x: ax + (bx - ax) * f + nx * off, y: ay + (by - ay) * f + ny * off, nx, ny });
    }
  }
  // VIP: 2 personas en la parte de atrás (la más alejada del escenario, de cara a él) y 1 en cada lado corto; primero la parte de atrás
  if (ty === "vip") {
    const o = 0.35,
      sd = [];
    if (long) {
      const by = t.y + t.h - o;
      sd.push(
        { x: t.x + t.w * 0.3, y: by, b: 1 },
        { x: t.x + t.w * 0.7, y: by, b: 1 },
        { x: t.x + o, y: t.cy, b: 0 },
        { x: t.x + t.w - o, y: t.cy, b: 0 },
      );
    } else {
      const bx = t.cx < STAGE.x ? t.x + o : t.x + t.w - o;
      sd.push(
        { x: bx, y: t.y + t.h * 0.3, b: 1 },
        { x: bx, y: t.y + t.h * 0.7, b: 1 },
        { x: t.cx, y: t.y + o, b: 0 },
        { x: t.cx, y: t.y + t.h - o, b: 0 },
      );
    }
    return sd.map((q) => ({
      x: q.x,
      y: q.y,
      score: (q.b ? 0 : 1000) - Math.hypot(q.x - STAGE.x, q.y - STAGE.y),
    }));
  }
  const per = Math.max(1, Math.round(T[ty].cap / 2));
  if (long) {
    const far = { a: [t.x, t.y + t.h], b: [t.x + t.w, t.y + t.h], n: [0, 1] },
      near = { a: [t.x, t.y], b: [t.x + t.w, t.y], n: [0, -1] };
    const sides = ty === "m4u" ? [t.cy > STAGE.y ? far : near] : [far, near];
    for (const s of sides) side(s.a[0], s.a[1], s.b[0], s.b[1], s.n[0], s.n[1], ty === "m4u" ? 2 : per);
  } else {
    const left = { a: [t.x, t.y], b: [t.x, t.y + t.h], n: [-1, 0] },
      right = { a: [t.x + t.w, t.y], b: [t.x + t.w, t.y + t.h], n: [1, 0] };
    const sides = ty === "m4u" ? [t.cx < STAGE.x ? left : right] : [left, right];
    for (const s of sides) side(s.a[0], s.a[1], s.b[0], s.b[1], s.n[0], s.n[1], ty === "m4u" ? 2 : per);
  }
  const pref = long ? (s) => s.ny > 0 : (s) => (t.cx < STAGE.x ? s.nx < 0 : s.nx > 0);
  // Cara a cara: se ocupan las sillas por parejas enfrentadas (las dos sillas de la misma posición a lo largo de la mesa), empezando por la posición más lejana al escenario; si sobra una persona, va al lado con visión al escenario
  const colD = (s) =>
    long ? Math.hypot(STAGE.x - s.x, STAGE.y - t.cy) : Math.hypot(STAGE.x - t.cx, STAGE.y - s.y);
  // Lejos del escenario solo en las mesas de delante de los VIP; en las de detrás de los VIP (centrales o laterales), primero lo más cercano al escenario
  const sg = behindVip(t) ? 1 : -1;
  return out.map((s) => ({ x: s.x, y: s.y, score: sg * Math.round(colD(s) * 100) * 10 + (pref(s) ? 0 : 1) }));
}
function behindVip(t) {
  if (t.floor && t.floor !== "base") return true; // mesas de la planta alta: primero los asientos más cercanos al escenario
  const v = VIPS;
  if (!v.length) return false;
  const cen = v.filter((x) => x.w >= x.h),
    lat = v.filter((x) => x.w < x.h);
  if (cen.length && t.cy > Math.max(...cen.map((x) => x.y + x.h))) return true;
  const L = lat.filter((x) => x.cx < STAGE.x),
    R = lat.filter((x) => x.cx >= STAGE.x);
  if (L.length && t.cx < Math.min(...L.map((x) => x.x))) return true;
  if (R.length && t.cx > Math.max(...R.map((x) => x.x + x.w))) return true;
  return false;
}
function drawShared(g, t) {
  const long = t.w >= t.h,
    n = nCols(t);
  for (const o of t.occ) {
    const u = o.u,
      c = CATC[u.cat] || "#888",
      a = Math.min(...o.cols),
      b = Math.max(...o.cols) + 1;
    const r = long
      ? { x: t.x + (t.w * a) / n, y: t.y, w: (t.w * (b - a)) / n, h: t.h }
      : { x: t.x, y: t.y + (t.h * a) / n, w: t.w, h: (t.h * (b - a)) / n };
    el(
      "rect",
      {
        x: X(r.x) + 0.6,
        y: Y(r.y) + 0.6,
        width: r.w * S - 1.2,
        height: r.h * S - 1.2,
        rx: 2,
        fill: c,
        "fill-opacity": 0.55,
        stroke: u.pmr ? PMRC : isInv(u) ? INVC : c,
        "stroke-width": u.pmr || isInv(u) ? 2.4 : 1.3,
      },
      g,
    );
    const cx = X(r.x + r.w / 2),
      cy = Y(r.y + r.h / 2);
    el(
      "text",
      {
        x: cx,
        y: cy,
        "text-anchor": "middle",
        "dominant-baseline": "central",
        "font-size": 6,
        fill: "var(--txt)",
        "font-weight": 600,
        transform: long ? "" : "rotate(-90 " + cx + " " + cy + ")",
      },
      g,
      u.res[0].nom.split(/[ ,]/)[0].slice(0, 6),
    );
    const nb = (hasAl(u) ? 1 : 0) + (u.cu ? 1 : 0);
    if (nb) {
      if (long) badges(g, cx - (nb - 1) * 5, Y(r.y), u);
      else {
        const ex = t.cx < STAGE.x ? X(r.x) : X(r.x + r.w);
        let k = 0;
        if (hasAl(u)) badgeOne(g, ex, cy + (k++ - (nb - 1) / 2) * 10, "al");
        if (u.cu) badgeOne(g, ex, cy + (k - (nb - 1) / 2) * 10, "cu");
      }
    }
  }
}
function sideKey(t, q) {
  return t.w >= t.h ? (q.y > t.cy ? "b" : "a") : q.x > t.cx ? "b" : "a";
}
function singleSide(t, u) {
  const sl = seatSlots(t),
    pref = {};
  sl.forEach((q) => {
    const c = seatCol(t, q);
    if (!pref[c] || q.score < pref[c].score) pref[c] = q;
  });
  const side = {};
  for (const c of colOrder(t)) {
    const o = t.occ.find((o) => o.cols.length === 1 && o.cols[0] === c && o.u.pax === 1);
    if (!o) continue;
    let sd = pref[c] ? sideKey(t, pref[c]) : "a";
    if (side[c - 1] === sd || side[c + 1] === sd) sd = sd === "a" ? "b" : "a";
    side[c] = sd;
    if (o.u === u) return sd;
  }
  return null;
}
// Dibuja un punto verde por persona en los mejores asientos de cada mesa.
function drawDots(g) {
  if (!SIT) return;
  const byU = new Map();
  for (const t of Object.values(SIT.tmap).filter((t) => t.floor === FLOOR)) {
    for (const o of occOf(t)) {
      if (!byU.has(o.u)) byU.set(o.u, []);
      byU.get(o.u).push(o);
      o.t = t;
    }
  }
  for (const [u, ol] of byU) {
    let sl = [];
    ol.forEach((o) => {
      let q2 = seatSlots(o.t).filter((q) => o.cols.includes(seatCol(o.t, q)));
      if (u.pax === 1 && o.t.occ.length > 1) {
        const sd = singleSide(o.t, u);
        if (sd) q2 = q2.filter((q) => sideKey(o.t, q) === sd);
      }
      sl = sl.concat(q2);
    });
    sl.sort((a, b) => a.score - b.score);
    sl.slice(0, u.pax).forEach((s) =>
      el(
        "circle",
        {
          cx: X(s.x),
          cy: Y(s.y),
          r: Math.max(2.2, 0.12 * S),
          fill: "#3B6D11",
          stroke: "#fff",
          "stroke-width": 0.8,
        },
        g,
      ),
    );
  }
}
let pmove = null,
  pendingUnit = null;
var LOCKED = true;
// Botón de bloqueo del plano (arranca siempre bloqueado).
function toggleLock() {
  LOCKED = !LOCKED;
  const b = document.getElementById("lockbtn");
  b.textContent = LOCKED ? "🔒 Plano bloqueado" : "🔓 Plano desbloqueado";
  b.classList.toggle("unl", !LOCKED);
  status(
    LOCKED
      ? "Plano bloqueado: las mesas no se pueden mover."
      : "Plano desbloqueado: ya puedes mover y editar mesas. Vuelve a bloquearlo al terminar.",
    LOCKED ? "ok" : "warn",
  );
}
// Impide editar mesas si el plano está bloqueado o hay un sitting cargado.
function sitLocked() {
  if (SIT) {
    status("Con el sitting cargado las mesas están bloqueadas. Puedes mover reservas entre mesas.", "warn");
    return true;
  }
  if (LOCKED) {
    status(
      "El plano está bloqueado. Pulsa «Plano bloqueado» para desbloquearlo y mover o editar mesas.",
      "warn",
    );
    return true;
  }
  return false;
}
// Mesa que hay en un punto del plano.
function tableAt(p) {
  return SIT.tabs.find(
    (t) =>
      t.floor === FLOOR &&
      p.x >= t.x - 0.25 &&
      p.x <= t.x + t.w + 0.25 &&
      p.y >= t.y - 0.25 &&
      p.y <= t.y + t.h + 0.25,
  );
}
// Con sitting cargado: al tocar una mesa ocupada empieza a mover su reserva.
function sitDown(t, e) {
  const st = SIT.tabs.find((x) => x.floor === FLOOR && x.key === keyOf(t.type, t.x, t.y));
  if (!st) return;
  if (pendingUnit) {
    if (!sitBlocked()) placeUnit(pendingUnit, st);
    pendingUnit = null;
    return;
  }
  if (!st.unit) {
    status(
      'Mesa libre. Arrastra aquí una reserva, o toca una reserva "sin ubicar" de la lista y luego esta mesa.',
      "",
    );
    return;
  }
  let mu = st.unit;
  if (occOf(st).length > 1) {
    const c = seatCol(st, pm(e)),
      o = st.occ.find((o) => o.cols.includes(c));
    if (o) mu = o.u;
  }
  pmove = { from: st, unit: mu, p: pm(e) };
  if (SITLOCK) return;
  status("Moviendo " + mu.name + " (" + mu.pax + " pax)… suelta sobre otra mesa", "");
  sitGhost();
}
// Círculo que sigue al dedo mientras se mueve una reserva.
function sitGhost() {
  const g = document.getElementById("sitfx");
  const old = document.getElementById("ghost");
  if (old) old.remove();
  if (!pmove) return;
  const c = el("g", { id: "ghost" }, g);
  el(
    "circle",
    { cx: X(pmove.p.x), cy: Y(pmove.p.y), r: 14, fill: CATC[pmove.unit.cat] || "#888", "fill-opacity": 0.8 },
    c,
  );
  el(
    "text",
    {
      x: X(pmove.p.x),
      y: Y(pmove.p.y),
      "text-anchor": "middle",
      "dominant-baseline": "central",
      "font-size": 10,
      fill: "#fff",
      "font-weight": 600,
    },
    c,
    pmove.unit.pax,
  );
}
// Bloqueo del sitting: al cargar el Excel queda bloqueado (solo se pueden consultar las reservas); hay que desbloquearlo para mover reservas
var SITLOCK = true;
function setSitLock(v) {
  SITLOCK = v;
  const b = document.getElementById("sitlock");
  if (!b) return;
  b.disabled = !SIT && v;
  b.textContent = v ? "🔒 Sitting bloqueado" : "🔓 Sitting desbloqueado";
  b.classList.toggle("unl", !v);
}
function toggleSitLock() {
  if (!SIT) return;
  setSitLock(!SITLOCK);
  status(
    SITLOCK
      ? "Sitting bloqueado: toca una reserva para ver su ficha."
      : "Sitting desbloqueado: ya puedes arrastrar reservas entre mesas. Vuelve a bloquearlo al terminar.",
    SITLOCK ? "ok" : "warn",
  );
}
function sitBlocked() {
  if (SITLOCK) {
    status(
      "El sitting está bloqueado. Pulsa «Sitting bloqueado» para desbloquearlo y mover reservas.",
      "warn",
    );
    return true;
  }
  return false;
}
// Actualiza la posición del círculo al mover.
function sitMove(e) {
  if (SITLOCK) return;
  pmove.p = pm(e);
  sitGhost();
}
// ¿Puede ir esta reserva a esta mesa? (VIP solo a VIP, Premium solo a mesas de 8, General a todo menos VIP).
function okFor(u, t) {
  if (u.gest && t.floor !== "p2") return true;
  if (t.type === "sil4") return u.cat === "General" || u.cat === "Show";
  if (t.floor === "p2") return u.cat === "Show";
  if (u.cat === "VIP") return t.type === "vip";
  if (u.cat === "Premium") return t.type === "m8" || t.type === "vip";
  if (u.cat === "General") return t.type !== "vip";
  return false;
}
// Mesas que ocupa una reserva.
function tablesOf(u) {
  return SIT.tabs.filter((t) => occOf(t).some((o) => o.u === u));
}
// Libera las mesas de una reserva.
function freeTables(u) {
  tablesOf(u).forEach((t) => remOcc(t, u));
}
// Recalcula ubicaciones y redibuja tras mover reservas a mano.
function rebuild() {
  SIT.tmap = {};
  SIT.tabs.forEach((t) => {
    if (occOf(t).length) SIT.tmap[t.key] = t;
  });
  for (const u of SIT.units) {
    const ts2 = tablesOf(u);
    const barra = u.where.filter((w) => w.includes("barra") || w.startsWith("Barra"));
    u.where = barra.concat(
      ts2.length
        ? [
            ts2.map((t) => t.id).join("+") +
              (ts2.length > 1
                ? " (mesas juntas)"
                : " (" + T[ts2[0].type].n + ")" + (ts2[0].occ.length > 1 ? " · compartida" : "")),
          ]
        : [],
    );
    if (u.where.length) u.note = "";
  }
  SIT.warn = SIT.warn.filter((w) => !w.startsWith("Movido"));
  render();
  showSitting();
}
// Coloca a mano una reserva sin ubicar en una mesa libre.
function placeUnit(u, dst) {
  if (!okFor(u, dst)) {
    status("Esa mesa no admite la categoría " + u.cat + ".", "warn");
    return;
  }
  if (dst.type !== "vip" && !fitCols(u, dst, true)) {
    status(
      dst.unit
        ? "En esa mesa no queda hueco para " + u.pax + " personas (o no se puede compartir con esa reserva)."
        : "No caben: " + u.pax + " personas en una mesa de " + dst.cap + ".",
      "warn",
    );
    return;
  }
  if (dst.type === "vip" && dst.unit) {
    status("Ese VIP está ocupado.", "warn");
    return;
  }
  if (dst.type === "vip" && u.pax > 4) {
    status("Grupo de más de 4 en VIP: muévelo arrastrando desde su mesa actual.", "warn");
    return;
  }
  const fromBarra = u.where.some((w) => w.includes("barra"));
  if (fromBarra) {
    SIT.seats.forEach((s) => {
      if (s.unit === u) {
        s.unit = null;
        s.pmr = false;
      }
    });
    u.where = u.where.filter((w) => !w.includes("barra"));
    u.mesaNo = null;
  }
  freeTables(u);
  addOcc(dst, u, dst.type === "vip" ? null : fitCols(u, dst, true));
  status("Colocado " + u.name + " en " + dst.id + (occOf(dst).length > 1 ? " (compartida)" : "") + ".", "ok");
  rebuild();
}
// Al soltar una reserva: la mueve a una mesa libre o la intercambia con la de otra mesa.
function sitUp(e) {
  const mv = pmove;
  pmove = null;
  sitGhost();
  const dst = tableAt(pm(e));
  if (!dst || dst === mv.from) {
    render();
    if (dst === mv.from) {
      status("", "");
      showPop(mv.unit);
    } else status("", "");
    return;
  }
  if (sitBlocked()) {
    render();
    return;
  }
  const u = mv.unit,
    src = tablesOf(u);
  if (!okFor(u, dst)) {
    status("Esa mesa no admite la categoría " + u.cat + ".", "warn");
    return;
  }
  const v = dst.unit;
  // mesa con hueco: se comparte (Premium con Premium, General con General o con Premium)
  if (v && u.cat !== "VIP" && !occOf(dst).some((o) => o.u === u)) {
    const saved = src.map((t) => ({ t, o: t.occ.slice() }));
    src.forEach((t) => remOcc(t, u));
    const cols = fitCols(u, dst, true);
    if (cols) {
      addOcc(dst, u, cols);
      status("Movido " + u.name + " a " + dst.id + " (mesa compartida).", "ok");
      rebuild();
      return;
    }
    saved.forEach((x) => {
      x.t.occ = x.o;
      syncT(x.t);
    });
  }
  if (v && occOf(dst).length > 1) {
    status("En esa mesa no queda hueco para " + u.pax + " personas.", "warn");
    rebuild();
    return;
  }
  if (!v) {
    // mover a libre: grupos multi-mesa necesitan mesas vecinas libres
    let need = dst.type === "vip" ? Math.ceil(u.pax / 4) : 1;
    const cap = dst.type === "vip" ? need * 4 : dst.cap;
    if (dst.type !== "vip" && dst.cap < u.pax) {
      status("No caben: " + u.pax + " personas en una mesa de " + dst.cap + ".", "warn");
      return;
    }
    if (dst.type === "vip" && need > 1) {
      const blk = SIT.vipBlocks.find((b) => b.includes(dst)),
        i = blk.indexOf(dst),
        run = blk.slice(i, i + need);
      if (run.length < need || run.some((x) => x.unit && x.unit !== u)) {
        status("No hay " + need + " VIP pegados libres a partir de " + dst.id + ".", "warn");
        return;
      }
      freeTables(u);
      run.forEach((x) => addOcc(x, u));
    } else {
      freeTables(u);
      addOcc(dst, u, fitCols(u, dst, true));
    }
    status("Movido " + u.name + " a " + dst.id + ".", "ok");
    rebuild();
    return;
  }
  // intercambio
  const vt = tablesOf(v);
  if (vt.length > 1 || src.length > 1) {
    status("Intercambio solo entre reservas de una sola mesa.", "warn");
    return;
  }
  if (!okFor(v, src[0])) {
    status("No se puede intercambiar: categorías incompatibles.", "warn");
    return;
  }
  if (src[0].cap < v.pax || dst.cap < u.pax || occOf(src[0]).length > 1) {
    status("No se puede intercambiar: alguna de las dos reservas no cabe en la otra mesa.", "warn");
    return;
  }
  remOcc(src[0], u);
  remOcc(dst, v);
  addOcc(src[0], v, fitCols(v, src[0], true));
  addOcc(dst, u, fitCols(u, dst, true));
  status("Intercambiadas " + u.name + " y " + v.name + ".", "ok");
  rebuild();
}
document.getElementById("sitres").addEventListener("click", (e) => {
  const tr = e.target.closest("tr[data-u]");
  if (!tr || !SIT) return;
  const u = SIT.units[+tr.dataset.u];
  if (u.where.length) {
    showPop(u);
    return;
  }
  if (SITLOCK) {
    showPop(u);
    sitBlocked();
    return;
  }
  pendingUnit = u;
  if (FLOOR !== "base") loadFloor("base");
  status("Toca una mesa libre del plano para colocar " + u.name + " (" + u.pax + " pax).", "");
});

// Botón "Quitar sitting": vuelve al plano sin reservas.
function clearSitting() {
  SIT = null;
  pmove = null;
  pendingUnit = null;
  setSitLock(true);
  document.getElementById("sitlock").disabled = true;
  render();
  showSitting();
  document.getElementById("sitmsg").textContent = "Sin sitting cargado.";
  document.getElementById("sitclear").disabled = true;
}

/* ===== Copias del plano: exportar, importar y restaurar ===== */
// Descarga un archivo de texto.
function descargar(nombre, texto) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([texto], { type: "application/json" }));
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
// Mesas guardadas de una planta (o el plano oficial si no hay nada guardado).
function planoGuardado(f) {
  if (f === FLOOR) return toData();
  try {
    const l = JSON.parse(localStorage.getItem(FL[f].ls));
    if (l && l.tables) return l.tables;
  } catch (e) {}
  return PLANO_OFICIAL[f] || [];
}
// Botón "Exportar plano": descarga un .json con las dos plantas.
function exportarPlano() {
  const datos = {
    app: "sitting-sala-scala",
    version: 1,
    fecha: new Date().toISOString(),
    plantas: { base: planoGuardado("base"), p2: planoGuardado("p2") },
  };
  descargar(
    "plano-sala-scala-" + new Date().toISOString().slice(0, 10) + ".json",
    JSON.stringify(datos, null, 1),
  );
  status("Plano exportado", "ok");
}
document.getElementById("impfile").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (!d.plantas) throw new Error("El archivo no es un plano de Sala Scala.");
    for (const k of ["base", "p2"])
      if (Array.isArray(d.plantas[k]))
        localStorage.setItem(
          FL[k].ls,
          JSON.stringify({ tables: d.plantas[k], updated: Date.now(), roomW: W, vipV: 2 }),
        );
    loadFloor(FLOOR);
    status("Plano importado de " + f.name, "ok");
  } catch (err) {
    status("No se pudo importar: " + err.message, "warn");
  }
  e.target.value = "";
});
let confirmarRestaurar = false;
// Botón "Restaurar plano oficial" (hay que pulsarlo dos veces).
function restaurarOficial() {
  const b = document.getElementById("restbtn");
  if (!confirmarRestaurar) {
    confirmarRestaurar = true;
    b.textContent = "¿Seguro? Pulsa otra vez";
    setTimeout(() => {
      confirmarRestaurar = false;
      b.textContent = "Restaurar plano oficial";
    }, 4000);
    return;
  }
  confirmarRestaurar = false;
  b.textContent = "Restaurar plano oficial";
  for (const k of ["base", "p2"]) localStorage.removeItem(FL[k].ls);
  loadFloor(FLOOR);
  status("Plano oficial restaurado", "ok");
}
