# Debian slim: chartjs-node-canvas → native `canvas` needs Cairo/Pango build deps (Alpine musl lacks usable prebuilds).
FROM node:20-bookworm-slim
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ pkg-config libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev \
  && rm -rf /var/lib/apt/lists/*
COPY backend/package*.json ./
RUN npm install
COPY backend .
RUN npm run build
EXPOSE 4000
CMD ["npm","start"]
