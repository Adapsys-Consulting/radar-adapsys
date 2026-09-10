/**
 * Verificación del reporte contra las respuestas reales de producción.
 *
 * No es una prueba unitaria: necesita red y el token. Por eso vive en scripts/ y
 * no en test/, donde el runner de Node lo tomaría como test y fallaría sin token.
 * Se ejecuta a mano cuando se toca el reporte:
 *
 *   ADMIN_TOKEN=... node scripts/verificar-reportes.mjs [carpeta-de-salida]
 *
 * Renderiza el reporte de cada respuesta real EN LOS DOS IDIOMAS, revisa las
 * invariantes que importan y deja los HTML en disco para mirarlos en el
 * navegador. Los títulos que busca salen de los diccionarios y no de literales,
 * así la misma revisión sirve para cualquier idioma que se agregue.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DICCIONARIOS, IDIOMAS } from '../src/i18n/index.js';
import { analizar, buildReportHtml } from '../src/report.js';

const API = process.env.API_BASE || 'https://radar-api-production-576f.up.railway.app';
const TOKEN = process.env.ADMIN_TOKEN;
const SALIDA = process.argv[2] || 'reportes-generados';

/* Sin token se corre igual, con solo los casos sintéticos. Las invariantes de
   idioma —que ninguna sección quede sin traducir— no necesitan datos reales, y
   así se pueden revisar sin red ni acceso a producción. */
const SOLO_SINTETICOS = !TOKEN;
if (SOLO_SINTETICOS) {
  console.log('Sin ADMIN_TOKEN: se revisan solo los casos sintéticos.\n');
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

/* Un CSV vacío deja `filas` en [] y el script pasa directo a los sintéticos. */
const res = SOLO_SINTETICOS
  ? { ok: true, text: async () => '' }
  : await fetch(`${API}/api/admin/responses.csv`, {
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

/** Mismo escapado que report.js, para buscar en el HTML ya emitido. */
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

/**
 * Revisa un reporte en un idioma y devuelve su HTML (o null si el render falló).
 *
 * Cuenta las categorías de perfil solo cuando `contar` es true, para no
 * duplicarlas al recorrer el segundo idioma.
 */
function revisar(fila, quien, codigo, contar) {
  const d = DICCIONARIOS[codigo];
  let html;
  try {
    html = buildReportHtml(fila, codigo);
  } catch (e) {
    problemas.push(`${quien} [${codigo}]: el render lanzó "${e.message}"`);
    return null;
  }

  const a = analizar(fila, d);
  const donde = `${quien} [${codigo}]`;
  const titulo = (t) => html.includes(`<h2>${esc(t)}</h2>`);

  // --- Invariantes que valen para todos ---
  for (const basura of ['undefined', 'NaN', '[object Object]', 'null / 5', '=>']) {
    if (html.includes(basura)) problemas.push(`${donde}: el HTML contiene "${basura}"`);
  }
  if (!html.startsWith('<!DOCTYPE html>')) problemas.push(`${donde}: no arranca con doctype`);
  if (!html.includes(`<html lang="${esc(d.htmlLang)}">`)) problemas.push(`${donde}: el atributo lang no corresponde`);
  if ((html.match(/<section/g) || []).length < 5) problemas.push(`${donde}: muy pocas secciones`);

  a.perfil.forEach((p) =>
    p.preguntas.forEach((q) => {
      if (q.valor < 1 || q.valor > 5) problemas.push(`${donde}: la pregunta ${q.id} quedó fuera de escala (${q.valor})`);
      if (!html.includes(esc(q.texto))) problemas.push(`${donde}: la afirmación ${q.id} no se cita`);
    })
  );

  // --- Ninguna palabra del otro idioma se filtra ---
  for (const otro of IDIOMAS.filter((c) => c !== codigo)) {
    const o = DICCIONARIOS[otro];
    for (const t of [o.perfil.h2, o.detalle.h2, o.contexto.h2, o.cierre.h2, o.barrera.h2,
                     o.friccion.plano.h2, o.friccion.casiParejo.h2, o.friccion.normal.h2, o.fortaleza.h2]) {
      if (html.includes(`<h2>${esc(t)}</h2>`)) problemas.push(`${donde}: se filtró el título "${t}" (${otro})`);
    }
  }

  // --- Nunca afirmar un cuello de botella que no existe ---
  const afirmaFriccion = titulo(d.friccion.normal.h2);
  if (a.perfilPlano) {
    if (contar) planos++;
    if (!titulo(d.friccion.plano.h2)) problemas.push(`${donde}: perfil plano sin la lectura honesta`);
    if (afirmaFriccion) problemas.push(`${donde}: perfil plano pero afirma una fricción`);
    if (titulo(d.fortaleza.h2)) problemas.push(`${donde}: perfil plano pero afirma una fortaleza`);
  } else if (a.casiParejo) {
    if (contar) casiParejos++;
    if (!titulo(d.friccion.casiParejo.h2)) problemas.push(`${donde}: casi parejo sin la lectura honesta`);
    if (afirmaFriccion) problemas.push(`${donde}: ${a.masBajas.length} dimensiones empatadas pero afirma una fricción`);
    /* No debe imprimir un párrafo de cuello de botella por cada empatada. El
       prefijo se saca del propio diccionario ("Hoy, " / "Today, "). */
    const prefijo = esc(d.friccion.normal.lectura(''));
    const parrafos = html.split(`class="cuerpo lectura">${prefijo}`).length - 1;
    if (parrafos > 0) problemas.push(`${donde}: casi parejo pero imprime ${parrafos} párrafos de cuello de botella`);
  } else {
    if (!afirmaFriccion) problemas.push(`${donde}: falta la sección de fricción`);
    if (!titulo(d.fortaleza.h2)) problemas.push(`${donde}: falta la sección de fortaleza`);
    if (a.masBajas.length > 1) {
      if (contar) empatesParciales++;
      // Un empate parcial debe nombrarlas todas, no quedarse con una.
      for (const p of a.masBajas) {
        if (!html.includes(esc(p.label))) problemas.push(`${donde}: no nombra "${p.label}", empatada abajo`);
      }
    }
  }

  // Ninguna sección debe desplegar más de 3 bloques de dimensión seguidos
  // fuera del detalle completo (que sí lleva las 6).
  const bloques = (html.match(/class="dim-bloque /g) || []).length;
  if (bloques > 6 + 3 + 3) problemas.push(`${donde}: ${bloques} bloques de dimensión, demasiados`);

  // --- Barrera: va tal como la escribió, sin traducir ---
  if (fila.barrier) {
    if (!titulo(d.barrera.h2)) problemas.push(`${donde}: escribió barrera y no aparece`);
    if (!html.includes(esc(fila.barrier.trim()))) problemas.push(`${donde}: la barrera no está textual`);
  } else {
    if (contar) sinBarrera++;
    if (titulo(d.barrera.h2)) problemas.push(`${donde}: sin barrera pero la sección existe`);
  }

  // --- Contacto ---
  if (fila.contact_name) {
    if (contar) conContacto++;
    const primer = fila.contact_name.split(/\s+/)[0];
    if (!html.includes(esc(primer))) problemas.push(`${donde}: no saluda por su nombre ("${primer}")`);
  }
  // El correo nunca va en el cuerpo del reporte.
  if (/[\w.+-]+@(?!adapsysgroup)[\w-]+\.[\w.]+/.test(html.replace(/metrics@adapsysgroup\.com/g, ''))) {
    problemas.push(`${donde}: parece filtrarse un email en el cuerpo`);
  }

  return html;
}

filas.forEach((fila, i) => {
  const n = i + 1;
  const quien = `#${n} (${fila.id})`;
  const a = analizar(fila);
  const etiqueta = a.perfilPlano ? 'PLANO' : `${a.masBajas[0].key}-abajo`;

  IDIOMAS.forEach((codigo, idx) => {
    const html = revisar(fila, quien, codigo, idx === 0);
    if (!html) return;
    const sufijo = codigo === 'es' ? '' : `.${codigo}`;
    writeFileSync(join(SALIDA, `${String(n).padStart(2, '0')}-${etiqueta}${sufijo}.html`), html);
  });
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
  // Cinco empatadas abajo: la rama "casi parejo", donde vive la gramática más
  // difícil de traducir (plurales y concordancia en las tres frases).
  { nombre: 'cinco empatadas abajo', a: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 5, 5] },
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
  const a = analizar(fila);
  const desc = a.perfilPlano ? 'PLANO' : `abajo: ${DICCIONARIOS.es.fmt.listar(a.masBajas.map((p) => p.label))}`;
  console.log(`  ${caso.nombre.padEnd(34)} -> ${desc}`);

  const archivo = caso.nombre.replace(/[^a-z0-9]+/gi, '-');
  for (const codigo of IDIOMAS) {
    const html = revisar(fila, `sintético "${caso.nombre}"`, codigo, false);
    if (!html) continue;
    const sufijo = codigo === 'es' ? '' : `.${codigo}`;
    writeFileSync(join(SALIDA, `sintetico-${archivo}${sufijo}.html`), html);
  }
}

console.log();
if (problemas.length) {
  console.log(`PROBLEMAS (${problemas.length}):`);
  problemas.forEach((p) => console.log('  - ' + p));
  process.exit(1);
}
console.log('Sin problemas.');
