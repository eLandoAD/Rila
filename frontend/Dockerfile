# syntax=docker/dockerfile:1

# --- Stage 1: build ---
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Limita il parallelismo di esbuild: su host con poca RAM (es. 2GB) il build
# in parallelo su tutte le CPU satura la memoria e viene ucciso (OOM/SIGKILL).
ENV GOMAXPROCS=2
RUN npm run build

# --- Stage 2: runtime ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

EXPOSE 4000
CMD ["node", "dist/frontend/server/server.mjs"]
