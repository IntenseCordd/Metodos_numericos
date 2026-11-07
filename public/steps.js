/* global fmt, G, METHOD_NAMES */
'use strict';

/* =========================================================================
 * Explicaciones "paso a paso" de las tablas de cada sección.
 * Todas usan los números que el backend acaba de calcular, así que cambian
 * cada vez que se mueve un control.
 * ======================================================================= */
const stSub = (k) => String(k).replace(/\d/g, (c) => '₀₁₂₃₄₅₆₇₈₉'[c]);
const stNum = (v, d = 5) => (v < 0 ? `(${fmt(v, d)})` : fmt(v, d));
const stVec = (v, d = 4) => `(${fmt(v[0], d)}, ${fmt(v[1], d)})`;
const stDist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const stCalc = (s) => `<div class="calc">${s}</div>`;
const stList = (items) => `<ol class="steps-list">${items.map((it) => `<li>${it}</li>`).join('')}</ol>`;
const stSci = (v) => (v === 0 ? '0' : v.toExponential(2));

/* -------------------------------------------------------------------------
 * Sección 1 — Tabla de diferencias divididas
 * ----------------------------------------------------------------------- */
function explainDividedDifferences(d) {
  const T = d.dividedDifferences;
  const r = d.points.map((p) => p.r);
  const n = r.length;
  const F = (v) => stNum(v, 5);
  const Rm = (v) => fmt(v, 2);
  const items = [];

  items.push(`<b>Columna f[rᵢ] (orden 0):</b> se copian las mediciones del radar tal cual. Por ejemplo
    f[r₀] = v(${Rm(r[0])} m) = ${F(T[0][0])} m/s y f[r₁] = v(${Rm(r[1])} m) = ${F(T[0][1])} m/s.`);

  items.push(`<b>Orden 1:</b> es la pendiente entre dos mediciones vecinas:
    ${stCalc(`f[r₀,r₁] = (f[r₁] − f[r₀]) / (r₁ − r₀) = (${F(T[0][1])} − ${F(T[0][0])}) / (${Rm(r[1])} − ${Rm(r[0])}) = <b>${fmt(T[1][0], 5)}</b>`)}
    Se hace lo mismo con (r₁, r₂), (r₂, r₃), …; por eso esta columna tiene una fila menos.`);

  if (n >= 3) {
    items.push(`<b>Orden 2:</b> se restan dos valores de orden 1 y se divide entre la distancia de los extremos:
      ${stCalc(`f[r₀,r₁,r₂] = (f[r₁,r₂] − f[r₀,r₁]) / (r₂ − r₀) = (${F(T[1][1])} − ${F(T[1][0])}) / (${Rm(r[2])} − ${Rm(r[0])}) = <b>${fmt(T[2][0], 5)}</b>`)}`);
  }

  items.push(`<b>Regla general (orden k):</b> cada celda usa la celda de su izquierda y la de abajo a la izquierda:
    ${stCalc('f[rᵢ, …, rᵢ₊ₖ] = (f[rᵢ₊₁, …, rᵢ₊ₖ] − f[rᵢ, …, rᵢ₊ₖ₋₁]) / (rᵢ₊ₖ − rᵢ)')}
    La columna de orden k tiene ${n} − k valores; la última (orden ${n - 1}) tiene uno solo.
    👉 <b>Haz clic en cualquier celda de la tabla</b> para ver su cálculo con números.`);

  const c = d.newtonCoeffs;
  const shown = Math.min(4, n);
  let poly = fmt(c[0], 5);
  for (let k = 1; k < shown; k++) {
    poly += ` ${c[k] < 0 ? '−' : '+'} ${fmt(Math.abs(c[k]), 5)}${r
      .slice(0, k)
      .map((rj) => `(r − ${Rm(rj)})`)
      .join('')}`;
  }
  if (n > shown) poly += ' + …';
  items.push(`<b>Coeficientes:</b> la primera fila (en verde) es a₀, a₁, …, a${stSub(n - 1)}. Con ellos se arma el polinomio de Newton:
    ${stCalc(`P(r) = ${poly}`)}`);

  // Evaluación en r* con Horner, usando los coeficientes de la tabla
  const x = d.query.r;
  let p = c[n - 1];
  const lines = [`p = a${stSub(n - 1)} = ${fmt(p, 5)}`];
  for (let k = n - 2; k >= 0; k--) {
    const prev = p;
    p = p * (x - r[k]) + c[k];
    lines.push(`p = ${stNum(prev, 5)} · (${fmt(x, 2)} − ${Rm(r[k])}) + ${stNum(c[k], 5)} = ${fmt(p, 5)}`);
  }
  const visible = lines.length > 7 ? [...lines.slice(0, 3), '⋮', ...lines.slice(-3)] : lines;
  items.push(`<b>Evaluar en r* = ${fmt(x, 2)} m (esquema de Horner):</b> se empieza por el último coeficiente y se va
    "multiplicando y sumando" hacia atrás:
    ${stCalc(visible.join('<br>'))}
    Resultado: P(${fmt(x, 2)}) = <b>${fmt(p, 4)} m/s</b>. Lagrange da ${fmt(d.query.lagrange, 4)} m/s porque es el mismo
    polinomio; el valor real del modelo es ${fmt(d.query.exact, 4)} m/s.`);

  return stList(items);
}

function explainDDCell(d, k, i) {
  const T = d.dividedDifferences;
  const r = d.points.map((p) => p.r);
  const name = (a, b) => {
    if (a === b) return `f[r${stSub(a)}]`;
    if (b - a > 3) return `f[r${stSub(a)},…,r${stSub(b)}]`;
    return `f[${Array.from({ length: b - a + 1 }, (_, j) => `r${stSub(a + j)}`).join(',')}]`;
  };
  if (k === 0) {
    return `<b>${name(i, i)}</b> (orden 0) es la medición en r${stSub(i)} = ${fmt(r[i], 2)} m:
      <b>${fmt(T[0][i], 5)} m/s</b>. Se copia sin hacer ninguna operación.`;
  }
  return `<b>${name(i, i + k)}</b> (orden ${k}) = (${name(i + 1, i + k)} − ${name(i, i + k - 1)}) / (r${stSub(i + k)} − r${stSub(i)})
    ${stCalc(`= (${stNum(T[k - 1][i + 1], 5)} − ${stNum(T[k - 1][i], 5)}) / (${fmt(r[i + k], 2)} − ${fmt(r[i], 2)}) = <b>${fmt(T[k][i], 5)}</b>`)}
    <span class="muted small">🟧 Las dos celdas que se restan · 🟦 los radios del denominador · 🟩 el resultado.</span>`;
}

let stDDData = null;
function bindDDTable(d) {
  stDDData = d;
  const info = document.getElementById('ddCellInfo');
  info.innerHTML = '👆 Haz clic en una celda de la tabla para ver cómo se calculó.';
  const box = document.getElementById('ddTable');
  if (box.dataset.bound) return;
  box.dataset.bound = '1';
  box.addEventListener('click', (e) => {
    const td = e.target.closest('td[data-k]');
    if (!td || !stDDData) return;
    const k = Number(td.dataset.k);
    const i = Number(td.dataset.i);
    box.querySelectorAll('.src, .target, .rsrc').forEach((el) => el.classList.remove('src', 'target', 'rsrc'));
    td.classList.add('target');
    box.querySelector(`td[data-r="${i}"]`)?.classList.add('rsrc');
    if (k > 0) {
      box.querySelector(`td[data-k="${k - 1}"][data-i="${i}"]`)?.classList.add('src');
      box.querySelector(`td[data-k="${k - 1}"][data-i="${i + 1}"]`)?.classList.add('src');
      box.querySelector(`td[data-r="${i + k}"]`)?.classList.add('rsrc');
    }
    info.innerHTML = explainDDCell(stDDData, k, i);
  });
}

/* -------------------------------------------------------------------------
 * Sección 2 — Tabla de convergencia de las EDOs
 * ----------------------------------------------------------------------- */
function explainTrajConvergence(d) {
  const fs = d.firstStep;
  const R = d.results;
  const tf = d.params.tf;
  const refName = d.hasExact ? 'exacta' : 'de referencia';
  const items = [];

  items.push(`<b>Cada fila es una simulación completa.</b> En la primera fila h = ${fmt(fs.h, 4)} s, así que para llegar a
    t = ${tf} s se dan N = ${tf} / ${fmt(fs.h, 4)} = <b>${R.rk4.steps} pasos</b>. En cada paso Euler evalúa la velocidad del
    viento f una vez (${R.euler.evaluations} evaluaciones en total), Heun dos (${R.heun.evaluations}) y RK4 cuatro
    (${R.rk4.evaluations}).`);

  const e = fs.euler;
  const hn = fs.heun;
  const k = fs.rk4;
  items.push(`<b>Primer paso, con números.</b> La partícula parte de y₀ = ${stVec(fs.y0)} m; f(t, y) es la velocidad del
    viento (m/s) en esa posición y h = ${fmt(fs.h, 4)} s:
    <div class="steps-methods">
      <div><span class="tag euler">Euler</span>${stCalc(`k₁ = f(0, y₀) = ${stVec(e.k1)}<br>y₁ = y₀ + h·k₁ = <b>${stVec(e.y1)}</b>`)}</div>
      <div><span class="tag heun">Heun</span>${stCalc(`k₁ = f(0, y₀) = ${stVec(hn.k1)}<br>ỹ = y₀ + h·k₁ = ${stVec(hn.pred)} (predictor)<br>k₂ = f(h, ỹ) = ${stVec(hn.k2)}<br>y₁ = y₀ + (h/2)(k₁ + k₂) = <b>${stVec(hn.y1)}</b>`)}</div>
      <div><span class="tag rk4">RK4</span>${stCalc(`k₁ = f(0, y₀) = ${stVec(k.k1)}<br>k₂ = f(h/2, y₀ + (h/2)k₁) = ${stVec(k.k2)}<br>k₃ = f(h/2, y₀ + (h/2)k₂) = ${stVec(k.k3)}<br>k₄ = f(h, y₀ + h·k₃) = ${stVec(k.k4)}<br>y₁ = y₀ + (h/6)(k₁ + 2k₂ + 2k₃ + k₄) = <b>${stVec(k.y1)}</b>`)}</div>
    </div>
    Posición ${refName} en t = h: ${stVec(fs.reference)}. Error después de un solo paso: Euler
    ${stSci(stDist(e.y1, fs.reference))} m, Heun ${stSci(stDist(hn.y1, fs.reference))} m, RK4
    ${stSci(stDist(k.y1, fs.reference))} m.`);

  const lastOf = (m) => [R[m].x[R[m].x.length - 1], R[m].y[R[m].y.length - 1]];
  const errLines = ['euler', 'heun', 'rk4'].map((m) => {
    const p = lastOf(m);
    return `${METHOD_NAMES[m]}: E = √((${fmt(p[0], 2)} − ${stNum(d.refFinal[0], 2)})² + (${fmt(p[1], 2)} − ${stNum(d.refFinal[1], 2)})²) = <b>${fmt(R[m].finalError, 4)} m</b>`;
  });
  items.push(`<b>Columna "Error":</b> el paso anterior se repite ${R.rk4.steps} veces hasta t = ${tf} s y la posición final se
    compara con la ${refName}, ${stVec(d.refFinal, 2)} m, usando la distancia entre los dos puntos:
    ${stCalc(errLines.join('<br>'))}
    Esos son los errores de la primera fila. Las filas siguientes repiten todo con h/2, h/4, h/8, …`);

  const conv = d.convergence;
  const lastValid = (m) => {
    for (let i = conv.length - 1; i >= 1; i--) if (conv[i][`${m}Order`] != null) return i;
    return -1;
  };
  const pLines = ['euler', 'heun', 'rk4'].map((m) => {
    const i = lastValid(m);
    if (i < 0) return `${METHOD_NAMES[m]}: no hay dos filas válidas para comparar`;
    const a = conv[i - 1][m];
    const b = conv[i][m];
    return `${METHOD_NAMES[m]} (h = ${fmt(conv[i - 1].h, 5)} → ${fmt(conv[i].h, 5)}): p = log₂(${fmt(a, 4)} / ${fmt(b, 4)}) = log₂(${fmt(a / b, 3)}) = <b>${conv[i][`${m}Order`].toFixed(2)}</b>`;
  });
  items.push(`<b>Columna "p" (orden observado):</b> compara el error de una fila con el de la fila anterior,
    p = log₂(E(h) / E(h/2)). Con la última pareja válida de cada método:
    ${stCalc(pLines.join('<br>'))}`);

  items.push(`<b>Cómo leerla:</b> si p ≈ 1, al dividir h entre 2 el error se divide entre 2¹ = 2 (Euler); si p ≈ 2, entre
    2² = 4 (Heun); si p ≈ 4, entre 2⁴ = 16 (RK4). Las celdas <span class="good-text">verdes</span> coinciden con la teoría
    (±0.35). Un "—" aparece en la primera fila, que no tiene fila anterior, o cuando el error ya es menor que 10⁻⁹ m y
    domina el redondeo de la computadora.`);

  return stList(items);
}

/* -------------------------------------------------------------------------
 * Sección 3 — Tabla de convergencia Trapecio / Simpson
 * ----------------------------------------------------------------------- */
function explainCirculation(d) {
  const n = d.n;
  const h = d.rOut / n;
  const f = d.nodes.map((p) => p.g);
  const wT = f.map((_, i) => (i === 0 || i === n ? 1 : 2));
  const wS = f.map((_, i) => (i === 0 || i === n ? 1 : i % 2 === 1 ? 4 : 2));
  const sumT = f.reduce((s, v, i) => s + wT[i] * v, 0);
  const sumS = f.reduce((s, v, i) => s + wS[i] * v, 0);
  const trap = (h / 2) * sumT;
  const simp = (h / 3) * sumS;
  const items = [];

  const inTable = d.convergence.some((c) => c.n === n);
  items.push(`<b>Cada fila usa n subintervalos de ancho h = r / n.</b> Con el n elegido: h = ${fmt(d.rOut, 2)} / ${n} =
    <b>${fmt(h, 4)} m</b>. ${inTable ? 'Esa fila está resaltada en la tabla.' : 'La tabla usa n = 2, 4, 8, …, 1024 para ver la tendencia; el cálculo es idéntico para cualquier n par.'}`);

  let rows = '';
  f.forEach((v, i) => {
    rows += `<tr><td>${i}</td><td>${fmt(d.nodes[i].s, 3)}</td><td>${fmt(v, 4)}</td><td>${wT[i]}</td><td>${fmt(wT[i] * v, 4)}</td>
      <td>${wS[i]}</td><td>${fmt(wS[i] * v, 4)}</td></tr>`;
  });
  items.push(`<b>Se evalúa el integrando</b> f(s) = 2πs·ζ(s) en los n + 1 = ${n + 1} nodos sᵢ = i·h y se multiplica cada valor
    por su peso:
    <div class="table-wrap mini"><table>
      <thead><tr><th>i</th><th>sᵢ (m)</th><th>fᵢ</th><th>peso T</th><th>peso T · fᵢ</th><th>peso S</th><th>peso S · fᵢ</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="4">Suma</td><td><b>${fmt(sumT, 4)}</b></td><td></td><td><b>${fmt(sumS, 4)}</b></td></tr></tfoot>
    </table></div>
    Trapecio usa pesos 1, 2, 2, …, 2, 1; Simpson usa 1, 4, 2, 4, …, 2, 4, 1.`);

  const expand = (w) =>
    n <= 6 ? f.map((v, i) => `${w[i] === 1 ? '' : `${w[i]}·`}${fmt(v, 2)}`).join(' + ') : null;
  const genT = n === 2 ? 'f₀ + 2f₁ + f₂' : `f₀ + 2f₁ + … + 2f${stSub(n - 1)} + f${stSub(n)}`;
  const genS = n === 2 ? 'f₀ + 4f₁ + f₂' : `f₀ + 4f₁ + 2f₂ + … + 4f${stSub(n - 1)} + f${stSub(n)}`;
  items.push(`<b>Trapecio</b> (une los nodos con rectas):
    ${stCalc(`T = (h/2)·[${genT}]${expand(wT) ? ` = (${fmt(h, 4)}/2)·[${expand(wT)}]` : ''} = (${fmt(h, 4)}/2)·${fmt(sumT, 4)} = <b>${fmt(trap, 4)}</b>`)}`);
  items.push(`<b>Simpson 1/3</b> (une cada tres nodos con una parábola):
    ${stCalc(`S = (h/3)·[${genS}]${expand(wS) ? ` = (${fmt(h, 4)}/3)·[${expand(wS)}]` : ''} = (${fmt(h, 4)}/3)·${fmt(sumS, 4)} = <b>${fmt(simp, 4)}</b>`)}`);

  let exactTxt;
  if (d.model === 'rankine') {
    exactTxt =
      d.rOut <= G.R
        ? `Γ·r²/R² = ${G.gamma}·${fmt(d.rOut, 2)}²/${G.R}²`
        : `Γ = ${G.gamma} (todo el núcleo, donde está la vorticidad, queda dentro de r)`;
  } else {
    exactTxt = `Γ·(1 − e^(−r²/R²)) = ${G.gamma}·(1 − e^(−(${fmt(d.rOut, 2)}/${G.R})²))`;
  }
  items.push(`<b>Columnas "Error":</b> se compara con la solución analítica:
    ${stCalc(`Γ exacta = ${exactTxt} = <b>${fmt(d.exact, 4)}</b><br>
      E(Trapecio) = |${fmt(trap, 4)} − ${fmt(d.exact, 4)}| = ${fmt(Math.abs(trap - d.exact), 4)}<br>
      E(Simpson) = |${fmt(simp, 4)} − ${fmt(d.exact, 4)}| = ${fmt(Math.abs(simp - d.exact), 4)}`)}`);

  const conv = d.convergence;
  let i = conv.findIndex((c) => c.n === n);
  if (i < 0 || i + 1 >= conv.length) i = 2;
  const a = conv[i];
  const b = conv[i + 1];
  const pT = b.trapOrder;
  const pS = b.simpOrder;
  items.push(`<b>Columnas "p":</b> al pasar de n = ${a.n} a n = ${b.n} (h a la mitad):
    ${stCalc(`p(Trapecio) = log₂(${stSci(a.trapError)} / ${stSci(b.trapError)}) = ${pT == null ? '—' : `<b>${pT.toFixed(2)}</b>`}<br>
      p(Simpson) = log₂(${stSci(a.simpError)} / ${stSci(b.simpError)}) = ${pS == null ? '—' : `<b>${pS.toFixed(2)}</b>`}`)}
    Si p ≈ 2, al duplicar n el error del Trapecio se divide entre 4; si p ≈ 4, el de Simpson se divide entre 16, con las
    mismas evaluaciones de f. ${d.model === 'rankine' ? 'Con Rankine el integrando salta en r = R, por eso los valores de p salen irregulares.' : ''}`);

  return stList(items);
}

/* -------------------------------------------------------------------------
 * Sección 4 — Tabla de iteraciones de Newton-Raphson
 * ----------------------------------------------------------------------- */
function explainNewton(d, active, tol) {
  const its = d.newton.iterations;
  const R = d.rc;
  if (!its.length) return stList([`No hubo iteraciones: ${d.newton.reason || 'f′(u₀) = 0'}.`]);
  const it = its[active];
  const k = it.k - 1;
  const u = it.x / R;
  const u2 = u * u;
  const ex = Math.exp(-u2);
  const uNew = it.xNew / R;
  const items = [];

  items.push(`<b>Qué es cada fila:</b> una iteración. Se trabaja con u = r/R (R = ${R} m) para que la ecuación no dependa del
    tamaño del tornado; las columnas en metros sólo multiplican u por R. 👉 <b>Haz clic en una fila</b> (o usa "Ver
    iteración siguiente") para explicarla. Ahora se explica la fila <b>k = ${k}</b>.`);

  items.push(`<b>Punto actual:</b>
    ${stCalc(`r${stSub(k)} = ${fmt(it.x, 8)} m  →  u${stSub(k)} = r${stSub(k)} / R = ${fmt(it.x, 8)} / ${R} = <b>${fmt(u, 8)}</b>`)}
    ${k === 0 ? 'En la primera fila es la aproximación inicial r₀ que elegiste con el control.' : 'Es el rₖ₊₁ que calculó la fila anterior.'}`);

  items.push(`<b>Columna f(uₖ):</b> se evalúa la ecuación cuya raíz buscamos (v′(r) = 0):
    ${stCalc(`f(u) = (1 + 2u²)·e^(−u²) − 1 = (1 + 2·${fmt(u2, 6)})·e^(−${fmt(u2, 6)}) − 1 = ${fmt(1 + 2 * u2, 6)} · ${fmt(ex, 6)} − 1 = <b>${fmt(it.fx, 6)}</b>`)}`);

  items.push(`<b>Columna f′(uₖ):</b> la pendiente de la recta tangente en ese punto:
    ${stCalc(`f′(u) = 2u(1 − 2u²)·e^(−u²) = 2·${fmt(u, 6)}·(1 − 2·${fmt(u2, 6)})·${fmt(ex, 6)} = <b>${fmt(it.dfx, 6)}</b>`)}`);

  items.push(`<b>Columna rₖ₊₁:</b> fórmula de Newton-Raphson; es el punto donde la tangente corta el eje:
    ${stCalc(`u${stSub(k + 1)} = u${stSub(k)} − f(u${stSub(k)}) / f′(u${stSub(k)}) = ${fmt(u, 8)} − ${stNum(it.fx, 6)} / ${stNum(it.dfx, 6)} = ${fmt(u, 8)} − ${stNum(it.fx / it.dfx, 8)} = <b>${fmt(uNew, 8)}</b><br>
      r${stSub(k + 1)} = R · u${stSub(k + 1)} = ${R} · ${fmt(uNew, 8)} = <b>${fmt(it.xNew, 8)} m</b>`)}`);

  const stop = it.error < tol;
  items.push(`<b>Última columna (criterio de paro):</b>
    ${stCalc(`|r${stSub(k + 1)} − r${stSub(k)}| / R = |${fmt(uNew, 8)} − ${fmt(u, 8)}| = <b>${it.error.toExponential(3)}</b>  ${stop ? '<' : '≥'}  tolerancia ${tol.toExponential(0)}`)}
    ${stop ? `Es menor que la tolerancia: <b>el método se detiene</b> y r* = ${fmt(it.xNew, 6)} m.` : `Todavía no es menor que la tolerancia: r${stSub(k + 1)} pasa a ser el punto actual de la siguiente fila.`}`);

  const errs = its.map((x) => stSci(x.error)).join(' → ');
  const quadratic = d.newton.converged && d.newton.root > 1e-6 * R;
  items.push(`<b>Velocidad de convergencia:</b> los errores de la última columna, fila por fila:
    ${stCalc(errs)}
    ${quadratic ? 'Cerca de la raíz cada error es aproximadamente el cuadrado del anterior (multiplicado por una constante): el exponente casi se <b>duplica</b> en cada fila. Eso es la convergencia cuadrática de Newton.' : 'Aquí no se ve la convergencia cuadrática: el método falló o fue hacia la raíz múltiple r = 0, donde sólo converge linealmente.'}`);

  return stList(items);
}
