import {
  createApp,
  closeApp,
  login,
  authGet,
  authPatch,
  publicGet,
  publicPost,
} from './setup';

describe('Users — /users', () => {
  let studentToken: string;

  beforeAll(async () => {
    await createApp();

    const s = await login('student@vkbacademy.com');
    studentToken = s.accessToken;
  });

  afterAll(async () => {
    await closeApp();
  });

  // ─── GET /users/me ─────────────────────────────────────────────────────────

  describe('GET /users/me', () => {
    it('devuelve 401 sin token', async () => {
      const res = await publicGet('/users/me');
      expect(res.status).toBe(401);
    });

    it('devuelve 200 y el perfil del STUDENT autenticado', async () => {
      const res = await authGet('/users/me', studentToken);
      expect(res.status).toBe(200);
    });

    it('no incluye passwordHash en la respuesta', async () => {
      const res = await authGet('/users/me', studentToken);

      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('incluye id, email, name y role en la respuesta', async () => {
      const res = await authGet('/users/me', studentToken);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('email', 'student@vkbacademy.com');
      expect(res.body).toHaveProperty('name');
      expect(res.body).toHaveProperty('role', 'STUDENT');
    });
  });

  // ─── PATCH /users/me ───────────────────────────────────────────────────────

  describe('PATCH /users/me', () => {
    it('devuelve 401 sin token', async () => {
      // authPatch con cadena vacía → el guard JWT rechaza la request
      const res = await authPatch('/users/me', '', { name: 'sin-token' });
      expect(res.status).toBe(401);
    });

    it('actualiza el nombre correctamente', async () => {
      // Usuario nuevo para no mutar el seed
      const reg = await publicPost('/auth/register', {
        email: 'e2e-user-patch-name@test.com',
        password: 'password123',
        name: 'nombre-original',
      });
      expect(reg.status).toBe(201);
      const token = reg.body.accessToken;

      const res = await authPatch('/users/me', token, {
        name: 'nombre-actualizado',
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('name', 'nombre-actualizado');
    });

    it('actualiza el nombre y GET /users/me refleja el cambio', async () => {
      const reg = await publicPost('/auth/register', {
        email: 'e2e-user-patch-verify@test.com',
        password: 'password123',
        name: 'antes-del-cambio',
      });
      expect(reg.status).toBe(201);
      const token = reg.body.accessToken;

      await authPatch('/users/me', token, { name: 'despues-del-cambio' });

      const res = await authGet('/users/me', token);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('name', 'despues-del-cambio');
    });

    it('devuelve 400 si el email nuevo ya está en uso por otro usuario', async () => {
      const reg = await publicPost('/auth/register', {
        email: 'e2e-user-patch-email@test.com',
        password: 'password123',
        name: 'usuario-email-patch',
      });
      expect(reg.status).toBe(201);
      const token = reg.body.accessToken;

      // Intentar tomar el email del usuario seed
      const res = await authPatch('/users/me', token, {
        email: 'student@vkbacademy.com',
      });

      expect(res.status).toBe(400);
    });
  });
});
