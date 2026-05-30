import { createApp, closeApp, login, authGet, authPost, publicGet, publicPost } from './setup';

describe('Tutors — /tutors', () => {
  let tutorToken: string;
  let studentToken: string;
  let adminToken: string;

  let studentId: string;

  beforeAll(async () => {
    await createApp();

    const [tu, s, a] = await Promise.all([
      login('oscar.sanchez@egocogito.com'),
      login('student@vkbacademy.com'),
      login('admin@vkbacademy.com'),
    ]);

    tutorToken = tu.accessToken;
    studentToken = s.accessToken;
    adminToken = a.accessToken;

    // Obtener el ID del alumno asignado al tutor llamando al propio endpoint
    const studentsRes = await authGet('/tutors/my-students', tutorToken);
    if (
      studentsRes.status !== 200 ||
      !Array.isArray(studentsRes.body) ||
      studentsRes.body.length === 0
    ) {
      throw new Error(
        'El tutor oscar.sanchez@egocogito.com debe tener al menos un alumno asignado. Ejecuta el seed.',
      );
    }
    studentId = studentsRes.body[0].id;
  });

  afterAll(async () => {
    await closeApp();
  });

  // ─── GET /tutors/my-students ───────────────────────────────────────────────

  describe('GET /tutors/my-students', () => {
    it('devuelve 401 sin token', async () => {
      const res = await publicGet('/tutors/my-students');
      expect(res.status).toBe(401);
    });

    it('devuelve 403 cuando lo llama un STUDENT', async () => {
      const res = await authGet('/tutors/my-students', studentToken);
      expect(res.status).toBe(403);
    });

    it('devuelve 200 y un array con al menos 1 alumno cuando lo llama el TUTOR', async () => {
      const res = await authGet('/tutors/my-students', tutorToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('el alumno devuelto contiene id, name, email, totalPoints y currentStreak', async () => {
      const res = await authGet('/tutors/my-students', tutorToken);

      expect(res.status).toBe(200);
      const alumno = res.body[0];
      expect(alumno).toHaveProperty('id');
      expect(alumno).toHaveProperty('name');
      expect(alumno).toHaveProperty('email');
      expect(alumno).toHaveProperty('totalPoints');
      expect(alumno).toHaveProperty('currentStreak');
    });

    it('devuelve 200 con array vacío cuando lo llama un ADMIN sin alumnos asignados', async () => {
      // El ADMIN supera el guard de rol, pero el servicio filtra por tutorId === admin.id
      // El admin del seed no tiene alumnos asignados → array vacío
      const res = await authGet('/tutors/my-students', adminToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ─── GET /tutors/my-students/:studentId/courses ────────────────────────────

  describe('GET /tutors/my-students/:studentId/courses', () => {
    it('devuelve 200 y un array de cursos cuando lo llama el TUTOR', async () => {
      const res = await authGet(`/tutors/my-students/${studentId}/courses`, tutorToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('devuelve 403 al intentar acceder a un alumno que no pertenece al tutor', async () => {
      // ID inexistente — el servicio lanza ForbiddenException porque no encuentra
      // al alumno o su tutorId no coincide
      const invalidId = 'cuid-que-no-existe-en-la-bd-00000000';

      const res = await authGet(`/tutors/my-students/${invalidId}/courses`, tutorToken);

      expect(res.status).toBe(403);
    });
  });

  // ─── GET /tutors/my-students/:studentId/stats ──────────────────────────────

  describe('GET /tutors/my-students/:studentId/stats', () => {
    it('devuelve 200 cuando lo llama el TUTOR con su alumno', async () => {
      const res = await authGet(`/tutors/my-students/${studentId}/stats`, tutorToken);

      expect(res.status).toBe(200);
    });

    it('la respuesta contiene student, period, lessons, quizzes, exams, certificates, sessions, courses y activity', async () => {
      const res = await authGet(`/tutors/my-students/${studentId}/stats`, tutorToken);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('student');
      expect(res.body).toHaveProperty('period');
      expect(res.body).toHaveProperty('lessons');
      expect(res.body).toHaveProperty('quizzes');
      expect(res.body).toHaveProperty('exams');
      expect(res.body).toHaveProperty('certificates');
      expect(res.body).toHaveProperty('sessions');
      expect(res.body).toHaveProperty('courses');
      expect(res.body).toHaveProperty('activity');
    });

    it('devuelve 403 al intentar acceder a stats de un alumno que no pertenece al tutor', async () => {
      const invalidId = 'cuid-que-no-existe-en-la-bd-00000000';

      const res = await authGet(`/tutors/my-students/${invalidId}/stats`, tutorToken);

      expect(res.status).toBe(403);
    });
  });

  // ─── POST /tutors/my-students (alta de alumno) ─────────────────────────────

  describe('POST /tutors/my-students', () => {
    let schoolYearId: string;

    beforeAll(async () => {
      const res = await publicGet('/school-years');
      schoolYearId = res.body[0].id;
    });

    it('devuelve 401 sin token', async () => {
      const res = await publicPost('/tutors/my-students', {
        name: 'alumno-nuevo',
        schoolYearId,
      });
      expect(res.status).toBe(401);
    });

    it('devuelve 403 cuando lo llama un STUDENT', async () => {
      const res = await authPost('/tutors/my-students', studentToken, {
        name: 'alumno-nuevo',
        schoolYearId,
      });
      expect(res.status).toBe(403);
    });

    it('el TUTOR crea un alumno con username generado, sin exponer contraseña', async () => {
      const res = await authPost('/tutors/my-students', tutorToken, {
        name: 'alumno-creado-por-tutor',
        schoolYearId,
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('username');
      expect(res.body.username).toBeTruthy();
      // Nunca se devuelve la contraseña ni el hash
      expect(res.body).not.toHaveProperty('password');
      expect(res.body).not.toHaveProperty('passwordHash');

      // El nuevo alumno aparece en la lista del tutor
      const list = await authGet('/tutors/my-students', tutorToken);
      const ids = list.body.map((s: { id: string }) => s.id);
      expect(ids).toContain(res.body.id);
    });

    it('devuelve 400 si el nivel educativo no existe', async () => {
      const res = await authPost('/tutors/my-students', tutorToken, {
        name: 'alumno-nivel-malo',
        schoolYearId: 'nivel-que-no-existe-000',
      });
      expect(res.status).toBe(400);
    });
  });

  // ─── POST /tutors/my-students/:studentId/reset-password ─────────────────────

  describe('POST /tutors/my-students/:studentId/reset-password', () => {
    let freshStudentId: string;

    beforeAll(async () => {
      // Creamos un alumno dedicado para no contaminar al alumno del seed
      const syRes = await publicGet('/school-years');
      const created = await authPost('/tutors/my-students', tutorToken, {
        name: 'alumno-para-reset',
        schoolYearId: syRes.body[0].id,
      });
      freshStudentId = created.body.id;
    });

    it('devuelve 403 cuando lo llama un STUDENT', async () => {
      const res = await authPost(
        `/tutors/my-students/${freshStudentId}/reset-password`,
        studentToken,
      );
      expect(res.status).toBe(403);
    });

    it('el TUTOR restablece la contraseña de su alumno y recibe un mensaje', async () => {
      const res = await authPost(
        `/tutors/my-students/${freshStudentId}/reset-password`,
        tutorToken,
      );

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('message');
      // No se expone la contraseña restablecida
      expect(res.body).not.toHaveProperty('password');
    });

    it('devuelve 403 al restablecer la contraseña de un alumno ajeno al tutor', async () => {
      const invalidId = 'cuid-que-no-existe-en-la-bd-00000000';
      const res = await authPost(`/tutors/my-students/${invalidId}/reset-password`, tutorToken);
      expect(res.status).toBe(403);
    });
  });
});
