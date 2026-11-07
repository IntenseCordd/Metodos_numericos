const test = require('node:test');
const assert = require('node:assert');
const ode = require('../methods/integration');
const interp = require('../methods/interpolation');
const { polyFit } = require('../methods/regression');
const { trapezoid, simpson13 } = require('../methods/quadrature');
const { newtonRaphson, bisection } = require('../methods/roots');
const vortex = require('../methods/rankine');

const order = (method, h) => {
  const f = (_t, y) => [y[0]];
  const err = (hh) => {
    const s = ode.solve(method, f, [1], 0, 1, hh);
    return Math.abs(s.y[s.y.length - 1][0] - Math.E);
  };
  return Math.log2(err(h) / err(h / 2));
};

test('órdenes de convergencia de EDOs', () => {
  assert.ok(Math.abs(order('euler', 0.01) - 1) < 0.05);
  assert.ok(Math.abs(order('heun', 0.01) - 2) < 0.05);
  assert.ok(Math.abs(order('rk4', 0.05) - 4) < 0.1);
});

test('Lagrange y Newton generan el mismo polinomio', () => {
  const xs = [0, 1, 2.5, 4, 6];
  const ys = xs.map((x) => Math.sin(x) + x);
  const nw = interp.newton(xs, ys);
  for (let x = 0; x <= 6; x += 0.37) {
    assert.ok(Math.abs(interp.lagrange(xs, ys, x) - nw.evaluate(x)) < 1e-10);
  }
  xs.forEach((x, i) => assert.ok(Math.abs(nw.evaluate(x) - ys[i]) < 1e-12));
});

test('spline cúbico natural interpola los nodos', () => {
  const xs = [0, 1, 2, 3, 5];
  const ys = [1, 3, 2, 5, 4];
  const s = interp.naturalCubicSpline(xs, ys);
  xs.forEach((x, i) => assert.ok(Math.abs(s(x) - ys[i]) < 1e-12));
});

test('mínimos cuadrados recupera una parábola exacta', () => {
  const xs = [0, 1, 2, 3, 4];
  const fit = polyFit(xs, xs.map((x) => 2 - x + 0.5 * x * x), 2);
  [2, -1, 0.5].forEach((c, i) => assert.ok(Math.abs(fit.coeffs[i] - c) < 1e-9));
});

test('Trapecio O(h²) y Simpson O(h⁴) sobre la circulación Lamb-Oseen', () => {
  const g = (s) => 2 * Math.PI * s * vortex.lambOseenVorticity(s, 1, 1);
  const exact = vortex.lambOseenCirculation(2, 1, 1);
  const t = Math.log2(Math.abs(trapezoid(g, 0, 2, 32) - exact) / Math.abs(trapezoid(g, 0, 2, 64) - exact));
  const s = Math.log2(Math.abs(simpson13(g, 0, 2, 32) - exact) / Math.abs(simpson13(g, 0, 2, 64) - exact));
  assert.ok(Math.abs(t - 2) < 0.1, `trapecio ${t}`);
  assert.ok(Math.abs(s - 4) < 0.2, `simpson ${s}`);
});

test('Newton-Raphson encuentra el pico de Lamb-Oseen (u ≈ 1.12091)', () => {
  const f = (u) => (1 + 2 * u * u) * Math.exp(-u * u) - 1;
  const df = (u) => 2 * u * (1 - 2 * u * u) * Math.exp(-u * u);
  const nr = newtonRaphson(f, df, 1.6);
  assert.ok(nr.converged);
  assert.ok(Math.abs(nr.root - 1.1209) < 1e-4);
  const bis = bisection(f, 0.5, 3);
  assert.ok(Math.abs(bis.root - nr.root) < 1e-9);
  assert.ok(bis.iterations.length > nr.iterations.length);
});

const { simulateTornado } = require('../methods/tornadoSim');
const { EF_LEVELS } = require('../methods/efscale');

test('simulador EF: el viento pico coincide con la categoría elegida', () => {
  for (const ef of EF_LEVELS) {
    const s = simulateTornado({ level: ef.id, headingDeg: 45 });
    const peak = Math.max(...s.track.map((p) => (p.gamma / (2 * Math.PI * s.R)) * (1 + s.coupling))) * 3.6;
    assert.ok(Math.abs(peak - ef.vmaxKmh) < 1, `${ef.name}: ${peak}`);
    assert.strictEqual(s.zones.length, ef.id + 1);
    s.zones.forEach((z, i) => i > 0 && assert.ok(z.area < s.zones[i - 1].area));
  }
  const far = simulateTornado({ level: 5, house: { x: -50000, y: 50000 } });
  assert.ok(far.house.max * 3.6 < 5, 'lejos del tornado no hay viento extra');
});
