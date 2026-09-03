/**
 * Verificación del reporte contra las respuestas reales de producción.
 *
 * No es una prueba unitaria: necesita red y el token. Por eso vive en scripts/ y
 * no en test/, donde el runner de Node lo tomaría como test y fallaría sin token.
 * Se ejecuta a mano cuando se toca el reporte:
 *
 *   ADMIN_TOKEN=... node scripts/verificar-reportes.mjs [carpeta-de-salida]
 *
 * Renderiza el reporte de cada respuesta real, revisa las invariantes que
 * importan y deja los HTML en disco para mirarlos en el navegador.
 */

import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { analizar, buildReportHtml, listar } from '../src/report.js';

const API = process.env.API_BASE || 'https://radar-api-production-576f.up.railway.app';
const TOKEN = process.env.ADMIN_TOKEN;
const SALIDA = process.argv[2] || 'reportes-generados';

if (!TOKEN) {
  console.error('Falta ADMIN_TOKEN en el entorno.');
  process.exit(1);
}

/* CSV -> objetos (RFC 4180: las barreras traen comas, comillas y saltos). */
function parseCsv(str) {
  const rows = [];
  let row = [], f = '', q = false;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (q) {
      if (c === '"') { if (str[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\r') { /* ignorar */ }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}

const res = await fetch(`${API}/api/admin/responses.csv`, {
  headers: { Authorization: 'Bearer ' + TOKEN },
});
if (!res.ok) {
  console.error('La API respondió', res.status);
  process.exit(1);
}

const filasCsv = parseCsv((await res.text()).replace(/^﻿/, ''));
const head = filasCsv[0];
const filas = filasCsv
  .slice(1)
  .filter((r) => r.length === head.length && r[0])
  .map((r) => {
    const o = Object.fromEntries(head.map((h, i) => [h, r[i]]));
    return {
      id: o.id,
      created_at: o.created_at,
      // El reporte recalcula todo desde answers, igual que en producción.
      answers: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, Number(o['q' + (i + 1)])])),
      barrier: o.barrier || null,
      contact_name: o.contact_name || null,
      contact_company: o.contact_company || null,
    };
  });

mkdirSync(SALIDA, { recursive: true });

let planos = 0, casiParejos = 0, sinBarrera = 0, conContacto = 0, empatesParciales = 0;
const problemas = [];

filas.forEach((fila, i) => {
  const n = i + 1;
  let html;
  try {
    html = buildReportHtml(fila);
  } catch (e) {
    problemas.push(`#${n} (${fila.id}): el render lanzó "${e.message}"`);
    return;
  }

  const a = analizar(fila);

  // --- Invariantes que valen para todos ---
  for (const basura of ['undefined', 'NaN', '[object Object]', 'null / 5']) {
    if (html.includes(basura)) problemas.push(`#${n}: el HTML contiene "${basura}"`);
  }
  if (!html.startsWith('<!DOCTYPE html>')) problemas.push(`#${n}: no arranca con doctype`);
  if ((html.match(/<section/g) || []).length < 5) problemas.push(`#${n}: muy pocas secciones`);

  // Las 12 preguntas tienen que estar citadas en el detalle.
  a.perfil.forEach((p) =>
    p.preguntas.forEach((q) => {
      if (q.valor < 1 || q.valor > 5) problemas.push(`#${n}: la pregunta ${q.id} quedó fuera de escala (${q.valor})`);
    })
  );

  // --- Nunca afirmar un cuello de botella que no existe ---
  const afirmaFriccion = html.includes('Dónde está tu mayor fricción');
  if (a.perfilPlano) {
    planos++;
    if (!html.includes('Tu perfil es parejo')) problemas.push(`#${n}: perfil plano sin la lectura honesta`);
    if (afirmaFriccion) problemas.push(`#${n}: perfil plano pero afirma una fricción`);
    if (html.includes('Dónde tienes terreno ganado')) problemas.push(`#${n}: perfil plano pero afirma una fortaleza`);
  } else if (a.casiParejo) {
    casiParejos++;
    if (!html.includes('Tu perfil es casi parejo')) problemas.push(`#${n}: casi parejo sin la lectura honesta`);
    if (afirmaFriccion) problemas.push(`#${n}: ${a.masBajas.length} dimensiones empatadas pero afirma una fricción`);
    // No debe imprimir un párrafo de cuello de botella por cada empatada.
    const parrafos = (html.match(/class="cuerpo lectura">Hoy,/g) || []).length;
    if (parrafos > 0) problemas.push(`#${n}: casi parejo pero imprime ${parrafos} párrafos de cuello de botella`);
  } else {
    if (!afirmaFriccion) problemas.push(`#${n}: falta la sección de fricción`);
    if (!html.includes('Dónde tienes terreno ganado')) problemas.push(`#${n}: falta la sección de fortaleza`);
    if (a.masBajas.length > 1) {
      empatesParciales++;
      // Un empate parcial debe nombrarlas todas, no quedarse con una.
      if (!html.includes('dimensiones empatadas')) {
        problemas.push(`#${n}: ${a.masBajas.length} dimensiones empatadas abajo y no lo dice`);
      }
    }
  }

  // Ninguna sección debe desplegar más de 3 bloques de dimensión seguidos
  // fuera del detalle completo (que sí lleva las 6).
  const bloques = (html.match(/class="dim-bloque /g) || []).length;
  if (bloques > 6 + 3 + 3) problemas.push(`#${n}: ${bloques} bloques de dimensión, demasiados`);

  // --- Barrera ---
  if (fila.barrier) {
    if (!html.includes('Tu barrera, en tus palabras')) problemas.push(`#${n}: escribió barrera y no aparece`);
  } else {
    sinBarrera++;
    if (html.includes('Tu barrera, en tus palabras')) problemas.push(`#${n}: sin barrera pero la sección existe`);
  }

  // --- Contacto ---
  if (fila.contact_name) {
    conContacto++;
    const primer = fila.contact_name.split(/\s+/)[0];
    if (!html.includes(primer)) problemas.push(`#${n}: no saluda por su nombre ("${primer}")`);
  }
  // El correo nunca va en el cuerpo del reporte.
  if (/[\w.+-]+@(?!adapsysgroup)[\w-]+\.[\w.]+/.test(html.replace(/metrics@adapsysgroup\.com/g, ''))) {
    problemas.push(`#${n}: parece filtrarse un email en el cuerpo`);
  }

  const etiqueta = a.perfilPlano ? 'PLANO' : `${a.masBajas[0].key}-abajo`;
  writeFileSync(join(SALIDA, `${String(n).padStart(2, '0')}-${etiqueta}.html`), html);
});

console.log(`Reportes generados : ${filas.length}  ->  ${SALIDA}/`);
console.log(`  perfiles planos          : ${planos}`);
console.log(`  perfiles casi parejos    : ${casiParejos}`);
console.log(`  con empate parcial       : ${empatesParciales}`);
console.log(`  sin barrera escrita      : ${sinBarrera}`);
console.log(`  con nombre de contacto   : ${conContacto}`);

// Casos construidos a mano que los datos reales podrían no cubrir.
console.log('\nCasos límite sintéticos:');
const casos = [
  { nombre: 'todo 1 (mínimo posible)', a: Array(12).fill(1) },
  { nombre: 'todo 5 (máximo posible)', a: Array(12).fill(5) },
  { nombre: 'sin nombre ni empresa', a: [3, 4, 2, 5, 1, 3, 4, 2, 5, 1, 3, 4], anon: true },
  { nombre: 'dos dimensiones empatadas abajo', a: [5, 5, 1, 1, 1, 1, 5, 5, 5, 5, 5, 5] },
];
for (const caso of casos) {
  const fila = {
    id: '00000000-0000-4000-8000-000000000000',
    created_at: new Date().toISOString(),
    answers: Object.fromEntries(caso.a.map((v, i) => [i + 1, v])),
    barrier: caso.anon ? null : 'barrera de prueba',
    contact_name: caso.anon ? null : 'Persona Prueba',
    contact_company: caso.anon ? null : 'Empresa Prueba',
  };
  const html = buildReportHtml(fila);
  const a = analizar(fila);
  const desc = a.perfilPlano ? 'PLANO' : `abajo: ${listar(a.masBajas.map((p) => p.label))}`;
  console.log(`  ${caso.nombre.padEnd(34)} -> ${desc}`);
  for (const basura of ['undefined', 'NaN', '[object Object]']) {
    if (html.includes(basura)) problemas.push(`sintético "${caso.nombre}": contiene "${basura}"`);
  }
  writeFileSync(join(SALIDA, `sintetico-${caso.nombre.replace(/[^a-z0-9]+/gi, '-')}.html`), html);
}

console.log();
if (problemas.length) {
  console.log(`PROBLEMAS (${problemas.length}):`);
  problemas.forEach((p) => console.log('  - ' + p));
  process.exit(1);
}
console.log('Sin problemas.');
