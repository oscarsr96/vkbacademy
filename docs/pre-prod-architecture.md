# Arquitectura PRE + PROD — Fase A (Camino 1)

## Arquitectura desplegada

```
                    ┌─────────────────────────────┐
                    │     GitHub Actions CI/CD     │
                    │  deploy-pipeline.yml (8 jobs)│
                    └──────┬──────────────┬────────┘
                           │              │
              ┌────────────▼──┐    ┌──────▼───────────┐
              │     PRE       │    │      PROD         │
              ├───────────────┤    ├──────────────────┤
              │               │    │                   │
    ┌─────────▼─────────┐     │    │  ┌───────────────▼──────────┐
    │ Vercel             │     │    │  │ Vercel                    │
    │ vkbacademy-pre     │     │    │  │ vkbacademy                │
    │ .vercel.app        │     │    │  │ .vercel.app               │
    └────────────────────┘     │    │  └────────────────────────────┘
                               │    │
    ┌─────────────────────┐    │    │  ┌────────────────────────────┐
    │ Render (free)        │    │    │  │ Render (free)               │
    │ vkbacademy-api-pre   │    │    │  │ vkbacademy-api-prod         │
    │ .onrender.com        │    │    │  │ .onrender.com               │
    │ Docker / Frankfurt   │    │    │  │ Docker / Frankfurt          │
    └──────────┬───────────┘    │    │  └──────────┬─────────────────┘
               │                │    │             │
    ┌──────────▼───────────┐    │    │  ┌──────────▼─────────────────┐
    │ Neon Postgres (free)  │    │    │  │ Neon Postgres (free)        │
    │ vkbacademy-pre        │    │    │  │ vkbacademy-prod             │
    │ EU Frankfurt          │    │    │  │ EU Frankfurt                │
    │ Serverless, v16       │    │    │  │ Serverless, v16             │
    └───────────────────────┘    │    │  └─────────────────────────────┘
                                 │    │
              └──────────────────┘    └──────────────────┘
```

## URLs por entorno

| Entorno  | Capa | URL                                                             |
| -------- | ---- | --------------------------------------------------------------- |
| **PRE**  | Web  | `https://vkbacademy-pre.vercel.app`                             |
| **PRE**  | API  | `https://vkbacademy-api-pre.onrender.com`                       |
| **PRE**  | BD   | `ep-rough-bird-al6sz08a.c-3.eu-central-1.aws.neon.tech`         |
| **PROD** | Web  | `https://vkbacademy.vercel.app`                                 |
| **PROD** | API  | `https://vkbacademy-api-prod.onrender.com`                      |
| **PROD** | BD   | `ep-spring-rice-alh3k59a-pooler.c-3.eu-central-1.aws.neon.tech` |

## Pipeline (8 jobs)

```
push main
  └─► test (unit + lint + build)
        └─► migrate-pre (Prisma → Neon PRE)
              └─► deploy-pre (Render API + Vercel CLI)
                    └─► smoke-pre (6 checks, 35s timeout)
                          └─► migrate-prod [⏸ aprobación oscarsr96]
                                └─► deploy-prod (Render API + Vercel CLI)
                                      └─► smoke-prod (6 checks)
                                            └─► promote-prod [⏸ aprobación oscarsr96]
```

**Deploy API**: `POST https://api.render.com/v1/services/{id}/deploys` + polling cada 15s hasta `live` (timeout 10min).

**Deploy Web**: `vercel pull` → `vercel build --prod` → `vercel deploy --prebuilt --prod` con `VERCEL_PROJECT_ID` distinto por entorno.

## Secrets y variables en GitHub

### Repository secrets

| Secret                   | Valor                              | Uso                   |
| ------------------------ | ---------------------------------- | --------------------- |
| `VERCEL_TOKEN`           | Token cuenta Vercel                | Deploy web PRE y PROD |
| `VERCEL_ORG_ID`          | `team_0WYYdzb0Mz9DK10A9VQej5DM`    | Scope Vercel          |
| `VERCEL_PROJECT_ID_PRE`  | `prj_vmbKamtJW1SwQTlpVAH4n6Pn20Q5` | Deploy web PRE        |
| `VERCEL_PROJECT_ID_PROD` | `prj_PaudNYhTIKo9fAUjhyMh6P02274V` | Deploy web PROD       |
| `RENDER_API_KEY`         | Token API Render                   | Deploy API PRE y PROD |
| `RENDER_SERVICE_ID_PRE`  | `srv-d7cafvt8nd3s73fasrt0`         | Deploy API PRE        |
| `RENDER_SERVICE_ID_PROD` | `srv-d7d8gfi8qa3s73bg61dg`         | Deploy API PROD       |
| `DATABASE_URL_PRE`       | Connection string Neon PRE         | Referencia            |

### Environment `pre`

| Tipo     | Nombre          | Valor                                     |
| -------- | --------------- | ----------------------------------------- |
| Secret   | `DATABASE_URL`  | Connection string Neon PRE                |
| Variable | `SMOKE_API_URL` | `https://vkbacademy-api-pre.onrender.com` |
| Variable | `SMOKE_WEB_URL` | `https://vkbacademy-pre.vercel.app`       |

### Environment `prod-canary`

| Tipo       | Nombre            | Valor                                      |
| ---------- | ----------------- | ------------------------------------------ |
| Secret     | `DATABASE_URL`    | Connection string Neon PROD                |
| Variable   | `SMOKE_API_URL`   | `https://vkbacademy-api-prod.onrender.com` |
| Variable   | `SMOKE_WEB_URL`   | `https://vkbacademy.vercel.app`            |
| Protection | Required reviewer | `oscarsr96`                                |

### Environment `prod`

| Tipo       | Nombre            | Valor                                      |
| ---------- | ----------------- | ------------------------------------------ |
| Secret     | `DATABASE_URL`    | Connection string Neon PROD                |
| Variable   | `SMOKE_API_URL`   | `https://vkbacademy-api-prod.onrender.com` |
| Variable   | `SMOKE_WEB_URL`   | `https://vkbacademy.vercel.app`            |
| Protection | Required reviewer | `oscarsr96`                                |

## Env vars en Render

### `vkbacademy-api-pre`

| Variable                 | Valor                                           |
| ------------------------ | ----------------------------------------------- |
| `DATABASE_URL`           | Neon PRE connection string                      |
| `NODE_ENV`               | `production`                                    |
| `PORT`                   | `3001`                                          |
| `JWT_SECRET`             | Generado con `openssl rand -hex 32` (único PRE) |
| `JWT_REFRESH_SECRET`     | Generado con `openssl rand -hex 32` (único PRE) |
| `JWT_EXPIRES_IN`         | `15m`                                           |
| `JWT_REFRESH_EXPIRES_IN` | `7d`                                            |
| `FRONTEND_URL`           | `https://vkbacademy-pre.vercel.app`             |

### `vkbacademy-api-prod`

| Variable                 | Valor                                            |
| ------------------------ | ------------------------------------------------ |
| `DATABASE_URL`           | Neon PROD connection string                      |
| `NODE_ENV`               | `production`                                     |
| `PORT`                   | `3001`                                           |
| `JWT_SECRET`             | Generado con `openssl rand -hex 32` (único PROD) |
| `JWT_REFRESH_SECRET`     | Generado con `openssl rand -hex 32` (único PROD) |
| `JWT_EXPIRES_IN`         | `15m`                                            |
| `JWT_REFRESH_EXPIRES_IN` | `7d`                                             |
| `FRONTEND_URL`           | `https://vkbacademy.vercel.app`                  |

### Env vars en Vercel

| Proyecto         | Variable       | Valor                                         |
| ---------------- | -------------- | --------------------------------------------- |
| `vkbacademy-pre` | `VITE_API_URL` | `https://vkbacademy-api-pre.onrender.com/api` |
| `vkbacademy`     | `VITE_API_URL` | Configurado desde Fase 9                      |

## Coste (Fase A)

| Servicio    | Plan  | Coste                    |
| ----------- | ----- | ------------------------ |
| Vercel PRE  | Hobby | $0                       |
| Vercel PROD | Hobby | $0                       |
| Render PRE  | Free  | $0 (sleep tras 15min)    |
| Render PROD | Free  | $0 (sleep tras 15min)    |
| Neon PRE    | Free  | $0 (0.5GB, auto-suspend) |
| Neon PROD   | Free  | $0 (0.5GB, auto-suspend) |
| **Total**   |       | **$0/mes**               |

## Notas operativas

- **Cold start Render**: ~30s la primera request tras 15min idle. El pipeline usa retry con 20 intentos x 15s antes de los smoke tests.
- **Auto-suspend Neon**: la BD se suspende tras 5min sin conexiones. Reactivacion automatica <1s.
- **JWT secrets separados**: PRE y PROD tienen secrets JWT distintos. Un token generado en PRE no funciona en PROD y viceversa (intencional).
- **BDs independientes**: cada entorno tiene su propia BD Neon. Las migraciones se aplican por separado en jobs dedicados del pipeline.
- **Auto-deploy desactivado**: ambos servicios Render tienen `autoDeploy: no`. Los deploys solo se lanzan desde el pipeline de GitHub Actions.

## Plan de fases (escalabilidad)

### Fase A — HOY (0-10 academias, <500 alumnos) — $0/mes

Stack actual: Vercel + Render free + Neon free.

### Fase B — TRACCION (10-30 academias, ~5k alumnos) — ~$80-120/mes

- API migra a **AWS ECS Fargate** (1-3 tasks, autoscale)
- BD migra a **Aurora Serverless v2** (0.5 ACU min)
- Redis: **ElastiCache** t4g.micro o Upstash
- Terraform cambia providers y re-aplica

### Fase C — ESCALA (100+ academias, 50k alumnos) — ~$400-700/mes

- Fargate 2-10 tasks en 2 AZ
- Aurora 1-4 ACU + replica de lectura
- SQS + worker para jobs async
- CloudFront para videos firmados
- Cloudflare Pro + Sentry paid
- SLA 99.9%, RPO<1h, RTO<15min

## Refactors de codigo incluidos

1. **Validacion Joi de env** (`apps/api/src/config/env.schema.ts`) — 16 vars, aborta arranque si falta secreto. 10 tests.
2. **Rate limiting distribuido** (`apps/api/src/config/throttler-options.factory.ts`) — in-memory sin `REDIS_URL`, Redis con `REDIS_URL`. 2 tests.
3. **Migraciones fuera del Dockerfile CMD** — `CMD ["node", "dist/main"]`, jobs `migrate-pre`/`migrate-prod` en pipeline. 3 tests de regresion.
4. **Health endpoint** (`GET /api/health`) — publico, sin BD. 2 tests.

## Smoke tests

Suite en `apps/api/test/smoke/health.smoke-spec.ts` con 6 checks:

1. `GET /api/health` → 200 con `{status: "ok"}`
2. `GET /api/courses` sin token → 401 (guard activo)
3. `POST /api/auth/login` con creds falsas → 401
4. `GET /api/academies/by-slug/vallekas-basket` → 200 o 404 (no 5xx)
5. `GET /` (web) → 200 HTML SPA con `<div id="root">`
6. `GET /ruta-inexistente` → 200 SPA rewrite

Ejecutar localmente:

```bash
SMOKE_API_URL=https://vkbacademy-api-pre.onrender.com \
SMOKE_WEB_URL=https://vkbacademy-pre.vercel.app \
pnpm --filter @vkbacademy/api test:smoke
```
