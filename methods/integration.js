/**
 * Unidad V — Solución numérica de EDOs (sistemas  y' = f(t, y)).
 * Todos los métodos son explícitos de un paso y trabajan con vectores (arrays).
 */

const add = (a, b, k = 1) => a.map((ai, i) => ai + k * b[i]);

/** Euler: y_{n+1} = y_n + h f(t_n, y_n). Orden 1. */
function eulerStep(f, t, y, h) {
  return add(y, f(t, y), h);
}

/** Heun (Euler mejorado / predictor-corrector). Orden 2. */
function heunStep(f, t, y, h) {
  const k1 = f(t, y);
  const yPred = add(y, k1, h);
  const k2 = f(t + h, yPred);
  return y.map((yi, i) => yi + (h / 2) * (k1[i] + k2[i]));
}

/** Runge-Kutta clásico de 4.º orden. */
function rk4Step(f, t, y, h) {
  const k1 = f(t, y);
  const k2 = f(t + h / 2, add(y, k1, h / 2));
  const k3 = f(t + h / 2, add(y, k2, h / 2));
  const k4 = f(t + h, add(y, k3, h));
  return y.map((yi, i) => yi + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

const STEPPERS = { euler: eulerStep, heun: heunStep, rk4: rk4Step };

/**
 * Integra y' = f(t, y) desde t0 hasta tf con paso h.
 * Devuelve { t: [...], y: [[...], ...], evaluations }.
 */
function solve(method, f, y0, t0, tf, h) {
  const step = STEPPERS[method];
  if (!step) throw new Error(`Método desconocido: ${method}`);
  const n = Math.max(1, Math.round((tf - t0) / h));
  const hh = (tf - t0) / n;
  let evaluations = 0;
  const fc = (t, y) => {
    evaluations++;
    return f(t, y);
  };
  const ts = [t0];
  const ys = [y0.slice()];
  let y = y0.slice();
  for (let i = 0; i < n; i++) {
    const t = t0 + i * hh;
    y = step(fc, t, y, hh);
    ts.push(t0 + (i + 1) * hh);
    ys.push(y);
  }
  return { t: ts, y: ys, evaluations, h: hh, steps: n };
}

module.exports = { eulerStep, heunStep, rk4Step, solve, STEPPERS };
