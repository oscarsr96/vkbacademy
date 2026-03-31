import {
  createApp,
  closeApp,
  login,
  authGet,
  authPost,
  authPatch,
  authDelete,
  publicGet,
  getPrisma,
} from './setup';

describe('Admin — /admin', () => {
  let adminToken: string;
  let superAdminToken: string;
  let studentToken: string;
  let teacherToken: string;

  let createdUserId: string;
  let studentId: string;
  let courseId: string;

  beforeAll(async () => {
    await createApp();

    const [a, sa, s, t] = await Promise.all([
      login('admin@vkbacademy.com'),
      login('superadmin@vkbacademy.com'),
      login('student@vkbacademy.com'),
      login('teacher@vkbacademy.com'),
    ]);

    adminToken = a.accessToken;
    superAdminToken = sa.accessToken;
    studentToken = s.accessToken;
    studentId = s.user.id;
    teacherToken = t.accessToken;

    // Resolver un curso para usar en los tests de matrículas
    const prisma = getPrisma();
    const course = await prisma.course.findFirst({
      where: { title: 'Fundamentos del Baloncesto' },
    });
    courseId = course!.id;
  });

  afterAll(async () => {
    await closeApp();
  });

  // ─── GET /admin/users ──────────────────────────────────────────────────────

  describe('GET /admin/users', () => {
    it('ADMIN puede obtener la lista de usuarios', async () => {
      const res = await authGet('/admin/users', adminToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('SUPER_ADMIN puede obtener la lista de usuarios', async () => {
      const res = await authGet('/admin/users', superAdminToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('STUDENT no puede acceder a los usuarios (403)', async () => {
      const res = await authGet('/admin/users', studentToken);
      expect(res.status).toBe(403);
    });

    it('TEACHER no puede acceder a los usuarios (403)', async () => {
      const res = await authGet('/admin/users', teacherToken);
      expect(res.status).toBe(403);
    });

    it('devuelve 401 sin autenticación', async () => {
      const res = await publicGet('/admin/users');
      expect(res.status).toBe(401);
    });
  });

  // ─── POST /admin/users ─────────────────────────────────────────────────────

  describe('POST /admin/users', () => {
    it('ADMIN crea un nuevo usuario correctamente', async () => {
      const res = await authPost('/admin/users', adminToken, {
        email: 'nuevo.admin.user@test.com',
        name: 'nuevo-admin-user',
        password: 'password123',
        role: 'STUDENT',
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.email).toBe('nuevo.admin.user@test.com');
      expect(res.body.role).toBe('STUDENT');

      createdUserId = res.body.id;
    });

    it('devuelve error si el email ya está en uso', async () => {
      const res = await authPost('/admin/users', adminToken, {
        email: 'student@vkbacademy.com',
        name: 'duplicado',
        password: 'password123',
        role: 'STUDENT',
      });

      expect([400, 409]).toContain(res.status);
    });

    it('devuelve 400 si faltan campos requeridos', async () => {
      const res = await authPost('/admin/users', adminToken, {
        email: 'incompleto@test.com',
        // falta name, password, role
      });

      expect(res.status).toBe(400);
    });

    it('devuelve 400 si el rol es inválido', async () => {
      const res = await authPost('/admin/users', adminToken, {
        email: 'rol.invalido@test.com',
        name: 'rol-invalido',
        password: 'password123',
        role: 'ROL_INEXISTENTE',
      });

      expect(res.status).toBe(400);
    });

    it('STUDENT no puede crear usuarios (403)', async () => {
      const res = await authPost('/admin/users', studentToken, {
        email: 'intento@test.com',
        name: 'intento',
        password: 'password123',
        role: 'STUDENT',
      });

      expect(res.status).toBe(403);
    });
  });

  // ─── PATCH /admin/users/:id/role ───────────────────────────────────────────

  describe('PATCH /admin/users/:id/role', () => {
    it('ADMIN puede cambiar el rol de un usuario', async () => {
      if (!createdUserId) return;

      const res = await authPatch(`/admin/users/${createdUserId}/role`, adminToken, {
        role: 'TEACHER',
      });

      expect(res.status).toBe(200);
      expect(res.body.role).toBe('TEACHER');
    });

    it('devuelve 400 si el rol es inválido', async () => {
      if (!createdUserId) return;

      const res = await authPatch(`/admin/users/${createdUserId}/role`, adminToken, {
        role: 'ROL_INVALIDO',
      });

      expect(res.status).toBe(400);
    });

    it('STUDENT no puede cambiar roles (403)', async () => {
      const res = await authPatch(`/admin/users/${studentId}/role`, studentToken, {
        role: 'ADMIN',
      });

      expect(res.status).toBe(403);
    });
  });

  // ─── DELETE /admin/users/:id ───────────────────────────────────────────────

  describe('DELETE /admin/users/:id', () => {
    it('ADMIN puede eliminar un usuario', async () => {
      if (!createdUserId) return;

      const res = await authDelete(`/admin/users/${createdUserId}`, adminToken);

      expect([200, 204]).toContain(res.status);

      // Verificar que el usuario fue eliminado
      const prisma = getPrisma();
      const deleted = await prisma.user.findUnique({ where: { id: createdUserId } });
      expect(deleted).toBeNull();
    });

    it('devuelve 404 si el usuario no existe', async () => {
      const res = await authDelete('/admin/users/id-que-no-existe', adminToken);
      expect([404, 400]).toContain(res.status);
    });

    it('STUDENT no puede eliminar usuarios (403)', async () => {
      const res = await authDelete(`/admin/users/${studentId}`, studentToken);
      expect(res.status).toBe(403);
    });
  });

  // ─── GET /admin/analytics ──────────────────────────────────────────────────

  describe('GET /admin/analytics', () => {
    it('ADMIN puede obtener las métricas analíticas', async () => {
      const res = await authGet('/admin/analytics', adminToken);

      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
    });

    it('STUDENT no puede acceder a las analíticas (403)', async () => {
      const res = await authGet('/admin/analytics', studentToken);
      expect(res.status).toBe(403);
    });

    it('acepta parámetros de fecha opcionales', async () => {
      const from = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString();
      const to = new Date().toISOString();

      const res = await authGet(
        `/admin/analytics?from=${from}&to=${to}&granularity=day`,
        adminToken,
      );

      expect(res.status).toBe(200);
    });
  });

  // ─── Matrículas (Enrollments) ──────────────────────────────────────────────

  describe('Enrollment CRUD', () => {
    it('ADMIN puede matricular a un usuario en un curso', async () => {
      const res = await authPost(`/admin/users/${studentId}/enrollments`, adminToken, {
        courseId,
      });

      // Puede ser 201 o 200 si ya estaba matriculado
      expect([200, 201]).toContain(res.status);
    });

    it('ADMIN puede ver las matrículas de un usuario', async () => {
      const res = await authGet(`/admin/users/${studentId}/enrollments`, adminToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('ADMIN puede desmatricular a un usuario de un curso', async () => {
      // Primero asegurarse de que está matriculado
      await authPost(`/admin/users/${studentId}/enrollments`, adminToken, { courseId });

      const res = await authDelete(`/admin/users/${studentId}/enrollments/${courseId}`, adminToken);

      expect([200, 204]).toContain(res.status);
    });

    it('STUDENT no puede gestionar matrículas (403)', async () => {
      const res = await authPost(`/admin/users/${studentId}/enrollments`, studentToken, {
        courseId,
      });

      expect(res.status).toBe(403);
    });
  });
});
