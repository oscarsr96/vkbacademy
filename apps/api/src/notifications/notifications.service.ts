import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class NotificationsService {
  private resend: Resend | null = null;
  private readonly from: string;
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly config: ConfigService) {
    const apiKey = config.get<string>('RESEND_API_KEY');
    this.from = config.get<string>('EMAIL_FROM', 'VKB Academy <info@vallekasbasket.com>');

    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.logger.warn('RESEND_API_KEY no configurado — los emails están desactivados');
    }
  }

  async sendEmail(to: string, subject: string, html: string) {
    if (!this.resend) {
      this.logger.debug(`[DEV] Email omitido (sin API key) → ${to}: ${subject}`);
      return;
    }
    try {
      await this.resend.emails.send({ from: this.from, to, subject, html });
    } catch (error) {
      this.logger.error(`Error enviando email a ${to}: ${(error as Error).message}`);
    }
  }

  /** Envía el enlace de restablecimiento de contraseña al usuario */
  async sendPasswordReset(params: { email: string; name: string; resetUrl: string }) {
    await this.sendEmail(
      params.email,
      'Restablecer contraseña — VKB Academy',
      `<h2>Restablecer contraseña</h2>
       <p>Hola <strong>${params.name}</strong>, hemos recibido una solicitud para restablecer tu contraseña.</p>
       <p style="margin:1.5rem 0">
         <a href="${params.resetUrl}" style="background:#f5911e;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">
           Restablecer contraseña
         </a>
       </p>
       <p style="color:#666;font-size:0.875rem">Este enlace expira en 1 hora. Si no solicitaste este cambio, ignora este email.</p>`,
    );
  }
}
