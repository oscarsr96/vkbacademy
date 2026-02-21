import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAvailabilitySlotDto } from './dto/create-availability-slot.dto';

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllTeachers() {
    return this.prisma.teacherProfile.findMany({
      include: {
        user: {
          select: { id: true, name: true, avatarUrl: true },
        },
        availability: true,
      },
    });
  }

  /**
   * Devuelve los slots libres de un profesor en un rango de fechas.
   * Cruza la disponibilidad recurrente con las reservas ya existentes.
   */
  async getFreeSlots(teacherId: string, from: Date, to: Date) {
    const [availability, existingBookings] = await Promise.all([
      this.prisma.availabilitySlot.findMany({ where: { teacherId } }),
      this.prisma.booking.findMany({
        where: {
          teacherId,
          startAt: { gte: from },
          endAt: { lte: to },
          status: { not: 'CANCELLED' },
        },
      }),
    ]);

    const freeSlots: { teacherId: string; startAt: Date; endAt: Date }[] = [];
    const current = new Date(from);

    while (current <= to) {
      const dayOfWeek = current.getDay();
      const slotsForDay = availability.filter((s) => s.dayOfWeek === dayOfWeek);

      for (const slot of slotsForDay) {
        const [startH, startM] = slot.startTime.split(':').map(Number);
        const [endH, endM] = slot.endTime.split(':').map(Number);

        const startAt = new Date(current);
        startAt.setHours(startH, startM, 0, 0);

        const endAt = new Date(current);
        endAt.setHours(endH, endM, 0, 0);

        // Descartar slots ya pasados
        if (startAt <= new Date()) continue;

        // Verificar si hay conflicto con reservas existentes
        const hasConflict = existingBookings.some(
          (b) => b.startAt < endAt && b.endAt > startAt,
        );

        if (!hasConflict) {
          freeSlots.push({ teacherId, startAt, endAt });
        }
      }

      current.setDate(current.getDate() + 1);
    }

    return freeSlots;
  }

  /** Devuelve los slots de disponibilidad del profesor autenticado */
  async getMySlots(userId: string) {
    const profile = await this.prisma.teacherProfile.findUnique({ where: { userId } });
    if (!profile) return [];
    return this.prisma.availabilitySlot.findMany({
      where: { teacherId: profile.id },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  /** Añade un slot de disponibilidad al profesor autenticado */
  async addSlot(userId: string, dto: CreateAvailabilitySlotDto) {
    const profile = await this.prisma.teacherProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Perfil de profesor no encontrado');

    // Evitar duplicados: mismo día y hora de inicio
    const existing = await this.prisma.availabilitySlot.findFirst({
      where: { teacherId: profile.id, dayOfWeek: dto.dayOfWeek, startTime: dto.startTime },
    });
    if (existing) throw new ConflictException('Ya tienes un slot de disponibilidad en ese horario');

    return this.prisma.availabilitySlot.create({
      data: { teacherId: profile.id, ...dto },
    });
  }

  /** Elimina un slot de disponibilidad (solo el propio profesor) */
  async removeSlot(slotId: string, userId: string) {
    const slot = await this.prisma.availabilitySlot.findUnique({
      where: { id: slotId },
      include: { teacher: true },
    });
    if (!slot) throw new NotFoundException('Slot no encontrado');
    if (slot.teacher.userId !== userId)
      throw new ForbiddenException('No tienes permisos para eliminar este slot');
    return this.prisma.availabilitySlot.delete({ where: { id: slotId } });
  }
}
