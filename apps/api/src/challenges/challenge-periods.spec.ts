import * as fs from 'node:fs';
import * as path from 'node:path';
import { ChallengeType } from '@prisma/client';
import {
  isoWeek,
  previousIsoWeek,
  currentWeekStart,
  madridDay,
  previousDay,
  isWeeklyCapable,
  WEEKLY_CAPABLE_TYPES,
} from './challenge-periods';

describe('challenge-periods', () => {
  describe('isoWeek', () => {
    it('devuelve la semana ISO de un lunes', () => {
      expect(isoWeek(new Date('2026-02-16T12:00:00Z'))).toBe('2026-W08');
    });

    it('devuelve la misma semana para el domingo siguiente', () => {
      // 2026-02-22T12:00:00Z son las 13:00 en Madrid (CET, invierno): sigue siendo domingo.
      expect(isoWeek(new Date('2026-02-22T12:00:00Z'))).toBe('2026-W08');
    });

    // Frontera: 23:30 UTC del domingo 22 ya son las 00:30 del lunes 23 en Madrid
    // (CET, +1h). El día de calendario en Madrid manda sobre el de UTC.
    it('cruza a la semana siguiente si en Madrid ya es lunes aunque en UTC siga siendo domingo', () => {
      expect(isoWeek(new Date('2026-02-22T23:30:00Z'))).toBe('2026-W09');
    });
  });

  describe('previousIsoWeek', () => {
    it('retrocede una semana dentro del mismo año', () => {
      expect(previousIsoWeek('2026-W08')).toBe('2026-W07');
    });

    it('cruza el cambio de año hacia la última semana del año anterior', () => {
      expect(previousIsoWeek('2026-W01')).toBe('2025-W52');
    });
  });

  describe('currentWeekStart', () => {
    // Febrero es CET (UTC+1): medianoche del lunes 16 en Madrid son las 23:00 UTC del domingo 15.
    it('devuelve el lunes 00:00 de Madrid de la semana en curso, en invierno (CET)', () => {
      expect(currentWeekStart(new Date('2026-02-19T17:45:00Z')).toISOString()).toBe(
        '2026-02-15T23:00:00.000Z',
      );
    });

    it('devuelve el mismo lunes cuando ya es lunes', () => {
      expect(currentWeekStart(new Date('2026-02-16T00:30:00Z')).toISOString()).toBe(
        '2026-02-15T23:00:00.000Z',
      );
    });

    // Verano: agosto es CEST (UTC+2). El 14-08-2026 es viernes, su lunes es el 10;
    // medianoche del lunes en Madrid son las 22:00 UTC del domingo 9.
    it('devuelve el lunes 00:00 de Madrid de la semana en curso, en verano (CEST)', () => {
      expect(currentWeekStart(new Date('2026-08-14T10:00:00Z')).toISOString()).toBe(
        '2026-08-09T22:00:00.000Z',
      );
    });
  });

  // Los dos lunes del año en que el offset de Madrid cambia respecto a la
  // semana anterior. Es donde el cálculo puede fallar (medianoche del lunes
  // resuelta con el offset equivocado ⇒ la ventana semanal se abre una hora
  // antes o después y los retos WEEKLY cuentan de más o de menos).
  // En 2026: CET→CEST el domingo 29 de marzo, CEST→CET el domingo 25 de octubre.
  describe('currentWeekStart en los cambios de horario de 2026', () => {
    it('la semana que CONTIENE el cambio de marzo arranca en CET (lunes 23, 23:00 UTC del domingo 22)', () => {
      // Miércoles 25 de marzo, aún CET
      expect(currentWeekStart(new Date('2026-03-25T09:00:00Z')).toISOString()).toBe(
        '2026-03-22T23:00:00.000Z',
      );
      // Y el propio domingo del cambio, ya en CEST, sigue apuntando a ese lunes
      expect(currentWeekStart(new Date('2026-03-29T10:00:00Z')).toISOString()).toBe(
        '2026-03-22T23:00:00.000Z',
      );
    });

    it('la semana SIGUIENTE al cambio de marzo arranca en CEST (lunes 30, 22:00 UTC del domingo 29)', () => {
      expect(currentWeekStart(new Date('2026-03-30T08:00:00Z')).toISOString()).toBe(
        '2026-03-29T22:00:00.000Z',
      );
      expect(currentWeekStart(new Date('2026-04-02T12:00:00Z')).toISOString()).toBe(
        '2026-03-29T22:00:00.000Z',
      );
    });

    it('la semana que CONTIENE el cambio de octubre arranca en CEST (lunes 19, 22:00 UTC del domingo 18)', () => {
      expect(currentWeekStart(new Date('2026-10-21T09:00:00Z')).toISOString()).toBe(
        '2026-10-18T22:00:00.000Z',
      );
      // Domingo 25 tras el cambio, ya CET: la semana no se mueve
      expect(currentWeekStart(new Date('2026-10-25T10:00:00Z')).toISOString()).toBe(
        '2026-10-18T22:00:00.000Z',
      );
    });

    it('la semana SIGUIENTE al cambio de octubre arranca en CET (lunes 26, 23:00 UTC del domingo 25)', () => {
      expect(currentWeekStart(new Date('2026-10-26T08:00:00Z')).toISOString()).toBe(
        '2026-10-25T23:00:00.000Z',
      );
      expect(currentWeekStart(new Date('2026-10-29T12:00:00Z')).toISOString()).toBe(
        '2026-10-25T23:00:00.000Z',
      );
    });

    it('la semana ISO también rueda en el lunes correcto alrededor de los cambios', () => {
      // 2026-03-29 (domingo) es la última de su semana; el 30 ya es la siguiente
      expect(isoWeek(new Date('2026-03-29T10:00:00Z'))).toBe('2026-W13');
      expect(isoWeek(new Date('2026-03-30T08:00:00Z'))).toBe('2026-W14');
      expect(isoWeek(new Date('2026-10-25T10:00:00Z'))).toBe('2026-W43');
      expect(isoWeek(new Date('2026-10-26T08:00:00Z'))).toBe('2026-W44');
    });
  });

  describe('madridDay', () => {
    // Verano: Madrid es UTC+2. Las 23:30 UTC ya son el día siguiente en Madrid.
    it('usa el huso de Madrid, no UTC, en horario de verano', () => {
      expect(madridDay(new Date('2026-08-14T23:30:00Z'))).toBe('2026-08-15');
    });

    // Invierno: Madrid es UTC+1. Las 00:30 de Madrid son las 23:30 UTC del día anterior.
    it('usa el huso de Madrid, no UTC, en horario de invierno', () => {
      expect(madridDay(new Date('2026-01-14T23:30:00Z'))).toBe('2026-01-15');
    });
  });

  describe('previousDay', () => {
    it('retrocede un día', () => {
      expect(previousDay('2026-08-14')).toBe('2026-08-13');
    });

    it('cruza el cambio de mes', () => {
      expect(previousDay('2026-03-01')).toBe('2026-02-28');
    });
  });

  /**
   * El panel de admin (`apps/web/src/pages/admin/AdminChallengesPage.tsx`)
   * duplica esta lista a mano — decisión consciente del proyecto: la web no
   * importa código de la API. Pero esa copia no es cosmética: gobierna el
   * `onChange` que fuerza `cadence: 'PERMANENT'`, así que si se queda corta,
   * un admin que edite un reto semanal legítimo verá su cadencia degradada en
   * silencio con un PATCH perfectamente válido — y eso dispara el repago de
   * puntos que bloquea `assertCadenceChangeAllowed`.
   *
   * El test vive en la API (y no en la web) porque el pipeline solo ejecuta
   * `pnpm --filter @vkbacademy/api test`: aquí falla el despliegue, en la web
   * pasaría inadvertido. Y vive junto a la lista canónica para que quien la
   * edite lo vea.
   */
  describe('paridad con la lista duplicada del panel de admin', () => {
    const ADMIN_PAGE = path.resolve(
      __dirname,
      '../../../web/src/pages/admin/AdminChallengesPage.tsx',
    );

    function weeklyTypesInAdminPage(): string[] {
      const source = fs.readFileSync(ADMIN_PAGE, 'utf8');
      const block = source.match(
        /WEEKLY_CAPABLE_TYPES\s*:\s*AdminChallengeType\[\]\s*=\s*\[([^\]]*)\]/,
      );
      if (!block) {
        throw new Error(
          `No se encontró WEEKLY_CAPABLE_TYPES en ${ADMIN_PAGE}. ` +
            'Si se ha renombrado o movido, actualiza este test: la lista del panel ' +
            'debe seguir cuadrando con la de la API.',
        );
      }
      return [...block[1].matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);
    }

    it('el panel de admin ofrece exactamente los mismos tipos semanales que la API', () => {
      expect(weeklyTypesInAdminPage().sort()).toEqual([...WEEKLY_CAPABLE_TYPES].sort());
    });
  });

  describe('isWeeklyCapable', () => {
    it('acepta los tipos contables en ventana', () => {
      expect(isWeeklyCapable(ChallengeType.EXERCISES_SOLVED)).toBe(true);
      expect(isWeeklyCapable(ChallengeType.TOPICS_STUDIED)).toBe(true);
      expect(isWeeklyCapable(ChallengeType.EXAM_COMPLETED)).toBe(true);
    });

    it('rechaza los tipos de estado', () => {
      expect(isWeeklyCapable(ChallengeType.STREAK_DAILY)).toBe(false);
      expect(isWeeklyCapable(ChallengeType.EXAM_SCORE)).toBe(false);
      expect(isWeeklyCapable(ChallengeType.SUBJECT_VARIETY)).toBe(false);
      expect(isWeeklyCapable(ChallengeType.EXERCISES_CORRECT_STREAK)).toBe(false);
    });
  });
});
