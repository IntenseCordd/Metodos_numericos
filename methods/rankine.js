/**
 * Modelos de vórtice para el "tornado".
 *
 *  - Rankine: núcleo en rotación de sólido rígido (r <= R) y flujo potencial fuera (r > R).
 *      v(r) = Γ r / (2π R²)   si r <= R
 *      v(r) = Γ / (2π r)      si r >  R
 *    Tiene un "pico" (derivada discontinua) en r = R.
 *
 *  - Lamb-Oseen: versión suave del Rankine (núcleo viscoso).
 *      v(r) = Γ / (2π r) · (1 − e^{−r²/rc²})
 *    Su máximo está cerca de r ≈ 1.1209 rc y se encuentra con Newton-Raphson.
 */

const TWO_PI = 2 * Math.PI;

function rankineVelocity(r, gamma, R) {
  r = Math.abs(r);
  if (r <= R) return (gamma * r) / (TWO_PI * R * R);
  return gamma / (TWO_PI * r);
}

function lambOseenVelocity(r, gamma, rc) {
  r = Math.abs(r);
  if (r < 1e-12) return 0;
  return (gamma / (TWO_PI * r)) * (1 - Math.exp(-(r * r) / (rc * rc)));
}

/** Velocidad angular ω(r) = v(r)/r del modelo Rankine (exacta para trayectorias circulares). */
function rankineAngularVelocity(r, gamma, R) {
  r = Math.abs(r);
  if (r <= R) return gamma / (TWO_PI * R * R);
  return gamma / (TWO_PI * r * r);
}

/** Vorticidad ζ(r) = (1/r) d(r v)/dr. */
function rankineVorticity(r, gamma, R) {
  return Math.abs(r) <= R ? gamma / (Math.PI * R * R) : 0;
}

function lambOseenVorticity(r, gamma, rc) {
  return (gamma / (Math.PI * rc * rc)) * Math.exp(-(r * r) / (rc * rc));
}

/** Circulación encerrada por un círculo de radio r (solución analítica). */
function rankineCirculation(r, gamma, R) {
  r = Math.abs(r);
  return r <= R ? (gamma * r * r) / (R * R) : gamma;
}

function lambOseenCirculation(r, gamma, rc) {
  return gamma * (1 - Math.exp(-(r * r) / (rc * rc)));
}

/**
 * Campo de velocidad cartesiano (u, v) en el plano horizontal.
 * Componente tangencial dada por el modelo + componente radial de entrada (inflow)
 * opcional v_r = −k·r·e^{−r/R} (aire que converge hacia el embudo).
 */
function velocityField(x, y, params) {
  const { gamma, R, model = 'rankine', inflow = 0 } = params;
  const r = Math.hypot(x, y);
  if (r < 1e-12) return [0, 0];
  const vt = model === 'lamb-oseen' ? lambOseenVelocity(r, gamma, R) : rankineVelocity(r, gamma, R);
  const vr = -inflow * r * Math.exp(-r / R);
  const c = x / r;
  const s = y / r;
  return [vr * c - vt * s, vr * s + vt * c];
}

module.exports = {
  rankineVelocity,
  lambOseenVelocity,
  rankineAngularVelocity,
  rankineVorticity,
  lambOseenVorticity,
  rankineCirculation,
  lambOseenCirculation,
  velocityField,
};
