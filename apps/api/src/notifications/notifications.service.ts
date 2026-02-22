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
    this.from = config.get<string>('EMAIL_FROM', 'noreply@tuclub.com');

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

  /** Notifica al profesor cuando un tutor crea una nueva reserva */
  async sendBookingCreated(params: {
    teacherEmail: string;
    teacherName: string;
    studentName: string;
    tutorName: string;
    startAt: Date;
    endAt: Date;
    mode: string;
    courseName?: string;
  }) {
    const date = this.formatDate(params.startAt);
    const time = `${this.formatTime(params.startAt)} – ${this.formatTime(params.endAt)}`;
    const modeLabel = params.mode === 'ONLINE' ? 'Online' : 'Presencial';

    await this.sendEmail(
      params.teacherEmail,
      'Nueva solicitud de clase — VKB Academy',
      `<h2>Nueva solicitud de clase</h2>
       <p>El tutor <strong>${params.tutorName}</strong> ha solicitado una clase para su alumno <strong>${params.studentName}</strong>.</p>
       <table style="border-collapse:collapse;margin:1rem 0">
         <tr><td style="padding:4px 12px 4px 0;color:#666">Fecha:</td><td><strong>${date}</strong></td></tr>
         <tr><td style="padding:4px 12px 4px 0;color:#666">Hora:</td><td><strong>${time}</strong></td></tr>
         <tr><td style="padding:4px 12px 4px 0;color:#666">Modalidad:</td><td><strong>${modeLabel}</strong></td></tr>
         ${params.courseName ? `<tr><td style="padding:4px 12px 4px 0;color:#666">Asignatura:</td><td><strong>${params.courseName}</strong></td></tr>` : ''}
       </table>
       <p>Accede a VKB Academy para confirmar o rechazar la reserva.</p>`,
    );
  }

  /** Notifica al tutor y al alumno cuando el profesor confirma la reserva */
  async sendBookingConfirmed(params: {
    tutorEmail: string;
    studentEmail: string;
    tutorName: string;
    studentName: string;
    teacherName: string;
    startAt: Date;
    endAt: Date;
    mode: string;
    meetingUrl?: string | null;
    courseName?: string;
  }) {
    const date = this.formatDate(params.startAt);
    const time = `${this.formatTime(params.startAt)} – ${this.formatTime(params.endAt)}`;
    const modeLabel = params.mode === 'ONLINE' ? 'Online' : 'Presencial';
    const meetingRow = params.meetingUrl
      ? `<tr><td style="padding:4px 12px 4px 0;color:#666">Sala:</td><td><a href="${params.meetingUrl}">${params.meetingUrl}</a></td></tr>`
      : '';

    const html = (recipientName: string) =>
      `<h2>Clase confirmada ✅</h2>
       <p>Hola <strong>${recipientName}</strong>, la clase de <strong>${params.studentName}</strong> ha sido confirmada.</p>
       <table style="border-collapse:collapse;margin:1rem 0">
         <tr><td style="padding:4px 12px 4px 0;color:#666">Profesor:</td><td><strong>${params.teacherName}</strong></td></tr>
         <tr><td style="padding:4px 12px 4px 0;color:#666">Fecha:</td><td><strong>${date}</strong></td></tr>
         <tr><td style="padding:4px 12px 4px 0;color:#666">Hora:</td><td><strong>${time}</strong></td></tr>
         <tr><td style="padding:4px 12px 4px 0;color:#666">Modalidad:</td><td><strong>${modeLabel}</strong></td></tr>
         ${params.courseName ? `<tr><td style="padding:4px 12px 4px 0;color:#666">Asignatura:</td><td><strong>${params.courseName}</strong></td></tr>` : ''}
         ${meetingRow}
       </table>`;

    await Promise.allSettled([
      this.sendEmail(params.tutorEmail, 'Clase confirmada — VKB Academy', html(params.tutorName)),
      this.sendEmail(params.studentEmail, 'Clase confirmada — VKB Academy', html(params.studentName)),
    ]);
  }

  /** Notifica a las partes afectadas cuando se cancela una reserva */
  async sendBookingCancelled(params: {
    notifyEmails: Array<{ email: string; name: string }>;
    studentName: string;
    teacherName: string;
    startAt: Date;
    endAt: Date;
    mode: string;
  }) {
    const date = this.formatDate(params.startAt);
    const time = `${this.formatTime(params.startAt)} – ${this.formatTime(params.endAt)}`;
    const modeLabel = params.mode === 'ONLINE' ? 'Online' : 'Presencial';

    await Promise.allSettled(
      params.notifyEmails.map(({ email, name }) =>
        this.sendEmail(
          email,
          'Clase cancelada — VKB Academy',
          `<h2>Clase cancelada ❌</h2>
           <p>Hola <strong>${name}</strong>, la siguiente clase ha sido cancelada.</p>
           <table style="border-collapse:collapse;margin:1rem 0">
             <tr><td style="padding:4px 12px 4px 0;color:#666">Alumno:</td><td><strong>${params.studentName}</strong></td></tr>
             <tr><td style="padding:4px 12px 4px 0;color:#666">Profesor:</td><td><strong>${params.teacherName}</strong></td></tr>
             <tr><td style="padding:4px 12px 4px 0;color:#666">Fecha:</td><td><strong>${date}</strong></td></tr>
             <tr><td style="padding:4px 12px 4px 0;color:#666">Hora:</td><td><strong>${time}</strong></td></tr>
             <tr><td style="padding:4px 12px 4px 0;color:#666">Modalidad:</td><td><strong>${modeLabel}</strong></td></tr>
           </table>`,
        ),
      ),
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
         <a href="${params.resetUrl}" style="background:#ea580c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">
           Restablecer contraseña
         </a>
       </p>
       <p style="color:#666;font-size:0.875rem">Este enlace expira en 1 hora. Si no solicitaste este cambio, ignora este email.</p>`,
    );
  }

  // ---------------------------------------------------------------------------
  // Helpers de formato de fecha
  // ---------------------------------------------------------------------------

  private formatDate(date: Date): string {
    return date.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }
}
