/**
 * Espejo del contenido del instrumento que vive en index.html.
 *
 * El HTML es estático en Vercel y este servidor está en Railway: no pueden
 * compartir un import. Por eso el contenido está duplicado, y por eso
 * test/content.test.js extrae los objetos reales del index.html y los compara
 * contra estos. Si alguien edita el copy en un lado y no en el otro, la prueba
 * falla — sin ella, el reporte le citaría al cliente una pregunta con distinta
 * redacción de la que efectivamente contestó.
 *
 * Al final del archivo hay copy que NO está en index.html: existe solo para el
 * reporte. Esa parte no se compara con nada.
 */

/* ---------- Espejo de index.html ---------- */

export const DIMENSIONS = [
  { key: 'proposito', label: 'Propósito y convicción' },
  { key: 'valor', label: 'Uso, impacto y modelo de negocio' },
  { key: 'datos', label: 'Datos, sistemas e infraestructura' },
  { key: 'gobierno', label: 'Gobierno de la IA' },
  { key: 'cultura', label: 'Cultura y liderazgo' },
  { key: 'talento', label: 'Talento y capacidades' },
];

export const QUESTIONS = [
  { id: 1, dim: 'proposito', text: 'Existe una visión clara y compartida en la alta dirección sobre para qué estamos adoptando IA.' },
  { id: 2, dim: 'proposito', text: 'Sabemos, con evidencia y no solo intuición, cuáles son los desafíos más críticos que enfrentamos en el camino hacia la IA.' },
  { id: 3, dim: 'valor', text: 'Hemos identificado oportunidades concretas donde la IA generaría valor medible para el negocio, más allá de la eficiencia interna.' },
  { id: 4, dim: 'valor', text: 'Medimos el retorno real de nuestras iniciativas de IA, no solo si se implementaron.' },
  { id: 5, dim: 'datos', text: 'Nuestros datos tienen la calidad, disponibilidad y gobernanza necesarias para alimentar soluciones de IA de forma confiable.' },
  { id: 6, dim: 'datos', text: 'Nuestros sistemas e infraestructura tecnológica están preparados para integrarse con soluciones y agentes de IA.' },
  { id: 7, dim: 'gobierno', text: 'Contamos con un mecanismo formal de gobierno de IA que coordina decisiones y gestiona los riesgos éticos.' },
  { id: 8, dim: 'gobierno', text: 'Tenemos control real sobre lo que nuestras soluciones de IA hacen y deciden, no solo sobre cómo las implementamos.' },
  { id: 9, dim: 'cultura', text: 'La organización está abierta al aprendizaje, la prueba y el error en su relación con la IA.' },
  { id: 10, dim: 'cultura', text: 'Nuestros líderes supervisan de cerca el uso de la IA, sin delegarla por completo ni evitarla por miedo.' },
  { id: 11, dim: 'talento', text: 'Ya hemos rediseñado procesos críticos con IA, y sabemos qué fricciones han surgido en el camino.' },
  { id: 12, dim: 'talento', text: 'Estamos desarrollando activamente las competencias que las personas necesitan para trabajar con IA.' },
];

export const LEVEL_COPY = {
  1: { name: 'Explorador', quote: '"Comenzamos a interesarnos en la IA"', text: 'La organización da sus primeros pasos. Mira con curiosidad el entorno tecnológico y el desarrollo de la IA, pero desde fuera. El cambio aún no es parte de la identidad interna.' },
  2: { name: 'Experimentador', quote: '"Probamos la IA para aprender"', text: 'Se hacen pilotos con IA. Es una etapa de descubrimiento activo, con aprendizaje por ensayo y error. Todavía sin integración estructural.' },
  3: { name: 'Integrador', quote: '"La IA entra en el sistema"', text: 'Comienza la integración de IA en procesos centrales, priorizados en el plan estratégico. Se conectan áreas y la transformación empieza a sentirse.' },
  4: { name: 'Transformador', quote: '"Comenzamos a transformar la organización desde la IA"', text: 'La organización gana agilidad y eficiencia con la IA, mejorando la experiencia de cliente y bajando los costos, lo que la lleva a repensar su modelo operativo.' },
  5: { name: 'Innovador', quote: '"La IA se instala como el motor de innovación"', text: 'La organización utiliza la IA en el día a día para crear, experimentar y anticipar, pasando a ser parte de su identidad.' },
};

export const ENERGY_COPY = {
  survive: {
    name: 'Modo Protección',
    bullets: ['Actividad sin claridad', 'Comportamiento guiado por el miedo', 'Inversión sin ROI visible', 'Riesgo de burnout'],
    text: 'Hay actividad de alto estrés, impulsada por el miedo y la ambigüedad. Tus inversiones en IA probablemente priorizan la herramienta antes que el resultado, generando agotamiento y poca claridad.',
    next: 'El paso que más rinde ahora no es sumar otra herramienta, sino construir convicción real en el Comité Ejecutivo: dimensionar con datos qué está en juego y para qué se está adoptando IA. Sin ese punto de partida, cualquier iniciativa queda expuesta a los primeros roces del cambio.',
  },
  transit: {
    name: 'Modo Tránsito',
    bullets: ['Focos de impulso', 'Sponsorship inconsistente', 'Valor disparejo', 'Riesgo de caer en supervivencia bajo presión'],
    text: 'Tienes focos reales de impulso, pero el sponsorship es inconsistente y el valor es disparejo entre áreas. La organización está haciendo el trabajo, pero los líderes pueden estar atrapados en el "hype" de la IA más que en resultados.',
    next: 'El foco ahora es ampliar el sponsorship: pasar de un grupo pequeño de convencidos a una masa crítica de ejecutivos que respalden las iniciativas de forma consistente, apoyados en un gobierno de IA que dé seguridad y alinee criterios entre áreas.',
  },
  impulse: {
    name: 'Modo Transformación',
    bullets: ['La IA es estratégica', 'El miedo está gestionado', 'La experimentación es disciplinada', 'El valor medible está emergiendo'],
    text: 'Tu organización tiene propósito y dirección estratégica. La IA es un motor estratégico y el miedo está bien gestionado.',
    next: 'El desafío ya no es convencer, sino sostener: seguir desarrollando competencias y una cultura de autonomía, experimentación y datos, evaluando y ajustando el modelo operativo para no perder este impulso frente al próximo obstáculo.',
  },
};

export const BOTTLENECK_COPY = {
  proposito: 'falta una visión compartida y una convicción real desde la alta dirección sobre el para qué de la IA. Sin ese punto de partida, las iniciativas corren el riesgo de quedar como pilotos aislados, sin el sponsorship necesario para sobrevivir a los primeros roces del cambio. Antes de sumar más herramientas, vale la pena invertir tiempo en dimensionar la oportunidad y construir esa convicción en el Comité Ejecutivo.',
  valor: 'faltan oportunidades de negocio concretas y medibles, más allá de la eficiencia interna. Es común confundir actividad con impacto: muchos pilotos, pocos casos de uso con presupuesto, responsables y una forma clara de medir el retorno. El siguiente paso es priorizar un número acotado de iniciativas con un caso de negocio real detrás, no solo con potencial.',
  datos: 'faltan datos, sistemas o infraestructura listos para sostener soluciones de IA de forma confiable. Este es un cuello de botella silencioso: no se nota hasta que un caso de uso prometedor no logra escalar porque los datos no tienen la calidad, disponibilidad o gobernanza necesarias. Vale la pena hacer un inventario honesto de qué tan lista está la base técnica antes de comprometer nuevas iniciativas.',
  gobierno: 'falta un gobierno de IA que dé seguridad y control real sobre lo que la IA hace y decide. Sin eso, las decisiones quedan libradas al criterio individual de cada equipo, lo que genera inconsistencia, riesgo ético y, paradójicamente, más lentitud para escalar. Un gobierno bien diseñado no frena la innovación: la habilita, dando claridad sobre qué se puede decidir en cada nivel.',
  cultura: 'falta una cultura y un liderazgo que den espacio seguro para aprender y experimentar con IA. Cuando el error no se tolera, las personas dejan de intentar cosas nuevas por su cuenta, y toda la iniciativa termina dependiendo de unos pocos convencidos. Cambiar esto empieza por cómo los líderes hablan de sus propios errores con IA, no solo de sus éxitos.',
  talento: 'falta desarrollar las competencias y rediseñar los procesos que la IA requiere para generar valor. Tener acceso a herramientas de IA no es lo mismo que saber usarlas para rediseñar cómo se trabaja; sin ese paso, la IA se queda como un acelerador de tareas individuales, en vez de una palanca real de productividad organizacional.',
};

export const SCALE_LABELS = ['Muy en desacuerdo', 'En desacuerdo', 'Mixto / inconsistente', 'De acuerdo', 'Totalmente de acuerdo'];

/* ---------- Solo para el reporte (no existe en index.html) ---------- */

/** Qué mide cada dimensión, para que el lector entienda qué está viendo. */
export const DIMENSION_INTRO = {
  proposito: 'Si la alta dirección comparte una visión sobre para qué se adopta IA, y si esa visión se apoya en evidencia y no solo en intuición.',
  valor: 'Si existen oportunidades de negocio concretas más allá de la eficiencia interna, y si se mide el retorno real y no solo la implementación.',
  datos: 'Si los datos tienen la calidad y gobernanza necesarias, y si los sistemas están preparados para integrarse con soluciones y agentes de IA.',
  gobierno: 'Si hay un mecanismo formal que coordine decisiones y gestione riesgos, y si existe control real sobre lo que la IA hace y decide.',
  cultura: 'Si la organización deja espacio para aprender y equivocarse, y si los líderes supervisan la IA sin delegarla por completo ni evitarla.',
  talento: 'Si ya se rediseñaron procesos críticos con IA, y si se están desarrollando activamente las competencias que ese trabajo exige.',
};

/**
 * Nombre del nivel de la escalera Adapsys para un puntaje de dimensión (1–5).
 * Usa la misma regla que el nivel global en computeResult(), de modo que el
 * vocabulario del reporte sea coherente con el que la persona ya vio.
 */
export function nombreDeNivel(puntaje) {
  return LEVEL_COPY[Math.max(1, Math.min(5, Math.round(puntaje)))].name;
}
