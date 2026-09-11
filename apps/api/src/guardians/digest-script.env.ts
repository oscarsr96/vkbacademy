import * as Joi from 'joi';
import { envValidationSchema } from '../config/env.schema';

/**
 * Variables que necesita el envío del resumen semanal cuando corre fuera de la
 * API (`scripts/send-weekly-digest.ts` desde GitHub Actions).
 *
 * Es deliberadamente más corto que `envValidationSchema`: el script no firma
 * tokens ni sirve HTTP, así que no tiene sentido exigir JWT_SECRET y compañía
 * ni duplicar esos secretos en GitHub. A cambio es más estricto en lo suyo:
 *
 * - `RESEND_API_KEY` es obligatoria. En la API es opcional porque sin ella
 *   solo se apagan los emails; aquí el email es el único cometido, y un envío
 *   "en verde" que no escribe a nadie es peor que un fallo en arranque.
 * - `FRONTEND_URL` es obligatoria siempre, no solo en producción: sin ella
 *   el enlace de baja del correo apuntaría a localhost.
 *
 * `DATABASE_URL` y `EMAIL_FROM` reutilizan la regla de la API para que no
 * diverjan.
 */
export const digestEnvValidationSchema = Joi.object({
  DATABASE_URL: envValidationSchema.extract('DATABASE_URL'),
  RESEND_API_KEY: Joi.string().required(),
  EMAIL_FROM: envValidationSchema.extract('EMAIL_FROM'),
  FRONTEND_URL: Joi.string().uri({ scheme: ['http', 'https'] }).required(),
});
