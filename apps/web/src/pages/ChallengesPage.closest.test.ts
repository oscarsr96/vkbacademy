import { describe, it, expect } from 'vitest';
import { pickClosest } from './ChallengesPage';
import type { ChallengeWithProgress } from '../api/challenges.api';

const reto = (over: Partial<ChallengeWithProgress> & { id: string }): ChallengeWithProgress =>
  ({
    title: over.id,
    description: '',
    type: 'STUDY_PLAN_CREATED',
    cadence: 'PERMANENT',
    target: 10,
    points: 10,
    badgeIcon: '🚀',
    badgeColor: '#10b981',
    isActive: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    progress: 0,
    completed: false,
    ...over,
  }) as ChallengeWithProgress;

describe('pickClosest — el reto que se destaca arriba', () => {
  it('elige el que va más avanzado en proporción, no en valor absoluto', () => {
    const elegido = pickClosest([
      reto({ id: 'lejos', target: 100, progress: 20 }), // 20%
      reto({ id: 'cerca', target: 10, progress: 8 }), // 80%
    ]);

    expect(elegido?.id).toBe('cerca');
  });

  it('con todo a cero elige el de menos pasos: el primer día importa', () => {
    // Es el caso del alumno recién llegado: 25 retos a 0 y el orden por
    // createdAt puede poner delante uno de 0/100.
    const elegido = pickClosest([
      reto({ id: 'cien-dianas', target: 100, progress: 0 }),
      reto({ id: 'primer-plan', target: 1, progress: 0 }),
      reto({ id: 'diez-temas', target: 10, progress: 0 }),
    ]);

    expect(elegido?.id).toBe('primer-plan');
  });

  it('ignora los ya completados', () => {
    const elegido = pickClosest([
      reto({ id: 'hecho', target: 10, progress: 10, completed: true }),
      reto({ id: 'pendiente', target: 100, progress: 1 }),
    ]);

    expect(elegido?.id).toBe('pendiente');
  });

  it('devuelve undefined si no queda ninguno pendiente', () => {
    expect(pickClosest([reto({ id: 'hecho', progress: 10, completed: true })])).toBeUndefined();
    expect(pickClosest([])).toBeUndefined();
  });

  it('no se cuela un reto con objetivo 0 (division por cero)', () => {
    const elegido = pickClosest([
      reto({ id: 'roto', target: 0, progress: 0 }),
      reto({ id: 'sano', target: 5, progress: 1 }),
    ]);

    expect(elegido?.id).toBe('sano');
  });
});
