import { ChallengeType } from '@prisma/client';

/** Devuelve la semana ISO como "2026-W07" */
export function isoWeek(date: Date): string {
  // Partir del día de calendario en Madrid, no de los componentes UTC: si no,
  // el día y la semana pueden rodar en instantes distintos (ver madridDay).
  const [year, month, day] = madridDay(date).split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  // Ajustar al jueves de la semana actual (ISO: la semana empieza el lunes)
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Devuelve la semana ISO anterior a la dada */
export function previousIsoWeek(week: string): string {
  const [yearStr, wStr] = week.split('-W');
  const year = parseInt(yearStr, 10);
  const w = parseInt(wStr, 10);
  if (w === 1) {
    // Semana 1 del año: la anterior es la última del año previo
    const dec28 = new Date(Date.UTC(year - 1, 11, 28));
    return isoWeek(dec28);
  }
  // Calcular lunes de la semana anterior
  const jan4 = new Date(Date.UTC(year, 0, 4));
  jan4.setUTCDate(jan4.getUTCDate() - (jan4.getUTCDay() || 7) + 1);
  jan4.setUTCDate(jan4.getUTCDate() + (w - 2) * 7);
  return isoWeek(jan4);
}

/**
 * Instante UTC que corresponde al lunes 00:00 de Madrid de la semana en curso.
 * Es el `since` de los retos WEEKLY.
 */
export function currentWeekStart(now: Date): Date {
  // Lunes de la semana, en calendario de Madrid (como placeholder UTC de esos
  // mismos componentes Y/M/D — todavía no es un instante real).
  const [year, month, day] = madridDay(now).split('-').map(Number);
  const monday = new Date(Date.UTC(year, month - 1, day));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() || 7) - 1));
  // Restar el offset de Madrid de ese lunes para obtener el instante real:
  // medianoche en Madrid = las 00:00 "wall clock" menos el adelanto sobre UTC.
  return new Date(monday.getTime() - madridOffsetMs(monday));
}

/**
 * Instante UTC en el que empieza el día de Madrid que contiene `now`.
 *
 * Mismo criterio que `currentWeekStart` pero para un día: derivar el offset en
 * vez de hardcodearlo es lo que hace que funcione igual en enero y en agosto,
 * y en un servidor que corre en UTC (Render) como en un portátil en Madrid.
 */
export function currentDayStart(now: Date): Date {
  const [year, month, day] = madridDay(now).split('-').map(Number);
  const midnight = new Date(Date.UTC(year, month - 1, day));
  return new Date(midnight.getTime() - madridOffsetMs(midnight));
}

/**
 * Diferencia en ms entre la hora de Madrid y UTC para un instante dado.
 * Madrid es UTC+1 en invierno (CET) y UTC+2 en verano (CEST); nunca se
 * hardcodea el número, se deriva comparando el mismo instante formateado en
 * ambas zonas.
 */
function madridOffsetMs(date: Date): number {
  const utcAsLocal = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const madridAsLocal = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
  return madridAsLocal.getTime() - utcAsLocal.getTime();
}

/**
 * Día del alumno como "2026-08-14", en Europe/Madrid.
 * En UTC, estudiar a la 01:00 de Madrid contaría como el día anterior y
 * rompería la racha de forma invisible. `en-CA` da el formato ISO.
 */
export function madridDay(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' });
}

/** Día anterior a "2026-08-14". Se ancla a mediodía UTC para no depender del DST. */
export function previousDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Tipos que pueden configurarse con cadencia WEEKLY: los contables dentro de
 * una ventana temporal. Los de estado (máximos, rachas, variedad acumulada)
 * no tienen sentido reiniciados cada semana.
 */
export const WEEKLY_CAPABLE_TYPES: ChallengeType[] = [
  ChallengeType.STUDY_PLAN_CREATED,
  ChallengeType.TOPICS_STUDIED,
  ChallengeType.THEORY_COMPLETED,
  ChallengeType.EXERCISES_SOLVED,
  ChallengeType.HARD_EXERCISES_SOLVED,
  ChallengeType.EXAM_COMPLETED,
  ChallengeType.EXAM_PERFECT,
  ChallengeType.TUTOR_QUESTIONS,
];

export function isWeeklyCapable(type: ChallengeType): boolean {
  return WEEKLY_CAPABLE_TYPES.includes(type);
}
