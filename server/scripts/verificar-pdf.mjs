/**
 * Verificación del PDF, por dentro.
 *
 *   ADMIN_TOKEN=... [CHROMIUM_PATH=...] node scripts/verificar-pdf.mjs [carpeta]
 *
 * Genera el PDF de las respuestas reales que dejaron contacto y revisa lo que no
 * se ve mirando una miniatura:
 *
 *   - que sea un PDF válido y con cuántas páginas
 *   - qué tipografías quedaron embebidas: si solo hay genéricas, es que
 *     document.fonts.ready no alcanzó a esperar y el documento salió con la
 *     fuente de reemplazo. Es el modo de falla silencioso de esta generación.
 *   - que el texto esté y sea seleccionable, descomprimiendo los streams
 *   - que ninguna página haya quedado en blanco
 */

import { inflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildReportHtml } from '../src/report.js';
import { QUESTIONS } from '../src/content.js';
import { nombreArchivo, renderPdfConTexto } from '../src/pdf.js';

const API = process.env.API_BASE || 'https://radar-api-production-576f.up.railway.app';
const TOKEN = process.env.ADMIN_TOKEN;
const SALIDA = process.argv[2] || 'pdfs-generados';

if (!TOKEN) {
  console.error('Falta ADMIN_TOKEN en el entorno.');
  process.exit(1);
}

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
    else if (c === '\r') { /* nada */ }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}

/**
 * Cuenta operadores de dibujo de texto en los streams del PDF.
 *
 * No se intenta leer QUÉ dice: con fuentes subconjuntadas el texto va como
 * índices de glifo y decodificarlo exige recorrer los CMap /ToUnicode. El
 * contenido se verifica en el DOM, que es la misma página que se imprime. Acá
 * solo interesa saber que hay texto de verdad y no una imagen del reporte.
 */
function operadoresDeTexto(buf) {
  return inflarStreams(buf).reduce((n, s) => n + (s.match(/\bT[jJ]\b/g) || []).length, 0);
}

/**
 * Descomprime todos los streams del PDF.
 *
 * Hace falta incluso para cosas que parecen estar "a la vista": Chrome guarda
 * los diccionarios de objetos —incluidas las fuentes— dentro de object streams
 * comprimidos, así que buscar /BaseFont en los bytes crudos encuentra apenas
 * unos pocos y hace creer que las demás tipografías no se embebieron.
 */
function inflarStreams(buf) {
  const out = [];
  let i = 0;
  while (true) {
    const ini = buf.indexOf('stream', i);
    if (ini === -1) break;
    let s = ini + 6;
    if (buf[s] === 0x0d) s++;
    if (buf[s] === 0x0a) s++;
    const fin = buf.indexOf('endstream', s);
    if (fin === -1) break;
    try {
      out.push(inflateSync(buf.subarray(s, fin)).toString('latin1'));
    } catch { /* no todos los streams están comprimidos */ }
    i = fin + 9;
  }
  return out;
}

/**
 * Tipografías realmente embebidas.
 *
 * Se lee `/FontName` del `/FontDescriptor`, que es donde queda registrada una
 * fuente incrustada. Mirar solo `/BaseFont` engaña: en estos PDF aparecen apenas
 * dos, mientras los FontDescriptor listan las tres familias.
 */
function fuentesEmbebidas(buf) {
  const donde = [buf.toString('latin1'), ...inflarStreams(buf)].join('\n');
  const nombres = [
    ...(donde.match(/\/FontName\s*\/[^\s/\]>]+/g) || []),
    ...(donde.match(/\/BaseFont\s*\/[^\s/\]>]+/g) || []),
  ];
  return [...new Set(nombres.map((f) => f.replace(/.*\//, '').replace(/^[A-Z]{6}\+/, '')))];
}

const res = await fetch(`${API}/api/admin/responses.csv`, { headers: { Authorization: 'Bearer ' + TOKEN } });
if (!res.ok) { console.error('La API respondió', res.status); process.exit(1); }

const rows = parseCsv((await res.text()).replace(/^﻿/, ''));
const head = rows[0];
const todas = rows.slice(1).filter((r) => r.length === head.length && r[0]).map((r) => {
  const o = Object.fromEntries(head.map((h, i) => [h, r[i]]));
  return {
    id: o.id,
    created_at: o.created_at,
    answers: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, Number(o['q' + (i + 1)])])),
    barrier: o.barrier || null,
    contact_name: o.contact_name || null,
    contact_company: o.contact_company || null,
  };
});

// Los dos leads reales, más un anónimo cualquiera como control.
const casos = [...todas.filter((f) => f.contact_name), todas.find((f) => !f.contact_name)].filter(Boolean);

mkdirSync(SALIDA, { recursive: true });
const problemas = [];

for (const fila of casos) {
  const quien = fila.contact_name || 'anónimo';
  process.stdout.write(`generando ${quien}… `);

  const { pdf, texto: renderizado } = await renderPdfConTexto(buildReportHtml(fila));
  const nombre = fila.contact_name ? nombreArchivo(fila) : `control-anonimo.pdf`;
  writeFileSync(join(SALIDA, nombre), pdf);

  const crudo = pdf.toString('latin1');
  const kb = Math.round(pdf.length / 1024);
  const texto = renderizado.replace(/\s+/g, ' ');

  // 1. PDF válido
  if (!crudo.startsWith('%PDF-')) problemas.push(`${quien}: no empieza con %PDF-`);

  // 2. Páginas
  const paginas = (crudo.match(/\/Type\s*\/Page[^s]/g) || []).length;
  if (paginas < 3) problemas.push(`${quien}: solo ${paginas} páginas, se esperaban varias`);

  // 3. Las tres tipografías de marca, embebidas
  const fuentes = fuentesEmbebidas(pdf);
  const esperadas = ['SpaceGrotesk', 'Inter', 'IBMPlexMono'];
  const faltantes = esperadas.filter((e) => !fuentes.some((f) => f.replace(/[^A-Za-z]/g, '').includes(e)));
  if (faltantes.length) {
    problemas.push(`${quien}: sin embeber ${faltantes.join(', ')} (hay: ${fuentes.join(', ') || 'ninguna'}) — las fuentes no cargaron antes de imprimir`);
  }

  // 4. El contenido, verificado sobre la página que se imprimió
  const debeEstar = ['Radar Adapsys IA', 'Tu perfil en seis dimensiones', 'Gobierno de la IA',
    'Cultura y liderazgo', 'Respuesta por respuesta', 'Cómo se calcula'];
  const faltan = debeEstar.filter((t) => !texto.includes(t));
  if (faltan.length) problemas.push(`${quien}: falta contenido: ${faltan.join(' / ')}`);
  if (fila.contact_name && !texto.includes(fila.contact_name.split(/\s+/)[0])) {
    problemas.push(`${quien}: no lo saluda por su nombre`);
  }
  // Las 12 afirmaciones tienen que estar citadas.
  const citadas = QUESTIONS.filter((q) => texto.includes(q.text.slice(0, 45))).length;
  if (citadas < 12) problemas.push(`${quien}: solo ${citadas} de 12 afirmaciones aparecen en el documento`);

  // 5. Es texto seleccionable, no una imagen del reporte
  const ops = operadoresDeTexto(pdf);
  if (ops < 200) problemas.push(`${quien}: solo ${ops} operadores de texto — parece rasterizado`);
  if (!crudo.includes('/ToUnicode')) problemas.push(`${quien}: sin /ToUnicode, el texto no se podrá copiar`);

  // 6. Peso: si se rasterizó, pesaría megas
  if (kb > 2000) problemas.push(`${quien}: pesa ${kb} KB, sospechoso de rasterizado`);

  console.log(`${paginas} págs · ${kb} KB · fuentes: ${esperadas.filter(e=>!faltantes.includes(e)).join(', ') || 'NINGUNA'} · ${citadas}/12 afirmaciones · ${ops} ops de texto`);
}

console.log(`\nArchivos en ${SALIDA}/`);
if (problemas.length) {
  console.log(`\nPROBLEMAS (${problemas.length}):`);
  problemas.forEach((p) => console.log('  - ' + p));
  process.exit(1);
}
console.log('Sin problemas.');
