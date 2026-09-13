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

    it('un rechazo de la API de Resend (que no lanza, devuelve { error }) queda en el log', async () => {
      // Resend responde 200 con { data: null, error } cuando rechaza el envío
      // (dominio sin verificar, remitente inválido, key sin permisos). Sin
      // mirar `error`, el correo se pierde sin dejar rastro.
      mockSend.mockResolvedValue({
        data: null,
        error: { name: 'validation_error', message: 'The vallekasbasket.com domain is not verified' },
      });
      const errorSpy = jest.spyOn(service['logger'], 'error').mockImplementation(() => undefined);

      await service.sendEmail('dest@test.com', 'Asunto', '<p>HTML</p>');

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('domain is not verified'));
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('dest@test.com'));
    });

    it('un envío aceptado deja el id de Resend en el log', async () => {
      mockSend.mockResolvedValue({ data: { id: 'msg-1' }, error: null });
      const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation(() => undefined);

      await service.sendEmail('dest@test.com', 'Asunto', '<p>HTML</p>');

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('msg-1'));
    });

    it('sendEmail utiliza el from configurado en EMAIL_FROM', async () => {
      await service.sendEmail('dest@test.com', 'Asunto', '<p>HTML</p>');

      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ from: 'test@vkb.com' }));
    });
  });
});
