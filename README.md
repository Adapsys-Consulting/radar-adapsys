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

### Ver y bajar las respuestas

**https://radar-api-production-576f.up.railway.app/admin**

Se pega la clave una vez (queda guardada en ese navegador) y desde ahí se ve el resumen —cuántos diagnósticos,
cuántos dejaron datos, el reparto por nivel, energía y cuello de botella, la tabla de leads y las barreras
anónimas— con un botón para bajar el CSV.

La clave es el `ADMIN_TOKEN` de las variables del servicio `radar-api` en Railway. La página no la contiene: la
guarda en el `localStorage` de quien entra y la manda en la cabecera `Authorization`. Por eso **el token nunca va
en la URL**, donde quedaría en el historial del navegador y en los logs HTTP de Railway.

Desde la terminal, si se prefiere:

```bash
curl -s https://radar-api-production-576f.up.railway.app/api/admin/responses.csv \
  -H "Authorization: Bearer $ADMIN_TOKEN" -o respuestas.csv
```

El CSV trae una fila por respuesta con `q1..q12`, la barrera y el contacto, y lleva BOM para que Excel lea bien
los acentos.

## Enviar el reporte a quien lo pidió

El envío es **manual**, uno por uno. En el panel, cada persona que dejó sus datos tiene tres botones:

- **Ver** — abre su reporte.
- **Copiar link** — el link para pegar donde quieras.
- **Copiar correo** — el mensaje completo ya redactado con el link adentro, listo para pegar en Gmail u Outlook.

El reporte vive en `/reporte/<id>`. Ese `id` es el UUID v4 de la respuesta: 122 bits de entropía, así que **la URL
misma es la credencial** — quien la tenga puede abrir ese reporte, y nadie puede adivinarla. No se le muestra a
quien contesta el diagnóstico; solo sale del panel.

### Cómo está armado

Se estructura alrededor del **perfil por dimensión**, no del nivel y la energía. La razón está en los datos: de
las primeras 15 respuestas reales, 11 (73 %) cayeron en la misma celda "Nivel 3 / Tránsito" —consecuencia del
[pendiente conocido](#pendiente-conocido-los-dos-ejes-no-son-independientes)— mientras que las 15 tuvieron un
perfil de seis dimensiones distinto. Encabezado por el nivel, 11 personas recibirían el mismo texto.

**El reporte nunca afirma un cuello de botella que no existe.** Si varias dimensiones empatan en el mínimo las
nombra todas; si empatan 4 o más dice que el perfil es casi parejo y pivotea a lo que sí se despega; si empatan
las seis, lo dice y no señala ninguna. Es un caso real, no teórico: 2 de las primeras 15 respuestas tienen cinco
dimensiones empatadas.

### Al tocar el reporte

```bash
cd server
npm test                                        # incluye la paridad de contenido
ADMIN_TOKEN=... npm run verificar-reportes      # renderiza los reportes reales
```

Lo segundo baja las respuestas de producción, genera el reporte de cada una, revisa las invariantes (que no
invente cuellos de botella, que no queden secciones vacías, que no se filtre un email) y deja los HTML en disco
para abrirlos en el navegador.

## Endpoints

| Método | Ruta | Para qué |
|---|---|---|
| `GET` | `/admin` | Panel para ver y descargar las respuestas |
| `GET` | `/reporte/:id` | Reporte individual. El UUID es la credencial |
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

### Las pruebas que no puedes saltarte

`index.html` es estático en Vercel y el servidor está en Railway: no pueden compartir un import, así que el
scoring y el contenido están duplicados a propósito. Dos pruebas evalúan **los objetos reales del `index.html`**
y los comparan contra el espejo del servidor:

- `server/test/scoring.test.js` — `computeResult()`, con 2000 combinaciones aleatorias además de umbrales,
  redondeo y empates. Si divergen, la base guarda un resultado distinto al que el usuario vio en pantalla.
- `server/test/content.test.js` — las 12 preguntas, los textos de nivel, energía y cuello de botella, y las
  etiquetas de la escala. Si divergen, el reporte le cita al cliente una pregunta con distinta redacción de la
  que efectivamente contestó.

Si tocas el scoring o el copy en un lado, tócalo en los dos. Nadie se entera de una divergencia hasta que alguien
reclama.

## Regenerar la tarjeta de preview y el favicon

Las imágenes del sitio (`og-image.png`, `favicon.ico`, `favicon.svg`,
`apple-touch-icon.png`) se generan a partir del HTML en [`assets-src/`](assets-src/), así se mantienen sin salir
de los tokens de marca y sin necesitar un editor gráfico.

1. Sirve el repo: `python -m http.server 8080`
2. Abre `assets-src/og-image.html` con el viewport en **1200×630** y captura → `og-image.png`
3. Abre `assets-src/icon.html` con el viewport en **180×180** y captura → `apple-touch-icon.png`
4. Repite a **32×32** y **16×16**, y arma el `.ico` con ambos (un `.ico` admite PNG embebidos)

`assets-src/` está en `.vercelignore`: es la fuente, no se publica.

**Si cambia el dominio**, hay que actualizar las cuatro URL absolutas de `og:image`, `twitter:image` y `og:url`
en [`index.html`](index.html) — los scrapers no resuelven rutas relativas, así que una URL vieja deja la tarjeta
en blanco. Tras cambiarla, refresca la caché de LinkedIn en el
[Post Inspector](https://www.linkedin.com/post-inspector/); si no, sigue mostrando la versión anterior.

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

- **`btn-next` falla en silencio** si faltan respuestas: el clic no hace nada y no se explica por qué.
- **Sin persistencia local:** recargar a mitad del diagnóstico pierde las respuestas.
- **Accesibilidad:** la escala 1–5 son botones sueltos sin `role="radiogroup"` ni `aria-label`, y la pantalla de
  resultado no tiene `<h1>` (parte en `<h2>`).
- **Código muerto** en `renderEnergyLegend`: define las etiquetas `Supervivencia / Tránsito / Impulso` y nunca las
  usa, porque muestra `e.name` (`Modo Protección`…). Dos nomenclaturas para lo mismo.
