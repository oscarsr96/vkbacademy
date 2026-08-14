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
      expect(isoWeek(new Date('2026-02-22T23:00:00Z'))).toBe('2026-W08');
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
    it('devuelve el lunes 00:00 UTC de la semana en curso', () => {
      expect(currentWeekStart(new Date('2026-02-19T17:45:00Z')).toISOString()).toBe(
        '2026-02-16T00:00:00.000Z',
      );
    });

    it('devuelve el mismo lunes cuando ya es lunes', () => {
      expect(currentWeekStart(new Date('2026-02-16T00:30:00Z')).toISOString()).toBe(
        '2026-02-16T00:00:00.000Z',
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
