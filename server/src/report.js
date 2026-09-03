/**
 * Reporte individual de resultados.
 *
 * Se estructura alrededor del perfil por dimensión, no del nivel y la energía.
 * La razón está en los datos: de las primeras 15 respuestas reales, 11 (73 %)
 * cayeron en la misma celda "Nivel 3 / Tránsito" —consecuencia de que ambos
 * ejes derivan del mismo promedio— mientras que las 15 tuvieron un perfil de
 * seis dimensiones distinto. Un reporte encabezado por el nivel le entregaría
 * a 11 personas el mismo texto; encabezado por el perfil, cada una recibe algo
 * que es suyo.
 */

import {
  BOTTLENECK_COPY,
  DIMENSION_INTRO,
  DIMENSIONS,
  ENERGY_COPY,
  LEVEL_COPY,
  QUESTIONS,
  SCALE_LABELS,
  nombreDeNivel,
} from './content.js';
import { computeResult } from './scoring.js';

const CONTACT_EMAIL = 'metrics@adapsysgroup.com';

/* ---------- Análisis ---------- */

/**
 * Deriva todo lo que el reporte necesita desde las respuestas crudas.
 * Se recalcula con computeResult() en vez de leer las columnas derivadas de la
 * base, para que el reporte sea internamente consistente pase lo que pase.
 */
export function analizar(fila) {
  const respuestas = fila.answers || {};
  const resultado = computeResult(respuestas);

  const perfil = DIMENSIONS.map((d) => {
    const puntaje = resultado.dimTotals[d.key] / 2; // 2 preguntas -> escala 1-5
    return {
      key: d.key,
      label: d.label,
      intro: DIMENSION_INTRO[d.key],
      puntaje,
      nivel: nombreDeNivel(puntaje),
      preguntas: QUESTIONS.filter((q) => q.dim === d.key).map((q) => {
        const valor = Number(respuestas[q.id]) || 0;
        return { id: q.id, texto: q.text, valor, etiqueta: SCALE_LABELS[valor - 1] || '—' };
      }),
    };
  });

  const puntajes = perfil.map((p) => p.puntaje);
  const min = Math.min(...puntajes);
  const max = Math.max(...puntajes);
  const masBajas = perfil.filter((p) => p.puntaje === min);
  const masAltas = perfil.filter((p) => p.puntaje === max);

  // La afirmación puntual con la que menos se identificó. Cuando el perfil por
  // dimensión no discrimina, esto sigue teniendo señal.
  const todas = perfil.flatMap((p) => p.preguntas.map((q) => ({ ...q, dim: p.label })));
  const minPregunta = Math.min(...todas.map((q) => q.valor));

  return {
    perfil,
    promedio: resultado.avg,
    masBajas,
    masAltas,
    preguntasMasBajas: todas.filter((q) => q.valor === minPregunta),
    // Si las seis empatan no hay cuello de botella que reportar: afirmar uno
    // sería inventarlo, porque computeResult() devuelve la primera del arreglo
    // por desempate y no porque destaque.
    perfilPlano: min === max,
    // Y si empatan 4 o 5, el titular tampoco es "tienes cinco cuellos de
    // botella": es que el perfil es casi parejo y lo que tiene señal es lo que
    // se despega. Pasa de verdad — 2 de las primeras 15 respuestas reales.
    casiParejo: !(min === max) && masBajas.length >= 4,
    resultado,
  };
}

/* ---------- Utilidades de texto ---------- */

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

/** ["A"] -> "A" | ["A","B"] -> "A y B" | ["A","B","C"] -> "A, B y C" */
export function listar(nombres) {
  if (nombres.length <= 1) return nombres[0] || '';
  return nombres.slice(0, -1).join(', ') + ' y ' + nombres[nombres.length - 1];
}

/** 3 -> "3" ; 3.5 -> "3,5" (coma decimal, como se escribe en español) */
const num = (n) => String(Number(n).toFixed(1)).replace(/\.0$/, '').replace('.', ',');

function fechaLarga(valor) {
  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('es-CL', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Santiago',
  }).format(d);
}

/* ---------- Piezas visuales ---------- */

/** Dot-plot: una fila por dimensión sobre un eje compartido 1–5. */
function dotPlot(analisis) {
  const pos = (v) => ((v - 1) / 4) * 100; // 1..5 -> 0..100 %

  const filas = analisis.perfil
    .map((p) => {
      let tono = 'medio';
      if (!analisis.perfilPlano) {
        if (analisis.masAltas.includes(p)) tono = 'alto';
        else if (analisis.masBajas.includes(p)) tono = 'bajo';
      }
      return `
      <div class="dp-fila">
        <div class="dp-label">${esc(p.label)}</div>
        <div class="dp-eje">
          <div class="dp-linea"></div>
          ${[1, 2, 3, 4, 5].map((t) => `<span class="dp-tick" style="left:${pos(t)}%"></span>`).join('')}
          <span class="dp-promedio" style="left:${pos(analisis.promedio)}%"></span>
          <span class="dp-punto ${tono}" style="left:${pos(p.puntaje)}%"></span>
        </div>
        <div class="dp-valor"><b>${num(p.puntaje)}</b><span>${esc(p.nivel)}</span></div>
      </div>`;
    })
    .join('');

  return `
    <div class="dotplot">
      <div class="dp-cab"><div></div><div class="dp-escala">${[1, 2, 3, 4, 5]
        .map((t) => `<span style="left:${pos(t)}%">${t}</span>`)
        .join('')}</div><div></div></div>
      ${filas}
      <div class="dp-pie">
        <span class="k-promedio"></span> Tu promedio general: <b>${num(analisis.promedio)}</b>
      </div>
    </div>`;
}

/** La grilla 5×3 que la persona ya vio en pantalla, como cierre. */
function grilla(level, energyKey) {
  const energias = ['survive', 'transit', 'impulse'];
  const etiquetas = ['Protección', 'Tránsito', 'Transformación'];
  const niveles = [5, 4, 3, 2, 1];

  const celdas = niveles
    .map(
      (lv) =>
        `<div class="g-fila">${energias
          .map((ek) => {
            const aqui = lv === level && ek === energyKey;
            return `<div class="g-celda ${aqui ? 'aqui' : ''}">${aqui ? '<span>AQUÍ</span>' : ''}</div>`;
          })
          .join('')}</div>`
    )
    .join('');

  return `
    <div class="grilla">
      <div class="g-cab">${etiquetas.map((l) => `<span>${l}</span>`).join('')}</div>
      <div class="g-cuerpo">
        <div class="g-labels">${niveles.map((lv) => `<div>${esc(LEVEL_COPY[lv].name)}</div>`).join('')}</div>
        <div class="g-celdas">${celdas}</div>
      </div>
    </div>`;
}

/** Una dimensión con sus 2 preguntas y lo que marcó en cada una. */
function bloqueDimension(p, variante) {
  return `
    <div class="dim-bloque ${variante}">
      <div class="dim-cab">
        <div class="dim-nombre">${esc(p.label)}</div>
        <div class="dim-puntaje">${num(p.puntaje)} / 5 · ${esc(p.nivel)}</div>
      </div>
      <p class="dim-intro">${esc(p.intro)}</p>
      ${p.preguntas
        .map(
          (q) => `
        <div class="pregunta">
          <div class="p-texto">${esc(q.texto)}</div>
          <div class="p-valor"><b>${q.valor}</b> · ${esc(q.etiqueta)}</div>
        </div>`
        )
        .join('')}
    </div>`;
}

/* ---------- Secciones ---------- */

function seccionFriccion(a) {
  if (a.perfilPlano) {
    return `
      <section>
        <h2>Tu perfil es parejo</h2>
        <p class="cuerpo">Las seis dimensiones quedaron exactamente en el mismo punto
        (<b>${num(a.perfil[0].puntaje)} de 5</b>). No hay una que se despegue hacia arriba ni hacia abajo, así
        que este diagnóstico <b>no identifica un cuello de botella</b>: señalar uno sería arbitrario.</p>
        <p class="cuerpo">Un perfil así suele significar una de dos cosas, y distinguirlas importa: puede que la
        organización avance de forma genuinamente pareja, o puede que las respuestas se hayan quedado en el punto
        medio porque no había suficiente información para diferenciar. Vale la pena contrastarlo con otras
        personas de la organización antes de sacar conclusiones.</p>
      </section>`;
  }

  const nombres = listar(a.masBajas.map((p) => p.label));

  // 4 o 5 dimensiones empatadas abajo. Imprimir cinco bloques con sus cinco
  // párrafos de cuello de botella sería un muro de texto que además entierra la
  // señal: cuando casi todo está al mismo nivel, lo que informa es lo que se
  // despega, no la lista de lo que no.
  if (a.casiParejo) {
    const alta = a.masAltas[0];
    const bajas = a.preguntasMasBajas;
    return `
      <section>
        <h2>Tu perfil es casi parejo</h2>
        <p class="cuerpo"><b>${a.masBajas.length} de las 6 dimensiones</b> quedaron exactamente en el mismo
        punto (${num(a.masBajas[0].puntaje)} de 5): ${esc(nombres)}. Con un perfil así,
        <b>señalar un cuello de botella sería arbitrario</b>: ninguna se despega de las otras.</p>
        <p class="cuerpo">Lo que sí se distingue es <b>${esc(alta.label)}</b>, con ${num(alta.puntaje)} de 5.
        Ese contraste es la información útil acá: el resto del sistema avanza parejo y esa dimensión va por
        delante.</p>
        <p class="cuerpo">A nivel de afirmación puntual, donde más bajo marcaste fue
        ${bajas.length > 1 ? 'en estas' : 'en esta'} (${bajas[0].valor} de 5):</p>
        ${bajas
          .map(
            (q) => `
          <div class="pregunta destacada">
            <div class="p-texto">${esc(q.texto)}</div>
            <div class="p-valor"><b>${q.valor}</b> · ${esc(q.etiqueta)}</div>
          </div>`
          )
          .join('')}
      </section>`;
  }

  const varias = a.masBajas.length > 1;
  return `
    <section>
      <h2>Dónde está tu mayor fricción</h2>
      <p class="cuerpo">${
        varias
          ? `Hay <b>${a.masBajas.length} dimensiones empatadas</b> en tu punto más bajo (${num(a.masBajas[0].puntaje)} de 5): <b>${esc(nombres)}</b>. Ninguna es "la" barrera por sí sola.`
          : `Tu punto más bajo está en <b>${esc(nombres)}</b>, con ${num(a.masBajas[0].puntaje)} de 5.`
      }</p>
      ${a.masBajas
        .map(
          (p) => `
        ${bloqueDimension(p, 'friccion')}
        <p class="cuerpo lectura">Hoy, ${esc(BOTTLENECK_COPY[p.key])}</p>`
        )
        .join('')}
    </section>`;
}

function seccionFortaleza(a) {
  if (a.perfilPlano) return '';

  const nombres = listar(a.masAltas.map((p) => p.label));
  const varias = a.masAltas.length > 1;

  // Con 4 o más empatadas arriba pasa lo mismo que abajo: la lista deja de
  // informar. Se nombran sin desplegar un bloque por cada una.
  const intro = a.casiParejo
    ? `Estas son las dos afirmaciones detrás de <b>${esc(nombres)}</b>, la dimensión que se despega en tu perfil.`
    : varias
      ? `<b>${esc(nombres)}</b> comparten tu puntaje más alto (${num(a.masAltas[0].puntaje)} de 5). Es desde donde conviene apalancar lo que venga después.`
      : `<b>${esc(nombres)}</b> es tu dimensión más fuerte, con ${num(a.masAltas[0].puntaje)} de 5. Es desde donde conviene apalancar lo que venga después.`;

  return `
    <section>
      <h2>Dónde tienes terreno ganado</h2>
      <p class="cuerpo">${intro}</p>
      ${a.masAltas.length <= 3 ? a.masAltas.map((p) => bloqueDimension(p, 'fortaleza')).join('') : ''}
    </section>`;
}

function seccionDetalle(a) {
  return `
    <section>
      <h2>Respuesta por respuesta</h2>
      <p class="cuerpo">Las doce afirmaciones que contestaste, agrupadas por dimensión, con lo que marcaste en
      cada una. Es la materia prima de todo lo anterior.</p>
      ${a.perfil.map((p) => bloqueDimension(p, '')).join('')}
    </section>`;
}

function seccionBarrera(fila) {
  const texto = (fila.barrier || '').trim();
  if (!texto) return '';
  return `
    <section>
      <h2>Tu barrera, en tus palabras</h2>
      <p class="cuerpo">Esto fue lo que escribiste cuando te preguntamos qué te impide avanzar hoy:</p>
      <blockquote>${esc(texto)}</blockquote>
    </section>`;
}

function seccionContexto(a) {
  const nivel = LEVEL_COPY[a.resultado.level];
  const energia = ENERGY_COPY[a.resultado.energyKey];
  return `
    <section>
      <h2>El contexto general</h2>
      <p class="cuerpo">Además del detalle por dimensión, el radar ubica a tu organización en dos ejes: cuánto ha
      avanzado en su adopción de IA, y con qué energía lo está haciendo. Es la lectura que viste en pantalla.</p>
      <div class="badges">
        <span class="badge nivel">Nivel: ${esc(nivel.name)}</span>
        <span class="badge energia-${esc(a.resultado.energyKey)}">${esc(energia.name)}</span>
      </div>
      ${grilla(a.resultado.level, a.resultado.energyKey)}
      <p class="cuerpo"><b>${esc(nivel.name)}</b> — ${esc(nivel.quote)}. ${esc(nivel.text)}</p>
      <p class="cuerpo"><b>${esc(energia.name)}</b> — ${esc(energia.text)}</p>
      <ul class="vinetas">${energia.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
    </section>`;
}

function seccionMetodologia(a) {
  return `
    <section class="metodologia">
      <h2>Cómo se calcula</h2>
      <p class="cuerpo">El instrumento son 12 afirmaciones en una escala de 1 (muy en desacuerdo) a 5 (totalmente
      de acuerdo), repartidas en 6 dimensiones de 2 preguntas cada una. El puntaje de cada dimensión es el
      promedio de sus dos preguntas, en la misma escala de 1 a 5. El nivel de madurez y el modo de energía se
      derivan del puntaje global; el detalle fino está en el perfil por dimensión, que es donde se ve qué avanza
      y qué no dentro de una misma organización.</p>
      <p class="cuerpo">Este radar es la versión pública y corta, construida a partir del modelo de madurez
      organizacional de Adapsys, el marco de energía de cambio de Kotter y las dimensiones de preparación para
      una organización agéntica. El instrumento completo de 40 preguntas es el que usamos en diagnósticos 1:1, y
      es el que permite bajar de la fotografía general a la conversación por área.</p>
      <p class="cuerpo aviso">Una precisión honesta: esto refleja la percepción de <b>una sola persona</b> en un
      momento dado. Su mayor valor no es el puntaje en sí, sino contrastarlo con el de otras personas de la
      organización — donde las miradas difieren suele estar la conversación más útil.</p>
    </section>`;
}

/* ---------- Documento ---------- */

export function buildReportHtml(fila) {
  const a = analizar(fila);
  const nombre = (fila.contact_name || '').trim();
  const empresa = (fila.contact_company || '').trim();
  const primerNombre = nombre ? nombre.split(/\s+/)[0] : '';
  const fecha = fechaLarga(fila.created_at);

  const bajas = listar(a.masBajas.map((p) => p.label));
  const altas = listar(a.masAltas.map((p) => p.label));

  // Con 4 o 5 dimensiones empatadas abajo, llamarlas "tu mayor fricción"
  // contradiría a la sección siguiente, que dice —correctamente— que señalar un
  // cuello de botella sería arbitrario. Acá el titular es lo que se despega.
  let lectura;
  if (a.perfilPlano) {
    lectura = `Las seis dimensiones quedaron en el mismo punto: ${num(a.perfil[0].puntaje)} de 5.`;
  } else if (a.casiParejo) {
    lectura = `Lo que se despega es <b>${esc(altas)}</b>. Las otras ${a.masBajas.length} quedaron todas en el mismo punto.`;
  } else {
    lectura = `Tu terreno más firme está en <b>${esc(altas)}</b>. Tu mayor fricción, en <b>${esc(bajas)}</b>.`;
  }

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="robots" content="noindex, nofollow" />
<title>Reporte · Radar Adapsys IA${empresa ? ' · ' + esc(empresa) : ''}</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3ClinearGradient id='p' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23EC1568'/%3E%3Cstop offset='1' stop-color='%237FD4FF'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100' height='100' fill='%230A0F26'/%3E%3Ccircle cx='50' cy='50' r='36.5' fill='none' stroke='%237FD4FF' stroke-opacity='.32' stroke-width='4.5'/%3E%3Ccircle cx='50' cy='50' r='23' fill='url(%23p)'/%3E%3C/svg%3E" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet">
<style>
  :root{
    --bg-deep:#0A0F26; --bg-panel:#121A42; --bg-panel-2:#171F52;
    --magenta:#EC1568; --magenta-soft:#FF6FA0; --teal:#2FE0C4; --sky:#7FD4FF;
    --text:#F2F5FF; --muted:#8D97C4; --border:rgba(255,255,255,0.10);
  }
  *{box-sizing:border-box;}
  html,body{margin:0;padding:0;}
  body{
    background:
      radial-gradient(circle at 88% -4%, rgba(127,212,255,0.14), transparent 42%),
      radial-gradient(circle at 104% 10%, rgba(236,21,104,0.17), transparent 40%),
      var(--bg-deep);
    color:var(--text); font-family:'Inter',sans-serif;
    padding:40px 16px 64px; line-height:1.6;
  }
  .doc{max-width:820px; margin:0 auto;}

  .marca{
    display:flex; align-items:center; gap:10px; margin-bottom:26px;
    font-family:'Space Grotesk',sans-serif; font-weight:700; letter-spacing:0.02em;
    font-size:14px; color:var(--muted);
  }
  .marca .punto{width:8px;height:8px;border-radius:50%;background:linear-gradient(135deg,var(--magenta),var(--sky));}

  .portada{
    background:linear-gradient(180deg,var(--bg-panel),var(--bg-panel-2));
    border:1px solid var(--border); border-radius:18px; padding:36px 38px;
    margin-bottom:30px; position:relative; overflow:hidden;
  }
  .portada::before{
    content:""; position:absolute; top:-110px; right:-90px; width:260px; height:260px;
    border-radius:50%; border:1px solid rgba(127,212,255,0.28);
  }
  .kicker{
    font-family:'IBM Plex Mono',monospace; font-size:11px; letter-spacing:0.07em;
    text-transform:uppercase; color:var(--sky); margin-bottom:12px;
  }
  h1{font-family:'Space Grotesk',sans-serif; font-size:32px; line-height:1.2; margin:0 0 10px;}
  .quien{color:var(--muted); font-size:15px; margin:0; position:relative; z-index:1;}

  section{
    background:linear-gradient(180deg,var(--bg-panel),var(--bg-panel-2));
    border:1px solid var(--border); border-radius:18px; padding:30px 34px; margin-bottom:22px;
  }
  h2{font-family:'Space Grotesk',sans-serif; font-size:21px; margin:0 0 14px;}
  .cuerpo{font-size:15px; margin:0 0 14px; color:var(--text);}
  .cuerpo:last-child{margin-bottom:0;}
  .lectura{color:var(--muted); font-size:14px;}
  .aviso{color:var(--muted); font-size:13.5px; border-left:2px solid rgba(127,212,255,.35); padding-left:14px;}

  /* Dot-plot */
  .dotplot{margin:22px 0 6px;}
  .dp-cab, .dp-fila{display:grid; grid-template-columns:190px 1fr 108px; gap:14px; align-items:center;}
  .dp-cab{margin-bottom:6px;}
  .dp-escala{position:relative; height:16px;}
  .dp-escala span{
    position:absolute; transform:translateX(-50%); font-family:'IBM Plex Mono',monospace;
    font-size:10px; color:var(--muted);
  }
  .dp-fila{padding:9px 0; border-top:1px solid rgba(255,255,255,.06);}
  .dp-label{font-size:13.5px; color:var(--muted); line-height:1.3;}
  .dp-eje{position:relative; height:22px;}
  .dp-linea{position:absolute; top:50%; left:0; right:0; height:2px; background:rgba(255,255,255,.07); border-radius:2px;}
  .dp-tick{position:absolute; top:50%; transform:translate(-50%,-50%); width:2px; height:8px; background:rgba(255,255,255,.10);}
  .dp-promedio{position:absolute; top:50%; transform:translate(-50%,-50%); width:1px; height:22px; background:rgba(127,212,255,.45);}
  .dp-punto{
    position:absolute; top:50%; transform:translate(-50%,-50%);
    width:15px; height:15px; border-radius:50%; background:var(--sky);
    box-shadow:0 0 0 4px rgba(127,212,255,.14);
  }
  .dp-punto.alto{background:var(--teal); box-shadow:0 0 0 4px rgba(47,224,196,.16);}
  .dp-punto.bajo{background:var(--magenta); box-shadow:0 0 0 4px rgba(236,21,104,.18);}
  .dp-valor{text-align:right; font-family:'IBM Plex Mono',monospace; font-size:12px; color:var(--muted);}
  .dp-valor b{display:block; font-size:16px; color:var(--text);}
  .dp-pie{
    margin-top:14px; font-size:12px; color:var(--muted);
    display:flex; align-items:center; gap:7px;
  }
  .k-promedio{display:inline-block; width:1px; height:12px; background:rgba(127,212,255,.7);}

  /* Bloque de dimensión */
  .dim-bloque{
    background:rgba(0,0,0,0.22); border:1px solid var(--border);
    border-radius:12px; padding:18px 20px; margin:16px 0;
  }
  .dim-bloque.friccion{border-color:rgba(236,21,104,.32);}
  .dim-bloque.fortaleza{border-color:rgba(47,224,196,.30);}
  .dim-cab{display:flex; justify-content:space-between; align-items:baseline; gap:14px; flex-wrap:wrap;}
  .dim-nombre{font-family:'Space Grotesk',sans-serif; font-weight:600; font-size:16px;}
  .dim-puntaje{font-family:'IBM Plex Mono',monospace; font-size:12px; color:var(--sky); white-space:nowrap;}
  .dim-intro{font-size:13px; color:var(--muted); margin:6px 0 14px; line-height:1.5;}
  .pregunta{
    display:flex; justify-content:space-between; gap:16px; align-items:baseline;
    padding:10px 0; border-top:1px solid rgba(255,255,255,.06); font-size:14px;
  }
  .p-texto{flex:1;}
  .p-valor{
    font-family:'IBM Plex Mono',monospace; font-size:12px; color:var(--muted);
    white-space:nowrap; text-align:right;
  }
  .p-valor b{color:var(--text); font-size:15px;}
  .pregunta.destacada{
    border:1px solid rgba(236,21,104,.32); border-radius:10px;
    background:rgba(0,0,0,.22); padding:14px 18px; margin-bottom:8px;
  }

  blockquote{
    margin:0; padding:18px 22px; border-radius:12px;
    background:rgba(127,212,255,0.07); border-left:3px solid var(--sky);
    font-size:16px; font-style:italic; color:var(--text);
  }

  /* Grilla nivel x energía */
  .badges{display:flex; gap:8px; flex-wrap:wrap; margin:16px 0;}
  .badge{
    font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:13px;
    padding:7px 15px; border-radius:100px;
  }
  .badge.nivel{background:rgba(47,224,196,.14); color:var(--teal); border:1px solid rgba(47,224,196,.35);}
  .badge.energia-survive{background:rgba(236,21,104,.16); color:var(--magenta-soft); border:1px solid rgba(236,21,104,.35);}
  .badge.energia-transit{background:rgba(255,196,64,.14); color:#FFC940; border:1px solid rgba(255,196,64,.35);}
  .badge.energia-impulse{background:rgba(127,212,255,.16); color:var(--sky); border:1px solid rgba(127,212,255,.35);}
  .grilla{margin:18px 0 22px;}
  .g-cab{display:grid; grid-template-columns:repeat(3,1fr); gap:4px; margin-bottom:8px; padding-left:126px;}
  .g-cab span{
    text-align:center; font-family:'IBM Plex Mono',monospace; font-size:10px;
    letter-spacing:.05em; text-transform:uppercase; color:var(--muted);
  }
  .g-cuerpo{display:flex; gap:4px;}
  .g-labels{display:flex; flex-direction:column; gap:4px; width:122px;}
  .g-labels div{
    height:34px; display:flex; align-items:center; justify-content:flex-end;
    font-size:11px; color:var(--muted); font-family:'IBM Plex Mono',monospace;
  }
  .g-celdas{flex:1; display:flex; flex-direction:column; gap:4px;}
  .g-fila{display:grid; grid-template-columns:repeat(3,1fr); gap:4px;}
  .g-celda{
    height:34px; background:rgba(255,255,255,0.04); border:1px solid var(--border);
    border-radius:6px; display:flex; align-items:center; justify-content:center;
  }
  .g-celda.aqui{
    background:linear-gradient(135deg,var(--magenta),var(--sky)); border-color:transparent;
    box-shadow:0 0 0 3px rgba(127,212,255,.18);
  }
  .g-celda.aqui span{font-family:'IBM Plex Mono',monospace; font-size:9px; font-weight:600; color:#fff;}
  .vinetas{margin:8px 0 0; padding:0; list-style:none; display:grid; grid-template-columns:1fr 1fr; gap:6px;}
  .vinetas li{font-size:13.5px; display:flex; gap:7px; color:var(--muted);}
  .vinetas li::before{content:"·"; color:var(--sky); font-weight:700;}

  .cierre{text-align:center;}
  .cierre h2{margin-bottom:10px;}
  .cierre a.mail{color:var(--sky); font-weight:600; text-decoration:none;}
  .cierre a.mail:hover{text-decoration:underline;}
  .pie{color:var(--muted); font-size:12px; text-align:center; margin-top:24px;}

  /* Botón de descarga: fuera del PDF, obviamente. */
  .acciones-doc{display:flex; justify-content:flex-end; margin-bottom:14px;}
  .btn-pdf{
    display:inline-flex; align-items:center; gap:7px; text-decoration:none;
    background:transparent; border:1px solid var(--border); color:var(--muted);
    font-family:'Inter',sans-serif; font-size:13px; padding:8px 16px; border-radius:100px;
    transition:border-color .15s, color .15s;
  }
  .btn-pdf:hover{border-color:var(--sky); color:var(--sky);}

  /* ---------- Impresión y PDF ----------
     El reporte es oscuro y todo su color viene de fondos, que los navegadores no
     imprimen por defecto. Estas reglas hacen dos cosas: forzar que los fondos se
     pinten, y llevar el margen de página a cero, porque el área de margen se
     imprime blanca y dejaría un marco alrededor del contenido en cada hoja.
     El aire vive adentro del documento, no en el margen de la página. */
  @media print{
    @page{ size:A4; margin:0; }

    *{
      -webkit-print-color-adjust:exact !important;
      print-color-adjust:exact !important;
    }

    /* Fondo plano y sólido: los degradados radiales del body se comportan de
       forma impredecible entre páginas. Los acentos de marca siguen vivos en la
       portada, que tiene su propio degradado como fondo de elemento. */
    html, body{
      background:var(--bg-deep) !important;
      padding:0 !important;
      margin:0 !important;
    }
    .doc{
      max-width:none;
      padding:14mm 13mm;
    }

    .no-print{display:none !important;}

    /* Nada se parte por la mitad entre dos hojas. */
    section, .portada, .dim-bloque, .pregunta, blockquote, .dp-fila, .grilla, .kpi{
      break-inside:avoid;
      page-break-inside:avoid;
    }
    h1, h2{ break-after:avoid; page-break-after:avoid; }
    section{ margin-bottom:14px; }

    /* A4 útil son ~184 mm: algo más angosto que en pantalla. */
    body{ font-size:13px; }
    h1{ font-size:27px; }
    h2{ font-size:18px; }
    .cuerpo{ font-size:13px; }
    .dp-cab, .dp-fila{ grid-template-columns:165px 1fr 96px; }
    .dp-label{ font-size:12px; }
    a{ color:var(--sky) !important; }
  }

  @media (max-width:640px){
    section, .portada{padding:22px 18px;}
    h1{font-size:26px;}
    .dp-cab, .dp-fila{grid-template-columns:1fr; gap:4px;}
    .dp-valor{text-align:left;}
    .dp-valor b{display:inline; margin-right:6px;}
    .dp-cab{display:none;}
    .vinetas{grid-template-columns:1fr;}
    .g-cab{padding-left:96px;}
    .g-labels{width:92px;}
    .pregunta{flex-direction:column; gap:4px;}
    .p-valor{text-align:left;}
  }
</style>
</head>
<body>
<div class="doc">
  <div class="marca"><span class="punto"></span> ADAPSYS · Radar Adapsys IA</div>

  <div class="acciones-doc no-print">
    <a class="btn-pdf" href="/reporte/${encodeURIComponent(fila.id)}/pdf">↓ Descargar en PDF</a>
  </div>

  <div class="portada">
    <div class="kicker">Reporte de resultados</div>
    <h1>${primerNombre ? esc(primerNombre) + ', esto' : 'Esto'} es lo que dijeron tus respuestas</h1>
    <p class="quien">${[nombre, empresa].filter(Boolean).map(esc).join(' · ')}${
      (nombre || empresa) && fecha ? ' · ' : ''
    }${fecha ? 'Diagnóstico del ' + esc(fecha) : ''}</p>
  </div>

  <section>
    <h2>Tu perfil en seis dimensiones</h2>
    <p class="cuerpo">El radar mide seis dimensiones por separado. Aquí está tu puntaje en cada una, sobre un
    mismo eje de 1 a 5, para que se vea de una sola mirada qué avanza y qué se queda atrás dentro de tu
    organización.</p>
    ${dotPlot(a)}
    <p class="cuerpo lectura">${lectura}</p>
  </section>

  ${seccionFriccion(a)}
  ${seccionFortaleza(a)}
  ${seccionBarrera(fila)}
  ${seccionDetalle(a)}
  ${seccionContexto(a)}
  ${seccionMetodologia(a)}

  <section class="cierre">
    <h2>¿Conversamos sobre esto?</h2>
    <p class="cuerpo">Si quieres revisar estos resultados con nosotros, o llevar el diagnóstico completo al resto
    de tu equipo, escríbenos a <a class="mail" href="mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
      'Conversemos sobre mi Radar IA'
    )}">${CONTACT_EMAIL}</a>.</p>
  </section>

  <p class="pie">Radar Adapsys IA — construido por Adapsys.</p>
</div>
</body>
</html>`;
}
