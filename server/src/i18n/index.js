/**
 * Registro de idiomas del reporte.
 *
 * Sumar un idioma es agregar un archivo acá y en DICCIONARIOS. Lo único que no
 * se puede tocar es de dónde sale el scoring: computeResult() lee content.js,
 * nunca un diccionario, así que ninguna traducción puede mover un puntaje.
 */

import en from './en.js';
import es from './es.js';

/** El idioma del reporte cuando no se pide otro. */
export const IDIOMA_POR_DEFECTO = 'es';

export const DICCIONARIOS = { es, en };

/** Los códigos disponibles, para validar y para construir los links del panel. */
export const IDIOMAS = Object.keys(DICCIONARIOS);

/**
 * Normaliza lo que venga del query string a un código soportado.
 *
 * Acepta 'EN', 'en-AU', 'en_au' y cualquier variante regional, y tolera que
 * Express entregue un arreglo cuando el parámetro viene repetido (?lang=a&lang=b).
 *
 * Un valor no soportado NO es un error: cae al español. Un `lang` mal tipeado
 * no puede esconderle el reporte a quien tiene el enlace correcto — el 404
 * está reservado para el id, que es la credencial.
 */
export function resolverIdioma(valor) {
  const crudo = Array.isArray(valor) ? valor[0] : valor;
  if (typeof crudo !== 'string') return IDIOMA_POR_DEFECTO;

  const base = crudo.trim().toLowerCase().split(/[-_]/)[0];
  return Object.hasOwn(DICCIONARIOS, base) ? base : IDIOMA_POR_DEFECTO;
}

/** El diccionario de un código ya resuelto, o el español si no existe. */
export function diccionario(codigo) {
  return DICCIONARIOS[codigo] || DICCIONARIOS[IDIOMA_POR_DEFECTO];
}
