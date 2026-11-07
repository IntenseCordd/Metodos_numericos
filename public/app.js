/* global Chart */
'use strict';

/* =========================================================================
 * Utilidades
 * ======================================================================= */
const $ = (id) => document.getElementById(id);
const COLORS = {
  exact: '#e6e9f5',
  euler: '#ff6b6b',
  heun: '#ffb347',
  rk4: '#4ade80',
  lag: '#a78bfa',
  newton: '#facc15',
  spl: '#38bdf8',
  reg: '#f472b6',
  trap: '#ff9f43',
  simp: '#22d3ee',
  accent: '#6ee7ff',
  grid: 'rgba(152,162,200,0.12)',
};
const METHOD_NAMES = { euler: 'Euler', heun: 'Heun', rk4: 'RK4' };

function fmt(v, digits = 4) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  if (!Number.isFinite(v)) return '∞';
  const a = Math.abs(v);
  if (a !== 0 && (a < 1e-3 || a >= 1e6)) return v.toExponential(2);
  return Number(v.toFixed(digits)).toString();
}

function debounce(fn, ms = 150) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

async function api(path, body) {
  const res = await fetch(`/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error del servidor');
  return data;
}

function metric(label, value, sub = '', color = COLORS.accent) {
  return `<div class="metric" style="--c:${color}"><div class="label">${label}</div>
    <div class="value">${value}</div><div class="sub">${sub}</div></div>`;
}

function bindOutput(id, suffix = '', transform = (v) => v) {
  const input = $(id);
  const out = $(`${id}Out`);
  const update = () => (out.textContent = `${transform(input.value)}${suffix}`);
  input.addEventListener('input', update);
  update();
  return update;
}

const linspace = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));

Chart.defaults.color = '#98a2c8';
Chart.defaults.borderColor = COLORS.grid;
Chart.defaults.font.family = "'Segoe UI', system-ui, sans-serif";
Chart.defaults.animation = false;
Chart.defaults.maintainAspectRatio = false;
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.filter = (item) => !item.text.startsWith('_');
Chart.defaults.elements.point.radius = 0;

function makeChart(id, options) {
  // Etiquetas limpias en ejes logarítmicos: sólo potencias de 10 (10⁻³, 10², …)
  for (const axis of Object.values(options.scales || {})) {
    if (axis.type === 'logarithmic') {
      axis.ticks = {
        ...(axis.ticks || {}),
        autoSkip: false,
        callback(value) {
          const e = Math.log10(value);
          if (Math.abs(e - Math.round(e)) > 1e-9) return '';
          return `1e${Math.round(e)}`;
        },
      };
    }
  }
  return new Chart($(id), {
    type: 'line',
    data: { datasets: [] },
    options: {
      parsing: true,
      interaction: { mode: 'nearest', intersect: false },
      ...options,
    },
  });
}

/* =========================================================================
 * Parámetros globales
 * ======================================================================= */
const G = {
  get gamma() { return Number($('gGamma').value); },
  get R() { return Number($('gR').value); },
};

function efScale(v) {
  // Escala Fujita Mejorada (ráfagas de 3 s): umbrales en km/h, iguales a methods/efscale.js
  const kmh = v * 3.6;
  const limits = [105, 138, 179, 219, 267, 322];
  let name = 'por debajo de EF0';
  limits.forEach((l, i) => {
    if (kmh >= l) name = `EF${i}`;
  });
  return name;
}

function updateGlobals() {
  const vmax = G.gamma / (2 * Math.PI * G.R);
  $('gGammaOut').textContent = G.gamma.toLocaleString('es-MX');
  $('gROut').textContent = G.R;
  $('gVmax').textContent = `${vmax.toFixed(1)} m/s (${(vmax * 3.6).toFixed(0)} km/h)`;
  $('gCategory').textContent = `≈ ${efScale(vmax)}`;

  // Ajusta los rangos de los sliders que dependen de R
  const setMax = (id, max) => {
    const el = $(id);
    el.max = max;
    if (Number(el.value) > max) el.value = max;
    el.dispatchEvent(new Event('input'));
  };
  setMax('iQ', 5 * G.R);
  setMax('tX0', 6 * G.R);
  setMax('cR', 8 * G.R);
  setMax('nR0', 4 * G.R);
}

/* =========================================================================
 * Hero: tornado animado (puramente decorativo)
 * ======================================================================= */
(function heroTornado() {
  const canvas = $('heroCanvas');
  const ctx = canvas.getContext('2d');
  let W, H;
  const parts = Array.from({ length: 900 }, () => ({
    z: Math.random(),
    th: Math.random() * Math.PI * 2,
    jitter: Math.random() * 0.4 + 0.8,
  }));
  function resize() {
    W = canvas.width = canvas.clientWidth * devicePixelRatio;
    H = canvas.height = canvas.clientHeight * devicePixelRatio;
  }
  window.addEventListener('resize', resize);
  resize();
  let t = 0;
  function frame() {
    t += 0.016;
    ctx.fillStyle = 'rgba(11,16,32,0.25)';
    ctx.fillRect(0, 0, W, H);
    const cx = W * 0.74 + Math.sin(t * 0.4) * W * 0.02;
    const scale = H / 520;
    for (const p of parts) {
      const rad = (14 + 160 * p.z ** 1.6) * scale * p.jitter;
      const omega = 2.6 / (0.25 + p.z);
      p.th += omega * 0.016;
      p.z += 0.0009;
      if (p.z > 1) p.z = 0;
      const sway = Math.sin(t + p.z * 3) * 30 * scale * (1 - p.z);
      const x = cx + sway + Math.cos(p.th) * rad;
      const y = H * 0.92 - p.z * H * 0.85 + Math.sin(p.th) * rad * 0.22;
      const front = Math.sin(p.th) > 0;
      ctx.fillStyle = front ? `rgba(110,231,255,${0.25 + 0.5 * p.z})` : `rgba(167,139,250,${0.12 + 0.2 * p.z})`;
      ctx.fillRect(x, y, 2 * scale, 2 * scale);
    }
    requestAnimationFrame(frame);
  }
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) frame();
})();

/* =========================================================================
 * Sección 1 — Interpolación
 * ======================================================================= */
let interpSeed = 42;
const chartInterp = makeChart('chartInterp', {
  scales: {
    x: { type: 'linear', title: { display: true, text: 'Radio r (m)' } },
    y: { title: { display: true, text: 'Velocidad tangencial v (m/s)' } },
  },
  plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmt(c.parsed.y, 2)} m/s` } } },
});

async function runInterpolation() {
  try {
    const d = await api('interpolation', {
      gamma: G.gamma,
      R: G.R,
      rMax: 5 * G.R,
      nPoints: Number($('iN').value),
      spacing: $('iSpacing').value,
      noise: Number($('iNoise').value),
      model: $('iModel').value,
      degree: Number($('iDeg').value),
      rQuery: Number($('iQ').value),
      seed: interpSeed,
    });
    const xy = (arr) => d.grid.map((r, i) => ({ x: r, y: arr[i] }));
    const vmax = Math.max(...d.exact);
    const ds = [
      { label: 'Perfil real (modelo)', data: xy(d.exact), borderColor: COLORS.exact, borderDash: [6, 5], borderWidth: 2 },
      {
        label: 'Mediciones del radar',
        data: d.points.map((p) => ({ x: p.r, y: p.v })),
        showLine: false,
        pointRadius: 6,
        pointBackgroundColor: COLORS.accent,
        borderColor: '#0b1020',
        borderWidth: 2,
        order: -1,
      },
    ];
    if ($('showLag').checked) ds.push({ label: 'Lagrange', data: xy(d.lagrange), borderColor: COLORS.lag, borderWidth: 2.5 });
    if ($('showNew').checked)
      ds.push({ label: 'Newton (dif. divididas)', data: xy(d.newton), borderColor: COLORS.newton, borderWidth: 2, borderDash: [2, 3] });
    if ($('showSpl').checked) ds.push({ label: 'Spline cúbico natural', data: xy(d.spline), borderColor: COLORS.spl, borderWidth: 2.5 });
    if ($('showReg').checked)
      ds.push({ label: `Mínimos cuadrados (grado ${d.degree})`, data: xy(d.regression), borderColor: COLORS.reg, borderWidth: 2 });
    ds.push({
      label: `r* = ${d.query.r} m`,
      data: [{ x: d.query.r, y: -vmax * 0.5 }, { x: d.query.r, y: vmax * 1.6 }],
      borderColor: 'rgba(255,255,255,0.25)',
      borderWidth: 1,
      borderDash: [2, 4],
    });
    chartInterp.data.datasets = ds;
    chartInterp.options.scales.y.min = -Math.ceil((vmax * 0.5) / 10) * 10;
    chartInterp.options.scales.y.max = Math.ceil((vmax * 1.6) / 10) * 10;
    chartInterp.options.scales.x.min = 0;
    chartInterp.options.scales.x.max = d.grid[d.grid.length - 1];
    chartInterp.update();

    const e = d.errors;
    const q = d.query;
    $('interpMetrics').innerHTML =
      metric('Error máx. Lagrange', `${fmt(e.lagrange.max, 2)} m/s`, `En r*: ${fmt(q.lagrange, 2)} m/s`, COLORS.lag) +
      metric('Error máx. Newton', `${fmt(e.newton.max, 2)} m/s`, `|Lagrange − Newton| ≤ ${fmt(d.lagrangeNewtonMaxDiff)}`, COLORS.newton) +
      metric('Error máx. Spline', `${fmt(e.spline.max, 2)} m/s`, `En r*: ${fmt(q.spline, 2)} m/s`, COLORS.spl) +
      metric('Mínimos cuadrados', `R² = ${fmt(d.r2, 4)}`, `Error máx: ${fmt(e.regression.max, 2)} m/s`, COLORS.reg) +
      metric('Valor real en r*', `${fmt(q.exact, 2)} m/s`, `r* = ${q.r} m`, COLORS.exact);

    const n = d.points.length;
    let msg;
    if (e.lagrange.max > vmax * 0.6 && $('iSpacing').value !== 'chebyshev') {
      msg = `⚠️ <b>Fenómeno de Runge:</b> con ${n} puntos el polinomio de grado ${n - 1} oscila violentamente
        (error máx. ${fmt(e.lagrange.max, 1)} m/s). Cambia a <b>nodos de Chebyshev</b> o usa el <b>spline</b>.`;
    } else if (Number($('iNoise').value) > 0) {
      msg = `📡 Con ruido, la interpolación pasa <em>exactamente</em> por cada medición (también por el ruido).
        El ajuste por mínimos cuadrados no interpola: suaviza.`;
    } else {
      msg = `✅ Lagrange y Newton producen el <b>mismo polinomio</b> de grado ${n - 1}: su diferencia máxima es
        ${fmt(d.lagrangeNewtonMaxDiff)} (error de redondeo). El spline (error ${fmt(e.spline.max, 2)} m/s) evita las
        oscilaciones porque usa cúbicas por tramos.`;
    }
    $('interpInsight').innerHTML = msg;
    $('interpInsight').className = `callout${msg.startsWith('⚠️') ? ' warn' : ''}`;

    // Tabla de diferencias divididas
    const tbl = d.dividedDifferences;
    let html = '<table><thead><tr><th>i</th><th>rᵢ (m)</th>';
    for (let k = 0; k < tbl.length; k++) html += `<th>${k === 0 ? 'f[rᵢ]' : `Orden ${k}`}</th>`;
    html += '</tr></thead><tbody>';
    for (let i = 0; i < n; i++) {
      html += `<tr><td>${i}</td><td data-r="${i}">${fmt(d.points[i].r, 2)}</td>`;
      for (let k = 0; k < tbl.length; k++) {
        const v = tbl[k][i];
        if (v === undefined) html += '<td></td>';
        else html += `<td data-k="${k}" data-i="${i}"${i === 0 ? ' class="good"' : ''}>${fmt(v, 5)}</td>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table><p class="muted small">La primera fila (en verde) son los coeficientes del polinomio de Newton.</p>';
    $('ddTable').innerHTML = html;
    $('ddSteps').innerHTML = explainDividedDifferences(d);
    bindDDTable(d);
  } catch (err) {
    $('interpInsight').className = 'callout warn';
    $('interpInsight').textContent = err.message;
  }
}

/* =========================================================================
 * Sección 2 — Trayectorias (EDOs)
 * ======================================================================= */
let trajData = null;
let trajView = 300;
const chartTraj = makeChart('chartTraj', {
  scales: {
    x: { type: 'linear', title: { display: true, text: 'x (m)' } },
    y: { type: 'linear', title: { display: true, text: 'y (m)' } },
  },
  plugins: {
    tooltip: { enabled: false },
    legend: { display: false },
    title: { display: true, text: 'Trayectorias (línea punteada: solución exacta / referencia)' },
  },
});
const chartTrajErr = makeChart('chartTrajErr', {
  scales: {
    x: { type: 'linear', title: { display: true, text: 'Tiempo t (s)' } },
    y: { type: 'logarithmic', title: { display: true, text: 'Error de posición (m)' } },
  },
  plugins: { title: { display: true, text: 'Error acumulado vs tiempo' } },
});
const chartTrajConv = makeChart('chartTrajConv', {
  scales: {
    x: { type: 'logarithmic', reverse: true, title: { display: true, text: 'Paso h (s)' } },
    y: { type: 'logarithmic', title: { display: true, text: 'Error final (m)' } },
  },
  plugins: { title: { display: true, text: 'Convergencia log-log (pendiente = orden)' } },
});

const visibleMethods = () =>
  ['euler', 'heun', 'rk4'].filter((m) => $(`show${m === 'rk4' ? 'Rk4' : m[0].toUpperCase() + m.slice(1)}`).checked);

async function runTrajectory() {
  try {
    const d = await api('trajectory', {
      gamma: G.gamma,
      R: G.R,
      model: $('tModel').value,
      inflow: Number($('tIn').value),
      x0: Number($('tX0').value),
      y0: 0,
      tf: Number($('tTf').value),
      h: Number($('tH').value),
    });
    trajData = d;
    renderTrajectory();
  } catch (err) {
    $('trajInsight').className = 'callout warn';
    $('trajInsight').textContent = err.message;
  }
}

function renderTrajectory() {
  const d = trajData;
  if (!d) return;
  const methods = visibleMethods();
  const r0 = d.params.x0;
  const maxR = Math.max(...methods.map((m) => Math.max(...d.results[m].x.map((x, i) => Math.hypot(x, d.results[m].y[i])))), 0);
  trajView = Math.min(Math.max(Math.max(r0, d.params.R) * 1.3, maxR * 1.08), 4 * Math.max(r0, d.params.R));
  trajView = Math.ceil(trajView / 25) * 25;

  const circle = linspace(0, 2 * Math.PI, 100).map((a) => ({ x: d.params.R * Math.cos(a), y: d.params.R * Math.sin(a) }));
  const ds = [
    { label: 'Núcleo (r = R)', data: circle, borderColor: 'rgba(110,231,255,0.35)', backgroundColor: 'rgba(110,231,255,0.06)', fill: true, borderWidth: 1 },
    {
      label: d.hasExact ? 'Solución exacta' : 'Referencia (RK4, h muy fino)',
      data: d.reference.x.map((x, i) => ({ x, y: d.reference.y[i] })),
      borderColor: COLORS.exact,
      borderDash: [5, 5],
      borderWidth: 1.5,
    },
  ];
  for (const m of methods) {
    const r = d.results[m];
    ds.push({ label: METHOD_NAMES[m], data: r.x.map((x, i) => ({ x, y: r.y[i] })), borderColor: COLORS[m], borderWidth: 2 });
  }
  chartTraj.data.datasets = ds;
  Object.assign(chartTraj.options.scales.x, { min: -trajView, max: trajView });
  Object.assign(chartTraj.options.scales.y, { min: -trajView, max: trajView });
  chartTraj.update();

  chartTrajErr.data.datasets = methods.map((m) => ({
    label: METHOD_NAMES[m],
    data: d.results[m].t.map((t, i) => ({ x: t, y: Math.max(d.results[m].error[i], 1e-14) })).slice(1),
    borderColor: COLORS[m],
    borderWidth: 2,
  }));
  chartTrajErr.update();

  chartTrajConv.data.datasets = methods.map((m) => ({
    label: METHOD_NAMES[m],
    data: d.convergence.map((row) => ({ x: row.h, y: Math.max(row[m], 1e-14) })),
    borderColor: COLORS[m],
    backgroundColor: COLORS[m],
    pointRadius: 4,
    borderWidth: 2,
  }));
  chartTrajConv.update();

  const R = d.results;
  const ratio = R.euler.finalError / Math.max(R.rk4.finalError, 1e-15);
  $('trajMetrics').innerHTML =
    ['euler', 'heun', 'rk4']
      .map((m) =>
        metric(
          `Error final ${METHOD_NAMES[m]}`,
          `${fmt(R[m].finalError, 3)} m`,
          `${R[m].evaluations} evaluaciones de f · r final ${fmt(R[m].finalRadius, 1)} m`,
          COLORS[m],
        ),
      )
      .join('') +
    metric(
      d.hasExact ? 'Periodo de la órbita' : 'Pasos',
      d.hasExact ? `${fmt(d.period, 2)} s` : `${R.rk4.steps}`,
      d.hasExact ? `ω = ${fmt(d.omega, 4)} rad/s · ωh = ${fmt(d.omega * d.params.h, 3)}` : `h = ${d.params.h} s`,
      COLORS.exact,
    );

  let msg = `🏆 RK4 es <b>${ratio >= 1e6 ? ratio.toExponential(1) : Math.round(ratio).toLocaleString('es-MX')} veces</b>
    más preciso que Euler con el mismo paso h = ${d.params.h} s, usando sólo 4× más evaluaciones de f.`;
  if (d.hasExact && R.euler.finalRadius > r0 * 1.05)
    msg += ` Euler hace que la partícula <b>escape en espiral</b> (r: ${r0} → ${fmt(R.euler.finalRadius, 1)} m):
      cada paso sigue la tangente y se sale del círculo.`;
  if (!d.hasExact) msg += ' Con entrada radial la partícula cae en espiral hacia el núcleo; comparamos contra RK4 con h muy pequeño.';
  $('trajInsight').innerHTML = msg;
  $('trajInsight').className = 'callout';

  // Tabla de convergencia
  let html = '<table><thead><tr><th>h (s)</th>';
  for (const m of ['euler', 'heun', 'rk4']) html += `<th>Error ${METHOD_NAMES[m]}</th><th>p</th>`;
  html += '</tr></thead><tbody>';
  const expected = { euler: 1, heun: 2, rk4: 4 };
  for (const row of d.convergence) {
    html += `<tr><td>${fmt(row.h, 5)}</td>`;
    for (const m of ['euler', 'heun', 'rk4']) {
      const p = row[`${m}Order`];
      const cls = p === undefined || p === null ? '' : Math.abs(p - expected[m]) < 0.35 ? 'good' : '';
      html += `<td>${fmt(row[m], 4)}</td><td class="${cls}">${p === undefined || p === null ? '—' : p.toFixed(2)}</td>`;
    }
    html += '</tr>';
  }
  $('convTable').innerHTML = `${html}</tbody></table>`;
  $('convSteps').innerHTML = explainTrajConvergence(d);

  drawAnimFrame(animProgress);
}

/* ---- Animación de partículas en canvas ---- */
const animCanvas = $('animCanvas');
const actx = animCanvas.getContext('2d');
let animProgress = 1;
let animRunning = false;
let swirl = Array.from({ length: 260 }, () => ({ r: Math.random(), th: Math.random() * Math.PI * 2 }));

function sizeAnimCanvas() {
  animCanvas.width = animCanvas.clientWidth * devicePixelRatio;
  animCanvas.height = animCanvas.clientHeight * devicePixelRatio;
}

function drawAnimFrame(progress) {
  const d = trajData;
  if (!d) return;
  const W = animCanvas.width;
  const H = animCanvas.height;
  const S = Math.min(W, H) / (2 * trajView);
  const cx = W / 2;
  const cy = H / 2;
  const P = (x, y) => [cx + x * S, cy - y * S];

  actx.fillStyle = '#0d1430';
  actx.fillRect(0, 0, W, H);

  // Remolino de fondo (velocidad del modelo Rankine)
  const Rm = d.params.R;
  for (const p of swirl) {
    const r = 0.05 * trajView + p.r * trajView * 1.4;
    const w = r <= Rm ? d.params.gamma / (2 * Math.PI * Rm * Rm) : d.params.gamma / (2 * Math.PI * r * r);
    p.th += w * 0.03;
    const [x, y] = P(r * Math.cos(p.th), r * Math.sin(p.th));
    actx.fillStyle = 'rgba(110,231,255,0.18)';
    actx.fillRect(x, y, 2 * devicePixelRatio, 2 * devicePixelRatio);
  }
  // Núcleo
  actx.beginPath();
  actx.arc(cx, cy, Rm * S, 0, Math.PI * 2);
  actx.fillStyle = 'rgba(110,231,255,0.07)';
  actx.fill();
  actx.strokeStyle = 'rgba(110,231,255,0.4)';
  actx.lineWidth = devicePixelRatio;
  actx.stroke();

  const drawPath = (xs, ys, upto, color, width, dash = []) => {
    actx.beginPath();
    actx.setLineDash(dash.map((v) => v * devicePixelRatio));
    for (let i = 0; i <= upto; i++) {
      const [x, y] = P(xs[i], ys[i]);
      if (i === 0) actx.moveTo(x, y);
      else actx.lineTo(x, y);
    }
    actx.strokeStyle = color;
    actx.lineWidth = width * devicePixelRatio;
    actx.stroke();
    actx.setLineDash([]);
  };
  const dot = (x, y, color) => {
    const [px, py] = P(x, y);
    actx.beginPath();
    actx.arc(px, py, 6 * devicePixelRatio, 0, Math.PI * 2);
    actx.fillStyle = color;
    actx.shadowColor = color;
    actx.shadowBlur = 14 * devicePixelRatio;
    actx.fill();
    actx.shadowBlur = 0;
  };

  const ref = d.reference;
  const ri = Math.round(progress * (ref.x.length - 1));
  drawPath(ref.x, ref.y, ri, 'rgba(230,233,245,0.6)', 1.5, [5, 5]);
  dot(ref.x[ri], ref.y[ri], 'rgba(230,233,245,0.9)');

  for (const m of visibleMethods()) {
    const r = d.results[m];
    const i = Math.round(progress * (r.x.length - 1));
    drawPath(r.x, r.y, i, COLORS[m], 2);
    dot(r.x[i], r.y[i], COLORS[m]);
  }
  $('animTime').textContent = `t = ${(progress * d.params.tf).toFixed(1)} s`;
}

function playAnimation() {
  if (!trajData) return;
  animRunning = true;
  const duration = 7000;
  const start = performance.now();
  $('tPlay').textContent = '⏸ Reproduciendo…';
  function step(now) {
    animProgress = Math.min(1, Math.max(0, (now - start) / duration));
    drawAnimFrame(animProgress);
    if (animProgress < 1 && animRunning) requestAnimationFrame(step);
    else {
      animRunning = false;
      $('tPlay').textContent = '▶ Animar partículas';
    }
  }
  requestAnimationFrame(step);
}

/* =========================================================================
 * Sección 3 — Circulación (Trapecio vs Simpson)
 * ======================================================================= */
const chartCirc = makeChart('chartCirc', {
  scales: {
    x: { type: 'linear', title: { display: true, text: 'Radio s (m)' } },
    y: { title: { display: true, text: 'Integrando 2πs·ζ(s)  (m/s)' } },
  },
});
const chartCircConv = makeChart('chartCircConv', {
  scales: {
    x: { type: 'logarithmic', title: { display: true, text: 'Subintervalos n' } },
    y: { type: 'logarithmic', title: { display: true, text: '|Error| (m²/s)' } },
  },
  plugins: { title: { display: true, text: 'Convergencia: Trapecio O(h²) vs Simpson O(h⁴)' } },
});

async function runCirculation() {
  try {
    const d = await api('circulation', {
      gamma: G.gamma,
      R: G.R,
      model: $('cModel').value,
      rOut: Number($('cR').value),
      n: Number($('cN').value),
    });
    const nodes = d.nodes;
    const ds = [
      { label: 'Integrando exacto', data: d.curve.map((p) => ({ x: p.s, y: p.g })), borderColor: COLORS.exact, borderWidth: 2.5, order: 0 },
    ];
    if ($('showTrap').checked) {
      ds.push({
        label: 'Trapecios',
        data: nodes.map((p) => ({ x: p.s, y: p.g })),
        borderColor: COLORS.trap,
        backgroundColor: 'rgba(255,159,67,0.18)',
        fill: 'origin',
        borderWidth: 1.5,
        tension: 0,
      });
    }
    if ($('showSimp').checked) {
      // Reconstruye las parábolas de Simpson para cada par de subintervalos
      const pts = [];
      for (let i = 0; i + 2 < nodes.length; i += 2) {
        const [a, m, b] = [nodes[i], nodes[i + 1], nodes[i + 2]];
        for (const s of linspace(a.s, b.s, 24)) {
          const y =
            (a.g * (s - m.s) * (s - b.s)) / ((a.s - m.s) * (a.s - b.s)) +
            (m.g * (s - a.s) * (s - b.s)) / ((m.s - a.s) * (m.s - b.s)) +
            (b.g * (s - a.s) * (s - m.s)) / ((b.s - a.s) * (b.s - m.s));
          pts.push({ x: s, y });
        }
      }
      ds.push({
        label: 'Parábolas de Simpson',
        data: pts,
        borderColor: COLORS.simp,
        backgroundColor: 'rgba(34,211,238,0.12)',
        fill: 'origin',
        borderWidth: 2,
        borderDash: [6, 3],
      });
    }
    ds.push({
      label: 'Nodos',
      data: nodes.map((p) => ({ x: p.s, y: p.g })),
      showLine: false,
      pointRadius: 4,
      pointBackgroundColor: COLORS.accent,
    });
    chartCirc.data.datasets = ds;
    chartCirc.options.scales.x.min = 0;
    chartCirc.options.scales.x.max = d.rOut;
    chartCirc.update();

    chartCircConv.data.datasets = [
      { label: 'Trapecio', data: d.convergence.map((c) => ({ x: c.n, y: Math.max(c.trapError, 1e-13) })), borderColor: COLORS.trap, backgroundColor: COLORS.trap, pointRadius: 4, borderWidth: 2 },
      { label: 'Simpson 1/3', data: d.convergence.map((c) => ({ x: c.n, y: Math.max(c.simpError, 1e-13) })), borderColor: COLORS.simp, backgroundColor: COLORS.simp, pointRadius: 4, borderWidth: 2 },
    ];
    chartCircConv.update();

    const better = d.trapezoid.error / Math.max(d.simpson.error, 1e-15);
    $('circMetrics').innerHTML =
      metric('Γ exacta', `${fmt(d.exact, 2)}`, 'm²/s (solución analítica)', COLORS.exact) +
      metric('Trapecio', `${fmt(d.trapezoid.value, 2)}`, `Error rel. ${(d.trapezoid.relError * 100).toPrecision(3)} %`, COLORS.trap) +
      metric('Simpson 1/3', `${fmt(d.simpson.value, 2)}`, `Error rel. ${(d.simpson.relError * 100).toPrecision(3)} %`, COLORS.simp) +
      metric('Ventaja de Simpson', `${better >= 1e5 ? better.toExponential(1) : better.toFixed(1)}×`, `con n = ${d.n} subintervalos`, COLORS.accent);

    const last = d.convergence[d.convergence.length - 1];
    let msg;
    if (d.model === 'rankine' && d.rOut > G.R) {
      const h = d.rOut / d.n;
      const onNode = Math.abs(G.R / h - Math.round(G.R / h)) < 1e-9;
      msg = `⚡ En Rankine la vorticidad <b>salta</b> de ${fmt(G.gamma / (Math.PI * G.R * G.R), 3)} a 0 en r = R = ${G.R} m.
        ${onNode ? 'Ahora mismo R coincide con un nodo, por eso el error es pequeño.' : 'R cae dentro de un subintervalo, así que'}
        Ambos métodos pierden su orden teórico (órdenes observados ≈ ${fmt(last.trapOrder, 2)} y ${fmt(last.simpOrder, 2)}):
        la teoría de error exige un integrando suave.`;
    } else {
      msg = `📐 Con n = ${d.n}, Simpson es ${better >= 1e5 ? better.toExponential(1) : better.toFixed(1)} veces más preciso que el Trapecio
        con <em>exactamente las mismas</em> ${d.n + 1} evaluaciones. En la tabla, el orden observado tiende a 2 (Trapecio) y 4 (Simpson).`;
    }
    $('circInsight').innerHTML = msg;
    $('circInsight').className = 'callout';

    let html = '<table><thead><tr><th>n</th><th>h (m)</th><th>Trapecio</th><th>Error</th><th>p</th><th>Simpson</th><th>Error</th><th>p</th></tr></thead><tbody>';
    for (const c of d.convergence) {
      html += `<tr class="${c.n === d.n ? 'active' : ''}"><td>${c.n}</td><td>${fmt(c.h, 3)}</td><td>${fmt(c.trapezoid, 4)}</td>
        <td>${fmt(c.trapError, 3)}</td><td>${c.trapOrder == null ? '—' : c.trapOrder.toFixed(2)}</td><td>${fmt(c.simpson, 4)}</td>
        <td>${fmt(c.simpError, 3)}</td><td>${c.simpOrder == null ? '—' : c.simpOrder.toFixed(2)}</td></tr>`;
    }
    $('circTable').innerHTML = `${html}</tbody></table><p class="muted small">p = log₂(Eₙ / E₂ₙ). Cuando el error llega a ~10⁻⁹ domina el redondeo y p deja de tener sentido.</p>`;
    $('circSteps').innerHTML = explainCirculation(d);
  } catch (err) {
    $('circInsight').className = 'callout warn';
    $('circInsight').textContent = err.message;
  }
}

/* =========================================================================
 * Sección 4 — Newton-Raphson
 * ======================================================================= */
let rootData = null;
let rootShown = Infinity;
const fU = (u) => (1 + 2 * u * u) * Math.exp(-u * u) - 1;

const chartRootF = makeChart('chartRootF', {
  scales: {
    x: { type: 'linear', title: { display: true, text: 'Radio r (m)' } },
    y: { min: -1.1, max: 0.5, title: { display: true, text: 'f(r/R)' } },
  },
  plugins: { title: { display: true, text: 'f(u) = (1 + 2u²)e^(−u²) − 1 y rectas tangentes' } },
});
const chartRootV = makeChart('chartRootV', {
  scales: {
    x: { type: 'linear', title: { display: true, text: 'Radio r (m)' } },
    y: { title: { display: true, text: 'v (m/s)' } },
  },
  plugins: { title: { display: true, text: 'Perfil de velocidad y pico encontrado' } },
});

async function runRoots() {
  try {
    rootData = await api('roots', { gamma: G.gamma, R: G.R, r0: Number($('nR0').value), tol: Number($('nTol').value) });
    rootShown = Infinity;
    renderRoots();
  } catch (err) {
    $('rootInsight').className = 'callout warn';
    $('rootInsight').textContent = err.message;
  }
}

function renderRoots() {
  const d = rootData;
  if (!d) return;
  const its = d.newton.iterations;
  const shown = Math.min(rootShown, its.length);
  const R = d.rc;
  const xMax = 4 * R;

  const ds = [
    { label: 'f(u)', data: d.fCurve.map((p) => ({ x: p.r, y: p.f })), borderColor: COLORS.exact, borderWidth: 2.5 },
    { label: '_eje', data: [{ x: 0, y: 0 }, { x: xMax, y: 0 }], borderColor: 'rgba(255,255,255,0.25)', borderWidth: 1 },
  ];
  const tangentPts = [];
  const iterPts = [];
  for (let k = 0; k < shown; k++) {
    const it = its[k];
    iterPts.push({ x: it.x, y: it.fx });
    tangentPts.push({ x: it.x, y: it.fx }, { x: it.xNew, y: 0 }, { x: it.xNew, y: fU(it.xNew / R) }, { x: NaN, y: NaN });
  }
  ds.push({ label: 'Tangentes', data: tangentPts, borderColor: COLORS.trap, borderWidth: 1.5, spanGaps: false });
  ds.push({
    label: 'Iteraciones rₖ',
    data: iterPts,
    showLine: false,
    pointRadius: 5,
    pointBackgroundColor: COLORS.accent,
  });
  chartRootF.data.datasets = ds;
  chartRootF.options.scales.x.min = 0;
  chartRootF.options.scales.x.max = xMax;
  chartRootF.update();

  const peak = d.newton.converged && d.newton.root > 1e-6;
  chartRootV.data.datasets = [
    { label: 'Lamb-Oseen', data: d.velocityCurve.map((p) => ({ x: p.r, y: p.lamb })), borderColor: COLORS.rk4, borderWidth: 2.5 },
    { label: 'Rankine', data: d.velocityCurve.map((p) => ({ x: p.r, y: p.rankine })), borderColor: COLORS.lag, borderWidth: 1.5, borderDash: [5, 4] },
    ...(peak
      ? [{ label: `Máximo r* = ${fmt(d.newton.root, 3)} m`, data: [{ x: d.newton.root, y: d.vMax }], showLine: false, pointRadius: 8, pointStyle: 'star', borderColor: '#ffcc4d', borderWidth: 3 }]
      : []),
  ];
  chartRootV.options.scales.x.min = 0;
  chartRootV.options.scales.x.max = xMax;
  chartRootV.update();

  $('rootMetrics').innerHTML =
    metric('Radio de vel. máxima r*', d.newton.converged ? `${fmt(d.newton.root, 4)} m` : '—', `u* = r*/R = ${fmt(d.newton.rootU, 6)}`, COLORS.rk4) +
    metric('Velocidad máxima', peak ? `${fmt(d.vMax, 2)} m/s` : '—', peak ? `${(d.vMax * 3.6).toFixed(0)} km/h` : '', COLORS.accent) +
    metric('Iteraciones Newton', `${its.length}`, d.newton.converged ? 'convergencia cuadrática' : 'no convergió', COLORS.trap) +
    metric('Iteraciones Bisección', `${d.bisection.iterations}`, 'misma tolerancia, intervalo [0.5R, 3R]', COLORS.lag) +
    metric('Pico Rankine', `${fmt(d.rankine.vPeak, 2)} m/s`, `en r = R = ${R} m (no diferenciable)`, COLORS.lag);

  let msg;
  if (!d.newton.converged) {
    msg = `❌ Newton-Raphson <b>no convergió</b> desde r₀ = ${fmt(d.u0 * R, 2)} m: ${d.newton.reason}.
      Esto ilustra que Newton sólo converge si r₀ está suficientemente cerca de la raíz.`;
  } else if (d.newton.root < 1e-6 * R) {
    msg = `⚠️ Newton convergió a la raíz <b>trivial</b> r = 0 (f(0) = 0), no al pico. Con r₀ por debajo de
      ${fmt(R / Math.SQRT2, 2)} m (donde f'(u) = 0) la tangente nos lleva hacia el origen. Además r = 0 es una raíz
      <b>múltiple</b> (f'(0) = 0), por eso la convergencia se vuelve sólo lineal: ${its.length} iteraciones.`;
  } else {
    msg = `🎯 Newton encontró el pico en <b>r* = ${fmt(d.newton.root, 4)} m ≈ ${fmt(d.newton.rootU, 4)}·R</b> en
      ${its.length} iteraciones; bisección necesitó ${d.bisection.iterations}. Observa en la tabla cómo el error
      ≈ se eleva al cuadrado en cada paso. El pico real está <em>${((d.newton.rootU - 1) * 100).toFixed(1)} % más afuera</em>
      que en el modelo de Rankine y es ${((1 - d.vMax / d.rankine.vPeak) * 100).toFixed(1)} % menor.`;
  }
  $('rootInsight').innerHTML = msg;
  $('rootInsight').className = `callout${d.newton.converged && d.newton.root > 1e-6 * R ? '' : ' warn'}`;

  let html = '<table><thead><tr><th>k</th><th>rₖ (m)</th><th>f(uₖ)</th><th>f′(uₖ)</th><th>rₖ₊₁ (m)</th><th>|rₖ₊₁ − rₖ| / R</th></tr></thead><tbody>';
  its.forEach((it, k) => {
    if (k >= shown) return;
    html += `<tr data-k="${k}" class="${k === shown - 1 ? 'active' : ''}"><td>${it.k - 1}</td><td>${fmt(it.x, 8)}</td><td>${fmt(it.fx, 6)}</td>
      <td>${fmt(it.dfx, 6)}</td><td>${fmt(it.xNew, 8)}</td><td>${it.error.toExponential(3)}</td></tr>`;
  });
  $('rootTable').innerHTML = `${html}</tbody></table>`;
  $('rootSteps').innerHTML = explainNewton(d, Math.max(0, shown - 1), Number($('nTol').value));
}

/* =========================================================================
 * Enlaces de eventos
 * ======================================================================= */
const runInterpD = debounce(runInterpolation);
const runTrajD = debounce(runTrajectory, 200);
const runCircD = debounce(runCirculation);
const runRootsD = debounce(runRoots);

bindOutput('iN');
bindOutput('iNoise', ' m/s');
bindOutput('iDeg');
bindOutput('iQ', ' m');
bindOutput('tH', ' s');
bindOutput('tTf', ' s');
bindOutput('tX0', ' m');
bindOutput('tIn');
bindOutput('cN');
bindOutput('cR', ' m');
bindOutput('nR0', ' m');

['iN', 'iSpacing', 'iNoise', 'iModel', 'iDeg', 'iQ', 'showLag', 'showNew', 'showSpl', 'showReg'].forEach((id) =>
  $(id).addEventListener('input', runInterpD),
);
$('iN').addEventListener('input', () => {
  $('iDeg').max = Math.min(10, Number($('iN').value) - 1);
  if (Number($('iDeg').value) > Number($('iDeg').max)) $('iDeg').value = $('iDeg').max;
  $('iDegOut').textContent = $('iDeg').value;
});
$('iReseed').addEventListener('click', () => {
  interpSeed = Math.floor(Math.random() * 1e6);
  if ($('iSpacing').value === 'uniform' && Number($('iNoise').value) === 0) $('iSpacing').value = 'random';
  runInterpolation();
});

['tH', 'tTf', 'tX0', 'tIn', 'tModel'].forEach((id) => $(id).addEventListener('input', runTrajD));
['showEuler', 'showHeun', 'showRk4'].forEach((id) => $(id).addEventListener('input', renderTrajectory));
$('tPlay').addEventListener('click', playAnimation);

['cN', 'cR', 'cModel', 'showTrap', 'showSimp'].forEach((id) => $(id).addEventListener('input', runCircD));

['nR0', 'nTol'].forEach((id) => $(id).addEventListener('input', runRootsD));
$('nStep').addEventListener('click', () => {
  if (!rootData) return;
  const total = rootData.newton.iterations.length;
  rootShown = rootShown >= total ? 1 : rootShown + 1;
  renderRoots();
});
$('nAll').addEventListener('click', () => {
  rootShown = Infinity;
  renderRoots();
});
// Clic en una fila de Newton: se muestran las iteraciones hasta esa fila y se explica
$('rootTable').addEventListener('click', (e) => {
  const tr = e.target.closest('tr[data-k]');
  if (!tr || !rootData) return;
  rootShown = Number(tr.dataset.k) + 1;
  renderRoots();
});

const runAll = () => {
  runInterpolation();
  runTrajectory();
  runCirculation();
  runRoots();
};
const runAllD = debounce(runAll, 250);
['gGamma', 'gR'].forEach((id) =>
  $(id).addEventListener('input', () => {
    updateGlobals();
    runAllD();
  }),
);

window.addEventListener('resize', () => {
  sizeAnimCanvas();
  drawAnimFrame(animProgress);
});

// Fondo animado continuo del canvas de partículas cuando no se reproduce
(function idleSwirl() {
  if (!animRunning && trajData) drawAnimFrame(animProgress);
  setTimeout(() => requestAnimationFrame(idleSwirl), 50);
})();

// Valores iniciales dependientes de R
$('cR').value = 2 * G.R;
$('nR0').value = Math.round(1.6 * G.R);
$('iQ').value = Math.round(1.5 * G.R);
sizeAnimCanvas();
updateGlobals();
runAll();
