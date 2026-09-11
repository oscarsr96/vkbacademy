import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GuardianDigestService } from './guardian-digest.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { isoWeek } from '../challenges/challenge-periods';

describe('GuardianDigestService', () => {
  let service: GuardianDigestService;
  let mockPrisma: {
    guardianSubscription: { findMany: jest.Mock; update: jest.Mock };
    user: { findMany: jest.Mock };
    userActivityDay: { findMany: jest.Mock };
    certificate: { findMany: jest.Mock };
  };
  let mockNotifications: { sendEmail: jest.Mock };

  /** Una familia suscrita con dos hijos, ambos con actividad esta semana. */
  function darFamiliaConDosHijos(overrides: { lastSentWeek?: string | null } = {}) {
    mockPrisma.guardianSubscription.findMany.mockResolvedValue([
      {
        id: 'sub1',
        email: 'padre@example.com',
        token: 'tok',
        lastSentWeek: overrides.lastSentWeek ?? null,
      },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', name: 'Ana', currentDailyStreak: 3 },
      { id: 'u2', name: 'Bruno', currentDailyStreak: 0 },
    ]);
    mockPrisma.userActivityDay.findMany.mockResolvedValue([
      { userId: 'u1', day: '2026-08-24', worked: true },
      { userId: 'u1', day: '2026-08-25', worked: true },
      { userId: 'u2', day: '2026-08-26', worked: true },
    ]);
    mockPrisma.certificate.findMany.mockResolvedValue([]);
  }

  /** Una familia con un hijo que no ha entrado en toda la semana. */
  function darFamiliaSinActividad() {
    mockPrisma.guardianSubscription.findMany.mockResolvedValue([
      { id: 'sub1', email: 'padre@example.com', token: 'tok', lastSentWeek: null },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'u1', name: 'Ana', currentDailyStreak: 0 }]);
    mockPrisma.userActivityDay.findMany.mockResolvedValue([]);
    mockPrisma.certificate.findMany.mockResolvedValue([]);
  }

  beforeEach(async () => {
    mockPrisma = {
      guardianSubscription: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      userActivityDay: { findMany: jest.fn().mockResolvedValue([]) },
      certificate: { findMany: jest.fn().mockResolvedValue([]) },
    };
    mockNotifications = { sendEmail: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GuardianDigestService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('https://app.vkb.es') },
        },
      ],
    }).compile();

    service = module.get(GuardianDigestService);
    jest.clearAllMocks();
    mockNotifications.sendEmail.mockResolvedValue(undefined);
  });

  it('solo mira suscripciones vivas', async () => {
    await service.sendWeeklyDigests();

    const args = mockPrisma.guardianSubscription.findMany.mock.calls[0][0];
    expect(args.where.unsubscribedAt).toBeNull();
  });

  it('salta las familias ya enviadas esta semana', async () => {
    // Idempotencia: GitHub Actions puede disparar dos veces.
    darFamiliaConDosHijos({ lastSentWeek: isoWeek(new Date()) });

    const result = await service.sendWeeklyDigests();

    expect(mockNotifications.sendEmail).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });

  it('envía a la familia que nunca ha recibido nada', async () => {
    // El filtro va en código y no como `NOT: { lastSentWeek: semana }`: en SQL,
    // NOT sobre una columna NULL da desconocido, así que una familia nueva
    // quedaría excluida para siempre sin que nada fallara.
    darFamiliaConDosHijos({ lastSentWeek: null });

    await service.sendWeeklyDigests();

    expect(mockNotifications.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('manda un solo correo por familia, no uno por hermano', async () => {
    darFamiliaConDosHijos();

    await service.sendWeeklyDigests();

    expect(mockNotifications.sendEmail).toHaveBeenCalledTimes(1);
    expect(mockNotifications.sendEmail.mock.calls[0][0]).toBe('padre@example.com');
  });

  it('incluye a los dos hermanos en el mismo correo', async () => {
    darFamiliaConDosHijos();

    await service.sendWeeklyDigests();

    const html = mockNotifications.sendEmail.mock.calls[0][2] as string;
    expect(html).toContain('Ana');
    expect(html).toContain('Bruno');
  });

  it('el enlace de baja apunta a la página, no al endpoint', async () => {
    darFamiliaConDosHijos();

    await service.sendWeeklyDigests();

    const html = mockNotifications.sendEmail.mock.calls[0][2] as string;
    // Los escáneres de correo abren los enlaces solos: si apuntara al endpoint,
    // darían de baja a la familia por el mero hecho de recibir el correo.
    expect(html).toContain('https://app.vkb.es/baja/tok');
    expect(html).not.toContain('/guardians/unsubscribe');
  });

  it('dice sin juicio que un hijo no ha entrado', async () => {
    darFamiliaSinActividad();

    await service.sendWeeklyDigests();

    const html = mockNotifications.sendEmail.mock.calls[0][2] as string;
    expect(html).toContain('no ha entrado');
  });

  it('no compara a los hermanos entre sí ni menciona puestos', async () => {
    darFamiliaConDosHijos();

    await service.sendWeeklyDigests();

    const html = mockNotifications.sendEmail.mock.calls[0][2] as string;
    expect(html).not.toMatch(/más que|menos que|mejor que|peor que|puesto|ranking|clasificación/i);
  });

  it('marca la semana después de enviar, no antes', async () => {
    darFamiliaConDosHijos();
    mockNotifications.sendEmail.mockRejectedValue(new Error('Resend caído'));

    await service.sendWeeklyDigests();

    // Marcarla antes daría la semana por enviada y esa familia se quedaría sin
    // correo hasta la siguiente.
    expect(mockPrisma.guardianSubscription.update).not.toHaveBeenCalled();
  });

  it('un fallo en una familia no impide enviar a las demás', async () => {
    mockPrisma.guardianSubscription.findMany.mockResolvedValue([
      { id: 'sub1', email: 'uno@example.com', token: 'tok1', lastSentWeek: null },
      { id: 'sub2', email: 'dos@example.com', token: 'tok2', lastSentWeek: null },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'u1', name: 'Ana', currentDailyStreak: 1 }]);
    mockNotifications.sendEmail
      .mockRejectedValueOnce(new Error('Resend caído'))
      .mockResolvedValueOnce(undefined);

    const result = await service.sendWeeklyDigests();

    expect(mockNotifications.sendEmail).toHaveBeenCalledTimes(2);
    expect(result.sent).toBe(1);
  });

  it('en dry-run no envía nada ni marca la semana', async () => {
    darFamiliaConDosHijos();

    const result = await service.sendWeeklyDigests({ dryRun: true });

    expect(mockNotifications.sendEmail).not.toHaveBeenCalled();
    expect(mockPrisma.guardianSubscription.update).not.toHaveBeenCalled();
    expect(result.sent).toBe(1);
  });

  it('salta la familia cuyos alumnos ya no existen', async () => {
    mockPrisma.guardianSubscription.findMany.mockResolvedValue([
      { id: 'sub1', email: 'padre@example.com', token: 'tok', lastSentWeek: null },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([]);

    const result = await service.sendWeeklyDigests();

    expect(mockNotifications.sendEmail).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });

  it('busca a los hijos por el email de la familia', async () => {
    darFamiliaConDosHijos();

    await service.sendWeeklyDigests();

    const args = mockPrisma.user.findMany.mock.calls[0][0];
    expect(args.where.guardianEmail).toBe('padre@example.com');
    expect(args.where.role).toBe('STUDENT');
  });
});
