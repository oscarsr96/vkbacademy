import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Genera identificadores de login legibles y únicos para alumnos.
 * El username es el slug del nombre; las colisiones se resuelven con sufijo (-2, -3, ...).
 */
@Injectable()
export class UsernameService {
  constructor(private readonly prisma: PrismaService) {}

  /** "María Pérez Ñoño" → "maria-perez-nono" */
  slugify(name: string): string {
    return (
      name
        .normalize('NFD')
        // Marca de diacríticos: U+0300 a U+036F (tildes, virgulillas, etc.)
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
    );
  }

  /**
   * Asigna un username único por cada nombre recibido.
   * Comprueba colisiones contra BD y contra los ya asignados en esta misma tanda.
   */
  async allocate(names: string[]): Promise<string[]> {
    const used = new Set<string>();
    const result: string[] = [];

    for (const name of names) {
      const base = this.slugify(name) || 'alumno';
      let candidate = base;
      let suffix = 1;

      while (
        used.has(candidate) ||
        (await this.prisma.user.findUnique({ where: { username: candidate } }))
      ) {
        suffix++;
        candidate = `${base}-${suffix}`;
      }

      used.add(candidate);
      result.push(candidate);
    }

    return result;
  }
}
