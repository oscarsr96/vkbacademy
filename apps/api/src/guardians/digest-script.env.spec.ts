import { digestEnvValidationSchema } from './digest-script.env';

// Entorno mínimo con el que el envío del resumen semanal debe arrancar.
const VALID_MIN_ENV = {
  DATABASE_URL: 'postgresql://user:pass@host:5432/db',
  RESEND_API_KEY: 're_test_123',
  FRONTEND_URL: 'https://vkbacademy-pre.vercel.app',
};

const validate = (env: Record<string, unknown>) =>
  digestEnvValidationSchema.validate(env, { allowUnknown: true, abortEarly: false });

describe('digestEnvValidationSchema', () => {
  it('acepta el entorno mínimo sin secretos JWT', () => {
    const { error, value } = validate(VALID_MIN_ENV);
    expect(error).toBeUndefined();
    expect(value.EMAIL_FROM).toBe('VKB Academy <info@vallekasbasket.com>');
  });

  it('exige RESEND_API_KEY: sin ella el envío terminaría en verde sin escribir a nadie', () => {
    const { RESEND_API_KEY: _omit, ...env } = VALID_MIN_ENV;
    const { error } = validate(env);
    expect(error).toBeDefined();
    expect(error!.message).toContain('RESEND_API_KEY');
  });

  it('exige FRONTEND_URL explícito: sin ella el enlace de baja apuntaría a localhost', () => {
    const { FRONTEND_URL: _omit, ...env } = VALID_MIN_ENV;
    const { error } = validate(env);
    expect(error).toBeDefined();
    expect(error!.message).toContain('FRONTEND_URL');
  });

  it('exige DATABASE_URL con esquema postgres', () => {
    const { error } = validate({ ...VALID_MIN_ENV, DATABASE_URL: 'mysql://x' });
    expect(error).toBeDefined();
    expect(error!.message).toContain('DATABASE_URL');
  });

  it('rechaza un EMAIL_FROM que no sea una dirección', () => {
    const { error } = validate({ ...VALID_MIN_ENV, EMAIL_FROM: 'sin-arroba' });
    expect(error).toBeDefined();
    expect(error!.message).toContain('EMAIL_FROM');
  });
});
