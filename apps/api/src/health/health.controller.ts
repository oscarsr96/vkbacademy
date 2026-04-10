import { Controller, Get } from '@nestjs/common';

/**
 * Endpoint público de health check.
 *
 * Lo usan:
 *  - Las probes de Railway/Vercel durante el despliegue (readiness)
 *  - Los smoke tests del pipeline PRE → PROD (`apps/api/test/smoke`)
 *  - Uptime monitors externos
 *
 * No consulta la BD a propósito: un fallo de Postgres no debe tumbar la probe
 * (para eso están las alertas dedicadas); el health sólo confirma que el
 * proceso Node está vivo y sirviendo HTTP. Tampoco lleva JwtAuthGuard —
 * debe ser accesible sin token.
 */
@Controller('health')
export class HealthController {
  @Get()
  check(): {
    status: 'ok';
    timestamp: string;
    uptime: number;
    node: string;
    env: string;
  } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      node: process.version,
      env: process.env.NODE_ENV ?? 'development',
    };
  }
}
