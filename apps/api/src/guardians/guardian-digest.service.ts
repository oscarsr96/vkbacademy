import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { addDays, currentWeekStart, isoWeek, madridDay } from '../challenges/challenge-periods';

/** Lo que se cuenta de cada hijo en el correo. */
export interface ChildSummary {
  name: string;
  workedDays: number;
  currentDailyStreak: number;
  certificates: number;
}

const DAYS_IN_WEEK = 7;

/**
 * Resumen semanal a la familia.
 *
 * Un correo por familia y no por alumno: `guardianEmail` está copiado en cada
 * hermano, así que enviar por alumno serían tres correos al mismo buzón.
 *
 * Lo invoca `apps/api/scripts/send-weekly-digest.ts` desde un workflow de
 * GitHub Actions con `schedule:`. La lógica vive aquí, dentro de la API, para
 * poder testearla; el script solo arranca el contexto de Nest.
 */
@Injectable()
export class GuardianDigestService {
  private readonly logger = new Logger(GuardianDigestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  async sendWeeklyDigests(opts: { dryRun?: boolean } = {}): Promise<{
    sent: number;
    skipped: number;
  }> {
    const now = new Date();
    const week = isoWeek(now);
    const days = this.reportedWeekDays(now);
    const [from, to] = [days[0], days[days.length - 1]];

    const subscriptions = await this.prisma.guardianSubscription.findMany({
      where: { unsubscribedAt: null },
      select: { id: true, email: true, token: true, lastSentWeek: true },
    });

    let sent = 0;
    let skipped = 0;

    for (const sub of subscriptions) {
      // El filtro va aquí y no en el `where`: `NOT: { lastSentWeek: week }` en
      // SQL deja fuera las filas con NULL, así que una familia nueva no
      // recibiría nunca nada y nada fallaría.
      if (sub.lastSentWeek === week) {
        skipped++;
        continue;
      }

      try {
        const children = await this.summarizeChildren(sub.email, days, from, to);
        if (children.length === 0) {
          skipped++;
          continue;
        }

        if (opts.dryRun) {
          sent++;
          continue;
        }

        await this.notifications.sendEmail(
          sub.email,
          'Cómo ha ido la semana en VKB Academy',
          buildDigestHtml(children, `${this.frontendUrl()}/baja/${sub.token}`),
        );

        // Solo después de enviar: marcarla antes daría la semana por enviada
        // aunque Resend hubiera fallado.
        await this.prisma.guardianSubscription.update({
          where: { id: sub.id },
          data: { lastSentWeek: week },
        });
        sent++;
      } catch (error) {
        // Una familia que falla no puede dejar sin correo a las demás.
        this.logger.error(`No se pudo enviar el resumen a ${sub.email}`, error as Error);
      }
    }

    return { sent, skipped };
  }

  /** Los siete días de la semana que se reporta: la que acaba de terminar. */
  private reportedWeekDays(now: Date): string[] {
    const thisMonday = currentWeekStart(now);
    const lastMonday = madridDay(new Date(thisMonday.getTime() - DAYS_IN_WEEK * 86_400_000));
    return Array.from({ length: DAYS_IN_WEEK }, (_, i) => addDays(lastMonday, i));
  }

  private async summarizeChildren(
    guardianEmail: string,
    days: string[],
    from: string,
    to: string,
  ): Promise<ChildSummary[]> {
    const students = await this.prisma.user.findMany({
      where: { guardianEmail, role: Role.STUDENT },
      select: { id: true, name: true, currentDailyStreak: true },
    });
    if (students.length === 0) return [];

    const ids = students.map((s) => s.id);
    const [activity, certificates] = await Promise.all([
      this.prisma.userActivityDay.findMany({
        where: { userId: { in: ids }, worked: true, day: { gte: from, lte: to } },
        select: { userId: true, day: true },
      }),
      this.prisma.certificate.findMany({
        where: {
          userId: { in: ids },
          issuedAt: { gte: new Date(`${from}T00:00:00Z`), lt: new Date(`${to}T23:59:59Z`) },
        },
        select: { userId: true },
      }),
    ]);

    const workedByUser = new Map<string, number>();
    for (const row of activity) {
      workedByUser.set(row.userId, (workedByUser.get(row.userId) ?? 0) + 1);
    }
    const certsByUser = new Map<string, number>();
    for (const row of certificates) {
      certsByUser.set(row.userId, (certsByUser.get(row.userId) ?? 0) + 1);
    }

    return students.map((s) => ({
      name: s.name,
      workedDays: workedByUser.get(s.id) ?? 0,
      currentDailyStreak: s.currentDailyStreak,
      certificates: certsByUser.get(s.id) ?? 0,
    }));
  }

  /** `FRONTEND_URL` admite varios orígenes separados por comas; vale el primero. */
  private frontendUrl(): string {
    const raw = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    return raw.split(',')[0].trim().replace(/\/$/, '');
  }
}

/**
 * El HTML del correo. Aparte del servicio para poder probar el contenido sin
 * tocar Prisma.
 *
 * No compara a los hermanos entre sí ni menciona puestos: es la misma línea que
 * llevó a la clasificación semanal a construirse en franja local y sin
 * posiciones. Al hijo que no ha entrado se le dedica una línea neutra: es el
 * dato más útil para un padre y a la vez el que más se acerca a la vigilancia,
 * y la forma de darlo es lo único que separa una cosa de la otra.
 */
export function buildDigestHtml(children: ChildSummary[], unsubscribeUrl: string): string {
  const bloques = children
    .map((c) => {
      if (c.workedDays === 0) {
        return `<p style="margin:0 0 1rem"><strong>${c.name}</strong><br />Esta semana no ha entrado.</p>`;
      }

      const lineas = [
        `Ha estudiado ${c.workedDays} ${c.workedDays === 1 ? 'día' : 'días'}.`,
        c.currentDailyStreak > 1 ? `Lleva ${c.currentDailyStreak} días seguidos.` : null,
        c.certificates > 0
          ? `Ha conseguido ${c.certificates} ${c.certificates === 1 ? 'certificado' : 'certificados'}.`
          : null,
      ].filter(Boolean);

      return `<p style="margin:0 0 1rem"><strong>${c.name}</strong><br />${lineas.join('<br />')}</p>`;
    })
    .join('\n');

  return `<h2 style="margin:0 0 1rem">Cómo ha ido la semana</h2>
${bloques}
<p style="color:#666;font-size:0.8rem;margin-top:2rem">
  Recibes este correo porque pediste el resumen semanal al registrar a tus hijos.
  <a href="${unsubscribeUrl}">Darse de baja</a>.
</p>`;
}
