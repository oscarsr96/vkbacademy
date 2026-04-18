import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_DATE = new Date('2026-04-15T10:00:00.000Z');
const END_DATE = new Date('2026-04-15T11:00:00.000Z');

const BOOKING_CREATED_PARAMS = {
  teacherEmail: 'profesor@vkb.com',
  teacherName: 'Carlos López',
  studentName: 'Álvaro García',
  tutorName: 'María García',
  startAt: BASE_DATE,
  endAt: END_DATE,
  mode: 'IN_PERSON',
};

const BOOKING_CONFIRMED_PARAMS = {
  tutorEmail: 'tutor@vkb.com',
  studentEmail: 'alumno@vkb.com',
  tutorName: 'María García',
  studentName: 'Álvaro García',
  teacherName: 'Carlos López',
  startAt: BASE_DATE,
  endAt: END_DATE,
  mode: 'ONLINE',
  meetingUrl: 'https://daily.co/sala-123',
};

const BOOKING_CANCELLED_PARAMS = {
  notifyEmails: [
    { email: 'tutor@vkb.com', name: 'María García' },
    { email: 'profesor@vkb.com', name: 'Carlos López' },
    { email: 'alumno@vkb.com', name: 'Álvaro García' },
  ],
  studentName: 'Álvaro García',
  teacherName: 'Carlos López',
  startAt: BASE_DATE,
  endAt: END_DATE,
  mode: 'IN_PERSON',
};

// ---------------------------------------------------------------------------
// Helpers para construir el ConfigService mock
// ---------------------------------------------------------------------------

function buildMockConfig(useApiKey: boolean) {
  return {
    get: jest.fn((key: string, defaultVal?: unknown) => {
      if (key === 'RESEND_API_KEY') return useApiKey ? 'test-key' : undefined;
      if (key === 'EMAIL_FROM') return 'test@vkb.com';
      return defaultVal;
    }),
  };
}

// ---------------------------------------------------------------------------
// Suite principal
// ---------------------------------------------------------------------------

describe('NotificationsService', () => {
  // -------------------------------------------------------------------------
  // Contexto SIN API key — this.resend es null
  // -------------------------------------------------------------------------

  describe('sin API key configurada', () => {
    let service: NotificationsService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          NotificationsService,
          { provide: ConfigService, useValue: buildMockConfig(false) },
        ],
      }).compile();

      service = module.get<NotificationsService>(NotificationsService);
    });

    it('sendEmail no lanza ningún error cuando resend es null', async () => {
      await expect(
        service.sendEmail('dest@test.com', 'Asunto', '<p>HTML</p>'),
      ).resolves.toBeUndefined();
    });

    it('sendBookingCreated no lanza ningún error cuando resend es null', async () => {
      await expect(
        service.sendBookingCreated(BOOKING_CREATED_PARAMS),
      ).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Contexto CON API key — this.resend está inicializado
  // -------------------------------------------------------------------------

  describe('con API key configurada', () => {
    let service: NotificationsService;
    let mockSend: jest.Mock;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          NotificationsService,
          { provide: ConfigService, useValue: buildMockConfig(true) },
        ],
      }).compile();

      service = module.get<NotificationsService>(NotificationsService);

      // Inyectamos un objeto resend falso para no depender del módulo real de Resend
      mockSend = jest.fn().mockResolvedValue({ id: 'msg-1' });
      service['resend'] = { emails: { send: mockSend } } as any;
    });

    it('sendBookingCreated invoca sendEmail con el email del profesor', async () => {
      await service.sendBookingCreated(BOOKING_CREATED_PARAMS);

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'profesor@vkb.com',
          subject: 'Nueva solicitud de clase — VKB Academy',
        }),
      );
    });

    it('sendBookingConfirmed envía exactamente 2 emails (tutor + alumno)', async () => {
      await service.sendBookingConfirmed(BOOKING_CONFIRMED_PARAMS);

      expect(mockSend).toHaveBeenCalledTimes(2);

      const recipients = mockSend.mock.calls.map((call) => call[0].to as string);
      expect(recipients).toContain('tutor@vkb.com');
      expect(recipients).toContain('alumno@vkb.com');
    });

    it('sendBookingConfirmed usa Promise.allSettled (ambos envíos se completan aunque uno falle)', async () => {
      // Simulamos que el segundo envío falla
      mockSend
        .mockResolvedValueOnce({ id: 'msg-tutor' })
        .mockRejectedValueOnce(new Error('SMTP error'));

      // Promise.allSettled nunca rechaza; el servicio no debe propagar el error
      await expect(
        service.sendBookingConfirmed(BOOKING_CONFIRMED_PARAMS),
      ).resolves.not.toThrow();

      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('sendBookingCancelled envía un email por cada entrada en notifyEmails', async () => {
      await service.sendBookingCancelled(BOOKING_CANCELLED_PARAMS);

      expect(mockSend).toHaveBeenCalledTimes(
        BOOKING_CANCELLED_PARAMS.notifyEmails.length,
      );

      const recipients = mockSend.mock.calls.map((call) => call[0].to as string);
      expect(recipients).toContain('tutor@vkb.com');
      expect(recipients).toContain('profesor@vkb.com');
      expect(recipients).toContain('alumno@vkb.com');
    });

    it('sendPasswordReset incluye el resetUrl en el HTML enviado', async () => {
      const resetUrl = 'https://vkbacademy.com/reset?token=abc123';

      await service.sendPasswordReset({
        email: 'alumno@vkb.com',
        name: 'Álvaro García',
        resetUrl,
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
      const [{ html, subject }] = mockSend.mock.calls[0] as [
        { html: string; subject: string },
      ];
      expect(subject).toBe('Restablecer contraseña — VKB Academy');
      expect(html).toContain(resetUrl);
    });

    it('sendEmail captura el error de resend sin propagarlo al llamante', async () => {
      mockSend.mockRejectedValue(new Error('API timeout'));

      await expect(
        service.sendEmail('dest@test.com', 'Asunto', '<p>HTML</p>'),
      ).resolves.toBeUndefined();
    });

    it('sendEmail utiliza el from configurado en EMAIL_FROM', async () => {
      await service.sendEmail('dest@test.com', 'Asunto', '<p>HTML</p>');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ from: 'test@vkb.com' }),
      );
    });

    it('sendBookingCancelled con lista vacía no invoca send', async () => {
      await service.sendBookingCancelled({
        ...BOOKING_CANCELLED_PARAMS,
        notifyEmails: [],
      });

      expect(mockSend).not.toHaveBeenCalled();
    });
  });
});
