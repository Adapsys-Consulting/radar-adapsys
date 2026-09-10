/**
 * El reporte, renderizado en los dos idiomas y en las cuatro ramas de perfil.
 *
 * La rama importa tanto como el idioma: seccionFriccion() se bifurca en perfil
 * plano, casi parejo, empate parcial y punto más bajo único, y cada rama arma
 * frases distintas con plurales y concordancia. Un idioma puede estar completo
 * en el diccionario y aun así romperse en una sola de esas ramas.
 *
 * La prueba central es la de fuga: que ningún título de un idioma aparezca en el
 * documento del otro. Es lo que detecta una sección que quedó sin traducir.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QUESTIONS } from '../src/content.js';
import { DICCIONARIOS, IDIOMAS } from '../src/i18n/index.js';
import { nombreArchivo } from '../src/pdf.js';
import { analizar, buildReportHtml } from '../src/report.js';

/** Mismo escapado que report.js, para comparar contra el HTML ya emitido. */
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

/** Todos los <h2> que un idioma puede emitir. */
const titulos = (d) => [
  d.perfil.h2,
  d.friccion.plano.h2,
  d.friccion.casiParejo.h2,
  d.friccion.normal.h2,
  d.fortaleza.h2,
  d.detalle.h2,
  d.barrera.h2,
  d.contexto.h2,
  d.cierre.h2,
];

const fila = (respuestas, extra = {}) => ({
  id: '11111111-2222-4333-8444-555555555555',
  created_at: '2026-09-10T14:00:00Z',
  answers: Object.fromEntries(respuestas.map((v, i) => [i + 1, v])),
  barrier: 'La gente no confía en los datos que ya tenemos.',
  contact_name: 'Cecilia Mlp',
  contact_company: 'Acme Pty Ltd',
  ...extra,
});

/* Una fila por cada rama de seccionFriccion(), con la propiedad estructural que
   la caracteriza para poder afirmarla en la prueba y no solo asumirla. */
const RAMAS = {
  'punto más bajo único': { fila: fila([5, 5, 1, 1, 3, 3, 4, 4, 3, 3, 4, 4]), bajas: 1 },
  'empate parcial abajo': { fila: fila([5, 5, 1, 1, 1, 1, 5, 5, 5, 5, 5, 5]), bajas: 2 },
  'perfil plano': { fila: fila(Array(12).fill(3)), plano: true },
  'perfil casi parejo': { fila: fila([2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 5, 5]), casiParejo: true, bajas: 5 },
};

test('las fixtures cubren de verdad las cuatro ramas', () => {
  for (const [nombre, caso] of Object.entries(RAMAS)) {
    const a = analizar(caso.fila);
    assert.equal(a.perfilPlano, Boolean(caso.plano), `"${nombre}": perfilPlano no es el esperado`);
    assert.equal(a.casiParejo, Boolean(caso.casiParejo), `"${nombre}": casiParejo no es el esperado`);
    if (caso.bajas) assert.equal(a.masBajas.length, caso.bajas, `"${nombre}": otra cantidad de mínimos`);
  }
});

test('ningún título se filtra de un idioma al documento del otro', () => {
  for (const [nombre, caso] of Object.entries(RAMAS)) {
    for (const codigo of IDIOMAS) {
      const html = buildReportHtml(caso.fila, codigo);
      for (const otro of IDIOMAS.filter((c) => c !== codigo)) {
        for (const titulo of titulos(DICCIONARIOS[otro])) {
          assert.ok(
            !html.includes(`<h2>${esc(titulo)}</h2>`),
            `"${nombre}" en ${codigo}: se filtró el título "${titulo}" (${otro})`
          );
        }
      }
    }
  }
});

test('cada rama emite el título que le corresponde, en cada idioma', () => {
  for (const [nombre, caso] of Object.entries(RAMAS)) {
    for (const codigo of IDIOMAS) {
      const d = DICCIONARIOS[codigo];
      const html = buildReportHtml(caso.fila, codigo);
      const tiene = (t) => html.includes(`<h2>${esc(t)}</h2>`);

      // Siempre, en toda rama.
      for (const t of [d.perfil.h2, d.detalle.h2, d.contexto.h2, d.cierre.h2, d.barrera.h2]) {
        assert.ok(tiene(t), `"${nombre}" en ${codigo}: falta el título "${t}"`);
      }

      if (caso.plano) {
        assert.ok(tiene(d.friccion.plano.h2), `"${nombre}" en ${codigo}: falta la lectura honesta`);
        // Un perfil plano no afirma fricción ni fortaleza: no hay ninguna.
        assert.ok(!tiene(d.friccion.normal.h2), `"${nombre}" en ${codigo}: afirma una fricción`);
        assert.ok(!tiene(d.fortaleza.h2), `"${nombre}" en ${codigo}: afirma una fortaleza`);
      } else if (caso.casiParejo) {
        assert.ok(tiene(d.friccion.casiParejo.h2), `"${nombre}" en ${codigo}: falta la lectura honesta`);
        assert.ok(!tiene(d.friccion.normal.h2), `"${nombre}" en ${codigo}: afirma un cuello de botella`);
      } else {
        assert.ok(tiene(d.friccion.normal.h2), `"${nombre}" en ${codigo}: falta la fricción`);
        assert.ok(tiene(d.fortaleza.h2), `"${nombre}" en ${codigo}: falta la fortaleza`);
      }
    }
  }
});

test('las 12 afirmaciones se citan en el idioma del documento', () => {
  for (const codigo of IDIOMAS) {
    const d = DICCIONARIOS[codigo];
    const html = buildReportHtml(RAMAS['punto más bajo único'].fila, codigo);
    for (const { id } of QUESTIONS) {
      assert.ok(html.includes(esc(d.preguntas[id])), `${codigo}: la afirmación ${id} no aparece`);
    }
  }
});

test('el documento declara su propio idioma', () => {
  for (const codigo of IDIOMAS) {
    const html = buildReportHtml(RAMAS['perfil plano'].fila, codigo);
    assert.ok(html.startsWith('<!DOCTYPE html>'), `${codigo}: no arranca con doctype`);
    assert.ok(
      html.includes(`<html lang="${esc(DICCIONARIOS[codigo].htmlLang)}">`),
      `${codigo}: el atributo lang no corresponde`
    );
  }
});

test('los enlaces del documento arrastran su idioma', () => {
  const { id } = RAMAS['perfil plano'].fila;

  // El español es el default y no lleva sufijo: los enlaces ya enviados por
  // correo tienen que seguir funcionando tal como están.
  const esHtml = buildReportHtml(RAMAS['perfil plano'].fila, 'es');
  assert.ok(esHtml.includes(`href="/reporte/${id}/pdf"`), 'el PDF en español no debería llevar ?lang');
  assert.ok(esHtml.includes(`href="/reporte/${id}?lang=en"`), 'falta el enlace al inglés');

  // Sin esto, la página en inglés descargaría un PDF en español.
  const enHtml = buildReportHtml(RAMAS['perfil plano'].fila, 'en');
  assert.ok(enHtml.includes(`href="/reporte/${id}/pdf?lang=en"`), 'el PDF en inglés no arrastra el idioma');
  assert.ok(enHtml.includes(`href="/reporte/${id}"`), 'falta el enlace de vuelta al español');
});

test('el reporte en inglés avisa que las afirmaciones son una traducción', () => {
  // La encuesta es solo en español: el lector en inglés está viendo una
  // traducción de lo que leyó en pantalla, y el reporte no puede omitirlo.
  const caso = RAMAS['punto más bajo único'].fila;
  assert.ok(buildReportHtml(caso, 'en').includes(esc(DICCIONARIOS.en.detalle.nota)));
  assert.equal(DICCIONARIOS.es.detalle.nota, '', 'en español no hay nada que advertir');
});

test('la barrera escrita nunca se traduce', () => {
  // Son las palabras de la persona. Traducirlas sería ponerle en la boca algo
  // que no dijo.
  const caso = RAMAS['punto más bajo único'].fila;
  for (const codigo of IDIOMAS) {
    assert.ok(
      buildReportHtml(caso, codigo).includes(esc(caso.barrier)),
      `${codigo}: la barrera no aparece tal como se escribió`
    );
  }
});

test('un idioma desconocido cae al español en vez de romper el reporte', () => {
  const caso = RAMAS['perfil plano'].fila;
  const español = buildReportHtml(caso, 'es');
  for (const valor of [undefined, '', 'fr', 'klingon', null, 42, ['zz']]) {
    assert.equal(buildReportHtml(caso, valor), español, `"${valor}" debería caer al español`);
  }
});

test('el documento no imprime basura en ninguna rama ni idioma', () => {
  for (const [nombre, caso] of Object.entries(RAMAS)) {
    for (const codigo of IDIOMAS) {
      // Sin contacto ni barrera: es el caso donde más fácil se cuela un hueco.
      for (const anon of [false, true]) {
        const f = anon
          ? { ...caso.fila, barrier: null, contact_name: null, contact_company: null }
          : caso.fila;
        const html = buildReportHtml(f, codigo);
        for (const basura of ['undefined', 'NaN', '[object Object]', '=>', 'null / 5']) {
          assert.ok(
            !html.includes(basura),
            `"${nombre}" en ${codigo}${anon ? ' (anónimo)' : ''}: el HTML contiene "${basura}"`
          );
        }
      }
    }
  }
});

test('el PDF se llama distinto en cada idioma', () => {
  const f = RAMAS['perfil plano'].fila;
  assert.equal(nombreArchivo(f, 'es'), 'Radar-Adapsys-IA-Cecilia-Mlp-Acme-Pty-Ltd.pdf');
  assert.equal(nombreArchivo(f, 'en'), 'Adapsys-AI-Radar-Cecilia-Mlp-Acme-Pty-Ltd.pdf');
  // Sin idioma sigue siendo el español, como antes de que hubiera idiomas.
  assert.equal(nombreArchivo(f), nombreArchivo(f, 'es'));
});
