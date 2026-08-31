import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { madridDay } from '../challenges/challenge-periods';

/**
 * Histórico de días activos, la materia prima de las cohortes de retención.
 *
 * Dos caminos deliberadamente distintos: `recordVisit` lo llama el interceptor
 * en cuanto un alumno hace cualquier petición autenticada, y `recordWork` sale
 * de la racha, que ya sabe cuándo un día es nuevo para ese alumno. De la misma
 * fila salen las dos métricas: cuántos vuelven a abrir y cuántos vuelven a
 * trabajar.
 *
 * Ninguno de los dos lanza: medir no puede tumbar la petición de un alumno.
 */
@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordVisit(userId: string): Promise<void> {
    await this.record(userId, false);
  }

  async recordWork(userId: string): Promise<void> {
    await this.record(userId, true);
  }

  private async record(userId: string, worked: boolean): Promise<void> {
    try {
      const day = madridDay(new Date());
      const membership = await this.prisma.academyMember.findFirst({
        where: { userId },
        select: { academyId: true },
      });

      await this.prisma.userActivityDay.upsert({
        where: { userId_day: { userId, day } },
        create: { userId, day, worked, academyId: membership?.academyId ?? null },
        // Update vacío para la visita a propósito: si el alumno ya trabajó hoy,
        // que vuelva a abrir la app no puede devolver `worked` a false.
        update: worked ? { worked: true } : {},
      });
    } catch (err) {
      this.logger.error(`No se pudo registrar la actividad de userId=${userId}`, err);
    }
  }
}
