import {
  createApp,
  closeApp,
  login,
  authGet,
  authPost,
  authDelete,
  publicGet,
  getPrisma,
} from './setup';

describe('Academies — /academies', () => {
  let superAdminToken: string;
  let adminToken: string;
  let studentToken: string;

  let createdAcademyId: string;
  let vkbAcademyId: string;
  let studentId: string;

  beforeAll(async () => {
    await createApp();

    const [sa, a, s] = await Promise.all([
      login('superadmin@vkbacademy.com'),
      login('admin@vkbacademy.com'),
      login('student@vkbacademy.com'),
    ]);

    superAdminToken = sa.accessToken;
    adminToken = a.accessToken;
    studentToken = s.accessToken;
    studentId = s.user.id;

    // Resolver ID de la academia VKB
    const prisma = getPrisma();
    const vkb = await prisma.academy.findUnique({ where: { slug: 'vallekas-basket' } });
    if (!vkb) throw new Error('No se encontró la academia vallekas-basket. Ejecuta el seed.');
    vkbAcademyId = vkb.id;
  });

  afterAll(async () => {
    await closeApp();
  });

  // ─── GET /academies/public ─────────────────────────────────────────────────

  describe('GET /academies/public', () => {
    it('devuelve las academias activas sin necesidad de autenticación', async () => {
      const res = await publicGet('/academies/public');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      const academy = res.body[0];
      expect(academy).toHaveProperty('id');
      expect(academy).toHaveProperty('name');
      expect(academy).toHaveProperty('slug');
    });

    it('incluye la academia vallekas-basket en el listado público', async () => {
      const res = await publicGet('/academies/public');

      expect(res.status).toBe(200);
      const slugs = res.body.map((a: any) => a.slug);
      expect(slugs).toContain('vallekas-basket');
    });
  });

  // ─── GET /academies/by-slug/:slug ─────────────────────────────────────────

  describe('GET /academies/by-slug/:slug', () => {
    it('devuelve los datos de branding de una academia por slug sin autenticación', async () => {
      const res = await publicGet('/academies/by-slug/vallekas-basket');

      expect(res.status).toBe(200);
      expect(res.body.slug).toBe('vallekas-basket');
      expect(res.body).toHaveProperty('name');
    });

    it('devuelve 404 si el slug no existe', async () => {
      const res = await publicGet('/academies/by-slug/academia-fantasma');
      expect(res.status).toBe(404);
    });
  });

  // ─── GET /academies — listado completo (solo SUPER_ADMIN) ─────────────────

  describe('GET /academies', () => {
    it('SUPER_ADMIN puede obtener todas las academias', async () => {
      const res = await authGet('/academies', superAdminToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2); // al menos VKB y CB Oscar
    });

    it('ADMIN no puede acceder al listado completo de academias (403)', async () => {
      const res = await authGet('/academies', adminToken);
      expect(res.status).toBe(403);
    });

    it('STUDENT no puede acceder al listado de academias (403)', async () => {
      const res = await authGet('/academies', studentToken);
      expect(res.status).toBe(403);
    });
  });

  // ─── POST /academies — creación ────────────────────────────────────────────

  describe('POST /academies', () => {
    it('SUPER_ADMIN puede crear una nueva academia', async () => {
      const uniqueSlug = `test-academy-${Date.now()}`;

      const res = await authPost('/academies', superAdminToken, {
        name: 'Test Academy E2E',
        slug: uniqueSlug,
        primaryColor: '#ff0000',
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.slug).toBe(uniqueSlug);

      createdAcademyId = res.body.id;
    });

    it('ADMIN no puede crear academias (403)', async () => {
      const res = await authPost('/academies', adminToken, {
        name: 'Academia No Permitida',
        slug: 'academia-no-permitida',
      });

      expect(res.status).toBe(403);
    });

    it('devuelve error si el slug ya está en uso', async () => {
      const res = await authPost('/academies', superAdminToken, {
        name: 'Duplicado',
        slug: 'vallekas-basket',
      });

      expect([400, 409]).toContain(res.status);
    });

    it('devuelve 400 si el slug contiene caracteres inválidos', async () => {
      const res = await authPost('/academies', superAdminToken, {
        name: 'Academia Inválida',
        slug: 'Slug Con Mayúsculas',
      });

      expect(res.status).toBe(400);
    });
  });

  // ─── DELETE /academies/:id ─────────────────────────────────────────────────

  describe('DELETE /academies/:id', () => {
    it('SUPER_ADMIN puede eliminar una academia', async () => {
      if (!createdAcademyId) return;

      const res = await authDelete(`/academies/${createdAcademyId}`, superAdminToken);

      expect([200, 204]).toContain(res.status);

      // Verificar que fue eliminada
      const prisma = getPrisma();
      const deleted = await prisma.academy.findUnique({ where: { id: createdAcademyId } });
      expect(deleted).toBeNull();
    });

    it('ADMIN no puede eliminar academias (403)', async () => {
      const res = await authDelete(`/academies/${vkbAcademyId}`, adminToken);
      expect(res.status).toBe(403);
    });
  });

  // ─── Gestión de miembros ───────────────────────────────────────────────────

  describe('Member management', () => {
    it('ADMIN puede listar los miembros de su academia', async () => {
      const res = await authGet(`/academies/${vkbAcademyId}/members`, adminToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('SUPER_ADMIN puede listar los miembros de cualquier academia', async () => {
      const res = await authGet(`/academies/${vkbAcademyId}/members`, superAdminToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('STUDENT no puede ver los miembros (403)', async () => {
      const res = await authGet(`/academies/${vkbAcademyId}/members`, studentToken);
      expect(res.status).toBe(403);
    });

    it('ADMIN puede añadir un miembro a una academia', async () => {
      // Crear un usuario sin academia para añadirlo
      const prisma = getPrisma();
      const newUser = await prisma.user.create({
        data: {
          email: 'sin.academia@test.com',
          passwordHash: '$2b$10$hashedpassword',
          role: 'STUDENT',
          name: 'sin-academia',
        },
      });

      const res = await authPost(`/academies/${vkbAcademyId}/members`, adminToken, {
        userId: newUser.id,
      });

      expect([200, 201]).toContain(res.status);
    });

    it('ADMIN puede eliminar un miembro de la academia', async () => {
      const prisma = getPrisma();
      const member = await prisma.academyMember.findFirst({
        where: {
          academyId: vkbAcademyId,
          user: { email: 'sin.academia@test.com' },
        },
        include: { user: true },
      });

      if (!member) return;

      const res = await authDelete(
        `/academies/${vkbAcademyId}/members/${member.userId}`,
        adminToken,
      );

      expect([200, 204]).toContain(res.status);
    });
  });
});
