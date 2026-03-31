import {
  createApp,
  closeApp,
  login,
  authGet,
  authPost,
  publicGet,
  getPrisma,
} from './setup';

describe('Courses — /courses', () => {
  let studentToken: string;
  let teacherToken: string;
  let adminToken: string;
  let tutorToken: string;

  // IDs de cursos resueltos desde la BD
  let course3esoId: string;       // Fundamentos del Baloncesto (3ºESO)
  let courseMathId: string;       // Matemáticas 3ºESO (student matriculado)
  let course1esoId: string;       // Técnicas de Pase (1ºESO — NO visible para student)
  let course4esoId: string;       // Defensa Avanzada (4ºESO — NO visible para student)

  beforeAll(async () => {
    await createApp();

    const [s, t, a, tu] = await Promise.all([
      login('student@vkbacademy.com'),
      login('teacher@vkbacademy.com'),
      login('admin@vkbacademy.com'),
      login('oscar.sanchez@egocogito.com'),
    ]);

    studentToken = s.accessToken;
    teacherToken = t.accessToken;
    adminToken = a.accessToken;
    tutorToken = tu.accessToken;

    // Resolver IDs de cursos desde la BD
    const prisma = getPrisma();
    const [c1, c2, c3, c4] = await Promise.all([
      prisma.course.findFirst({ where: { title: 'Fundamentos del Baloncesto' } }),
      prisma.course.findFirst({ where: { title: 'Matemáticas 3º ESO' } }),
      prisma.course.findFirst({ where: { title: 'Técnicas de Pase' } }),
      prisma.course.findFirst({ where: { title: 'Defensa Avanzada' } }),
    ]);

    course3esoId = c1!.id;
    courseMathId = c2!.id;
    course1esoId = c3!.id;
    course4esoId = c4!.id;
  });

  afterAll(async () => {
    await closeApp();
  });

  // ─── GET /courses — listado ────────────────────────────────────────────────

  describe('GET /courses', () => {
    it('STUDENT solo ve cursos de su nivel (3ºESO)', async () => {
      const res = await authGet('/courses', studentToken);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');

      const titles: string[] = res.body.data.map((c: any) => c.title);

      // Debe ver cursos de su nivel
      expect(titles).toContain('Fundamentos del Baloncesto');
      expect(titles).toContain('Matemáticas 3º ESO');

      // NO debe ver cursos de otros niveles
      expect(titles).not.toContain('Técnicas de Pase');
      expect(titles).not.toContain('Defensa Avanzada');
    });

    it('TEACHER ve todos los cursos', async () => {
      const res = await authGet('/courses', teacherToken);

      expect(res.status).toBe(200);
      const titles: string[] = res.body.data.map((c: any) => c.title);

      expect(titles).toContain('Fundamentos del Baloncesto');
      expect(titles).toContain('Técnicas de Pase');
      expect(titles).toContain('Defensa Avanzada');
    });

    it('ADMIN ve todos los cursos', async () => {
      const res = await authGet('/courses', adminToken);

      expect(res.status).toBe(200);
      const titles: string[] = res.body.data.map((c: any) => c.title);

      expect(titles).toContain('Técnicas de Pase');
      expect(titles).toContain('Defensa Avanzada');
    });

    it('TUTOR ve todos los cursos', async () => {
      const res = await authGet('/courses', tutorToken);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(4);
    });

    it('devuelve 401 sin token de autenticación', async () => {
      const res = await publicGet('/courses');
      expect(res.status).toBe(401);
    });

    it('respeta la paginación (page y limit)', async () => {
      const res = await authGet('/courses?page=1&limit=2', adminToken);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body).toHaveProperty('total');
    });
  });

  // ─── GET /courses/:id — detalle ────────────────────────────────────────────

  describe('GET /courses/:id', () => {
    it('STUDENT puede acceder a un curso de su nivel', async () => {
      const res = await authGet(`/courses/${course3esoId}`, studentToken);

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Fundamentos del Baloncesto');
      expect(res.body).toHaveProperty('modules');
    });

    it('STUDENT puede acceder al curso en el que está matriculado', async () => {
      const res = await authGet(`/courses/${courseMathId}`, studentToken);

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Matemáticas 3º ESO');
    });

    it('STUDENT obtiene 403 al intentar acceder a curso de 1ºESO', async () => {
      const res = await authGet(`/courses/${course1esoId}`, studentToken);

      expect(res.status).toBe(403);
    });

    it('STUDENT obtiene 403 al intentar acceder a curso de 4ºESO', async () => {
      const res = await authGet(`/courses/${course4esoId}`, studentToken);

      expect(res.status).toBe(403);
    });

    it('TEACHER puede acceder a cualquier curso', async () => {
      const res = await authGet(`/courses/${course1esoId}`, teacherToken);

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Técnicas de Pase');
    });

    it('ADMIN puede acceder a cualquier curso', async () => {
      const res = await authGet(`/courses/${course4esoId}`, adminToken);

      expect(res.status).toBe(200);
    });

    it('devuelve 404 si el curso no existe', async () => {
      const res = await authGet('/courses/id-que-no-existe', adminToken);

      expect(res.status).toBe(404);
    });
  });

  // ─── GET /courses/:id/progress ─────────────────────────────────────────────

  describe('GET /courses/:id/progress', () => {
    it('devuelve el progreso del usuario autenticado', async () => {
      const res = await authGet(`/courses/${course3esoId}/progress`, studentToken);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('completedLessons');
      expect(res.body).toHaveProperty('totalLessons');
      expect(res.body).toHaveProperty('percentage');
    });

    it('el progreso inicial es 0% para un curso sin completar', async () => {
      const res = await authGet(`/courses/${course3esoId}/progress`, studentToken);

      expect(res.status).toBe(200);
      expect(res.body.completedLessons).toBe(0);
      expect(res.body.percentage).toBe(0);
    });

    it('devuelve 401 sin autenticación', async () => {
      const res = await publicGet(`/courses/${course3esoId}/progress`);
      expect(res.status).toBe(401);
    });
  });

  // ─── POST /courses — creación ──────────────────────────────────────────────

  describe('POST /courses', () => {
    it('TEACHER puede crear un curso', async () => {
      const res = await authPost('/courses', teacherToken, {
        title: 'Nuevo Curso de Tiro',
        description: 'Técnicas avanzadas de tiro',
        published: false,
      });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Nuevo Curso de Tiro');
    });

    it('ADMIN puede crear un curso', async () => {
      const res = await authPost('/courses', adminToken, {
        title: 'Curso Creado por Admin',
        description: 'Descripción del curso',
      });

      expect(res.status).toBe(201);
    });

    it('STUDENT no puede crear un curso (403)', async () => {
      const res = await authPost('/courses', studentToken, {
        title: 'Intento de Curso',
        description: 'Un alumno no debería poder crear cursos',
      });

      expect(res.status).toBe(403);
    });

    it('TUTOR no puede crear un curso (403)', async () => {
      const res = await authPost('/courses', tutorToken, {
        title: 'Intento de Curso',
        description: 'Un tutor no debería poder crear cursos',
      });

      expect(res.status).toBe(403);
    });

    it('devuelve 401 sin autenticación', async () => {
      const res = await publicGet('/courses');
      expect(res.status).toBe(401);
    });

    it('devuelve 400 si el título es demasiado corto', async () => {
      const res = await authPost('/courses', teacherToken, {
        title: 'AB',
      });

      expect(res.status).toBe(400);
    });
  });
});
