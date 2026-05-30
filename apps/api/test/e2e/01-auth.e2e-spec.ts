import { createApp, closeApp, login, publicGet, publicPost, authPost, getPrisma } from './setup';

describe('Auth — /auth', () => {
  beforeAll(async () => {
    await createApp();
  });

  afterAll(async () => {
    await closeApp();
  });

  // ─── Registro ──────────────────────────────────────────────────────────────

  describe('POST /auth/register', () => {
    it('registra un nuevo usuario correctamente', async () => {
      const res = await publicPost('/auth/register', {
        email: 'nuevo.usuario@test.com',
        password: 'password123',
        name: 'nuevo-usuario',
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.user.email).toBe('nuevo.usuario@test.com');
      expect(res.body.user).not.toHaveProperty('passwordHash');
    });

    it('devuelve 409 si el email ya está registrado', async () => {
      const res = await publicPost('/auth/register', {
        email: 'student@vkbacademy.com',
        password: 'password123',
        name: 'otro-alumno',
      });

      expect(res.status).toBe(409);
    });

    it('devuelve 400 si los datos son inválidos (email malformado)', async () => {
      const res = await publicPost('/auth/register', {
        email: 'no-es-un-email',
        password: 'password123',
        name: 'test',
      });

      expect(res.status).toBe(400);
    });

    it('devuelve 400 si la contraseña es demasiado corta', async () => {
      const res = await publicPost('/auth/register', {
        email: 'valido@test.com',
        password: '123',
        name: 'test',
      });

      expect(res.status).toBe(400);
    });

    it('devuelve 400 si falta el nombre', async () => {
      const res = await publicPost('/auth/register', {
        email: 'sin.nombre@test.com',
        password: 'password123',
      });

      expect(res.status).toBe(400);
    });

    it('registra usuario con academySlug y lo vincula a la academia', async () => {
      const res = await publicPost('/auth/register', {
        email: 'miembro.academia@test.com',
        password: 'password123',
        name: 'miembro-academia',
        academySlug: 'vallekas-basket',
      });

      expect(res.status).toBe(201);
      expect(res.body.user.academyId).not.toBeNull();
      expect(res.body.user.academy?.slug).toBe('vallekas-basket');
    });

    it('registra usuario con academySlug inválido sin error (slug ignorado)', async () => {
      const res = await publicPost('/auth/register', {
        email: 'slug.invalido@test.com',
        password: 'password123',
        name: 'slug-invalido',
        academySlug: 'academia-que-no-existe',
      });

      // El registro no falla, simplemente no vincula academia
      expect(res.status).toBe(201);
      expect(res.body.user.academyId).toBeNull();
    });
  });

  // ─── Login ─────────────────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    it('inicia sesión con email correctamente', async () => {
      const res = await publicPost('/auth/login', {
        identifier: 'student@vkbacademy.com',
        password: 'password123',
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.user.role).toBe('STUDENT');
    });

    it('inicia sesión con username correctamente', async () => {
      const res = await publicPost('/auth/login', {
        identifier: 'juan-garcia',
        password: 'password123',
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
    });

    it('devuelve 401 si la contraseña es incorrecta', async () => {
      const res = await publicPost('/auth/login', {
        identifier: 'student@vkbacademy.com',
        password: 'contraseña-incorrecta',
      });

      expect(res.status).toBe(401);
    });

    it('devuelve 401 si el usuario no existe', async () => {
      const res = await publicPost('/auth/login', {
        identifier: 'noexiste@test.com',
        password: 'password123',
      });

      expect(res.status).toBe(401);
    });

    it('devuelve 400 si falta el identifier', async () => {
      const res = await publicPost('/auth/login', {
        password: 'password123',
      });

      expect(res.status).toBe(400);
    });
  });

  // ─── Refresh tokens ────────────────────────────────────────────────────────

  describe('POST /auth/refresh', () => {
    let refreshToken: string;
    let accessToken: string;

    beforeAll(async () => {
      const data = await login('admin@vkbacademy.com');
      refreshToken = data.refreshToken;
      accessToken = data.accessToken;
    });

    it('renueva los tokens correctamente con un refresh token válido', async () => {
      const res = await publicPost('/auth/refresh', {
        refreshToken,
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      // El nuevo access token debe ser diferente al original
      expect(res.body.accessToken).not.toBe(accessToken);
    });

    it('devuelve 401 al reutilizar el refresh token (rotación de tokens)', async () => {
      // Primer uso: obtener tokens frescos
      const firstRes = await publicPost('/auth/refresh', { refreshToken });

      // El token anterior puede estar ya rotado, pero obtenemos el primero
      const newRefreshToken = firstRes.body.refreshToken;

      // Usar el token nuevo para rotar de nuevo
      await publicPost('/auth/refresh', { refreshToken: newRefreshToken });

      // Intentar reutilizar el token ya consumido
      const reusedRes = await publicPost('/auth/refresh', {
        refreshToken: newRefreshToken,
      });

      expect(reusedRes.status).toBe(401);
    });

    it('devuelve 401 con un refresh token inválido', async () => {
      const res = await publicPost('/auth/refresh', {
        refreshToken: 'token-completamente-falso',
      });

      expect(res.status).toBe(401);
    });
  });

  // ─── Logout ────────────────────────────────────────────────────────────────

  describe('POST /auth/logout', () => {
    it('revoca el refresh token correctamente', async () => {
      const { refreshToken } = await login('teacher@vkbacademy.com');

      const logoutRes = await publicPost('/auth/logout', { refreshToken });
      expect(logoutRes.status).toBe(200);

      // Intentar usar el token revocado
      const refreshRes = await publicPost('/auth/refresh', { refreshToken });
      expect(refreshRes.status).toBe(401);
    });
  });

  // ─── Forgot Password ───────────────────────────────────────────────────────

  describe('POST /auth/forgot-password', () => {
    it('devuelve mensaje genérico para email existente', async () => {
      const res = await publicPost('/auth/forgot-password', {
        email: 'student@vkbacademy.com',
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
    });

    it('devuelve el mismo mensaje genérico para email inexistente (protección de enumeración)', async () => {
      const res = await publicPost('/auth/forgot-password', {
        email: 'noexiste@vkbacademy.com',
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
    });

    it('devuelve 400 si el email no es válido', async () => {
      const res = await publicPost('/auth/forgot-password', {
        email: 'no-es-un-email',
      });

      expect(res.status).toBe(400);
    });
  });

  // ─── Reset Password ────────────────────────────────────────────────────────

  describe('POST /auth/reset-password', () => {
    it('devuelve 400 con un token de reset inválido', async () => {
      const res = await publicPost('/auth/reset-password', {
        token: 'token-invalido-falso',
        password: 'nuevaContraseña123',
      });

      expect([400, 401]).toContain(res.status);
    });

    it('devuelve 400 si la nueva contraseña es demasiado corta', async () => {
      const res = await publicPost('/auth/reset-password', {
        token: 'cualquier-token',
        password: '123',
      });

      expect(res.status).toBe(400);
    });

    it('devuelve 400 con token de reset bien formado pero no existente en BD', async () => {
      // Token con formato válido pero no registrado en el sistema
      const crypto = await import('crypto');
      const fakeToken = crypto.randomBytes(32).toString('hex');

      const res = await publicPost('/auth/reset-password', {
        token: fakeToken,
        password: 'nuevaPassword123',
      });

      expect([400, 401, 404]).toContain(res.status);
    });
  });

  // ─── Registro de tutor con alumnos ───────────────────────────────────────────

  describe('POST /auth/register-tutor', () => {
    let schoolYearId: string;

    beforeAll(async () => {
      // Los niveles son públicos; tomamos uno para asignarlo a los alumnos
      const res = await publicGet('/school-years');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      schoolYearId = res.body[0].id;
    });

    it('registra un tutor con un alumno y hace auto-login del tutor', async () => {
      const res = await publicPost('/auth/register-tutor', {
        name: 'tutor-e2e',
        email: 'tutor.e2e@test.com',
        password: 'password123',
        academySlug: 'vallekas-basket',
        students: [{ name: 'alumno-e2e-uno', schoolYearId }],
      });

      expect(res.status).toBe(201);
      // Auto-login del tutor: tokens + usuario tutor
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.user.role).toBe('TUTOR');
      expect(res.body.user.email).toBe('tutor.e2e@test.com');
      // La respuesta NO expone contraseñas ni datos por alumno
      expect(res.body).not.toHaveProperty('students');
      expect(res.body).not.toHaveProperty('password');
      expect(res.body.user).not.toHaveProperty('passwordHash');
    });

    it('el alumno creado no tiene email y se autentica por username con la contraseña por defecto', async () => {
      const prisma = getPrisma();
      const student = await prisma.user.findFirst({
        where: { name: 'alumno-e2e-uno', role: 'STUDENT' },
        select: { email: true, username: true, mustChangePassword: true },
      });

      expect(student).not.toBeNull();
      expect(student!.email).toBeNull();
      expect(student!.username).toBeTruthy();
      expect(student!.mustChangePassword).toBe(true);

      // Login del alumno por username con la contraseña por defecto 'cambiar123'
      const loginRes = await publicPost('/auth/login', {
        identifier: student!.username,
        password: 'cambiar123',
      });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body).toHaveProperty('accessToken');
      expect(loginRes.body.user.role).toBe('STUDENT');
    });

    it('devuelve 409 si el email del tutor ya está registrado', async () => {
      const res = await publicPost('/auth/register-tutor', {
        name: 'tutor-duplicado',
        email: 'tutor.e2e@test.com',
        password: 'password123',
        academySlug: 'vallekas-basket',
        students: [{ name: 'alumno-duplicado', schoolYearId }],
      });

      expect(res.status).toBe(409);
    });

    it('devuelve 400 si no se registra ningún alumno', async () => {
      const res = await publicPost('/auth/register-tutor', {
        name: 'tutor-sin-alumnos',
        email: 'tutor.sin.alumnos@test.com',
        password: 'password123',
        academySlug: 'vallekas-basket',
        students: [],
      });

      expect(res.status).toBe(400);
    });

    it('devuelve 404 si la academia no existe', async () => {
      const res = await publicPost('/auth/register-tutor', {
        name: 'tutor-academia-invalida',
        email: 'tutor.academia.invalida@test.com',
        password: 'password123',
        academySlug: 'academia-que-no-existe',
        students: [{ name: 'alumno-x', schoolYearId }],
      });

      expect(res.status).toBe(404);
    });
  });

  // ─── Cambio de contraseña forzado ────────────────────────────────────────────

  describe('POST /auth/change-password', () => {
    let schoolYearId: string;

    beforeAll(async () => {
      const res = await publicGet('/school-years');
      schoolYearId = res.body[0].id;
    });

    it('un alumno con mustChangePassword puede cambiar su contraseña y luego usarla', async () => {
      // Registrar un tutor con un alumno fresco
      await publicPost('/auth/register-tutor', {
        name: 'tutor-cambio-pass',
        email: 'tutor.cambio.pass@test.com',
        password: 'password123',
        academySlug: 'vallekas-basket',
        students: [{ name: 'alumno-cambio-pass', schoolYearId }],
      });

      const prisma = getPrisma();
      const student = await prisma.user.findFirst({
        where: { name: 'alumno-cambio-pass', role: 'STUDENT' },
        select: { username: true },
      });
      expect(student?.username).toBeTruthy();

      // Login con la contraseña por defecto
      const loginRes = await publicPost('/auth/login', {
        identifier: student!.username,
        password: 'cambiar123',
      });
      expect(loginRes.status).toBe(200);
      const token = loginRes.body.accessToken;

      // Cambio de contraseña (permitido pese a mustChangePassword)
      const changeRes = await authPost('/auth/change-password', token, {
        newPassword: 'nuevaPassword123',
      });
      expect(changeRes.status).toBe(200);
      expect(changeRes.body).toHaveProperty('message');

      // La nueva contraseña funciona; la antigua ya no
      const newLogin = await publicPost('/auth/login', {
        identifier: student!.username,
        password: 'nuevaPassword123',
      });
      expect(newLogin.status).toBe(200);

      const oldLogin = await publicPost('/auth/login', {
        identifier: student!.username,
        password: 'cambiar123',
      });
      expect(oldLogin.status).toBe(401);
    });

    it('devuelve 401 sin token', async () => {
      const res = await authPost('/auth/change-password', '', {
        newPassword: 'nuevaPassword123',
      });
      expect(res.status).toBe(401);
    });

    it('devuelve 400 si la nueva contraseña es demasiado corta', async () => {
      const { accessToken } = await login('student@vkbacademy.com');
      const res = await authPost('/auth/change-password', accessToken, {
        newPassword: '123',
      });
      expect(res.status).toBe(400);
    });
  });
});
