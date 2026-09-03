/**
 * Generación del PDF del reporte con Chromium.
 *
 * El PDF es oscuro, igual que la pantalla, lo que obliga a dos cosas que en un
 * documento claro no harían falta: `printBackground` (todo el color del reporte
 * viene de fondos) y márgenes de página en cero, porque el área de margen se
 * imprime blanca y dejaría un marco alrededor del contenido en cada hoja. El
 * espacio en blanco vive dentro del documento, en el @media print del reporte.
 */

import { chromium } from 'playwright-core';

/** Tope duro: un PDF que tarda más que esto es un problema, no una demora. */
const TIMEOUT_MS = 45_000;

/**
 * En producción usa el Chromium que trae la imagen de Playwright.
 * En local se puede apuntar a un Chrome ya instalado para iterar el CSS de
 * impresión sin descargar un navegador:
 *   CHROMIUM_PATH="/c/Program Files/Google/Chrome/Application/chrome.exe"
 */
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || undefined;

/**
 * Combinaciones de familia y peso que el reporte usa de verdad.
 *
 * Medido: con `waitUntil: 'load'` las tres familias ya se embeben sin pedirlas,
 * así que esto no arregla un fallo actual. Se deja como seguro barato: pedirlas
 * explícitamente hace la espera determinista en un contenedor más lento o con
 * peor latencia hacia Google Fonts, donde el margen podría no alcanzar. Si
 * alguna vez fallara, el PDF sale con la tipografía de reemplazo sin dar error
 * — por eso scripts/verificar-pdf.mjs revisa las fuentes embebidas.
 */
const FUENTES = [
  '600 16px "Space Grotesk"',
  '700 32px "Space Grotesk"',
  '400 15px "Inter"',
  '500 13px "Inter"',
  '600 15px "Inter"',
  '500 12px "IBM Plex Mono"',
  '600 12px "IBM Plex Mono"',
];

/** Abre una página con el reporte cargado y sus tipografías listas. */
async function conPagina(html, fn) {
  const browser = await chromium.launch({
    executablePath: CHROMIUM_PATH,
    timeout: TIMEOUT_MS,
    args: [
      // El contenedor corre como root; sin esto Chromium se niega a arrancar.
      '--no-sandbox',
      // /dev/shm es diminuto en contenedores y Chromium lo llena y crashea.
      '--disable-dev-shm-usage',
    ],
  });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(TIMEOUT_MS);
    await page.setContent(html, { waitUntil: 'load', timeout: TIMEOUT_MS });

    /* Si las tipografías no llegan se emite el PDF igual —un documento con la
       fuente equivocada sirve más que ningún documento— pero queda en el log. */
    try {
      await page.evaluate(async (combos) => {
        await Promise.all(combos.map((c) => document.fonts.load(c)));
        await document.fonts.ready;
      }, FUENTES);
    } catch (err) {
      console.warn('[pdf] las tipografías no cargaron a tiempo:', err.message);
    }

    return await fn(page);
  } finally {
    await browser.close();
  }
}

const OPCIONES_PDF = {
  format: 'A4',
  printBackground: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
  preferCSSPageSize: true,
};

export async function renderPdf(html) {
  return conPagina(html, (page) => page.pdf(OPCIONES_PDF));
}

/**
 * Igual que renderPdf, pero además devuelve el texto tal como quedó renderizado.
 * Lo usa scripts/verificar-pdf.mjs: comprobar el contenido en el DOM es mucho
 * más fiable que intentar decodificar los streams del PDF, donde el texto va
 * como índices de glifo de una fuente subconjuntada.
 */
export async function renderPdfConTexto(html) {
  return conPagina(html, async (page) => ({
    pdf: await page.pdf(OPCIONES_PDF),
    texto: await page.evaluate(() => document.body.innerText),
  }));
}

/**
 * Nombre de archivo legible a partir de quién contestó.
 * Se quitan acentos y todo lo que no sea alfanumérico: un nombre de archivo con
 * tildes o barras se rompe distinto en cada sistema operativo.
 */
export function nombreArchivo(fila) {
  const limpio = (s) =>
    (s || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // marcas diacriticas
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const partes = ['Radar-Adapsys-IA', limpio(fila.contact_name), limpio(fila.contact_company)].filter(Boolean);
  return partes.join('-').slice(0, 120) + '.pdf';
}
