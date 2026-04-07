# Multi-stage build; default to Streamable HTTP for container use (override TRANSPORT_TYPE as needed).
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV TRANSPORT_TYPE=http-sse
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3847
CMD ["node", "dist/index.js"]
