import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ExamLevelCard } from './StudyPlanPage';
import type { StudyPlanExamLevel } from '@vkbacademy/shared';

const level = { key: 'MEDIUM' as StudyPlanExamLevel, label: 'Medio', preset: '10 preguntas' };

function renderCard(busy: boolean) {
  return render(
    <ExamLevelCard
      level={level}
      exam={undefined}
      busy={busy}
      anyBusy={busy}
      onGenerate={vi.fn()}
      onStart={vi.fn()}
    />,
  );
}

describe('ExamLevelCard — botón de generar examen', () => {
  it('dice qué está haciendo mientras genera, no solo un spinner', () => {
    renderCard(true);

    // Generar un examen con IA tarda: el spinner mudo no distinguía
    // "sigue trabajando" de "se ha quedado colgado"
    expect(screen.getByText('Creando examen…')).toBeInTheDocument();
  });

  it('vuelve al texto normal cuando no está generando', () => {
    renderCard(false);

    expect(screen.getByText('Generar examen')).toBeInTheDocument();
    expect(screen.queryByText('Creando examen…')).not.toBeInTheDocument();
  });
});
