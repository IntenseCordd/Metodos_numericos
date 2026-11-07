/**
 * Simulación de un tornado EF0–EF5 que se desplaza sobre el terreno.
 *
 *  - Trayectoria: sistema de EDOs  x' = Vt cos θ,  y' = Vt sin θ,  θ' = κ(t)  resuelto con RK4
 *    (serpenteo suave + giro a la izquierda en la fase de disipación).
 *  - Intensidad: Γ(t) = Γmax · sin(πt/T)^0.6  (nace, madura y se disipa).
 *  - Viento sobre el suelo = vórtice de Rankine + traslación. La traslación se acopla con la
 *    intensidad local del vórtice (a·|v|, a = Vt / v_tan,máx), de modo que lejos del tornado no
 *    hay viento extra. En el hemisferio norte el giro es antihorario: del lado derecho de la
 *    trayectoria ambas velocidades se suman y del izquierdo se restan.
 *  - Franja de daño: radio exterior donde el viento supera el umbral de cada nivel EF.
 *  - Área dañada: ∫ (ancho izq + ancho der) · Vt dt  con Simpson 1/3 (y Trapecio para comparar).
 */

const { solve } = require('./integration');
const { simpson13, trapezoid } = require('./quadrature');
const vortex = require('./rankine');
const { EF_LEVELS, classify } = require('./efscale');

const TWO_PI = 2 * Math.PI;

function simulateTornado({ level, headingDeg = 45, house = null, steps = 2000 }) {
  const ef = EF_LEVELS[level];
  if (!ef) throw new Error('Nivel EF inválido');
  const T = ef.durationMin * 60;
  const Vt = ef.vt;
  const R = ef.R;
  const vtanMax = ef.vmaxKmh / 3.6 - Vt;
  const gammaMax = TWO_PI * R * vtanMax;
  const intensity = (t) => Math.max(0, Math.sin((Math.PI * t) / T)) ** 0.6;
  const gammaAt = (t) => gammaMax * intensity(t);

  // Rumbo de brújula (0 = N, 90 = E) → ángulo matemático (0 = E, antihorario)
  const th0 = ((90 - headingDeg) * Math.PI) / 180;
  const P = T / 2.5;
  const A = 0.35 * (TWO_PI / P) * 0.5;
  const turnStart = 0.75 * T;
  const turnRate = Math.PI / 4 / (T - turnStart);
  const dTheta = (t) => A * Math.sin((TWO_PI * t) / P) + (t > turnStart ? turnRate : 0);
  const f = (t, s) => [Vt * Math.cos(s[2]), Vt * Math.sin(s[2]), dTheta(t)];
  const sol = solve('rk4', f, [0, 0, th0], 0, T, T / steps);
  const track = sol.t.map((t, i) => ({ t, x: sol.y[i][0], y: sol.y[i][1], th: sol.y[i][2] }));

  // Semianchos de la franja para el umbral vth (m/s).
  // Viento sobre el suelo ≈ v_tan(r) · (1 ± a), a = Vt / v_tan,máx (la traslación sólo actúa donde hay vórtice)
  const a = Vt / vtanMax;
  const widths = (t, vth) => {
    const g = gammaAt(t);
    const vCore = g / (TWO_PI * R);
    const right = vCore * (1 + a) >= vth ? (g * (1 + a)) / (TWO_PI * vth) : 0;
    const left = vCore * (1 - a) >= vth ? (g * (1 - a)) / (TWO_PI * vth) : 0;
    return [left, right];
  };

  const stride = Math.max(1, Math.round(steps / 400));
  const sampled = track.filter((_, i) => i % stride === 0 || i === track.length - 1);

  const zones = EF_LEVELS.filter((l) => l.id <= level).map((l) => {
    const vth = l.minKmh / 3.6;
    const left = [];
    const right = [];
    let maxWidth = 0;
    for (const p of sampled) {
      const [wl, wr] = widths(p.t, vth);
      maxWidth = Math.max(maxWidth, wl + wr);
      left.push([p.x - wl * Math.sin(p.th), p.y + wl * Math.cos(p.th)]);
      right.push([p.x + wr * Math.sin(p.th), p.y - wr * Math.cos(p.th)]);
    }
    const band = (t) => {
      const [wl, wr] = widths(t, vth);
      return (wl + wr) * Vt;
    };
    return {
      level: l.id,
      name: l.name,
      color: l.color,
      left,
      right,
      maxWidth,
      area: simpson13(band, 0, T, 400),
      areaTrap: trapezoid(band, 0, T, 400),
    };
  });

  let pathLength = 0;
  for (let i = 1; i < track.length; i++) {
    pathLength += Math.hypot(track[i].x - track[i - 1].x, track[i].y - track[i - 1].y);
  }

  // Serie de tiempo del viento en la casa
  let houseResult = null;
  if (house && Number.isFinite(house.x) && Number.isFinite(house.y)) {
    const speeds = [];
    let max = 0;
    let iMax = 0;
    let minDist = Infinity;
    track.forEach((p, i) => {
      const dx = house.x - p.x;
      const dy = house.y - p.y;
      minDist = Math.min(minDist, Math.hypot(dx, dy));
      const [u, v] = vortex.velocityField(dx, dy, { gamma: gammaAt(p.t), R, model: 'rankine' });
      const k = a * Math.hypot(u, v);
      const s = Math.hypot(u + k * Math.cos(p.th), v + k * Math.sin(p.th));
      speeds.push(s);
      if (s > max) {
        max = s;
        iMax = i;
      }
    });
    const hStride = Math.max(1, Math.round(steps / 800));
    const idx = track.map((_, i) => i).filter((i) => i % hStride === 0 || i === iMax || i === track.length - 1);
    houseResult = {
      t: idx.map((i) => track[i].t),
      speed: idx.map((i) => speeds[i]),
      max,
      tMax: track[iMax].t,
      level: classify(max),
      minDist,
    };
  }

  return {
    ef,
    T,
    Vt,
    R,
    vtanMax,
    coupling: a,
    gammaMax,
    pathLength,
    track: sampled.map((p) => ({ t: p.t, x: p.x, y: p.y, gamma: gammaAt(p.t) })),
    zones,
    house: houseResult,
  };
}

module.exports = { simulateTornado };
