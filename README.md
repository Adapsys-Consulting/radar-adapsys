# Radar Adapsys IA

Autodiagnóstico que cruza el nivel de madurez organizacional en IA (1–5, escalera Adapsys) con la energía de
cambio (marco Survive/Thrive de Kotter, adaptado como Protección / Tránsito / Transformación), integrando las
dimensiones de preparación agéntica y el instrumento largo de Adapsys.

Son 12 preguntas en 6 dimensiones, más una pregunta abierta sobre la mayor barrera. Toma unos 3 minutos.

## Estructura

| Ruta | Qué es | Dónde vive |
|---|---|---|
| [`index.html`](index.html) | El diagnóstico completo: HTML, CSS y JS en un solo archivo, sin build. Única dependencia externa: Google Fonts. | Vercel (estático) — https://radar-adapsys-ia.vercel.app |
| [`server/`](server/) | API de captación: Express + Postgres. | Railway — proyecto `radar-adapsys` |

`.vercelignore` excluye `server/` del deploy estático. **No lo borres:** sin él, Vercel publica el código del
backend en `radar-adapsys-ia.vercel.app/server/src/index.js`.

## Cómo se guardan las respuestas

En dos fases, para no perder nada de quien no deja sus datos:

1. **Al terminar el diagnóstico** se envía la respuesta anónima (las 12 respuestas, la barrera escrita y el
   resultado). La API devuelve un `id` y el total de respuestas, que alimenta el contador *"eres la organización
   N.º X"*.
2. **Si la persona pide el reporte completo**, su nombre, email y empresa se asocian a esa misma fila.

Todos los envíos son **fail-soft**: si la API está caída o lenta, el visitante ve su resultado igual. Lo que nunca
hace el formulario es afirmar que envió algo que no envió — si falla, lo dice y ofrece el correo directo.

### Bajar los leads

```bash
curl -s https://radar-api-production-576f.up.railway.app/api/admin/responses.csv \
  -H "Authorization: Bearer $ADMIN_TOKEN" -o respuestas.csv
```

El `ADMIN_TOKEN` está en las variables del servicio `radar-api` en Railway. El CSV trae una fila por respuesta con
`q1..q12`, la barrera y el contacto, y lleva BOM para que Excel lea bien los acentos.

## Endpoints

| Método | Ruta | Para qué |
|---|---|---|
| `GET` | `/health` | Healthcheck |
| `POST` | `/api/responses` | Fase 1 — respuesta anónima. Devuelve `{ id, count }` |
| `POST` | `/api/responses/:id/contact` | Fase 2 — asocia el contacto |
| `GET` | `/api/stats` | Agregados públicos (sin datos personales) |
| `GET` | `/api/admin/responses.csv` | Export completo, requiere `ADMIN_TOKEN` |

El servidor **recalcula el resultado** desde las respuestas crudas; nunca confía en el que manda el navegador.

## Privacidad

- Nunca se guarda la IP: solo `sha256(ip + IP_SALT)`.
- Los datos de contacto salen únicamente por el export con token.
- El formulario declara el consentimiento antes de pedir el correo.
- CORS por allowlist explícita (`ALLOWED_ORIGINS`), sin comodines. **Un dominio nuevo del frontend —incluido un
  preview de Vercel— no funciona hasta agregarlo ahí.**

## Desarrollo

```bash
cd server && npm install
cp .env.example .env      # completa DATABASE_URL, ADMIN_TOKEN, IP_SALT
npm run dev
npm test                  # paridad de scoring, ver abajo
```

Para el frontend basta servir la raíz del repo (`python -m http.server 8080`) y apuntar `API_BASE` en
[`index.html`](index.html) a donde corresponda. `http://localhost:8080` ya está en la allowlist de producción.

### La prueba que no puedes saltarte

`server/test/scoring.test.js` **extrae el `computeResult()` real del `index.html`** y lo compara contra
`server/src/scoring.js` con 2000 combinaciones aleatorias, además de umbrales, redondeo y empates.

Si tocas el scoring en un lado, tócalo en los dos. Si divergen, la base guarda un resultado distinto al que el
usuario vio en pantalla, y nadie se entera hasta que alguien reclama.

## Contenido editable

Las 12 preguntas, los textos de cada nivel, los 3 rangos de Kotter y los textos de cuello de botella están al
inicio del bloque `<script>` en objetos simples (`QUESTIONS`, `LEVEL_COPY`, `ENERGY_COPY`, `BOTTLENECK_COPY`). Se
puede editar el copy ahí sin tocar la lógica ni el HTML.

Los **IDs de pregunta (1–12) son estables**: cambiarlos rompe la lectura de las respuestas ya guardadas.

---

## Pendiente conocido: los dos ejes no son independientes

El radar promete cruzar dos ejes, pero hoy **ambos salen del mismo número**:

```js
const avg = total / QUESTIONS.length;          // 1..5
const level = Math.round(avg);                 // eje "madurez"
const pct   = total / (QUESTIONS.length * 5);  // === avg/5  -> eje "energía"
```

Como `pct` es una transformación lineal de `avg`, la energía queda determinada por la madurez. Consecuencias:

- Solo **7 de las 15 celdas** de la grilla son alcanzables, todas sobre la diagonal.
- Es **imposible** salir "Nivel 5 en Modo Protección" (madurez alta con energía de miedo) o "Nivel 1 en Modo
  Transformación" — justo los cuadrantes que hacen interesante el marco de Kotter y los que mejor abren una
  conversación.
- Ninguna de las 12 preguntas mide lo que define la energía en Kotter (miedo, urgencia, agotamiento,
  consistencia del sponsorship), aunque la pantalla de resultado promete distinguir *"presión y miedo"* de
  *"convicción y curiosidad"*.

Arreglarlo requiere separar el cálculo (por ejemplo, madurez desde las dimensiones estructurales y energía desde
propósito + cultura) y probablemente agregar preguntas que midan energía de verdad. **Decisión consciente de
dejarlo para después.** Nota para cuando se retome: cambiar el scoring exige actualizar `index.html` y
`server/src/scoring.js` juntos, y las respuestas ya guardadas quedarían calculadas con el criterio viejo.

## Otros hallazgos abiertos

- **Sin `<meta name="description">` ni Open Graph.** Al compartir el link en LinkedIn —el caso de uso para el que
  se construyó— no aparece tarjeta de preview.
- **`btn-next` falla en silencio** si faltan respuestas: el clic no hace nada y no se explica por qué.
- **Sin persistencia local:** recargar a mitad del diagnóstico pierde las respuestas.
- **Accesibilidad:** la escala 1–5 son botones sueltos sin `role="radiogroup"` ni `aria-label`, y la pantalla de
  resultado no tiene `<h1>` (parte en `<h2>`).
- **Código muerto** en `renderEnergyLegend`: define las etiquetas `Supervivencia / Tránsito / Impulso` y nunca las
  usa, porque muestra `e.name` (`Modo Protección`…). Dos nomenclaturas para lo mismo.
