/**
 * Espejo EXACTO de computeResult() en index.html.
 *
 * El servidor nunca confía en el resultado que manda el cliente: lo recalcula
 * desde las respuestas crudas. Para que la base guarde lo mismo que el usuario
 * vio en pantalla, esta función tiene que comportarse idéntico al frontend,
 * incluyendo tres detalles que es fácil romper al reescribir:
 *
 *   1. El orden de DIMENSIONS define el desempate del cuello de botella. El
 *      frontend usa `<` estricto, así que ante empate gana la PRIMERA dimensión
 *      del arreglo. Cambiar el orden cambia resultados.
 *   2. Math.round redondea .5 hacia arriba (avg 2.5 -> nivel 3).
 *   3. Los umbrales de energía se evalúan sobre pct = total/60, con >= .
 *
 * Si tocas el scoring en index.html, tienes que tocar este archivo también.
 * test/scoring.test.js verifica la paridad.
 */

export const DIMENSIONS = [
  { key: 'proposito', label: 'Propósito y convicción' },
  { key: 'valor', label: 'Uso, impacto y modelo de negocio' },
  { key: 'datos', label: 'Datos, sistemas e infraestructura' },
  { key: 'gobierno', label: 'Gobierno de la IA' },
  { key: 'cultura', label: 'Cultura y liderazgo' },
  { key: 'talento', label: 'Talento y capacidades' },
];

/** id de pregunta -> dimensión. Mismo mapeo que QUESTIONS en index.html. */
export const QUESTIONS = [
  { id: 1, dim: 'proposito' },
  { id: 2, dim: 'proposito' },
  { id: 3, dim: 'valor' },
  { id: 4, dim: 'valor' },
  { id: 5, dim: 'datos' },
  { id: 6, dim: 'datos' },
  { id: 7, dim: 'gobierno' },
  { id: 8, dim: 'gobierno' },
  { id: 9, dim: 'cultura' },
  { id: 10, dim: 'cultura' },
  { id: 11, dim: 'talento' },
  { id: 12, dim: 'talento' },
];

export const QUESTION_IDS = QUESTIONS.map((q) => q.id);

/**
 * @param {Record<string|number, number>} answers  { "1": 4, ..., "12": 3 }
 * @returns {{ total:number, avg:number, level:number, energyKey:string,
 *             bottleneckKey:string, dimTotals:Record<string,number> }}
 */
export function computeResult(answers) {
  const dimTotals = {};
  DIMENSIONS.forEach((d) => {
    dimTotals[d.key] = 0;
  });

  let total = 0;
  QUESTIONS.forEach((q) => {
    const v = Number(answers[q.id]) || 0;
    dimTotals[q.dim] += v;
    total += v;
  });

  const avg = total / QUESTIONS.length; // 1-5
  const level = Math.max(1, Math.min(5, Math.round(avg)));
  const pct = total / (QUESTIONS.length * 5); // 0-1

  let energyKey = 'survive';
  if (pct >= 0.8) energyKey = 'impulse';
  else if (pct >= 0.56) energyKey = 'transit';

  // `<` estricto: ante empate gana la primera dimensión del arreglo.
  let bottleneckKey = DIMENSIONS[0].key;
  let min = Infinity;
  DIMENSIONS.forEach((d) => {
    if (dimTotals[d.key] < min) {
      min = dimTotals[d.key];
      bottleneckKey = d.key;
    }
  });

  return { total, avg, level, energyKey, bottleneckKey, dimTotals };
}
