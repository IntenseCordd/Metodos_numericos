/**
 * Unidad IV — Integración numérica (reglas compuestas de Newton-Cotes).
 */

function trapezoid(f, a, b, n) {
  const h = (b - a) / n;
  let s = (f(a) + f(b)) / 2;
  for (let i = 1; i < n; i++) s += f(a + i * h);
  return s * h;
}

/** Simpson 1/3 compuesto: requiere n par. */
function simpson13(f, a, b, n) {
  if (n % 2 !== 0) throw new Error('Simpson 1/3 requiere un número par de subintervalos');
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += (i % 2 === 1 ? 4 : 2) * f(a + i * h);
  return (s * h) / 3;
}

module.exports = { trapezoid, simpson13 };
