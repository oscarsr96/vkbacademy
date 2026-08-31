import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GuardiansService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Baja del resumen semanal. Idempotente y sin distinguir un token válido de
   * uno inventado: el endpoint es público y no puede convertirse en un oráculo
   * de qué tokens existen.
   */
  async unsubscribe(token: string): Promise<{ ok: true }> {
    await this.prisma.guardianSubscription.updateMany({
      // unsubscribedAt: null para no pisar la fecha de una baja anterior:
      // darse de baja dos veces no es una baja nueva.
      where: { token, unsubscribedAt: null },
      data: { unsubscribedAt: new Date() },
    });

    return { ok: true };
  }
}
