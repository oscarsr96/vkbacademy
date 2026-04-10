import { ConfigService } from '@nestjs/config';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { buildThrottlerOptions } from './throttler-options.factory';

/**
 * Verifica que la factory del ThrottlerModule:
 *  - Usa almacenamiento en memoria cuando REDIS_URL NO está definido (dev local)
 *  - Usa almacenamiento en Redis cuando REDIS_URL SÍ está definido (PRE/PROD)
 *
 * Esto desbloquea el rate limiting distribuido entre múltiples instancias
 * de la API, requisito obligatorio para la Fase B (ECS Fargate con >1 task).
 */
describe('buildThrottlerOptions', () => {
  it('devuelve configuración sin storage cuando REDIS_URL no está definido', () => {
    const config = {
      get: jest.fn((key: string) => (key === 'REDIS_URL' ? undefined : undefined)),
    } as unknown as ConfigService;

    const options = buildThrottlerOptions(config);

    expect(options.throttlers).toEqual([expect.objectContaining({ ttl: 60000, limit: 100 })]);
    expect(options.storage).toBeUndefined();
  });

  it('devuelve configuración con ThrottlerStorageRedisService cuando REDIS_URL está definido', () => {
    const config = {
      get: jest.fn((key: string) => (key === 'REDIS_URL' ? 'redis://localhost:6379' : undefined)),
    } as unknown as ConfigService;

    const options = buildThrottlerOptions(config);

    expect(options.throttlers).toEqual([expect.objectContaining({ ttl: 60000, limit: 100 })]);
    expect(options.storage).toBeInstanceOf(ThrottlerStorageRedisService);
  });
});
