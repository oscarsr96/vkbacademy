import * as Joi from 'joi';

/**
 * Schema de validación de variables de entorno.
 *
 * Se enchufa a `ConfigModule.forRoot({ validationSchema, validationOptions })`
 * en `app.module.ts`. Si una variable obligatoria falta o tiene un valor
 * inválido, NestJS **aborta el arranque con un mensaje descriptivo**. Esto
 * evita deploys rotos por una variable mal escrita en Render/Railway/AWS.
 *
 * Reglas:
 * - `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET` son obligatorios
 *   siempre.
 * - Los secretos JWT exigen ≥32 caracteres (equivalente a 256 bits de
 *   entropía tras base64). Si fallan, `openssl rand -hex 32`.
 * - En `NODE_ENV=production` se exige `FRONTEND_URL` explícito (evita que
 *   CORS caiga a `localhost:5173` en PROD).
 * - Los defaults están pensados para desarrollo local con docker-compose.
 *
 * Al añadir una variable nueva: regístrala aquí y, si es obligatoria,
 * documéntala en `CLAUDE.md §9`.
 */
export const envValidationSchema = Joi.object({
  // ── Entorno ────────────────────────────────────────────────────────────────
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3001),

  // ── Base de datos ──────────────────────────────────────────────────────────
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),

  // ── Redis (opcional en Fase A, obligatorio a partir de multi-instancia) ────
  REDIS_URL: Joi.string()
    .uri({ scheme: ['redis', 'rediss'] })
    .optional(),

  // ── JWT ────────────────────────────────────────────────────────────────────
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // ── Frontend / CORS ────────────────────────────────────────────────────────
  // En producción debe venir explícito; en desarrollo cae a localhost.
  FRONTEND_URL: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.string().required(),
    otherwise: Joi.string().default('http://localhost:5173'),
  }),

  // ── AWS S3 (vídeos) ────────────────────────────────────────────────────────
  AWS_REGION: Joi.string().default('eu-west-1'),
  AWS_ACCESS_KEY_ID: Joi.string().allow('').optional(),
  AWS_SECRET_ACCESS_KEY: Joi.string().allow('').optional(),
  AWS_S3_BUCKET: Joi.string().allow('').optional(),
  AWS_SIGNED_URL_EXPIRES: Joi.number().integer().min(60).default(3600),

  // ── Email (Resend) ─────────────────────────────────────────────────────────
  RESEND_API_KEY: Joi.string().allow('').optional(),
  // Acepta tanto "user@dominio" plano como "Display Name <user@dominio>" (Resend soporta ambos).
  EMAIL_FROM: Joi.string()
    .pattern(/^(?:[^<>]+\s*<[^@<>\s]+@[^@<>\s]+>|[^@<>\s]+@[^@<>\s]+)$/)
    .default('VKB Academy <info@vallekasbasket.com>'),

  // ── Videollamadas (Daily.co) ───────────────────────────────────────────────
  DAILY_API_KEY: Joi.string().allow('').optional(),

  // ── IA (generación de cursos) ───────────────────────────────────────────────
  // Gemini 2.0 Flash (primary, gratis) + Claude Haiku (fallback, pago)
  GEMINI_API_KEY: Joi.string().allow('').optional(),
  ANTHROPIC_API_KEY: Joi.string().allow('').optional(),
  AI_PROVIDER: Joi.string().valid('gemini', 'haiku', 'auto').default('auto'),

  // ── Vercel (registro dinámico de dominios para multi-tenancy) ──────────────
  VERCEL_TOKEN: Joi.string().allow('').optional(),
  VERCEL_PROJECT_ID: Joi.string().allow('').optional(),
}).unknown(true); // Permite vars extra (PATH, HOME, GitHub Actions vars, etc.)
