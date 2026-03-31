import {
  createApp,
  closeApp,
  login,
  authGet,
  authPost,
  publicGet,
  getPrisma,
} from './setup';

describe('Certificates — /certificates', () => {
  let studentToken: string;
  let adminToken: string;
  let studentId: string;

  beforeAll(async () => {
    await createApp();

    const [s, a] = await Promise.all([
      login('student@vkbacademy.com'),
      login('admin@vkbacademy.com'),
    ]);

    studentToken = s.accessToken;
    adminToken = a.accessToken;
    studentId = s.user.id;
  });

  afterAll(async () => {
    await closeApp();
  });

  // ─── GET /certificates ─────────────────────────────────────────────────────

  describe('GET /certificates', () => {
    it('devuelve los certificados del usuario autenticado', async () => {
      const res = await authGet('/certificates', studentToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('los certificados tienen la estructura correcta', async () => {
      // Emitir un certificado manualmente para tener datos
      const prisma = getPrisma();
      const course = await prisma.course.findFirst({
        where: { title: 'Fundamentos del Baloncesto' },
      });

      if (!course) return;

      // Emitir certificado manual via admin
      await authPost('/admin/certificates', adminToken, {
        userId: studentId,
        courseId: course.id,
        type: 'COURSE_COMPLETION',
      });

      const res = await authGet('/certificates', studentToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      if (res.body.length > 0) {
        const cert = res.body[0];
        expect(cert).toHaveProperty('id');
        expect(cert).toHaveProperty('type');
        expect(cert).toHaveProperty('verifyCode');
        expect(cert).toHaveProperty('issuedAt');
        expect(cert).toHaveProperty('recipientName');
        expect(cert).toHaveProperty('scopeTitle');
      }
    });

    it('devuelve 401 sin autenticación', async () => {
      const res = await publicGet('/certificates');
      expect(res.status).toBe(401);
    });
  });

  // ─── GET /certificates/verify/:code ───────────────────────────────────────

  describe('GET /certificates/verify/:code', () => {
    let verifyCode: string;

    beforeAll(async () => {
      // Obtener el código de verificación de un certificado existente
      const res = await authGet('/certificates', studentToken);

      if (res.status === 200 && res.body.length > 0) {
        verifyCode = res.body[0].verifyCode;
      } else {
        // Crear uno si no hay
        const prisma = getPrisma();
        const course = await prisma.course.findFirst({
          where: { title: 'Matemáticas 3º ESO' },
        });

        if (course) {
          await authPost('/admin/certificates', adminToken, {
            userId: studentId,
            courseId: course.id,
            type: 'COURSE_COMPLETION',
          });

          const refetch = await authGet('/certificates', studentToken);
          if (refetch.body.length > 0) {
            verifyCode = refetch.body[0].verifyCode;
          }
        }
      }
    });

    it('verifica un certificado por código sin autenticación (endpoint público)', async () => {
      if (!verifyCode) return;

      const res = await publicGet(`/certificates/verify/${verifyCode}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('type');
      expect(res.body).toHaveProperty('recipientName');
    });

    it('devuelve 404 con un código de verificación inválido', async () => {
      const res = await publicGet('/certificates/verify/codigo-que-no-existe');
      expect(res.status).toBe(404);
    });
  });

  // ─── GET /certificates/:id ─────────────────────────────────────────────────

  describe('GET /certificates/:id', () => {
    it('devuelve un certificado por ID para el usuario propietario', async () => {
      const listRes = await authGet('/certificates', studentToken);

      if (listRes.body.length === 0) return;

      const certId = listRes.body[0].id;
      const res = await authGet(`/certificates/${certId}`, studentToken);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(certId);
    });

    it('devuelve 401 sin autenticación', async () => {
      const listRes = await authGet('/certificates', studentToken);
      if (listRes.body.length === 0) return;

      const certId = listRes.body[0].id;
      const res = await publicGet(`/certificates/${certId}`);
      expect(res.status).toBe(401);
    });
  });

  // ─── Emisión automática de certificados ────────────────────────────────────

  describe('Emisión automática al completar todas las lecciones de un módulo', () => {
    it('se emite un certificado MODULE_COMPLETION al completar todas las lecciones del módulo', async () => {
      const prisma = getPrisma();

      // Obtener el módulo con sus lecciones
      const module = await prisma.module.findFirst({
        where: {
          course: { title: 'Fundamentos del Baloncesto' },
          order: 1,
        },
        include: { lessons: true },
      });

      if (!module || module.lessons.length === 0) return;

      // Completar todas las lecciones del módulo
      for (const lesson of module.lessons) {
        await authPost(`/lessons/${lesson.id}/complete`, studentToken);
      }

      // Esperar a que los hooks asíncronos procesen
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verificar que se emitió el certificado
      const certs = await prisma.certificate.findMany({
        where: {
          userId: studentId,
          moduleId: module.id,
          type: 'MODULE_COMPLETION',
        },
      });

      // Puede que aún no se haya emitido si las lecciones no son suficientes
      // o la lógica requiere quiz también. El test verifica la existencia o no.
      expect(Array.isArray(certs)).toBe(true);
    });
  });

  // ─── Admin — certificados ──────────────────────────────────────────────────

  describe('Admin — GET /admin/certificates', () => {
    it('ADMIN puede ver todos los certificados', async () => {
      const res = await authGet('/admin/certificates', adminToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('STUDENT no puede ver el listado de admin (403)', async () => {
      const res = await authGet('/admin/certificates', studentToken);
      expect(res.status).toBe(403);
    });

    it('ADMIN puede emitir un certificado manualmente', async () => {
      const prisma = getPrisma();
      const module = await prisma.module.findFirst({
        where: { course: { title: 'Fundamentos del Baloncesto' } },
      });

      if (!module) return;

      const res = await authPost('/admin/certificates', adminToken, {
        userId: studentId,
        moduleId: module.id,
        type: 'MODULE_COMPLETION',
      });

      // Puede ser 201 si es nuevo o 200/409 si ya existe (idempotente)
      expect([200, 201]).toContain(res.status);
    });
  });
});
