import {
  createApp,
  closeApp,
  login,
  authGet,
  authPost,
  authPatch,
  publicGet,
  getPrisma,
} from './setup';

describe('Bookings — /bookings', () => {
  let tutorToken: string;
  let studentToken: string;
  let teacherToken: string;
  let adminToken: string;

  let tutorId: string;
  let studentId: string;
  let teacherProfileId: string;
  let otherStudentId: string;

  let createdBookingId: string;

  // Fechas futuras para las reservas
  const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // +7 días
  const startAt = new Date(futureDate);
  startAt.setHours(9, 0, 0, 0);
  const endAt = new Date(futureDate);
  endAt.setHours(10, 0, 0, 0);

  beforeAll(async () => {
    await createApp();

    const [tu, s, t, a] = await Promise.all([
      login('oscar.sanchez@egocogito.com'),
      login('student@vkbacademy.com'),
      login('teacher@vkbacademy.com'),
      login('admin@vkbacademy.com'),
    ]);

    tutorToken = tu.accessToken;
    studentToken = s.accessToken;
    teacherToken = t.accessToken;
    adminToken = a.accessToken;

    tutorId = tu.user.id;
    studentId = s.user.id;

    // Resolver el perfil del teacher y un estudiante de otro tutor
    const prisma = getPrisma();
    const teacherProfile = await prisma.teacherProfile.findFirst({
      where: { user: { email: 'teacher@vkbacademy.com' } },
    });

    if (!teacherProfile) throw new Error('No se encontró perfil de teacher. Ejecuta el seed.');
    teacherProfileId = teacherProfile.id;

    // Crear un estudiante sin tutor para probar la restricción de acceso
    const otherStudent = await prisma.user.create({
      data: {
        email: 'otro.alumno.booking@test.com',
        passwordHash: '$2b$10$hashedpassword',
        role: 'STUDENT',
        name: 'otro-alumno-booking',
      },
    });
    otherStudentId = otherStudent.id;
  });

  afterAll(async () => {
    await closeApp();
  });

  // ─── POST /bookings — creación ─────────────────────────────────────────────

  describe('POST /bookings', () => {
    it('TUTOR crea reserva para su propio alumno correctamente', async () => {
      const res = await authPost('/bookings', tutorToken, {
        studentId,
        teacherId: teacherProfileId,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        mode: 'IN_PERSON',
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.status).toBe('PENDING');
      expect(res.body.studentId).toBe(studentId);

      createdBookingId = res.body.id;
    });

    it('TUTOR no puede crear reserva para un alumno que no es suyo (403)', async () => {
      const res = await authPost('/bookings', tutorToken, {
        studentId: otherStudentId,
        teacherId: teacherProfileId,
        startAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 8).toISOString(),
        endAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 8 + 3600000).toISOString(),
        mode: 'IN_PERSON',
      });

      expect(res.status).toBe(403);
    });

    it('STUDENT no puede crear reservas (403)', async () => {
      const res = await authPost('/bookings', studentToken, {
        studentId,
        teacherId: teacherProfileId,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
      });

      expect(res.status).toBe(403);
    });

    it('detecta conflictos de horario con reservas existentes (400)', async () => {
      // Crear primera reserva
      await authPost('/bookings', adminToken, {
        studentId,
        teacherId: teacherProfileId,
        startAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10).toISOString(),
        endAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10 + 3600000).toISOString(),
      });

      // Intentar crear reserva en el mismo horario para el mismo teacher
      const conflictStart = new Date(Date.now() + 1000 * 60 * 60 * 24 * 10);
      const conflictEnd = new Date(Date.now() + 1000 * 60 * 60 * 24 * 10 + 3600000);

      const res = await authPost('/bookings', adminToken, {
        studentId,
        teacherId: teacherProfileId,
        startAt: conflictStart.toISOString(),
        endAt: conflictEnd.toISOString(),
      });

      // Puede ser 400 (conflicto) u otro código de error
      expect([400, 409]).toContain(res.status);
    });

    it('rechaza reservas en el pasado (400)', async () => {
      const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24);

      const res = await authPost('/bookings', adminToken, {
        studentId,
        teacherId: teacherProfileId,
        startAt: pastDate.toISOString(),
        endAt: new Date(pastDate.getTime() + 3600000).toISOString(),
      });

      expect([400, 422]).toContain(res.status);
    });

    it('devuelve 401 sin autenticación', async () => {
      const res = await publicGet('/bookings');
      expect(res.status).toBe(401);
    });
  });

  // ─── PATCH /bookings/:id/confirm ───────────────────────────────────────────

  describe('PATCH /bookings/:id/confirm', () => {
    it('TEACHER confirma una reserva correctamente', async () => {
      // Necesitamos el bookingId creado en el test anterior
      if (!createdBookingId) {
        // Crear reserva para este test si no existe
        const res = await authPost('/bookings', adminToken, {
          studentId,
          teacherId: teacherProfileId,
          startAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
          endAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14 + 3600000).toISOString(),
        });
        createdBookingId = res.body.id;
      }

      const res = await authPatch(`/bookings/${createdBookingId}/confirm`, teacherToken);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CONFIRMED');
    });

    it('ADMIN puede confirmar una reserva', async () => {
      // Crear otra reserva PENDING para este test
      const createRes = await authPost('/bookings', adminToken, {
        studentId,
        teacherId: teacherProfileId,
        startAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 21).toISOString(),
        endAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 21 + 3600000).toISOString(),
      });

      const bookingId = createRes.body.id;
      const res = await authPatch(`/bookings/${bookingId}/confirm`, adminToken);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CONFIRMED');
    });

    it('STUDENT no puede confirmar reservas (403)', async () => {
      const res = await authPatch(`/bookings/${createdBookingId}/confirm`, studentToken);
      expect(res.status).toBe(403);
    });
  });

  // ─── PATCH /bookings/:id/cancel ────────────────────────────────────────────

  describe('PATCH /bookings/:id/cancel', () => {
    it('TUTOR puede cancelar una reserva de su alumno', async () => {
      const createRes = await authPost('/bookings', tutorToken, {
        studentId,
        teacherId: teacherProfileId,
        startAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 28).toISOString(),
        endAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 28 + 3600000).toISOString(),
      });

      const bookingId = createRes.body.id;
      const res = await authPatch(`/bookings/${bookingId}/cancel`, tutorToken);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CANCELLED');
    });

    it('TEACHER puede cancelar una reserva asignada a él', async () => {
      const createRes = await authPost('/bookings', adminToken, {
        studentId,
        teacherId: teacherProfileId,
        startAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 35).toISOString(),
        endAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 35 + 3600000).toISOString(),
      });

      const bookingId = createRes.body.id;
      const res = await authPatch(`/bookings/${bookingId}/cancel`, teacherToken);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CANCELLED');
    });

    it('ADMIN puede cancelar cualquier reserva', async () => {
      const createRes = await authPost('/bookings', adminToken, {
        studentId,
        teacherId: teacherProfileId,
        startAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 42).toISOString(),
        endAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 42 + 3600000).toISOString(),
      });

      const bookingId = createRes.body.id;
      const res = await authPatch(`/bookings/${bookingId}/cancel`, adminToken);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CANCELLED');
    });
  });

  // ─── GET /bookings/mine ────────────────────────────────────────────────────

  describe('GET /bookings/mine', () => {
    it('STUDENT ve solo sus reservas', async () => {
      const res = await authGet('/bookings/mine', studentToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      // Todas las reservas deben pertenecer al alumno
      for (const booking of res.body) {
        expect(booking.studentId).toBe(studentId);
      }
    });

    it('TUTOR ve las reservas de sus alumnos', async () => {
      const res = await authGet('/bookings/mine', tutorToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('TEACHER ve sus reservas como docente', async () => {
      const res = await authGet('/bookings/mine', teacherToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('ADMIN ve todas las reservas', async () => {
      const res = await authGet('/bookings/mine', adminToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('devuelve 401 sin autenticación', async () => {
      const res = await publicGet('/bookings/mine');
      expect(res.status).toBe(401);
    });
  });
});
