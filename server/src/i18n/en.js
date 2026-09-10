/**
 * Report dictionary — English (Australian spelling).
 *
 * Unlike es.js, this file takes no TEXT from content.js: it carries its own
 * translation of the instrument. That is deliberate and it is the safety
 * property of the whole design — English never feeds the scoring. computeResult()
 * reads DIMENSIONS and QUESTIONS from content.js only, so a mistranslation here
 * cannot move a score, reorder a dimension or change a bottleneck tie-break.
 *
 * The survey itself (index.html) is Spanish-only. Respondents read the Spanish
 * statements on screen, so the English report quotes them a translation — which
 * is why detalle.nota says so out loud.
 *
 * Keys must match es.js exactly, including function arity. test/i18n.test.js
 * enforces that: it is what catches "translated 11 of the 12 questions" and
 * "added a paragraph in Spanish only".
 *
 * CONVENTION: values arriving as arguments are already escaped and formatted by
 * report.js. What these functions return is HTML, interpolated raw — hence the
 * <b> tags. Never pass unescaped user data in.
 */

/* The ONLY thing this file takes from content.js: the rounding rule that maps a
   dimension score to a ladder step. That is logic, not text — if the two
   languages rounded differently, the same score would read as one level in
   Spanish and another in English. Every word below is this file's own. */
import { nivelDeDimension } from '../content.js';

const dimensiones = {
  proposito: 'Purpose and conviction',
  valor: 'Use, impact and business model',
  datos: 'Data, systems and infrastructure',
  gobierno: 'AI governance',
  cultura: 'Culture and leadership',
  talento: 'Talent and capability',
};

const preguntas = {
  1: 'There is a clear, shared view among senior leadership about why we are adopting AI.',
  2: 'We know, from evidence and not just intuition, which are the most critical challenges we face on the path towards AI.',
  3: 'We have identified specific opportunities where AI would create measurable business value, beyond internal efficiency.',
  4: 'We measure the actual return on our AI initiatives, not just whether they were implemented.',
  5: 'Our data has the quality, availability and governance needed to feed AI solutions reliably.',
  6: 'Our systems and technology infrastructure are ready to integrate with AI solutions and agents.',
  7: 'We have a formal AI governance mechanism that coordinates decisions and manages ethical risks.',
  8: 'We have real control over what our AI solutions do and decide, not only over how we implement them.',
  9: 'The organisation is open to learning, and to trial and error, in how it works with AI.',
  10: 'Our leaders oversee the use of AI closely, neither delegating it entirely nor avoiding it out of fear.',
  11: 'We have already redesigned critical processes with AI, and we know what friction has emerged along the way.',
  12: 'We are actively building the capabilities people need in order to work with AI.',
};

const intros = {
  proposito:
    'Whether senior leadership shares a view of why AI is being adopted, and whether that view rests on evidence rather than intuition alone.',
  valor:
    'Whether there are concrete business opportunities beyond internal efficiency, and whether actual return is measured rather than just implementation.',
  datos:
    'Whether the data has the quality and governance required, and whether systems are ready to integrate with AI solutions and agents.',
  gobierno:
    'Whether a formal mechanism coordinates decisions and manages risk, and whether there is real control over what AI does and decides.',
  cultura:
    'Whether the organisation leaves room to learn and to get things wrong, and whether leaders oversee AI without either delegating it entirely or avoiding it.',
  talento:
    'Whether critical processes have already been redesigned with AI, and whether the capabilities that work demands are actively being built.',
};

const niveles = {
  1: {
    name: 'Explorer',
    quote: '"We are starting to take an interest in AI"',
    text: 'The organisation is taking its first steps. It watches the technology landscape and the development of AI with curiosity, but from the outside. Change is not yet part of its internal identity.',
  },
  2: {
    name: 'Experimenter',
    quote: '"We are trialling AI in order to learn"',
    text: 'AI pilots are under way. This is a stage of active discovery, learning through trial and error, still without structural integration.',
  },
  3: {
    name: 'Integrator',
    quote: '"AI enters the system"',
    text: 'AI begins to be integrated into core processes, prioritised in the strategic plan. Functions connect to one another and the transformation starts to be felt.',
  },
  4: {
    name: 'Transformer',
    quote: '"We are beginning to transform the organisation through AI"',
    text: 'The organisation gains agility and efficiency from AI, improving the customer experience and lowering costs, which leads it to rethink its operating model.',
  },
  5: {
    name: 'Innovator',
    quote: '"AI becomes the engine of innovation"',
    text: 'The organisation uses AI day to day to create, experiment and anticipate, and AI becomes part of its identity.',
  },
};

const energias = {
  survive: {
    name: 'Protection Mode',
    bullets: [
      'Activity without clarity',
      'Behaviour driven by fear',
      'Investment with no visible ROI',
      'Risk of burnout',
    ],
    text: 'There is high-stress activity, driven by fear and ambiguity. Your AI investments most likely prioritise the tool ahead of the outcome, generating exhaustion and little clarity.',
    next: 'The step that pays off most now is not adding another tool, but building genuine conviction in the executive committee: sizing up with data what is at stake and why AI is being adopted at all. Without that starting point, any initiative is exposed to the first friction of change.',
  },
  transit: {
    name: 'Transition Mode',
    bullets: [
      'Pockets of momentum',
      'Inconsistent sponsorship',
      'Uneven value',
      'Risk of slipping into survival under pressure',
    ],
    text: 'You have real pockets of momentum, but sponsorship is inconsistent and value is uneven across functions. The organisation is doing the work, but its leaders may be caught up in the hype around AI rather than in results.',
    next: 'The focus now is widening sponsorship: moving from a small group of believers to a critical mass of executives who back the initiatives consistently, supported by AI governance that provides confidence and aligns criteria across functions.',
  },
  impulse: {
    name: 'Transformation Mode',
    bullets: [
      'AI is strategic',
      'Fear is being managed',
      'Experimentation is disciplined',
      'Measurable value is emerging',
    ],
    text: 'Your organisation has purpose and strategic direction. AI is a strategic engine and fear is well managed.',
    next: 'The challenge is no longer to persuade, but to sustain: continuing to build capability and a culture of autonomy, experimentation and evidence, assessing and adjusting the operating model so this momentum is not lost at the next obstacle.',
  },
};

/* These continue the sentence opened by friccion.normal.lectura ("Today, …"),
   so they start in lower case, exactly like their Spanish counterparts. */
const cuellos = {
  proposito:
    'what is missing is a shared vision and genuine conviction from senior leadership about why AI matters here. Without that starting point, initiatives risk remaining isolated pilots, without the sponsorship they need to survive the first friction of change. Before adding more tools, it is worth investing time in sizing up the opportunity and building that conviction in the executive committee.',
  valor:
    'what is missing are concrete, measurable business opportunities beyond internal efficiency. It is common to mistake activity for impact: many pilots, few use cases with a budget, an owner and a clear way to measure return. The next step is to prioritise a limited number of initiatives with a real business case behind them, not merely potential.',
  datos:
    'what is missing is data, systems or infrastructure ready to sustain AI solutions reliably. This is a silent bottleneck: it goes unnoticed until a promising use case fails to scale because the data lacks the necessary quality, availability or governance. It is worth taking an honest inventory of how ready the technical foundation is before committing to new initiatives.',
  gobierno:
    'what is missing is AI governance that provides confidence and real control over what AI does and decides. Without it, decisions are left to the individual judgement of each team, which creates inconsistency, ethical risk and, paradoxically, more delay in scaling. Well-designed governance does not slow innovation down: it enables it, by making clear what can be decided at each level.',
  cultura:
    'what is missing is a culture and a style of leadership that give safe space to learn and experiment with AI. When mistakes are not tolerated, people stop trying new things on their own, and the whole effort ends up resting on a handful of believers. Changing this starts with how leaders talk about their own mistakes with AI, not only about their successes.',
  talento:
    'what is missing is building the capabilities and redesigning the processes that AI requires in order to create value. Having access to AI tools is not the same as knowing how to use them to redesign the way work gets done; without that step, AI remains an accelerator of individual tasks rather than a real lever for organisational productivity.',
};

const escala = ['Strongly disagree', 'Disagree', 'Mixed / inconsistent', 'Agree', 'Strongly agree'];

/** 3 -> "3" ; 3.5 -> "3.5" (decimal point, as written in English) */
const num = (n) => String(Number(n).toFixed(1)).replace(/\.0$/, '');

/** ["A"] -> "A" | ["A","B"] -> "A and B" | ["A","B","C"] -> "A, B and C" */
const listar = (nombres) => {
  if (nombres.length <= 1) return nombres[0] || '';
  return nombres.slice(0, -1).join(', ') + ' and ' + nombres[nombres.length - 1];
};

/**
 * "10 September 2026".
 *
 * The time zone stays America/Santiago, the same as the Spanish report, on
 * purpose: it is the timestamp of record in the database and in the admin
 * panel. Rendering it in Australia/Sydney would make one response show two
 * different dates depending on which language you sent.
 */
const fecha = (valor) => {
  /* Without the falsy guard, `new Date(null)` is the epoch — a valid date — and
     the report would date the assessment to 1969 instead of omitting the line. */
  if (!valor) return '';
  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Santiago',
  }).format(d);
};

export default {
  codigo: 'en',
  htmlLang: 'en-AU',

  /* ---------- Instrument content (translated from index.html) ---------- */
  dimensiones,
  preguntas,
  intros,
  niveles,
  energias,
  cuellos,
  escala,

  /** Ladder level name for a dimension score (1–5). */
  nombreDeNivel: (puntaje) => niveles[nivelDeDimension(puntaje)].name,

  /* ---------- Language-dependent formatting ---------- */
  fmt: { num, listar, fecha },

  /* ---------- Document ---------- */
  doc: {
    marca: 'ADAPSYS · AI Radar',
    /** Prefix of the downloadable PDF. Plain ASCII: it is a file name. */
    archivo: 'Adapsys-AI-Radar',
    titulo: (empresa) => 'Report · Adapsys AI Radar' + (empresa ? ' · ' + empresa : ''),
    kicker: 'Results report',
    btnPdf: '↓ Download as PDF',
    otroIdioma: { codigo: 'es', etiqueta: 'Ver en español' },
    h1: (primerNombre) =>
      primerNombre
        ? `${primerNombre}, this is what your answers said`
        : 'This is what your answers said',
    fechaLinea: (f) => 'Assessed on ' + f,
    pie: 'Adapsys AI Radar — built by Adapsys.',
  },

  perfil: {
    h2: 'Your profile across six dimensions',
    cuerpo:
      'The radar measures six dimensions separately. Here is your score on each one, on a single ' +
      'scale from 1 to 5, so you can see at a glance what is moving ahead and what is lagging behind inside ' +
      'your organisation.',
    promedio: (n) => `Your overall average: <b>${n}</b>`,
    lectura: {
      plano: (puntaje) => `All six dimensions landed at the same point: ${puntaje} out of 5.`,
      casiParejo: (altas, cuantasBajas) =>
        `What stands apart is <b>${altas}</b>. The other ${cuantasBajas} all landed at the same point.`,
      normal: (altas, bajas) =>
        `Your firmest ground is in <b>${altas}</b>. Your greatest friction, in <b>${bajas}</b>.`,
    },
  },

  friccion: {
    plano: {
      h2: 'Your profile is even',
      p1: (puntaje) =>
        `All six dimensions landed at exactly the same point (<b>${puntaje} out of 5</b>). None of them ` +
        'stands apart, either above or below, so this assessment <b>does not identify a bottleneck</b>: ' +
        'naming one would be arbitrary.',
      p2:
        'A profile like this usually means one of two things, and telling them apart matters: either the ' +
        'organisation is progressing genuinely evenly, or the answers settled around the midpoint because ' +
        'there was not enough information to differentiate. It is worth comparing this with other people in ' +
        'the organisation before drawing conclusions.',
    },
    casiParejo: {
      h2: 'Your profile is almost even',
      p1: (cuantas, puntaje, nombres) =>
        `<b>${cuantas} of the 6 dimensions</b> landed at exactly the same point (${puntaje} out of 5): ` +
        `${nombres}. With a profile like this, <b>naming a bottleneck would be arbitrary</b>: none of them ` +
        'stands apart from the others.',
      p2: (label, puntaje) =>
        `What does stand apart is <b>${label}</b>, at ${puntaje} out of 5. That contrast is the useful ` +
        'information here: the rest of the system is moving evenly and that dimension is out in front.',
      p3: (cuantas, valor) =>
        `At the level of the individual statement, your lowest score was on ${cuantas > 1 ? 'these' : 'this one'} ` +
        `(${valor} out of 5):`,
    },
    normal: {
      h2: 'Where your greatest friction is',
      varias: (cuantas, puntaje, nombres) =>
        `There are <b>${cuantas} dimensions tied</b> at your lowest point (${puntaje} out of 5): <b>${nombres}</b>. ` +
        'No single one of them is "the" barrier on its own.',
      una: (nombres, puntaje) => `Your lowest point is in <b>${nombres}</b>, at ${puntaje} out of 5.`,
      /** Opens the bottleneck paragraph, which continues the sentence. */
      lectura: (cuello) => 'Today, ' + cuello,
    },
  },

  fortaleza: {
    h2: 'Where you have ground already won',
    casiParejo: (nombres) =>
      `These are the two statements behind <b>${nombres}</b>, the dimension that stands apart in your profile.`,
    varias: (nombres, puntaje) =>
      `<b>${nombres}</b> share your highest score (${puntaje} out of 5). That is where it makes sense to ` +
      'build from for whatever comes next.',
    una: (nombres, puntaje) =>
      `<b>${nombres}</b> is your strongest dimension, at ${puntaje} out of 5. That is where it makes sense ` +
      'to build from for whatever comes next.',
  },

  detalle: {
    h2: 'Answer by answer',
    cuerpo:
      'The twelve statements you answered, grouped by dimension, with what you selected on each ' +
      'one. This is the raw material behind everything above.',
    /* The survey is Spanish-only, so an English reader is being shown a
       translation of what they actually read on screen. Saying so is the same
       standard the rest of this report holds itself to. */
    nota:
      'You completed the survey in Spanish. The statements below are translated; the scores are ' +
      'exactly the ones you gave.',
  },

  barrera: {
    h2: 'Your barrier, in your own words',
    cuerpo: 'This is what you wrote when we asked what is holding you back today:',
  },

  contexto: {
    h2: 'The wider context',
    cuerpo:
      'Beyond the detail by dimension, the radar places your organisation on two axes: how far it ' +
      'has come in adopting AI, and with what energy it is doing so. This is the reading you saw on screen.',
    badgeNivel: (name) => 'Level: ' + name,
    etiquetasEnergia: ['Protection', 'Transition', 'Transformation'],
    aqui: 'HERE',
    nivelLinea: (name, quote, text) => `<b>${name}</b> — ${quote}. ${text}`,
    energiaLinea: (name, text) => `<b>${name}</b> — ${text}`,
  },

  cierre: {
    h2: 'Shall we talk this through?',
    cuerpo: (mail) =>
      'If you would like to go through these results with us, or take the full assessment to the ' +
      `rest of your team, write to us at ${mail}.`,
    asunto: 'Let us talk about my AI Radar',
  },

  dimBloque: {
    puntaje: (n, nivel) => `${n} / 5 · ${nivel}`,
  },
};
