FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY tsconfig.json nest-cli.json ./
COPY shared/ ./shared/
COPY api/ ./api/
RUN node_modules/.bin/nest build api

FROM node:24-alpine
WORKDIR /app
COPY api/package.json ./
RUN npm install --omit=dev --legacy-peer-deps
COPY --from=builder /app/api/dist ./dist
CMD ["node", "dist/main/index.js"]
