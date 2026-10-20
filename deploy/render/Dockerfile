FROM node:24.22.0-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends unzip ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY integrations/issuance/package.json ./integrations/issuance/package.json
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN node scripts/render-build.mjs

FROM node:24.22.0-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends gosu ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build --chown=node:node /app /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=10000
EXPOSE 10000
ENTRYPOINT ["sh", "/app/deploy/render/entrypoint.sh"]
CMD ["node", "scripts/render-start.mjs"]
