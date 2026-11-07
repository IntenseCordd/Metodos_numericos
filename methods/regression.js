/**
 * Mínimos cuadrados polinomiales (ecuaciones normales resueltas con
 * eliminación gaussiana con pivoteo parcial).
 */

function gaussSolve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i;
    [M[k], M[p]] = [M[p], M[k]];
    if (Math.abs(M[k][k]) < 1e-14) throw new Error('Sistema singular');
    for (let i = k + 1; i < n; i++) {
      const f = M[i][k] / M[k][k];
      for (let j = k; j <= n; j++) M[i][j] -= f * M[k][j];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
    x[i] = s / M[i][i];
  }
  return x;
}

/** Ajusta y ≈ a0 + a1 x + ... + am x^m. Devuelve coeficientes, evaluador y R². */
function polyFit(xs, ys, degree) {
  const m = degree + 1;
  const A = Array.from({ length: m }, () => new Array(m).fill(0));
  const b = new Array(m).fill(0);
  for (let k = 0; k < xs.length; k++) {
    const pw = [1];
    for (let j = 1; j < 2 * m; j++) pw.push(pw[j - 1] * xs[k]);
    for (let i = 0; i < m; i++) {
      b[i] += pw[i] * ys[k];
      for (let j = 0; j < m; j++) A[i][j] += pw[i + j];
    }
  }
  const coeffs = gaussSolve(A, b);
  const evaluate = (x) => coeffs.reduceRight((acc, c) => acc * x + c, 0);
  const mean = ys.reduce((s, v) => s + v, 0) / ys.length;
  let ssRes = 0;
  let ssTot = 0;
  for (let k = 0; k < xs.length; k++) {
    ssRes += (ys[k] - evaluate(xs[k])) ** 2;
    ssTot += (ys[k] - mean) ** 2;
  }
  return { coeffs, evaluate, r2: ssTot === 0 ? 1 : 1 - ssRes / ssTot };
}

module.exports = { gaussSolve, polyFit };
