import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CertificateType } from '@prisma/client';
import { CertificatesService } from './certificates.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── Helpers de datos de prueba ───────────────────────────────────────────────

function buildLesson(id: string, moduleId: string) {
  return { id, moduleId };
}

function buildModuleCert(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'cert1',
    type: CertificateType.MODULE_COMPLETION,
    verifyCode: 'verify-code-1',
    examScore: null,
    issuedAt: new Date('2026-02-21T10:00:00Z'),
    userId: 'user1',
    courseId: null,
    moduleId: 'module1',
    user: { id: 'user1', name: 'Juan García' },
    course: null,
    module: {
      id: 'module1',
      title: 'Módulo de Defensa',
      course: { id: 'course1', title: 'Curso de Baloncesto' },
    },
    ...overrides,
  };
}

function buildCourseCert(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'cert2',
    type: CertificateType.COURSE_COMPLETION,
    verifyCode: 'verify-code-2',
    examScore: null,
    issuedAt: new Date('2026-02-21T10:00:00Z'),
    userId: 'user1',
    courseId: 'course1',
    moduleId: null,
    user: { id: 'user1', name: 'Juan García' },
    course: { id: 'course1', title: 'Curso de Baloncesto' },
    module: null,
    ...overrides,
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('CertificatesService', () => {
  let service: CertificatesService;
  let mockPrisma: {
    lesson: { findUnique: jest.Mock };
    userProgress: { count: jest.Mock };
    certificate: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
    };
    examAttempt: { findUnique: jest.Mock };
  };

  beforeEach(async () => {
    mockPrisma = {
      lesson: { findUnique: jest.fn() },
      userProgress: { count: jest.fn() },
      certificate: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      examAttempt: { findUnique: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CertificatesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CertificatesService>(CertificatesService);
    jest.clearAllMocks();
  });

  // ─── checkAndIssueLessonCertificates ─────────────────────────────────────────

  describe('checkAndIssueLessonCertificates', () => {
    // Lección perteneciente a un módulo con 2 lecciones dentro de un curso con 3
    const lessonData = {
      moduleId: 'module1',
      module: {
        id: 'module1',
        courseId: 'course1',
        lessons: [{ id: 'l1' }, { id: 'l2' }],
        course: {
          id: 'course1',
          modules: [
            { lessons: [{ id: 'l1' }, { id: 'l2' }] }, // módulo actual
            { lessons: [{ id: 'l3' }] },               // otro módulo del curso
          ],
        },
      },
    };

    it('no hace nada si la lección no existe', async () => {
      mockPrisma.lesson.findUnique.mockResolvedValue(null);

      await service.checkAndIssueLessonCertificates('user1', 'nonexistent');

      expect(mockPrisma.userProgress.count).not.toHaveBeenCalled();
      expect(mockPrisma.certificate.create).not.toHaveBeenCalled();
    });

    it('emite MODULE_COMPLETION cuando todas las lecciones del módulo están completadas', async () => {
      mockPrisma.lesson.findUnique.mockResolvedValue(lessonData);
      // 2/2 lecciones del módulo completadas
      mockPrisma.userProgress.count
        .mockResolvedValueOnce(2)  // módulo: completadas = total (2)
        .mockResolvedValueOnce(2); // curso: completadas < total (3)
      mockPrisma.certificate.findFirst.mockResolvedValue(null); // sin certificado previo
      mockPrisma.certificate.create.mockResolvedValue({});

      await service.checkAndIssueLessonCertificates('user1', 'l1');

      expect(mockPrisma.certificate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user1',
            moduleId: 'module1',
            courseId: null,
            type: CertificateType.MODULE_COMPLETION,
          }),
        }),
      );
    });

    it('no emite MODULE_COMPLETION cuando el módulo no está completo', async () => {
      mockPrisma.lesson.findUnique.mockResolvedValue(lessonData);
      // Solo 1/2 lecciones del módulo completadas
      mockPrisma.userProgress.count
        .mockResolvedValueOnce(1)  // módulo: incompleto
        .mockResolvedValueOnce(1); // curso: incompleto

      await service.checkAndIssueLessonCertificates('user1', 'l1');

      expect(mockPrisma.certificate.create).not.toHaveBeenCalled();
    });

    it('emite COURSE_COMPLETION cuando todas las lecciones del curso están completadas', async () => {
      mockPrisma.lesson.findUnique.mockResolvedValue(lessonData);
      // Módulo incompleto (1/2) pero curso completo (3/3)
      mockPrisma.userProgress.count
        .mockResolvedValueOnce(1)  // módulo: incompleto → no emite MODULE_COMPLETION
        .mockResolvedValueOnce(3); // curso: 3/3 completadas → emite COURSE_COMPLETION
      mockPrisma.certificate.findFirst.mockResolvedValue(null);
      mockPrisma.certificate.create.mockResolvedValue({});

      await service.checkAndIssueLessonCertificates('user1', 'l1');

      expect(mockPrisma.certificate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user1',
            courseId: 'course1',
            moduleId: null,
            type: CertificateType.COURSE_COMPLETION,
          }),
        }),
      );
    });

    it('emite ambos certificados cuando módulo y curso están completos a la vez', async () => {
      mockPrisma.lesson.findUnique.mockResolvedValue(lessonData);
      mockPrisma.userProgress.count
        .mockResolvedValueOnce(2)  // módulo: 2/2 → MODULE_COMPLETION
        .mockResolvedValueOnce(3); // curso: 3/3 → COURSE_COMPLETION
      mockPrisma.certificate.findFirst.mockResolvedValue(null);
      mockPrisma.certificate.create.mockResolvedValue({});

      await service.checkAndIssueLessonCertificates('user1', 'l1');

      expect(mockPrisma.certificate.create).toHaveBeenCalledTimes(2);
      const types = mockPrisma.certificate.create.mock.calls.map(
        (call: [{ data: { type: CertificateType } }]) => call[0].data.type,
      );
      expect(types).toContain(CertificateType.MODULE_COMPLETION);
      expect(types).toContain(CertificateType.COURSE_COMPLETION);
    });

    it('no duplica MODULE_COMPLETION si el certificado ya existe — idempotencia', async () => {
      mockPrisma.lesson.findUnique.mockResolvedValue(lessonData);
      mockPrisma.userProgress.count.mockResolvedValue(2); // módulo completo
      // El certificado ya existe
      mockPrisma.certificate.findFirst.mockResolvedValue({ id: 'existing-cert' });

      await service.checkAndIssueLessonCertificates('user1', 'l1');

      // findFirst encontró el cert existente → no se crea uno nuevo
      expect(mockPrisma.certificate.create).not.toHaveBeenCalled();
    });

    it('comprueba idempotencia consultando por userId, moduleId y type', async () => {
      mockPrisma.lesson.findUnique.mockResolvedValue(lessonData);
      mockPrisma.userProgress.count.mockResolvedValue(2); // módulo completo
      mockPrisma.certificate.findFirst.mockResolvedValue(null);
      mockPrisma.certificate.create.mockResolvedValue({});

      await service.checkAndIssueLessonCertificates('user1', 'l1');

      expect(mockPrisma.certificate.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user1',
          moduleId: 'module1',
          type: CertificateType.MODULE_COMPLETION,
        },
      });
    });
  });

  // ─── issueExamCertificate ─────────────────────────────────────────────────────

  describe('issueExamCertificate', () => {
    it('no hace nada si el score es menor a 50', async () => {
      await service.issueExamCertificate('user1', 'attempt1', 49.9);

      expect(mockPrisma.examAttempt.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.certificate.create).not.toHaveBeenCalled();
    });

    it('no hace nada si el score es exactamente 0', async () => {
      await service.issueExamCertificate('user1', 'attempt1', 0);

      expect(mockPrisma.certificate.create).not.toHaveBeenCalled();
    });

    it('no hace nada si el intento no existe en BD', async () => {
      mockPrisma.examAttempt.findUnique.mockResolvedValue(null);

      await service.issueExamCertificate('user1', 'attempt1', 75);

      expect(mockPrisma.certificate.create).not.toHaveBeenCalled();
    });

    it('emite COURSE_EXAM cuando score ≥ 50 y el intento tiene courseId', async () => {
      mockPrisma.examAttempt.findUnique.mockResolvedValue({
        courseId: 'course1',
        moduleId: null,
      });
      mockPrisma.certificate.findFirst.mockResolvedValue(null);
      mockPrisma.certificate.create.mockResolvedValue({});

      await service.issueExamCertificate('user1', 'attempt1', 80);

      expect(mockPrisma.certificate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user1',
            courseId: 'course1',
            moduleId: null,
            type: CertificateType.COURSE_EXAM,
            examScore: 80,
          }),
        }),
      );
    });

    it('emite MODULE_EXAM cuando score ≥ 50 y el intento tiene moduleId', async () => {
      mockPrisma.examAttempt.findUnique.mockResolvedValue({
        courseId: null,
        moduleId: 'module1',
      });
      mockPrisma.certificate.findFirst.mockResolvedValue(null);
      mockPrisma.certificate.create.mockResolvedValue({});

      await service.issueExamCertificate('user1', 'attempt1', 65);

      expect(mockPrisma.certificate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user1',
            moduleId: 'module1',
            courseId: null,
            type: CertificateType.MODULE_EXAM,
            examScore: 65,
          }),
        }),
      );
    });

    it('emite certificado con score exactamente 50 — límite inferior válido', async () => {
      mockPrisma.examAttempt.findUnique.mockResolvedValue({
        courseId: 'course1',
        moduleId: null,
      });
      mockPrisma.certificate.findFirst.mockResolvedValue(null);
      mockPrisma.certificate.create.mockResolvedValue({});

      await service.issueExamCertificate('user1', 'attempt1', 50);

      expect(mockPrisma.certificate.create).toHaveBeenCalledTimes(1);
    });

    it('no duplica el certificado si ya existe — idempotencia', async () => {
      mockPrisma.examAttempt.findUnique.mockResolvedValue({
        courseId: 'course1',
        moduleId: null,
      });
      // findFirst devuelve certificado existente → idempotencia
      mockPrisma.certificate.findFirst.mockResolvedValue({ id: 'existing-cert' });

      await service.issueExamCertificate('user1', 'attempt1', 90);

      expect(mockPrisma.certificate.create).not.toHaveBeenCalled();
    });

    it('guarda el examScore en el certificado', async () => {
      mockPrisma.examAttempt.findUnique.mockResolvedValue({
        courseId: null,
        moduleId: 'module1',
      });
      mockPrisma.certificate.findFirst.mockResolvedValue(null);
      mockPrisma.certificate.create.mockResolvedValue({});

      await service.issueExamCertificate('user1', 'attempt1', 77.5);

      const createCall = mockPrisma.certificate.create.mock.calls[0][0];
      expect(createCall.data.examScore).toBe(77.5);
    });
  });

  // ─── getMyCertificates ────────────────────────────────────────────────────────

  describe('getMyCertificates', () => {
    it('devuelve array vacío si el usuario no tiene certificados', async () => {
      mockPrisma.certificate.findMany.mockResolvedValue([]);

      const result = await service.getMyCertificates('user1');

      expect(result).toEqual([]);
    });

    it('mapea correctamente un certificado de módulo', async () => {
      mockPrisma.certificate.findMany.mockResolvedValue([buildModuleCert()]);

      const result = await service.getMyCertificates('user1');

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('MODULE_COMPLETION');
      expect(result[0].recipientName).toBe('Juan García');
      expect(result[0].scopeTitle).toBe('Módulo de Defensa');
      expect(result[0].scopeId).toBe('module1');
      expect(result[0].courseTitle).toBe('Curso de Baloncesto'); // título del curso padre
    });

    it('mapea correctamente un certificado de curso (sin courseTitle)', async () => {
      mockPrisma.certificate.findMany.mockResolvedValue([buildCourseCert()]);

      const result = await service.getMyCertificates('user1');

      expect(result[0].scopeTitle).toBe('Curso de Baloncesto');
      expect(result[0].scopeId).toBe('course1');
      expect(result[0].courseTitle).toBeUndefined(); // solo aplica para módulos
    });

    it('devuelve issuedAt como ISO string', async () => {
      const isoDate = new Date('2026-02-21T10:00:00Z');
      mockPrisma.certificate.findMany.mockResolvedValue([buildCourseCert({ issuedAt: isoDate })]);

      const result = await service.getMyCertificates('user1');

      expect(result[0].issuedAt).toBe(isoDate.toISOString());
    });

    it('devuelve examScore correctamente para certificados de examen', async () => {
      mockPrisma.certificate.findMany.mockResolvedValue([
        buildCourseCert({ type: CertificateType.COURSE_EXAM, examScore: 87.5 }),
      ]);

      const result = await service.getMyCertificates('user1');

      expect(result[0].examScore).toBe(87.5);
    });

    it('devuelve examScore null para certificados de completado', async () => {
      mockPrisma.certificate.findMany.mockResolvedValue([buildModuleCert()]);

      const result = await service.getMyCertificates('user1');

      expect(result[0].examScore).toBeNull();
    });

    it('consulta a Prisma filtrado por userId', async () => {
      mockPrisma.certificate.findMany.mockResolvedValue([]);

      await service.getMyCertificates('user42');

      expect(mockPrisma.certificate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user42' } }),
      );
    });

    it('ordena los certificados por issuedAt descendente (más reciente primero)', async () => {
      mockPrisma.certificate.findMany.mockResolvedValue([]);

      await service.getMyCertificates('user1');

      const prismaCall = mockPrisma.certificate.findMany.mock.calls[0][0];
      expect(prismaCall.orderBy).toEqual({ issuedAt: 'desc' });
    });
  });

  // ─── getOne ───────────────────────────────────────────────────────────────────

  describe('getOne', () => {
    it('lanza NotFoundException si el certificado no existe o no pertenece al usuario', async () => {
      mockPrisma.certificate.findFirst.mockResolvedValue(null);

      await expect(service.getOne('cert-fake', 'user1')).rejects.toThrow(NotFoundException);
    });

    it('devuelve el certificado mapeado si existe y pertenece al usuario', async () => {
      mockPrisma.certificate.findFirst.mockResolvedValue(buildModuleCert());

      const result = await service.getOne('cert1', 'user1');

      expect(result.id).toBe('cert1');
      expect(result.recipientName).toBe('Juan García');
      expect(result.scopeTitle).toBe('Módulo de Defensa');
    });

    it('consulta a Prisma con ambos id y userId para proteger la privacidad', async () => {
      mockPrisma.certificate.findFirst.mockResolvedValue(buildCourseCert());

      await service.getOne('cert2', 'user1');

      expect(mockPrisma.certificate.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cert2', userId: 'user1' },
        }),
      );
    });
  });

  // ─── verify ───────────────────────────────────────────────────────────────────

  describe('verify', () => {
    it('devuelve { valid: false } si el código de verificación no existe', async () => {
      mockPrisma.certificate.findUnique.mockResolvedValue(null);

      const result = await service.verify('invalid-code');

      expect(result).toEqual({ valid: false });
    });

    it('devuelve { valid: true, certificate: {...} } cuando el código es válido', async () => {
      mockPrisma.certificate.findUnique.mockResolvedValue(buildCourseCert());

      const result = await service.verify('verify-code-2');

      expect(result.valid).toBe(true);
      expect(result.certificate).toBeDefined();
    });

    it('la respuesta pública NO incluye recipientName — protección de datos', async () => {
      mockPrisma.certificate.findUnique.mockResolvedValue(buildCourseCert());

      const result = await service.verify('verify-code-2');

      expect(result.certificate).not.toHaveProperty('recipientName');
    });

    it('incluye scopeTitle, verifyCode y issuedAt en la respuesta pública', async () => {
      const isoDate = new Date('2026-02-21T10:00:00Z');
      mockPrisma.certificate.findUnique.mockResolvedValue(
        buildCourseCert({ issuedAt: isoDate }),
      );

      const result = await service.verify('verify-code-2');

      expect(result.certificate?.scopeTitle).toBe('Curso de Baloncesto');
      expect(result.certificate?.verifyCode).toBe('verify-code-2');
      expect(result.certificate?.issuedAt).toBe(isoDate.toISOString());
    });

    it('incluye courseTitle solo para certificados de módulo', async () => {
      mockPrisma.certificate.findUnique.mockResolvedValue(buildModuleCert());

      const result = await service.verify('verify-code-1');

      expect(result.certificate?.courseTitle).toBe('Curso de Baloncesto');
    });

    it('no incluye courseTitle para certificados de curso', async () => {
      mockPrisma.certificate.findUnique.mockResolvedValue(buildCourseCert());

      const result = await service.verify('verify-code-2');

      expect(result.certificate?.courseTitle).toBeUndefined();
    });

    it('busca en BD por verifyCode exacto', async () => {
      mockPrisma.certificate.findUnique.mockResolvedValue(null);

      await service.verify('my-unique-code');

      expect(mockPrisma.certificate.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { verifyCode: 'my-unique-code' },
        }),
      );
    });
  });

  // ─── issueManual (admin) ──────────────────────────────────────────────────────

  describe('issueManual', () => {
    it('crea el certificado con los datos del DTO y devuelve el certificado mapeado', async () => {
      const fakeCert = buildCourseCert({ type: CertificateType.COURSE_EXAM, examScore: 90 });
      mockPrisma.certificate.create.mockResolvedValue(fakeCert);

      const result = await service.issueManual({
        userId: 'user1',
        courseId: 'course1',
        type: CertificateType.COURSE_EXAM,
        examScore: 90,
      });

      expect(mockPrisma.certificate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user1',
            courseId: 'course1',
            moduleId: null,
            type: CertificateType.COURSE_EXAM,
            examScore: 90,
          }),
        }),
      );
      expect(result.examScore).toBe(90);
      expect(result.recipientName).toBe('Juan García');
    });

    it('crea certificado de módulo con moduleId y courseId null', async () => {
      mockPrisma.certificate.create.mockResolvedValue(buildModuleCert());

      await service.issueManual({
        userId: 'user1',
        moduleId: 'module1',
        type: CertificateType.MODULE_COMPLETION,
      });

      const createCall = mockPrisma.certificate.create.mock.calls[0][0];
      expect(createCall.data.moduleId).toBe('module1');
      expect(createCall.data.courseId).toBeNull();
    });

    it('establece examScore a null cuando no se proporciona', async () => {
      mockPrisma.certificate.create.mockResolvedValue(buildModuleCert());

      await service.issueManual({
        userId: 'user1',
        moduleId: 'module1',
        type: CertificateType.MODULE_COMPLETION,
      });

      const createCall = mockPrisma.certificate.create.mock.calls[0][0];
      expect(createCall.data.examScore).toBeNull();
    });
  });
});
