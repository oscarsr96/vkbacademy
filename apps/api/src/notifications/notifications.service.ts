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

  /**
   * Email único al tutor con sus credenciales + los accesos de cada alumno.
   * Cada alumno entra con su `username` y una `defaultPassword` común que debe
   * cambiar en el primer acceso — no se exponen contraseñas individuales.
   */
  async sendTutorWelcomeWithStudents(params: {
    tutorEmail: string;
    tutorName: string;
    tutorPassword: string;
    students: Array<{ name: string; username: string }>;
    defaultPassword: string;
    academyName: string;
    loginUrl: string;
  }) {
    const studentRows = params.students
      .map(
        (s) => `
         <tr>
           <td style="padding:8px 14px;border-bottom:1px solid #eee">${s.name}</td>
           <td style="padding:8px 14px;border-bottom:1px solid #eee"><code>${s.username}</code></td>
         </tr>`,
      )
      .join('');

    const studentsBlock =
      params.students.length > 0
        ? `<h3 style="margin-top:2rem">Accesos de tus alumnos</h3>
       <p>Cada alumno entra con su <strong>usuario</strong> y la contraseña por defecto
          <code>${params.defaultPassword}</code>. En el primer acceso deberá cambiarla.</p>
       <table style="border-collapse:collapse;margin:1rem 0;width:100%;max-width:560px">
         <thead>
           <tr style="background:#f8fafc">
             <th style="padding:10px 14px;text-align:left;color:#475569;font-size:0.85rem">Alumno</th>
             <th style="padding:10px 14px;text-align:left;color:#475569;font-size:0.85rem">Usuario</th>
           </tr>
         </thead>
         <tbody>${studentRows}</tbody>
       </table>`
        : '';

    await this.sendEmail(
      params.tutorEmail,
      `Bienvenido a ${params.academyName} — VKB Academy`,
      `<h2>¡Bienvenido a ${params.academyName}!</h2>
       <p>Hola <strong>${params.tutorName}</strong>, tu cuenta de tutor y la de tus alumnos se han creado correctamente.</p>

       <h3>Tus credenciales</h3>
       <table style="border-collapse:collapse;margin:1rem 0">
         <tr><td style="padding:4px 12px 4px 0;color:#666">Email:</td><td><strong>${params.tutorEmail}</strong></td></tr>
         <tr><td style="padding:4px 12px 4px 0;color:#666">Contraseña:</td><td><strong>${params.tutorPassword}</strong></td></tr>
       </table>

       ${studentsBlock}

       <p style="margin:1.5rem 0">
         <a href="${params.loginUrl}" style="background:#f5911e;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">
           Acceder a la plataforma
         </a>
       </p>`,
    );
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
