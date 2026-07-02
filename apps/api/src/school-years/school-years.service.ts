import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TtlCache } from '../common/ttl-cache';
import type { SchoolYear } from '@prisma/client';

/**
 * Niveles educativos por defecto. Son datos de referencia que la app necesita
 * para funcionar (el selector de "Curso del alumno" en el registro los lee).
 * El orden refleja el orden pedagógico, no alfabético.
 */
const DEFAULT_SCHOOL_YEARS: ReadonlyArray<{ name: string; label: string }> = [
  { name: '1eso', label: '1º ESO' },
  { name: '2eso', label: '2º ESO' },
  { name: '3eso', label: '3º ESO' },
  { name: '4eso', label: '4º ESO' },
  { name: '1bach', label: '1º Bachillerato' },
  { name: '2bach', label: '2º Bachillerato' },
];

@Injectable()
export class SchoolYearsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SchoolYearsService.name);
  // Datos casi estáticos: un único valor cacheado bajo una misma clave
  private readonly cache = new TtlCache<'all', SchoolYear[]>(5 * 60 * 1000);

  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const cached = this.cache.get('all');
    if (cached) return cached;

    const schoolYears = await this.prisma.schoolYear.findMany({ orderBy: { name: 'asc' } });
    this.cache.set('all', schoolYears);
    return schoolYears;
  }

  /**
   * Garantiza que los niveles por defecto existen en cualquier entorno
   * (PRE, PROD, local o cualquiera nuevo) en cada arranque. Es idempotente:
   * `name` es único, así que el upsert crea los que falten y no duplica los
   * existentes. Resiliente: un fallo de BD no debe impedir el arranque de la
   * API — se registra y se continúa (el siguiente deploy lo reintenta).
   */
  async onApplicationBootstrap(): Promise<void> {
    try {
      for (const sy of DEFAULT_SCHOOL_YEARS) {
        await this.prisma.schoolYear.upsert({
          where: { name: sy.name },
          update: { label: sy.label },
          create: sy,
        });
      }
    } catch (err) {
      this.logger.error(
        `No se pudieron garantizar los niveles por defecto: ${
          err instanceof Error ? err.message : 'desconocido'
        }`,
      );
    }
  }
}
