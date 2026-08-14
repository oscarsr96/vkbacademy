import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ExecutionContext } from '@nestjs/common';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { buildThrottlerOptions, buildTracker } from './throttler-options.factory';

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

  it('la configuración incluye un tracker propio (si no, el cupo sería por IP)', () => {
    const config = {
      get: jest.fn((key: string) => (key === 'JWT_SECRET' ? 'secreto-de-test' : undefined)),
    } as unknown as ConfigService;

    expect(typeof buildThrottlerOptions(config).getTracker).toBe('function');
  });
});

/**
 * I4 — El cupo debe contarse por alumno, no por IP: dos hermanos en casa
 * comparten IP, y un grupo estudiando en el club también. Con el límite
 * agotado el front revela la solución igualmente y los aciertos del alumno
 * dejan de registrarse, así que el fallo es invisible hasta que se queja.
 */
describe('buildTracker', () => {
  const SECRET = 'secreto-de-test';
  const jwt = new JwtService();
  const tracker = buildTracker(jwt, SECRET);
  // El tracker de @nestjs/throttler recibe (req, context); el context no se usa.
  const ctx = {} as ExecutionContext;

  function tokenFor(sub: string, secret = SECRET): string {
    return jwt.sign({ sub }, { secret, expiresIn: '15m' });
  }

  it('cuenta por usuario cuando la petición lleva un token válido', () => {
    const req = {
      ip: '1.2.3.4',
      headers: { authorization: `Bearer ${tokenFor('alumno-1')}` },
    };

    expect(tracker(req, ctx)).toBe('user:alumno-1');
  });

  it('dos alumnos desde la MISMA IP no comparten cupo', () => {
    const ip = '90.0.0.1';
    const hermanoA = { ip, headers: { authorization: `Bearer ${tokenFor('alumno-1')}` } };
    const hermanoB = { ip, headers: { authorization: `Bearer ${tokenFor('alumno-2')}` } };

    expect(tracker(hermanoA, ctx)).not.toBe(tracker(hermanoB, ctx));
  });

  it('el mismo alumno desde dos dispositivos SÍ comparte cupo', () => {
    const movil = { ip: '10.0.0.1', headers: { authorization: `Bearer ${tokenFor('alumno-1')}` } };
    const portatil = {
      ip: '10.0.0.2',
      headers: { authorization: `Bearer ${tokenFor('alumno-1')}` },
    };

    expect(tracker(movil, ctx)).toBe(tracker(portatil, ctx));
  });

  it('cae a la IP en rutas anónimas (login, registro, páginas públicas)', () => {
    expect(tracker({ ip: '1.2.3.4', headers: {} }, ctx)).toBe('ip:1.2.3.4');
  });

  it('cae a la IP —no a un usuario inventado— si el token no está firmado con nuestro secreto', () => {
    const forjado = tokenFor('alumno-1', 'otro-secreto');

    expect(tracker({ ip: '1.2.3.4', headers: { authorization: `Bearer ${forjado}` } }, ctx)).toBe(
      'ip:1.2.3.4',
    );
  });

  it('cae a la IP si el Authorization no es un Bearer o el token es basura', () => {
    expect(tracker({ ip: '1.2.3.4', headers: { authorization: 'Basic abc' } }, ctx)).toBe(
      'ip:1.2.3.4',
    );
    expect(tracker({ ip: '1.2.3.4', headers: { authorization: 'Bearer no-es-un-jwt' } }, ctx)).toBe(
      'ip:1.2.3.4',
    );
  });

  it('detrás de proxy usa la primera IP de la cadena, como el tracker por defecto', () => {
    expect(tracker({ ips: ['7.7.7.7', '10.0.0.1'], ip: '10.0.0.1', headers: {} }, ctx)).toBe(
      'ip:7.7.7.7',
    );
  });

  it('nunca colisiona un id de usuario con una IP (prefijos distintos)', () => {
    const porIp = tracker({ ip: 'alumno-1', headers: {} }, ctx);
    const porUsuario = tracker(
      { ip: '1.2.3.4', headers: { authorization: `Bearer ${tokenFor('alumno-1')}` } },
      ctx,
    );

    expect(porIp).not.toBe(porUsuario);
  });
});
