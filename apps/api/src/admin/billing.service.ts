import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookingMode, BookingStatus, Role } from '@prisma/client';
import { UpdateBillingConfigDto } from './dto/update-billing-config.dto';

// Constantes de pricing de terceros (no configurables, reflejan los planes de los proveedores)
const RESEND_FREE_EMAILS_PER_MONTH = 3_000;
const RESEND_PAID_EUR_PER_MONTH = 20;
const DAILY_CO_FREE_MINUTES_PER_MONTH = 2_000;
const DAILY_CO_RATE_USD_PER_MINUTE = 0.00099; // ~0.00099 $/min participante

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(from?: string, to?: string) {
    // Rango por defecto: mes en curso
    const now = new Date();
    const periodFrom = from
      ? new Date(from)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const periodTo = to ? new Date(to) : now;

    // Número de meses (proporcional a los días del período)
    const msInDay = 86_400_000;
    const days = (periodTo.getTime() - periodFrom.getTime()) / msInDay + 1;
    const months = days / 30.44;

    // Obtener (o crear) la configuración singleton
    const config = await this.prisma.billingConfig.upsert({
      where: { id: 'default' },
      create: { id: 'default' },
      update: {},
    });

    // ── Ingresos: suscripciones ────────────────────────────────────────────────

    const activeStudents = await this.prisma.user.count({
      where: { role: Role.STUDENT },
    });

    const subscriptionTotal = activeStudents * config.studentMonthlyPrice * months;

    // ── Ingresos: clases ───────────────────────────────────────────────────────

    const confirmedBookings = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.CONFIRMED,
        startAt: { gte: periodFrom, lte: periodTo },
      },
      select: { startAt: true, endAt: true, mode: true },
    });

    let onlineMinutes = 0;
    let inPersonMinutes = 0;

    for (const booking of confirmedBookings) {
      const durationMs = booking.endAt.getTime() - booking.startAt.getTime();
      const durationMinutes = durationMs / 60_000;
      if (booking.mode === BookingMode.ONLINE) {
        onlineMinutes += durationMinutes;
      } else {
        inPersonMinutes += durationMinutes;
      }
    }

    const onlineHours = onlineMinutes / 60;
    const inPersonHours = inPersonMinutes / 60;

    const grossClassRevenue =
      onlineHours * config.classOnlineRatePerHour +
      inPersonHours * config.classInPersonRatePerHour;

    const classCommission = grossClassRevenue * config.clubCommissionRate;

    const totalRevenue = subscriptionTotal + classCommission;

    // ── Costes ─────────────────────────────────────────────────────────────────

    // Estimación de emails: nuevos usuarios × 2 (bienvenida + verificación)
    //                       + reservas del período × 3 (confirmación, recordatorio, cancelación)
    const newUsers = await this.prisma.user.count({
      where: { createdAt: { gte: periodFrom, lte: periodTo } },
    });

    const bookingsInPeriod = await this.prisma.booking.count({
      where: { createdAt: { gte: periodFrom, lte: periodTo } },
    });

    const estimatedEmailsPerMonth = newUsers * 2 + bookingsInPeriod * 3;
    const totalEstimatedEmails = estimatedEmailsPerMonth; // ya es el período, no hace falta × months

    const resendFreeLimit = RESEND_FREE_EMAILS_PER_MONTH * months;
    const resendTier = totalEstimatedEmails <= resendFreeLimit ? 'free' : 'paid';
    const resendCost =
      resendTier === 'free' ? 0 : RESEND_PAID_EUR_PER_MONTH * months;

    // Daily.co: minutos de participantes × 2 personas por sesión
    const participantMinutes = onlineMinutes * 2;
    const dailyFreeLimit = DAILY_CO_FREE_MINUTES_PER_MONTH * months;
    const dailyTier = participantMinutes <= dailyFreeLimit ? 'free' : 'paid';
    const dailyExcessMinutes = Math.max(0, participantMinutes - dailyFreeLimit);
    const dailyCost =
      dailyTier === 'free' ? 0 : dailyExcessMinutes * DAILY_CO_RATE_USD_PER_MINUTE;

    // Costes flat × meses
    const s3Cost = config.s3MonthlyCost * months;
    const anthropicCost = config.anthropicMonthlyCost * months;
    const infraCost = config.infrastructureMonthlyCost * months;

    const totalCosts = resendCost + dailyCost + s3Cost + anthropicCost + infraCost;

    const net = totalRevenue - totalCosts;
    const margin = totalRevenue > 0 ? (net / totalRevenue) * 100 : 0;

    return {
      period: {
        from: periodFrom.toISOString().split('T')[0],
        to: periodTo.toISOString().split('T')[0],
        months: parseFloat(months.toFixed(2)),
      },
      config,
      revenue: {
        subscriptions: {
          activeStudents,
          monthlyPrice: config.studentMonthlyPrice,
          months: parseFloat(months.toFixed(2)),
          total: parseFloat(subscriptionTotal.toFixed(2)),
        },
        classes: {
          confirmedCount: confirmedBookings.length,
          onlineHours: parseFloat(onlineHours.toFixed(2)),
          inPersonHours: parseFloat(inPersonHours.toFixed(2)),
          grossRevenue: parseFloat(grossClassRevenue.toFixed(2)),
          commissionRate: config.clubCommissionRate,
          commission: parseFloat(classCommission.toFixed(2)),
        },
        total: parseFloat(totalRevenue.toFixed(2)),
      },
      costs: {
        resend: {
          estimatedEmails: totalEstimatedEmails,
          estimated: parseFloat(resendCost.toFixed(2)),
          tier: resendTier,
        },
        dailyCo: {
          participantMinutes: parseFloat(participantMinutes.toFixed(0)),
          estimated: parseFloat(dailyCost.toFixed(2)),
          tier: dailyTier,
        },
        s3: {
          estimated: parseFloat(s3Cost.toFixed(2)),
        },
        anthropic: {
          estimated: parseFloat(anthropicCost.toFixed(2)),
        },
        infrastructure: {
          estimated: parseFloat(infraCost.toFixed(2)),
        },
        total: parseFloat(totalCosts.toFixed(2)),
      },
      net: parseFloat(net.toFixed(2)),
      margin: parseFloat(margin.toFixed(1)),
    };
  }

  async updateConfig(dto: UpdateBillingConfigDto) {
    return this.prisma.billingConfig.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...dto },
      update: dto,
    });
  }
}
