/**
 * Unidad I — Raíces de ecuaciones no lineales.
 */

/** Newton-Raphson: x_{k+1} = x_k − f(x_k)/f'(x_k). Registra cada iteración. */
function newtonRaphson(f, df, x0, { tol = 1e-12, maxIter = 50 } = {}) {
  const iterations = [];
  let x = x0;
  for (let k = 0; k < maxIter; k++) {
    const fx = f(x);
    const dfx = df(x);
    if (Math.abs(dfx) < 1e-14) {
      return { root: x, iterations, converged: false, reason: "f'(x) ≈ 0: la recta tangente es horizontal" };
    }
    const xNew = x - fx / dfx;
    const error = Math.abs(xNew - x);
    iterations.push({ k: k + 1, x, fx, dfx, xNew, error });
    if (!Number.isFinite(xNew)) {
      return { root: x, iterations, converged: false, reason: 'El método divergió' };
    }
    x = xNew;
    if (error < tol) return { root: x, iterations, converged: true };
  }
  return { root: x, iterations, converged: false, reason: 'Se alcanzó el máximo de iteraciones' };
}

/** Bisección (para comparar la velocidad de convergencia). */
function bisection(f, a, b, { tol = 1e-12, maxIter = 200 } = {}) {
  let fa = f(a);
  if (fa * f(b) > 0) return { root: NaN, iterations: [], converged: false, reason: 'f(a) y f(b) tienen el mismo signo' };
  const iterations = [];
  let m = a;
  for (let k = 0; k < maxIter; k++) {
    m = (a + b) / 2;
    const fm = f(m);
    iterations.push({ k: k + 1, a, b, x: m, fx: fm, error: (b - a) / 2 });
    if (fm === 0 || (b - a) / 2 < tol) return { root: m, iterations, converged: true };
    if (fa * fm < 0) b = m;
    else {
      a = m;
      fa = fm;
    }
  }
  return { root: m, iterations, converged: false, reason: 'Se alcanzó el máximo de iteraciones' };
}

module.exports = { newtonRaphson, bisection };
