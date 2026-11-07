/* global L, Chart, $, api, fmt, metric, efScale, updateGlobals, runAll */
'use strict';

/* =========================================================================
 * Simulador EF0–EF5 sobre el mapa
 * ======================================================================= */
const M_PER_DEG = 111320;
const sim = {
  levels: [],
  level: 3,
  heading: 45,
  start: null,
  house: null,
  data: null,
  progress: 1,
  playing: false,
};

/* ---------- Mapa base ---------- */
const map = L.map('map', { zoomControl: true, preferCanvas: false });
const baseLayers = {
  Oscuro: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  }),
  Calles: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }),
  Satélite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: 'Imágenes &copy; Esri',
  }),
};
baseLayers.Satélite.addTo(map);
L.control.layers(baseLayers, null, { position: 'topright' }).addTo(map);
L.control.scale({ imperial: false, position: 'bottomright' }).addTo(map);

let tileErrorShown = false;
Object.values(baseLayers).forEach((layer) =>
  layer.on('tileerror', () => {
    if (tileErrorShown) return;
    tileErrorShown = true;
    document.querySelector('.map-hint').textContent = '⚠️ Sin conexión: el mapa base no carga, pero la simulación sí funciona.';
  }),
);

/* ---------- Conversión metros ↔ lat/lon (aproximación local plana) ---------- */
const toLatLng = (x, y) => {
  const lat0 = sim.start.lat;
  return L.latLng(lat0 + y / M_PER_DEG, sim.start.lng + x / (M_PER_DEG * Math.cos((lat0 * Math.PI) / 180)));
};
const fromLatLng = (ll) => ({
  x: (ll.lng - sim.start.lng) * M_PER_DEG * Math.cos((sim.start.lat * Math.PI) / 180),
  y: (ll.lat - sim.start.lat) * M_PER_DEG,
});

/* ---------- Capas de la simulación ---------- */
const zoneLayer = L.layerGroup().addTo(map);
const pathAhead = L.polyline([], { color: '#ffffff', weight: 2, opacity: 0.5, dashArray: '6 8' }).addTo(map);
const pathDone = L.polyline([], { color: '#ffffff', weight: 2.5, opacity: 0.95 }).addTo(map);
const influence = L.circle([0, 0], { radius: 1, color: '#6ee7ff', weight: 1, fillOpacity: 0.05, dashArray: '4 4' }).addTo(map);
const core = L.circle([0, 0], { radius: 1, color: '#e6e9f5', weight: 1.5, fillColor: '#e6e9f5', fillOpacity: 0.25 }).addTo(map);
const tornadoMarker = L.marker([0, 0], {
  icon: L.divIcon({ className: '', html: '<div class="tornado-icon"></div>', iconSize: [46, 46], iconAnchor: [23, 23] }),
  interactive: false,
  zIndexOffset: 900,
}).addTo(map);
const startMarker = L.marker([0, 0], {
  icon: L.divIcon({ className: 'start-icon', html: '📍', iconSize: [24, 24], iconAnchor: [12, 22] }),
  interactive: false,
}).addTo(map);
const houseMarker = L.marker([0, 0], {
  icon: L.divIcon({ className: 'emoji-icon', html: '🏠', iconSize: [32, 32], iconAnchor: [16, 26] }),
  draggable: true,
  zIndexOffset: 1000,
  title: 'Arrástrame',
});
let zonePolys = [];

/* ---------- Gráficas ---------- */
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const efBandsPlugin = {
  id: 'efBands',
  beforeDatasetsDraw(chart) {
    if (!sim.levels.length) return;
    const { ctx, chartArea: a, scales } = chart;
    ctx.save();
    ctx.font = '11px Consolas, monospace';
    for (const l of sim.levels) {
      const y = scales.y.getPixelForValue(l.minKmh);
      if (y < a.top || y > a.bottom) continue;
      ctx.strokeStyle = l.color;
      ctx.globalAlpha = 0.6;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(a.left, y);
      ctx.lineTo(a.right, y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = l.color;
      ctx.fillText(l.name, a.right - 30, y - 3);
    }
    ctx.restore();
  },
  afterDatasetsDraw(chart) {
    if (!sim.data) return;
    const { ctx, chartArea: a, scales } = chart;
    const x = scales.x.getPixelForValue((sim.progress * sim.data.T) / 60);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x, a.top);
    ctx.lineTo(x, a.bottom);
    ctx.stroke();
    ctx.restore();
  },
};

const timeChart = (id, title) =>
  new Chart($(id), {
    type: 'line',
    data: { datasets: [] },
    plugins: [efBandsPlugin],
    options: {
      interaction: { mode: 'nearest', intersect: false },
      scales: {
        x: { type: 'linear', min: 0, title: { display: true, text: 'Tiempo (min)' } },
        y: { min: 0, title: { display: true, text: 'Viento (km/h)' } },
      },
      plugins: {
        title: { display: true, text: title },
        tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.y.toFixed(0)} km/h` } },
      },
    },
  });
const chartHouse = timeChart('chartHouse', '🏠 Viento sobre tu casa');
const chartIntensity = timeChart('chartIntensity', 'Viento máximo del tornado durante su vida');

/* ---------- Selector EF ---------- */
function renderPickers() {
  const big = sim.levels
    .map(
      (l) => `<button class="ef-btn" data-level="${l.id}" style="--c:${l.color}">${l.name}
        <small>${l.minKmh}${l.maxKmh ? `–${l.maxKmh}` : '+'} km/h</small></button>`,
    )
    .join('');
  const small = sim.levels.map((l) => `<button class="ef-btn" data-level="${l.id}" style="--c:${l.color}">${l.name}</button>`).join('');
  $('efPicker').innerHTML = big;
  $('efPickerGlobal').innerHTML = small;
  document.querySelectorAll('.ef-btn').forEach((b) =>
    b.addEventListener('click', () => selectLevel(Number(b.dataset.level), { applyGlobals: true, play: true })),
  );
}

function markActive(globalToo) {
  document.querySelectorAll('#efPicker .ef-btn').forEach((b) => b.classList.toggle('active', Number(b.dataset.level) === sim.level));
  if (globalToo !== undefined) {
    document
      .querySelectorAll('#efPickerGlobal .ef-btn')
      .forEach((b) => b.classList.toggle('active', globalToo && Number(b.dataset.level) === sim.level));
  }
}

function applyToGlobals(l) {
  // Vórtice estacionario con la misma velocidad máxima: Γ = 2π R Vmax
  const vmax = l.vmaxKmh / 3.6;
  $('gR').value = l.R;
  $('gGamma').value = Math.round((2 * Math.PI * l.R * vmax) / 100) * 100;
  updateGlobals();
  runAll();
}

function renderEfCard() {
  const l = sim.levels[sim.level];
  const d = sim.data;
  $('efCard').style.setProperty('--c', l.color);
  $('efCard').innerHTML = `
    <h3>${l.name}<small>${l.title}</small></h3>
    <div class="range">${l.minKmh}${l.maxKmh ? `–${l.maxKmh}` : '+'} km/h · ${l.frequency}</div>
    <p>${l.damage}</p>
    <dl>
      <dt>Viento máx. simulado</dt><dd>${l.vmaxKmh} km/h</dd>
      <dt>Radio del núcleo R</dt><dd>${l.R} m</dd>
      <dt>Traslación V<sub>t</sub></dt><dd>${(l.vt * 3.6).toFixed(0)} km/h</dd>
      <dt>Duración</dt><dd>${l.durationMin} min</dd>
      <dt>Γ máx. (con traslación)</dt><dd>${d ? fmt(d.gammaMax, 0) : '—'} m²/s</dd>
    </dl>
    ${l.example ? `<div class="example">📰 Ejemplo real: ${l.example}</div>` : ''}`;
}

/* ---------- Cálculo ---------- */
function showSimError(err) {
  const offline = err instanceof TypeError;
  const msg = offline
    ? '⚠️ No hay conexión con el servidor. ¿Está corriendo <code>npm start</code>? (En Render, espera ~1 min a que despierte y vuelve a intentar.)'
    : `⚠️ Error en la simulación: ${err.message}`;
  const box = $('simError');
  box.innerHTML = msg;
  box.hidden = false;
}

async function simulate({ fit = false } = {}) {
  const house = sim.house ? fromLatLng(sim.house) : null;
  try {
    sim.data = await api('simulate', { level: sim.level, heading: sim.heading, house });
  } catch (err) {
    stop();
    showSimError(err);
    return false;
  }
  $('simError').hidden = true;
  buildLayers();
  if (fit) fitAll();
  renderEfCard();
  renderStats();
  renderCharts();
  renderFrame(sim.progress);
  return true;
}

function buildLayers() {
  const d = sim.data;
  zoneLayer.clearLayers();
  zonePolys = d.zones.map((z) =>
    L.polygon([], { color: z.color, weight: 1, fillColor: z.color, fillOpacity: 0.25 + 0.07 * z.level, opacity: 0.8 })
      .bindTooltip(`${z.name}: viento ≥ ${sim.levels[z.level].minKmh} km/h`, { sticky: true })
      .addTo(zoneLayer),
  );
  pathAhead.setLatLngs(d.track.map((p) => toLatLng(p.x, p.y)));
  startMarker.setLatLng(sim.start);
  if (sim.house) houseMarker.setLatLng(sim.house).addTo(map);
}

function renderFrame(p) {
  const d = sim.data;
  if (!d) return;
  sim.progress = p;
  const n = d.track.length;
  const idx = Math.min(n - 1, Math.max(0, Math.round(p * (n - 1))));
  d.zones.forEach((z, k) => {
    const left = z.left.slice(0, idx + 1).map(([x, y]) => toLatLng(x, y));
    const right = z.right.slice(0, idx + 1).reverse().map(([x, y]) => toLatLng(x, y));
    zonePolys[k].setLatLngs(left.concat(right));
  });
  pathDone.setLatLngs(d.track.slice(0, idx + 1).map((pt) => toLatLng(pt.x, pt.y)));

  const pt = d.track[idx];
  const pos = toLatLng(pt.x, pt.y);
  const alive = pt.gamma > 1e-6 && p < 1;
  if (sim.playing && $('simFollow').checked) map.setView(pos, Math.max(map.getZoom(), 15), { animate: false });
  tornadoMarker.setLatLng(pos).setOpacity(alive ? 1 : 0);
  core.setLatLng(pos).setRadius(d.R).setStyle({ opacity: alive ? 1 : 0, fillOpacity: alive ? 0.25 : 0 });
  const vth0 = sim.levels[0].minKmh / 3.6;
  const rInf = (pt.gamma * (1 + d.coupling)) / (2 * Math.PI * vth0);
  influence.setLatLng(pos).setRadius(Math.max(rInf, 1)).setStyle({ opacity: alive ? 0.8 : 0, fillOpacity: alive ? 0.05 : 0 });

  const t = p * d.T;
  $('simClock').textContent = `t = ${fmtTime(t)} / ${fmtTime(d.T)}`;
  $('simTime').value = Math.round(p * 1000);
  $('simTimeOut').textContent = `${fmtTime(t)} min`;
  renderHouse(t);
  chartHouse.draw();
  chartIntensity.draw();
}

function houseWindAt(t) {
  const h = sim.data.house;
  if (!h) return 0;
  let i = 0;
  while (i < h.t.length - 1 && h.t[i + 1] < t) i++;
  if (i >= h.t.length - 1) return h.speed[h.t.length - 1];
  const a = (t - h.t[i]) / (h.t[i + 1] - h.t[i]);
  return h.speed[i] + a * (h.speed[i + 1] - h.speed[i]);
}

function verdict(level, kmh) {
  if (level >= 0) {
    const l = sim.levels[level];
    return { color: l.color, text: `<b>${l.name}:</b> ${l.house}` };
  }
  if (kmh > 60) return { color: '#98a2c8', text: 'Viento fuerte: ramas caídas y objetos sueltos volando, sin daño estructural.' };
  return { color: '#4ade80', text: 'Sin daños: el tornado pasa lejos.' };
}

function renderHouse(t) {
  const h = sim.data.house;
  if (!h) {
    $('houseCard').innerHTML = '<h4>🏠 Tu casa</h4><p class="muted">Pulsa “Casa en la trayectoria” o arrastra la 🏠.</p>';
    return;
  }
  const now = houseWindAt(t) * 3.6;
  const passed = t >= h.tMax;
  const maxSoFar = passed ? h.max : Math.max(...h.speed.filter((_, i) => h.t[i] <= t), 0);
  const level = sim.levels.reduce((acc, l) => (maxSoFar * 3.6 >= l.minKmh ? l.id : acc), -1);
  const v = verdict(level, maxSoFar * 3.6);
  const finalV = verdict(h.level, h.max * 3.6);
  $('houseCard').innerHTML = `
    <h4>🏠 Tu casa</h4>
    <div class="muted small">Viento en este instante</div>
    <div class="big" style="color:${now >= 105 ? sim.levels[Math.max(0, efIndex(now))].color : 'var(--text)'}">${now.toFixed(0)} km/h</div>
    <div class="muted small">Máximo hasta ahora: <b>${(maxSoFar * 3.6).toFixed(0)} km/h</b> ·
      distancia mínima al centro: ${fmt(h.minDist, 0)} m</div>
    <div class="verdict" style="--c:${v.color}">${v.text}</div>
    ${
      sim.progress >= 1
        ? ''
        : `<div class="muted small" style="margin-top:6px">Pronóstico final: ${(h.max * 3.6).toFixed(0)} km/h →
          <span style="color:${finalV.color}">${h.level >= 0 ? sim.levels[h.level].name : 'sin daño estructural'}</span>
          a los ${fmtTime(h.tMax)}</div>`
    }`;
}

const efIndex = (kmh) => sim.levels.reduce((acc, l) => (kmh >= l.minKmh ? l.id : acc), -1);

function renderStats() {
  const d = sim.data;
  const z0 = d.zones[0];
  const top = d.zones[d.zones.length - 1];
  $('simMetrics').innerHTML =
    metric('Recorrido', `${(d.pathLength / 1000).toFixed(1)} km`, 'longitud de arco de la trayectoria RK4', '#e6e9f5') +
    metric('Duración', `${fmtTime(d.T)} min`, `traslación ${(d.Vt * 3.6).toFixed(0)} km/h`, '#6ee7ff') +
    metric('Ancho máximo de daño', `${fmt(z0.maxWidth, 0)} m`, 'franja EF0 o mayor', z0.color) +
    metric('Área dañada total', `${(z0.area / 1e6).toFixed(2)} km²`, 'integrada con Simpson 1/3', z0.color) +
    metric(`Área ${top.name}`, `${(top.area / 1e6).toFixed(3)} km²`, `${((top.area / z0.area) * 100).toFixed(1)} % del total`, top.color);

  let html =
    '<table><thead><tr><th style="text-align:left">Categoría</th><th>Ancho máx. (m)</th><th>Área Simpson (km²)</th><th>Área Trapecio (km²)</th><th>Diferencia</th></tr></thead><tbody>';
  for (const z of d.zones) {
    html += `<tr><td style="text-align:left"><span class="swatch" style="background:${z.color}"></span>${z.name} o mayor</td>
      <td>${fmt(z.maxWidth, 1)}</td><td>${(z.area / 1e6).toFixed(4)}</td><td>${(z.areaTrap / 1e6).toFixed(4)}</td>
      <td>${((Math.abs(z.area - z.areaTrap) / z.area) * 100).toFixed(3)} %</td></tr>`;
  }
  $('simAreaTable').innerHTML = `${html}</tbody></table>`;
}

function renderCharts() {
  const d = sim.data;
  const tMax = d.T / 60;
  const top = sim.levels[sim.level];
  const yMax = Math.ceil((top.vmaxKmh * 1.1) / 50) * 50;
  for (const c of [chartHouse, chartIntensity]) {
    c.options.scales.x.max = tMax;
    c.options.scales.y.max = yMax;
  }
  chartIntensity.data.datasets = [
    {
      label: 'Viento máx. sobre el suelo',
      data: d.track.map((p) => ({ x: p.t / 60, y: (p.gamma / (2 * Math.PI * d.R)) * (1 + d.coupling) * 3.6 })),
      borderColor: top.color,
      backgroundColor: `${top.color}33`,
      fill: 'origin',
      borderWidth: 2,
    },
  ];
  chartIntensity.update();
  chartHouse.data.datasets = d.house
    ? [
        {
          label: 'Viento en tu casa',
          data: d.house.t.map((t, i) => ({ x: t / 60, y: d.house.speed[i] * 3.6 })),
          borderColor: '#6ee7ff',
          backgroundColor: 'rgba(110,231,255,0.15)',
          fill: 'origin',
          borderWidth: 2,
        },
      ]
    : [];
  chartHouse.update();
}

/* ---------- Animación ---------- */
function play() {
  if (!sim.data) return;
  sim.playing = true;
  $('simPlay').textContent = '⏸ Pausa';
  const duration = 12000;
  const startP = sim.progress >= 1 ? 0 : sim.progress;
  const t0 = performance.now() - startP * duration;
  function step(now) {
    if (!sim.playing) return;
    const p = Math.min(1, Math.max(0, (now - t0) / duration));
    renderFrame(p);
    if (p < 1) requestAnimationFrame(step);
    else stop();
  }
  requestAnimationFrame(step);
}
function stop() {
  const wasFollowing = sim.playing && $('simFollow').checked;
  sim.playing = false;
  $('simPlay').textContent = '▶ Simular';
  // Al terminar el recorrido completo, se muestra toda la franja de daño
  if (wasFollowing && sim.progress >= 1) fitAll();
}
function fitAll() {
  if (!sim.data) return;
  const b = L.latLngBounds(sim.data.track.map((p) => toLatLng(p.x, p.y)));
  if (sim.house) b.extend(sim.house);
  map.fitBounds(b.pad(0.15), { animate: true });
}

/* ---------- Interacción ---------- */
async function selectLevel(level, { applyGlobals = false, play: autoPlay = false } = {}) {
  stop();
  sim.level = level;
  markActive(applyGlobals ? true : undefined);
  if (applyGlobals) applyToGlobals(sim.levels[level]);
  sim.progress = autoPlay ? 0 : 1;
  const ok = await simulate({ fit: true });
  if (ok && autoPlay) play();
}

function placeHouseOnPath() {
  const d = sim.data;
  if (!d) return;
  const top = d.zones[d.zones.length - 1];
  // Punto de mayor ancho de la franja más intensa (lado derecho, donde el viento es mayor)
  let best = 0;
  let bestW = -1;
  d.track.forEach((p, i) => {
    const w = Math.hypot(top.right[i][0] - p.x, top.right[i][1] - p.y);
    if (w > bestW) {
      bestW = w;
      best = i;
    }
  });
  const p = d.track[best];
  const [rx, ry] = top.right[best];
  sim.house = toLatLng(p.x + 0.99 * (rx - p.x), p.y + 0.99 * (ry - p.y));
}

map.on('click', async (e) => {
  stop();
  const moved = sim.house ? fromLatLng(sim.house) : null;
  sim.start = e.latlng;
  // La casa conserva su posición relativa al nuevo punto de contacto
  if (moved) sim.house = toLatLng(moved.x, moved.y);
  sim.progress = 1;
  await simulate({ fit: true });
});

houseMarker.on('dragend', async () => {
  sim.house = houseMarker.getLatLng();
  await simulate();
});

$('simPlace').addEventListener('change', async () => {
  stop();
  const [lat, lng] = $('simPlace').value.split(',').map(Number);
  sim.start = L.latLng(lat, lng);
  sim.progress = 1;
  if (!(await simulate({ fit: false }))) return;
  placeHouseOnPath();
  await simulate({ fit: true });
});

$('simHeading').addEventListener('change', async () => {
  stop();
  sim.heading = Number($('simHeading').value);
  sim.progress = 1;
  if (!(await simulate())) return;
  placeHouseOnPath();
  await simulate({ fit: true });
});

$('simPlay').addEventListener('click', () => (sim.playing ? stop() : play()));
$('simHouse').addEventListener('click', async () => {
  placeHouseOnPath();
  await simulate();
});
$('simTime').addEventListener('input', () => {
  stop();
  renderFrame(Number($('simTime').value) / 1000);
});

// Si se mueven Γ o R a mano, el tornado global ya no corresponde a una categoría exacta
['gGamma', 'gR'].forEach((id) => $(id).addEventListener('input', (e) => e.isTrusted && markActive(false)));

/* ---------- Inicio ---------- */
(async function initSimulator() {
  const [lat, lng] = $('simPlace').value.split(',').map(Number);
  sim.start = L.latLng(lat, lng);
  map.setView(sim.start, 13);
  try {
    const res = await fetch('/api/ef-scale');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    sim.levels = await res.json();
  } catch (err) {
    showSimError(err);
    // Reintenta hasta que el servidor responda (p. ej. si se inició después o Render está despertando)
    setTimeout(initSimulator, 5000);
    return;
  }
  renderPickers();
  markActive();
  if (!(await simulate())) return;
  placeHouseOnPath();
  await simulate({ fit: true });
})();
