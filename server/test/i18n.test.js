/**
 * Paridad entre los diccionarios de idioma.
 *
 * El español está protegido por content.test.js, que lo compara contra el
 * index.html que se despliega. El inglés no tiene un espejo contra el que
 * compararse: la encuesta es solo en español. Esta prueba es su reemplazo.
 *
 * Lo que caza, y que ninguna otra cosa cazaría: traducir 11 de las 12
 * preguntas, agregar un párrafo nuevo al reporte solo en español, cambiarle la
 * cantidad de argumentos a una frase en un idioma y no en el otro. Cualquiera
 * de esas tres le entrega al cliente un reporte con un hueco.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DIMENSIONS, QUESTIONS } from '../src/content.js';
import { DICCIONARIOS, IDIOMAS, resolverIdioma } from '../src/i18n/index.js';

const { es, en } = DICCIONARIOS;

/**
 * Aplana un diccionario a un mapa `ruta -> tipo`.
 *
 * De las funciones registra la aridad, no el cuerpo: si una frase pasa de
 * recibir 2 valores a recibir 3 en un idioma, el otro se queda corto y el
 * reporte imprime "undefined" en producción. La aridad es lo que lo detecta.
 */
function forma(valor, ruta = '', acc = new Map()) {
  if (typeof valor === 'function') {
    acc.set(ruta, `function/${valor.length}`);
  } else if (Array.isArray(valor)) {
    acc.set(ruta, `array/${valor.length}`);
    valor.forEach((v, i) => forma(v, `${ruta}[${i}]`, acc));
  } else if (valor && typeof valor === 'object') {
    acc.set(ruta, 'object');
    for (const k of Object.keys(valor).sort()) forma(valor[k], ruta ? `${ruta}.${k}` : k, acc);
  } else {
    acc.set(ruta, typeof valor);
  }
  return acc;
}

test('los dos diccionarios tienen exactamente las mismas claves', () => {
  const a = [...forma(es).keys()].sort();
  const b = [...forma(en).keys()].sort();

  assert.deepEqual(
    b.filter((k) => !a.includes(k)),
    [],
    'hay claves en inglés que no existen en español'
  );
  assert.deepEqual(
    a.filter((k) => !b.includes(k)),
    [],
    'hay claves en español que no existen en inglés — falta traducir'
  );
});

test('cada clave tiene el mismo tipo y la misma aridad en ambos idiomas', () => {
  const a = forma(es);
  const b = forma(en);
  const distintas = [...a.entries()]
    .filter(([k, tipo]) => b.get(k) !== tipo)
    .map(([k, tipo]) => `${k}: es=${tipo} en=${b.get(k)}`);

  assert.deepEqual(distintas, [], 'estas claves cambian de forma entre idiomas');
});

test('el contenido del instrumento está completo en todos los idiomas', () => {
  for (const codigo of IDIOMAS) {
    const d = DICCIONARIOS[codigo];

    // Las claves salen de content.js: es la estructura que alimenta el scoring.
    for (const { key } of DIMENSIONS) {
      assert.ok(d.dimensiones[key], `${codigo}: falta el nombre de la dimensión "${key}"`);
      assert.ok(d.intros[key], `${codigo}: falta la intro de "${key}"`);
      assert.ok(d.cuellos[key], `${codigo}: falta el cuello de botella de "${key}"`);
    }
    for (const { id } of QUESTIONS) {
      assert.ok(d.preguntas[id], `${codigo}: falta la pregunta ${id}`);
    }
    for (const nivel of [1, 2, 3, 4, 5]) {
      assert.ok(d.niveles[nivel]?.name, `${codigo}: falta el nivel ${nivel}`);
    }
    for (const energia of ['survive', 'transit', 'impulse']) {
      assert.ok(d.energias[energia]?.name, `${codigo}: falta la energía "${energia}"`);
    }
    assert.equal(d.escala.length, 5, `${codigo}: la escala no tiene 5 etiquetas`);
    assert.equal(d.contexto.etiquetasEnergia.length, 3, `${codigo}: la grilla no tiene 3 columnas`);
  }
});

test('los cuellos de botella siguen la frase que los introduce', () => {
  // Se imprimen como "Hoy, {cuello}" / "Today, {cuello}": si alguno empieza en
  // mayúscula, la frase queda partida a la mitad.
  for (const codigo of IDIOMAS) {
    for (const [key, texto] of Object.entries(DICCIONARIOS[codigo].cuellos)) {
      const primera = texto[0];
      assert.equal(
        primera,
        primera.toLowerCase(),
        `${codigo}: el cuello de botella "${key}" arranca en mayúscula y corta la frase`
      );
    }
  }
});

test('ningún texto quedó sin traducir', () => {
  /* Un valor idéntico en los dos idiomas casi siempre es copiar y pegar sin
     traducir. Si alguna vez hay uno que legítimamente coincide —un nombre
     propio, una sigla— va acá con su razón. */
  const PERMITIDOS = new Set();

  const a = forma(es);
  const iguales = [];
  for (const [ruta, tipo] of a) {
    if (tipo !== 'string' || PERMITIDOS.has(ruta)) continue;
    const valorEs = ruta.split(/[.[]/).reduce((o, k) => o[k.replace(']', '')], es);
    const valorEn = ruta.split(/[.[]/).reduce((o, k) => o[k.replace(']', '')], en);
    if (valorEs && valorEs === valorEn) iguales.push(ruta);
  }
  assert.deepEqual(iguales, [], 'estos textos son idénticos en ambos idiomas');
});

test('los dos idiomas nombran el mismo escalón para el mismo puntaje', () => {
  /* Los nombres difieren, el escalón no. La regla de redondeo vive una sola vez
     —nivelDeDimension() en content.js— justamente para esto: si cada idioma
     tuviera la suya, un 2,5 podría salir "Integrador" en un documento y
     "Experimenter" en el otro. */
  const escalonDe = (d, p) => Object.keys(d.niveles).find((k) => d.niveles[k].name === d.nombreDeNivel(p));

  for (const p of [0, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 9]) {
    assert.equal(escalonDe(en, p), escalonDe(es, p), `el puntaje ${p} cae en otro escalón según el idioma`);
  }
});

test('el formato de número y de lista sigue la convención de su idioma', () => {
  assert.equal(es.fmt.num(3.5), '3,5');
  assert.equal(en.fmt.num(3.5), '3.5');
  // Un entero no arrastra decimales en ninguno de los dos.
  assert.equal(es.fmt.num(3), '3');
  assert.equal(en.fmt.num(3), '3');

  assert.equal(es.fmt.listar(['A']), 'A');
  assert.equal(en.fmt.listar(['A']), 'A');
  assert.equal(es.fmt.listar(['A', 'B']), 'A y B');
  assert.equal(en.fmt.listar(['A', 'B']), 'A and B');
  assert.equal(es.fmt.listar(['A', 'B', 'C']), 'A, B y C');
  assert.equal(en.fmt.listar(['A', 'B', 'C']), 'A, B and C');
});

test('la fecha se escribe como se escribe en cada idioma', () => {
  const cuando = '2026-09-10T14:00:00Z';
  assert.equal(es.fmt.fecha(cuando), '10 de septiembre de 2026');
  assert.equal(en.fmt.fecha(cuando), '10 September 2026');

  // Una fecha inválida no puede escribir "Invalid Date" en el reporte.
  assert.equal(es.fmt.fecha('no es fecha'), '');
  assert.equal(en.fmt.fecha(null), '');
});

test('resolverIdioma tolera lo que llegue por el query string', () => {
  assert.equal(resolverIdioma('en'), 'en');
  assert.equal(resolverIdioma('EN'), 'en');
  assert.equal(resolverIdioma('en-AU'), 'en');
  assert.equal(resolverIdioma('en_au'), 'en');
  assert.equal(resolverIdioma(' en '), 'en');
  assert.equal(resolverIdioma('es'), 'es');

  // Un idioma que no existe cae al español, no revienta ni devuelve 404: el
  // enlace tiene que seguir abriendo el reporte.
  assert.equal(resolverIdioma('fr'), 'es');
  assert.equal(resolverIdioma(''), 'es');
  assert.equal(resolverIdioma(undefined), 'es');
  assert.equal(resolverIdioma(null), 'es');
  assert.equal(resolverIdioma(42), 'es');

  // Express entrega un arreglo cuando el parámetro viene repetido.
  assert.equal(resolverIdioma(['en', 'es']), 'en');

  // No se puede llegar al prototipo con un nombre heredado.
  assert.equal(resolverIdioma('constructor'), 'es');
  assert.equal(resolverIdioma('toString'), 'es');
});
