# 🌪️ Tornado Expo — Métodos Numéricos

Aplicación web interactiva (Node.js + Express + Chart.js) que usa un modelo simplificado de tornado
(vórtice de **Rankine** y su versión suave **Lamb-Oseen**) para demostrar empíricamente cómo funcionan los
métodos numéricos del semestre. **Todos los algoritmos están programados a mano** en `methods/`; Chart.js sólo dibuja.

> No es un pronóstico real: es un modelo didáctico.

## Ejecutar

```bash
npm install
npm start          # http://localhost:3000
npm test           # verifica los órdenes de convergencia de cada método
```

## Arquitectura

```
Tornado_APP/
├── server.js               # Express: sirve /public y monta /api
├── routes/
│   └── api.js              # POST /api/interpolation, /trajectory, /circulation, /roots, /simulate · GET /api/ef-scale
├── methods/
│   ├── rankine.js          # perfiles de velocidad, vorticidad y circulación (Rankine / Lamb-Oseen)
│   ├── integration.js      # EDOs: Euler, Heun, RK4
│   ├── interpolation.js    # Lagrange, Newton (diferencias divididas), spline cúbico natural
│   ├── regression.js       # mínimos cuadrados + eliminación gaussiana
│   ├── quadrature.js       # Trapecio y Simpson 1/3 compuestos
│   ├── roots.js            # Newton-Raphson y bisección
│   ├── efscale.js          # escala Fujita Mejorada EF0–EF5 (umbrales, parámetros y daños)
│   └── tornadoSim.js       # simulador sobre el mapa: trayectoria RK4 + área dañada con Simpson
├── public/
│   ├── index.html
│   ├── app.js              # llamadas fetch + gráficas + animación
│   ├── steps.js            # explicaciones "paso a paso" de las tablas, con los números calculados
│   ├── map.js              # simulador EF en el mapa (Leaflet)
│   └── styles.css
└── test/methods.test.js
```

## Secciones

| # | Unidad | Problema del tornado | Métodos | Qué demostrar |
|---|--------|----------------------|---------|---------------|
| 🗺️ | Simulador EF | ¿Cómo sería un tornado EF0–EF5 sobre una ciudad real? | RK4 (trayectoria), Simpson vs Trapecio (área dañada), Rankine + traslación | Franja de daño asimétrica (el lado derecho es más fuerte), viento recibido por una casa, y el selector EF cambia Γ y R en todas las secciones |
| 1 | III · Interpolación | Reconstruir v(r) a partir de mediciones dispersas de radar | Lagrange, Newton, spline cúbico, mínimos cuadrados | Lagrange ≡ Newton (diferencia ~10⁻¹³); fenómeno de Runge con muchos nodos equiespaciados; Chebyshev y splines lo corrigen; con ruido conviene regresión |
| 2 | V · EDOs ⭐ | Trayectoria de una partícula de aire | Euler, Heun (Euler mejorado), RK4 | Sin entrada radial la órbita exacta es un círculo: Euler escapa en espiral, RK4 no. Órdenes observados p → 1, 2, 4 |
| 3 | IV · Integración | Circulación Γ(r) = ∫ ζ(s)·2πs ds (Stokes) | Trapecio, Simpson 1/3 | Mismas evaluaciones, Simpson mucho más preciso; órdenes 2 y 4; con Rankine (vorticidad discontinua) ambos pierden su orden |
| 4 | I · Raíces (bonus) | Radio de velocidad máxima de Lamb-Oseen | Newton-Raphson vs bisección | Convergencia cuadrática (≈5 iteraciones vs ≈40); fallos con r₀ ≈ 0.707R (f′ = 0) o r₀ lejano; raíz múltiple r = 0 → convergencia lineal |

## Guion sugerido para la exposición

> Cada tabla tiene debajo un desplegable **🪜 Paso a paso** que reconstruye sus valores con los números actuales.
> En la tabla de diferencias divididas se puede hacer clic en cualquier celda, y en la de Newton-Raphson en cualquier fila.

0. **Simulador EF**: pulsa **EF5** → el tornado recorre ~48 km de Moore con la cámara siguiéndolo. Luego pulsa
   *Casa en la trayectoria* y repite con **EF1** para comparar. Explica que el lado derecho es más dañino porque
   la rotación y el desplazamiento se suman. El mapa base necesita internet; la simulación no.
1. **Parámetros globales**: mueve Γ y R y muestra cómo cambia la velocidad máxima y la categoría EF.
2. **Interpolación**: sube el número de mediciones a 15 → Runge. Cambia a Chebyshev → desaparece. Activa Newton
   para ver que coincide con Lagrange y abre la tabla de diferencias divididas.
3. **EDOs**: presiona *Animar partículas*. Luego reduce h y observa la tabla: cada vez que h se divide entre 2,
   el error de RK4 baja ~16 veces. Activa la entrada radial para ver la espiral hacia el núcleo.
4. **Integración**: con n = 2, 4, 6 compara trapecios vs parábolas; muestra la gráfica log-log (pendientes 2 y 4).
   Cambia a Rankine y explica por qué la discontinuidad arruina el orden.
5. **Newton-Raphson**: usa *Ver iteración siguiente* para dibujar las tangentes paso a paso. Prueba r₀ = 35 m
   (con R = 50) para provocar un fallo.
