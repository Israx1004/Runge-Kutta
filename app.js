const ALLOWED = new Set(["x", "y", "sin", "cos", "tan", "asin", "acos", "atan", "sinh", "cosh", "tanh",
  "exp", "ln", "log", "log10", "sqrt", "abs", "pi", "e", "PI", "E"]);

function compile(src) {
  const s = src.trim();
  if (!s) throw new Error("Escribe la función f(x, y).");
  if (/[^0-9a-zA-Z_+\-*/^().,\s]/.test(s)) throw new Error("revisa la funcion");
  const noNums = s.replace(/\d*\.?\d+(?:[eE][+-]?\d+)?/g, "0");
  for (const id of noNums.match(/[A-Za-z_]\w*/g) || []) {
    if (!ALLOWED.has(id)) throw new Error(`"${id}" no identificado`);
  }
  const js = s.replace(/\^/g, "**");
  let fn;
  try {
    fn = new Function("x", "y",
      "const {sin,cos,tan,asin,acos,atan,sinh,cosh,tanh,exp,log,log10,sqrt,abs,PI,E}=Math;" +
      "const ln=Math.log, pi=Math.PI, e=Math.E;" +
      `return (${js});`);
    fn(0.5, 0.5);
  } catch (err) {
    throw new Error("error en la funcion");
  }
  return fn;
}

// ---------- Datos de ejemplo ----------
const EXAMPLES = [
  { f: "2*x*y", x0: 1, y0: 1, h: 0.1, xf: 1.5 },
  { f: "x - y", x0: 0, y0: 1, h: 0.2, xf: 4 }
];
const $ = id => document.getElementById(id);
const inputs = ["fx", "x0", "y0", "h", "xf"].map($);
const MAX_STEPS = 5000;

function fmt(v, dec = 6) {
  if (!isFinite(v)) return String(v);
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e7 || a < 1e-5)) return v.toExponential(dec > 6 ? 6 : 4);
  return String(+v.toFixed(dec));
}
const fmtT = v => fmt(v, 8);   

function renderExamples() {
  const box = $("examples");
  box.innerHTML = "";
  for (const ex of EXAMPLES) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.textContent = ex.f;
    b.title = `x₀=${ex.x0}, y₀=${ex.y0}, h=${ex.h}, hasta x=${ex.xf}`;
    b.addEventListener("click", () => {
      $("fx").value = ex.f; $("x0").value = ex.x0; $("y0").value = ex.y0;
      $("h").value = ex.h; $("xf").value = ex.xf;
      update();
    });
    box.appendChild(b);
  }
}
function markExample() {
  const f = $("fx").value.replace(/\s/g, "");
  [...$("examples").children].forEach((b, i) =>
    b.setAttribute("aria-pressed", String(EXAMPLES[i].f.replace(/\s/g, "") === f)));
}

function showError(text, field) {
  $("msg").textContent = text;
  $("msg").hidden = false;
  inputs.forEach(el => el.classList.toggle("bad", el === field));
}
function clearError() {
  $("msg").hidden = true;
  inputs.forEach(el => el.classList.remove("bad"));
}

let current = null;

function update() {
  markExample();
  let f;
  try { f = compile($("fx").value); }
  catch (err) { showError(err.message, $("fx")); return; }

  const x0 = parseFloat($("x0").value), y0 = parseFloat($("y0").value);
  const h = parseFloat($("h").value), xf = parseFloat($("xf").value);
  if (!isFinite(x0)) return showError("Escribe un valor para x₀.", $("x0"));
  if (!isFinite(y0)) return showError("Escribe un valor para y₀.", $("y0"));
  if (!isFinite(h) || h <= 0) return showError("El paso h debe ser un número mayor que 0.", $("h"));
  if (!isFinite(xf) || xf <= x0) return showError("x final debe ser mayor que x₀.", $("xf"));
  const n = Math.round((xf - x0) / h);
  if (n < 1) return showError("El paso h es más grande que el intervalo usa un h menor.", $("h"));
  if (n > MAX_STEPS) return showError(`Son ${n.toLocaleString("es-MX")} pasos usa un h mayor (máximo ${MAX_STEPS} pasos).`, $("h"));

  // ---- aquí se ejecuta el método numérico ----
  const res = rk4(f, x0, y0, h, n);

  const xs = res.filas.map(r => r.x).concat(res.xFinal);
  const ys = res.filas.map(r => r.y).concat(res.yFinal);
  const malo = res.filas.find(r => ![r.k1, r.k2, r.k3, r.k4, r.ySiguiente].every(isFinite));
  if (malo) {
    showError(`funcion no definida o infinita`);
    return;
  }
  clearError();
  current = { xs, ys, h, n };

  $("final").textContent = `y(${fmt(res.xFinal)}) ≈ ${fmtT(res.yFinal)}`;
  renderTable(res);
  drawChart();
}

//tabla
function renderTable({ filas, xFinal, yFinal }) {
  const rows = filas.map(r =>
    `<tr data-i="${r.n}"><td>${r.n}</td><td>${fmt(r.x)}</td><td class="yn">${fmtT(r.y)}</td>` +
    `<td>${fmtT(r.k1)}</td><td>${fmtT(r.k2)}</td><td>${fmtT(r.k3)}</td><td>${fmtT(r.k4)}</td>` +
    `<td>${fmtT(r.ySiguiente)}</td></tr>`);
  // última fila: el punto final, donde se lee la respuesta y(x final)
  const N = filas.length;
  rows.push(`<tr class="final" data-i="${N}"><td>${N}</td><td>${fmt(xFinal)}</td><td class="yn">${fmtT(yFinal)}</td>` +
    `<td class="empty">—</td><td class="empty">—</td><td class="empty">—</td><td class="empty">—</td><td class="empty">—</td></tr>`);
  $("tbody").innerHTML = rows.join("");
  //$("rows-note").textContent = `${N + 1} puntos · la respuesta es Yn en la última fila`;
}

// grafica cvg
function niceTicks(min, max, count) {
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const raw = span / count;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * pow).find(s => span / s <= count) || 10 * pow;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toPrecision(12));
  return { lo, hi, ticks, step };
}
function tickLabel(v, step) {
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e5 || a < 1e-3)) return v.toExponential(1);
  const dec = Math.max(0, -Math.floor(Math.log10(step)) + (step / Math.pow(10, Math.floor(Math.log10(step))) === 2.5 ? 1 : 0));
  return v.toFixed(Math.min(dec, 6));
}

const NS = "http://www.w3.org/2000/svg";
function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

function drawChart() {
  if (!current) return;
  const box = $("chart");
  box.innerHTML = "";
  const W = Math.max(300, box.clientWidth || 700);
  const H = W < 520 ? 300 : 380;
  const m = { t: 14, r: 18, b: 44, l: 62 };
  const pw = W - m.l - m.r, ph = H - m.t - m.b;

  const { xs, ys } = current;
  const xT = niceTicks(xs[0], xs[xs.length - 1], W < 520 ? 5 : 8);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const pad = (yMax - yMin) * 0.04 || Math.abs(yMax) * 0.1 || 1;
  const yT = niceTicks(yMin - pad, yMax + pad, 6);
  const sx = v => m.l + (v - xT.lo) / (xT.hi - xT.lo) * pw;
  const sy = v => m.t + ph - (v - yT.lo) / (yT.hi - yT.lo) * ph;

  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `Gráfica de y contra x con ${xs.length} puntos calculados por RK4` }, box);

  // papel milimétrico
  const g = el("g", {}, svg);
  const minorX = xT.step / 5, minorY = yT.step / 5;
  for (let v = xT.lo; v <= xT.hi + minorX / 2; v += minorX)
    el("line", { x1: sx(v), x2: sx(v), y1: m.t, y2: m.t + ph, stroke: "var(--grid)", "stroke-width": 1 }, g);
  for (let v = yT.lo; v <= yT.hi + minorY / 2; v += minorY)
    el("line", { x1: m.l, x2: m.l + pw, y1: sy(v), y2: sy(v), stroke: "var(--grid)", "stroke-width": 1 }, g);
  for (const v of xT.ticks) {
    el("line", { x1: sx(v), x2: sx(v), y1: m.t, y2: m.t + ph, stroke: "var(--grid-major)", "stroke-width": 1 }, g);
    const t = el("g", { class: "tick" }, svg);
    el("text", { x: sx(v), y: m.t + ph + 18, "text-anchor": "middle" }, t).textContent = tickLabel(v, xT.step);
  }
  for (const v of yT.ticks) {
    el("line", { x1: m.l, x2: m.l + pw, y1: sy(v), y2: sy(v), stroke: "var(--grid-major)", "stroke-width": 1 }, g);
    const t = el("g", { class: "tick" }, svg);
    el("text", { x: m.l - 8, y: sy(v) + 4, "text-anchor": "end" }, t).textContent = tickLabel(v, yT.step);
  }
  if (yT.lo < 0 && yT.hi > 0) el("line", { x1: m.l, x2: m.l + pw, y1: sy(0), y2: sy(0), stroke: "var(--muted)", "stroke-width": 1 }, svg);
  if (xT.lo < 0 && xT.hi > 0) el("line", { x1: sx(0), x2: sx(0), y1: m.t, y2: m.t + ph, stroke: "var(--muted)", "stroke-width": 1 }, svg);
  el("rect", { x: m.l, y: m.t, width: pw, height: ph, fill: "none", stroke: "var(--line)" }, svg);

  el("text", { x: m.l + pw / 2, y: H - 6, "text-anchor": "middle", class: "axis-title" }, svg).textContent = "x";
  el("text", { x: 14, y: m.t + ph / 2, "text-anchor": "middle", class: "axis-title", transform: `rotate(-90 14 ${m.t + ph / 2})` }, svg).textContent = "y";

  // curva
  const d = xs.map((x, i) => `${i ? "L" : "M"}${sx(x).toFixed(2)},${sy(ys[i]).toFixed(2)}`).join("");
  el("path", { d, fill: "none", stroke: "var(--accent)", "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, svg);

  if (xs.length <= 60) {
    const mg = el("g", {}, svg);
    xs.forEach((x, i) => el("circle", { cx: sx(x), cy: sy(ys[i]), r: 4, fill: "var(--accent)", stroke: "var(--surface)", "stroke-width": 2 }, mg));
  }

  // hover: guía + punto + tooltip, y resalta la fila de la tabla
  const guide = el("line", { y1: m.t, y2: m.t + ph, stroke: "var(--muted)", "stroke-width": 1, "stroke-dasharray": "3 3", visibility: "hidden" }, svg);
  const dot = el("circle", { r: 6, fill: "var(--accent)", stroke: "var(--surface)", "stroke-width": 2, visibility: "hidden" }, svg);
  const tip = document.createElement("div");
  tip.className = "tip"; tip.hidden = true;
  box.appendChild(tip);
  const hit = el("rect", { x: m.l, y: m.t, width: pw, height: ph, fill: "transparent" }, svg);

  let lastRow = null;
  function show(evt) {
    const r = svg.getBoundingClientRect();
    const px = (evt.clientX - r.left) * (W / r.width);
    const xv = xT.lo + (px - m.l) / pw * (xT.hi - xT.lo);
    const i = Math.max(0, Math.min(xs.length - 1, Math.round((xv - xs[0]) / current.h)));
    const cx = sx(xs[i]), cy = sy(ys[i]);
    guide.setAttribute("x1", cx); guide.setAttribute("x2", cx); guide.setAttribute("visibility", "visible");
    dot.setAttribute("cx", cx); dot.setAttribute("cy", cy); dot.setAttribute("visibility", "visible");
    tip.innerHTML = `<span class="n">n = ${i}</span><br>x = ${fmt(xs[i])}<br>y = ${fmtT(ys[i])}`;
    tip.hidden = false;
    const scale = r.width / W;
    let left = cx * scale + 12, top = cy * scale - 30;
    if (left + tip.offsetWidth > r.width - 4) left = cx * scale - tip.offsetWidth - 12;
    top = Math.max(4, Math.min(top, r.height - tip.offsetHeight - 4));
    tip.style.left = left + "px"; tip.style.top = top + "px";
    const row = $("tbody").querySelector(`tr[data-i="${i}"]`);
    if (row !== lastRow) {
      if (lastRow) lastRow.classList.remove("hl");
      if (row) row.classList.add("hl");
      lastRow = row;
    }
    if (evt.type === "pointerdown" && row) row.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  function hide() {
    guide.setAttribute("visibility", "hidden"); dot.setAttribute("visibility", "hidden");
    tip.hidden = true;
    if (lastRow) { lastRow.classList.remove("hl"); lastRow = null; }
  }
  hit.addEventListener("pointermove", show);
  hit.addEventListener("pointerdown", show);
  hit.addEventListener("pointerleave", hide);
}

// arranque
$("code").textContent = rk4.toString();
renderExamples();
$("form").addEventListener("submit", e => e.preventDefault());
inputs.forEach(i => i.addEventListener("input", update));
let rz;
window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(drawChart, 120); });
update();