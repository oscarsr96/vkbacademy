import { isoWeek, madridDay } from '../challenges/challenge-periods';

export interface RetentionStudent {
  id: string;
  createdAt: Date;
}

export interface RetentionActivity {
  userId: string;
  day: string;
  worked: boolean;
}

export interface RetentionCohort {
  week: string;
  signups: number;
  /** Porcentaje 0-100, o null mientras el plazo de la cohorte no haya cerrado. */
  d1Opened: number | null;
  d1Worked: number | null;
  d7Opened: number | null;
  d7Worked: number | null;
  d1Complete: boolean;
  d7Complete: boolean;
}

/** Suma n días a un día "2026-08-31" y devuelve el mismo formato. */
function addDays(day: string, n: number): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date + n)).toISOString().slice(0, 10);
}

const pct = (part: number, total: number) => (total === 0 ? 0 : Math.round((part / total) * 100));

/**
 * Cohortes semanales de retención.
 *
 * "Volver" es tener actividad **otro** día distinto al del alta: si contara el
 * propio día, todo alumno que se registra y prueba la app aparecería retenido.
 * D7 es "alguna vez entre el día 1 y el 7", no "el día 7 exacto", porque con
 * cohortes de diez alumnos el día exacto es ruido.
 *
 * Una cohorte cuyo plazo no ha cerrado devuelve null, no cero: un porcentaje
 * que solo puede subir se lee como un mal dato, no como un dato pendiente.
 */
export function buildRetentionCohorts(
  students: RetentionStudent[],
  activity: RetentionActivity[],
  now: Date,
): RetentionCohort[] {
  const opened = new Set(activity.map((a) => `${a.userId}|${a.day}`));
  const worked = new Set(activity.filter((a) => a.worked).map((a) => `${a.userId}|${a.day}`));
  const today = madridDay(now);

  const byWeek = new Map<string, RetentionStudent[]>();
  for (const student of students) {
    const week = isoWeek(student.createdAt);
    const list = byWeek.get(week);
    if (list) list.push(student);
    else byWeek.set(week, [student]);
  }

  const returnedWithin = (
    student: RetentionStudent,
    from: number,
    to: number,
    set: Set<string>,
  ) => {
    const signupDay = madridDay(student.createdAt);
    for (let offset = from; offset <= to; offset++) {
      if (set.has(`${student.id}|${addDays(signupDay, offset)}`)) return true;
    }
    return false;
  };

  return [...byWeek.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([week, cohort]) => {
      // El plazo cierra cuando al último alumno de la cohorte le ha dado tiempo:
      // con el primero, un alta del viernes ensuciaría la cifra del lunes.
      const lastSignup = cohort.reduce(
        (max, s) => (madridDay(s.createdAt) > max ? madridDay(s.createdAt) : max),
        '',
      );
      const d1Complete = today > addDays(lastSignup, 1);
      const d7Complete = today > addDays(lastSignup, 7);

      const count = (from: number, to: number, set: Set<string>) =>
        cohort.filter((s) => returnedWithin(s, from, to, set)).length;

      return {
        week,
        signups: cohort.length,
        d1Opened: d1Complete ? pct(count(1, 1, opened), cohort.length) : null,
        d1Worked: d1Complete ? pct(count(1, 1, worked), cohort.length) : null,
        d7Opened: d7Complete ? pct(count(1, 7, opened), cohort.length) : null,
        d7Worked: d7Complete ? pct(count(1, 7, worked), cohort.length) : null,
        d1Complete,
        d7Complete,
      };
    });
}
