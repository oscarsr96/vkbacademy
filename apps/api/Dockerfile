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

# Compilar el paquete shared (CommonJS) antes de compilar la API
RUN pnpm --filter @vkbacademy/shared build

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

# Ejecutar como usuario no-root (principio de mínimo privilegio)
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nestjs
USER nestjs

# IMPORTANTE: las migraciones NO se ejecutan aquí.
#
# Motivo: en Fase B (ECS Fargate con >1 task) varias instancias arrancando
# a la vez intentarían correr `prisma migrate deploy` en paralelo, lo que
# puede provocar race conditions en el shadow database y dejar migraciones
# en estado `failed`.
#
# Las migraciones se ejecutan en un step dedicado del pipeline CI/CD
# (ver `.github/workflows/deploy-pipeline.yml`) ANTES del rollout:
#   pnpm --filter @vkbacademy/api run migrate:deploy
#
# En Render se configura como "pre-deploy command" en `render.yaml`.
# En Fargate se lanza vía `aws ecs run-task` con la misma imagen.
CMD ["node", "dist/main"]
EXPOSE 3001
