FROM node:20-slim AS base
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@9.14.4

# ── Build stage ───────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

# Manifiestos de workspace (capa de caché de Docker)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN pnpm install --frozen-lockfile

# Fuentes
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

WORKDIR /app/apps/api
# URL ficticia solo para que prisma generate pueda parsear el schema (no hace conexión real)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN pnpm exec prisma generate
RUN pnpm exec nest build

# ── Runner stage ──────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

RUN pnpm install --frozen-lockfile --prod

WORKDIR /app/apps/api
# Regenerar el cliente Prisma en el runner (produce los enums y tipos en node_modules)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN pnpm exec prisma generate

ENV NODE_ENV=production

# 'migrate deploy' es idempotente; DATABASE_URL solo está disponible en runtime
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/main"]
EXPOSE 3001
