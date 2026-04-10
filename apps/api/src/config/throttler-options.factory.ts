import { ConfigService } from '@nestjs/config';
import { ThrottlerOptions, ThrottlerStorage } from '@nestjs/throttler';
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
  storage?: ThrottlerStorage;
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

  const redisUrl = config.get<string>('REDIS_URL');
  if (!redisUrl) {
    return { throttlers };
  }

  // `lazyConnect: true` evita abrir socket a Redis durante los tests que
  // instancian el módulo sin un Redis real disponible.
  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
  });
  const storage = new ThrottlerStorageRedisService(redis);

  return { throttlers, storage };
}
