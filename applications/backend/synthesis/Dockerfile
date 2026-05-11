FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY tsconfig.json nest-cli.json ./
COPY shared/ ./shared/
COPY synthesis/ ./synthesis/
RUN node_modules/.bin/nest build synthesis

FROM node:24-alpine
WORKDIR /app
COPY synthesis/package.json ./
RUN npm install --omit=dev --legacy-peer-deps
COPY --from=builder /app/synthesis/dist ./dist
CMD ["node", "dist/main"]
