import { buildRetentionCohorts } from './retention';

/** Mediodía de Madrid del día indicado, para que la fecha no baile con la zona. */
const at = (day: string) => new Date(`${day}T10:00:00.000Z`);

describe('buildRetentionCohorts', () => {
  const now = at('2026-09-30');

  it('agrupa a los alumnos por la semana en que se dieron de alta', () => {
    const cohorts = buildRetentionCohorts(
      [
        { id: 'a', createdAt: at('2026-08-31') }, // lunes
        { id: 'b', createdAt: at('2026-09-02') }, // miércoles de la misma semana
        { id: 'c', createdAt: at('2026-09-07') }, // lunes siguiente
      ],
      [],
      now,
    );

    expect(cohorts).toHaveLength(2);
    expect(cohorts.map((c) => c.signups)).toEqual([1, 2]);
  });

  it('cuenta como D1 al que vuelve exactamente al día siguiente', () => {
    const cohorts = buildRetentionCohorts(
      [
        { id: 'a', createdAt: at('2026-09-01') },
        { id: 'b', createdAt: at('2026-09-01') },
      ],
      [{ userId: 'a', day: '2026-09-02', worked: false }],
      now,
    );

    expect(cohorts[0].d1Opened).toBe(50);
  });

  it('separa al que solo abrió del que además trabajó', () => {
    const cohorts = buildRetentionCohorts(
      [
        { id: 'a', createdAt: at('2026-09-01') },
        { id: 'b', createdAt: at('2026-09-01') },
      ],
      [
        { userId: 'a', day: '2026-09-02', worked: false },
        { userId: 'b', day: '2026-09-02', worked: true },
      ],
      now,
    );

    expect(cohorts[0].d1Opened).toBe(100);
    expect(cohorts[0].d1Worked).toBe(50);
  });

  it('no cuenta como vuelta la actividad del propio día de alta', () => {
    const cohorts = buildRetentionCohorts(
      [{ id: 'a', createdAt: at('2026-09-01') }],
      [{ userId: 'a', day: '2026-09-01', worked: true }],
      now,
    );

    // Volver es volver otro día; si contara el mismo, todo alumno que se
    // registra y prueba la app aparecería retenido y el número no diría nada.
    expect(cohorts[0].d1Opened).toBe(0);
  });

  it('cuenta como D7 al que vuelve cualquier día de la primera semana', () => {
    const cohorts = buildRetentionCohorts(
      [{ id: 'a', createdAt: at('2026-09-01') }],
      [{ userId: 'a', day: '2026-09-06', worked: true }],
      now,
    );

    // Con cohortes de diez alumnos, "el día 7 exacto" es ruido, no señal.
    expect(cohorts[0].d1Opened).toBe(0);
    expect(cohorts[0].d7Opened).toBe(100);
  });

  it('deja fuera de la ventana D7 lo que pasa al octavo día', () => {
    const cohorts = buildRetentionCohorts(
      [{ id: 'a', createdAt: at('2026-09-01') }],
      [{ userId: 'a', day: '2026-09-09', worked: true }],
      now,
    );

    expect(cohorts[0].d7Opened).toBe(0);
  });

  it('marca como incompleta la cohorte cuyo plazo aún no ha cerrado', () => {
    const cohorts = buildRetentionCohorts(
      [{ id: 'a', createdAt: at('2026-09-29') }],
      [],
      at('2026-10-01'),
    );

    // El alta fue anteayer: el día D1 (el 30) ya terminó y se puede saber; los
    // siete primeros días no. Pintar un 0% que solo puede subir se lee como un
    // mal dato, no como un dato pendiente.
    expect(cohorts[0].d1Complete).toBe(true);
    expect(cohorts[0].d7Complete).toBe(false);
    expect(cohorts[0].d7Opened).toBeNull();
  });

  it('no da por cerrado el D1 mientras el día siguiente sigue en curso', () => {
    const cohorts = buildRetentionCohorts(
      [{ id: 'a', createdAt: at('2026-09-29') }],
      [],
      at('2026-09-30'),
    );

    expect(cohorts[0].d1Complete).toBe(false);
    expect(cohorts[0].d1Opened).toBeNull();
  });

  it('el plazo lo marca el último alumno de la cohorte, no el primero', () => {
    const cohorts = buildRetentionCohorts(
      [
        { id: 'a', createdAt: at('2026-09-28') }, // su D1 ya cerró
        { id: 'b', createdAt: at('2026-09-29') }, // el suyo es hoy, aún no
      ],
      [],
      at('2026-09-30'),
    );

    expect(cohorts[0].d1Complete).toBe(false);
  });

  it('devuelve las cohortes de la más reciente a la más antigua', () => {
    const cohorts = buildRetentionCohorts(
      [
        { id: 'a', createdAt: at('2026-08-10') },
        { id: 'b', createdAt: at('2026-09-14') },
      ],
      [],
      now,
    );

    expect(cohorts[0].week > cohorts[1].week).toBe(true);
  });

  it('devuelve lista vacía si no hay alumnos', () => {
    expect(buildRetentionCohorts([], [], now)).toEqual([]);
  });
});
