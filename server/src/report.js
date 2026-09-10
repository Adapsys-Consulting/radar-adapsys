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
 *
 * El documento se emite en español o en inglés. Este archivo no contiene copy:
 * toda palabra sale del diccionario de i18n/ que recibe por parámetro, y de
 * content.js solo toma estructura. Si estás agregando una frase, va en los DOS
 * diccionarios — test/i18n.test.js falla si queda en uno solo.
 */

/* De content.js sale solo la ESTRUCTURA —el orden de las dimensiones y el mapeo
   pregunta->dimensión—, nunca el texto. Las palabras salen del diccionario del
   idioma que se esté renderizando. Esa separación es la que hace imposible que
   una traducción mueva un puntaje: computeResult() también lee content.js. */
import { DIMENSIONS, QUESTIONS } from './content.js';
import { IDIOMA_POR_DEFECTO, diccionario, resolverIdioma } from './i18n/index.js';
import { computeResult } from './scoring.js';

const CONTACT_EMAIL = 'metrics@adapsysgroup.com';

/* ---------- Análisis ---------- */

/**
 * Deriva todo lo que el reporte necesita desde las respuestas crudas.
 * Se recalcula con computeResult() en vez de leer las columnas derivadas de la
 * base, para que el reporte sea internamente consistente pase lo que pase.
 */
export function analizar(fila, copy = diccionario(IDIOMA_POR_DEFECTO)) {
  const respuestas = fila.answers || {};
  const resultado = computeResult(respuestas);

  const perfil = DIMENSIONS.map((d) => {
    const puntaje = resultado.dimTotals[d.key] / 2; // 2 preguntas -> escala 1-5
    return {
      key: d.key,
      label: copy.dimensiones[d.key],
      intro: copy.intros[d.key],
      puntaje,
      nivel: copy.nombreDeNivel(puntaje),
      preguntas: QUESTIONS.filter((q) => q.dim === d.key).map((q) => {
        const valor = Number(respuestas[q.id]) || 0;
        return { id: q.id, texto: copy.preguntas[q.id], valor, etiqueta: copy.escala[valor - 1] || '—' };
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

/* El formato de número, la conjunción de las listas y la fecha larga son parte
   del idioma, no de este archivo: viven en copy.fmt. Acá solo queda el
   escapado, que es igual en todos los idiomas. */

/** Los labels de un grupo de dimensiones, listados y escapados para HTML. */
const nombresDe = (copy, dims) => esc(copy.fmt.listar(dims.map((p) => p.label)));

/* ---------- Piezas visuales ---------- */

/** Dot-plot: una fila por dimensión sobre un eje compartido 1–5. */
function dotPlot(analisis, copy) {
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
        <div class="dp-valor"><b>${copy.fmt.num(p.puntaje)}</b><span>${esc(p.nivel)}</span></div>
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
        <span class="k-promedio"></span> ${copy.perfil.promedio(copy.fmt.num(analisis.promedio))}
      </div>
    </div>`;
}

/** La grilla 5×3 que la persona ya vio en pantalla, como cierre. */
function grilla(level, energyKey, copy) {
  /* Las claves de energía y el orden de los escalones son estructura, no copy:
     definen qué celda se ilumina. Solo las etiquetas cambian de idioma. */
  const energias = ['survive', 'transit', 'impulse'];
  const etiquetas = copy.contexto.etiquetasEnergia;
  const escalones = [5, 4, 3, 2, 1];

  const celdas = escalones
    .map(
      (lv) =>
        `<div class="g-fila">${energias
          .map((ek) => {
            const aqui = lv === level && ek === energyKey;
            return `<div class="g-celda ${aqui ? 'aqui' : ''}">${
              aqui ? `<span>${esc(copy.contexto.aqui)}</span>` : ''
            }</div>`;
          })
          .join('')}</div>`
    )
    .join('');

  return `
    <div class="grilla">
      <div class="g-cab">${etiquetas.map((l) => `<span>${esc(l)}</span>`).join('')}</div>
      <div class="g-cuerpo">
        <div class="g-labels">${escalones.map((lv) => `<div>${esc(copy.niveles[lv].name)}</div>`).join('')}</div>
        <div class="g-celdas">${celdas}</div>
      </div>
    </div>`;
}

/** Una dimensión con sus 2 preguntas y lo que marcó en cada una. */
function bloqueDimension(p, variante, copy) {
  return `
    <div class="dim-bloque ${variante}">
      <div class="dim-cab">
        <div class="dim-nombre">${esc(p.label)}</div>
        <div class="dim-puntaje">${copy.dimBloque.puntaje(copy.fmt.num(p.puntaje), esc(p.nivel))}</div>
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

function seccionFriccion(a, copy) {
  const n = copy.fmt.num;

  if (a.perfilPlano) {
    const t = copy.friccion.plano;
    return `
      <section>
        <h2>${esc(t.h2)}</h2>
        <p class="cuerpo">${t.p1(n(a.perfil[0].puntaje))}</p>
        <p class="cuerpo">${t.p2}</p>
      </section>`;
  }

  const nombres = nombresDe(copy, a.masBajas);

  // 4 o 5 dimensiones empatadas abajo. Imprimir cinco bloques con sus cinco
  // párrafos de cuello de botella sería un muro de texto que además entierra la
  // señal: cuando casi todo está al mismo nivel, lo que informa es lo que se
  // despega, no la lista de lo que no.
  if (a.casiParejo) {
    const t = copy.friccion.casiParejo;
    const alta = a.masAltas[0];
    const bajas = a.preguntasMasBajas;
    return `
      <section>
        <h2>${esc(t.h2)}</h2>
        <p class="cuerpo">${t.p1(a.masBajas.length, n(a.masBajas[0].puntaje), nombres)}</p>
        <p class="cuerpo">${t.p2(esc(alta.label), n(alta.puntaje))}</p>
        <p class="cuerpo">${t.p3(bajas.length, bajas[0].valor)}</p>
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

  const t = copy.friccion.normal;
  const varias = a.masBajas.length > 1;
  return `
    <section>
      <h2>${esc(t.h2)}</h2>
      <p class="cuerpo">${
        varias
          ? t.varias(a.masBajas.length, n(a.masBajas[0].puntaje), nombres)
          : t.una(nombres, n(a.masBajas[0].puntaje))
      }</p>
      ${a.masBajas
        .map(
          (p) => `
        ${bloqueDimension(p, 'friccion', copy)}
        <p class="cuerpo lectura">${esc(t.lectura(copy.cuellos[p.key]))}</p>`
        )
        .join('')}
    </section>`;
}

function seccionFortaleza(a, copy) {
  if (a.perfilPlano) return '';

  const t = copy.fortaleza;
  const n = copy.fmt.num;
  const nombres = nombresDe(copy, a.masAltas);
  const varias = a.masAltas.length > 1;

  // Con 4 o más empatadas arriba pasa lo mismo que abajo: la lista deja de
  // informar. Se nombran sin desplegar un bloque por cada una.
  const intro = a.casiParejo
    ? t.casiParejo(nombres)
    : varias
      ? t.varias(nombres, n(a.masAltas[0].puntaje))
      : t.una(nombres, n(a.masAltas[0].puntaje));

  return `
    <section>
      <h2>${esc(t.h2)}</h2>
      <p class="cuerpo">${intro}</p>
      ${a.masAltas.length <= 3 ? a.masAltas.map((p) => bloqueDimension(p, 'fortaleza', copy)).join('') : ''}
    </section>`;
}

function seccionDetalle(a, copy) {
  const t = copy.detalle;
  return `
    <section>
      <h2>${esc(t.h2)}</h2>
      <p class="cuerpo">${esc(t.cuerpo)}</p>
      ${t.nota ? `<p class="cuerpo lectura">${esc(t.nota)}</p>` : ''}
      ${a.perfil.map((p) => bloqueDimension(p, '', copy)).join('')}
    </section>`;
}

function seccionBarrera(fila, copy) {
  /* Lo que la persona escribió va tal cual, en el idioma en que lo escribió.
     Traducirle sus propias palabras sería ponerle en la boca algo que no dijo. */
  const texto = (fila.barrier || '').trim();
  if (!texto) return '';
  return `
    <section>
      <h2>${esc(copy.barrera.h2)}</h2>
      <p class="cuerpo">${esc(copy.barrera.cuerpo)}</p>
      <blockquote>${esc(texto)}</blockquote>
    </section>`;
}

function seccionContexto(a, copy) {
  const t = copy.contexto;
  const nivel = copy.niveles[a.resultado.level];
  const energia = copy.energias[a.resultado.energyKey];
  return `
    <section>
      <h2>${esc(t.h2)}</h2>
      <p class="cuerpo">${esc(t.cuerpo)}</p>
      <div class="badges">
        <span class="badge nivel">${esc(t.badgeNivel(nivel.name))}</span>
        <span class="badge energia-${esc(a.resultado.energyKey)}">${esc(energia.name)}</span>
      </div>
      ${grilla(a.resultado.level, a.resultado.energyKey, copy)}
      <p class="cuerpo">${t.nivelLinea(esc(nivel.name), esc(nivel.quote), esc(nivel.text))}</p>
      <p class="cuerpo">${t.energiaLinea(esc(energia.name), esc(energia.text))}</p>
      <ul class="vinetas">${energia.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
    </section>`;
}

/* ---------- Documento ---------- */

export function buildReportHtml(fila, lang = IDIOMA_POR_DEFECTO) {
  const codigo = resolverIdioma(lang);
  const copy = diccionario(codigo);
  const a = analizar(fila, copy);
  const n = copy.fmt.num;

  const nombre = (fila.contact_name || '').trim();
  const empresa = (fila.contact_company || '').trim();
  const primerNombre = nombre ? nombre.split(/\s+/)[0] : '';
  const fecha = copy.fmt.fecha(fila.created_at);

  const bajas = nombresDe(copy, a.masBajas);
  const altas = nombresDe(copy, a.masAltas);

  /* Los enlaces del documento arrastran el idioma actual. Sin esto, la página
     en inglés ofrecería un PDF en español. El español no lleva sufijo: es el
     default, y su URL sigue siendo la que ya está circulando por correo. */
  const ruta = `/reporte/${encodeURIComponent(fila.id)}`;
  const conIdioma = (base, cod) => (cod === IDIOMA_POR_DEFECTO ? base : `${base}?lang=${cod}`);
  const otroIdioma = copy.doc.otroIdioma;

  // Con 4 o 5 dimensiones empatadas abajo, llamarlas "tu mayor fricción"
  // contradiría a la sección siguiente, que dice —correctamente— que señalar un
  // cuello de botella sería arbitrario. Acá el titular es lo que se despega.
  let lectura;
  if (a.perfilPlano) {
    lectura = copy.perfil.lectura.plano(n(a.perfil[0].puntaje));
  } else if (a.casiParejo) {
    lectura = copy.perfil.lectura.casiParejo(altas, a.masBajas.length);
  } else {
    lectura = copy.perfil.lectura.normal(altas, bajas);
  }

  return `<!DOCTYPE html>
<html lang="${esc(copy.htmlLang)}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="robots" content="noindex, nofollow" />
<title>${esc(copy.doc.titulo(empresa))}</title>
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
  .acciones-doc{display:flex; justify-content:flex-end; gap:8px; margin-bottom:14px;}
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
  <div class="marca"><span class="punto"></span> ${esc(copy.doc.marca)}</div>

  <div class="acciones-doc no-print">
    <a class="btn-pdf" href="${esc(conIdioma(ruta, otroIdioma.codigo))}">${esc(otroIdioma.etiqueta)}</a>
    <a class="btn-pdf" href="${esc(conIdioma(ruta + '/pdf', codigo))}">${esc(copy.doc.btnPdf)}</a>
  </div>

  <div class="portada">
    <div class="kicker">${esc(copy.doc.kicker)}</div>
    <h1>${esc(copy.doc.h1(primerNombre))}</h1>
    <p class="quien">${[nombre, empresa].filter(Boolean).map(esc).join(' · ')}${
      (nombre || empresa) && fecha ? ' · ' : ''
    }${fecha ? esc(copy.doc.fechaLinea(fecha)) : ''}</p>
  </div>

  <section>
    <h2>${esc(copy.perfil.h2)}</h2>
    <p class="cuerpo">${esc(copy.perfil.cuerpo)}</p>
    ${dotPlot(a, copy)}
    <p class="cuerpo lectura">${lectura}</p>
  </section>

  ${seccionFriccion(a, copy)}
  ${seccionFortaleza(a, copy)}
  ${seccionBarrera(fila, copy)}
  ${seccionDetalle(a, copy)}
  ${seccionContexto(a, copy)}

  <section class="cierre">
    <h2>${esc(copy.cierre.h2)}</h2>
    <p class="cuerpo">${copy.cierre.cuerpo(
      `<a class="mail" href="mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
        copy.cierre.asunto
      )}">${CONTACT_EMAIL}</a>`
    )}</p>
  </section>

  <p class="pie">${esc(copy.doc.pie)}</p>
</div>
</body>
</html>`;
}
