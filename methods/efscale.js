/**
 * Escala Fujita Mejorada (EF) — ráfagas de 3 s.
 * Los parámetros del modelo (radio del núcleo, traslación y duración) son valores
 * representativos para la simulación didáctica, no datos de un tornado específico.
 */

const EF_LEVELS = [
  {
    id: 0,
    name: 'EF0',
    title: 'Ligero',
    minKmh: 105,
    maxKmh: 137,
    vmaxKmh: 120,
    R: 20,
    vt: 10,
    durationMin: 3,
    color: '#22c55e',
    frequency: 'Muy común',
    damage: 'Arranca tejas y canaletas, rompe ramas grandes y derriba árboles de raíces poco profundas.',
    house: 'Daños superficiales: tejas, canaletas y bardas ligeras.',
    example: null,
  },
  {
    id: 1,
    name: 'EF1',
    title: 'Moderado',
    minKmh: 138,
    maxKmh: 178,
    vmaxKmh: 160,
    R: 35,
    vt: 12,
    durationMin: 6,
    color: '#eab308',
    frequency: 'Común',
    damage: 'Desprende partes del techo, vuelca casas móviles, rompe ventanas y puertas exteriores.',
    house: 'Pierde parte del techo; ventanas rotas.',
    example: null,
  },
  {
    id: 2,
    name: 'EF2',
    title: 'Considerable',
    minKmh: 179,
    maxKmh: 218,
    vmaxKmh: 200,
    R: 55,
    vt: 13,
    durationMin: 10,
    color: '#f97316',
    frequency: 'Ocasional',
    damage: 'Arranca techos completos de casas bien construidas, destruye casas móviles y desarraiga árboles grandes. Los objetos ligeros se vuelven proyectiles.',
    house: 'El techo completo sale volando.',
    example: null,
  },
  {
    id: 3,
    name: 'EF3',
    title: 'Severo',
    minKmh: 219,
    maxKmh: 266,
    vmaxKmh: 245,
    R: 80,
    vt: 15,
    durationMin: 18,
    color: '#ef4444',
    frequency: 'Poco común',
    damage: 'Destruye pisos enteros de casas bien construidas, daña edificios grandes como centros comerciales, vuelca trenes y levanta autos pesados.',
    house: 'Colapsan muros exteriores y pisos completos.',
    example: null,
  },
  {
    id: 4,
    name: 'EF4',
    title: 'Devastador',
    minKmh: 267,
    maxKmh: 322,
    vmaxKmh: 295,
    R: 110,
    vt: 17,
    durationMin: 30,
    color: '#db2777',
    frequency: 'Raro',
    damage: 'Arrasa casas bien construidas dejando sólo escombros; los autos son lanzados como proyectiles.',
    house: 'Casa arrasada; quedan escombros sobre los cimientos.',
    example: 'Rolling Fork, Mississippi (24 de marzo de 2023)',
  },
  {
    id: 5,
    name: 'EF5',
    title: 'Increíble',
    minKmh: 322,
    maxKmh: null,
    vmaxKmh: 330,
    R: 150,
    vt: 18,
    durationMin: 45,
    color: '#9333ea',
    frequency: 'Muy raro',
    damage: 'Arranca casas de sus cimientos y las barre por completo; estructuras de concreto reforzado gravemente dañadas; descorteza árboles.',
    house: 'Arrancada de sus cimientos: la losa queda limpia.',
    example: 'Moore, Oklahoma (20 de mayo de 2013) y Joplin, Missouri (22 de mayo de 2011)',
  },
];

/** Devuelve el nivel EF (−1 si está por debajo de EF0) para una velocidad en m/s. */
function classify(vMs) {
  const kmh = vMs * 3.6;
  let level = -1;
  for (const l of EF_LEVELS) if (kmh >= l.minKmh) level = l.id;
  return level;
}

module.exports = { EF_LEVELS, classify };
