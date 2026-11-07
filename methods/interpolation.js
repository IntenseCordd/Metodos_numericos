/**
 * Unidad III — Interpolación.
 *  - Lagrange (forma clásica con polinomios base L_i(x))
 *  - Newton (diferencias divididas)
 *  - Spline cúbico natural (algoritmo de Thomas para el sistema tridiagonal)
 */

function lagrange(xs, ys, x) {
  const n = xs.length;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    let L = 1;
    for (let j = 0; j < n; j++) {
      if (j !== i) L *= (x - xs[j]) / (xs[i] - xs[j]);
    }
    sum += ys[i] * L;
  }
  return sum;
}

/** Tabla de diferencias divididas: table[k][i] = f[x_i, ..., x_{i+k}]. */
function dividedDifferences(xs, ys) {
  const n = xs.length;
  const table = [ys.slice()];
  for (let k = 1; k < n; k++) {
    const prev = table[k - 1];
    const col = [];
    for (let i = 0; i < n - k; i++) {
      col.push((prev[i + 1] - prev[i]) / (xs[i + k] - xs[i]));
    }
    table.push(col);
  }
  return table;
}

/** Evalúa el polinomio de Newton con esquema de Horner. */
function newtonEval(xs, coeffs, x) {
  const n = coeffs.length;
  let p = coeffs[n - 1];
  for (let k = n - 2; k >= 0; k--) p = p * (x - xs[k]) + coeffs[k];
  return p;
}

function newton(xs, ys) {
  const table = dividedDifferences(xs, ys);
  const coeffs = table.map((col) => col[0]);
  return { table, coeffs, evaluate: (x) => newtonEval(xs, coeffs, x) };
}

/** Spline cúbico natural (S'' = 0 en los extremos). */
function naturalCubicSpline(xs, ys) {
  const n = xs.length - 1;
  const h = [];
  for (let i = 0; i < n; i++) h.push(xs[i + 1] - xs[i]);

  // Sistema tridiagonal para los momentos M_i = S''(x_i); M_0 = M_n = 0
  const a = new Array(n + 1).fill(0);
  const b = new Array(n + 1).fill(1);
  const c = new Array(n + 1).fill(0);
  const d = new Array(n + 1).fill(0);
  for (let i = 1; i < n; i++) {
    a[i] = h[i - 1];
    b[i] = 2 * (h[i - 1] + h[i]);
    c[i] = h[i];
    d[i] = 6 * ((ys[i + 1] - ys[i]) / h[i] - (ys[i] - ys[i - 1]) / h[i - 1]);
  }
  // Algoritmo de Thomas
  const cp = new Array(n + 1).fill(0);
  const dp = new Array(n + 1).fill(0);
  cp[0] = c[0] / b[0];
  dp[0] = d[0] / b[0];
  for (let i = 1; i <= n; i++) {
    const m = b[i] - a[i] * cp[i - 1];
    cp[i] = c[i] / m;
    dp[i] = (d[i] - a[i] * dp[i - 1]) / m;
  }
  const M = new Array(n + 1).fill(0);
  M[n] = dp[n];
  for (let i = n - 1; i >= 0; i--) M[i] = dp[i] - cp[i] * M[i + 1];

  return (x) => {
    let i = 0;
    if (x >= xs[n]) i = n - 1;
    else while (i < n - 1 && x > xs[i + 1]) i++;
    const t1 = xs[i + 1] - x;
    const t0 = x - xs[i];
    const hi = h[i];
    return (
      (M[i] * t1 ** 3) / (6 * hi) +
      (M[i + 1] * t0 ** 3) / (6 * hi) +
      (ys[i] / hi - (M[i] * hi) / 6) * t1 +
      (ys[i + 1] / hi - (M[i + 1] * hi) / 6) * t0
    );
  };
}

module.exports = { lagrange, dividedDifferences, newton, newtonEval, naturalCubicSpline };
