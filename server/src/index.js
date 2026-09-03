import crypto from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { initSchema, pool, query } from './db.js';
import { nombreArchivo, renderPdf } from './pdf.js';
import { buildReportHtml } from './report.js';
import { computeResult, DIMENSIONS, QUESTION_IDS } from './scoring.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const IP_SALT = process.env.IP_SALT || '';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

if (ALLOWED_ORIGINS.length === 0) {
  console.warn('[cors] ALLOWED_ORIGINS está vacío: el navegador va a bloquear todas las llamadas.');
}
if (!ADMIN_TOKEN) {
  console.warn('[admin] ADMIN_TOKEN está vacío: el export CSV queda deshabilitado.');
}

const app = express();

// Railway pone un proxy delante: sin esto el rate limiter ve siempre la misma IP.
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
  cors({
    origin(origin, callback) {
      // Sin Origin = no es una petición cross-origin de navegador (curl, health
      // checks). CORS es una defensa del navegador, no autenticación: lo que
      // protege estos endpoints es la validación y el rate limit.
      if (!origin) return callback(null, true);
      callback(null, ALLOWED_ORIGINS.includes(origin.replace(/\/$/, '')));
    },
    methods: ['GET', 'POST'],
    maxAge: 86_400,
  })
);

app.use(express.json({ limit: '32kb' }));

const writeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.' },
});

/* Generar un PDF levanta un Chromium: mucho más caro que servir HTML. */
const pdfLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Demasiadas descargas seguidas. Intenta de nuevo en unos minutos.',
});

/* ---------- Validación ---------- */

const answersSchema = z
  .object(
    Object.fromEntries(
      QUESTION_IDS.map((id) => [String(id), z.number().int().min(1).max(5)])
    )
  )
  .strict();

const responseSchema = z.object({
  answers: answersSchema,
  barrier: z.string().max(2000).optional().nullable(),
});

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().max(200).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email inválido'),
  company: z.string().trim().max(160).optional().nullable(),
});

const uuidSchema = z.string().uuid();

/* ---------- Utilidades ---------- */

function hashIp(ip) {
  if (!ip || !IP_SALT) return null;
  return crypto.createHash('sha256').update(ip + IP_SALT).digest('hex');
}

/** Comparación en tiempo constante; tolera largos distintos sin filtrarlo. */
function tokenMatches(provided) {
  if (!ADMIN_TOKEN || !provided) return false;
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(ADMIN_TOKEN).digest();
  return crypto.timingSafeEqual(a, b);
}

/** RFC 4180: comillas dobladas y campo entrecomillado si trae , " o salto. */
function csvCell(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/* ---------- Rutas ---------- */

/**
 * Panel para ver y descargar las respuestas desde el navegador.
 * La página en sí no lleva secretos: pide la clave, la guarda en el
 * localStorage de quien la abre y la manda en la cabecera al pedir el CSV.
 * Así el token nunca viaja en la URL, donde quedaría en el historial y en
 * los logs HTTP de Railway.
 */
app.get('/admin', (_req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.sendFile(join(__dirname, 'admin.html'));
});

/**
 * Reporte individual. El id es el UUID v4 de la respuesta: 122 bits de
 * entropía, así que la URL misma es la credencial. Solo se obtiene desde el
 * panel — nunca se le muestra a quien contesta el diagnóstico.
 *
 * Un id inválido y uno inexistente devuelven lo mismo, para no confirmar la
 * existencia de un reporte a quien esté probando URLs.
 */
app.get('/reporte/:id', async (req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  const id = uuidSchema.safeParse(req.params.id);
  if (!id.success) return res.status(404).type('text/plain').send('Reporte no encontrado.');

  const { rows } = await query(
    `select id, created_at, answers, barrier, contact_name, contact_company
       from responses where id = $1`,
    [id.data]
  );
  if (!rows.length) return res.status(404).type('text/plain').send('Reporte no encontrado.');

  res.type('html').send(buildReportHtml(rows[0]));
});

/**
 * El mismo reporte, en PDF descargable. Se genera con Chromium y por eso lleva
 * su propio límite: un PDF cuesta ~300 MB y un segundo de CPU, muy por encima de
 * servir el HTML. Sin tope, quien tenga un UUID puede tumbar el servicio.
 */
app.get('/reporte/:id/pdf', pdfLimiter, async (req, res) => {
  const id = uuidSchema.safeParse(req.params.id);
  if (!id.success) return res.status(404).type('text/plain').send('Reporte no encontrado.');

  const { rows } = await query(
    `select id, created_at, answers, barrier, contact_name, contact_company
       from responses where id = $1`,
    [id.data]
  );
  if (!rows.length) return res.status(404).type('text/plain').send('Reporte no encontrado.');

  try {
    const pdf = await renderPdf(buildReportHtml(rows[0]));
    const nombre = nombreArchivo(rows[0]);
    res.setHeader('Content-Type', 'application/pdf');
    // filename simple para clientes viejos, filename* para los acentos.
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${nombre}"; filename*=UTF-8''${encodeURIComponent(nombre)}`
    );
    res.send(pdf);
  } catch (err) {
    // Que falle el PDF no puede llevarse puesto el reporte: la página sigue ahí.
    console.error('[pdf] no se pudo generar:', err);
    res.status(503).type('text/plain').send('No pudimos generar el PDF en este momento. El reporte sigue disponible en su enlace.');
  }
});

app.get('/health', async (_req, res) => {
  try {
    await query('select 1');
    res.json({ ok: true, db: true });
  } catch (err) {
    res.status(503).json({ ok: false, db: false, error: err.message });
  }
});

/**
 * Fase 1 — respuesta anónima. Se guarda apenas la persona termina el
 * diagnóstico, deje o no sus datos después. Así no se pierde la barrera escrita
 * por quien nunca llena el formulario.
 */
app.post('/api/responses', writeLimiter, async (req, res) => {
  const parsed = responseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Respuestas inválidas', detail: parsed.error.issues });
  }

  const { answers, barrier } = parsed.data;
  const result = computeResult(answers);

  const { rows } = await query(
    `insert into responses
       (answers, barrier, level, energy_key, bottleneck_key, total, dim_totals,
        user_agent, referrer, ip_hash)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     returning id`,
    [
      JSON.stringify(answers),
      barrier || null,
      result.level,
      result.energyKey,
      result.bottleneckKey,
      result.total,
      JSON.stringify(result.dimTotals),
      (req.get('user-agent') || '').slice(0, 500) || null,
      (req.get('referer') || '').slice(0, 500) || null,
      hashIp(req.ip),
    ]
  );

  const { rows: countRows } = await query('select count(*)::int as count from responses');

  res.status(201).json({ id: rows[0].id, count: countRows[0].count });
});

/**
 * Fase 2 — se asocia el contacto a una respuesta ya guardada.
 * El WHERE contact_email is null impide sobreescribir un lead existente si
 * alguien reenvía el formulario o repite el request.
 */
app.post('/api/responses/:id/contact', writeLimiter, async (req, res) => {
  const id = uuidSchema.safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ error: 'Identificador inválido' });

  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Datos de contacto inválidos', detail: parsed.error.issues });
  }

  const { name, email, company } = parsed.data;
  const { rowCount } = await query(
    `update responses
        set contact_name = $2, contact_email = $3, contact_company = $4, contact_at = now()
      where id = $1 and contact_email is null`,
    [id.data, name, email, company || null]
  );

  if (rowCount === 0) {
    const { rows } = await query('select 1 from responses where id = $1', [id.data]);
    return rows.length
      ? res.status(409).json({ error: 'Esta respuesta ya tiene datos de contacto.' })
      : res.status(404).json({ error: 'No encontramos esa respuesta.' });
  }

  res.json({ ok: true });
});

/** Agregados públicos. Alimenta el contador "eres la organización N.º X". */
let statsCache = { at: 0, data: null };

app.get('/api/stats', async (_req, res) => {
  if (statsCache.data && Date.now() - statsCache.at < 60_000) {
    return res.json(statsCache.data);
  }

  const [total, byLevel, byEnergy, byBottleneck] = await Promise.all([
    query('select count(*)::int as count from responses'),
    query('select level, count(*)::int as n from responses group by level'),
    query('select energy_key, count(*)::int as n from responses group by energy_key'),
    query('select bottleneck_key, count(*)::int as n from responses group by bottleneck_key'),
  ]);

  const data = {
    count: total.rows[0].count,
    levelCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    energyCounts: { survive: 0, transit: 0, impulse: 0 },
    bottleneckCounts: Object.fromEntries(DIMENSIONS.map((d) => [d.key, 0])),
  };
  byLevel.rows.forEach((r) => { data.levelCounts[r.level] = r.n; });
  byEnergy.rows.forEach((r) => { data.energyCounts[r.energy_key] = r.n; });
  byBottleneck.rows.forEach((r) => { data.bottleneckCounts[r.bottleneck_key] = r.n; });

  statsCache = { at: Date.now(), data };
  res.json(data);
});

/** Única vía a los datos de contacto. Sin token, no hay export. */
app.get('/api/admin/responses.csv', async (req, res) => {
  const provided = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!tokenMatches(provided)) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const { rows } = await query(
    `select id, created_at, level, energy_key, bottleneck_key, total, answers, barrier,
            contact_name, contact_email, contact_company, contact_at
       from responses
      order by created_at desc`
  );

  const header = [
    'id', 'created_at', 'level', 'energy_key', 'bottleneck_key', 'total',
    ...QUESTION_IDS.map((n) => `q${n}`),
    'barrier', 'contact_name', 'contact_email', 'contact_company', 'contact_at',
  ];

  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([
      r.id,
      r.created_at.toISOString(),
      r.level,
      r.energy_key,
      r.bottleneck_key,
      r.total,
      ...QUESTION_IDS.map((n) => r.answers?.[n] ?? ''),
      r.barrier,
      r.contact_name,
      r.contact_email,
      r.contact_company,
      r.contact_at ? r.contact_at.toISOString() : '',
    ].map(csvCell).join(','));
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="radar-adapsys-respuestas.csv"');
  res.send('﻿' + lines.join('\r\n')); // BOM para que Excel lea los acentos
});

app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

app.use((err, _req, res, _next) => {
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON malformado' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Cuerpo demasiado grande' });
  }
  console.error('[error]', err);
  res.status(500).json({ error: 'Error interno' });
});

/* ---------- Arranque ---------- */

const server = await (async () => {
  await initSchema();
  return app.listen(PORT, () => console.log(`[api] escuchando en :${PORT}`));
})();

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`[api] ${signal}, cerrando`);
    server.close(() => pool.end().then(() => process.exit(0)));
  });
}
