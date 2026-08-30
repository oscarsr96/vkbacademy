import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import BadgeShelf, { collectibleBadges } from './BadgeShelf';
import type { ChallengeWithProgress } from '../api/challenges.api';

const reto = (over: Partial<ChallengeWithProgress> & { id: string }): ChallengeWithProgress =>
  ({
    title: over.id,
    description: 'descripción',
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
    completedAt: null,
    ...over,
  }) as ChallengeWithProgress;

describe('collectibleBadges — qué entra en la colección', () => {
  it('deja fuera las misiones semanales: se ganan otra vez cada lunes', () => {
    const badges = collectibleBadges([
      reto({ id: 'permanente' }),
      reto({ id: 'semanal', cadence: 'WEEKLY' }),
    ]);

    expect(badges.map((b) => b.id)).toEqual(['permanente']);
  });

  it('pone delante las conseguidas, y entre ellas la más reciente', () => {
    const badges = collectibleBadges([
      reto({ id: 'pendiente' }),
      reto({ id: 'vieja', completed: true, completedAt: '2026-08-01T10:00:00.000Z' }),
      reto({ id: 'nueva', completed: true, completedAt: '2026-08-20T10:00:00.000Z' }),
    ]);

    expect(badges.map((b) => b.id)).toEqual(['nueva', 'vieja', 'pendiente']);
  });
});

describe('BadgeShelf — cómo se enseña', () => {
  it('muestra las conseguidas con su fecha y cuenta cuántas van', () => {
    render(
      <BadgeShelf
        challenges={[
          reto({ id: 'ganada', title: 'Primer plan', completed: true, completedAt: '2026-08-20T10:00:00.000Z' }),
          reto({ id: 'pendiente', title: 'Cien dianas' }),
        ]}
      />,
    );

    expect(screen.getByText('1 de 2')).toBeInTheDocument();
    expect(screen.getByText('Primer plan')).toBeInTheDocument();
    expect(screen.getByText('20 ago')).toBeInTheDocument();
  });

  it('las que faltan van en silueta, sin candados ni etiquetas de fracaso', () => {
    const { container } = render(
      <BadgeShelf challenges={[reto({ id: 'pendiente', title: 'Cien dianas' })]} />,
    );

    // Está, pero apagada: se sugiere sin señalar lo que no tienes
    const item = screen.getByText('Cien dianas').closest('li')!;
    const icono = within(item).getByText('🚀');
    expect(icono).toHaveStyle({ filter: 'grayscale(1)' });

    expect(container.textContent).not.toMatch(/bloquead|no conseguid|te falta|🔒/i);
  });

  it('con la colección vacía invita, en vez de dejar 25 huecos sin explicación', () => {
    render(<BadgeShelf challenges={[reto({ id: 'a' }), reto({ id: 'b' })]} />);

    expect(screen.getByText('0 de 2')).toBeInTheDocument();
    expect(screen.getByText(/Aún no tienes ninguna/)).toBeInTheDocument();
  });

  it('no pinta nada si no hay retos coleccionables', () => {
    const { container } = render(<BadgeShelf challenges={[reto({ id: 'w', cadence: 'WEEKLY' })]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
