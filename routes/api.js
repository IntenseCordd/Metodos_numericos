const express = require('express');
const vortex = require('../methods/rankine');
const ode = require('../methods/integration');
const interp = require('../methods/interpolation');
const { polyFit } = require('../methods/regression');
const { trapezoid, simpson13 } = require('../methods/quadrature');
const { newtonRaphson, bisection } = require('../methods/roots');
const { EF_LEVELS } = require('../methods/efscale');
const { simulateTornado } = require('../methods/tornadoSim');

const router = express.Router();

/** Lee un número del body con valor por defecto y límites. */
function num(value, def, min, max) {
  const v = Number(value);
  if (!Number.isFinite(v)) return def;
  return Math.min(max, Math.max(min, v));
}

/** Generador pseudoaleatorio reproducible (mulberry32). */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand) {
  const u = Math.max(rand(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

const linspace = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));

const errorStats = (approx, exact) => {
  let max = 0;
  let sq = 0;
  approx.forEach((v, i) => {
    const e = Math.abs(v - exact[i]);
    if (e > max) max = e;
    sq += e * e;
  });
  return { max, rms: Math.sqrt(sq / approx.length) };
};

/* ---------------------------------------------------------------------------
 * Sección 1 — Interpolación del perfil de viento
 * ------------------------------------------------------------------------- */
router.post('/interpolation', (req, res) => {
  const b = req.body || {};
  const gamma = num(b.gamma, 22000, 1000, 150000);
  const R = num(b.R, 50, 5, 500);
  const rMax = num(b.rMax, 5 * R, 1.5 * R, 20 * R);
  const nPoints = Math.round(num(b.nPoints, 7, 3, 25));
  const noise = num(b.noise, 0, 0, 20);
  const degree = Math.round(num(b.degree, 4, 1, Math.min(10, nPoints - 1)));
  const spacing = ['uniform', 'chebyshev', 'random'].includes(b.spacing) ? b.spacing : 'uniform';
  const model = b.model === 'lamb-oseen' ? 'lamb-oseen' : 'rankine';
  const rand = rng(Math.round(num(b.seed, 42, 0, 1e9)));
  const vel = (r) =>
    model === 'lamb-oseen' ? vortex.lambOseenVelocity(r, gamma, R) : vortex.rankineVelocity(r, gamma, R);

  let xs;
  if (spacing === 'chebyshev') {
    xs = Array.from({ length: nPoints }, (_, i) => {
      const t = Math.cos(((2 * i + 1) * Math.PI) / (2 * nPoints));
      return rMax / 2 - (rMax / 2) * t;
    });
  } else if (spacing === 'random') {
    xs = Array.from({ length: nPoints }, () => rand() * rMax);
    xs.sort((p, q) => p - q);
    for (let i = 1; i < xs.length; i++) if (xs[i] - xs[i - 1] < rMax * 1e-3) xs[i] = xs[i - 1] + rMax * 1e-3;
  } else {
    xs = linspace(0, rMax, nPoints);
  }
  const ys = xs.map((r) => vel(r) + noise * gaussian(rand));

  const newtonPoly = interp.newton(xs, ys);
  const spline = interp.naturalCubicSpline(xs, ys);
  const fit = polyFit(xs, ys, degree);

  const grid = linspace(0, rMax, 301);
  const exact = grid.map(vel);
  const lag = grid.map((r) => interp.lagrange(xs, ys, r));
  const nwt = grid.map(newtonPoly.evaluate);
  const spl = grid.map(spline);
  const reg = grid.map(fit.evaluate);

  // Estimación de la velocidad en un radio de consulta
  const rq = num(b.rQuery, R * 1.5, 0, rMax);

  res.json({
    model,
    points: xs.map((r, i) => ({ r, v: ys[i] })),
    grid,
    exact,
    lagrange: lag,
    newton: nwt,
    spline: spl,
    regression: reg,
    dividedDifferences: newtonPoly.table,
    newtonCoeffs: newtonPoly.coeffs,
    regressionCoeffs: fit.coeffs,
    r2: fit.r2,
    degree,
    lagrangeNewtonMaxDiff: Math.max(...lag.map((v, i) => Math.abs(v - nwt[i]))),
    errors: {
      lagrange: errorStats(lag, exact),
      newton: errorStats(nwt, exact),
      spline: errorStats(spl, exact),
      regression: errorStats(reg, exact),
    },
    query: {
      r: rq,
      exact: vel(rq),
      lagrange: interp.lagrange(xs, ys, rq),
      newton: newtonPoly.evaluate(rq),
      spline: spline(rq),
      regression: fit.evaluate(rq),
    },
  });
});

/* ---------------------------------------------------------------------------
 * Sección 2 — Trayectoria de una partícula de aire (EDOs)
 * ------------------------------------------------------------------------- */
function downsample(arr, maxLen) {
  if (arr.length <= maxLen) return arr;
  const step = (arr.length - 1) / (maxLen - 1);
  return Array.from({ length: maxLen }, (_, i) => arr[Math.round(i * step)]);
}

router.post('/trajectory', (req, res) => {
  const b = req.body || {};
  const gamma = num(b.gamma, 22000, 1000, 150000);
  const R = num(b.R, 50, 5, 500);
  const model = b.model === 'lamb-oseen' ? 'lamb-oseen' : 'rankine';
  const inflow = num(b.inflow, 0, 0, 0.5);
  const x0 = num(b.x0, 100, -2000, 2000);
  const y0 = num(b.y0, 0, -2000, 2000);
  const tf = num(b.tf, 60, 1, 600);
  const h = num(b.h, 0.5, 0.001, tf / 2);
  if (Math.hypot(x0, y0) < 1e-6) throw new Error('La partícula no puede iniciar en el eje del tornado');
  if (tf / h > 200000) throw new Error('Demasiados pasos: aumenta h o reduce el tiempo final');

  const params = { gamma, R, model, inflow };
  const f = (_t, y) => vortex.velocityField(y[0], y[1], params);

  // Solución de referencia: exacta si no hay entrada radial con Rankine (órbita circular);
  // en otro caso, RK4 con un paso muy fino.
  const hasExact = inflow === 0;
  const r0 = Math.hypot(x0, y0);
  const th0 = Math.atan2(y0, x0);
  const omega =
    model === 'lamb-oseen' ? vortex.lambOseenVelocity(r0, gamma, R) / r0 : vortex.rankineAngularVelocity(r0, gamma, R);
  let refFinal;
  let refAt;
  if (hasExact) {
    refAt = (t) => [r0 * Math.cos(th0 + omega * t), r0 * Math.sin(th0 + omega * t)];
    refFinal = refAt(tf);
  } else {
    const hRef = Math.min(h / 64, 0.01);
    const ref = ode.solve('rk4', f, [x0, y0], 0, tf, hRef);
    refFinal = ref.y[ref.y.length - 1];
    const stride = ref.y.length - 1;
    refAt = (t) => ref.y[Math.min(stride, Math.round((t / tf) * stride))];
  }

  const methods = ['euler', 'heun', 'rk4'];
  const results = {};
  for (const m of methods) {
    const sol = ode.solve(m, f, [x0, y0], 0, tf, h);
    const errs = sol.t.map((t, i) => {
      const ex = refAt(t);
      return Math.hypot(sol.y[i][0] - ex[0], sol.y[i][1] - ex[1]);
    });
    const last = sol.y[sol.y.length - 1];
    const idx = downsample(
      sol.t.map((_, i) => i),
      1200,
    );
    results[m] = {
      t: idx.map((i) => sol.t[i]),
      x: idx.map((i) => sol.y[i][0]),
      y: idx.map((i) => sol.y[i][1]),
      error: idx.map((i) => errs[i]),
      finalError: Math.hypot(last[0] - refFinal[0], last[1] - refFinal[1]),
      finalRadius: Math.hypot(last[0], last[1]),
      evaluations: sol.evaluations,
      steps: sol.steps,
    };
  }

  const refT = linspace(0, tf, 600);
  const refPts = refT.map(refAt);

  // Primer paso de cada método con sus etapas intermedias (para la explicación paso a paso)
  const hUsed = tf / Math.max(1, Math.round(tf / h));
  const firstStep = { h: hUsed, y0: [x0, y0], reference: refAt(hUsed) };
  for (const m of methods) firstStep[m] = ode.traceStep(m, f, 0, [x0, y0], hUsed);

  // Estudio de convergencia: error final vs h, h/2, h/4, ...
  const convergence = [];
  for (let k = 0; k < 10; k++) {
    const hk = h / 2 ** k;
    if (tf / hk > 150000) break;
    const row = { h: hk };
    for (const m of methods) {
      const sol = ode.solve(m, f, [x0, y0], 0, tf, hk);
      const last = sol.y[sol.y.length - 1];
      row[m] = Math.hypot(last[0] - refFinal[0], last[1] - refFinal[1]);
    }
    convergence.push(row);
  }
  convergence.forEach((row, i) => {
    if (i === 0) return;
    for (const m of methods) {
      const prev = convergence[i - 1][m];
      // Por debajo de ~1e-9 m domina el error de redondeo y el orden deja de ser significativo
      row[`${m}Order`] = row[m] > 1e-9 && prev > 1e-9 ? Math.log2(prev / row[m]) : null;
    }
  });

  res.json({
    params: { gamma, R, model, inflow, x0, y0, tf, h },
    hasExact,
    omega,
    period: hasExact ? (2 * Math.PI) / omega : null,
    reference: { t: refT, x: refPts.map((p) => p[0]), y: refPts.map((p) => p[1]) },
    refFinal,
    firstStep,
    results,
    convergence,
  });
});

/* ---------------------------------------------------------------------------
 * Sección 3 — Circulación Γ(r) = ∫₀^r ζ(s)·2πs ds  (Teorema de Stokes)
 * ------------------------------------------------------------------------- */
router.post('/circulation', (req, res) => {
  const b = req.body || {};
  const gamma = num(b.gamma, 22000, 1000, 150000);
  const R = num(b.R, 50, 5, 500);
  const model = b.model === 'rankine' ? 'rankine' : 'lamb-oseen';
  const rOut = num(b.rOut, 2 * R, R * 0.1, 10 * R);
  let n = Math.round(num(b.n, 6, 2, 2000));
  if (n % 2 === 1) n += 1;

  const zeta = (s) =>
    model === 'rankine' ? vortex.rankineVorticity(s, gamma, R) : vortex.lambOseenVorticity(s, gamma, R);
  const g = (s) => 2 * Math.PI * s * zeta(s);
  const exact =
    model === 'rankine' ? vortex.rankineCirculation(rOut, gamma, R) : vortex.lambOseenCirculation(rOut, gamma, R);

  const trap = trapezoid(g, 0, rOut, n);
  const simp = simpson13(g, 0, rOut, n);
  const nodes = linspace(0, rOut, n + 1);

  const convergence = [];
  for (let k = 2; k <= 1024; k *= 2) {
    const t = trapezoid(g, 0, rOut, k);
    const s = simpson13(g, 0, rOut, k);
    convergence.push({ n: k, h: rOut / k, trapezoid: t, simpson: s, trapError: Math.abs(t - exact), simpError: Math.abs(s - exact) });
  }
  convergence.forEach((row, i) => {
    if (i === 0) return;
    const p = convergence[i - 1];
    row.trapOrder = row.trapError > 1e-9 && p.trapError > 1e-9 ? Math.log2(p.trapError / row.trapError) : null;
    row.simpOrder = row.simpError > 1e-9 && p.simpError > 1e-9 ? Math.log2(p.simpError / row.simpError) : null;
  });

  const curveR = linspace(0, rOut, 400);
  res.json({
    model,
    n,
    rOut,
    exact,
    trapezoid: { value: trap, error: Math.abs(trap - exact), relError: Math.abs(trap - exact) / Math.abs(exact) },
    simpson: { value: simp, error: Math.abs(simp - exact), relError: Math.abs(simp - exact) / Math.abs(exact) },
    nodes: nodes.map((s) => ({ s, g: g(s) })),
    curve: curveR.map((s) => ({ s, g: g(s) })),
    convergence,
  });
});

/* ---------------------------------------------------------------------------
 * Sección 4 — Radio de velocidad máxima (Newton-Raphson)
 *  v(r) = Γ/(2πr)(1 − e^{−u²}),  u = r/rc
 *  v'(r) = 0  ⇔  f(u) = (1 + 2u²) e^{−u²} − 1 = 0
 *  f'(u) = 2u (1 − 2u²) e^{−u²}
 * ------------------------------------------------------------------------- */
const fRoot = (u) => (1 + 2 * u * u) * Math.exp(-u * u) - 1;
const dfRoot = (u) => 2 * u * (1 - 2 * u * u) * Math.exp(-u * u);

router.post('/roots', (req, res) => {
  const b = req.body || {};
  const gamma = num(b.gamma, 22000, 1000, 150000);
  const rc = num(b.R, 50, 5, 500);
  const r0 = num(b.r0, 1.6 * rc, 1e-3, 20 * rc);
  const tol = num(b.tol, 1e-10, 1e-15, 1e-2);
  const u0 = r0 / rc;

  const nr = newtonRaphson(fRoot, dfRoot, u0, { tol, maxIter: 50 });
  const bis = bisection(fRoot, 0.5, 3, { tol });

  const toMeters = (it) => ({ ...it, x: it.x * rc, xNew: it.xNew !== undefined ? it.xNew * rc : undefined });
  const rStar = nr.root * rc;
  const vMax = vortex.lambOseenVelocity(rStar, gamma, rc);

  const uGrid = linspace(0.01, 4, 400);
  res.json({
    rc,
    u0,
    newton: {
      converged: nr.converged,
      reason: nr.reason || null,
      root: rStar,
      rootU: nr.root,
      iterations: nr.iterations.map(toMeters),
    },
    bisection: {
      converged: bis.converged,
      root: bis.root * rc,
      iterations: bis.iterations.length,
    },
    vMax,
    rankine: { rPeak: rc, vPeak: vortex.rankineVelocity(rc, gamma, rc) },
    fCurve: uGrid.map((u) => ({ r: u * rc, f: fRoot(u) })),
    velocityCurve: uGrid.map((u) => ({
      r: u * rc,
      lamb: vortex.lambOseenVelocity(u * rc, gamma, rc),
      rankine: vortex.rankineVelocity(u * rc, gamma, rc),
    })),
  });
});

/* ---------------------------------------------------------------------------
 * Simulador EF0–EF5 sobre el mapa
 * ------------------------------------------------------------------------- */
router.get('/ef-scale', (_req, res) => {
  res.json(EF_LEVELS);
});

router.post('/simulate', (req, res) => {
  const b = req.body || {};
  const level = Math.round(num(b.level, 3, 0, 5));
  const headingDeg = num(b.heading, 45, 0, 360);
  const house =
    b.house && Number.isFinite(Number(b.house.x)) && Number.isFinite(Number(b.house.y))
      ? { x: num(b.house.x, 0, -200000, 200000), y: num(b.house.y, 0, -200000, 200000) }
      : null;
  res.json(simulateTornado({ level, headingDeg, house }));
});

module.exports = router;
