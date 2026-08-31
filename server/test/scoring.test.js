/**
 * Paridad de scoring entre el frontend y el servidor.
 *
 * No compara contra una copia del algoritmo: extrae DIMENSIONS, QUESTIONS y
 * computeResult() del index.html que se despliega, y los ejecuta. Si alguien
 * toca el scoring en un lado y no en el otro, esta prueba falla — que es
 * exactamente lo que queremos, porque una divergencia haría que la base guarde
 * un resultado distinto al que el usuario vio en pantalla.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { computeResult as serverCompute, QUESTION_IDS } from '../src/scoring.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname, '..', '..', 'index.html'), 'utf8');

function extract(pattern, name) {
  const match = html.match(pattern);
  if (!match) {
    throw new Error(
      `No se pudo extraer ${name} de index.html. ` +
        'Si cambió su formato, actualiza el patrón en esta prueba.'
    );
  }
  return match[0];
}

const frontendCompute = new Function(`
  let state;
  ${extract(/const DIMENSIONS = \[[\s\S]*?\n\];/, 'DIMENSIONS')}
  ${extract(/const QUESTIONS = \[[\s\S]*?\n\];/, 'QUESTIONS')}
  ${extract(/function computeResult\(\)\{[\s\S]*?\n\}/, 'computeResult')}
  return function (answers) {
    state = { answers };
    return computeResult();
  };
`)();

const fields = ['total', 'avg', 'level', 'energyKey', 'bottleneckKey'];

function assertParity(answers, label) {
  const front = frontendCompute(answers);
  const back = serverCompute(answers);
  for (const f of fields) {
    assert.deepEqual(back[f], front[f], `${label}: divergencia en "${f}"`);
  }
  assert.deepEqual(back.dimTotals, front.dimTotals, `${label}: divergencia en dimTotals`);
  return back;
}

const uniform = (v) => Object.fromEntries(QUESTION_IDS.map((id) => [id, v]));

test('respuestas uniformes 1..5', () => {
  for (let v = 1; v <= 5; v++) {
    assertParity(uniform(v), `todas en ${v}`);
  }
});

test('extremos del instrumento', () => {
  assert.equal(assertParity(uniform(5), 'máximo').energyKey, 'impulse');
  assert.equal(assertParity(uniform(5), 'máximo').level, 5);
  assert.equal(assertParity(uniform(1), 'mínimo').energyKey, 'survive');
  assert.equal(assertParity(uniform(1), 'mínimo').level, 1);
});

test('umbrales de energía: survive/transit en total 33 vs 34', () => {
  // pct = total/60. El corte está en 0.56 -> 33.6, así que 33 cae en survive.
  const t33 = { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3, 9: 3, 10: 3, 11: 2, 12: 1 };
  const t34 = { ...t33, 11: 3 };
  assert.equal(Object.values(t33).reduce((a, b) => a + b), 33);
  assert.equal(Object.values(t34).reduce((a, b) => a + b), 34);
  assert.equal(assertParity(t33, 'total 33').energyKey, 'survive');
  assert.equal(assertParity(t34, 'total 34').energyKey, 'transit');
});

test('umbrales de energía: transit/impulse en total 47 vs 48', () => {
  // 0.80 * 60 = 48 exacto, y la comparación es >=, así que 48 ya es impulse.
  const t48 = { 1: 4, 2: 4, 3: 4, 4: 4, 5: 4, 6: 4, 7: 4, 8: 4, 9: 4, 10: 4, 11: 4, 12: 4 };
  const t47 = { ...t48, 12: 3 };
  assert.equal(assertParity(t47, 'total 47').energyKey, 'transit');
  assert.equal(assertParity(t48, 'total 48').energyKey, 'impulse');
});

test('Math.round redondea .5 hacia arriba', () => {
  // total 30 -> avg 2.5 -> nivel 3;  total 42 -> avg 3.5 -> nivel 4.
  const t30 = { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3, 9: 2, 10: 2, 11: 1, 12: 1 };
  assert.equal(Object.values(t30).reduce((a, b) => a + b), 30);
  assert.equal(assertParity(t30, 'avg 2.5').level, 3);

  const t42 = { 1: 4, 2: 4, 3: 4, 4: 4, 5: 4, 6: 4, 7: 4, 8: 4, 9: 3, 10: 3, 11: 2, 12: 2 };
  assert.equal(Object.values(t42).reduce((a, b) => a + b), 42);
  assert.equal(assertParity(t42, 'avg 3.5').level, 4);
});

test('empate en el cuello de botella: gana la primera dimensión del arreglo', () => {
  // valor (q3,q4) y datos (q5,q6) empatan en 2; el resto está más alto.
  // El `<` estricto del frontend hace que gane "valor", que va antes.
  const empate = { 1: 5, 2: 5, 3: 1, 4: 1, 5: 1, 6: 1, 7: 5, 8: 5, 9: 5, 10: 5, 11: 5, 12: 5 };
  assert.equal(assertParity(empate, 'empate valor/datos').bottleneckKey, 'valor');

  // Empate de las seis dimensiones -> gana proposito, la primera.
  assert.equal(assertParity(uniform(3), 'empate total').bottleneckKey, 'proposito');
});

test('fuzz: 2000 combinaciones aleatorias coinciden en todo', () => {
  for (let i = 0; i < 2000; i++) {
    const answers = Object.fromEntries(
      QUESTION_IDS.map((id) => [id, 1 + Math.floor(Math.random() * 5)])
    );
    assertParity(answers, `aleatorio #${i} ${JSON.stringify(answers)}`);
  }
});
