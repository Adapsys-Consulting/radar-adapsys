# Imagen oficial de Playwright: trae Chromium con todas sus librerías de sistema.
#
# El tag TIENE que coincidir con la versión de "playwright-core" en package.json.
# Si difieren, playwright-core busca el binario en una carpeta con otro número de
# revisión y falla en runtime con "Executable doesn't exist at /ms-playwright/...".
# Al subir uno, sube el otro.
#
# Se descartó instalar Chromium por apt sobre el build de Railpack: esa imagen es
# Ubuntu, donde el paquete `chromium` es un stub de snap que no arranca dentro de
# un contenedor.
FROM mcr.microsoft.com/playwright:v1.62.1-noble

WORKDIR /app

# El manifiesto primero: mientras las dependencias no cambien, Docker reutiliza
# esta capa y el build queda en segundos en vez de minutos.
COPY package*.json ./
RUN npm ci --omit=dev

COPY . ./

ENV NODE_ENV=production

CMD ["node", "src/index.js"]
