import { ChallengeType } from '@prisma/client';
import {
  isoWeek,
  previousIsoWeek,
  currentWeekStart,
  madridDay,
  previousDay,
  isWeeklyCapable,
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
