import { envValidationSchema } from './env.schema';

/**
 * Tests del schema de validación de variables de entorno.
 *
 * El objetivo es garantizar que:
 *  1. Un arranque con variables inválidas falla rápido y con mensaje claro
 *  2. Los valores por defecto se aplican cuando la variable es opcional
 *  3. Los secretos críticos (JWT_*, DATABASE_URL) son obligatorios
 */
describe('envValidationSchema', () => {
  const VALID_MIN_ENV = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    JWT_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
  };

  it('acepta una configuración mínima con los secretos obligatorios', () => {
    const { error, value } = envValidationSchema.validate(VALID_MIN_ENV, {
      allowUnknown: true,
      abortEarly: false,
    });

    expect(error).toBeUndefined();
    // Defaults aplicados
    expect(value.NODE_ENV).toBe('development');
    expect(value.PORT).toBe(3001);
    expect(value.JWT_EXPIRES_IN).toBe('15m');
    expect(value.JWT_REFRESH_EXPIRES_IN).toBe('7d');
    expect(value.AWS_REGION).toBe('eu-west-1');
    expect(value.AWS_SIGNED_URL_EXPIRES).toBe(3600);
  });

  it('rechaza cuando falta DATABASE_URL', () => {
    const { DATABASE_URL: _ignored, ...env } = VALID_MIN_ENV;
    const { error } = envValidationSchema.validate(env, { abortEarly: false });

    expect(error).toBeDefined();
    expect(error!.message).toContain('DATABASE_URL');
  });

  it('rechaza cuando falta JWT_SECRET', () => {
    const { JWT_SECRET: _ignored, ...env } = VALID_MIN_ENV;
    const { error } = envValidationSchema.validate(env, { abortEarly: false });

    expect(error).toBeDefined();
    expect(error!.message).toContain('JWT_SECRET');
  });

  it('rechaza cuando falta JWT_REFRESH_SECRET', () => {
    const { JWT_REFRESH_SECRET: _ignored, ...env } = VALID_MIN_ENV;
    const { error } = envValidationSchema.validate(env, { abortEarly: false });

    expect(error).toBeDefined();
    expect(error!.message).toContain('JWT_REFRESH_SECRET');
  });

  it('rechaza JWT_SECRET con menos de 32 caracteres (secreto débil)', () => {
    const { error } = envValidationSchema.validate(
      { ...VALID_MIN_ENV, JWT_SECRET: 'short' },
      { abortEarly: false },
    );

    expect(error).toBeDefined();
    expect(error!.message).toContain('JWT_SECRET');
  });

  it('rechaza un DATABASE_URL que no es una URI postgres válida', () => {
    const { error } = envValidationSchema.validate(
      { ...VALID_MIN_ENV, DATABASE_URL: 'no-es-una-uri' },
      { abortEarly: false },
    );

    expect(error).toBeDefined();
    expect(error!.message).toContain('DATABASE_URL');
  });

  it('rechaza un NODE_ENV fuera del enum', () => {
    const { error } = envValidationSchema.validate(
      { ...VALID_MIN_ENV, NODE_ENV: 'staging-rara' },
      { abortEarly: false },
    );

    expect(error).toBeDefined();
    expect(error!.message).toContain('NODE_ENV');
  });

  it('acepta REDIS_URL opcional', () => {
    const { error, value } = envValidationSchema.validate(
      { ...VALID_MIN_ENV, REDIS_URL: 'redis://localhost:6379' },
      { abortEarly: false },
    );

    expect(error).toBeUndefined();
    expect(value.REDIS_URL).toBe('redis://localhost:6379');
  });

  it('rechaza REDIS_URL con protocolo incorrecto', () => {
    const { error } = envValidationSchema.validate(
      { ...VALID_MIN_ENV, REDIS_URL: 'http://localhost:6379' },
      { abortEarly: false },
    );

    expect(error).toBeDefined();
    expect(error!.message).toContain('REDIS_URL');
  });

  it('en producción exige FRONTEND_URL explícito', () => {
    const { error } = envValidationSchema.validate(
      { ...VALID_MIN_ENV, NODE_ENV: 'production' },
      { abortEarly: false },
    );

    expect(error).toBeDefined();
    expect(error!.message).toContain('FRONTEND_URL');
  });
});
