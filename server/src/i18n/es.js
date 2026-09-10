/**
 * Diccionario del reporte en español.
 *
 * El contenido del instrumento —dimensiones, preguntas, niveles, energías,
 * cuellos de botella, escala— NO se copia acá: se importa de content.js, que es
 * el espejo verificado de index.html. Una segunda copia del español sería
 * exactamente el problema que content.test.js existe para evitar.
 *
 * Lo que sí vive acá es la prosa del reporte y las reglas gramaticales del
 * idioma. Las frases que dependen de un número o de una lista van como
 * funciones y no como plantillas con placeholders: el plural y la concordancia
 * se resuelven distinto en cada idioma, y solo el idioma sabe cómo.
 *
 * CONVENCIÓN: los valores que estas funciones reciben ya vienen escapados y
 * formateados por report.js. Lo que devuelven es HTML y se interpola crudo, por
 * eso pueden traer <b>. Nunca les pases datos del usuario sin escapar.
 */

import {
  BOTTLENECK_COPY,
  DIMENSIONS,
  DIMENSION_INTRO,
  ENERGY_COPY,
  LEVEL_COPY,
  QUESTIONS,
  SCALE_LABELS,
  nivelDeDimension,
} from '../content.js';

/* Las dimensiones y preguntas llegan como arreglo (su orden importa para el
   scoring) y acá se indexan por clave, que es como el reporte las consulta. */
const dimensiones = Object.fromEntries(DIMENSIONS.map((d) => [d.key, d.label]));
const preguntas = Object.fromEntries(QUESTIONS.map((q) => [q.id, q.text]));

/** 3 -> "3" ; 3.5 -> "3,5" (coma decimal, como se escribe en español) */
const num = (n) => String(Number(n).toFixed(1)).replace(/\.0$/, '').replace('.', ',');

/** ["A"] -> "A" | ["A","B"] -> "A y B" | ["A","B","C"] -> "A, B y C" */
const listar = (nombres) => {
  if (nombres.length <= 1) return nombres[0] || '';
  return nombres.slice(0, -1).join(', ') + ' y ' + nombres[nombres.length - 1];
};

const fecha = (valor) => {
  /* Sin el guard de falsy, `new Date(null)` da la época —una fecha válida— y el
     reporte fecharía el diagnóstico en 1969 en vez de omitir la línea. */
  if (!valor) return '';
  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('es-CL', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Santiago',
  }).format(d);
};

export default {
  codigo: 'es',
  htmlLang: 'es',

  /* ---------- Contenido del instrumento (espejo de index.html) ---------- */
  dimensiones,
  preguntas,
  intros: DIMENSION_INTRO,
  niveles: LEVEL_COPY,
  energias: ENERGY_COPY,
  cuellos: BOTTLENECK_COPY,
  escala: SCALE_LABELS,

  /** Nombre del nivel de la escalera para un puntaje de dimensión (1–5). */
  nombreDeNivel: (puntaje) => LEVEL_COPY[nivelDeDimension(puntaje)].name,

  /* ---------- Formato dependiente del idioma ---------- */
  fmt: { num, listar, fecha },

  /* ---------- Documento ---------- */
  doc: {
    marca: 'ADAPSYS · Radar Adapsys IA',
    /** Prefijo del PDF descargable. Sin acentos: es un nombre de archivo. */
    archivo: 'Radar-Adapsys-IA',
    titulo: (empresa) => 'Reporte · Radar Adapsys IA' + (empresa ? ' · ' + empresa : ''),
    kicker: 'Reporte de resultados',
    btnPdf: '↓ Descargar en PDF',
    otroIdioma: { codigo: 'en', etiqueta: 'View in English' },
    h1: (primerNombre) =>
      primerNombre
        ? `${primerNombre}, esto es lo que dijeron tus respuestas`
        : 'Esto es lo que dijeron tus respuestas',
    fechaLinea: (f) => 'Diagnóstico del ' + f,
    pie: 'Radar Adapsys IA — construido por Adapsys.',
  },

  perfil: {
    h2: 'Tu perfil en seis dimensiones',
    cuerpo:
      'El radar mide seis dimensiones por separado. Aquí está tu puntaje en cada una, sobre un ' +
      'mismo eje de 1 a 5, para que se vea de una sola mirada qué avanza y qué se queda atrás dentro de tu ' +
      'organización.',
    promedio: (n) => `Tu promedio general: <b>${n}</b>`,
    lectura: {
      plano: (puntaje) => `Las seis dimensiones quedaron en el mismo punto: ${puntaje} de 5.`,
      casiParejo: (altas, cuantasBajas) =>
        `Lo que se despega es <b>${altas}</b>. Las otras ${cuantasBajas} quedaron todas en el mismo punto.`,
      normal: (altas, bajas) =>
        `Tu terreno más firme está en <b>${altas}</b>. Tu mayor fricción, en <b>${bajas}</b>.`,
    },
  },

  friccion: {
    plano: {
      h2: 'Tu perfil es parejo',
      p1: (puntaje) =>
        `Las seis dimensiones quedaron exactamente en el mismo punto (<b>${puntaje} de 5</b>). No hay una que ` +
        'se despegue hacia arriba ni hacia abajo, así que este diagnóstico <b>no identifica un cuello de ' +
        'botella</b>: señalar uno sería arbitrario.',
      p2:
        'Un perfil así suele significar una de dos cosas, y distinguirlas importa: puede que la ' +
        'organización avance de forma genuinamente pareja, o puede que las respuestas se hayan quedado en el ' +
        'punto medio porque no había suficiente información para diferenciar. Vale la pena contrastarlo con ' +
        'otras personas de la organización antes de sacar conclusiones.',
    },
    casiParejo: {
      h2: 'Tu perfil es casi parejo',
      p1: (cuantas, puntaje, nombres) =>
        `<b>${cuantas} de las 6 dimensiones</b> quedaron exactamente en el mismo punto (${puntaje} de 5): ` +
        `${nombres}. Con un perfil así, <b>señalar un cuello de botella sería arbitrario</b>: ninguna se ` +
        'despega de las otras.',
      p2: (label, puntaje) =>
        `Lo que sí se distingue es <b>${label}</b>, con ${puntaje} de 5. Ese contraste es la información ` +
        'útil acá: el resto del sistema avanza parejo y esa dimensión va por delante.',
      p3: (cuantas, valor) =>
        `A nivel de afirmación puntual, donde más bajo marcaste fue ${cuantas > 1 ? 'en estas' : 'en esta'} ` +
        `(${valor} de 5):`,
    },
    normal: {
      h2: 'Dónde está tu mayor fricción',
      varias: (cuantas, puntaje, nombres) =>
        `Hay <b>${cuantas} dimensiones empatadas</b> en tu punto más bajo (${puntaje} de 5): <b>${nombres}</b>. ` +
        'Ninguna es "la" barrera por sí sola.',
      una: (nombres, puntaje) => `Tu punto más bajo está en <b>${nombres}</b>, con ${puntaje} de 5.`,
      /** Prefijo del párrafo de cuello de botella, que continúa la frase. */
      lectura: (cuello) => 'Hoy, ' + cuello,
    },
  },

  fortaleza: {
    h2: 'Dónde tienes terreno ganado',
    casiParejo: (nombres) =>
      `Estas son las dos afirmaciones detrás de <b>${nombres}</b>, la dimensión que se despega en tu perfil.`,
    varias: (nombres, puntaje) =>
      `<b>${nombres}</b> comparten tu puntaje más alto (${puntaje} de 5). Es desde donde conviene apalancar ` +
      'lo que venga después.',
    una: (nombres, puntaje) =>
      `<b>${nombres}</b> es tu dimensión más fuerte, con ${puntaje} de 5. Es desde donde conviene apalancar ` +
      'lo que venga después.',
  },

  detalle: {
    h2: 'Respuesta por respuesta',
    cuerpo:
      'Las doce afirmaciones que contestaste, agrupadas por dimensión, con lo que marcaste en ' +
      'cada una. Es la materia prima de todo lo anterior.',
    /* En español la persona leyó estas mismas afirmaciones en pantalla, así que
       no hay nada que advertir. En inglés sí: son una traducción. */
    nota: '',
  },

  barrera: {
    h2: 'Tu barrera, en tus palabras',
    cuerpo: 'Esto fue lo que escribiste cuando te preguntamos qué te impide avanzar hoy:',
  },

  contexto: {
    h2: 'El contexto general',
    cuerpo:
      'Además del detalle por dimensión, el radar ubica a tu organización en dos ejes: cuánto ha ' +
      'avanzado en su adopción de IA, y con qué energía lo está haciendo. Es la lectura que viste en pantalla.',
    badgeNivel: (name) => 'Nivel: ' + name,
    etiquetasEnergia: ['Protección', 'Tránsito', 'Transformación'],
    aqui: 'AQUÍ',
    nivelLinea: (name, quote, text) => `<b>${name}</b> — ${quote}. ${text}`,
    energiaLinea: (name, text) => `<b>${name}</b> — ${text}`,
  },

  cierre: {
    h2: '¿Conversamos sobre esto?',
    cuerpo: (mail) =>
      'Si quieres revisar estos resultados con nosotros, o llevar el diagnóstico completo al resto ' +
      `de tu equipo, escríbenos a ${mail}.`,
    asunto: 'Conversemos sobre mi Radar IA',
  },

  dimBloque: {
    puntaje: (n, nivel) => `${n} / 5 · ${nivel}`,
  },
};
