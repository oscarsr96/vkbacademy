import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerGetTrackerFunction, ThrottlerOptions, ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';

/**
 * Forma narrow del objeto devuelto por la factory, que incluye siempre
 * `throttlers` y opcionalmente `storage`. Usamos un tipo narrow en vez
 * de `ThrottlerModuleOptions` (que es un union con `Array<ThrottlerOptions>`)
 * para permitir acceso directo a las propiedades en tests y en el módulo.
 */
export interface ResolvedThrottlerOptions {
  throttlers: ThrottlerOptions[];
  getTracker: ThrottlerGetTrackerFunction;
  storage?: ThrottlerStorage;
}

/** Forma mínima de la request que necesita el tracker (Express). */
interface TrackedRequest {
  ips?: string[];
  ip?: string;
  headers?: Record<string, unknown>;
}

/**
 * Identidad contra la que se cuentan las peticiones.
 *
 * Por defecto `@nestjs/throttler` cuenta por IP, y eso en este producto
 * significa que dos hermanos en casa comparten el cupo y que un grupo
 * estudiando en el club lo comparte entre todos: al agotarse, sus intentos
 * de ejercicio dejan de registrarse y sus aciertos no cuentan.
 *
 * El guard global corre ANTES que `JwtAuthGuard`, así que `req.user` todavía
 * no existe: hay que sacar el usuario del propio Authorization. Se verifica
 * la firma (no basta con decodificar: cualquiera podría inventarse un `sub`
 * y estrenar cupo). Si no hay token válido — rutas públicas, login, token
 * caducado — se vuelve a la IP, que es lo correcto para tráfico anónimo.
 */
export function buildTracker(jwt: JwtService, secret?: string): ThrottlerGetTrackerFunction {
  return (req: Record<string, unknown>): string => {
    const request = req as TrackedRequest;
    const userId = secret ? verifiedUserId(jwt, request, secret) : null;
    if (userId) return `user:${userId}`;
    // El tracker por defecto de @nestjs/throttler devuelve `req.ip` a secas.
    // Aquí se prefiere la primera IP de la cadena cuando Express la expone
    // (`trust proxy`): detrás del proxy de Render, `req.ip` sería la del
    // proxy y todo el tráfico anónimo compartiría un único cupo.
    const ip = request.ips?.length ? request.ips[0] : (request.ip ?? 'unknown');
    return `ip:${ip}`;
  };
}

function verifiedUserId(jwt: JwtService, req: TrackedRequest, secret: string): string | null {
  const header = req.headers?.authorization;
  if (typeof header !== 'string' || !header.toLowerCase().startsWith('bearer ')) return null;
  try {
    const payload = jwt.verify<{ sub?: unknown }>(header.slice(7).trim(), { secret });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    // Token inválido o caducado: la petición la rechazará JwtAuthGuard, pero
    // hasta entonces cuenta contra la IP, no contra un usuario inventado.
    return null;
  }
}

/**
 * Construye la configuración del ThrottlerModule.
 *
 * - En desarrollo local (sin `REDIS_URL`) usa el almacenamiento en memoria
 *   por defecto de `@nestjs/throttler`. Es suficiente mientras solo haya
 *   una instancia de la API.
 * - En PRE/PROD con `REDIS_URL` definido, usa `ThrottlerStorageRedisService`
 *   para compartir el contador entre todas las instancias de la API. Sin
 *   esto, cada instancia tendría su propio contador y los límites serían
 *   efectivamente (N × limit) donde N = nº de instancias.
 *
 * A partir de Fase B (ECS Fargate con >1 task) `REDIS_URL` es OBLIGATORIO.
 * En la Fase A (Render con una única instancia) es opcional, pero conviene
 * activarlo ya en PRE para detectar problemas pronto.
 */
export function buildThrottlerOptions(config: ConfigService): ResolvedThrottlerOptions {
  const throttlers: ThrottlerOptions[] = [
    {
      ttl: 60000, // 1 minuto
      limit: 100, // 100 requests por minuto
    },
  ];

  // El cupo se cuenta por usuario autenticado (ver buildTracker), no por IP.
  const getTracker = buildTracker(new JwtService(), config.get<string>('JWT_SECRET'));

  const redisUrl = config.get<string>('REDIS_URL');
  if (!redisUrl) {
    return { throttlers, getTracker };
  }

  // `lazyConnect: true` evita abrir socket a Redis durante los tests que
  // instancian el módulo sin un Redis real disponible.
  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
  });
  const storage = new ThrottlerStorageRedisService(redis);

  return { throttlers, getTracker, storage };
}
