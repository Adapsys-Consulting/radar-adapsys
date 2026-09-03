/**
 * Paridad de contenido entre el instrumento y el reporte.
 *
 * El reporte le cita al cliente las preguntas que contestó y los textos que ya
 * vio en pantalla. Si alguien edita el copy en index.html y no acá, el reporte
 * mostraría una redacción distinta de la que la persona efectivamente
 * respondió — y nadie se enteraría hasta que un cliente lo notara.
 *
 * Por eso esto no compara contra una copia: evalúa los objetos reales del
 * index.html que se despliega. Mismo enfoque que scoring.test.js.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  BOTTLENECK_COPY,
  DIMENSIONS,
  ENERGY_COPY,
  LEVEL_COPY,
  QUESTIONS,
  SCALE_LABELS,
  DIMENSION_INTRO,
  nombreDeNivel,
} from '../src/content.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname, '..', '..', 'index.html'), 'utf8');

function extraer(patron, nombre) {
  const m = html.match(patron);
  if (!m) {
    throw new Error(
      `No se pudo extraer ${nombre} de index.html. ` +
        'Si cambió su formato, actualiza el patrón en esta prueba.'
    );
  }
  return m[0];
}

const front = new Function(`
  ${extraer(/const DIMENSIONS = \[[\s\S]*?\n\];/, 'DIMENSIONS')}
  ${extraer(/const QUESTIONS = \[[\s\S]*?\n\];/, 'QUESTIONS')}
  ${extraer(/const LEVEL_COPY = \{[\s\S]*?\n\};/, 'LEVEL_COPY')}
  ${extraer(/const ENERGY_COPY = \{[\s\S]*?\n\};/, 'ENERGY_COPY')}
  ${extraer(/const BOTTLENECK_COPY = \{[\s\S]*?\n\};/, 'BOTTLENECK_COPY')}
  ${extraer(/const SCALE_LABELS = \[.*?\];/, 'SCALE_LABELS')}
  return { DIMENSIONS, QUESTIONS, LEVEL_COPY, ENERGY_COPY, BOTTLENECK_COPY, SCALE_LABELS };
`)();

test('las 6 dimensiones coinciden, en el mismo orden', () => {
  // El orden importa más allá de lo estético: define el desempate del cuello
  // de botella en computeResult().
  assert.deepEqual(DIMENSIONS, front.DIMENSIONS);
});

test('las 12 preguntas coinciden en id, dimensión y redacción exacta', () => {
  assert.equal(QUESTIONS.length, 12);
  assert.deepEqual(QUESTIONS, front.QUESTIONS);
});

test('los textos de los 5 niveles coinciden', () => {
  assert.deepEqual(LEVEL_COPY, front.LEVEL_COPY);
});

test('los 3 rangos de energía coinciden', () => {
  // `cls` es la clase CSS del badge en la pantalla del radar; el servidor no la
  // usa y a propósito no está en content.js. Se descarta antes de comparar.
  const sinCls = Object.fromEntries(
    Object.entries(front.ENERGY_COPY).map(([k, { cls, ...resto }]) => [k, resto])
  );
  assert.deepEqual(ENERGY_COPY, sinCls);

  // Y que `cls` sea lo único que sobra, no vaya a ser que se pierda copy nuevo.
  for (const [k, v] of Object.entries(front.ENERGY_COPY)) {
    const extra = Object.keys(v).filter((campo) => !(campo in ENERGY_COPY[k]));
    assert.deepEqual(extra, ['cls'], `en "${k}" sobran campos inesperados: ${extra}`);
  }
});

test('los textos de cuello de botella coinciden', () => {
  assert.deepEqual(BOTTLENECK_COPY, front.BOTTLENECK_COPY);
});

test('las etiquetas de la escala coinciden', () => {
  assert.deepEqual(SCALE_LABELS, front.SCALE_LABELS);
});

test('cada dimensión tiene texto de cuello de botella e introducción', () => {
  for (const d of DIMENSIONS) {
    assert.ok(BOTTLENECK_COPY[d.key], `falta BOTTLENECK_COPY para "${d.key}"`);
    assert.ok(DIMENSION_INTRO[d.key], `falta DIMENSION_INTRO para "${d.key}"`);
  }
  // Sin llaves de más: una dimensión eliminada dejaría copy huérfano.
  const claves = DIMENSIONS.map((d) => d.key).sort();
  assert.deepEqual(Object.keys(BOTTLENECK_COPY).sort(), claves);
  assert.deepEqual(Object.keys(DIMENSION_INTRO).sort(), claves);
});

test('cada dimensión tiene exactamente 2 preguntas', () => {
  for (const d of DIMENSIONS) {
    const n = QUESTIONS.filter((q) => q.dim === d.key).length;
    assert.equal(n, 2, `"${d.key}" tiene ${n} preguntas, no 2`);
  }
});

test('nombreDeNivel usa la misma regla de redondeo que el nivel global', () => {
  assert.equal(nombreDeNivel(1), 'Explorador');
  assert.equal(nombreDeNivel(2.4), 'Experimentador');
  assert.equal(nombreDeNivel(2.5), 'Integrador'); // .5 hacia arriba, como Math.round
  assert.equal(nombreDeNivel(5), 'Innovador');
  // El puntaje de dimensión nunca sale de 1..5, pero el clamp no debe romperse.
  assert.equal(nombreDeNivel(0), 'Explorador');
  assert.equal(nombreDeNivel(9), 'Innovador');
});
