# Un solo contenedor: sirve los estáticos y además los enlaces cortos /r/:id
# con las etiquetas OpenGraph que lee WhatsApp.
FROM node:20-bookworm-slim

# sharp rasteriza el SVG de la vista previa; necesita tipografías del sistema.
RUN apt-get update \
 && apt-get install -y --no-install-recommends fonts-dejavu-core fontconfig \
 && rm -rf /var/lib/apt/lists/* \
 && fc-cache -f

WORKDIR /app

COPY server/package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY server/*.js ./
COPY index.html ./public/index.html
COPY css/ ./public/css/
COPY js/  ./public/js/

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "index.js"]
