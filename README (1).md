# Radar Adapsys IA

Prototipo funcional de autodiagnóstico: cruza el nivel de madurez organizacional en IA (1–5, escalera Adapsys) con la energía de cambio (marco Survive/Thrive de Kotter, adaptado como Protección / Tránsito / Transformación), integrando también las dimensiones de preparación agéntica y el instrumento largo de Adapsys.

Es un único archivo HTML autocontenido: no tiene dependencias de build, ni backend propio. Todo el HTML, CSS y JavaScript vive en `radar-adapsys-ia.html`. La única dependencia externa es Google Fonts (Space Grotesk, Inter, IBM Plex Mono), cargada por CDN.

## Cómo publicarlo

**Opción rápida — GitHub Pages:**
1. Sube `radar-adapsys-ia.html` a un repo (puede ser público o privado con Pages habilitado).
2. Si quieres que quede en la raíz del sitio, renómbralo a `index.html`.
3. Actívalo en *Settings → Pages*, eligiendo la rama y carpeta donde quedó el archivo.
4. El link que entregue GitHub Pages es el que va en el CTA del artículo de LinkedIn.

**Opción alternativa:** subirlo tal cual a cualquier hosting estático (Netlify, Vercel, un bucket S3 con hosting estático, o el mismo servidor donde vive adapsys.ai) — no necesita configuración especial, es HTML plano.

## Importante antes de lanzarlo con tráfico real

Hay dos cosas dejadas deliberadamente como prototipo, marcadas con comentarios `NOTA PARA PRODUCCIÓN` dentro del código (buscar ese texto en el archivo):

1. **El contador de "organizaciones que ya tomaron el radar"** usa un storage de key-value pensado para artefactos de Claude (`window.storage`). **Esto NO va a funcionar fuera de la plataforma de Claude.** Al subirlo a GitHub Pages hay que reemplazar ese bloque por algo real: un endpoint propio, Firebase, Supabase, o simplemente quitar el contador si no es prioridad para el lanzamiento.

2. **El formulario "¿Quieres el reporte completo?"** (nombre/email/empresa al final) hoy solo cambia el estado visual en el navegador de quien lo llena — no envía ese dato a ningún lado. Antes de lanzarlo, hay que conectar ese `onclick` (buscar `btn-contact-submit` en el archivo) a un envío real: un webhook, un formulario de HubSpot/Airtable, o un Google Form embebido. El comentario en el código indica exactamente qué payload debería viajar: `{ name, email, company, answers, barrier, result }`.

Ninguno de los dos bloqueos afecta el diagnóstico en sí — el visitante ve su resultado igual, solo que hoy nadie del equipo se entera de quién lo tomó ni qué contestó, hasta que se conecte lo de arriba.

## Contenido / lógica (por si alguien quiere tocarlo)

Todo el contenido editable (las 12 preguntas, los textos de cada nivel, los 3 rangos de Kotter, los textos de cuello de botella) está en la parte superior del bloque `<script>`, en objetos simples (`QUESTIONS`, `LEVEL_COPY`, `ENERGY_COPY`, `BOTTLENECK_COPY`) — se puede editar el copy ahí sin tocar la lógica de cálculo ni el HTML.
