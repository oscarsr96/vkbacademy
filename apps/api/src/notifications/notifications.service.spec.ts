import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';

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

    it('sendPasswordReset incluye el resetUrl en el HTML enviado', async () => {
      const resetUrl = 'https://vkbacademy.com/reset?token=abc123';

      await service.sendPasswordReset({
        email: 'alumno@vkb.com',
        name: 'Álvaro García',
        resetUrl,
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
      const [{ html, subject }] = mockSend.mock.calls[0] as [{ html: string; subject: string }];
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

      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ from: 'test@vkb.com' }));
    });

    it('sendTutorWelcomeWithStudents incluye username y contraseña por defecto en el HTML', async () => {
      await service.sendTutorWelcomeWithStudents({
        tutorEmail: 't@x.com',
        tutorName: 'Tutor',
        tutorPassword: 'pass1234',
        students: [{ name: 'Juan', username: 'juan' }],
        defaultPassword: 'cambiar123',
        academyName: 'VKB',
        loginUrl: 'http://x/login',
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
      const [{ html }] = mockSend.mock.calls[0] as [{ html: string }];

      // Muestra el nombre y el username del alumno
      expect(html).toContain('Juan');
      expect(html).toContain('juan');
      // Una sola contraseña por defecto para todos los alumnos
      expect(html).toContain('cambiar123');
      // Credenciales del tutor
      expect(html).toContain('t@x.com');
      expect(html).toContain('pass1234');
    });
  });
});
